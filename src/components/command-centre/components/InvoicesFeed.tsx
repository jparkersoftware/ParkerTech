import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GBP,
  invoiceTotals,
  isOverdue,
  watchInvoicesForClient,
  watchInvoicesForProject,
} from '../lib/invoices';
import type { Invoice } from '../lib/types';
import InvoiceStatusPill from './InvoiceStatusPill';

export default function InvoicesFeed({
  scope,
  id,
}: {
  scope: 'client' | 'project';
  id: string;
}) {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    return scope === 'client'
      ? watchInvoicesForClient(id, setInvoices)
      : watchInvoicesForProject(id, setInvoices);
  }, [scope, id]);

  if (invoices === null) {
    return <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Loading…</p>;
  }
  if (invoices.length === 0) {
    return (
      <p className="cc-empty-inline">
        <span style={{ color: 'var(--text-dim)' }}>—</span> No invoices yet.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {invoices.map((inv) => {
        const { total } = invoiceTotals(inv);
        const overdue = isOverdue(inv);
        return (
          <li key={inv.id}>
            <button
              type="button"
              onClick={() => navigate(`/invoices/${inv.id}`)}
              className="cc-card flex w-full items-center justify-between gap-3 p-4 text-left transition hover:bg-[var(--surface-hover)]"
            >
              <div className="min-w-0">
                <p className="font-medium">{inv.number}</p>
                {inv.projectTitle && (
                  <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                    {inv.projectTitle}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {GBP.format(total)}
                </span>
                {overdue && <span className="cc-overdue-pill">Overdue</span>}
                <InvoiceStatusPill status={inv.status} />
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
