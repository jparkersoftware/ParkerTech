import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  deleteObject,
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from 'firebase/storage';
import { db, storage } from './firebase';
import type {
  InboxItem,
  InboxItemAttachment,
  InboxItemMention,
} from './types';

const COL = 'inbox';
const KNOWLEDGE_DRAFT_COL = 'knowledgeDrafts';

export function watchInbox(cb: (items: InboxItem[]) => void): Unsubscribe {
  const q = query(collection(db, COL), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<InboxItem, 'id'>) })));
  });
}

export async function createInboxItem(input: {
  text: string;
  tags: string[];
  mentions?: InboxItemMention[];
  pinned?: boolean;
  snoozedUntil?: string;
}): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    text: input.text.trim(),
    tags: cleanTags(input.tags),
    archived: false,
    ...stripUndefined({
      mentions: input.mentions && input.mentions.length > 0 ? input.mentions : undefined,
      pinned: input.pinned ? true : undefined,
      snoozedUntil: input.snoozedUntil,
    }),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateInboxItem(
  id: string,
  patch: {
    text?: string;
    tags?: string[];
    mentions?: InboxItemMention[];
  },
): Promise<void> {
  const next: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (patch.text !== undefined) next.text = patch.text.trim();
  if (patch.tags !== undefined) next.tags = cleanTags(patch.tags);
  if (patch.mentions !== undefined) next.mentions = patch.mentions;
  await updateDoc(doc(db, COL, id), next);
}

export async function archiveInboxItem(id: string, note?: string): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    archived: true,
    archivedNote: note?.trim() ?? '',
    archivedAt: Timestamp.now(),
    updatedAt: serverTimestamp(),
  });
}

export async function unarchiveInboxItem(id: string): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    archived: false,
    archivedNote: '',
    archivedAt: null,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteInboxItem(id: string): Promise<void> {
  // Best-effort cleanup of any attached Storage objects so we don't leave
  // orphan files behind. Mirrors deleteExpense.
  try {
    const snap = await getDoc(doc(db, COL, id));
    if (snap.exists()) {
      const data = snap.data() as Omit<InboxItem, 'id'>;
      const attachments = (data.attachments ?? []) as InboxItemAttachment[];
      await Promise.all(
        attachments.map(async (att) => {
          try {
            await deleteObject(storageRef(storage, att.storagePath));
          } catch {
            // Already gone or permission issue — non-fatal.
          }
        }),
      );
    }
  } catch {
    // If read fails for any reason, still delete the doc below.
  }
  await deleteDoc(doc(db, COL, id));
}

// ── Pin / snooze ─────────────────────────────────────────────────

export async function setInboxItemPinned(
  id: string,
  pinned: boolean,
): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    pinned: pinned ? true : false,
    updatedAt: serverTimestamp(),
  });
}

/** Pass undefined / null to clear the snooze. */
export async function setInboxItemSnooze(
  id: string,
  snoozedUntil: string | null,
): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    snoozedUntil: snoozedUntil ?? null,
    updatedAt: serverTimestamp(),
  });
}

/**
 * True if the snooze date is today or in the future — i.e. the item should
 * be hidden from the main list. Compares ISO date strings lexicographically,
 * which is safe for YYYY-MM-DD.
 */
export function isSnoozedActive(item: InboxItem, today: string = isoToday()): boolean {
  if (!item.snoozedUntil) return false;
  return item.snoozedUntil > today;
}

export function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Tags ─────────────────────────────────────────────────────────

function cleanTags(tags: string[]): string[] {
  return Array.from(
    new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean)),
  );
}

export function parseTagString(s: string): string[] {
  return s
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * Collect every distinct tag used across the inbox, sorted by descending
 * frequency then alphabetical. Feeds the #tag autocomplete suggestions.
 */
export function collectInboxTags(items: InboxItem[]): string[] {
  const freq = new Map<string, number>();
  for (const it of items) {
    for (const t of it.tags ?? []) {
      freq.set(t, (freq.get(t) ?? 0) + 1);
    }
  }
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([t]) => t);
}

// ── Attachments ──────────────────────────────────────────────────

