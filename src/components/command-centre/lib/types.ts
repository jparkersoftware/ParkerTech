import type { Timestamp } from 'firebase/firestore';

export type Contact = {
  id: string;
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  notes?: string;
};

export type Client = {
  id: string;
  name: string;
  notes?: string;
  contacts: Contact[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export const PROJECT_STATUSES = [
  'discovery',
  'active',
  'on-hold',
  'delivered',
  'lost',
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  discovery: 'Discovery',
  active: 'Active',
  'on-hold': 'On hold',
  delivered: 'Delivered',
  lost: 'Lost',
};

export type TaskPriority = 'low' | 'normal' | 'high';

export type Task = {
  id: string;
  title: string;
  done: boolean;
  dueDate?: string;
  priority?: TaskPriority;
  notes?: string;
  createdAt: Timestamp;
  completedAt?: Timestamp;
};

export type Project = {
  id: string;
  clientId: string;
  clientName: string;
  title: string;
  status: ProjectStatus;
  brief?: string;
  startDate?: string;
  targetDate?: string;
  tasks: Task[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
