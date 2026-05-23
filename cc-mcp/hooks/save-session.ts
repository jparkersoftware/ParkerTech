#!/usr/bin/env -S npx -y tsx
/**
 * Claude Code SessionEnd hook.
 *
 * Reads the just-ended session's JSONL transcript and writes a clean
 * markdown transcript into the Obsidian vault under
 *   Daily/Claude-Sessions/{date}-{session_id:8}.md
 *
 * Filters to plain text turns (skips tool calls + tool results). Optionally
 * commits + pushes from the vault so the file is on GitHub immediately.
 *
 * Hook contract (stdin JSON):
 *   { session_id, transcript_path, cwd, hook_event_name, permission_mode }
 *
 * Stays silent on stdout. Logs warnings/errors to stderr. Always exits 0
 * (the session has already ended; failing here mustn't surface to the user).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

const VAULT = join(homedir(), 'Documents', 'Obsidian', 'ParkerTechFire');
const SESSIONS_DIR = join(VAULT, 'Daily', 'Claude-Sessions');

/**
 * Auto-save every Claude Code session as persistent memory. Set to true if
 * you ever want to scope it down — e.g. only sessions from the vault or a
 * specific project folder. With this off, EVERY session gets archived
 * (coding sessions, vault sessions, anywhere on the Mac).
 */
const SCOPE_TO_VAULT_ONLY = false;

type HookPayload = {
  session_id?: string;
  transcript_path?: string;
  cwd?: string;
};

type Turn = { role: 'user' | 'assistant'; text: string };

