import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { watchClients } from '../lib/clients';
import { watchProjects } from '../lib/projects';
import {
  GBP,
  deleteInvoice,
  invoiceTotals,
  isOverdue,
  markInvoicePaid,
  markInvoiceSent,
  newLineItem,
  revertInvoiceToDraft,
  updateInvoice,
  voidInvoice,
  watchInvoice,
} from '../lib/invoices';
import type {
  Client,
  Invoice,
  InvoiceLineItem,
  Project,
} from '../lib/types';
import InvoiceStatusPill from '../components/InvoiceStatusPill';
import ObsidianLink from '../components/ObsidianLink';
import { formatISODate } from './Invoices';
import { fullTimestamp } from '../lib/dateFormat';

export default function InvoiceDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<Invoice | null | undefined>(undefined);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => watchInvoice(id, setInvoice), [id]);
  useEffect(() => watchClients(setClients), []);
  useEffect(() => watchProjects(setProjects), []);

  if (invoice === undefined) {
    return <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Loading…</p>;
  }
  if (invoice === null) {
    return (
      <div>
        <Link to="/invoices" className="cc-eyebrow inline-block">
          ← Invoices
        </Link>
        <p className="mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>
          This invoice doesn't exist (or has been deleted).
        </p>
      </div>
    );
  }

  // Drafts are fully editable. Once sent, only certain transitions allowed.
  // Voided invoices remain editable (rare — but allowed per spec).
  const locked = invoice.status === 'sent' || invoice.status === 'paid';
  const overdue = isOverdue(invoice);

  async function handleDelete() {
    if (!confirm(`Delete ${invoice!.number}? This can't be undone.`)) return;
    await deleteInvoice(invoice!.id);
    navigate('/invoices');
  }

  return (
    <div className="max-w-4xl">
      <Link to="/invoices" className="cc-eyebrow inline-block">
        ← Invoices
      </Link>

      <header className="cc-page-head mt-3">
        <div className="min-w-0">
          <h1 className="cc-page-title">{invoice.number}</h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            {invoice.clientId && invoice.clientName ? (
              <Link to={`/clients/${invoice.clientId}`} className="hover:underline">
                {invoice.clientName}
              </Link>
            ) : (
              <span style={{ color: 'var(--text-dim)' }}>No client</span>
            )}
            {invoice.projectId && invoice.projectTitle && (
              <>
                <span className="mx-2" style={{ color: 'var(--text-dim)' }}>·</span>
                <Link to={`/projects/${invoice.projectId}`} className="hover:underline">
                  {invoice.projectTitle}
                </Link>
              </>
            )}
            {invoice.quoteId && (
              <>
                <span className="mx-2" style={{ color: 'var(--text-dim)' }}>·</span>
                <Link to={`/quotes/${invoice.quoteId}`} className="hover:underline">
                  From quote
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <InvoiceStatusPill status={invoice.status} />
          {overdue && <span className="cc-overdue-pill">Overdue</span>}
          <StatusActions invoice={invoice} />
          <ObsidianLink file={`Invoices/${invoice.number}`} />
          <Link
            to={`/invoices/${invoice.id}/print`}
            className="cc-btn-ghost"
            target="_blank"
          >
            Print / PDF
          </Link>
          <button type="button" className="cc-btn-danger" onClick={handleDelete}>
            Delete
          </button>
        </div>
      </header>

      <DetailsBlock invoice={invoice} clients={clients} projects={projects} locked={locked} />
      <LineItems invoice={invoice} locked={locked} />
      <Totals invoice={invoice} locked={locked} />
      {invoice.status === 'paid' && <PaymentDetails invoice={invoice} />}
      <TermsBlock invoice={invoice} locked={locked} />
    </div>
  );
}

function StatusActions({ invoice }: { invoice: Invoice }) {
  const [showPaid, setShowPaid] = useState(false);

  switch (invoice.status) {
    case 'draft':
      return (
        <button
          type="button"
          className="cc-btn-ghost"
          onClick={() => markInvoiceSent(invoice.id)}
        >
          Mark sent
        </button>
      );
    case 'sent':
      return (
        <>
          {!showPaid && (
            <button
              type="button"
              className="cc-btn-ghost"
              onClick={() => setShowPaid(true)}
            >
              Mark paid
            </button>
          )}
          {showPaid && (
            <MarkPaidForm
              invoice={invoice}
              onCancel={() => setShowPaid(false)}
              onDone={() => setShowPaid(false)}
            />
          )}
          <button
            type="button"
            className="cc-btn-ghost"
            onClick={() => voidInvoice(invoice.id)}
          >
            Void
          </button>
          <button
            type="button"
            className="cc-btn-ghost"
            onClick={() => revertInvoiceToDraft(invoice.id)}
          >
            Revert to draft
          </button>
        </>
      );
    case 'paid':
      return (
        <button
          type="button"
          className="cc-btn-ghost"
          onClick={() => voidInvoice(invoice.id)}
        >
          Void
        </button>
      );
    default:
      return null;
  }
}

function MarkPaidForm({
  invoice,
  onCancel,
  onDone,
}: {
  invoice: Invoice;
  onCancel: () => void;
  onDone: () => void;
}) {
  const { total } = invoiceTotals(invoice);
  const [amount, setAmount] = useState(total.toFixed(2));
  const [method, setMethod] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await markInvoicePaid(invoice.id, {
        paidAmount: Number(amount) || total,
        paymentMethod: method || undefined,
      });
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="cc-card flex flex-wrap items-end gap-2 p-3"
    >
      <label className="block">
        <span className="cc-eyebrow mb-1 block">Paid amount</span>
        <input
          type="number"
          step="0.01"
          className="cc-input"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{ width: '7rem' }}
        />
      </label>
      <label className="block">
        <span className="cc-eyebrow mb-1 block">Method</span>
        <input
          type="text"
          className="cc-input"
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          placeholder="bank transfer"
          style={{ width: '10rem' }}
        />
      </label>
      <button type="submit" className="cc-btn-primary" disabled={busy}>
        {busy ? 'Saving…' : 'Confirm paid'}
      </button>
      <button type="button" className="cc-btn-ghost" onClick={onCancel}>
        Cancel
      </button>
    </form>
  );
}

