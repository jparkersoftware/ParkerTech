import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Client, Contact } from './types';

const COL = 'clients';
const PROJECTS_COL = 'projects';

export function watchClients(cb: (clients: Client[]) => void): Unsubscribe {
  const q = query(collection(db, COL), orderBy('name'));
  return onSnapshot(q, (snap) => {
    cb(
      snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Client, 'id'>),
      })),
    );
  });
}

export function watchClient(
  id: string,
  cb: (client: Client | null) => void,
): Unsubscribe {
  return onSnapshot(doc(db, COL, id), (snap) => {
    cb(
      snap.exists()
        ? ({ id: snap.id, ...(snap.data() as Omit<Client, 'id'>) } as Client)
        : null,
    );
  });
}

export async function getClient(id: string): Promise<Client | null> {
  const snap = await getDoc(doc(db, COL, id));
  return snap.exists()
    ? ({ id: snap.id, ...(snap.data() as Omit<Client, 'id'>) } as Client)
    : null;
}

export async function createClient(name: string): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    name: name.trim(),
    notes: '',
    contacts: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateClientFields(
  id: string,
  patch: Partial<Pick<Client, 'name' | 'notes'>>,
): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
  if (patch.name) {
    await cascadeClientNameToProjects(id, patch.name);
  }
}

async function cascadeClientNameToProjects(clientId: string, newName: string): Promise<void> {
  const projectsSnap = await getDocs(
    query(collection(db, PROJECTS_COL), where('clientId', '==', clientId)),
  );
  if (projectsSnap.empty) return;
  const batch = writeBatch(db);
  projectsSnap.forEach((p) => {
    batch.update(p.ref, { clientName: newName });
  });
  await batch.commit();
}

export async function deleteClient(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}

export async function addContact(
  clientId: string,
  contacts: Contact[],
  contact: Omit<Contact, 'id'>,
): Promise<void> {
  const next: Contact[] = [
    ...contacts,
    { id: crypto.randomUUID(), ...stripUndefined(contact) },
  ];
  await updateDoc(doc(db, COL, clientId), {
    contacts: next,
    updatedAt: serverTimestamp(),
  });
}

export async function updateContact(
  clientId: string,
  contacts: Contact[],
  contactId: string,
  patch: Partial<Omit<Contact, 'id'>>,
): Promise<void> {
  const next = contacts.map((c) =>
    c.id === contactId ? { ...c, ...stripUndefined(patch) } : c,
  );
  await updateDoc(doc(db, COL, clientId), {
    contacts: next,
    updatedAt: serverTimestamp(),
  });
}

export async function removeContact(
  clientId: string,
  contacts: Contact[],
  contactId: string,
): Promise<void> {
  await updateDoc(doc(db, COL, clientId), {
    contacts: contacts.filter((c) => c.id !== contactId),
    updatedAt: serverTimestamp(),
  });
}

function stripUndefined<T extends object>(obj: T): T {
  const out = {} as T;
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== '') (out as Record<string, unknown>)[k] = v;
  }
  return out;
}
