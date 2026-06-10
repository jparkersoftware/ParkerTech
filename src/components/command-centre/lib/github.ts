/**
 * Minimal GitHub Contents API client.
 *
 * Just enough to upsert markdown files into a private repo from the browser
 * using a fine-grained PAT. No external dependency — uses fetch + base64.
 */

export type GithubConfig = {
  owner: string;
  repo: string;
  branch: string;
  pat: string;
};

export async function pingRepo(cfg: GithubConfig): Promise<void> {
  const res = await fetch(
    `https://api.github.com/repos/${cfg.owner}/${cfg.repo}`,
    {
      headers: authHeaders(cfg.pat),
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`GitHub ${res.status}: ${shortErr(body)}`);
  }
}

/**
 * Create or overwrite a file in the repo.
 * Tries create first; on 422/409 (file exists / sha stale), fetches the
 * current sha and retries. The repo is also pushed to by the Obsidian Git
 * plugin on Joseph's Mac, so the sha can go stale between our fetch and PUT —
 * CC is authoritative for the files it generates, so we re-fetch and retry
 * (last writer wins) a few times before giving up.
 */
export async function upsertFile(
  cfg: GithubConfig,
  path: string,
  content: string,
  commitMessage: string,
): Promise<void> {
  const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${encodePath(path)}`;
  const body: Record<string, unknown> = {
    message: commitMessage,
    content: toBase64(content),
    branch: cfg.branch,
  };

  const MAX_ATTEMPTS = 4;
  let res = await fetch(url, {
    method: 'PUT',
    headers: { ...authHeaders(cfg.pat), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  for (let attempt = 1; (res.status === 422 || res.status === 409) && attempt < MAX_ATTEMPTS; attempt++) {
    // File exists or our sha went stale — fetch the current sha and retry.
    const existing = await fetch(
      `${url}?ref=${encodeURIComponent(cfg.branch)}&t=${Date.now()}`,
      { headers: authHeaders(cfg.pat), cache: 'no-store' },
    );
    if (!existing.ok) {
      const errBody = await existing.text().catch(() => '');
      throw new Error(`GitHub ${existing.status} (fetch existing): ${shortErr(errBody)}`);
    }
    const data = (await existing.json()) as { sha: string; content?: string };
    if (data.content && b64Equal(data.content, body.content as string)) {
      // No actual change; skip the redundant write.
      return;
    }
    body.sha = data.sha;
    if (attempt > 1) await sleep(400 * attempt); // brief backoff if someone is racing us
    res = await fetch(url, {
      method: 'PUT',
      headers: { ...authHeaders(cfg.pat), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`GitHub ${res.status}: ${shortErr(errBody)}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function authHeaders(pat: string): HeadersInit {
  return {
    Authorization: `Bearer ${pat}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

function toBase64(s: string): string {
  // UTF-8 safe base64 — browser btoa only handles latin1 directly.
  const bytes = new TextEncoder().encode(s);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function b64Equal(remote: string, local: string): boolean {
  // GitHub returns base64 with line breaks every 60 chars.
  return remote.replace(/\s+/g, '') === local.replace(/\s+/g, '');
}

function shortErr(body: string): string {
  try {
    const j = JSON.parse(body) as { message?: string };
    return j.message ?? body.slice(0, 200);
  } catch {
    return body.slice(0, 200);
  }
}
