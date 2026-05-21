import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { watchClients } from '../lib/clients';
import { watchProjects } from '../lib/projects';
import { watchCorrespondence } from '../lib/correspondence';
import {
  formatLastContact,
  staleRelationships,
  type RelationshipStatus,
} from '../lib/relationships';
import type { Client, Correspondence, Project, Task } from '../lib/types';
import StatusPill from '../components/StatusPill';
import { formatISODate } from './Projects';

type DueTask = Task & { projectId: string; projectTitle: string; clientName: string };

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [correspondence, setCorrespondence] = useState<Correspondence[]>([]);

  useEffect(() => watchProjects(setProjects), []);
  useEffect(() => watchClients(setClients), []);
  useEffect(() => watchCorrespondence(setCorrespondence), []);

  const { overdue, dueSoon, activeProjects, upcomingTargets, openTaskCount } = useMemo(
    () => derive(projects ?? []),
    [projects],
  );
  const stale = useMemo(
    () => staleRelationships(clients, correspondence),
    [clients, correspondence],
  );

  if (projects === null) {
    return <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Loading…</p>;
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

      {empty ? (
        <div className="cc-empty">
          <p>Nothing here yet — add a client and a project to get started.</p>
        </div>
      ) : (
        <>
          <StatRow
            clients={clients.length}
            activeProjects={activeProjects.length}
            openTasks={openTaskCount}
            overdueTasks={overdue.length}
          />

          {overdue.length > 0 && (
            <Section title="Overdue" tone="danger">
              <TaskList tasks={overdue} highlight="overdue" />
            </Section>
          )}

          <Section title="Due this week">
            {dueSoon.length === 0 ? (
              <div className="cc-empty">Nothing due in the next 7 days.</div>
            ) : (
              <TaskList tasks={dueSoon} />
            )}
          </Section>

          <Section title="Active projects">
            {activeProjects.length === 0 ? (
              <div className="cc-empty">No active projects right now.</div>
            ) : (
              <ProjectGrid projects={activeProjects} />
            )}
          </Section>

          {upcomingTargets.length > 0 && (
            <Section title="Upcoming targets">
              <UpcomingList projects={upcomingTargets} />
            </Section>
          )}

          {stale.length > 0 && (
            <Section title="Stale relationships">
              <StaleList rows={stale} />
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function StaleList({ rows }: { rows: RelationshipStatus[] }) {
  const navigate = useNavigate();
  return (
    <ul className="cc-card overflow-hidden p-0">
      {rows.map((r) => (
        <li key={`${r.clientId}-${r.contact.id}`}>
          <button
            type="button"
            onClick={() => navigate(`/clients/${r.clientId}`)}
            className="cc-due-row"
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
            <span
              className="cc-due-date"
              style={r.daysAgo === null ? { color: '#fda4af' } : undefined}
            >
              {formatLastContact(r)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function StatRow({
  clients,
  activeProjects,
  openTasks,
  overdueTasks,
}: {
  clients: number;
  activeProjects: number;
  openTasks: number;
  overdueTasks: number;
}) {
  return (
    <div className="mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Stat label="Clients" value={clients} />
      <Stat label="Active projects" value={activeProjects} />
      <Stat label="Open tasks" value={openTasks} />
      <Stat label="Overdue" value={overdueTasks} tone={overdueTasks > 0 ? 'danger' : 'default'} />
    </div>
  );
}

function Stat({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'default' | 'danger';
}) {
  return (
    <div className={`cc-stat ${tone === 'danger' ? 'is-danger' : ''}`}>
      <p className="cc-eyebrow">{label}</p>
      <p className="cc-stat-value">{value}</p>
    </div>
  );
}

function Section({
  title,
  tone = 'default',
  children,
}: {
  title: string;
  tone?: 'default' | 'danger';
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <h2 className={`cc-display mb-3 text-xl ${tone === 'danger' ? 'cc-section-danger' : ''}`}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function TaskList({ tasks, highlight }: { tasks: DueTask[]; highlight?: 'overdue' }) {
  const navigate = useNavigate();
  return (
    <ul className="cc-card overflow-hidden p-0">
      {tasks.map((t) => (
        <li key={`${t.projectId}-${t.id}`}>
          <button
            type="button"
            onClick={() => navigate(`/projects/${t.projectId}`)}
            className="cc-due-row"
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
              className={
                highlight === 'overdue' ? 'cc-due-date cc-task-overdue' : 'cc-due-date'
              }
            >
              {formatISODate(t.dueDate)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function ProjectGrid({ projects }: { projects: Project[] }) {
  const navigate = useNavigate();
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {projects.map((p) => {
        const open = (p.tasks ?? []).filter((t) => !t.done).length;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => navigate(`/projects/${p.id}`)}
            className="cc-card p-5 text-left transition hover:bg-[var(--surface-hover)]"
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
            className="cc-due-row"
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

function derive(projects: Project[]): {
  overdue: DueTask[];
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

  const dueSoon = allOpenTasks
    .filter((t) => t.dueDate && t.dueDate >= today && t.dueDate <= weekOut)
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
    dueSoon,
    activeProjects,
    upcomingTargets,
    openTaskCount: allOpenTasks.length,
  };
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatTodayLong(): string {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}
