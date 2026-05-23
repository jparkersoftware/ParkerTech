import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { watchClients } from '../lib/clients';
import { watchProjects } from '../lib/projects';
import {
  GBP,
  createInvoice,
  invoiceTotals,
  isOverdue,
  watchInvoices,
} from '../lib/invoices';
import {
  INVOICE_STATUSES,
  INVOICE_STATUS_LABEL,
  type Client,
  type Invoice,
  type InvoiceStatus,
  type Project,
} from '../lib/types';
import InvoiceStatusPill from '../components/InvoiceStatusPill';
import { formatRelativeDate } from '../lib/dateFormat';

type Filter = 'all' | InvoiceStatus | 'overdue';

export default function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [adding, setAdding] = useState(false);

  useEffect(() => watchInvoices(setInvoices), []);
  useEffect(() => watchClients(setClients), []);
  useEffect(() => watchProjects(setProjects), []);

  const filtered = useMemo(() => {
    if (!invoices) return null;
    if (filter === 'all') return invoices;
    if (filter === 'overdue') return invoices.filter((inv) => isOverdue(inv));
    return invoices.filter((inv) => inv.status === filter);
  }, [invoices, filter]);

  const headerMeta = useMemo(() => {
    if (invoices === null) return 'Loading…';
    const paid = invoices.filter((inv) => inv.status === 'paid');
    // "Outstanding" = sent but not yet paid (drafts aren't out yet; voids
    // don't count). Mirrors how a small-business owner thinks about cash flow.
    const outstanding = invoices.filter((inv) => inv.status === 'sent');
    const outstandingTotal = outstanding.reduce(
      (sum, inv) => sum + invoiceTotals(inv).total,
      0,
    );
    return `${invoices.length} invoice${invoices.length === 1 ? '' : 's'} · ${paid.length} paid · ${outstanding.length} outstanding · ${GBP.format(outstandingTotal)} outstanding total`;
  }, [invoices]);

  return (
    <div>
      <header className="cc-page-head">
        <div>
          <h1 className="cc-page-title">Invoices</h1>
          <p className="cc-page-head-meta">{headerMeta}</p>
        </div>
        {!adding && (
          <button
            type="button"
            className="cc-btn-primary"
            onClick={() => setAdding(true)}
          >
            New invoice
          </button>
        )}
      </header>

      {adding && (
        <NewInvoiceForm
          clients={clients}
          projects={projects}
          onCancel={() => setAdding(false)}
          onCreated={() => setAdding(false)}
        />
      )}

      <FilterBar
        value={filter}
        onChange={setFilter}
        overdueCount={
          invoices?.filter((inv) => isOverdue(inv)).length ?? 0
        }
      />

      {filtered === null ? (
        <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="cc-empty-inline">
          <span style={{ color: 'var(--text-dim)' }}>—</span>{' '}
          {filter === 'all'
            ? 'No invoices yet.'
            : filter === 'overdue'
              ? 'No overdue invoices.'
              : `No ${INVOICE_STATUS_LABEL[filter].toLowerCase()} invoices.`}
        </p>
      ) : (
        <InvoicesTable invoices={filtered} />
      )}
    </div>
  );
}

function FilterBar({
  value,
  onChange,
  overdueCount,
}: {
  value: Filter;
  onChange: (v: Filter) => void;
  overdueCount: number;
}) {
  const options: { value: Filter; label: string }[] = [
    { value: 'all', label: 'All' },
    ...INVOICE_STATUSES.filter((s) => s !== 'void').map((s) => ({
      value: s as Filter,
      label: INVOICE_STATUS_LABEL[s],
    })),
    {
      value: 'overdue',
      label: overdueCount > 0 ? `Overdue (${overdueCount})` : 'Overdue',
    },
    { value: 'void', label: INVOICE_STATUS_LABEL.void },
  ];
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={value === opt.value ? 'cc-filter is-active' : 'cc-filter'}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function InvoicesTable({ invoices }: { invoices: Invoice[] }) {
  const navigate = useNavigate();
  return (
    <div className="cc-card overflow-hidden">
      <table className="cc-table">
        <thead>
          <tr>
            <th>Number</th>
            <th>Client</th>
            <th>Project</th>
            <th>Issued</th>
            <th>Due</th>
            <th>Status</th>
            <th style={{ textAlign: 'right' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => {
            const { total } = invoiceTotals(inv);
            const overdue = isOverdue(inv);
            return (
              <tr
                key={inv.id}
                className="cc-row"
                onClick={() => navigate(`/invoices/${inv.id}`)}
              >
                <td className="font-medium">{inv.number}</td>
                <td style={{ color: 'var(--text-muted)' }}>
                  {inv.clientName ?? '—'}
                </td>
                <td style={{ color: 'var(--text-muted)' }}>
                  {inv.projectTitle ?? '—'}
                </td>
                <td
                  style={{ color: 'var(--text-dim)' }}
                  title={inv.issueDate ?? ''}
                >
                  {formatISODate(inv.issueDate)}
                </td>
                <td style={{ color: 'var(--text-dim)' }} title={inv.dueDate ?? ''}>
                  {inv.dueDate ? formatISODate(inv.dueDate) : '—'}
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <InvoiceStatusPill status={inv.status} />
                    {overdue && <span className="cc-overdue-pill">Overdue</span>}
                  </div>
                </td>
                <td
                  style={{
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                    fontWeight: 500,
                  }}
                >
                  {GBP.format(total)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function NewInvoiceForm({
  clients,
  projects,
  onCancel,
  onCreated,
}: {
  clients: Client[];
  projects: Project[];
  onCancel: () => void;
  onCreated: () => void;
}) {
  const navigate = useNavigate();
  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [busy, setBusy] = useState(false);

  const clientProjects = projects.filter((p) => p.clientId === clientId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const client = clientId ? clients.find((c) => c.id === clientId) : undefined;
    const project = projectId ? projects.find((p) => p.id === projectId) : undefined;
    setBusy(true);
    try {
      const id = await createInvoice({
        clientId: client?.id,
        clientName: client?.name,
        projectId: project?.id,
        projectTitle: project?.title,
      });
      onCreated();
      navigate(`/invoices/${id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="cc-card mb-6 grid gap-3 p-5 md:grid-cols-[1fr_1fr_auto] md:items-end"
    >
      <label className="block">
        <span className="cc-eyebrow mb-2 block">Client (optional)</span>
        <select
          className="cc-input"
          value={clientId}
          onChange={(e) => {
            setClientId(e.target.value);
            setProjectId('');
          }}
        >
          <option value="">— none —</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="cc-eyebrow mb-2 block">Project (optional)</span>
        <select
          className="cc-input"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          disabled={!clientId || clientProjects.length === 0}
        >
          <option value="">— not project-specific —</option>
          {clientProjects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </label>
      <div className="flex gap-2">
        <button type="submit" className="cc-btn-primary" disabled={busy}>
          {busy ? 'Creating…' : 'Create'}
        </button>
        <button type="button" className="cc-btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/**
 * @deprecated Prefer `formatRelativeDate` from `lib/dateFormat`. Kept as a
 * thin wrapper so existing callers keep working without churn.
 */
export const formatISODate = formatRelativeDate;
