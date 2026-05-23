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

/**
 * Canonical project statuses. `delivered` is a *legacy* value kept in the enum
 * for backward-compat with existing Firestore documents; new writes should use
 * `completed`. Read paths should funnel raw Firestore values through
 * `normaliseProjectStatus` so the rest of the app never has to think about it.
 */
export const PROJECT_STATUSES = [
  'discovery',
  'active',
  'on-hold',
  'completed',
  'delivered',
  'lost',
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/** Statuses we actually offer in the UI (legacy `delivered` excluded). */
export const PROJECT_STATUSES_UI: ProjectStatus[] = [
  'discovery',
  'active',
  'on-hold',
  'completed',
  'lost',
];

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  discovery: 'Discovery',
  active: 'Active',
  'on-hold': 'On hold',
  completed: 'Completed',
  // Legacy alias — render as "Completed" everywhere in the UI.
  delivered: 'Completed',
  lost: 'Lost',
};

/** Maps any raw Firestore status string to the canonical UI value. */
export function normaliseProjectStatus(raw: string | undefined): ProjectStatus {
  if (raw === 'delivered') return 'completed';
  if (
    raw === 'discovery' ||
    raw === 'active' ||
    raw === 'on-hold' ||
    raw === 'completed' ||
    raw === 'lost'
  ) {
    return raw;
  }
  // Unknown / missing → treat as discovery to avoid breaking the UI.
  return 'discovery';
}

export type TaskPriority = 'low' | 'normal' | 'high';

export type Task = {
  id: string;
  title: string;
  done: boolean;
  dueDate?: string;
  priority?: TaskPriority;
  notes?: string;
  /** Optional link to a feature request on the same project. */
  featureRequestId?: string;
  createdAt: Timestamp;
  completedAt?: Timestamp;
};

export const FEATURE_REQUEST_STATUSES = [
  'proposed',
  'planned',
  'in-progress',
  'done',
  'rejected',
] as const;
export type FeatureRequestStatus = (typeof FEATURE_REQUEST_STATUSES)[number];

export const FEATURE_REQUEST_STATUS_LABEL: Record<FeatureRequestStatus, string> = {
  proposed: 'Proposed',
  planned: 'Planned',
  'in-progress': 'In progress',
  done: 'Done',
  rejected: 'Rejected',
};

export type FeatureRequest = {
  id: string;
  title: string;
  description?: string;
  status: FeatureRequestStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
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
  featureRequests?: FeatureRequest[];
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
  /** Short human-readable digest — what was decided / next steps. */
  body: string;
  /** Optional verbatim raw text — transcript, full email, etc. Preserved for AI context. */
  transcript?: string;
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

export type InboxItem = {
  id: string;
  text: string;
  tags: string[];
  archived: boolean;
  archivedNote?: string;
  archivedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
