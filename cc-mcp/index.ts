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

// ── start ────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
