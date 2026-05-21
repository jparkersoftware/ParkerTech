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
 * Create or overwrite a file in the repo. Returns the new content sha.
 * Tries create first; on 422 (sha required), fetches the current sha and
 * retries as an update.
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

  let res = await fetch(url, {
    method: 'PUT',
    headers: { ...authHeaders(cfg.pat), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (res.status === 422 || res.status === 409) {
    // File already exists — need the current sha to update it.
    const existing = await fetch(
      `${url}?ref=${encodeURIComponent(cfg.branch)}`,
      { headers: authHeaders(cfg.pat) },
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
