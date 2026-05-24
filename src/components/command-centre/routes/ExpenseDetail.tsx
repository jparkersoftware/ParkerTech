import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { watchClients } from '../lib/clients';
import { watchProjects } from '../lib/projects';
import {
  GBP,
  deleteExpense,
  deleteExpenseAttachment,
  updateExpense,
  uploadExpenseAttachment,
  watchExpense,
} from '../lib/expenses';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABEL,
  type Client,
  type Expense,
  type ExpenseAttachment,
  type ExpenseCategory,
  type Project,
} from '../lib/types';
import Icon from '../components/Icon';
import ObsidianLink from '../components/ObsidianLink';
import { entitySlug } from '../lib/vaultMarkdown';

export default function ExpenseDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [expense, setExpense] = useState<Expense | null | undefined>(undefined);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => watchExpense(id, setExpense), [id]);
  useEffect(() => watchClients(setClients), []);
  useEffect(() => watchProjects(setProjects), []);

  if (expense === undefined) {
    return <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Loading…</p>;
  }
  if (expense === null) {
    return (
      <div>
        <Link to="/expenses" className="cc-eyebrow inline-block">
          ← Expenses
        </Link>
        <p className="mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>
          This expense doesn't exist (or has been deleted).
        </p>
      </div>
    );
  }

  async function handleDelete() {
    if (!confirm('Delete this expense and all attachments? This can\'t be undone.')) return;
    await deleteExpense(expense!.id);
    navigate('/expenses');
  }

  // Path used by the Obsidian deep link — must match vaultMarkdown.expenseFile.
  const vendorSlug = entitySlug(expense.vendor ?? 'expense');
  const id6 = expense.id.slice(0, 6);
  const obsidianFile = `Expenses/${expense.date}-${vendorSlug}-${id6}`;

  return (
    <div className="max-w-3xl">
      <Link to="/expenses" className="cc-eyebrow inline-block">
        ← Expenses
      </Link>

      <header className="cc-page-head mt-3">
        <div className="min-w-0">
          <h1 className="cc-page-title">{expense.description || 'Untitled expense'}</h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            {expense.date} · {GBP.format(expense.amount)}
            {expense.vendor ? ` · ${expense.vendor}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ObsidianLink file={obsidianFile} />
        </div>
      </header>

      {/* Mobile-first: file picker is the first thing on the page so phone
          users can hit it before scrolling. */}
      <AttachmentsSection expense={expense} />

      <EditForm expense={expense} clients={clients} projects={projects} />

      <section className="mb-8">
        <div className="cc-card p-6">
          <button type="button" className="cc-btn-danger" onClick={handleDelete}>
            Delete expense
          </button>
        </div>
      </section>
    </div>
  );
}

// ── Attachments ──────────────────────────────────────────────────

function AttachmentsSection({ expense }: { expense: Expense }) {
  const [uploading, setUploading] = useState<string[]>([]);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function handleFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    setUploading((u) => [...u, ...list.map((f) => f.name)]);
    try {
      for (const file of list) {
        await uploadExpenseAttachment(expense.id, file);
      }
    } finally {
      setUploading((u) => u.filter((n) => !list.find((f) => f.name === n)));
    }
  }

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files) void handleFiles(e.target.files);
    e.target.value = '';
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDrag(false);
    if (e.dataTransfer.files?.length) void handleFiles(e.dataTransfer.files);
  }

  return (
    <section className="mt-3 mb-8">
      <div className="cc-card p-6">
        <p className="cc-eyebrow mb-3">Receipts &amp; attachments</p>

        {(expense.attachments?.length ?? 0) === 0 && uploading.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-dim)' }}>
            No attachments yet. Add a receipt below.
          </p>
        ) : (
          <div className="cc-attach-strip">
            {(expense.attachments ?? []).map((att) => (
              <AttachmentTile
                key={att.id}
                expenseId={expense.id}
                attachment={att}
              />
            ))}
            {uploading.map((name) => (
              <div key={`up-${name}`} className="cc-attach-tile">
                <div className="cc-attach-file">Uploading…</div>
                <div className="cc-attach-meta" title={name}>
                  {name}
                </div>
              </div>
            ))}
          </div>
        )}

        <label
          className={`cc-attach-dropzone${drag ? ' is-drag' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            onChange={onPick}
          />
          <span>
            Drop receipts here, or <strong>tap to choose a file</strong> (images
            or PDFs)
          </span>
        </label>
      </div>
    </section>
  );
}

function AttachmentTile({
  expenseId,
  attachment,
}: {
  expenseId: string;
  attachment: ExpenseAttachment;
}) {
  const isImage = attachment.contentType.startsWith('image/');
  const sizeKb = Math.max(1, Math.round(attachment.sizeBytes / 1024));
  const title = `${attachment.fileName} · ${sizeKb} KB · ${attachment.contentType}`;

  async function onDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete attachment "${attachment.fileName}"?`)) return;
    await deleteExpenseAttachment(expenseId, attachment.id);
  }

  return (
    <div className="cc-attach-tile" title={title}>
      <button
        type="button"
        className="cc-attach-delete"
        onClick={onDelete}
        aria-label={`Delete ${attachment.fileName}`}
      >
        ×
      </button>
      <a href={attachment.downloadUrl} target="_blank" rel="noreferrer">
        {isImage ? (
          <img src={attachment.downloadUrl} alt={attachment.fileName} />
        ) : (
          <div className="cc-attach-file">PDF</div>
        )}
      </a>
      <div className="cc-attach-meta" title={attachment.fileName}>
        {attachment.fileName}
      </div>
    </div>
  );
}

// ── Edit form ────────────────────────────────────────────────────

function EditForm({
  expense,
  clients,
  projects,
}: {
  expense: Expense;
  clients: Client[];
  projects: Project[];
}) {
  const [date, setDate] = useState(expense.date);
  const [description, setDescription] = useState(expense.description);
  const [amount, setAmount] = useState(String(expense.amount ?? ''));
  const [vatAmount, setVatAmount] = useState(
    expense.vatAmount !== undefined ? String(expense.vatAmount) : '',
  );
  const [category, setCategory] = useState<ExpenseCategory>(expense.category);
  const [vendor, setVendor] = useState(expense.vendor ?? '');
  const [clientId, setClientId] = useState(expense.clientId ?? '');
  const [projectId, setProjectId] = useState(expense.projectId ?? '');
  const [billable, setBillable] = useState(expense.billable);
  const [notes, setNotes] = useState(expense.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  // Keep state in sync if the underlying doc changes from elsewhere
  // (e.g. an MCP write while this page is open).
  useEffect(() => {
    setDate(expense.date);
    setDescription(expense.description);
    setAmount(String(expense.amount ?? ''));
    setVatAmount(
      expense.vatAmount !== undefined ? String(expense.vatAmount) : '',
    );
    setCategory(expense.category);
    setVendor(expense.vendor ?? '');
    setClientId(expense.clientId ?? '');
    setProjectId(expense.projectId ?? '');
    setBillable(expense.billable);
    setNotes(expense.notes ?? '');
  }, [expense]);

  const clientProjects = projects.filter((p) => p.clientId === clientId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const client = clientId ? clients.find((c) => c.id === clientId) : undefined;
    const project = projectId ? projects.find((p) => p.id === projectId) : undefined;
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount)) return;
    const numericVat = vatAmount === '' ? undefined : Number(vatAmount);
    setBusy(true);
    try {
      await updateExpense(expense.id, {
        date,
        description: description.trim(),
        amount: numericAmount,
        vatAmount: numericVat !== undefined && Number.isFinite(numericVat)
          ? numericVat
          : undefined,
        category,
        vendor: vendor.trim() || undefined,
        clientId: client?.id,
        clientName: client?.name,
        projectId: project?.id,
        projectTitle: project?.title,
        billable,
        notes: notes.trim() || undefined,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="cc-card mb-8 space-y-4 p-6">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="cc-eyebrow mb-2 block">Date</span>
          <input
            type="date"
            className="cc-input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </label>
        <label className="block">
          <span className="cc-eyebrow mb-2 block">Category</span>
          <select
            className="cc-input"
            value={category}
            onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
          >
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {EXPENSE_CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="block md:col-span-2">
          <span className="cc-eyebrow mb-2 block">Description</span>
          <input
            type="text"
            className="cc-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </label>
        <label className="block">
          <span className="cc-eyebrow mb-2 block">Amount (£)</span>
          <input
            type="number"
            step="0.01"
            inputMode="decimal"
            className="cc-input"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </label>
        <label className="block">
          <span className="cc-eyebrow mb-2 block">VAT amount (£, optional)</span>
          <input
            type="number"
            step="0.01"
            inputMode="decimal"
            className="cc-input"
            value={vatAmount}
            onChange={(e) => setVatAmount(e.target.value)}
            placeholder="e.g. 4.20"
          />
        </label>
        <label className="block">
          <span className="cc-eyebrow mb-2 block">Vendor</span>
          <input
            type="text"
            className="cc-input"
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            placeholder="Trainline"
          />
        </label>
        <label className="block">
          <span className="cc-eyebrow mb-2 block">Billable</span>
          <label className="flex items-center gap-2" style={{ paddingTop: '0.6rem' }}>
            <input
              type="checkbox"
              className="cc-checkbox"
              checked={billable}
              onChange={(e) => setBillable(e.target.checked)}
            />
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Rebill to client
            </span>
          </label>
        </label>
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
        <label className="block md:col-span-2">
          <span className="cc-eyebrow mb-2 block">Notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="cc-textarea"
            placeholder="Anything extra worth knowing about this expense"
          />
        </label>
      </div>
      <div className="flex items-center gap-2">
        <button type="submit" className="cc-btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save changes'}
        </button>
        {saved && (
          <span className="cc-toast-inline">
            <Icon name="check" /> Saved
          </span>
        )}
      </div>
    </form>
  );
}
