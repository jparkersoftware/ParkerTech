import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Quote, QuoteLineItem, QuoteStatus } from './types';

const COL = 'quotes';
const COUNTER = doc(db, 'meta', 'quoteCounter');

export function watchQuotes(cb: (quotes: Quote[]) => void): Unsubscribe {
  const q = query(collection(db, COL), orderBy('issueDate', 'desc'));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Quote, 'id'>) })));
  });
}

export function watchQuotesForClient(
  clientId: string,
  cb: (quotes: Quote[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, COL),
    where('clientId', '==', clientId),
    orderBy('issueDate', 'desc'),
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Quote, 'id'>) })));
  });
}

export function watchQuotesForProject(
  projectId: string,
  cb: (quotes: Quote[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, COL),
    where('projectId', '==', projectId),
    orderBy('issueDate', 'desc'),
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Quote, 'id'>) })));
  });
}

export function watchQuote(
  id: string,
  cb: (quote: Quote | null) => void,
): Unsubscribe {
  return onSnapshot(doc(db, COL, id), (snap) => {
    cb(
      snap.exists()
        ? ({ id: snap.id, ...(snap.data() as Omit<Quote, 'id'>) } as Quote)
        : null,
    );
  });
}

async function nextQuoteNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const next = await runTransaction(db, async (tx) => {
    const snap = await tx.get(COUNTER);
    const current = snap.exists() ? ((snap.data().next as number) || 1) : 1;
    tx.set(COUNTER, { next: current + 1 }, { merge: true });
    return current;
  });
  return `QT-${year}-${String(next).padStart(3, '0')}`;
}

export async function createQuote(input: {
  clientId: string;
  clientName: string;
  projectId?: string;
  projectTitle?: string;
}): Promise<string> {
  const number = await nextQuoteNumber();
  const ref = await addDoc(collection(db, COL), {
    number,
    clientId: input.clientId,
    clientName: input.clientName,
    ...stripUndefined({ projectId: input.projectId, projectTitle: input.projectTitle }),
    status: 'draft' as QuoteStatus,
    issueDate: new Date().toISOString().slice(0, 10),
    lineItems: [],
    vatRate: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateQuoteFields(
  id: string,
  patch: Partial<
    Pick<
      Quote,
      | 'clientId'
      | 'clientName'
      | 'projectId'
      | 'projectTitle'
      | 'issueDate'
      | 'validUntil'
      | 'introNote'
      | 'vatRate'
      | 'termsNote'
      | 'lineItems'
    >
  >,
): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    ...stripUndefined(patch),
    updatedAt: serverTimestamp(),
  });
}

export async function transitionQuoteStatus(
  id: string,
  next: QuoteStatus,
): Promise<void> {
  const patch: Record<string, unknown> = {
    status: next,
    updatedAt: serverTimestamp(),
  };
  if (next === 'sent') patch.sentAt = Timestamp.now();
  if (next === 'accepted') patch.acceptedAt = Timestamp.now();
  if (next === 'declined') patch.declinedAt = Timestamp.now();
  await updateDoc(doc(db, COL, id), patch);
}

export async function deleteQuote(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}

export function newLineItem(): QuoteLineItem {
  return {
    id: crypto.randomUUID(),
    description: '',
    quantity: 1,
    unit: '',
    unitPrice: 0,
  };
}

export function quoteTotals(quote: Pick<Quote, 'lineItems' | 'vatRate'>): {
  subtotal: number;
  vat: number;
  total: number;
} {
  const subtotal = (quote.lineItems ?? []).reduce(
    (sum, li) => sum + (li.quantity || 0) * (li.unitPrice || 0),
    0,
  );
  const vat = subtotal * ((quote.vatRate || 0) / 100);
  return { subtotal, vat, total: subtotal + vat };
}

export const GBP = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  minimumFractionDigits: 2,
});

function stripUndefined<T extends object>(obj: T): T {
  const out = {} as T;
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== '') (out as Record<string, unknown>)[k] = v;
  }
  return out;
}
