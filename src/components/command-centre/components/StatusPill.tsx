import {
  PROJECT_STATUS_LABEL,
  normaliseProjectStatus,
  type ProjectStatus,
} from '../lib/types';

const STATUS_VARIANT: Record<ProjectStatus, string> = {
  discovery: 'is-discovery',
  active: 'is-active',
  'on-hold': 'is-hold',
  completed: 'is-completed',
  // Legacy alias — render with the same style as `completed`.
  delivered: 'is-completed',
  lost: 'is-lost',
};

export default function StatusPill({ status }: { status: ProjectStatus }) {
  const canonical = normaliseProjectStatus(status);
  return (
    <span className={`cc-status-pill ${STATUS_VARIANT[canonical]}`}>
      {PROJECT_STATUS_LABEL[canonical]}
    </span>
  );
}
