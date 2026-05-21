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
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  ChecklistItem,
  Milestone,
  MilestoneStatus,
  Project,
  ProjectStatus,
  Task,
  TaskPriority,
} from './types';

const COL = 'projects';

export function watchProjects(cb: (projects: Project[]) => void): Unsubscribe {
  const q = query(collection(db, COL), orderBy('updatedAt', 'desc'));
  return onSnapshot(q, (snap) => {
    cb(
      snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Project, 'id'>),
      })),
    );
  });
}

export function watchProjectsForClient(
  clientId: string,
  cb: (projects: Project[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, COL),
    where('clientId', '==', clientId),
    orderBy('updatedAt', 'desc'),
  );
  return onSnapshot(q, (snap) => {
    cb(
      snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Project, 'id'>),
      })),
    );
  });
}

export function watchProject(
  id: string,
  cb: (project: Project | null) => void,
): Unsubscribe {
  return onSnapshot(doc(db, COL, id), (snap) => {
    cb(
      snap.exists()
        ? ({ id: snap.id, ...(snap.data() as Omit<Project, 'id'>) } as Project)
        : null,
    );
  });
}

export async function createProject(input: {
  clientId: string;
  clientName: string;
  title: string;
  status?: ProjectStatus;
}): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    clientId: input.clientId,
    clientName: input.clientName,
    title: input.title.trim(),
    status: input.status ?? 'discovery',
    brief: '',
    tasks: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateProjectFields(
  id: string,
  patch: Partial<
    Pick<Project, 'title' | 'status' | 'brief' | 'startDate' | 'targetDate' | 'clientId' | 'clientName'>
  >,
): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    ...stripUndefined(patch),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteProject(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}

export async function addTask(
  projectId: string,
  tasks: Task[],
  input: { title: string; dueDate?: string; priority?: TaskPriority; notes?: string },
): Promise<void> {
  const newTask: Task = {
    id: crypto.randomUUID(),
    title: input.title.trim(),
    done: false,
    createdAt: Timestamp.now(),
    ...stripUndefined({
      dueDate: input.dueDate,
      priority: input.priority,
      notes: input.notes,
    }),
  };
  await updateDoc(doc(db, COL, projectId), {
    tasks: [...tasks, newTask],
    updatedAt: serverTimestamp(),
  });
}

export async function updateTask(
  projectId: string,
  tasks: Task[],
  taskId: string,
  patch: Partial<Omit<Task, 'id' | 'createdAt'>>,
): Promise<void> {
  const next = tasks.map((t) => {
    if (t.id !== taskId) return t;
    const merged = { ...t, ...stripUndefined(patch) };
    if (patch.done === true && !t.done) merged.completedAt = Timestamp.now();
    if (patch.done === false) delete (merged as Partial<Task>).completedAt;
    return merged;
  });
  await updateDoc(doc(db, COL, projectId), {
    tasks: next,
    updatedAt: serverTimestamp(),
  });
}

export async function removeTask(
  projectId: string,
  tasks: Task[],
  taskId: string,
): Promise<void> {
  await updateDoc(doc(db, COL, projectId), {
    tasks: tasks.filter((t) => t.id !== taskId),
    updatedAt: serverTimestamp(),
  });
}

export async function addMilestone(
  projectId: string,
  milestones: Milestone[],
  input: {
    title: string;
    description?: string;
    targetDate?: string;
    status?: MilestoneStatus;
    checklist?: { text: string }[];
  },
): Promise<void> {
  const newMilestone: Milestone = {
    id: crypto.randomUUID(),
    title: input.title.trim(),
    status: input.status ?? 'planned',
    checklist: (input.checklist ?? []).map((c) => ({
      id: crypto.randomUUID(),
      text: c.text.trim(),
      done: false,
    })),
    createdAt: Timestamp.now(),
    ...stripUndefined({
      description: input.description,
      targetDate: input.targetDate,
    }),
  };
  await updateDoc(doc(db, COL, projectId), {
    milestones: [...milestones, newMilestone],
    updatedAt: serverTimestamp(),
  });
}

export async function updateMilestone(
  projectId: string,
  milestones: Milestone[],
  milestoneId: string,
  patch: Partial<Omit<Milestone, 'id' | 'createdAt' | 'checklist'>> & {
    checklist?: ChecklistItem[];
  },
): Promise<void> {
  const next = milestones.map((m) =>
    m.id === milestoneId ? { ...m, ...stripUndefined(patch) } : m,
  );
  await updateDoc(doc(db, COL, projectId), {
    milestones: next,
    updatedAt: serverTimestamp(),
  });
}

export async function removeMilestone(
  projectId: string,
  milestones: Milestone[],
  milestoneId: string,
): Promise<void> {
  await updateDoc(doc(db, COL, projectId), {
    milestones: milestones.filter((m) => m.id !== milestoneId),
    updatedAt: serverTimestamp(),
  });
}

export async function toggleChecklistItem(
  projectId: string,
  milestones: Milestone[],
  milestoneId: string,
  itemId: string,
): Promise<void> {
  const next = milestones.map((m) => {
    if (m.id !== milestoneId) return m;
    return {
      ...m,
      checklist: m.checklist.map((c) =>
        c.id === itemId ? { ...c, done: !c.done } : c,
      ),
    };
  });
  await updateDoc(doc(db, COL, projectId), {
    milestones: next,
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