function PaymentDetails({ invoice }: { invoice: Invoice }) {
  return (
    <section className="mb-8">
      <div className="cc-card p-6">
        <p className="cc-eyebrow mb-2">Payment</p>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Paid amount">
            {invoice.paidAmount !== undefined
              ? GBP.format(invoice.paidAmount)
              : '—'}
          </Field>
          <Field label="Method">{invoice.paymentMethod ?? '—'}</Field>
          <Field label="Paid at">
            {invoice.paidAt ? fullTimestamp(invoice.paidAt) : '—'}
          </Field>
        </div>
      </div>
    </section>
  );
}

function DetailsBlock({
  invoice,
  clients,
  projects,
  locked,
}: {
  invoice: Invoice;
  clients: Client[];
  projects: Project[];
  locked: boolean;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <DetailsForm
        invoice={invoice}
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
        <Field label="Issue date">{formatISODate(invoice.issueDate)}</Field>
        <Field label="Due date">
          {invoice.dueDate ? formatISODate(invoice.dueDate) : '—'}
        </Field>
        <div className="md:col-span-2">
          <p className="cc-eyebrow mb-1">Intro</p>
          {invoice.introNote ? (
            <p
              className="whitespace-pre-wrap text-sm"
              style={{ color: 'var(--text-muted)' }}
            >
              {invoice.introNote}
            </p>
          ) : (
            <p className="text-sm" style={{ color: 'var(--text-dim)' }}>—</p>
          )}
        </div>
        {!locked && (
          <div className="md:col-span-2">
            <button
              type="button"
              className="cc-btn-ghost"
              onClick={() => setEditing(true)}
            >
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
  invoice,
  clients,
  projects,
  onCancel,
  onSaved,
}: {
  invoice: Invoice;
  clients: Client[];
  projects: Project[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [clientId, setClientId] = useState(invoice.clientId ?? '');
  const [projectId, setProjectId] = useState(invoice.projectId ?? '');
  const [issueDate, setIssueDate] = useState(invoice.issueDate);
  const [dueDate, setDueDate] = useState(invoice.dueDate ?? '');
  const [introNote, setIntroNote] = useState(invoice.introNote ?? '');
  const [busy, setBusy] = useState(false);

  const clientProjects = projects.filter((p) => p.clientId === clientId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const client = clientId ? clients.find((c) => c.id === clientId) : undefined;
    const project = projectId ? projects.find((p) => p.id === projectId) : undefined;
    setBusy(true);
    try {
      await updateInvoice(invoice.id, {
        clientId: client?.id,
        clientName: client?.name,
        projectId: project?.id,
        projectTitle: project?.title,
        issueDate,
        dueDate: dueDate || undefined,
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
          <span className="cc-eyebrow mb-2 block">Due date</span>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
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
          placeholder="A short paragraph above the line items. e.g. Thanks for the work — invoice attached."
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

function LineItems({ invoice, locked }: { invoice: Invoice; locked: boolean }) {
  function update(id: string, patch: Partial<InvoiceLineItem>) {
    const next = (invoice.lineItems ?? []).map((li) =>
      li.id === id ? { ...li, ...patch } : li,
    );
    updateInvoice(invoice.id, { lineItems: next });
  }
  function remove(id: string) {
    if (!confirm('Remove this line?')) return;
    updateInvoice(invoice.id, {
      lineItems: (invoice.lineItems ?? []).filter((li) => li.id !== id),
    });
  }
  function add() {
    updateInvoice(invoice.id, {
      lineItems: [...(invoice.lineItems ?? []), newLineItem()],
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

      {(invoice.lineItems ?? []).length === 0 ? (
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
              {(invoice.lineItems ?? []).map((li) => {
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

function Totals({ invoice, locked }: { invoice: Invoice; locked: boolean }) {
  const { subtotal, vat, total } = invoiceTotals(invoice);

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
                value={invoice.vatRate}
                disabled={locked}
                onChange={(e) =>
                  updateInvoice(invoice.id, {
                    vatRate: Number(e.target.value) || 0,
                  })
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

function TermsBlock({ invoice, locked }: { invoice: Invoice; locked: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(invoice.termsNote ?? '');

  useEffect(() => setDraft(invoice.termsNote ?? ''), [invoice.termsNote]);

  async function save() {
    await updateInvoice(invoice.id, { termsNote: draft });
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
            placeholder="Payment terms, bank details, anything else that should appear on the invoice."
          />
          <div className="mt-3 flex gap-2">
            <button type="button" className="cc-btn-primary" onClick={save}>
              Save
            </button>
            <button
              type="button"
              className="cc-btn-ghost"
              onClick={() => {
                setDraft(invoice.termsNote ?? '');
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
            {invoice.termsNote ? (
              <p
                className="whitespace-pre-wrap text-sm"
                style={{ color: 'var(--text-muted)' }}
              >
                {invoice.termsNote}
              </p>
            ) : (
              <p className="text-sm" style={{ color: 'var(--text-dim)' }}>—</p>
            )}
          </div>
          {!locked && (
            <button
              type="button"
              className="cc-btn-ghost shrink-0"
              onClick={() => setEditing(true)}
            >
              Edit
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
