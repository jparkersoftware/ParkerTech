import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { watchClients } from '../lib/clients';
import { watchProjects } from '../lib/projects';
import { watchCorrespondence } from '../lib/correspondence';
import { GBP, watchQuotes, quoteTotals } from '../lib/quotes';
import { watchInvoices, invoiceTotals } from '../lib/invoices';
import { createInboxItem } from '../lib/inbox';
import TriageStrip from '../components/TriageStrip';
import { VaultDailyCard } from '../components/VaultPanels';
import {
  formatLastContact,
  staleRelationships,
  type RelationshipStatus,
} from '../lib/relationships';
import {
  normaliseProjectStatus,
  type Client,
  type Correspondence,
  type Invoice,
  type Project,
  type Quote,
  type Task,
} from '../lib/types';
import StatusPill from '../components/StatusPill';
import Icon, { type IconName } from '../components/Icon';
import { formatISODate } from './Projects';
import { formatRelativeDate, fullTimestamp } from '../lib/dateFormat';

type DueTask = Task & {
  projectId: string;
  projectTitle: string;
  clientName: string;
};

type FocusItem =
  | { kind: 'overdue'; task: DueTask; daysOverdue: number }
  | { kind: 'today'; task: DueTask }
  | { kind: 'stale'; rel: RelationshipStatus };

type ActivityItem = {
  date: string;
  kind: 'task-done' | 'correspondence' | 'quote-sent' | 'quote-accepted';
  title: string;
  detail: string;
  route: string;
};

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [correspondence, setCorrespondence] = useState<Correspondence[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  useEffect(() => watchProjects(setProjects), []);
  useEffect(() => watchClients(setClients), []);
  useEffect(() => watchCorrespondence(setCorrespondence), []);
  useEffect(() => watchQuotes(setQuotes), []);
  useEffect(() => watchInvoices(setInvoices), []);

  const derived = useMemo(() => derive(projects ?? []), [projects]);
  const stale = useMemo(
    () => staleRelationships(clients, correspondence),
    [clients, correspondence],
  );
  const focus = useMemo(
    () => buildFocus(derived.overdue, derived.dueToday, stale),
    [derived.overdue, derived.dueToday, stale],
  );
  const pipeline = useMemo(() => computePipeline(quotes), [quotes]);
  const owed = useMemo(() => computeOwed(invoices), [invoices]);
  const activity = useMemo(
    () => recentActivity(projects ?? [], correspondence, quotes),
    [projects, correspondence, quotes],
  );

  if (projects === null) {
    return (
      <p className="text-sm" style={{ color: 'var(--text-dim)' }}>
        Loading…
      </p>
    );
  }

  const empty = projects.length === 0 && clients.length === 0;

  return (
    <div>
      <header className="cc-page-head">
        <div>
          <p className="cc-eyebrow">{formatTodayLong()}</p>
          <h1 className="cc-page-title mt-2">{greeting()}</h1>
          <p className="cc-today-summary">
            {summaryLine(derived.overdue.length, derived.dueToday.length, owed.outstanding)}
          </p>
        </div>
      </header>

      <QuickCapture />

      {empty ? (
        <div className="cc-empty">
          Nothing here yet — add a client and a project to get started.
        </div>
      ) : (
        <>
          <TriageStrip clients={clients} />

          <FocusSection items={focus} />

          <StatRow
            owed={owed}
            activeProjects={derived.activeProjects.length}
            openTasks={derived.openTaskCount}
            overdueTasks={derived.overdue.length}
            pipeline={pipeline}
          />

          {derived.activeProjects.length > 0 && (
            <Section title="Active projects" icon="briefcase">
              <ProjectGrid projects={derived.activeProjects} />
            </Section>
          )}

          <div className="grid gap-8 lg:grid-cols-2">
            <Section title="Due this week" icon="calendar">
              {derived.dueSoon.length === 0 ? (
                <InlineEmpty text="Nothing due in the next 7 days." />
              ) : (
                <TaskList tasks={derived.dueSoon} />
              )}
            </Section>

            {stale.length > 0 && (
              <Section title="Stale relationships" icon="users">
                <StaleList rows={stale} />
              </Section>
            )}
          </div>

          {derived.upcomingTargets.length > 0 && (
            <Section title="Upcoming targets" icon="target">
              <UpcomingList projects={derived.upcomingTargets} />
            </Section>
          )}

          {activity.length > 0 && (
            <Section title="Recent activity" icon="activity">
              <ActivityFeed items={activity} />
            </Section>
          )}

          <VaultDailyCard />
        </>
      )}
    </div>
  );
}

