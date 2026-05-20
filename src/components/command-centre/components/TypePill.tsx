import {
  CORRESPONDENCE_TYPE_LABEL,
  type CorrespondenceType,
} from '../lib/types';

const TYPE_VARIANT: Record<CorrespondenceType, string> = {
  meeting: 'is-meeting',
  call: 'is-call',
  email: 'is-email',
  note: 'is-note',
};

export default function TypePill({ type }: { type: CorrespondenceType }) {
  return (
    <span className={`cc-type-pill ${TYPE_VARIANT[type]}`}>
      {CORRESPONDENCE_TYPE_LABEL[type]}
    </span>
  );
}
