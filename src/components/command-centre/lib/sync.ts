import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from './firebase';
import { upsertFile, type GithubConfig } from './github';
import { recordSyncResult } from './settings';
import {
  clientFile,
  contactFile,
  correspondenceFile,
  inboxFile,
  invoiceFile,
  projectFile,
  quoteFile,
  type VaultFile,
} from './vaultMarkdown';
import type {
  Client,
  Correspondence,
  InboxItem,
  Invoice,
  Project,
  Quote,
} from './types';

export type SyncProgress = {
  phase: 'reading' | 'writing' | 'done';
  written: number;
  total: number;
  current?: string;
};

export async function syncAllToVault(
  cfg: GithubConfig,
  onProgress?: (p: SyncProgress) => void,
): Promise<{ written: number }> {
  try {
    onProgress?.({ phase: 'reading', written: 0, total: 0 });

    const [clients, projects, correspondence, quotes, invoices, inbox] = await Promise.all([
      readAll<Client>('clients', 'name'),
      readAll<Project>('projects', 'updatedAt', 'desc'),
      readAll<Correspondence>('correspondence', 'date', 'desc'),
      readAll<Quote>('quotes', 'issueDate', 'desc'),
      readAll<Invoice>('invoices', 'issueDate', 'desc'),
      readAll<InboxItem>('inbox', 'createdAt', 'desc'),
    ]);

    const files = generateFiles(clients, projects, correspondence, quotes, invoices, inbox);

    let written = 0;
    onProgress?.({ phase: 'writing', written, total: files.length });

    for (const file of files) {
      onProgress?.({
        phase: 'writing',
        written,
        total: files.length,
        current: file.path,
      });
      await upsertFile(cfg, file.path, file.content, `cc sync: ${file.message}`);
      written += 1;
    }

    onProgress?.({ phase: 'done', written, total: files.length });
    await recordSyncResult('ok', { count: written });
    return { written };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await recordSyncResult('error', { error: message });
    throw err;
  }
}

function generateFiles(
  clients: Client[],
  projects: Project[],
  correspondence: Correspondence[],
  quotes: Quote[],
  invoices: Invoice[],
  inbox: InboxItem[],
): VaultFile[] {
  const files: VaultFile[] = [];

  // Build a per-contact "last contacted" map from correspondence.
  const lastContactByContactId = new Map<string, string>();
  for (const c of correspondence) {
    for (const id of c.contactIds ?? []) {
      const existing = lastContactByContactId.get(id);
      if (!existing || c.date > existing) lastContactByContactId.set(id, c.date);
    }
  }

  const clientById = new Map(clients.map((c) => [c.id, c]));

  for (const client of clients) {
    files.push(clientFile(client, projects, quotes, invoices, correspondence));
    for (const contact of client.contacts ?? []) {
      files.push(
        contactFile(
          contact,
          client,
          lastContactByContactId.get(contact.id) ?? null,
        ),
      );
    }
  }
  for (const project of projects) {
    files.push(projectFile(project, correspondence, quotes, invoices));
  }
  for (const entry of correspondence) {
    const client = clientById.get(entry.clientId);
    if (!client) continue;
    files.push(correspondenceFile(entry, client));
  }
  for (const quote of quotes) {
    files.push(quoteFile(quote));
  }
  for (const invoice of invoices) {
    files.push(invoiceFile(invoice));
  }
  for (const item of inbox) {
    files.push(inboxFile(item));
  }

  return files;
}

async function readAll<T>(
  col: string,
  orderField: string,
  direction: 'asc' | 'desc' = 'asc',
): Promise<T[]> {
  const snap = await getDocs(query(collection(db, col), orderBy(orderField, direction)));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as T);
}