// ── Quick capture ────────────────────────────────────────────────

function QuickCapture() {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await createInboxItem({ text: trimmed, tags: [] });
      setText('');
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 2500);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="cc-quick-capture mb-8">
      <Icon name="plus" className="cc-quick-icon" />
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Capture an idea, observation, or follow-up…"
        className="cc-quick-input"
        disabled={busy}
      />
      <div className="cc-quick-hint">
        {savedAt ? (
          <span style={{ color: '#86efac' }}>✓ Saved to inbox</span>
        ) : (
          <span>
            Press <kbd>↵</kbd>
          </span>
        )}
      </div>
    </form>
  );
}

// ── Focus ────────────────────────────────────────────────────────

function FocusSection({ items }: { items: FocusItem[] }) {
  const navigate = useNavigate();
  const hasUrgent = items.some((i) => i.kind === 'overdue');

  if (items.length === 0) {
    return (
      <section
        className={`cc-focus-card mb-8 ${hasUrgent ? 'is-urgent' : ''}`}
        style={{ padding: '1.5rem 1.75rem' }}
      >
        <div className="cc-focus-head">
          <Icon name="flame" className="cc-focus-icon" />
          <h2 className="cc-focus-title">Focus</h2>
        </div>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          Nothing urgent. Good moment to do deep work, or chase a stale lead.
        </p>
      </section>
    );
  }

  return (
    <section className={`cc-focus-card mb-8 ${hasUrgent ? 'is-urgent' : ''}`}>
      <div className="cc-focus-head" style={{ padding: '1.25rem 1.5rem 0.75rem' }}>
        <Icon name="flame" className="cc-focus-icon" />
        <h2 className="cc-focus-title">Focus — top {items.length}</h2>
        <span className="cc-focus-sub">
          {hasUrgent ? 'Overdue first.' : 'What to clear today.'}
        </span>
      </div>
      <ul>
        {items.map((item, i) => (
          <li key={i}>
            <FocusRow
              item={item}
              onClick={() => {
                if (item.kind === 'stale') {
                  navigate(`/clients/${item.rel.clientId}`);
                } else {
                  navigate(`/projects/${item.task.projectId}`);
                }
              }}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function FocusRow({ item, onClick }: { item: FocusItem; onClick: () => void }) {
  let stripe: 'rose' | 'amber' | 'slate' = 'slate';
  let label = '';
  let title = '';
  let detail = '';
  let badge = '';

  if (item.kind === 'overdue') {
    stripe = 'rose';
    label = 'OVERDUE';
    title = item.task.title;
    detail = `${item.task.projectTitle} · ${item.task.clientName}`;
    badge = item.daysOverdue === 1 ? '1 day late' : `${item.daysOverdue} days late`;
  } else if (item.kind === 'today') {
    stripe = 'amber';
    label = 'DUE TODAY';
    title = item.task.title;
    detail = `${item.task.projectTitle} · ${item.task.clientName}`;
    badge = 'today';
  } else {
    stripe = 'slate';
    label = 'CHASE';
    title = item.rel.contact.name;
    detail = [item.rel.contact.role, item.rel.clientName].filter(Boolean).join(' · ');
    badge = formatLastContact(item.rel);
  }

  return (
    <button type="button" onClick={onClick} className={`cc-focus-row cc-stripe-${stripe}`}>
      <span className="cc-focus-row-label">{label}</span>
      <div className="cc-focus-row-body">
        <p className="cc-focus-row-title">{title}</p>
        <p className="cc-focus-row-detail">{detail}</p>
      </div>
      <span className={`cc-focus-row-badge cc-badge-${stripe}`}>{badge}</span>
    </button>
  );
}

// ── Stats ────────────────────────────────────────────────────────

function StatRow({
  owed,
  activeProjects,
  openTasks,
  overdueTasks,
  pipeline,
}: {
  owed: { outstanding: number; overdueCount: number };
  activeProjects: number;
  openTasks: number;
  overdueTasks: number;
  pipeline: { outstanding: number; acceptedThisMonth: number };
}) {
  return (
    <div className="mb-10 grid grid-cols-2 gap-3 lg:grid-cols-5">
      <Stat
        icon="pound"
        label="Owed to you"
        value={GBP.format(owed.outstanding)}
        sub={owed.overdueCount > 0 ? `${owed.overdueCount} overdue` : undefined}
        tone={owed.overdueCount > 0 ? 'danger' : owed.outstanding > 0 ? 'accent' : 'default'}
      />
      <Stat icon="briefcase" label="Active projects" value={activeProjects} />
      <Stat icon="check" label="Open tasks" value={openTasks} />
      <Stat
        icon="alert"
        label="Overdue"
        value={overdueTasks}
        tone={overdueTasks > 0 ? 'danger' : 'default'}
      />
      <Stat
        icon="pound"
        label="Pipeline"
        value={GBP.format(pipeline.outstanding)}
        sub={
          pipeline.acceptedThisMonth > 0
            ? `+${GBP.format(pipeline.acceptedThisMonth)} accepted`
            : undefined
        }
        tone={pipeline.outstanding > 0 ? 'accent' : 'default'}
      />
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  sub,
  tone = 'default',
}: {
  icon: IconName;
  label: string;
  value: number | string;
  sub?: string;
  tone?: 'default' | 'danger' | 'accent';
}) {
  const isZero = value === 0 || value === '0';
  return (
    <div
      className={`cc-stat cc-stat-v2 ${tone === 'danger' ? 'is-danger' : ''} ${tone === 'accent' ? 'is-accent' : ''}`}
      style={isZero ? { opacity: 0.6 } : undefined}
    >
      <div className="cc-stat-head">
        <Icon name={icon} className="cc-stat-icon" />
        <p className="cc-stat-label">{label}</p>
      </div>
      <p className="cc-stat-value">{value}</p>
      {sub && <p className="cc-stat-sub">{sub}</p>}
    </div>
  );
}

// ── Section wrapper ──────────────────────────────────────────────

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: IconName;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <div className="cc-section-head-v2">
        <Icon name={icon} className="cc-section-icon" />
        <h2 className="cc-section-title-v2">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function InlineEmpty({ text }: { text: string }) {
  return (
    <p className="cc-empty-inline">
      <span style={{ color: '#86efac' }}>✓</span> {text}
    </p>
  );
}

// ── Lists ────────────────────────────────────────────────────────

function TaskList({ tasks }: { tasks: DueTask[] }) {
  const navigate = useNavigate();
  return (
    <ul className="cc-card overflow-hidden p-0">
      {tasks.map((t) => {
        const stripe = isPast(t.dueDate ?? '') ? 'rose' : 'amber';
        return (
          <li key={`${t.projectId}-${t.id}`}>
            <button
              type="button"
              onClick={() => navigate(`/projects/${t.projectId}`)}
              className={`cc-due-row cc-stripe-${stripe}`}
            >
              <div className="min-w-0 flex-1">
                <p className="cc-task-title">{t.title}</p>
                <p className="cc-task-meta">
                  <span>{t.projectTitle}</span>
                  <span style={{ color: 'var(--text-dim)' }}>·</span>
                  <span style={{ color: 'var(--text-dim)' }}>{t.clientName}</span>
                  {t.priority && t.priority !== 'normal' && (
                    <span className="cc-pill">{t.priority}</span>
                  )}
                </p>
              </div>
              <span
                className={`cc-due-date cc-badge-${stripe}`}
                title={fullTimestamp(t.dueDate)}
              >
                {formatRelativeDate(t.dueDate)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function ProjectGrid({ projects }: { projects: Project[] }) {
  const navigate = useNavigate();
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {projects.map((p) => {
        const open = (p.tasks ?? []).filter((t) => !t.done).length;
        const milestones = p.milestones ?? [];
        const totalCriteria = milestones.reduce(
          (sum, m) => sum + (m.checklist?.length ?? 0),
          0,
        );
        const doneCriteria = milestones.reduce(
          (sum, m) => sum + (m.checklist?.filter((c) => c.done).length ?? 0),
          0,
        );
        const pct = totalCriteria > 0 ? Math.round((doneCriteria / totalCriteria) * 100) : null;

        return (
          <button
            key={p.id}
            type="button"
            onClick={() => navigate(`/projects/${p.id}`)}
            className="cc-card cc-stripe-violet p-5 text-left transition hover:bg-[var(--surface-hover)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">{p.title}</p>
                <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                  {p.clientName}
                </p>
              </div>
              <StatusPill status={p.status} />
            </div>
            <div className="cc-task-meta mt-3">
              <span>
                <span className="cc-pill">{open}</span> open
              </span>
              {p.targetDate && (
                <>
                  <span style={{ color: 'var(--text-dim)' }}>·</span>
                  <span>Target {formatISODate(p.targetDate)}</span>
                </>
              )}
            </div>
            {pct !== null && (
              <div className="mt-3 flex items-center gap-2">
                <div className="cc-progress flex-1">
                  <div
                    className={`cc-progress-bar ${pct === 100 ? 'is-complete' : ''}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span
                  style={{
                    fontSize: '0.78rem',
                    color: 'var(--text-dim)',
                    fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {pct}%
                </span>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function UpcomingList({ projects }: { projects: Project[] }) {
  const navigate = useNavigate();
  return (
    <ul className="cc-card overflow-hidden p-0">
      {projects.map((p) => (
        <li key={p.id}>
          <button
            type="button"
            onClick={() => navigate(`/projects/${p.id}`)}
            className="cc-due-row cc-stripe-violet"
          >
            <div className="min-w-0 flex-1">
              <p className="cc-task-title">{p.title}</p>
              <p className="cc-task-meta">
                <span>{p.clientName}</span>
                <StatusPill status={p.status} />
              </p>
            </div>
            <span className="cc-due-date">{formatISODate(p.targetDate)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function StaleList({ rows }: { rows: RelationshipStatus[] }) {
  const navigate = useNavigate();
  return (
    <ul className="cc-card overflow-hidden p-0">
      {rows.map((r) => {
        const stripe = r.daysAgo === null ? 'rose' : r.daysAgo >= 60 ? 'rose' : 'slate';
        return (
          <li key={`${r.clientId}-${r.contact.id}`}>
            <button
              type="button"
              onClick={() => navigate(`/clients/${r.clientId}`)}
              className={`cc-due-row cc-stripe-${stripe}`}
            >
              <div className="min-w-0 flex-1">
                <p className="cc-task-title">{r.contact.name}</p>
                <p className="cc-task-meta">
                  {r.contact.role && <span>{r.contact.role}</span>}
                  {r.contact.role && (
                    <span style={{ color: 'var(--text-dim)' }}>·</span>
                  )}
                  <span>{r.clientName}</span>
                </p>
              </div>
              <span className={`cc-due-date cc-badge-${stripe}`}>
                {formatLastContact(r)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function ActivityFeed({ items }: { items: ActivityItem[] }) {
  const navigate = useNavigate();
  return (
    <ul className="cc-card overflow-hidden p-0">
      {items.map((a, i) => (
        <li key={i}>
          <button
            type="button"
            onClick={() => navigate(a.route)}
            className="cc-activity-row"
          >
            <ActivityIcon kind={a.kind} />
            <div className="min-w-0 flex-1">
              <p className="cc-task-title">{a.title}</p>
              <p className="cc-task-meta">
                <span>{a.detail}</span>
              </p>
            </div>
            <span className="cc-due-date" title={fullTimestamp(a.date)}>
              {formatRelativeDate(a.date)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function ActivityIcon({ kind }: { kind: ActivityItem['kind'] }) {
  const map: Record<ActivityItem['kind'], { icon: IconName; color: string }> = {
    'task-done': { icon: 'check', color: '#86efac' },
    correspondence: { icon: 'message', color: '#a294ff' },
    'quote-sent': { icon: 'pound', color: '#fcd34d' },
    'quote-accepted': { icon: 'pound', color: '#86efac' },
  };
  const { icon, color } = map[kind];
  return (
    <span className="cc-activity-icon" style={{ color }}>
      <Icon name={icon} />
    </span>
  );
}

// ── derivations ──────────────────────────────────────────────────

function derive(projects: Project[]): {
  overdue: DueTask[];
  dueToday: DueTask[];
  dueSoon: DueTask[];
  activeProjects: Project[];
  upcomingTargets: Project[];
  openTaskCount: number;
} {
  const today = isoToday();
  const weekOut = isoOffset(7);

  const allOpenTasks: DueTask[] = projects.flatMap((p) =>
    (p.tasks ?? [])
      .filter((t) => !t.done)
      .map((t) => ({
        ...t,
        projectId: p.id,
        projectTitle: p.title,
        clientName: p.clientName,
      })),
  );

  const overdue = allOpenTasks
    .filter((t) => t.dueDate && t.dueDate < today)
    .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1));

  const dueToday = allOpenTasks
    .filter((t) => t.dueDate === today)
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));

  const dueSoon = allOpenTasks
    .filter((t) => t.dueDate && t.dueDate > today && t.dueDate <= weekOut)
    .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1));

  const activeProjects = projects
    .filter((p) => normaliseProjectStatus(p.status) === 'active')
    .sort((a, b) => a.title.localeCompare(b.title));

  const upcomingTargets = projects
    .filter((p) => {
      if (!p.targetDate || p.targetDate < today) return false;
      const s = normaliseProjectStatus(p.status);
      return s === 'active' || s === 'discovery';
    })
    .sort((a, b) => (a.targetDate! < b.targetDate! ? -1 : 1))
    .slice(0, 5);

  return {
    overdue,
    dueToday,
    dueSoon,
    activeProjects,
    upcomingTargets,
    openTaskCount: allOpenTasks.length,
  };
}

function buildFocus(
  overdue: DueTask[],
  dueToday: DueTask[],
  stale: RelationshipStatus[],
): FocusItem[] {
  const today = isoToday();
  const items: FocusItem[] = [];

  for (const t of overdue.slice(0, 5)) {
    items.push({ kind: 'overdue', task: t, daysOverdue: daysBetween(t.dueDate!, today) });
  }
  for (const t of dueToday.slice(0, 5)) {
    items.push({ kind: 'today', task: t });
  }

  if (items.length < 5) {
    const remaining = 5 - items.length;
    for (const r of stale.slice(0, remaining)) {
      items.push({ kind: 'stale', rel: r });
    }
  }

  return items.slice(0, 5);
}

function computePipeline(quotes: Quote[]): {
  outstanding: number;
  acceptedThisMonth: number;
} {
  let outstanding = 0;
  let acceptedThisMonth = 0;
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  for (const q of quotes) {
    const { total } = quoteTotals(q);
    if (q.status === 'sent') outstanding += total;
    if (q.status === 'accepted') {
      const acceptedAt = q.acceptedAt?.toDate?.();
      if (acceptedAt && acceptedAt >= monthStart) acceptedThisMonth += total;
    }
  }
  return { outstanding, acceptedThisMonth };
}

function recentActivity(
  projects: Project[],
  correspondence: Correspondence[],
  quotes: Quote[],
): ActivityItem[] {
  const sevenDaysAgo = isoOffset(-7);
  const items: ActivityItem[] = [];

  for (const p of projects) {
    for (const t of p.tasks ?? []) {
      if (!t.done || !t.completedAt?.toDate) continue;
      const completedIso = t.completedAt.toDate().toISOString().slice(0, 10);
      if (completedIso < sevenDaysAgo) continue;
      items.push({
        date: completedIso,
        kind: 'task-done',
        title: `Completed: ${t.title}`,
        detail: `${p.title} · ${p.clientName}`,
        route: `/projects/${p.id}`,
      });
    }
  }

  for (const c of correspondence) {
    if (c.date < sevenDaysAgo) continue;
    items.push({
      date: c.date,
      kind: 'correspondence',
      title: c.title,
      detail: `${c.type} · ${c.clientName}${c.projectTitle ? ` · ${c.projectTitle}` : ''}`,
      route: '/correspondence',
    });
  }

  for (const q of quotes) {
    const sentIso = q.sentAt?.toDate?.().toISOString().slice(0, 10);
    if (sentIso && sentIso >= sevenDaysAgo) {
      const { total } = quoteTotals(q);
      items.push({
        date: sentIso,
        kind: 'quote-sent',
        title: `Sent quote ${q.number}`,
        detail: `${q.clientName} · ${GBP.format(total)}`,
        route: `/quotes/${q.id}`,
      });
    }
    const acceptedIso = q.acceptedAt?.toDate?.().toISOString().slice(0, 10);
    if (acceptedIso && acceptedIso >= sevenDaysAgo) {
      const { total } = quoteTotals(q);
      items.push({
        date: acceptedIso,
        kind: 'quote-accepted',
        title: `Quote accepted: ${q.number}`,
        detail: `${q.clientName} · ${GBP.format(total)}`,
        route: `/quotes/${q.id}`,
      });
    }
  }

  return items.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 8);
}

function priorityRank(p?: string): number {
  if (p === 'high') return 0;
  if (p === 'low') return 2;
  return 1;
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(isoFrom: string, isoTo: string): number {
  const from = new Date(isoFrom).getTime();
  const to = new Date(isoTo).getTime();
  return Math.max(0, Math.floor((to - from) / 86_400_000));
}

function isPast(iso: string): boolean {
  if (!iso) return false;
  return iso < isoToday();
}

function formatTodayLong(): string {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning, Joseph';
  if (h < 18) return 'Good afternoon, Joseph';
  return 'Good evening, Joseph';
}

/** One honest sentence about the day. */
function summaryLine(overdue: number, dueToday: number, owed: number): string {
  const parts: string[] = [];
  if (overdue > 0) parts.push(`${overdue} overdue`);
  if (dueToday > 0) parts.push(`${dueToday} due today`);
  if (owed > 0) parts.push(`${GBP.format(owed)} owed to you`);
  if (parts.length === 0) return 'Nothing urgent on the books — a clear run at deep work.';
  return parts.join(' · ');
}

function computeOwed(invoices: Invoice[]): {
  outstanding: number;
  overdueCount: number;
} {
  const today = isoToday();
  let outstanding = 0;
  let overdueCount = 0;
  for (const inv of invoices) {
    if (inv.status !== 'sent') continue;
    outstanding += invoiceTotals(inv).total;
    if (inv.dueDate && inv.dueDate < today) overdueCount += 1;
  }
  return { outstanding, overdueCount };
}

