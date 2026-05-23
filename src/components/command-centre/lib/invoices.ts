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
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  Invoice,
  InvoiceLineItem,
  InvoiceStatus,
  Quote,
} from './types';

const COL = 'invoices';
const COUNTER = doc(db, 'meta', 'invoiceCounter');

export function watchInvoices(cb: (invoices: Invoice[]) => void): Unsubscribe {
  const q = query(collection(db, COL), orderBy('issueDate', 'desc'));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Invoice, 'id'>) })));
  });
}

export function watchInvoicesForClient(
  clientId: string,
  cb: (invoices: Invoice[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, COL),
    where('clientId', '==', clientId),
    orderBy('issueDate', 'desc'),
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Invoice, 'id'>) })));
  });
}

export function watchInvoicesForProject(
  projectId: string,
  cb: (invoices: Invoice[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, COL),
    where('projectId', '==', projectId),
    orderBy('issueDate', 'desc'),
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Invoice, 'id'>) })));
  });
}

export function watchInvoice(
  id: string,
  cb: (invoice: Invoice | null) => void,
): Unsubscribe {
  return onSnapshot(doc(db, COL, id), (snap) => {
    cb(
      snap.exists()
        ? ({ id: snap.id, ...(snap.data() as Omit<Invoice, 'id'>) } as Invoice)
        : null,
    );
  });
}

export async function nextInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const next = await runTransaction(db, async (tx) => {
    const snap = await tx.get(COUNTER);
    const data = snap.exists() ? snap.data() : undefined;
    // Year-aware counter — resets on calendar year. If the counter doc is
    // missing entirely, or it's a fresh year, start from 1.
    const sameYear = data && (data.year as number | undefined) === year;
    const current = sameYear ? ((data!.next as number) || 1) : 1;
    tx.set(COUNTER, { year, next: current + 1 }, { merge: true });
    return current;
  });
  return `INV-${year}-${String(next).padStart(3, '0')}`;
}

export async function createInvoice(input: {
  clientId?: string;
  clientName?: string;
  projectId?: string;
  projectTitle?: string;
  quoteId?: string;
  lineItems?: InvoiceLineItem[];
  vatRate?: number;
  issueDate?: string;
  dueDate?: string;
  introNote?: string;
  termsNote?: string;
}): Promise<string> {
  const number = await nextInvoiceNumber();
  const ref = await addDoc(collection(db, COL), {
    number,
    ...stripUndefined({
      clientId: input.clientId,
      clientName: input.clientName,
      projectId: input.projectId,
      projectTitle: input.projectTitle,
      quoteId: input.quoteId,
      introNote: input.introNote,
      termsNote: input.termsNote,
      dueDate: input.dueDate,
    }),
    status: 'draft' as InvoiceStatus,
    issueDate: input.issueDate ?? new Date().toISOString().slice(0, 10),
    lineItems: input.lineItems ?? [],
    vatRate: input.vatRate ?? 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateInvoice(
  id: string,
  patch: Partial<
    Pick<
      Invoice,
      | 'clientId'
      | 'clientName'
      | 'projectId'
      | 'projectTitle'
      | 'issueDate'
      | 'dueDate'
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

export async function markInvoiceSent(id: string): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    status: 'sent' as InvoiceStatus,
    sentAt: Timestamp.now(),
    updatedAt: serverTimestamp(),
  });
}

export async function markInvoicePaid(
  id: string,
  opts?: { paidAmount?: number; paymentMethod?: string },
): Promise<void> {
  const patch: Record<string, unknown> = {
    status: 'paid' as InvoiceStatus,
    paidAt: Timestamp.now(),
    updatedAt: serverTimestamp(),
  };
  if (opts?.paidAmount !== undefined) patch.paidAmount = opts.paidAmount;
  if (opts?.paymentMethod) patch.paymentMethod = opts.paymentMethod;
  await updateDoc(doc(db, COL, id), patch);
}

export async function voidInvoice(id: string): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    status: 'void' as InvoiceStatus,
    voidedAt: Timestamp.now(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Transition back to draft (rare — usually only used to undo an accidental
 * "mark sent". Voided invoices stay voided in normal use.)
 */
export async function revertInvoiceToDraft(id: string): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    status: 'draft' as InvoiceStatus,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteInvoice(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}

export function newLineItem(): InvoiceLineItem {
  return {
    id: crypto.randomUUID(),
    description: '',
    quantity: 1,
    unit: '',
    unitPrice: 0,
  };
}

export function invoiceTotals(invoice: Pick<Invoice, 'lineItems' | 'vatRate'>): {
  subtotal: number;
  vat: number;
  total: number;
} {
  const subtotal = (invoice.lineItems ?? []).reduce(
    (sum, li) => sum + (li.quantity || 0) * (li.unitPrice || 0),
    0,
  );
  const vat = subtotal * ((invoice.vatRate || 0) / 100);
  return { subtotal, vat, total: subtotal + vat };
}

export function isOverdue(invoice: Pick<Invoice, 'status' | 'dueDate'>): boolean {
  if (!invoice.dueDate) return false;
  if (invoice.status === 'paid' || invoice.status === 'void') return false;
  return new Date(invoice.dueDate) < new Date(new Date().toISOString().slice(0, 10));
}

export const GBP = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  minimumFractionDigits: 2,
});

/**
 * Clone an accepted quote into a draft invoice. Copies line items, VAT, notes,
 * client/project links; stores `quoteId` back-link on the new invoice.
 */
export async function createInvoiceFromQuote(quoteId: string): Promise<string> {
  const snap = await getDoc(doc(db, 'quotes', quoteId));
  if (!snap.exists()) throw new Error(`No quote with id "${quoteId}".`);
  const quote = { id: snap.id, ...(snap.data() as Omit<Quote, 'id'>) } as Quote;
  return createInvoice({
    clientId: quote.clientId,
    clientName: quote.clientName,
    projectId: quote.projectId,
    projectTitle: quote.projectTitle,
    quoteId: quote.id,
    lineItems: (quote.lineItems ?? []).map((li) => ({ ...li, id: crypto.randomUUID() })),
    vatRate: quote.vatRate,
    introNote: quote.introNote,
    termsNote: quote.termsNote,
  });
}

function stripUndefined<T extends object>(obj: T): T {
  const out = {} as T;
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== '') (out as Record<string, unknown>)[k] = v;
  }
  return out;
}
