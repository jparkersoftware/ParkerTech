/**
 * Read-side of the vault bridge. CC has always written markdown to the
 * GitHub-mirrored vault; these helpers let it READ from the same repo using
 * the same PAT (Contents read/write, stored in meta/settings).
 *
 * Everything is cached in-memory for a few minutes — vault content changes
 * slowly and these calls run on page mounts.
 */
import type { GithubConfig } from './github';

const TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; value: string | null }>();

/**
 * Fetch a vault file's text content. Returns null if it doesn't exist.
 * Path is repo-relative, e.g. `Daily/2026-06-10.md`.
 */
export async function readVaultFile(
  cfg: GithubConfig,
  path: string,
): Promise<string | null> {
  const key = `${cfg.owner}/${cfg.repo}/${cfg.branch}:${path}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(cfg.branch)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${cfg.pat}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  let value: string | null = null;
  if (res.ok) {
    const data = (await res.json()) as { content?: string; encoding?: string };
    if (data.content) value = fromBase64(data.content);
  } else if (res.status !== 404) {
    throw new Error(`GitHub ${res.status} reading ${path}`);
  }
  cache.set(key, { at: Date.now(), value });
  return value;
}

/** Strip YAML frontmatter from a markdown document. */
export function stripFrontmatter(md: string): string {
  if (!md.startsWith('---')) return md;
  const end = md.indexOf('\n---', 3);
  if (end < 0) return md;
  return md.slice(end + 4).replace(/^\s+/, '');
}

export type KnowledgeEntry = {
  path: string; // vault-relative, no .md — ready for obsidian:// links
  title: string;
  summary: string;
};

/**
 * Parse Knowledge/Index.md (auto-generated catalogue) into entries.
 * Line shape: `- [[Knowledge/Cat/slug|Title]] — summary`
 */
export function parseKnowledgeIndex(md: string): KnowledgeEntry[] {
  const entries: KnowledgeEntry[] = [];
  for (const line of md.split('\n')) {
    const m = line.match(/^- \[\[([^|\]]+)\|([^\]]+)\]\] — (.*)$/);
    if (m) entries.push({ path: m[1]!, title: m[2]!, summary: m[3]! });
  }
  return entries;
}

/** Entries whose title or summary mention the needle (case-insensitive). */
export function filterKnowledge(
  entries: KnowledgeEntry[],
  needle: string,
): KnowledgeEntry[] {
  const n = needle.toLowerCase();
  // Also try the first word alone ("Cavendish" matches more than
  // "Cavendish Education") — schools are usually referenced by short name.
  const first = n.split(/\s+/)[0] ?? n;
  return entries.filter((e) => {
    const hay = `${e.path} ${e.title} ${e.summary}`.toLowerCase();
    return hay.includes(n) || (first.length >= 4 && hay.includes(first));
  });
}

function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

function fromBase64(b64: string): string {
  const binary = atob(b64.replace(/\s+/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}
