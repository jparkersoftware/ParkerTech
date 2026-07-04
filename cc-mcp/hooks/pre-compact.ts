#!/usr/bin/env -S npx -y tsx
/**
 * Claude Code PreCompact hook.
 *
 * Fires JUST BEFORE Claude's context is auto-compacted. Long sessions hit this;
 * during compaction, the "critical state" Claude needs to keep behaving
 * correctly (identity, immutable rules, active engagement IDs) can get
 * summarised into uselessness.
 *
 * This hook re-injects a small block of MUST-NOT-LOSE state, plus breadcrumbs
 * to where the dynamic state lives. Compaction itself is supposed to preserve
 * the rolling conversation — we don't duplicate that here. We protect what
 * doesn't change but matters.
 *
 * Output is stdout, prepended to post-compaction context. EVERY BYTE is paid
 * for forever after compaction, so stay lean.
 *
 * Hook contract (stdin JSON):
 *   { session_id, cwd, hook_event_name, transcript_path? }
 *
 * Always exits 0 — must never block compaction.
 */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const VAULT = join(homedir(), 'Documents', 'Obsidian', 'ParkerTechFire');
const MEMORY = join(
  homedir(),
  '.claude',
  'projects',
  '-Users-jelst-Documents-ParkerTech-Portfolio',
  'memory',
  'MEMORY.md',
);

type HookPayload = {
  session_id?: string;
  cwd?: string;
  hook_event_name?: string;
};

void (async function main() {
  try {
    const payload = readStdinJson<HookPayload>();
    const sessionId = payload.session_id ?? '';
    const cwd = payload.cwd ?? '';

    const lines: string[] = [];
    const today = new Date().toISOString().slice(0, 10);

    lines.push('## Compaction-survival context');
    lines.push('');
    lines.push(
      "**Joseph Parker** (ParkerTech founder, parkertech.co.uk) — ex-teacher (10 yrs), now builds ed-tech for UK schools.",
    );
    lines.push(
      'Plain English, British spelling, candid reads not validation. ADHD-pattern thinker — needs external structure to focus.',
    );
    lines.push('');

    lines.push('### Immutable rules (DO NOT FORGET, even after compaction)');
    lines.push('1. **Anonymise client schools** in portfolio copy — "a school", never the name.');
    lines.push('2. **Cavendish Monday.com is VIEW-ONLY** — never amend tasks/items on monday.com.');
    lines.push('3. **GDPR posture on PII** — passwords/keys/credentials get redacted, never paraphrased into Knowledge notes.');
    lines.push('4. **Vault entity files are Claude-authored** (CC retired 2026-07-02) — edit `Clients/`, `Projects/`, `People/`, `Correspondence/`, `Quotes/` markdown directly, keeping the existing file formats. The old CC Firestore tools no longer exist.');
    lines.push('5. **Direct user requests > inferred intent** — when in doubt, ask.');
    lines.push('');

    lines.push('### Where the rest lives (read if context feels lost)');
    lines.push('- **Identity + vault routing:** vault `CLAUDE.md`');
    lines.push('- **Current engagements + project IDs:** auto-memory `MEMORY.md`');
    lines.push(`- **This session's full transcript:** \`Daily/Claude-Sessions/${today}-*-${sessionId.slice(0, 8)}.md\` (saved on session end)`);
    lines.push('- **Knowledge wiki:** `Knowledge/Index.md` (rebuilt via `vault_rebuild_index`)');
    if (cwd) lines.push(`- **cwd at compaction:** \`${cwd}\``);
    lines.push('');

    // Pull just the MEMORY.md index lines (it's already lean — ~12 lines).
    // This is the highest-leverage chunk of dynamic state we can include
    // without bloating: the index of "what Joseph is currently doing".
    if (existsSync(MEMORY)) {
      try {
        const memContent = readFileSync(MEMORY, 'utf-8');
        // Strip blank lines + the H1 — just keep the index entries
        const indexLines = memContent
          .split('\n')
          .filter((l) => l.startsWith('- ['))
          .slice(0, 15);
        if (indexLines.length > 0) {
          lines.push('### Active topic index (from MEMORY.md)');
          for (const l of indexLines) lines.push(l);
          lines.push('');
        }
      } catch {
        // ignore — never block compaction
      }
    }

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
