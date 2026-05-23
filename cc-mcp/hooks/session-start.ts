#!/usr/bin/env -S npx -y tsx
/**
 * Claude Code SessionStart hook.
 *
 * Outputs a small context block at the start of every session. Stdout is
 * prepended to Claude's context, so EVERY BYTE becomes per-session token
 * tax. Stay lean.
 *
 * What we inject:
 *   - today's date + day name
 *   - cwd
 *   - 1-line pointer to most recent Daily note (so Claude can read it if needed)
 *   - 1-line pointers to last 3 Claude session transcripts (continuity
 *     breadcrumbs — Claude reads them on demand, doesn't get them inline)
 *
 * What we DON'T inject:
 *   - the contents of the Daily note (would duplicate what CLAUDE.md routing says
 *     to read)
 *   - identity / vault layout (already in CLAUDE.md — every session loads it)
 *   - active project list (Claude can call list_projects when relevant)
 *
 * Errors never block session start (always exits 0, silent on stdout if it fails).
 *
 * Hook contract (stdin JSON):
 *   { session_id, cwd, hook_event_name, transcript_path? }
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const VAULT = join(homedir(), 'Documents', 'Obsidian', 'ParkerTechFire');
const SESSIONS_DIR = join(VAULT, 'Daily', 'Claude-Sessions');
const DAILY_DIR = join(VAULT, 'Daily');

type HookPayload = {
  session_id?: string;
  cwd?: string;
  hook_event_name?: string;
};

void (async function main() {
  try {
    const payload = readStdinJson<HookPayload>();
    const cwd = payload.cwd ?? '';

    const lines: string[] = [];
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const dayName = now.toLocaleDateString('en-GB', { weekday: 'long' });

    lines.push('## Session start');
    lines.push(`**Today:** ${today} (${dayName})`);
    if (cwd) lines.push(`**cwd:** \`${cwd}\``);

    // Most recent manual Daily journal (NOT Claude-Sessions, which is the auto archive)
    const latestDaily = findLatestDaily();
    if (latestDaily) {
      const rel = `Daily/${latestDaily}`;
      lines.push(`**Latest Daily note:** \`${rel}\` — read if you need yesterday's context.`);
    }

    // Most recent 3 Claude session transcripts. Filenames only — they tell Claude
    // what was worked on, and it can read the full thing on demand.
    const recentSessions = findRecentSessions(3);
    if (recentSessions.length > 0) {
      lines.push('**Recent Claude sessions** (read on demand for continuity):');
      for (const f of recentSessions) {
        lines.push(`  - \`Daily/Claude-Sessions/${f}\``);
      }
    }

    // Vault-active hint
    if (cwd === VAULT || cwd.startsWith(`${VAULT}/`)) {
      lines.push('**In the vault** — CLAUDE.md routing applies. Use `Knowledge/Index.md` as the entry point.');
    }

    // End with a blank line so the next thing in context is cleanly separated.
    lines.push('');

    process.stdout.write(lines.join('\n'));
    process.exit(0);
  } catch {
    process.exit(0);
  }
})();

// ── helpers ──────────────────────────────────────────────────────

function readStdinJson<T>(): T {
  try {
    const raw = readFileSync(0, 'utf-8');
    if (!raw.trim()) return {} as T;
    return JSON.parse(raw) as T;
  } catch {
    return {} as T;
  }
}

function findLatestDaily(): string | null {
  if (!existsSync(DAILY_DIR)) return null;
  try {
    const files = readdirSync(DAILY_DIR)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
      .sort();
    return files.length > 0 ? files[files.length - 1] : null;
  } catch {
    return null;
  }
}

function findRecentSessions(n: number): string[] {
  if (!existsSync(SESSIONS_DIR)) return [];
  try {
    return readdirSync(SESSIONS_DIR)
      .filter((f) => f.endsWith('.md'))
      .sort()
      .reverse()
      .slice(0, n);
  } catch {
    return [];
  }
}
