import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import type { InboxItem } from './types';

const COL = 'inbox';

export function watchInbox(cb: (items: InboxItem[]) => void): Unsubscribe {
  const q = query(collection(db, COL), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<InboxItem, 'id'>) })));
  });
}

export async function createInboxItem(input: {
  text: string;
  tags: string[];
}): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    text: input.text.trim(),
    tags: cleanTags(input.tags),
    archived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateInboxItem(
  id: string,
  patch: { text?: string; tags?: string[] },
): Promise<void> {
  const next: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (patch.text !== undefined) next.text = patch.text.trim();
  if (patch.tags !== undefined) next.tags = cleanTags(patch.tags);
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
  await deleteDoc(doc(db, COL, id));
}

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
