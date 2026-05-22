import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { watchClients } from '../lib/clients';
import { watchProjects } from '../lib/projects';
import { watchCorrespondence } from '../lib/correspondence';
import { GBP, watchQuotes, quoteTotals } from '../lib/quotes';
import { createInboxItem } from '../lib/inbox';
import {
  formatLastContact,
  staleRelationships,
  type RelationshipStatus,
} from '../lib/relationships';
import type {
  Client,
  Correspondence,
  Project,
  Quote,
  Task,
} from '../lib/types';
import StatusPill from '../components/StatusPill';
import { formatISODate } from './Projects';

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

  useEffect(() => watchProjects(setProjects), []);
  useEffect(() => watchClients(setClients), []);
  useEffect(() => watchCorrespondence(setCorrespondence), []);
  useEffect(() => watchQuotes(setQuotes), []);

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
          <p className="cc-eyebrow">Today · {formatTodayLong()}</p>
          <h1 className="cc-page-title mt-2">Dashboard</h1>
        </div>
      </header>

      <QuickCapture />

      {empty ? (
        <div className="cc-empty">
          Nothing here yet — add a client and a project to get started.
        </div>
      ) : (
        <>
          <FocusSection items={focus} />

          <StatRow
            clients={clients.length}
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
  clients,
  activeProjects,
  openTasks,
  overdueTasks,
  pipeline,
}: {
  clients: number;
  activeProjects: number;
  openTasks: number;
  overdueTasks: number;
  pipeline: { outstanding: number; acceptedThisMonth: number };
}) {
  return (
    <div className="mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <Stat icon="users" label="Clients" value={clients} />
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
        tone="accent"
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
  return (
    <div className={`cc-stat cc-stat-v2 ${tone === 'danger' ? 'is-danger' : ''} ${tone === 'accent' ? 'is-accent' : ''}`}>
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
              <span className={`cc-due-date cc-badge-${stripe}`}>
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
            <span className="cc-due-date">{formatRelativeDate(a.date)}</span>
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
    .filter((p) => p.status === 'active')
    .sort((a, b) => a.title.localeCompare(b.title));

  const upcomingTargets = projects
    .filter(
      (p) =>
        p.targetDate &&
        p.targetDate >= today &&
        (p.status === 'active' || p.status === 'discovery'),
    )
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

function formatRelativeDate(iso?: string): string {
  if (!iso) return '—';
  const today = isoToday();
  if (iso === today) return 'today';
  if (iso === isoOffset(1)) return 'tomorrow';
  if (iso === isoOffset(-1)) return 'yesterday';
  const days = daysBetween(iso, today);
  if (iso < today) {
    if (days < 7) return `${days}d ago`;
    return formatISODate(iso);
  }
  const ahead = daysBetween(today, iso);
  if (ahead < 7) return `in ${ahead}d`;
  return formatISODate(iso);
}

function formatTodayLong(): string {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

// ── Icons ────────────────────────────────────────────────────────

type IconName =
  | 'calendar'
  | 'briefcase'
  | 'users'
  | 'activity'
  | 'target'
  | 'flame'
  | 'plus'
  | 'check'
  | 'alert'
  | 'pound'
  | 'message';

const ICON_PATHS: Record<IconName, string> = {
  calendar:
    '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  briefcase:
    '<rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  users:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  target:
    '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  flame:
    '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  alert:
    '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
  pound:
    '<path d="M18 7c0-5.333-8-5.333-8 0"/><path d="M10 7v12"/><path d="M6 13h8"/><path d="M6 21h12"/>',
  message:
    '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
};

function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="16"
      height="16"
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }}
    />
  );
}
