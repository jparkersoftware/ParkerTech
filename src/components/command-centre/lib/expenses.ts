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
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  deleteObject,
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from 'firebase/storage';
import { db, storage } from './firebase';
import {
  EXPENSE_CATEGORIES,
  type Expense,
  type ExpenseAttachment,
  type ExpenseCategory,
} from './types';

const COL = 'expenses';

export function watchExpenses(cb: (expenses: Expense[]) => void): Unsubscribe {
  const q = query(collection(db, COL), orderBy('date', 'desc'));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Expense, 'id'>) })));
  });
}

export function watchExpensesForClient(
  clientId: string,
  cb: (expenses: Expense[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, COL),
    where('clientId', '==', clientId),
    orderBy('date', 'desc'),
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Expense, 'id'>) })));
  });
}

export function watchExpensesForProject(
  projectId: string,
  cb: (expenses: Expense[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, COL),
    where('projectId', '==', projectId),
    orderBy('date', 'desc'),
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Expense, 'id'>) })));
  });
}

export function watchExpense(
  id: string,
  cb: (expense: Expense | null) => void,
): Unsubscribe {
  return onSnapshot(doc(db, COL, id), (snap) => {
    cb(
      snap.exists()
        ? ({ id: snap.id, ...(snap.data() as Omit<Expense, 'id'>) } as Expense)
        : null,
    );
  });
}

export async function createExpense(input: {
  date?: string;
  description: string;
  amount: number;
  vatAmount?: number;
  category: ExpenseCategory;
  vendor?: string;
  clientId?: string;
  clientName?: string;
  projectId?: string;
  projectTitle?: string;
  billable?: boolean;
  notes?: string;
}): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    date: input.date ?? new Date().toISOString().slice(0, 10),
    description: input.description.trim(),
    amount: input.amount,
    category: input.category,
    billable: input.billable ?? false,
    attachments: [],
    ...stripUndefined({
      vatAmount: input.vatAmount,
      vendor: input.vendor,
      clientId: input.clientId,
      clientName: input.clientName,
      projectId: input.projectId,
      projectTitle: input.projectTitle,
      notes: input.notes,
    }),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateExpense(
  expenseId: string,
  patch: Partial<
    Pick<
      Expense,
      | 'date'
      | 'description'
      | 'amount'
      | 'vatAmount'
      | 'category'
      | 'vendor'
      | 'clientId'
      | 'clientName'
      | 'projectId'
      | 'projectTitle'
      | 'billable'
      | 'notes'
    >
  >,
): Promise<void> {
  await updateDoc(doc(db, COL, expenseId), {
    ...stripUndefined(patch),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete the expense document AND every binary attachment in Storage. We try
 * each Storage object best-effort — a missing object is treated as already
 * gone rather than blocking the Firestore delete.
 */
export async function deleteExpense(expenseId: string): Promise<void> {
  const snap = await getDoc(doc(db, COL, expenseId));
  if (snap.exists()) {
    const data = snap.data() as Omit<Expense, 'id'>;
    const attachments = (data.attachments ?? []) as ExpenseAttachment[];
    await Promise.all(
      attachments.map(async (att) => {
        try {
          await deleteObject(storageRef(storage, att.storagePath));
        } catch {
          // Already gone, or permission issue — non-fatal for delete.
        }
      }),
    );
  }
  await deleteDoc(doc(db, COL, expenseId));
}

/**
 * Upload one file as a new ExpenseAttachment.
 *
 * Path pattern: `expenses/{YYYY}/{MM}/{expenseId}/{uuid}.{ext}`.
 * The original filename is preserved on the attachment metadata; the storage
 * object uses a UUID filename to avoid collisions and sanitisation headaches.
 */
export async function uploadExpenseAttachment(
  expenseId: string,
  file: File,
): Promise<ExpenseAttachment> {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const id = crypto.randomUUID();
  const ext = extensionFor(file);
  const path = `expenses/${yyyy}/${mm}/${expenseId}/${id}${ext ? `.${ext}` : ''}`;

  const ref = storageRef(storage, path);
  await uploadBytes(ref, file, { contentType: file.type || undefined });
  const downloadUrl = await getDownloadURL(ref);

  const attachment: ExpenseAttachment = {
    id,
    storagePath: path,
    downloadUrl,
    fileName: file.name,
    contentType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
    uploadedAt: Timestamp.now(),
  };

  // Read-modify-write — arrayUnion would technically work here because each
  // attachment object is unique, but keeping it explicit makes the path
  // consistent with deleteExpenseAttachment below.
  const expenseRef = doc(db, COL, expenseId);
  const snap = await getDoc(expenseRef);
  const current = snap.exists()
    ? ((snap.data() as Omit<Expense, 'id'>).attachments ?? [])
    : [];
  await updateDoc(expenseRef, {
    attachments: [...current, attachment],
    updatedAt: serverTimestamp(),
  });

  return attachment;
}

/**
 * Delete a single attachment — Storage object + metadata removed from the
 * expense's attachments array.
 *
 * Uses read-modify-write because Firestore `arrayRemove` can't reliably
 * match on object equality (Timestamp instances aren't byte-identical after
 * re-reads).
 */
export async function deleteExpenseAttachment(
  expenseId: string,
  attachmentId: string,
): Promise<void> {
  const expenseRef = doc(db, COL, expenseId);
  const snap = await getDoc(expenseRef);
  if (!snap.exists()) return;
  const data = snap.data() as Omit<Expense, 'id'>;
  const attachments = (data.attachments ?? []) as ExpenseAttachment[];
  const target = attachments.find((a) => a.id === attachmentId);
  if (target) {
    try {
      await deleteObject(storageRef(storage, target.storagePath));
    } catch {
      // Already gone in Storage — still update Firestore.
    }
  }
  await updateDoc(expenseRef, {
    attachments: attachments.filter((a) => a.id !== attachmentId),
    updatedAt: serverTimestamp(),
  });
}

export type ExpenseCategoryTotals = Record<
  ExpenseCategory,
  { count: number; total: number }
>;

/**
 * Group expenses by category, returning `{ count, total }` per category.
 * Empty categories are included with zeros so the UI can render a stable grid.
 */
export function expensesByCategory(
  expenses: Expense[],
  from?: string,
  to?: string,
): ExpenseCategoryTotals {
  const out = {} as ExpenseCategoryTotals;
  for (const cat of EXPENSE_CATEGORIES) {
    out[cat] = { count: 0, total: 0 };
  }
  for (const e of expenses) {
    if (from && e.date < from) continue;
    if (to && e.date > to) continue;
    const cat = (out[e.category] ? e.category : 'other') as ExpenseCategory;
    out[cat].count += 1;
    out[cat].total += Number(e.amount) || 0;
  }
  return out;
}

export const GBP = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  minimumFractionDigits: 2,
});

function extensionFor(file: File): string {
  // Prefer filename extension; fall back to a guess from MIME type.
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

function stripUndefined<T extends object>(obj: T): T {
  const out = {} as T;
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== '') (out as Record<string, unknown>)[k] = v;
  }
  return out;
}
