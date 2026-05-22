import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { watchClients } from '../lib/clients';
import { watchProjects } from '../lib/projects';
import { GBP, createQuote, quoteTotals, watchQuotes } from '../lib/quotes';
import {
  QUOTE_STATUSES,
  QUOTE_STATUS_LABEL,
  type Client,
  type Project,
  type Quote,
  type QuoteStatus,
} from '../lib/types';
import QuoteStatusPill from '../components/QuoteStatusPill';

type Filter = 'all' | QuoteStatus;

export default function Quotes() {
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [adding, setAdding] = useState(false);

  useEffect(() => watchQuotes(setQuotes), []);
  useEffect(() => watchClients(setClients), []);
  useEffect(() => watchProjects(setProjects), []);

  const filtered = useMemo(() => {
    if (!quotes) return null;
    if (filter === 'all') return quotes;
    return quotes.filter((q) => q.status === filter);
  }, [quotes, filter]);

  return (
    <div>
      <header className="cc-page-head">
        <div>
          <h1 className="cc-page-title">Quotes</h1>
          <p className="cc-page-head-meta">
            {quotes === null
              ? 'Loading…'
              : `${quotes.length} quote${quotes.length === 1 ? '' : 's'} · ${quotes.filter((q) => q.status === 'sent').length} sent · ${quotes.filter((q) => q.status === 'accepted').length} accepted`}
          </p>
        </div>
        {!adding && (
          <button
            type="button"
            className="cc-btn-primary"
            disabled={clients.length === 0}
            onClick={() => setAdding(true)}
          >
            New quote
          </button>
        )}
      </header>

      {clients.length === 0 && (
        <div className="cc-empty mb-6">Add a client first.</div>
      )}

      {adding && (
        <NewQuoteForm
          clients={clients}
          projects={projects}
          onCancel={() => setAdding(false)}
          onCreated={() => setAdding(false)}
        />
      )}

      <FilterBar value={filter} onChange={setFilter} />

      {filtered === null ? (
        <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="cc-empty-inline">
          <span style={{ color: 'var(--text-dim)' }}>—</span>{' '}
          {filter === 'all'
            ? 'No quotes yet.'
            : `No ${QUOTE_STATUS_LABEL[filter].toLowerCase()} quotes.`}
        </p>
      ) : (
        <QuotesTable quotes={filtered} />
      )}
    </div>
  );
}

function FilterBar({ value, onChange }: { value: Filter; onChange: (v: Filter) => void }) {
  const options: { value: Filter; label: string }[] = [
    { value: 'all', label: 'All' },
    ...QUOTE_STATUSES.map((s) => ({ value: s, label: QUOTE_STATUS_LABEL[s] })),
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

function QuotesTable({ quotes }: { quotes: Quote[] }) {
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
            <th>Status</th>
            <th style={{ textAlign: 'right' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {quotes.map((q) => {
            const { total } = quoteTotals(q);
            return (
              <tr
                key={q.id}
                className="cc-row"
                onClick={() => navigate(`/quotes/${q.id}`)}
              >
                <td className="font-medium">{q.number}</td>
                <td style={{ color: 'var(--text-muted)' }}>{q.clientName}</td>
                <td style={{ color: 'var(--text-muted)' }}>{q.projectTitle ?? '—'}</td>
                <td style={{ color: 'var(--text-dim)' }}>{formatISODate(q.issueDate)}</td>
                <td>
                  <QuoteStatusPill status={q.status} />
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

function NewQuoteForm({
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
  const [clientId, setClientId] = useState(clients[0]?.id ?? '');
  const [projectId, setProjectId] = useState('');
  const [busy, setBusy] = useState(false);

  const clientProjects = projects.filter((p) => p.clientId === clientId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const client = clients.find((c) => c.id === clientId);
    if (!client) return;
    const project = projectId ? projects.find((p) => p.id === projectId) : undefined;
    setBusy(true);
    try {
      const id = await createQuote({
        clientId: client.id,
        clientName: client.name,
        projectId: project?.id,
        projectTitle: project?.title,
      });
      onCreated();
      navigate(`/quotes/${id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="cc-card mb-6 grid gap-3 p-5 md:grid-cols-[1fr_1fr_auto] md:items-end">
      <label className="block">
        <span className="cc-eyebrow mb-2 block">Client</span>
        <select
          className="cc-input"
          value={clientId}
          onChange={(e) => {
            setClientId(e.target.value);
            setProjectId('');
          }}
        >
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
          disabled={clientProjects.length === 0}
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
        <button type="submit" className="cc-btn-primary" disabled={busy || !clientId}>
          {busy ? 'Creating…' : 'Create'}
        </button>
        <button type="button" className="cc-btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function formatISODate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
