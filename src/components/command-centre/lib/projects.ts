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
import { db } from './firebase';
import {
  normaliseProjectStatus,
  type ChecklistItem,
  type FeatureRequest,
  type FeatureRequestStatus,
  type Milestone,
  type MilestoneStatus,
  type Project,
  type ProjectStatus,
  type Task,
  type TaskPriority,
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
  input: {
    title: string;
    dueDate?: string;
    priority?: TaskPriority;
    notes?: string;
    featureRequestId?: string;
  },
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
      featureRequestId: input.featureRequestId,
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

/**
 * Set a project's status to `completed`. The "archive" action — completed
 * projects are hidden from the dashboard and the default Projects list view.
 */
export async function markProjectCompleted(projectId: string): Promise<void> {
  await updateDoc(doc(db, COL, projectId), {
    status: 'completed',
    updatedAt: serverTimestamp(),
  });
}

/**
 * Append a feature request to a project. If the project is currently
 * `completed` (or legacy `delivered`), also flip its status back to `active`
 * — adding new work means the project isn't really done. Returns a flag so
 * the UI can surface a "project reopened" toast.
 */
export async function addFeatureRequest(
  projectId: string,
  input: {
    title: string;
    description?: string;
    status?: FeatureRequestStatus;
  },
): Promise<{ featureRequestId: string; reopened: boolean }> {
  const ref = doc(db, COL, projectId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error(`No project with id ${projectId}`);
  const data = snap.data() as Project;
  const existing = data.featureRequests ?? [];
  const fr: FeatureRequest = {
    id: crypto.randomUUID(),
    title: input.title.trim(),
    status: input.status ?? 'proposed',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    ...stripUndefined({ description: input.description }),
  };
  const currentStatus = normaliseProjectStatus(data.status);
  const reopen = currentStatus === 'completed';
  const patch: Record<string, unknown> = {
    featureRequests: [...existing, fr],
    updatedAt: serverTimestamp(),
  };
  if (reopen) patch.status = 'active';
  await updateDoc(ref, patch);
  return { featureRequestId: fr.id, reopened: reopen };
}

export async function updateFeatureRequest(
  projectId: string,
  featureRequests: FeatureRequest[],
  featureRequestId: string,
  patch: Partial<Pick<FeatureRequest, 'title' | 'description' | 'status'>>,
): Promise<void> {
  const next = featureRequests.map((fr) => {
    if (fr.id !== featureRequestId) return fr;
    return {
      ...fr,
      ...stripUndefined(patch),
      updatedAt: Timestamp.now(),
    };
  });
  await updateDoc(doc(db, COL, projectId), {
    featureRequests: next,
    updatedAt: serverTimestamp(),
  });
}

export async function removeFeatureRequest(
  projectId: string,
  featureRequests: FeatureRequest[],
  tasks: Task[],
  featureRequestId: string,
): Promise<void> {
  // Drop the FR and unlink any tasks pointing to it (tasks themselves stay).
  const nextFrs = featureRequests.filter((fr) => fr.id !== featureRequestId);
  const nextTasks = tasks.map((t) =>
    t.featureRequestId === featureRequestId
      ? (() => {
          const { featureRequestId: _unused, ...rest } = t;
          void _unused;
          return rest as Task;
        })()
      : t,
  );
  await updateDoc(doc(db, COL, projectId), {
    featureRequests: nextFrs,
    tasks: nextTasks,
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
