import {
  MILESTONE_STATUS_LABEL,
  type MilestoneStatus,
} from '../lib/types';

const VARIANT: Record<MilestoneStatus, string> = {
  planned: 'is-planned',
  'in-progress': 'is-progress',
  done: 'is-done',
  cancelled: 'is-cancelled',
};

export default function MilestoneStatusPill({
  status,
}: {
  status: MilestoneStatus;
}) {
  return (
    <span className={`cc-milestone-pill ${VARIANT[status]}`}>
      {MILESTONE_STATUS_LABEL[status]}
    </span>
  );
}
