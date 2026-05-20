import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Correspondence, CorrespondenceType } from './types';

const COL = 'correspondence';

export function watchCorrespondence(
  cb: (entries: Correspondence[]) => void,
): Unsubscribe {
  const q = query(collection(db, COL), orderBy('date', 'desc'));
  return onSnapshot(q, (snap) => {
    cb(
      snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Correspondence, 'id'>),
      })),
    );
  });
}

export function watchCorrespondenceForClient(
  clientId: string,
  cb: (entries: Correspondence[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, COL),
    where('clientId', '==', clientId),
    orderBy('date', 'desc'),
  );
  return onSnapshot(q, (snap) => {
    cb(
      snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Correspondence, 'id'>),
      })),
    );
  });
}

export function watchCorrespondenceForProject(
  projectId: string,
  cb: (entries: Correspondence[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, COL),
    where('projectId', '==', projectId),
    orderBy('date', 'desc'),
  );
  return onSnapshot(q, (snap) => {
    cb(
      snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Correspondence, 'id'>),
      })),
    );
  });
}

export async function createCorrespondence(input: {
  clientId: string;
  clientName: string;
  projectId?: string;
  projectTitle?: string;
  type: CorrespondenceType;
  date: string;
  title: string;
  body: string;
  contactIds: string[];
}): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    ...stripUndefined(input),
    title: input.title.trim(),
    body: input.body,
    contactIds: input.contactIds,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateCorrespondence(
  id: string,
  patch: Partial<
    Pick<
      Correspondence,
      | 'clientId'
      | 'clientName'
      | 'projectId'
      | 'projectTitle'
      | 'type'
      | 'date'
      | 'title'
      | 'body'
      | 'contactIds'
    >
  >,
): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    ...stripUndefined(patch),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteCorrespondence(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}

function stripUndefined<T extends object>(obj: T): T {
  const out = {} as T;
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== '') (out as Record<string, unknown>)[k] = v;
  }
  return out;
}
