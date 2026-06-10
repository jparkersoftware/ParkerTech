/**
 * Pending-email queue helpers. The Gmail fetch Function writes raw email
 * candidates into the `emailCandidates` collection with status=`pending`;
 * the Correspondence page renders the queue and lets Joseph approve (which
 * creates a Correspondence doc) or skip.
 */
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  createCorrespondence,
} from './correspondence';
import type { CorrespondenceType } from './types';

const COL = 'emailCandidates';

export type EmailCandidateStatus = 'pending' | 'approved' | 'skipped';

export type EmailCandidate = {
  id: string;
  messageId: string;
  threadId: string;
  subject: string;
  from: string;
  to: string[];
  cc: string[];
  date: string; // ISO YYYY-MM-DD
  receivedAt: number; // epoch ms
  bodySnippet: string;
  bodyFull: string;
  status: EmailCandidateStatus;
  fetchedAt?: Timestamp;
  correspondenceId?: string;
  skipReason?: string;
  approvedAt?: Timestamp;
  skippedAt?: Timestamp;
};

export function watchPendingCandidates(
  cb: (rows: EmailCandidate[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, COL),
    where('status', '==', 'pending'),
    orderBy('receivedAt', 'desc'),
  );
  return onSnapshot(q, (snap) => {
    cb(
      snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<EmailCandidate, 'id'>),
      })),
    );
  });
}

export function watchAllCandidates(
  cb: (rows: EmailCandidate[]) => void,
  status?: EmailCandidateStatus,
): Unsubscribe {
  const constraints = status
    ? [where('status', '==', status), orderBy('receivedAt', 'desc')]
    : [orderBy('receivedAt', 'desc')];
  return onSnapshot(query(collection(db, COL), ...constraints), (snap) => {
    cb(
      snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<EmailCandidate, 'id'>),
      })),
    );
  });
}

/**
 * Approve a candidate: create a Correspondence document from it, then mark
 * the candidate approved with a back-reference. We don't delete the
 * candidate — keeping it gives us an audit trail and prevents re-fetch
 * loops if Gmail returns the same messageId.
 */
export async function approveCandidate(
  candidateId: string,
  payload: {
    clientId: string;
    clientName: string;
    projectId?: string;
    projectTitle?: string;
    type: CorrespondenceType;
    date: string;
    title: string;
    body: string;
    transcript?: string;
    contactIds: string[];
  },
): Promise<string> {
  const correspondenceId = await createCorrespondence(payload);
  await updateDoc(doc(db, COL, candidateId), {
    status: 'approved',
    correspondenceId,
    approvedAt: serverTimestamp(),
  });
  return correspondenceId;
}

export async function skipCandidate(
  candidateId: string,
  reason?: string,
): Promise<void> {
  await updateDoc(doc(db, COL, candidateId), {
    status: 'skipped',
    skipReason: reason ?? '',
    skippedAt: serverTimestamp(),
  });
}

/**
 * Admin helper. Hard-deletes candidates older than N days regardless of
 * status — useful to keep the collection trim. Not wired into the UI yet.
 */
export async function purgeOldCandidates(daysOld: number): Promise<number> {
  const cutoff = Date.now() - daysOld * 24 * 60 * 60 * 1000;
  const snap = await import('firebase/firestore').then(({ getDocs }) =>
    getDocs(query(collection(db, COL), where('receivedAt', '<', cutoff))),
  );
  let count = 0;
  for (const d of snap.docs) {
    await deleteDoc(d.ref);
    count += 1;
  }
  return count;
}

/**
 * Guess which client an email candidate belongs to by matching the
 * sender/recipient domains against client contact emails. Used to preselect
 * the client in approve flows (queue cards + dashboard triage).
 */
export function guessClientFromCandidate(
  c: EmailCandidate,
  clients: { id: string; contacts?: { email?: string }[] }[],
): string | undefined {
  const domains = new Set<string>();
  for (const addr of [c.from, ...c.to, ...c.cc]) {
    const d = emailDomain(addr);
    if (d) domains.add(d);
  }
  for (const client of clients) {
    for (const contact of client.contacts ?? []) {
      if (!contact.email) continue;
      const d = emailDomain(contact.email);
      if (d && domains.has(d)) return client.id;
    }
  }
  return undefined;
}

/** Contact ids on the client whose emails appear in the candidate headers. */
export function matchContactsForCandidate(
  c: EmailCandidate,
  client: { contacts?: { id: string; email?: string }[] },
): string[] {
  const addresses = new Set(
    [c.from, ...c.to, ...c.cc].map((a) => emailAddress(a)),
  );
  return (client.contacts ?? [])
    .filter((contact) => contact.email && addresses.has(contact.email.toLowerCase()))
    .map((contact) => contact.id);
}

/**
 * Extract the bare email address from a Gmail "Name <addr@host>" string.
 * Returns the input as-is if no angle-brackets are present.
 */
export function emailAddress(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  return (match?.[1] ?? raw).trim().toLowerCase();
}

/** Domain part of an email address. Returns '' if it can't be parsed. */
export function emailDomain(raw: string): string {
  const addr = emailAddress(raw);
  const at = addr.lastIndexOf('@');
  if (at < 0) return '';
  return addr.slice(at + 1);
}
