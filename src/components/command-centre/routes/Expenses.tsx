import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { watchClients } from '../lib/clients';
import { watchProjects } from '../lib/projects';
import { GBP, createExpense, watchExpenses } from '../lib/expenses';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABEL,
  type Client,
  type Expense,
  type ExpenseCategory,
  type Project,
} from '../lib/types';
import ExpenseCategoryPill from '../components/ExpenseCategoryPill';
import Icon from '../components/Icon';
import { formatRelativeDate } from '../lib/dateFormat';

type CategoryFilter = 'all' | ExpenseCategory;

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthRange(month: string): { from: string; to: string } {
  // month: "YYYY-MM" → inclusive YYYY-MM-01 .. YYYY-MM-{last}
  const [y, m] = month.split('-').map(Number);
  const last = new Date(y!, m!, 0).getDate(); // day 0 of next month = last of this
  return {
    from: `${month}-01`,
    to: `${month}-${String(last).padStart(2, '0')}`,
  };
}

export default function Expenses() {
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [month, setMonth] = useState<string>(currentMonth());
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [adding, setAdding] = useState(false);

  useEffect(() => watchExpenses(setExpenses), []);
  useEffect(() => watchClients(setClients), []);
  useEffect(() => watchProjects(setProjects), []);

  const { from, to } = useMemo(() => monthRange(month), [month]);

  // 1) Apply the month filter first (it drives both the running total and
  //    the rows shown below the category filter).
  const inMonth = useMemo(() => {
    if (!expenses) return null;
    return expenses.filter((e) => e.date >= from && e.date <= to);
  }, [expenses, from, to]);

  // 2) Then apply the category filter for the table itself.
  const filtered = useMemo(() => {
    if (!inMonth) return null;
    if (category === 'all') return inMonth;
    return inMonth.filter((e) => e.category === category);
  }, [inMonth, category]);

  const monthTotal = useMemo(() => {
    if (!inMonth) return 0;
    return inMonth.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [inMonth]);

  const headerMeta = useMemo(() => {
    if (expenses === null) return 'Loading…';
    const count = inMonth?.length ?? 0;
    return `Total this month: ${GBP.format(monthTotal)} (across ${count} expense${count === 1 ? '' : 's'})`;
  }, [expenses, inMonth, monthTotal]);

  return (
    <div>
      <header className="cc-page-head">
        <div>
          <h1 className="cc-page-title">Expenses</h1>
          <p className="cc-page-head-meta">{headerMeta}</p>
        </div>
        {!adding && (
          <button
            type="button"
            className="cc-btn-primary"
            onClick={() => setAdding(true)}
          >
            New expense
          </button>
        )}
      </header>

      {adding && (
        <NewExpenseForm
          clients={clients}
          projects={projects}
          onCancel={() => setAdding(false)}
          onCreated={() => setAdding(false)}
        />
      )}

      <div className="mb-4 flex flex-wrap items-end gap-4">
        <label className="block">
          <span className="cc-eyebrow mb-2 block">Month</span>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value || currentMonth())}
            className="cc-input"
            style={{ width: '10rem' }}
          />
        </label>
        <CategoryFilterBar value={category} onChange={setCategory} />
      </div>

      {filtered === null ? (
        <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="cc-empty-inline">
          <span style={{ color: 'var(--text-dim)' }}>—</span>{' '}
          {category === 'all'
            ? 'No expenses in this month yet.'
            : `No ${EXPENSE_CATEGORY_LABEL[category].toLowerCase()} expenses in this month.`}
        </p>
      ) : (
        <ExpensesTable expenses={filtered} />
      )}
    </div>
  );
}

function CategoryFilterBar({
  value,
  onChange,
}: {
  value: CategoryFilter;
  onChange: (v: CategoryFilter) => void;
}) {
  const options: { value: CategoryFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    ...EXPENSE_CATEGORIES.map((c) => ({
      value: c as CategoryFilter,
      label: EXPENSE_CATEGORY_LABEL[c],
    })),
  ];
  return (
    <div className="flex flex-wrap gap-2">
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

function ExpensesTable({ expenses }: { expenses: Expense[] }) {
  const navigate = useNavigate();
  return (
    <div className="cc-card overflow-hidden">
      <table className="cc-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th>Vendor</th>
            <th>Category</th>
            <th>Client / project</th>
            <th style={{ textAlign: 'right' }}>Amount</th>
            <th style={{ textAlign: 'center' }} aria-label="Attachments">
              <Icon name="paperclip" />
            </th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((e) => (
            <tr
              key={e.id}
              className="cc-row"
              onClick={() => navigate(`/expenses/${e.id}`)}
            >
              <td style={{ color: 'var(--text-dim)' }} title={e.date}>
                {formatRelativeDate(e.date)}
              </td>
              <td className="font-medium">{e.description || '—'}</td>
              <td style={{ color: 'var(--text-muted)' }}>{e.vendor ?? '—'}</td>
              <td>
                <ExpenseCategoryPill category={e.category} />
              </td>
              <td style={{ color: 'var(--text-muted)' }}>
                {e.projectTitle ?? e.clientName ?? '—'}
              </td>
              <td
                style={{
                  textAlign: 'right',
                  fontVariantNumeric: 'tabular-nums',
                  fontWeight: 500,
                }}
              >
                {GBP.format(e.amount)}
              </td>
              <td
                style={{
                  textAlign: 'center',
                  color: 'var(--text-dim)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {(e.attachments?.length ?? 0) > 0 ? (
                  <span className="inline-flex items-center gap-1">
                    <Icon name="paperclip" />
                    {e.attachments!.length}
                  </span>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NewExpenseForm({
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
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('other');
  const [vendor, setVendor] = useState('');
  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [busy, setBusy] = useState(false);

  const clientProjects = projects.filter((p) => p.clientId === clientId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const numeric = Number(amount);
    if (!description.trim()) return;
    if (!Number.isFinite(numeric)) return;
    const client = clientId ? clients.find((c) => c.id === clientId) : undefined;
    const project = projectId ? projects.find((p) => p.id === projectId) : undefined;
    setBusy(true);
    try {
      const id = await createExpense({
        date,
        description: description.trim(),
        amount: numeric,
        category,
        vendor: vendor.trim() || undefined,
        clientId: client?.id,
        clientName: client?.name,
        projectId: project?.id,
        projectTitle: project?.title,
      });
      onCreated();
      navigate(`/expenses/${id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="cc-card mb-6 grid gap-3 p-5 md:grid-cols-[8rem_8rem_minmax(0,_1fr)_10rem_10rem_auto] md:items-end"
    >
      <label className="block">
        <span className="cc-eyebrow mb-2 block">Date</span>
        <input
          type="date"
          className="cc-input"
          value={date}
          onChange={(e) => setDate(e.target.value)}
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
          placeholder="0.00"
          required
        />
      </label>
      <label className="block">
        <span className="cc-eyebrow mb-2 block">Description</span>
        <input
          type="text"
          className="cc-input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What was it for?"
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
      <div className="flex gap-2">
        <button type="submit" className="cc-btn-primary" disabled={busy}>
          {busy ? 'Creating…' : 'Create'}
        </button>
        <button type="button" className="cc-btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
      <label className="block md:col-span-3">
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
      <label className="block md:col-span-3">
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
    </form>
  );
}
