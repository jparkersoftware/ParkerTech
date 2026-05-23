import { INVOICE_STATUS_LABEL, type InvoiceStatus } from '../lib/types';

const VARIANT: Record<InvoiceStatus, string> = {
  draft: 'is-draft',
  sent: 'is-sent',
  paid: 'is-paid',
  void: 'is-void',
};

export default function InvoiceStatusPill({ status }: { status: InvoiceStatus }) {
  return (
    <span className={`cc-invoice-pill ${VARIANT[status]}`}>
      {INVOICE_STATUS_LABEL[status]}
    </span>
  );
}
