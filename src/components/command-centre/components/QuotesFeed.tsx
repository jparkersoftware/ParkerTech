import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GBP,
  quoteTotals,
  watchQuotesForClient,
  watchQuotesForProject,
} from '../lib/quotes';
import type { Quote } from '../lib/types';
import QuoteStatusPill from './QuoteStatusPill';

export default function QuotesFeed({
  scope,
  id,
}: {
  scope: 'client' | 'project';
  id: string;
}) {
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    return scope === 'client'
      ? watchQuotesForClient(id, setQuotes)
      : watchQuotesForProject(id, setQuotes);
  }, [scope, id]);

  if (quotes === null) {
    return <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Loading…</p>;
  }
  if (quotes.length === 0) {
    return (
      <p className="cc-empty-inline">
        <span style={{ color: 'var(--text-dim)' }}>—</span> No quotes yet.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {quotes.map((q) => {
        const { total } = quoteTotals(q);
        return (
          <li key={q.id}>
            <button
              type="button"
              onClick={() => navigate(`/quotes/${q.id}`)}
              className="cc-card flex w-full items-center justify-between gap-3 p-4 text-left transition hover:bg-[var(--surface-hover)]"
            >
              <div className="min-w-0">
                <p className="font-medium">{q.number}</p>
                {q.projectTitle && (
                  <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                    {q.projectTitle}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {GBP.format(total)}
                </span>
                <QuoteStatusPill status={q.status} />
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
