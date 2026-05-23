#!/usr/bin/env -S npx -y tsx
/**
 * Standalone rebuild of the vault Knowledge/Index.md.
 *
 * Invoked by save-session.ts (the SessionEnd hook) so the Knowledge index
 * stays fresh between sessions without anyone having to manually call
 * vault_rebuild_index. Also runnable standalone for ad-hoc rebuilds:
 *   npx tsx /Users/jelst/Documents/ParkerTech\ Portfolio/cc-mcp/hooks/rebuild-vault-index.ts
 *
 * ⚠️  KEEP IN SYNC with `cc-mcp/index.ts` `vault_rebuild_index` tool
 *     (the logic is duplicated by design — extracting to a shared module
 *     adds complexity for a stable ~70-line block). When you change one,
 *     change the other.
 *
 * Always exits 0 — never blocks the session-end hook.
 */

import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { execSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';

const VAULT_ROOT = join(homedir(), 'Documents', 'Obsidian', 'ParkerTechFire');
const KNOWLEDGE_ROOT = join(VAULT_ROOT, 'Knowledge');
const INDEX_PATH = join(KNOWLEDGE_ROOT, 'Index.md');

void (function main() {
  try {
    if (!existsSync(KNOWLEDGE_ROOT)) {
      log('Knowledge/ folder does not exist; nothing to rebuild');
      process.exit(0);
    }

    const entries: { category: string; title: string; path: string; summary: string }[] = [];

    function walk(dir: string, category: string): void {
      for (const name of readdirSync(dir)) {
        if (name.startsWith('.')) continue;
        if (name === 'Index.md') continue;
        const full = join(dir, name);
        const stat = statSync(full);
        if (stat.isDirectory()) {
          walk(full, name);
        } else if (name.endsWith('.md')) {
          const content = readFileSync(full, 'utf-8');
          const title = parseTitle(content, name);
          const summary = parseSummary(content);
          const rel = full.replace(`${VAULT_ROOT}/`, '');
          entries.push({ category, title, path: rel, summary });
        }
      }
    }

    walk(KNOWLEDGE_ROOT, 'General');

    entries.sort((a, b) =>
      a.category === b.category
        ? a.title.localeCompare(b.title)
        : a.category.localeCompare(b.category),
    );

    const byCat = new Map<string, typeof entries>();
    for (const e of entries) {
      if (!byCat.has(e.category)) byCat.set(e.category, []);
      byCat.get(e.category)!.push(e);
    }

    const lines: string[] = [
      '---',
      'type: knowledge-index',
      `updated: ${new Date().toISOString()}`,
      `entries: ${entries.length}`,
      'source: claude-code',
      '---',
      '',
      '# Knowledge Index',
      '',
      'Auto-generated catalogue of every note in `Knowledge/`. Refresh via `vault_rebuild_index` or the SessionEnd hook (whichever fires first). Scan this first when you need to find what we already know about something.',
      '',
    ];

    for (const [cat, items] of byCat) {
      lines.push(`## ${cat}`, '');
      for (const e of items) {
        const link = e.path.replace(/\.md$/, '');
        lines.push(`- [[${link}|${e.title}]] — ${e.summary || '_(no summary)_'}`);
      }
      lines.push('');
    }

    writeFileSync(INDEX_PATH, lines.join('\n'));
    log(`rebuilt ${entries.length} entries`);

    // Commit + push the index update, non-blocking on failure.
    tryCommitVault(`index: rebuild (${entries.length} entries)`);
    process.exit(0);
  } catch (err) {
    log(`error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(0);
  }
})();

// ── helpers (mirrors of cc-mcp/index.ts) ──────────────────────────

function parseTitle(content: string, fallbackName: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  if (match) return match[1]!.trim();
  return fallbackName.replace(/\.md$/, '').replace(/-/g, ' ');
}

function parseSummary(content: string): string {
  const body = content.replace(/^---[\s\S]*?---\n?/, '');
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#')) continue;
    return line.slice(0, 200);
  }
  return '';
}

function tryCommitVault(message: string): void {
  try {
    execSync('git add Knowledge/Index.md', { cwd: VAULT_ROOT, stdio: 'ignore' });
    execSync('git diff --cached --quiet', { cwd: VAULT_ROOT, stdio: 'ignore' });
    // No staged changes — nothing to commit.
  } catch {
    try {
      execSync(
        `git -c user.name="Claude Session Hook" -c user.email=hook@parkertech.local commit -m ${JSON.stringify(message)}`,
        { cwd: VAULT_ROOT, stdio: 'ignore' },
      );
      execSync('git push origin HEAD', { cwd: VAULT_ROOT, stdio: 'ignore' });
    } catch {
      // Non-fatal — Obsidian Git will catch it later.
    }
  }
}

function log(message: string): void {
  process.stderr.write(`[rebuild-vault-index] ${message}\n`);
}