void (async function main() {
  try {
    const payload = readStdinJson<HookPayload>();
    const sessionId = payload.session_id ?? 'unknown';
    const transcriptPath = payload.transcript_path;
    const cwd = payload.cwd ?? '';

    if (!transcriptPath || !existsSync(transcriptPath)) {
      log(`no transcript at ${transcriptPath}`);
      process.exit(0);
    }

    if (SCOPE_TO_VAULT_ONLY && !(cwd === VAULT || cwd.startsWith(`${VAULT}/`))) {
      log(`cwd ${cwd} outside vault, skipping (SCOPE_TO_VAULT_ONLY=true)`);
      process.exit(0);
    }

    const turns = readTurns(transcriptPath);
    if (turns.length === 0) {
      log('empty session, skipping');
      process.exit(0);
    }

    const date = new Date().toISOString().slice(0, 10);
    const time = new Date().toISOString().slice(11, 19);
    const shortId = sessionId.slice(0, 8);
    const cwdSlug = slugifyCwd(cwd);
    const relPath = join(
      'Daily',
      'Claude-Sessions',
      `${date}-${cwdSlug}-${shortId}.md`,
    );
    const fullPath = join(VAULT, relPath);

    const markdown = renderMarkdown({ sessionId, date, time, cwd, turns });

    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, markdown);
    log(`saved ${turns.length} turns to ${relPath}`);

    tryCommit(relPath, shortId);

    // Refresh the vault's Knowledge/Index.md so it stays current between
    // sessions. Non-blocking — if it fails, the session save still succeeded.
    tryRebuildVaultIndex();

    process.exit(0);
  } catch (err) {
    log(`error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(0);
  }
})();

// ── helpers ──────────────────────────────────────────────────────

function readStdinJson<T>(): T {
  const raw = readFileSync(0, 'utf-8');
  if (!raw.trim()) return {} as T;
  return JSON.parse(raw) as T;
}

function readTurns(path: string): Turn[] {
  const out: Turn[] = [];
  const raw = readFileSync(path, 'utf-8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      continue;
    }
    const text = extractText(obj);
    if (!text) continue;
    const role = extractRole(obj);
    if (role !== 'user' && role !== 'assistant') continue;
    out.push({ role, text });
  }
  return out;
}

function extractRole(obj: Record<string, unknown>): string | undefined {
  if (typeof obj.role === 'string') return obj.role;
  if (typeof obj.type === 'string') {
    const t = obj.type as string;
    if (t === 'user' || t === 'assistant') return t;
  }
  const msg = obj.message as Record<string, unknown> | undefined;
  if (msg && typeof msg.role === 'string') return msg.role;
  return undefined;
}

function extractText(obj: Record<string, unknown>): string {
  const content =
    (obj.content as unknown) ??
    ((obj.message as Record<string, unknown> | undefined)?.content as unknown);

  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const block of content) {
      if (
        block &&
        typeof block === 'object' &&
        (block as Record<string, unknown>).type === 'text'
      ) {
        const text = (block as Record<string, unknown>).text;
        if (typeof text === 'string') parts.push(text);
      }
    }
    return parts.join('\n').trim();
  }
  return '';
}

function renderMarkdown(args: {
  sessionId: string;
  date: string;
  time: string;
  cwd: string;
  turns: Turn[];
}): string {
  const { sessionId, date, time, cwd, turns } = args;
  const userCount = turns.filter((t) => t.role === 'user').length;
  const lines: string[] = [];
  lines.push('---');
  lines.push('type: claude-session');
  lines.push(`session_id: ${sessionId}`);
  lines.push(`date: ${date}`);
  lines.push(`time: ${time}`);
  if (cwd) lines.push(`cwd: ${quoteYaml(cwd)}`);
  lines.push(`turns: ${turns.length}`);
  lines.push(`user_turns: ${userCount}`);
  lines.push('source: claude-code');
  lines.push('---');
  lines.push('');
  lines.push(`# Claude session — ${date} ${time}`);
  lines.push('');
  if (cwd) lines.push(`Working directory: \`${cwd}\``, '');

  for (const t of turns) {
    lines.push(t.role === 'user' ? '## User' : '## Claude');
    lines.push('');
    lines.push(t.text);
    lines.push('');
  }

  return lines.join('\n');
}

function quoteYaml(s: string): string {
  if (/[:#&*?,\[\]{}\n"]|^\s|\s$/.test(s)) {
    return `"${s.replace(/"/g, '\\"')}"`;
  }
  return s;
}

function slugifyCwd(cwd: string): string {
  if (!cwd) return 'unknown';
  const base = cwd.split('/').filter(Boolean).pop() ?? 'unknown';
  return (
    base
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
      .slice(0, 40) || 'unknown'
  );
}

function tryCommit(relPath: string, shortId: string): void {
  try {
    execSync(`git add ${shellQuote(relPath)}`, { cwd: VAULT, stdio: 'ignore' });
    execSync(`git diff --cached --quiet`, { cwd: VAULT, stdio: 'ignore' });
    // If we got here, no staged changes — nothing to commit.
    log('no changes to commit');
  } catch {
    // diff --cached --quiet exits 1 when there ARE staged changes; commit + push.
    try {
      execSync(
        `git -c user.name="Claude Session Hook" -c user.email=hook@parkertech.local commit -m "Save Claude session ${shortId}"`,
        { cwd: VAULT, stdio: 'ignore' },
      );
      execSync(`git push origin HEAD`, { cwd: VAULT, stdio: 'ignore' });
      log(`pushed session ${shortId}`);
    } catch (err) {
      log(`commit/push failed (non-fatal): ${err instanceof Error ? err.message : err}`);
    }
  }
}

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}

function tryRebuildVaultIndex(): void {
  try {
    // Sibling script in the same hooks/ folder. Absolute path so the call
    // is portable across cwds.
    const scriptPath = join(
      homedir(),
      'Documents',
      'ParkerTech Portfolio',
      'cc-mcp',
      'hooks',
      'rebuild-vault-index.ts',
    );
    execSync(shellQuote(scriptPath), { stdio: 'ignore', timeout: 30_000 });
    log('rebuilt vault index');
  } catch (err) {
    log(`vault index rebuild failed (non-fatal): ${err instanceof Error ? err.message : err}`);
  }
}

function log(message: string): void {
  process.stderr.write(`[save-session] ${message}\n`);
}
