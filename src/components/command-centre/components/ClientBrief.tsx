/**
 * Client brief — the call-prep answers and the one joined-up story.
 *
 * BriefStrip: last contact / open tasks / owed / pipeline, computed live
 * from the client's own records.
 *
 * ClientTimeline: every interaction with this client — correspondence,
 * quote and invoice events, expenses, completed tasks — interleaved
 * newest-first, so the relationship reads as one narrative instead of
 * five separate lists.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { watchProjectsForClient } from '../lib/projects';
import { watchCorrespondenceForClient } from '../lib/correspondence';
import { GBP, quoteTotals, watchQuotesForClient } from '../lib/quotes';
import { invoiceTotals, watchInvoicesForClient } from '../lib/invoices';
import { watchExpensesForClient } from '../lib/expenses';
import { formatRelativeDate, fullTimestamp } from '../lib/dateFormat';
import Icon, { type IconName } from './Icon';
import type {
  Correspondence,
  Expense,
  Invoice,
  Project,
  Quote,
} from '../lib/types';

type TimelineItem = {
  date: string; // ISO YYYY-MM-DD
  icon: IconName;
  color: string;
  title: string;
  detail: string;
  route: string;
};

export function useClientRecords(clientId: string) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [correspondence, setCorrespondence] = useState<Correspondence[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  useEffect(() => watchProjectsForClient(clientId, (p) => setProjects(p ?? [])), [clientId]);
  useEffect(() => watchCorrespondenceForClient(clientId, setCorrespondence), [clientId]);
  useEffect(() => watchQuotesForClient(clientId, setQuotes), [clientId]);
  useEffect(() => watchInvoicesForClient(clientId, setInvoices), [clientId]);
  useEffect(() => watchExpensesForClient(clientId, setExpenses), [clientId]);

  return { projects, correspondence, quotes, invoices, expenses };
}

export function BriefStrip({
  records,
}: {
  records: ReturnType<typeof useClientRecords>;
}) {
  const { projects, correspondence, quotes, invoices } = records;

  const brief = useMemo(() => {
    const lastContact = correspondence.reduce<string | null>(
      (max, c) => (max === null || c.date > max ? c.date : max),
      null,
    );
    const openTasks = projects.flatMap((p) => p.tasks ?? []).filter((t) => !t.done);
    const nextDue = openTasks
      .filter((t) => t.dueDate)
      .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))[0];
    let owed = 0;
    for (const inv of invoices) {
      if (inv.status === 'sent') owed += invoiceTotals(inv).total;
    }
    let pipeline = 0;
    for (const q of quotes) {
      if (q.status === 'sent') pipeline += quoteTotals(q).total;
    }
    return { lastContact, openCount: openTasks.length, nextDue, owed, pipeline };
  }, [projects, correspondence, quotes, invoices]);

  return (
    <div className="cc-brief-strip">
      <BriefCell
        label="Last contact"
        value={brief.lastContact ? formatRelativeDate(brief.lastContact) : 'never'}
        tone={staleTone(brief.lastContact)}
      />
      <BriefCell
        label="Open tasks"
        value={String(brief.openCount)}
        sub={brief.nextDue ? `next: ${formatRelativeDate(brief.nextDue.dueDate!)}` : undefined}
      />
      <BriefCell
        label="Owed"
        value={GBP.format(brief.owed)}
        tone={brief.owed > 0 ? 'accent' : undefined}
      />
      <BriefCell
        label="Quotes out"
        value={GBP.format(brief.pipeline)}
      />
    </div>
  );
}

function staleTone(lastContact: string | null): 'danger' | undefined {
  if (!lastContact) return 'danger';
  const days = (Date.now() - new Date(lastContact).getTime()) / 86_400_000;
  return days >= 30 ? 'danger' : undefined;
}

function BriefCell({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'danger' | 'accent';
}) {
  return (
    <div className={`cc-brief-cell ${tone ? `is-${tone}` : ''}`}>
      <p className="cc-brief-label">{label}</p>
      <p className="cc-brief-value">{value}</p>
      {sub && <p className="cc-brief-sub">{sub}</p>}
    </div>
  );
}

export function ClientTimeline({
  records,
}: {
  records: ReturnType<typeof useClientRecords>;
}) {
  const navigate = useNavigate();
  const items = useMemo(() => buildTimeline(records), [records]);

  if (items.length === 0) {
    return (
      <p className="cc-empty-inline">
        <span style={{ color: 'var(--text-dim)' }}>—</span> No history with
        this client yet.
      </p>
    );
  }

  return (
    <ul className="cc-timeline">
      {items.map((item, i) => (
        <li key={i} className="cc-timeline-item">
          <span className="cc-timeline-dot" style={{ color: item.color }}>
            <Icon name={item.icon} />
          </span>
          <button
            type="button"
            className="cc-timeline-body"
            onClick={() => navigate(item.route)}
          >
            <p className="cc-task-title">{item.title}</p>
            <p className="cc-task-meta">{item.detail}</p>
          </button>
          <span className="cc-due-date" title={fullTimestamp(item.date)}>
            {formatRelativeDate(item.date)}
          </span>
        </li>
      ))}
    </ul>
  );
}

const MAX_ITEMS = 30;

function buildTimeline(records: ReturnType<typeof useClientRecords>): TimelineItem[] {
  const { projects, correspondence, quotes, invoices, expenses } = records;
  const items: TimelineItem[] = [];

  for (const c of correspondence) {
    items.push({
      date: c.date,
      icon: 'message',
      color: '#a294ff',
      title: c.title,
      detail: [c.type, c.projectTitle].filter(Boolean).join(' · '),
      route: '/correspondence',
    });
  }

  for (const p of projects) {
    for (const t of p.tasks ?? []) {
      if (!t.done || !t.completedAt?.toDate) continue;
      items.push({
        date: t.completedAt.toDate().toISOString().slice(0, 10),
        icon: 'check',
        color: '#86efac',
        title: `Done: ${t.title}`,
        detail: p.title,
        route: `/projects/${p.id}`,
      });
    }
  }

  for (const q of quotes) {
    const total = GBP.format(quoteTotals(q).total);
    const sent = q.sentAt?.toDate?.();
    if (sent) {
      items.push({
        date: sent.toISOString().slice(0, 10),
        icon: 'pound',
        color: '#fcd34d',
        title: `Quote ${q.number} sent`,
        detail: total,
        route: `/quotes/${q.id}`,
      });
    }
    const accepted = q.acceptedAt?.toDate?.();
    if (accepted) {
      items.push({
        date: accepted.toISOString().slice(0, 10),
        icon: 'pound',
        color: '#86efac',
        title: `Quote ${q.number} accepted`,
        detail: total,
        route: `/quotes/${q.id}`,
      });
    }
  }

  for (const inv of invoices) {
    const total = GBP.format(invoiceTotals(inv).total);
    const sent = inv.sentAt?.toDate?.();
    if (sent) {
      items.push({
        date: sent.toISOString().slice(0, 10),
        icon: 'receipt',
        color: '#fcd34d',
        title: `Invoice ${inv.number} sent`,
        detail: total,
        route: `/invoices/${inv.id}`,
      });
    }
    const paid = inv.paidAt?.toDate?.();
    if (paid) {
      items.push({
        date: paid.toISOString().slice(0, 10),
        icon: 'receipt',
        color: '#86efac',
        title: `Invoice ${inv.number} paid`,
        detail: total,
        route: `/invoices/${inv.id}`,
      });
    }
  }

  for (const e of expenses) {
    items.push({
      date: e.date,
      icon: 'wallet',
      color: 'var(--text-dim)',
      title: e.description,
      detail: `expense · ${GBP.format(e.amount)}${e.billable ? ' · billable' : ''}`,
      route: `/expenses/${e.id}`,
    });
  }

  return items.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, MAX_ITEMS);
}
