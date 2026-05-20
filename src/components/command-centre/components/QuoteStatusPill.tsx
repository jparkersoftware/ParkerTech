import { QUOTE_STATUS_LABEL, type QuoteStatus } from '../lib/types';

const VARIANT: Record<QuoteStatus, string> = {
  draft: 'is-draft',
  sent: 'is-sent',
  accepted: 'is-accepted',
  declined: 'is-declined',
};

export default function QuoteStatusPill({ status }: { status: QuoteStatus }) {
  return (
    <span className={`cc-quote-pill ${VARIANT[status]}`}>
      {QUOTE_STATUS_LABEL[status]}
    </span>
  );
}
