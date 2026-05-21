/**
 * ParkerTech Command Centre — MCP server.
 *
 * Exposes a small surface of Firestore-backed tools to Claude Code so it can
 * read Command Centre data and make structured changes (add tasks, log
 * correspondence, etc.) without needing to touch markdown files in the vault.
 *
 * Auth: Application Default Credentials. Run once on this machine:
 *   gcloud auth application-default login
 *   gcloud config set project parkertechfire
 *
 * Wire-up: add this to your Claude Code MCP config (see README).
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import {
  FieldValue,
  Timestamp,
  getFirestore,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase-admin/firestore';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { execSync } from 'node:child_process';

const VAULT_ROOT = join(homedir(), 'Documents', 'Obsidian', 'ParkerTechFire');

initializeApp({
  credential: applicationDefault(),
  projectId: 'parkertechfire',
});
const db = getFirestore();

const server = new McpServer({
  name: 'parkertech-cc',
  version: '0.1.0',
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

function tsToIso(ts: unknown): string | undefined {
  if (ts instanceof Timestamp) return ts.toDate().toISOString();
  return undefined;
}

type ClientDoc = {
  id: string;
  name: string;
  notes?: string;
  contacts?: { id: string; name: string; role?: string; email?: string; phone?: string; notes?: string }[];
  updatedAt?: Timestamp;
};

type ProjectDoc = {
  id: string;
  title: string;
  clientId: string;
  clientName: string;
  status: string;
  brief?: string;
  startDate?: string;
  targetDate?: string;
  tasks?: { id: string; title: string; done: boolean; dueDate?: string; priority?: string; notes?: string }[];
  milestones?: {
    id: string;
    title: string;
    description?: string;
    targetDate?: string;
    status: string;
    checklist?: { id: string; text: string; done: boolean }[];
  }[];
};

async function findClientByNameOrId(needle: string): Promise<ClientDoc | null> {
  const byId = await db.collection('clients').doc(needle).get();
  if (byId.exists) return { id: byId.id, ...(byId.data() as Omit<ClientDoc, 'id'>) };
  const snap = await db.collection('clients').get();
  const lower = needle.toLowerCase();
  const exact = snap.docs.find((d) => (d.data().name as string)?.toLowerCase() === lower);
  if (exact) return { id: exact.id, ...(exact.data() as Omit<ClientDoc, 'id'>) };
  const partial = snap.docs.find((d) => (d.data().name as string)?.toLowerCase().includes(lower));
  if (partial) return { id: partial.id, ...(partial.data() as Omit<ClientDoc, 'id'>) };
  return null;
}

async function findProjectByNameOrId(needle: string): Promise<ProjectDoc | null> {
  const byId = await db.collection('projects').doc(needle).get();
  if (byId.exists) return { id: byId.id, ...(byId.data() as Omit<ProjectDoc, 'id'>) };
  const snap = await db.collection('projects').get();
  const lower = needle.toLowerCase();
  const exact = snap.docs.find((d) => (d.data().title as string)?.toLowerCase() === lower);
  if (exact) return { id: exact.id, ...(exact.data() as Omit<ProjectDoc, 'id'>) };
  const partial = snap.docs.find((d) => (d.data().title as string)?.toLowerCase().includes(lower));
  if (partial) return { id: partial.id, ...(partial.data() as Omit<ProjectDoc, 'id'>) };
  return null;
}

function clientSummary(d: ClientDoc) {
  return {
    id: d.id,
    name: d.name,
    notes: d.notes ?? '',
    contacts: (d.contacts ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      role: c.role ?? '',
      email: c.email ?? '',
      phone: c.phone ?? '',
    })),
  };
}

function projectSummary(d: ProjectDoc) {
  const tasks = d.tasks ?? [];
  return {
    id: d.id,
    title: d.title,
    clientId: d.clientId,
    clientName: d.clientName,
    status: d.status,
    brief: d.brief ?? '',
    startDate: d.startDate ?? '',
    targetDate: d.targetDate ?? '',
    openTaskCount: tasks.filter((t) => !t.done).length,
    doneTaskCount: tasks.filter((t) => t.done).length,
    tasks,
    milestones: (d.milestones ?? []).map((m) => ({
      ...m,
      progress:
        m.checklist && m.checklist.length > 0
          ? `${m.checklist.filter((c) => c.done).length}/${m.checklist.length}`
          : 'no checklist',
    })),
  };
}

// ── READ TOOLS ───────────────────────────────────────────────────

server.tool(
  'list_clients',
  'List every client (school) with name, ID, and contact count. Use this to discover what clients exist before deeper queries.',
  {},
  async () => {
    const snap = await db.collection('clients').orderBy('name').get();
    const rows = snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => ({
      id: d.id,
      name: d.data().name,
      contactCount: (d.data().contacts ?? []).length,
    }));
    return ok(rows);
  },
);

server.tool(
  'get_client',
  'Fetch a single client by ID or name (case-insensitive, partial matches allowed). Returns the client details plus all their projects, recent correspondence and quotes.',
  { idOrName: z.string().describe('Client ID (Firestore doc ID) or name (full or partial)') },
  async ({ idOrName }) => {
    const client = await findClientByNameOrId(idOrName);
    if (!client) return err(`No client matched "${idOrName}".`);
    const [projectsSnap, correspondenceSnap, quotesSnap] = await Promise.all([
      db.collection('projects').where('clientId', '==', client.id).get(),
      db
        .collection('correspondence')
        .where('clientId', '==', client.id)
        .orderBy('date', 'desc')
        .limit(10)
        .get(),
      db
        .collection('quotes')
        .where('clientId', '==', client.id)
        .orderBy('issueDate', 'desc')
        .limit(10)
        .get(),
    ]);
    return ok({
      client: clientSummary(client),
      projects: projectsSnap.docs.map((d) => ({
        id: d.id,
        title: d.data().title,
        status: d.data().status,
        targetDate: d.data().targetDate ?? '',
      })),
      recentCorrespondence: correspondenceSnap.docs.map((d) => ({
        id: d.id,
        date: d.data().date,
        type: d.data().type,
        title: d.data().title,
        summary: d.data().body ?? '',
      })),
      quotes: quotesSnap.docs.map((d) => ({
        id: d.id,
        number: d.data().number,
        status: d.data().status,
        issueDate: d.data().issueDate,
      })),
    });
  },
);

server.tool(
  'list_projects',
  'List every project with status, client, and open task count. Optional status filter.',
  {
    status: z
      .enum(['discovery', 'active', 'on-hold', 'delivered', 'lost'])
      .optional()
      .describe('Filter to one status. Omit to get all.'),
  },
  async ({ status }) => {
    let q: FirebaseFirestore.Query = db.collection('projects');
    if (status) q = q.where('status', '==', status);
    const snap = await q.orderBy('updatedAt', 'desc').get();
    return ok(
      snap.docs.map((d) => {
        const data = d.data();
        const tasks = (data.tasks ?? []) as { done: boolean }[];
        return {
          id: d.id,
          title: data.title,
          clientName: data.clientName,
          status: data.status,
          targetDate: data.targetDate ?? '',
          openTaskCount: tasks.filter((t) => !t.done).length,
        };
      }),
    );
  },
);

server.tool(
  'get_project',
  'Fetch a single project by ID or name. Returns title, client, status, brief, all tasks and milestones, plus the project\'s recent correspondence.',
  { idOrName: z.string().describe('Project ID or title (full or partial)') },
  async ({ idOrName }) => {
    const project = await findProjectByNameOrId(idOrName);
    if (!project) return err(`No project matched "${idOrName}".`);
    const corrSnap = await db
      .collection('correspondence')
      .where('projectId', '==', project.id)
      .orderBy('date', 'desc')
      .limit(10)
      .get();
    return ok({
      project: projectSummary(project),
      recentCorrespondence: corrSnap.docs.map((d) => ({
        id: d.id,
        date: d.data().date,
        type: d.data().type,
        title: d.data().title,
        summary: d.data().body ?? '',
      })),
    });
  },
);

server.tool(
  'recent_correspondence',
  'Fetch recent correspondence entries — meetings, calls, emails, notes. Optionally filter by client and/or project. Include full verbatim transcripts when requested.',
  {
    clientIdOrName: z.string().optional(),
    projectIdOrName: z.string().optional(),
    limit: z.number().int().min(1).max(50).default(10),
    includeTranscripts: z
      .boolean()
      .default(false)
      .describe('Include the verbatim transcript field. Off by default to keep responses small.'),
  },
  async ({ clientIdOrName, projectIdOrName, limit, includeTranscripts }) => {
    let q: FirebaseFirestore.Query = db.collection('correspondence');
    if (clientIdOrName) {
      const client = await findClientByNameOrId(clientIdOrName);
      if (!client) return err(`No client matched "${clientIdOrName}".`);
      q = q.where('clientId', '==', client.id);
    }
    if (projectIdOrName) {
      const project = await findProjectByNameOrId(projectIdOrName);
      if (!project) return err(`No project matched "${projectIdOrName}".`);
      q = q.where('projectId', '==', project.id);
    }
    const snap = await q.orderBy('date', 'desc').limit(limit).get();
    return ok(
      snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          date: data.date,
          type: data.type,
          title: data.title,
          clientName: data.clientName,
          projectTitle: data.projectTitle ?? '',
          summary: data.body ?? '',
          ...(includeTranscripts && data.transcript ? { transcript: data.transcript } : {}),
        };
      }),
    );
  },
);

// ── WRITE TOOLS ──────────────────────────────────────────────────

server.tool(
  'add_task',
  'Add a task to a project. Returns the new task ID. Auto-sync will pick the change up within 15s and the vault will update.',
  {
    projectIdOrName: z.string(),
    title: z.string().min(1),
    dueDate: z.string().optional().describe('ISO date YYYY-MM-DD'),
    priority: z.enum(['low', 'normal', 'high']).optional(),
    notes: z.string().optional(),
  },
  async ({ projectIdOrName, title, dueDate, priority, notes }) => {
    const project = await findProjectByNameOrId(projectIdOrName);
    if (!project) return err(`No project matched "${projectIdOrName}".`);
    const id = randomUUID();
    const newTask: Record<string, unknown> = {
      id,
      title: title.trim(),
      done: false,
      createdAt: Timestamp.now(),
    };
    if (dueDate) newTask.dueDate = dueDate;
    if (priority) newTask.priority = priority;
    if (notes) newTask.notes = notes;
    const ref = db.collection('projects').doc(project.id);
    await ref.update({
      tasks: FieldValue.arrayUnion(newTask),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return ok({ ok: true, taskId: id, projectId: project.id, projectTitle: project.title });
  },
);

server.tool(
  'update_task',
  'Update fields of an existing task. Use done:true to mark complete, done:false to reopen.',
  {
    projectId: z.string(),
    taskId: z.string(),
    done: z.boolean().optional(),
    dueDate: z.string().optional(),
    priority: z.enum(['low', 'normal', 'high']).optional(),
    notes: z.string().optional(),
    title: z.string().optional(),
  },
  async ({ projectId, taskId, ...patch }) => {
    const ref = db.collection('projects').doc(projectId);
    const snap = await ref.get();
    if (!snap.exists) return err(`No project with id "${projectId}".`);
    const tasks = (snap.data()?.tasks ?? []) as Record<string, unknown>[];
    const idx = tasks.findIndex((t) => t.id === taskId);
    if (idx < 0) return err(`No task with id "${taskId}" in this project.`);
    const next = [...tasks];
    const merged: Record<string, unknown> = { ...next[idx] };
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) merged[k] = v;
    }
    if (patch.done === true && !tasks[idx]!.done) merged.completedAt = Timestamp.now();
    if (patch.done === false) delete merged.completedAt;
    next[idx] = merged;
    await ref.update({ tasks: next, updatedAt: FieldValue.serverTimestamp() });
    return ok({ ok: true });
  },
);

server.tool(
  'add_correspondence',
  'Log a meeting, call, email or note. Required: client, type, title, date. Optional: link to a project, contact IDs to tag, short summary body, and full verbatim transcript.',
  {
    clientIdOrName: z.string(),
    projectIdOrName: z.string().optional(),
    type: z.enum(['meeting', 'call', 'email', 'note']),
    date: z.string().describe('ISO date YYYY-MM-DD when the interaction happened'),
    title: z.string().min(1),
    body: z.string().default('').describe('Short human-readable digest. What was decided / next steps.'),
    transcript: z.string().optional().describe('Verbatim raw text — full transcript, email thread, etc. Optional.'),
    contactIds: z.array(z.string()).default([]),
  },
  async ({ clientIdOrName, projectIdOrName, type, date, title, body, transcript, contactIds }) => {
    const client = await findClientByNameOrId(clientIdOrName);
    if (!client) return err(`No client matched "${clientIdOrName}".`);
    let projectId: string | undefined;
    let projectTitle: string | undefined;
    if (projectIdOrName) {
      const project = await findProjectByNameOrId(projectIdOrName);
      if (!project) return err(`No project matched "${projectIdOrName}".`);
      projectId = project.id;
      projectTitle = project.title;
    }
    const doc: Record<string, unknown> = {
      clientId: client.id,
      clientName: client.name,
      type,
      date,
      title: title.trim(),
      body,
      contactIds,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (projectId) {
      doc.projectId = projectId;
      doc.projectTitle = projectTitle;
    }
    if (transcript) doc.transcript = transcript;
    const ref = await db.collection('correspondence').add(doc);
    return ok({ ok: true, id: ref.id });
  },
);

server.tool(
  'add_inbox_item',
  'Quick-capture a stray thought, idea, or observation to Joseph\'s inbox. Use this when something needs to be remembered but isn\'t yet a structured task or project.',
  {
    text: z.string().min(1),
    tags: z.array(z.string()).default([]),
  },
  async ({ text, tags }) => {
    const cleanTags = Array.from(
      new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean)),
    );
    const ref = await db.collection('inbox').add({
      text: text.trim(),
      tags: cleanTags,
      archived: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return ok({ ok: true, id: ref.id });
  },
);

server.tool(
  'toggle_checklist_item',
  'Tick or untick a checklist item on a project milestone.',
  {
    projectIdOrName: z.string(),
    milestoneId: z.string(),
    itemId: z.string(),
  },
  async ({ projectIdOrName, milestoneId, itemId }) => {
    const project = await findProjectByNameOrId(projectIdOrName);
    if (!project) return err(`No project matched "${projectIdOrName}".`);
    const ref = db.collection('projects').doc(project.id);
    const snap = await ref.get();
    const milestones = (snap.data()?.milestones ?? []) as {
      id: string;
      checklist?: { id: string; text: string; done: boolean }[];
    }[];
    const next = milestones.map((m) => {
      if (m.id !== milestoneId) return m;
      return {
        ...m,
        checklist: (m.checklist ?? []).map((c) =>
          c.id === itemId ? { ...c, done: !c.done } : c,
        ),
      };
    });
    await ref.update({ milestones: next, updatedAt: FieldValue.serverTimestamp() });
    return ok({ ok: true });
  },
);

// ── VAULT TOOLS ──────────────────────────────────────────────────
// Direct read/write access to the Obsidian vault so Claude can record
// knowledge and read past sessions even when launched from outside the
// vault folder (e.g. while coding in another repo).

const VAULT_WRITABLE_PREFIXES = ['Knowledge/', 'Daily/', 'Inbox/'];

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

    const fm: string[] = ['---'];
    fm.push(`type: knowledge`);
    fm.push(`category: ${category}`);
    fm.push(`title: ${JSON.stringify(title)}`);
    fm.push(`updated: ${new Date().toISOString()}`);
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

    const date = new Date().toISOString().slice(0, 10);
    const section = `\n## ${sectionHeading} — ${date}\n\n${body}\n`;

    if (existsSync(full)) {
      const current = readFileSync(full, 'utf-8');
      writeFileSync(full, `${current.trimEnd()}\n${section}`);
    } else {
      const fm = `---\ntype: knowledge\ncategory: ${category}\ntitle: ${JSON.stringify(title)}\nupdated: ${new Date().toISOString()}\nsource: claude-code\n---\n\n# ${title}\n${section}`;
      writeFileSync(full, fm);
    }
    tryCommitVault(`knowledge: append ${category}/${title}`);
    return ok({ ok: true, path: relPath });
  },
);

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

    const entry = `\n## ${heading} — ${time}\n\n${body}\n`;
    if (existsSync(full)) {
      writeFileSync(full, `${readFileSync(full, 'utf-8').trimEnd()}\n${entry}`);
    } else {
      writeFileSync(
        full,
        `---\ntype: daily\ndate: ${date}\nsource: claude-code\n---\n\n# ${date}\n${entry}`,
      );
    }
    tryCommitVault(`daily: ${date} ${heading}`);
    return ok({ ok: true, path: relPath });
  },
);

// ── start ────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
