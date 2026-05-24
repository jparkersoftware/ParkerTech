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
  tasks?: {
    id: string;
    title: string;
    done: boolean;
    dueDate?: string;
    priority?: string;
    notes?: string;
    featureRequestId?: string;
  }[];
  milestones?: {
    id: string;
    title: string;
    description?: string;
    targetDate?: string;
    status: string;
    checklist?: { id: string; text: string; done: boolean }[];
  }[];
  featureRequests?: {
    id: string;
    title: string;
    description?: string;
    status: string;
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

/**
 * Normalise legacy `delivered` to canonical `completed`. The web app does the
 * same on every read path; this keeps the MCP responses consistent.
 */
function normaliseStatus(raw: string | undefined): string {
  if (raw === 'delivered') return 'completed';
  return raw ?? '';
}

function projectSummary(d: ProjectDoc) {
  const tasks = d.tasks ?? [];
  const featureRequests = (d.featureRequests ?? []) as Array<{
    id: string;
    title: string;
    status: string;
  }>;
  return {
    id: d.id,
    title: d.title,
    clientId: d.clientId,
    clientName: d.clientName,
    status: normaliseStatus(d.status),
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
    featureRequests: featureRequests.map((fr) => ({
      id: fr.id,
      title: fr.title,
      status: fr.status,
      openTaskCount: tasks.filter(
        (t) => (t as { featureRequestId?: string }).featureRequestId === fr.id && !t.done,
      ).length,
    })),
  };
}

type InvoiceLineItemDoc = {
  id: string;
  description: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
};

function invoiceTotalFromDoc(data: FirebaseFirestore.DocumentData): number {
  const lineItems = (data.lineItems ?? []) as InvoiceLineItemDoc[];
  const subtotal = lineItems.reduce(
    (sum, li) => sum + (Number(li.quantity) || 0) * (Number(li.unitPrice) || 0),
    0,
  );
  const vat = subtotal * ((Number(data.vatRate) || 0) / 100);
  return subtotal + vat;
}

/**
 * Year-aware counter. INV-YYYY-NNN, resets on calendar year.
 */
async function nextInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const ref = db.collection('meta').doc('invoiceCounter');
  const next = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : undefined;
    const sameYear = data && (data.year as number | undefined) === year;
    const current = sameYear ? ((data!.next as number) || 1) : 1;
    tx.set(ref, { year, next: current + 1 }, { merge: true });
    return current;
  });
  return `INV-${year}-${String(next).padStart(3, '0')}`;
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
    const [projectsSnap, correspondenceSnap, quotesSnap, invoicesSnap] = await Promise.all([
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
      db
        .collection('invoices')
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
      invoices: invoicesSnap.docs.map((d) => ({
        id: d.id,
        number: d.data().number,
        status: d.data().status,
        issueDate: d.data().issueDate,
        dueDate: d.data().dueDate ?? '',
        total: invoiceTotalFromDoc(d.data()),
      })),
    });
  },
);

