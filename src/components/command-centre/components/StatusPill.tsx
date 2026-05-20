import { PROJECT_STATUS_LABEL, type ProjectStatus } from '../lib/types';

const STATUS_VARIANT: Record<ProjectStatus, string> = {
  discovery: 'is-discovery',
  active: 'is-active',
  'on-hold': 'is-hold',
  delivered: 'is-delivered',
  lost: 'is-lost',
};

export default function StatusPill({ status }: { status: ProjectStatus }) {
  return (
    <span className={`cc-status-pill ${STATUS_VARIANT[status]}`}>
      {PROJECT_STATUS_LABEL[status]}
    </span>
  );
}