/**
 * Upload one file as a new InboxItemAttachment.
 *
 * Path pattern: `inbox/{itemId}/{uuid}.{ext}`. Mirrors expenses' approach:
 * the original filename is preserved on the attachment metadata; the
 * storage object uses a UUID filename to avoid collisions and sanitisation.
 */
export async function uploadInboxAttachment(
  itemId: string,
  file: File,
): Promise<InboxItemAttachment> {
  const id = crypto.randomUUID();
  const ext = extensionFor(file);
  const path = `inbox/${itemId}/${id}${ext ? `.${ext}` : ''}`;

  const ref = storageRef(storage, path);
  await uploadBytes(ref, file, { contentType: file.type || undefined });
  const downloadUrl = await getDownloadURL(ref);

  const attachment: InboxItemAttachment = {
    id,
    storagePath: path,
    downloadUrl,
    fileName: file.name,
    contentType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
    uploadedAt: Timestamp.now(),
  };

  // Read-modify-write — mirrors deleteInboxAttachment for symmetry, and
  // dodges the Timestamp-equality issue arrayUnion has with object args.
  const itemRef = doc(db, COL, itemId);
  const snap = await getDoc(itemRef);
  const current = snap.exists()
    ? ((snap.data() as Omit<InboxItem, 'id'>).attachments ?? [])
    : [];
  await updateDoc(itemRef, {
    attachments: [...current, attachment],
    updatedAt: serverTimestamp(),
  });

  return attachment;
}

export async function deleteInboxAttachment(
  itemId: string,
  attachmentId: string,
): Promise<void> {
  const itemRef = doc(db, COL, itemId);
  const snap = await getDoc(itemRef);
  if (!snap.exists()) return;
  const data = snap.data() as Omit<InboxItem, 'id'>;
  const attachments = (data.attachments ?? []) as InboxItemAttachment[];
  const target = attachments.find((a) => a.id === attachmentId);
  if (target) {
    try {
      await deleteObject(storageRef(storage, target.storagePath));
    } catch {
      // Already gone in Storage — still update Firestore.
    }
  }
  await updateDoc(itemRef, {
    attachments: attachments.filter((a) => a.id !== attachmentId),
    updatedAt: serverTimestamp(),
  });
}

function extensionFor(file: File): string {
  const fromName = file.name.includes('.')
    ? file.name.split('.').pop()!.toLowerCase().replace(/[^a-z0-9]/g, '')
    : '';
  if (fromName) return fromName;
  const mime = (file.type || '').toLowerCase();
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/heic') return 'heic';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'application/pdf') return 'pdf';
  return '';
}

// ── Knowledge drafts (Convert → Knowledge fallback) ─────────────

/**
 * The web app can't write to the Obsidian vault directly — that's a
 * filesystem operation done by the MCP server (vault_write_knowledge).
 * To keep the Convert flow useful from the web, we stash the prepared
 * note in Firestore as a "knowledgeDraft" doc. A follow-up MCP pass picks
 * it up and writes the actual vault file. The original inbox item still
 * gets auto-archived with a "→ Converted to Knowledge: …" note.
 */
export type KnowledgeDraftCategory =
  | 'Patterns'
  | 'Decisions'
  | 'Context'
  | 'Mistakes'
  | 'Systems'
  | 'People'
  | 'General';

export async function createKnowledgeDraft(input: {
  category: KnowledgeDraftCategory;
  title: string;
  body: string;
  tags: string[];
  /** Provenance — id of the inbox item that spawned this draft. */
  sourceInboxItemId?: string;
}): Promise<string> {
  const ref = await addDoc(collection(db, KNOWLEDGE_DRAFT_COL), {
    category: input.category,
    title: input.title.trim(),
    body: input.body,
    tags: cleanTags(input.tags),
    status: 'pending' as const,
    ...stripUndefined({ sourceInboxItemId: input.sourceInboxItemId }),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

// ── helpers ─────────────────────────────────────────────────────

function stripUndefined<T extends object>(obj: T): T {
  const out = {} as T;
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== '') (out as Record<string, unknown>)[k] = v;
  }
  return out;
}