server.tool(
  'list_projects',
  'List every project with status, client, and open task count. Optional status filter. Note: legacy `delivered` rows are normalised to `completed` in the response.',
  {
    status: z
      .enum(['discovery', 'active', 'on-hold', 'completed', 'lost'])
      .optional()
      .describe('Filter to one status. Omit to get all. Use `completed` for archived projects.'),
  },
  async ({ status }) => {
    const snap = await db.collection('projects').orderBy('updatedAt', 'desc').get();
    const rows = snap.docs.map((d) => {
      const data = d.data();
      const tasks = (data.tasks ?? []) as { done: boolean }[];
      return {
        id: d.id,
        title: data.title,
        clientName: data.clientName,
        status: normaliseStatus(data.status),
        targetDate: data.targetDate ?? '',
        openTaskCount: tasks.filter((t) => !t.done).length,
      };
    });
    return ok(status ? rows.filter((r) => r.status === status) : rows);
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
  'create_project',
  'Create a new project under a client. Resolves the client by ID or name. Errors if a project with the same name already exists under that client (case-insensitive). Returns the new project ID.',
  {
    clientIdOrName: z.string(),
    name: z.string().min(1).describe('Project title.'),
    description: z.string().optional().describe('Short summary — stored as the project brief.'),
    status: z
      .enum(['discovery', 'active', 'on-hold', 'completed', 'lost'])
      .default('discovery'),
  },
  async ({ clientIdOrName, name, description, status }) => {
    const client = await findClientByNameOrId(clientIdOrName);
    if (!client) return err(`No client matched "${clientIdOrName}".`);
    const trimmed = name.trim();
    const lower = trimmed.toLowerCase();
    const existingSnap = await db
      .collection('projects')
      .where('clientId', '==', client.id)
      .get();
    const duplicate = existingSnap.docs.find(
      (d) => (d.data().title as string)?.toLowerCase() === lower,
    );
    if (duplicate) {
      return err(
        `A project named "${trimmed}" already exists under client "${client.name}" (id: ${duplicate.id}).`,
      );
    }
    const doc: Record<string, unknown> = {
      clientId: client.id,
      clientName: client.name,
      title: trimmed,
      status,
      brief: description ?? '',
      tasks: [],
      milestones: [],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    const ref = await db.collection('projects').add(doc);
    return ok({ ok: true, id: ref.id, name: trimmed, clientId: client.id });
  },
);

server.tool(
  'add_task',
  'Add a task to a project. Returns the new task ID. Auto-sync will pick the change up within 15s and the vault will update. Pass featureRequestId to link the task to a specific feature request on the project.',
  {
    projectIdOrName: z.string(),
    title: z.string().min(1),
    dueDate: z.string().optional().describe('ISO date YYYY-MM-DD'),
    priority: z.enum(['low', 'normal', 'high']).optional(),
    notes: z.string().optional(),
    featureRequestId: z
      .string()
      .optional()
      .describe('Optional — link this task to a feature request on the same project.'),
  },
  async ({ projectIdOrName, title, dueDate, priority, notes, featureRequestId }) => {
    const project = await findProjectByNameOrId(projectIdOrName);
    if (!project) return err(`No project matched "${projectIdOrName}".`);
    if (featureRequestId) {
      const exists = (project.featureRequests ?? []).some((fr) => fr.id === featureRequestId);
      if (!exists) {
        return err(
          `No feature request with id "${featureRequestId}" on project "${project.title}".`,
        );
      }
    }
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
    if (featureRequestId) newTask.featureRequestId = featureRequestId;
    const ref = db.collection('projects').doc(project.id);
    await ref.update({
      tasks: FieldValue.arrayUnion(newTask),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return ok({ ok: true, taskId: id, projectId: project.id, projectTitle: project.title });
  },
);

server.tool(
  'add_feature_request',
  'Add a feature request to a project. If the project status is currently `completed` (or legacy `delivered`), the project is auto-reopened to `active` and the response flags `reopened: true`. Default FR status is `proposed`.',
  {
    projectIdOrName: z.string(),
    title: z.string().min(1),
    description: z.string().optional(),
    status: z
      .enum(['proposed', 'planned', 'in-progress', 'done', 'rejected'])
      .default('proposed'),
  },
  async ({ projectIdOrName, title, description, status }) => {
    const project = await findProjectByNameOrId(projectIdOrName);
    if (!project) return err(`No project matched "${projectIdOrName}".`);
    const featureRequestId = randomUUID();
    const now = Timestamp.now();
    const fr: Record<string, unknown> = {
      id: featureRequestId,
      title: title.trim(),
      status,
      createdAt: now,
      updatedAt: now,
    };
    if (description) fr.description = description;

    const currentStatus = normaliseStatus(project.status);
    const reopened = currentStatus === 'completed';
    const patch: Record<string, unknown> = {
      featureRequests: FieldValue.arrayUnion(fr),
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (reopened) patch.status = 'active';

    await db.collection('projects').doc(project.id).update(patch);
    return ok({
      ok: true,
      featureRequestId,
      projectId: project.id,
      projectTitle: project.title,
      reopened,
    });
  },
);

server.tool(
  'update_feature_request',
  'Patch fields on an existing feature request (title, description, status). Reads the project, mutates the FR in place, writes back.',
  {
    projectId: z.string(),
    featureRequestId: z.string(),
    title: z.string().optional(),
    description: z.string().optional(),
    status: z
      .enum(['proposed', 'planned', 'in-progress', 'done', 'rejected'])
      .optional(),
  },
  async ({ projectId, featureRequestId, ...patch }) => {
    const ref = db.collection('projects').doc(projectId);
    const snap = await ref.get();
    if (!snap.exists) return err(`No project with id "${projectId}".`);
    const frs = (snap.data()?.featureRequests ?? []) as Record<string, unknown>[];
    const idx = frs.findIndex((fr) => fr.id === featureRequestId);
    if (idx < 0) {
      return err(`No feature request with id "${featureRequestId}" in this project.`);
    }
    const next = [...frs];
    const merged: Record<string, unknown> = { ...next[idx] };
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) merged[k] = v;
    }
    merged.updatedAt = Timestamp.now();
    next[idx] = merged;
    await ref.update({
      featureRequests: next,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return ok({ ok: true, projectId, featureRequestId });
  },
);

server.tool(
  'mark_project_completed',
  'Mark a project as completed (the archive action). Completed projects are hidden from the dashboard and the default Projects list view. Returns the project id and title.',
  {
    projectIdOrName: z.string(),
  },
  async ({ projectIdOrName }) => {
    const project = await findProjectByNameOrId(projectIdOrName);
    if (!project) return err(`No project matched "${projectIdOrName}".`);
    await db.collection('projects').doc(project.id).update({
      status: 'completed',
      updatedAt: FieldValue.serverTimestamp(),
    });
    return ok({ ok: true, projectId: project.id, projectTitle: project.title });
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

// ── INVOICE TOOLS ────────────────────────────────────────────────

server.tool(
  'add_invoice',
  'Create a draft invoice. Client and project are both optional. If `quoteId` is provided, the invoice is back-linked to that quote (use `invoice_from_quote` to actually clone line items). Returns the new invoice ID and number.',
  {
    clientIdOrName: z.string().optional(),
    projectIdOrName: z.string().optional(),
    quoteId: z.string().optional().describe('Optional back-link to a quote.'),
    lineItems: z
      .array(
        z.object({
          description: z.string(),
          quantity: z.number(),
          unitPrice: z.number(),
          unit: z.string().optional(),
        }),
      )
      .optional(),
    vatRate: z.number().default(0).describe('VAT percentage; default 0 (Joseph is not yet VAT-registered).'),
    issueDate: z.string().optional().describe('ISO YYYY-MM-DD; defaults to today.'),
    dueDate: z.string().optional().describe('ISO YYYY-MM-DD.'),
    introNote: z.string().optional(),
    termsNote: z.string().optional(),
  },
  async ({
    clientIdOrName,
    projectIdOrName,
    quoteId,
    lineItems,
    vatRate,
    issueDate,
    dueDate,
    introNote,
    termsNote,
  }) => {
    let clientId: string | undefined;
    let clientName: string | undefined;
    if (clientIdOrName) {
      const client = await findClientByNameOrId(clientIdOrName);
      if (!client) return err(`No client matched "${clientIdOrName}".`);
      clientId = client.id;
      clientName = client.name;
    }
    let projectId: string | undefined;
    let projectTitle: string | undefined;
    if (projectIdOrName) {
      const project = await findProjectByNameOrId(projectIdOrName);
      if (!project) return err(`No project matched "${projectIdOrName}".`);
      projectId = project.id;
      projectTitle = project.title;
    }
    const number = await nextInvoiceNumber();
    const items = (lineItems ?? []).map((li) => ({
      id: randomUUID(),
      description: li.description,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      ...(li.unit ? { unit: li.unit } : {}),
    }));
    const doc: Record<string, unknown> = {
      number,
      status: 'draft',
      issueDate: issueDate ?? new Date().toISOString().slice(0, 10),
      lineItems: items,
      vatRate: vatRate ?? 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (clientId) {
      doc.clientId = clientId;
      doc.clientName = clientName;
    }
    if (projectId) {
      doc.projectId = projectId;
      doc.projectTitle = projectTitle;
    }
    if (quoteId) doc.quoteId = quoteId;
    if (dueDate) doc.dueDate = dueDate;
    if (introNote) doc.introNote = introNote;
    if (termsNote) doc.termsNote = termsNote;

    const ref = await db.collection('invoices').add(doc);
    return ok({ ok: true, invoiceId: ref.id, number, clientId, projectId });
  },
);

server.tool(
  'update_invoice',
  'Patch fields on an existing invoice. Pass any of: lineItems, introNote, termsNote, issueDate, dueDate, vatRate, status. lineItems replaces the full array.',
  {
    invoiceId: z.string(),
    lineItems: z
      .array(
        z.object({
          id: z.string().optional(),
          description: z.string(),
          quantity: z.number(),
          unitPrice: z.number(),
          unit: z.string().optional(),
        }),
      )
      .optional(),
    introNote: z.string().optional(),
    termsNote: z.string().optional(),
    issueDate: z.string().optional(),
    dueDate: z.string().optional(),
    vatRate: z.number().optional(),
    status: z.enum(['draft', 'sent', 'paid', 'void']).optional(),
  },
  async ({ invoiceId, lineItems, ...rest }) => {
    const ref = db.collection('invoices').doc(invoiceId);
    const snap = await ref.get();
    if (!snap.exists) return err(`No invoice with id "${invoiceId}".`);
    const patch: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined) patch[k] = v;
    }
    if (lineItems) {
      patch.lineItems = lineItems.map((li) => ({
        id: li.id ?? randomUUID(),
        description: li.description,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        ...(li.unit ? { unit: li.unit } : {}),
      }));
    }
    await ref.update(patch);
    return ok({ ok: true, invoiceId });
  },
);

server.tool(
  'mark_invoice_sent',
  'Set an invoice status to `sent` and stamp `sentAt` with the server timestamp.',
  { invoiceId: z.string() },
  async ({ invoiceId }) => {
    const ref = db.collection('invoices').doc(invoiceId);
    const snap = await ref.get();
    if (!snap.exists) return err(`No invoice with id "${invoiceId}".`);
    await ref.update({
      status: 'sent',
      sentAt: Timestamp.now(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return ok({ ok: true, invoiceId });
  },
);

server.tool(
  'mark_invoice_paid',
  'Set an invoice status to `paid`, stamp `paidAt`, and record the paid amount + payment method. paidAmount defaults to the invoice total if omitted.',
  {
    invoiceId: z.string(),
    paidAmount: z.number().optional(),
    paymentMethod: z.string().optional(),
  },
  async ({ invoiceId, paidAmount, paymentMethod }) => {
    const ref = db.collection('invoices').doc(invoiceId);
    const snap = await ref.get();
    if (!snap.exists) return err(`No invoice with id "${invoiceId}".`);
    const data = snap.data()!;
    const amount = paidAmount ?? invoiceTotalFromDoc(data);
    const patch: Record<string, unknown> = {
      status: 'paid',
      paidAt: Timestamp.now(),
      paidAmount: amount,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (paymentMethod) patch.paymentMethod = paymentMethod;
    await ref.update(patch);
    return ok({ ok: true, invoiceId, paidAmount: amount });
  },
);

server.tool(
  'void_invoice',
  'Set an invoice status to `void`. Optional `reason` is appended to the existing termsNote so the audit trail is preserved on the document itself.',
  {
    invoiceId: z.string(),
    reason: z.string().optional(),
  },
  async ({ invoiceId, reason }) => {
    const ref = db.collection('invoices').doc(invoiceId);
    const snap = await ref.get();
    if (!snap.exists) return err(`No invoice with id "${invoiceId}".`);
    const patch: Record<string, unknown> = {
      status: 'void',
      voidedAt: Timestamp.now(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (reason) {
      const existing = (snap.data()?.termsNote as string | undefined) ?? '';
      const stamp = new Date().toISOString().slice(0, 10);
      const appended = existing
        ? `${existing}\n\n[voided ${stamp}] ${reason}`
        : `[voided ${stamp}] ${reason}`;
      patch.termsNote = appended;
    }
    await ref.update(patch);
    return ok({ ok: true, invoiceId });
  },
);

server.tool(
  'list_invoices',
  'List invoices with an optional status filter. Returns id, number, client, project, status, issue and due dates, and total.',
  {
    status: z.enum(['draft', 'sent', 'paid', 'void']).optional(),
  },
  async ({ status }) => {
    const snap = await db.collection('invoices').orderBy('issueDate', 'desc').get();
    const rows = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        number: data.number,
        clientName: data.clientName ?? '',
        projectTitle: data.projectTitle ?? '',
        status: data.status,
        issueDate: data.issueDate,
        dueDate: data.dueDate ?? '',
        total: invoiceTotalFromDoc(data),
      };
    });
    return ok(status ? rows.filter((r) => r.status === status) : rows);
  },
);

server.tool(
  'invoice_from_quote',
  'Clone a quote into a new draft invoice. Copies clientId, projectId, line items, vatRate, intro and terms notes. Stamps the new invoice with `quoteId` pointing back to the source quote. Returns the new invoice ID and number.',
  { quoteId: z.string() },
  async ({ quoteId }) => {
    const qref = db.collection('quotes').doc(quoteId);
    const qsnap = await qref.get();
    if (!qsnap.exists) return err(`No quote with id "${quoteId}".`);
    const q = qsnap.data()!;
    const number = await nextInvoiceNumber();
    const items = ((q.lineItems ?? []) as InvoiceLineItemDoc[]).map((li) => ({
      id: randomUUID(),
      description: li.description,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      ...(li.unit ? { unit: li.unit } : {}),
    }));
    const doc: Record<string, unknown> = {
      number,
      status: 'draft',
      issueDate: new Date().toISOString().slice(0, 10),
      lineItems: items,
      vatRate: q.vatRate ?? 0,
      quoteId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (q.clientId) {
      doc.clientId = q.clientId;
      doc.clientName = q.clientName;
    }
    if (q.projectId) {
      doc.projectId = q.projectId;
      doc.projectTitle = q.projectTitle;
    }
    if (q.introNote) doc.introNote = q.introNote;
    if (q.termsNote) doc.termsNote = q.termsNote;
    const ref = await db.collection('invoices').add(doc);
    return ok({ ok: true, invoiceId: ref.id, number });
  },
);

// ── EXPENSE TOOLS ────────────────────────────────────────────────
// Attachments (receipts/PDFs) are web-UI only — Claude has no way to upload
// binaries through MCP. These tools cover everything else: the create/edit/
// list/summary flow.

const EXPENSE_CATEGORY_ENUM = z.enum([
  'travel',
  'subscriptions',
  'equipment',
  'software',
  'office',
  'professional-services',
  'marketing',
  'other',
]);

server.tool(
  'add_expense',
  'Log a new expense. Attachments (receipts) can only be added later via the web UI — Claude has no way to upload binaries through MCP. Returns the new expense ID.',
  {
    date: z
      .string()
      .optional()
      .describe('ISO YYYY-MM-DD when the expense happened. Defaults to today.'),
    description: z.string().min(1),
    amount: z.number().describe('Gross GBP amount, e.g. 24.50.'),
    category: EXPENSE_CATEGORY_ENUM,
    vendor: z.string().optional().describe('e.g. "Trainline", "Anthropic".'),
    clientIdOrName: z.string().optional(),
    projectIdOrName: z.string().optional(),
    vatAmount: z
      .number()
      .optional()
      .describe('Optional VAT portion of the amount (for later reclaim).'),
    billable: z
      .boolean()
      .default(false)
      .describe('True if this expense should be rebilled to the client.'),
    notes: z.string().optional(),
  },
  async ({
    date,
    description,
    amount,
    category,
    vendor,
    clientIdOrName,
    projectIdOrName,
    vatAmount,
    billable,
    notes,
  }) => {
    let clientId: string | undefined;
    let clientName: string | undefined;
    if (clientIdOrName) {
      const client = await findClientByNameOrId(clientIdOrName);
      if (!client) return err(`No client matched "${clientIdOrName}".`);
      clientId = client.id;
      clientName = client.name;
    }
    let projectId: string | undefined;
    let projectTitle: string | undefined;
    if (projectIdOrName) {
      const project = await findProjectByNameOrId(projectIdOrName);
      if (!project) return err(`No project matched "${projectIdOrName}".`);
      projectId = project.id;
      projectTitle = project.title;
    }
    const doc: Record<string, unknown> = {
      date: date ?? new Date().toISOString().slice(0, 10),
      description: description.trim(),
      amount,
      category,
      billable: billable ?? false,
      attachments: [],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (vatAmount !== undefined) doc.vatAmount = vatAmount;
    if (vendor) doc.vendor = vendor;
    if (clientId) {
      doc.clientId = clientId;
      doc.clientName = clientName;
    }
    if (projectId) {
      doc.projectId = projectId;
      doc.projectTitle = projectTitle;
    }
    if (notes) doc.notes = notes;
    const ref = await db.collection('expenses').add(doc);
    return ok({ ok: true, expenseId: ref.id });
  },
);

server.tool(
  'update_expense',
  'Patch fields on an existing expense. Cannot touch the attachments array — receipts are managed through the web UI.',
  {
    expenseId: z.string(),
    date: z.string().optional(),
    description: z.string().optional(),
    amount: z.number().optional(),
    vatAmount: z.number().optional(),
    category: EXPENSE_CATEGORY_ENUM.optional(),
    vendor: z.string().optional(),
    clientIdOrName: z.string().optional(),
    projectIdOrName: z.string().optional(),
    billable: z.boolean().optional(),
    notes: z.string().optional(),
  },
  async ({
    expenseId,
    clientIdOrName,
    projectIdOrName,
    ...rest
  }) => {
    const ref = db.collection('expenses').doc(expenseId);
    const snap = await ref.get();
    if (!snap.exists) return err(`No expense with id "${expenseId}".`);
    const patch: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined) patch[k] = v;
    }
    if (clientIdOrName !== undefined) {
      if (clientIdOrName === '') {
        patch.clientId = FieldValue.delete();
        patch.clientName = FieldValue.delete();
      } else {
        const client = await findClientByNameOrId(clientIdOrName);
        if (!client) return err(`No client matched "${clientIdOrName}".`);
        patch.clientId = client.id;
        patch.clientName = client.name;
      }
    }
    if (projectIdOrName !== undefined) {
      if (projectIdOrName === '') {
        patch.projectId = FieldValue.delete();
        patch.projectTitle = FieldValue.delete();
      } else {
        const project = await findProjectByNameOrId(projectIdOrName);
        if (!project) return err(`No project matched "${projectIdOrName}".`);
        patch.projectId = project.id;
        patch.projectTitle = project.title;
      }
    }
    await ref.update(patch);
    return ok({ ok: true, expenseId });
  },
);

server.tool(
  'delete_expense',
  'Delete an expense document. WARNING: Storage cleanup is handled by the web UI — if this expense has uploaded attachments, the binaries in Firebase Storage will be orphaned. Use the web app to delete expenses that have attachments, OR run a manual Storage cleanup afterwards.',
  { expenseId: z.string() },
  async ({ expenseId }) => {
    const ref = db.collection('expenses').doc(expenseId);
    const snap = await ref.get();
    if (!snap.exists) return err(`No expense with id "${expenseId}".`);
    const attachmentCount = ((snap.data()?.attachments ?? []) as unknown[]).length;
    await ref.delete();
    const warning =
      attachmentCount > 0
        ? `Deleted Firestore doc but ${attachmentCount} attachment(s) remain in Firebase Storage and must be cleaned up manually (or delete via the web UI next time).`
        : undefined;
    return ok({ ok: true, expenseId, ...(warning ? { warning } : {}) });
  },
);

server.tool(
  'list_expenses',
  'List expenses with optional filters. Returns id, date, description, vendor, category, amount, vatAmount, client/project links, and attachment count.',
  {
    from: z.string().optional().describe('ISO YYYY-MM-DD lower bound (inclusive).'),
    to: z.string().optional().describe('ISO YYYY-MM-DD upper bound (inclusive).'),
    category: EXPENSE_CATEGORY_ENUM.optional(),
    clientIdOrName: z.string().optional(),
  },
  async ({ from, to, category, clientIdOrName }) => {
    let clientId: string | undefined;
    if (clientIdOrName) {
      const client = await findClientByNameOrId(clientIdOrName);
      if (!client) return err(`No client matched "${clientIdOrName}".`);
      clientId = client.id;
    }
    let q: FirebaseFirestore.Query = db.collection('expenses');
    if (clientId) q = q.where('clientId', '==', clientId);
    if (category) q = q.where('category', '==', category);
    const snap = await q.orderBy('date', 'desc').get();
    const rows = snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          date: data.date as string,
          description: data.description ?? '',
          vendor: data.vendor ?? '',
          category: data.category ?? 'other',
          amount: Number(data.amount) || 0,
          vatAmount:
            data.vatAmount === undefined ? null : Number(data.vatAmount),
          clientId: data.clientId ?? '',
          clientName: data.clientName ?? '',
          projectId: data.projectId ?? '',
          projectTitle: data.projectTitle ?? '',
          billable: Boolean(data.billable),
          attachmentCount: ((data.attachments ?? []) as unknown[]).length,
        };
      })
      .filter((r) => (from ? r.date >= from : true))
      .filter((r) => (to ? r.date <= to : true));
    return ok(rows);
  },
);

server.tool(
  'expense_summary',
  'Totals by category over a date range. Useful for "what did I spend last month". Both `from` and `to` are required ISO YYYY-MM-DD bounds (inclusive).',
  {
    from: z.string().describe('ISO YYYY-MM-DD lower bound (inclusive).'),
    to: z.string().describe('ISO YYYY-MM-DD upper bound (inclusive).'),
  },
  async ({ from, to }) => {
    const snap = await db.collection('expenses').get();
    const inRange = snap.docs
      .map((d) => d.data())
      .filter((d) => {
        const date = (d.date as string) ?? '';
        return date >= from && date <= to;
      });
    let totalAmount = 0;
    let totalVat = 0;
    const byCategory: Record<string, { count: number; total: number }> = {};
    for (const cat of [
      'travel',
      'subscriptions',
      'equipment',
      'software',
      'office',
      'professional-services',
      'marketing',
      'other',
    ]) {
      byCategory[cat] = { count: 0, total: 0 };
    }
    for (const d of inRange) {
      const amount = Number(d.amount) || 0;
      const vat = Number(d.vatAmount) || 0;
      totalAmount += amount;
      totalVat += vat;
      const cat = (typeof d.category === 'string' ? d.category : 'other') as string;
      const bucket = byCategory[cat] ?? byCategory.other!;
      bucket.count += 1;
      bucket.total += amount;
    }
    return ok({
      from,
      to,
      count: inRange.length,
      totalAmount,
      totalVat,
      byCategory,
    });
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
