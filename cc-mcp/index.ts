/**
 * ParkerTech vault MCP server.
 *
 * Exposes Joseph's Obsidian vault (persistent memory) to Claude: search,
 * read, and structured writes (Knowledge notes, Daily entries, raw sources)
 * plus index rebuild and conversation snapshots.
 *
 * The Command Centre (Firestore CRM) half of this server was retired on
 * 2026-07-02 — see the vault note
 * Knowledge/Decisions/Drop-Command-Centre-vault-becomes-the-whole-brain-20260702.md.
 * Firestore itself is a read-only safety net until ~Aug 2026; the final export
 * lives at vault Claude-Backup/firestore-final-export-2026-07-02.json.
 *
 * Wire-up: add this to your Claude Code MCP config (see README).
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { execFileSync, execSync } from 'node:child_process';

const VAULT_ROOT = join(homedir(), 'Documents', 'Obsidian', 'ParkerTechFire');

const server = new McpServer({
  name: 'parkertech-cc',
  version: '0.2.0',
});

// ── helpers ──────────────────────────────────────────────────────

function ok(payload: unknown): { content: { type: 'text'; text: string }[] } {
  return {
    content: [
      {
        type: 'text',
        text:
          typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2),
      },
    ],
  };
}

function err(message: string): { content: { type: 'text'; text: string }[]; isError: true } {
  return { content: [{ type: 'text', text: message }], isError: true };
}


const VAULT_WRITABLE_PREFIXES = ['Knowledge/', 'Daily/', 'Inbox/', 'raw/'];

function vaultPath(relative: string): string {
  const trimmed = relative.replace(/^\/+/, '');
  if (trimmed.includes('..')) throw new Error('paths must not include ".."');
  return join(VAULT_ROOT, trimmed);
}

function ensureWritable(relative: string): void {
  if (!VAULT_WRITABLE_PREFIXES.some((p) => relative.startsWith(p))) {
    throw new Error(
      `Refusing to write outside writable areas. Allowed prefixes: ${VAULT_WRITABLE_PREFIXES.join(', ')}`,
    );
  }
}

function tryCommitVault(message: string): void {
  try {
    execSync('git add -A', { cwd: VAULT_ROOT, stdio: 'ignore' });
    execSync('git diff --cached --quiet', { cwd: VAULT_ROOT, stdio: 'ignore' });
  } catch {
    try {
      execSync(
        `git -c user.name="Claude" -c user.email=claude@parkertech.local commit -m ${JSON.stringify(message)}`,
        { cwd: VAULT_ROOT, stdio: 'ignore' },
      );
      execSync('git push origin HEAD', { cwd: VAULT_ROOT, stdio: 'ignore' });
    } catch {
      // Non-fatal — Obsidian Git will catch it later.
    }
  }
}

server.tool(
  'vault_read',
  'Read a markdown file from the Obsidian vault. Use relative paths like "Clients/St-Marys.md" or "Knowledge/Wonde-API.md". Useful when launched from a coding repo (without direct fs access to the vault).',
  { path: z.string().describe('Relative path inside the vault') },
  async ({ path }) => {
    const full = vaultPath(path);
    if (!existsSync(full)) return err(`No file at ${path}.`);
    const content = readFileSync(full, 'utf-8');
    return ok(content);
  },
);

server.tool(
  'vault_list',
  'List markdown files in a vault folder (non-recursive). Defaults to listing top-level folders.',
  { folder: z.string().default('').describe('Folder relative to vault root, e.g. "Knowledge" or "Daily/Claude-Sessions"') },
  async ({ folder }) => {
    const full = vaultPath(folder || '.');
    if (!existsSync(full)) return err(`No folder at ${folder || 'vault root'}.`);
    const entries = readdirSync(full)
      .filter((name) => !name.startsWith('.'))
      .map((name) => {
        const path = join(full, name);
        const isDir = statSync(path).isDirectory();
        return isDir ? `${name}/` : name;
      })
      .sort();
    return ok(entries);
  },
);

server.tool(
  'vault_search',
  'Search the whole vault for a string (case-insensitive, fixed-string by default). THE preferred way to find what the vault knows about something — far cheaper than reading Knowledge/Index.md. Returns matching lines as "path:line:text".',
  {
    query: z.string().min(2).describe('Text to search for, e.g. "Wonde API" or "Vanessa"'),
    folder: z
      .string()
      .default('')
      .describe('Optional folder to scope the search, e.g. "Knowledge" or "Correspondence"'),
    regex: z.boolean().default(false).describe('Treat query as a POSIX regex instead of a fixed string'),
    maxResults: z.number().int().min(1).max(200).default(60),
  },
  async ({ query, folder, regex, maxResults }) => {
    const root = vaultPath(folder || '.');
    if (!existsSync(root)) return err(`No folder at ${folder}.`);
    const args = [
      '-r',
      '-i',
      '-n',
      '--include=*.md',
      '--exclude-dir=.git',
      '--exclude-dir=.obsidian',
      regex ? '-E' : '-F',
      '-m',
      '5', // max hits per file — keeps one chatty file from drowning results
      query,
      '.',
    ];
    let out = '';
    try {
      out = execFileSync('grep', args, {
        cwd: root,
        encoding: 'utf-8',
        maxBuffer: 4 * 1024 * 1024,
      });
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status === 1) return ok({ matches: [], note: 'No matches.' });
      return err(`Search failed: ${(e as Error).message}`);
    }
    const prefix = folder ? `${folder.replace(/\/$/, '')}/` : '';
    const lines = out
      .split('\n')
      .filter(Boolean)
      .map((l) => prefix + l.replace(/^\.\//, ''))
      .map((l) => (l.length > 220 ? `${l.slice(0, 220)}…` : l));
    const truncated = lines.length > maxResults;
    return ok({
      matches: lines.slice(0, maxResults),
      totalFound: lines.length,
      ...(truncated
        ? { note: `Truncated to ${maxResults} of ${lines.length} lines — narrow the query or scope with folder.` }
        : {}),
    });
  },
);

server.tool(
  'vault_write_knowledge',
  'Write a Knowledge note to the vault. Use to record a durable fact, pattern, decision, or context worth remembering across sessions. Overwrites the file if it exists; use vault_append_knowledge to add without losing existing content.',
  {
    category: z
      .enum(['Patterns', 'Decisions', 'Context', 'Mistakes', 'Systems', 'People', 'General'])
      .describe('Subfolder under Knowledge/. Choose the best fit for the note.'),
    title: z
      .string()
      .describe('Short title — used as both H1 and slugified into the filename.'),
    body: z.string().describe('Markdown body. Frontmatter will be added automatically.'),
    tags: z.array(z.string()).default([]),
    related: z
      .array(z.string())
      .default([])
      .describe('Optional list of wikilink targets like "Clients/St-Marys" to link from this note.'),
  },
  async ({ category, title, body, tags, related }) => {
    const slug = title
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9 ]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 60) || 'untitled';
    const relPath = join('Knowledge', category, `${slug}.md`);
    const full = vaultPath(relPath);
    ensureWritable(relPath);
    mkdirSync(dirname(full), { recursive: true });

    const nowIso = new Date().toISOString();
    const created =
      (existsSync(full) ? readFrontmatterValue(readFileSync(full, 'utf-8'), 'created') : null) ??
      nowIso;

    const fm: string[] = ['---'];
    fm.push(`type: knowledge`);
    fm.push(`category: ${category}`);
    fm.push(`title: ${JSON.stringify(title)}`);
    fm.push(`created: ${created}`);
    fm.push(`updated: ${nowIso}`);
    if (tags.length) fm.push(`tags: [${tags.map((t) => JSON.stringify(t)).join(', ')}]`);
    if (related.length)
      fm.push(`related:\n${related.map((r) => `  - "[[${r}]]"`).join('\n')}`);
    fm.push('source: claude-code');
    fm.push('---', '');

    writeFileSync(full, `${fm.join('\n')}# ${title}\n\n${body}\n`);
    tryCommitVault(`knowledge: ${category}/${title}`);
    return ok({ ok: true, path: relPath });
  },
);

server.tool(
  'vault_append_knowledge',
  'Append a section to an existing Knowledge note, or create it if missing. Use to grow a note over time without overwriting prior content.',
  {
    category: z.enum(['Patterns', 'Decisions', 'Context', 'Mistakes', 'Systems', 'People', 'General']),
    title: z.string().describe('Note title — must match the existing file or a new one is created.'),
    sectionHeading: z
      .string()
      .describe('A short heading for the new section (will be rendered as ## heading).'),
    body: z.string(),
  },
  async ({ category, title, sectionHeading, body }) => {
    const slug = title
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9 ]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 60) || 'untitled';
    const relPath = join('Knowledge', category, `${slug}.md`);
    const full = vaultPath(relPath);
    ensureWritable(relPath);
    mkdirSync(dirname(full), { recursive: true });

    const nowIso = new Date().toISOString();
    const stamp = `${nowIso.slice(0, 16)}Z`;
    const section = `\n## ${sectionHeading} — ${stamp}\n\n${body}\n`;

    if (existsSync(full)) {
      const current = bumpFrontmatterTimestamps(readFileSync(full, 'utf-8'), nowIso);
      writeFileSync(full, `${current.trimEnd()}\n${section}`);
    } else {
      const fm = `---\ntype: knowledge\ncategory: ${category}\ntitle: ${JSON.stringify(title)}\ncreated: ${nowIso}\nupdated: ${nowIso}\nsource: claude-code\n---\n\n# ${title}\n${section}`;
      writeFileSync(full, fm);
    }
    tryCommitVault(`knowledge: append ${category}/${title}`);
    return ok({ ok: true, path: relPath });
  },
);

server.tool(
  'vault_save_raw_source',
  'Save an unprocessed source (article, transcript, paste, etc.) into the vault\'s raw/ folder for later ingestion into the Knowledge wiki. Use this when Joseph hands you content he wants integrated — you save it here, then do a separate ingest pass that updates the relevant Knowledge pages.',
  {
    title: z.string().describe('Short descriptive title — becomes the filename.'),
    content: z.string().describe('The raw content. Paste verbatim; don\'t pre-summarise.'),
    sourceType: z
      .enum(['article', 'transcript', 'pdf-text', 'email', 'note', 'other'])
      .default('other'),
    sourceUrl: z.string().optional().describe('Original URL if applicable.'),
    tags: z.array(z.string()).default([]),
  },
  async ({ title, content, sourceType, sourceUrl, tags }) => {
    const date = new Date().toISOString().slice(0, 10);
    const slug =
      title
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^A-Za-z0-9 ]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .toLowerCase()
        .slice(0, 60) || 'untitled';
    const relPath = join('raw', `${date}-${slug}.md`);
    const full = vaultPath(relPath);
    ensureWritable(relPath);
    mkdirSync(dirname(full), { recursive: true });

    const fm = [
      '---',
      'type: raw-source',
      `source_type: ${sourceType}`,
      `captured: ${new Date().toISOString()}`,
      `title: ${JSON.stringify(title)}`,
    ];
    if (sourceUrl) fm.push(`source_url: ${JSON.stringify(sourceUrl)}`);
    if (tags.length) fm.push(`tags: [${tags.map((t) => JSON.stringify(t)).join(', ')}]`);
    fm.push('ingested: false');
    fm.push('source: claude-code');
    fm.push('---', '');

    writeFileSync(full, `${fm.join('\n')}# ${title}\n\n${content}\n`);
    tryCommitVault(`raw: ${title}`);
    return ok({
      ok: true,
      path: relPath,
      next:
        'Now run the ingest workflow: read this source, identify the 5–15 Knowledge pages it touches, use vault_append_knowledge or vault_write_knowledge to integrate the facts, then flip frontmatter ingested: true.',
    });
  },
);

server.tool(
  'vault_rebuild_index',
  'Scan the Knowledge/ folder and write Knowledge/Index.md — a flat catalog of every knowledge note with category and one-line summary parsed from the H1/first line. Call this after a batch of writes so future sessions can use the index as a navigation map instead of reading every file.',
  {},
  async () => {
    const knowledgeRoot = vaultPath('Knowledge');
    if (!existsSync(knowledgeRoot)) return err('Knowledge/ folder does not exist yet.');

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

    walk(knowledgeRoot, 'General');

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
      'Auto-generated catalogue of every note in `Knowledge/`. Refresh via `vault_rebuild_index`. Scan this first when you need to find what we already know about something.',
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

    const indexPath = vaultPath(join('Knowledge', 'Index.md'));
    writeFileSync(indexPath, lines.join('\n'));
    tryCommitVault(`index: rebuild (${entries.length} entries)`);
    return ok({ ok: true, entries: entries.length, path: 'Knowledge/Index.md' });
  },
);

function readFrontmatterValue(content: string, key: string): string | null {
  if (!content.startsWith('---')) return null;
  const end = content.indexOf('\n---', 3);
  const fm = end === -1 ? content : content.slice(0, end);
  const m = fm.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  return m ? m[1]!.trim() : null;
}

// Refresh `updated:` and ensure a `created:` exists in a note's frontmatter,
// preserving the original `created:` value. Used so appends re-stamp the note.
function bumpFrontmatterTimestamps(content: string, nowIso: string): string {
  if (!content.startsWith('---')) return content;
  const end = content.indexOf('\n---', 3);
  if (end === -1) return content;
  let fm = content.slice(0, end);
  const rest = content.slice(end);
  if (/^updated:.*$/m.test(fm)) {
    fm = fm.replace(/^updated:.*$/m, `updated: ${nowIso}`);
  } else {
    fm = `${fm}\nupdated: ${nowIso}`;
  }
  if (!/^created:.*$/m.test(fm)) {
    fm = /^updated:/m.test(fm)
      ? fm.replace(/^updated:/m, `created: ${nowIso}\nupdated:`)
      : `${fm}\ncreated: ${nowIso}`;
  }
  return fm + rest;
}

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

server.tool(
  'save_conversation_snapshot',
  'Save the current conversation to the vault as a session transcript. Use this at the end of a Claude Desktop chat when you want to preserve it as persistent context (Claude Desktop doesn\'t fire the SessionEnd hook the CLI does, so this is the manual equivalent). Provide a short title and the formatted conversation body — ideally with ## User / ## Claude headings, but free-form prose works too.',
  {
    title: z.string().describe('Short title for the conversation (becomes part of the filename and the H1)'),
    body: z.string().describe('Formatted markdown of the conversation as you (Claude) remember it. ## User / ## Claude headings preferred.'),
    contextHint: z
      .string()
      .optional()
      .describe('Optional one-word hint for the filename — e.g. project name or topic.'),
  },
  async ({ title, body, contextHint }) => {
    const date = new Date().toISOString().slice(0, 10);
    const time = new Date().toISOString().slice(11, 19);
    const slug =
      title
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^A-Za-z0-9 ]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .toLowerCase()
        .slice(0, 50) || 'untitled';
    const hintSlug = contextHint
      ? contextHint
          .normalize('NFKD')
          .replace(/[^A-Za-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .toLowerCase()
          .slice(0, 30)
      : 'desktop';
    const relPath = join('Daily', 'Claude-Sessions', `${date}-${hintSlug}-${slug}.md`);
    const full = vaultPath(relPath);
    ensureWritable(relPath);
    mkdirSync(dirname(full), { recursive: true });

    const fm = [
      '---',
      'type: claude-session',
      `date: ${date}`,
      `time: ${time}`,
      `title: ${JSON.stringify(title)}`,
      `context_hint: ${JSON.stringify(contextHint ?? '')}`,
      'source: claude-desktop',
      '---',
      '',
      `# ${title}`,
      '',
      body,
      '',
    ].join('\n');

    writeFileSync(full, fm);
    tryCommitVault(`session: ${title}`);
    return ok({ ok: true, path: relPath });
  },
);

server.tool(
  'vault_append_daily',
  'Append a note to today\'s Daily journal file. Creates Daily/{YYYY-MM-DD}.md if it doesn\'t exist. Use for time-stamped observations, micro-decisions, end-of-day summaries.',
  {
    heading: z.string().describe('Short heading for this entry (rendered as ##).'),
    body: z.string(),
  },
  async ({ heading, body }) => {
    const date = new Date().toISOString().slice(0, 10);
    const time = new Date().toISOString().slice(11, 16);
    const relPath = join('Daily', `${date}.md`);
    const full = vaultPath(relPath);
    ensureWritable(relPath);
    mkdirSync(dirname(full), { recursive: true });

    const nowIso = new Date().toISOString();
    const entry = `\n## ${heading} — ${time}\n\n${body}\n`;
    if (existsSync(full)) {
      const current = bumpFrontmatterTimestamps(readFileSync(full, 'utf-8'), nowIso);
      writeFileSync(full, `${current.trimEnd()}\n${entry}`);
    } else {
      writeFileSync(
        full,
        `---\ntype: daily\ndate: ${date}\ncreated: ${nowIso}\nupdated: ${nowIso}\nsource: claude-code\n---\n\n# ${date}\n${entry}`,
      );
    }
    tryCommitVault(`daily: ${date} ${heading}`);
    return ok({ ok: true, path: relPath });
  },
);

// ── start ────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
