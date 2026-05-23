import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { watchClients } from '../lib/clients';
import { watchProjects } from '../lib/projects';
import {
  GBP,
  deleteQuote,
  newLineItem,
  quoteTotals,
  transitionQuoteStatus,
  updateQuoteFields,
  watchQuote,
} from '../lib/quotes';
import type { Client, Project, Quote, QuoteLineItem, QuoteStatus } from '../lib/types';
import QuoteStatusPill from '../components/QuoteStatusPill';
import ObsidianLink from '../components/ObsidianLink';
import { formatISODate } from './Quotes';

export default function QuoteDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [quote, setQuote] = useState<Quote | null | undefined>(undefined);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => watchQuote(id, setQuote), [id]);
  useEffect(() => watchClients(setClients), []);
  useEffect(() => watchProjects(setProjects), []);

  if (quote === undefined) {
    return <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Loading…</p>;
  }
  if (quote === null) {
    return (
      <div>
        <Link to="/quotes" className="cc-eyebrow inline-block">
          ← Quotes
        </Link>
        <p className="mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>
          This quote doesn't exist (or has been deleted).
        </p>
      </div>
    );
  }

  const locked = quote.status !== 'draft';

  async function handleDelete() {
    if (!confirm(`Delete ${quote!.number}? This can't be undone.`)) return;
    await deleteQuote(quote!.id);
    navigate('/quotes');
  }

  return (
    <div className="max-w-4xl">
      <Link to="/quotes" className="cc-eyebrow inline-block">
        ← Quotes
      </Link>

      <header className="cc-page-head mt-3">
        <div className="min-w-0">
          <h1 className="cc-page-title">{quote.number}</h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            <Link to={`/clients/${quote.clientId}`} className="hover:underline">
              {quote.clientName}
            </Link>
            {quote.projectId && quote.projectTitle && (
              <>
                <span className="mx-2" style={{ color: 'var(--text-dim)' }}>·</span>
                <Link to={`/projects/${quote.projectId}`} className="hover:underline">
                  {quote.projectTitle}
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <QuoteStatusPill status={quote.status} />
          <StatusActions quote={quote} />
          <ObsidianLink file={`Quotes/${quote.number}`} />
          <Link to={`/quotes/${quote.id}/print`} className="cc-btn-ghost" target="_blank">
            Print / PDF
          </Link>
          <button type="button" className="cc-btn-danger" onClick={handleDelete}>
            Delete
          </button>
        </div>
      </header>

      <DetailsBlock quote={quote} clients={clients} projects={projects} locked={locked} />
      <LineItems quote={quote} locked={locked} />
      <Totals quote={quote} locked={locked} />
      <TermsBlock quote={quote} locked={locked} />
    </div>
  );
}

function StatusActions({ quote }: { quote: Quote }) {
  switch (quote.status) {
    case 'draft':
      return (
        <button
          type="button"
          className="cc-btn-ghost"
          onClick={() => transitionQuoteStatus(quote.id, 'sent')}
        >
          Mark as sent
        </button>
      );
    case 'sent':
      return (
        <>
          <button
            type="button"
            className="cc-btn-ghost"
            onClick={() => transitionQuoteStatus(quote.id, 'accepted')}
          >
            Mark accepted
          </button>
          <button
            type="button"
            className="cc-btn-ghost"
            onClick={() => transitionQuoteStatus(quote.id, 'declined')}
          >
            Mark declined
          </button>
          <button
            type="button"
            className="cc-btn-ghost"
            onClick={() => transitionQuoteStatus(quote.id, 'draft')}
          >
            Revert to draft
          </button>
        </>
      );
    default:
      return (
        <button
          type="button"
          className="cc-btn-ghost"
          onClick={() => transitionQuoteStatus(quote.id, 'draft')}
        >
          Revert to draft
        </button>
      );
  }
}

function DetailsBlock({
  quote,
  clients,
  projects,
  locked,
}: {
  quote: Quote;
  clients: Client[];
  projects: Project[];
  locked: boolean;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <DetailsForm
        quote={quote}
        clients={clients}
        projects={projects}
        onCancel={() => setEditing(false)}
        onSaved={() => setEditing(false)}
      />
    );
  }

  return (
    <section className="mt-3 mb-8">
      <div className="cc-card grid gap-4 p-6 md:grid-cols-2">
        <Field label="Issue date">{formatISODate(quote.issueDate)}</Field>
        <Field label="Valid until">{formatISODate(quote.validUntil)}</Field>
        <div className="md:col-span-2">
          <p className="cc-eyebrow mb-1">Intro</p>
          {quote.introNote ? (
            <p className="whitespace-pre-wrap text-sm" style={{ color: 'var(--text-muted)' }}>
              {quote.introNote}
            </p>
          ) : (
            <p className="text-sm" style={{ color: 'var(--text-dim)' }}>—</p>
          )}
        </div>
        {!locked && (
          <div className="md:col-span-2">
            <button type="button" className="cc-btn-ghost" onClick={() => setEditing(true)}>
              Edit details
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="cc-eyebrow mb-1">{label}</p>
      <p className="text-sm" style={{ color: 'var(--text)' }}>{children}</p>
    </div>
  );
}

function DetailsForm({
  quote,
  clients,
  projects,
  onCancel,
  onSaved,
}: {
  quote: Quote;
  clients: Client[];
  projects: Project[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [clientId, setClientId] = useState(quote.clientId);
  const [projectId, setProjectId] = useState(quote.projectId ?? '');
  const [issueDate, setIssueDate] = useState(quote.issueDate);
  const [validUntil, setValidUntil] = useState(quote.validUntil ?? '');
  const [introNote, setIntroNote] = useState(quote.introNote ?? '');
  const [busy, setBusy] = useState(false);

  const clientProjects = projects.filter((p) => p.clientId === clientId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const client = clients.find((c) => c.id === clientId);
    if (!client) return;
    const project = projectId ? projects.find((p) => p.id === projectId) : undefined;
    setBusy(true);
    try {
      await updateQuoteFields(quote.id, {
        clientId: client.id,
        clientName: client.name,
        projectId: project?.id,
        projectTitle: project?.title,
        issueDate,
        validUntil: validUntil || undefined,
        introNote,
      });
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="cc-card mt-3 mb-8 space-y-4 p-6">
      <div className="grid gap-4 md:grid-cols-2">
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
        <label className="block">
          <span className="cc-eyebrow mb-2 block">Issue date</span>
          <input
            type="date"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
            className="cc-input"
          />
        </label>
        <label className="block">
          <span className="cc-eyebrow mb-2 block">Valid until</span>
          <input
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            className="cc-input"
          />
        </label>
      </div>
      <label className="block">
        <span className="cc-eyebrow mb-2 block">Intro</span>
        <textarea
          value={introNote}
          onChange={(e) => setIntroNote(e.target.value)}
          className="cc-textarea"
          placeholder="A short paragraph above the line items. e.g. Thanks for the conversation last week — here's a quote for the work we discussed."
        />
      </label>
      <div className="flex gap-2">
        <button type="submit" className="cc-btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="cc-btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function LineItems({ quote, locked }: { quote: Quote; locked: boolean }) {
  function update(id: string, patch: Partial<QuoteLineItem>) {
    const next = (quote.lineItems ?? []).map((li) =>
      li.id === id ? { ...li, ...patch } : li,
    );
    updateQuoteFields(quote.id, { lineItems: next });
  }
  function remove(id: string) {
    if (!confirm('Remove this line?')) return;
    updateQuoteFields(quote.id, {
      lineItems: (quote.lineItems ?? []).filter((li) => li.id !== id),
    });
  }
  function add() {
    updateQuoteFields(quote.id, {
      lineItems: [...(quote.lineItems ?? []), newLineItem()],
    });
  }

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-end justify-between">
        <h2 className="cc-display text-xl">Line items</h2>
        {!locked && (
          <button type="button" className="cc-btn-ghost" onClick={add}>
            Add line
          </button>
        )}
      </div>

      {(quote.lineItems ?? []).length === 0 ? (
        <div className="cc-empty">
          {locked ? 'No line items.' : 'No line items yet. Click "Add line" to start.'}
        </div>
      ) : (
        <div className="cc-card overflow-hidden">
          <table className="cc-lines">
            <thead>
              <tr>
                <th>Description</th>
                <th className="is-num" style={{ width: '6rem' }}>Qty</th>
                <th style={{ width: '6rem' }}>Unit</th>
                <th className="is-num" style={{ width: '8rem' }}>Unit price</th>
                <th className="is-num" style={{ width: '8rem' }}>Total</th>
                {!locked && <th></th>}
              </tr>
            </thead>
            <tbody>
              {(quote.lineItems ?? []).map((li) => {
                const lineTotal = (li.quantity || 0) * (li.unitPrice || 0);
                return (
                  <tr key={li.id}>
                    <td>
                      <input
                        type="text"
                        className="cc-line-input"
                        value={li.description}
                        onChange={(e) => update(li.id, { description: e.target.value })}
                        disabled={locked}
                        placeholder="What is it?"
                      />
                    </td>
                    <td className="is-num">
                      <input
                        type="number"
                        step="0.01"
                        className="cc-line-input is-num"
                        value={li.quantity}
                        onChange={(e) =>
                          update(li.id, { quantity: Number(e.target.value) || 0 })
                        }
                        disabled={locked}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className="cc-line-input"
                        value={li.unit ?? ''}
                        onChange={(e) => update(li.id, { unit: e.target.value })}
                        disabled={locked}
                        placeholder="hours"
                      />
                    </td>
                    <td className="is-num">
                      <input
                        type="number"
                        step="0.01"
                        className="cc-line-input is-num"
                        value={li.unitPrice}
                        onChange={(e) =>
                          update(li.id, { unitPrice: Number(e.target.value) || 0 })
                        }
                        disabled={locked}
                      />
                    </td>
                    <td className="is-num" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {GBP.format(lineTotal)}
                    </td>
                    {!locked && (
                      <td>
                        <button
                          type="button"
                          className="cc-btn-danger"
                          onClick={() => remove(li.id)}
                          style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem' }}
                        >
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Totals({ quote, locked }: { quote: Quote; locked: boolean }) {
  const { subtotal, vat, total } = quoteTotals(quote);

  return (
    <section className="mb-8">
      <div className="cc-card p-6">
        <div className="cc-totals">
          <div className="cc-totals-row">
            <span>Subtotal</span>
            <span>{GBP.format(subtotal)}</span>
          </div>
          <div className="cc-totals-row">
            <span>
              VAT{' '}
              <input
                type="number"
                step="0.01"
                value={quote.vatRate}
                disabled={locked}
                onChange={(e) =>
                  updateQuoteFields(quote.id, { vatRate: Number(e.target.value) || 0 })
                }
                className="cc-line-input"
                style={{
                  width: '4.5rem',
                  display: 'inline-block',
                  marginLeft: '0.5rem',
                  textAlign: 'right',
                }}
              />
              <span style={{ marginLeft: '0.25rem' }}>%</span>
            </span>
            <span>{GBP.format(vat)}</span>
          </div>
          <div className="cc-totals-row is-total">
            <span>Total</span>
            <span>{GBP.format(total)}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function TermsBlock({ quote, locked }: { quote: Quote; locked: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(quote.termsNote ?? '');

  useEffect(() => setDraft(quote.termsNote ?? ''), [quote.termsNote]);

  async function save() {
    await updateQuoteFields(quote.id, { termsNote: draft });
    setEditing(false);
  }

  if (editing && !locked) {
    return (
      <section className="mb-8">
        <div className="cc-card p-6">
          <p className="cc-eyebrow mb-2">Terms / notes</p>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="cc-textarea"
            placeholder="Payment terms, scope notes, anything else that should appear on the quote."
          />
          <div className="mt-3 flex gap-2">
            <button type="button" className="cc-btn-primary" onClick={save}>
              Save
            </button>
            <button
              type="button"
              className="cc-btn-ghost"
              onClick={() => {
                setDraft(quote.termsNote ?? '');
                setEditing(false);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-8">
      <div className="cc-card p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="cc-eyebrow mb-2">Terms / notes</p>
            {quote.termsNote ? (
              <p className="whitespace-pre-wrap text-sm" style={{ color: 'var(--text-muted)' }}>
                {quote.termsNote}
              </p>
            ) : (
              <p className="text-sm" style={{ color: 'var(--text-dim)' }}>—</p>
            )}
          </div>
          {!locked && (
            <button type="button" className="cc-btn-ghost shrink-0" onClick={() => setEditing(true)}>
              Edit
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
