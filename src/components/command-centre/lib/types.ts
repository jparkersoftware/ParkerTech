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

export const MILESTONE_STATUSES = [
  'planned',
  'in-progress',
  'done',
  'cancelled',
] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

export const MILESTONE_STATUS_LABEL: Record<MilestoneStatus, string> = {
  planned: 'Planned',
  'in-progress': 'In progress',
  done: 'Done',
  cancelled: 'Cancelled',
};

export type ChecklistItem = {
  id: string;
  text: string;
  done: boolean;
};

export type Milestone = {
  id: string;
  title: string;
  description?: string;
  targetDate?: string;
  status: MilestoneStatus;
  checklist: ChecklistItem[];
  createdAt: Timestamp;
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
  milestones?: Milestone[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export const CORRESPONDENCE_TYPES = ['meeting', 'call', 'email', 'note'] as const;
export type CorrespondenceType = (typeof CORRESPONDENCE_TYPES)[number];

export const CORRESPONDENCE_TYPE_LABEL: Record<CorrespondenceType, string> = {
  meeting: 'Meeting',
  call: 'Call',
  email: 'Email',
  note: 'Note',
};

export type Correspondence = {
  id: string;
  clientId: string;
  clientName: string;
  projectId?: string;
  projectTitle?: string;
  type: CorrespondenceType;
  date: string;
  title: string;
  body: string;
  contactIds: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export const QUOTE_STATUSES = ['draft', 'sent', 'accepted', 'declined'] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  accepted: 'Accepted',
  declined: 'Declined',
};

export type QuoteLineItem = {
  id: string;
  description: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
};

export type Quote = {
  id: string;
  number: string;
  clientId: string;
  clientName: string;
  projectId?: string;
  projectTitle?: string;
  status: QuoteStatus;
  issueDate: string;
  validUntil?: string;
  introNote?: string;
  lineItems: QuoteLineItem[];
  vatRate: number;
  termsNote?: string;
  sentAt?: Timestamp;
  acceptedAt?: Timestamp;
  declinedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
