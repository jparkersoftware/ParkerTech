import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GBP,
  watchExpensesForClient,
  watchExpensesForProject,
} from '../lib/expenses';
import type { Expense } from '../lib/types';
import ExpenseCategoryPill from './ExpenseCategoryPill';

export default function ExpensesFeed({
  scope,
  id,
}: {
  scope: 'client' | 'project';
  id: string;
}) {
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    return scope === 'client'
      ? watchExpensesForClient(id, setExpenses)
      : watchExpensesForProject(id, setExpenses);
  }, [scope, id]);

  if (expenses === null) {
    return <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Loading…</p>;
  }
  if (expenses.length === 0) {
    return (
      <p className="cc-empty-inline">
        <span style={{ color: 'var(--text-dim)' }}>—</span> No expenses logged yet.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {expenses.map((expense) => (
        <li key={expense.id}>
          <button
            type="button"
            onClick={() => navigate(`/expenses/${expense.id}`)}
            className="cc-card flex w-full items-center justify-between gap-3 p-4 text-left transition hover:bg-[var(--surface-hover)]"
          >
            <div className="min-w-0">
              <p className="font-medium truncate">{expense.description || '—'}</p>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                {expense.date}
                {expense.vendor ? ` · ${expense.vendor}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                {GBP.format(expense.amount)}
              </span>
              <ExpenseCategoryPill category={expense.category} />
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
