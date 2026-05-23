import {
  FEATURE_REQUEST_STATUS_LABEL,
  type FeatureRequestStatus,
} from '../lib/types';

const VARIANT: Record<FeatureRequestStatus, string> = {
  proposed: 'is-proposed',
  planned: 'is-planned',
  'in-progress': 'is-in-progress',
  done: 'is-done',
  rejected: 'is-rejected',
};

export default function FeatureRequestStatusPill({
  status,
}: {
  status: FeatureRequestStatus;
}) {
  return (
    <span className={`cc-fr-pill ${VARIANT[status]}`}>
      {FEATURE_REQUEST_STATUS_LABEL[status]}
    </span>
  );
}
