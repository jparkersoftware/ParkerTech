import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { watchClients } from '../lib/clients';
import { createProject, watchProjects } from '../lib/projects';
import { formatRelativeDate } from '../lib/dateFormat';
import {
  PROJECT_STATUSES,
  PROJECT_STATUS_LABEL,
  type Client,
  type Project,
  type ProjectStatus,
} from '../lib/types';
import StatusPill from '../components/StatusPill';

type Filter = ProjectStatus | 'all';

export default function Projects() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [adding, setAdding] = useState(false);

  useEffect(() => watchProjects(setProjects), []);
  useEffect(() => watchClients(setClients), []);

  const filtered = useMemo(() => {
    if (!projects) return null;
    if (filter === 'all') return projects;
    return projects.filter((p) => p.status === filter);
  }, [projects, filter]);

  return (
    <div>
      <header className="cc-page-head">
        <div>
          <h1 className="cc-page-title">Projects</h1>
          <p className="cc-page-head-meta">
            {projects === null
              ? 'Loading…'
              : `${projects.length} project${projects.length === 1 ? '' : 's'} · ${projects.filter((p) => p.status === 'active').length} active`}
          </p>
        </div>
        {!adding && (
          <button
            type="button"
            className="cc-btn-primary"
            disabled={clients.length === 0}
            onClick={() => setAdding(true)}
          >
            New project
          </button>
        )}
      </header>

      {clients.length === 0 && (
        <div className="cc-empty mb-6">
          Add a client first — projects belong to a client.
        </div>
      )}

      {adding && (
        <NewProjectForm
          clients={clients}
          onCancel={() => setAdding(false)}
          onCreated={() => setAdding(false)}
        />
      )}

      <FilterBar value={filter} onChange={setFilter} />

      {filtered === null ? (
        <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="cc-empty-inline">
          <span style={{ color: 'var(--text-dim)' }}>—</span>{' '}
          {filter === 'all' ? 'No projects yet.' : `No ${PROJECT_STATUS_LABEL[filter].toLowerCase()} projects.`}
        </p>
      ) : (
        <ProjectsTable projects={filtered} />
      )}
    </div>
  );
}

function FilterBar({
  value,
  onChange,
}: {
  value: Filter;
  onChange: (v: Filter) => void;
}) {
  const options: { value: Filter; label: string }[] = [
    { value: 'all', label: 'All' },
    ...PROJECT_STATUSES.map((s) => ({ value: s, label: PROJECT_STATUS_LABEL[s] })),
  ];

  return (
    <div className="mb-4 flex flex-wrap gap-2">
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

function ProjectsTable({ projects }: { projects: Project[] }) {
  const navigate = useNavigate();
  return (
    <div className="cc-card overflow-hidden">
      <table className="cc-table">
        <thead>
          <tr>
            <th>Project</th>
            <th>Client</th>
            <th>Status</th>
            <th>Target</th>
            <th>Open tasks</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => {
            const open = (p.tasks ?? []).filter((t) => !t.done).length;
            return (
              <tr
                key={p.id}
                className="cc-row"
                onClick={() => navigate(`/projects/${p.id}`)}
              >
                <td className="font-medium">{p.title}</td>
                <td style={{ color: 'var(--text-muted)' }}>{p.clientName}</td>
                <td>
                  <StatusPill status={p.status} />
                </td>
                <td
                  style={{ color: 'var(--text-dim)' }}
                  title={p.targetDate ?? ''}
                >
                  {formatISODate(p.targetDate)}
                </td>
                <td>
                  <span className="cc-pill">{open}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function NewProjectForm({
  clients,
  onCancel,
  onCreated,
}: {
  clients: Client[];
  onCancel: () => void;
  onCreated: () => void;
}) {
  const navigate = useNavigate();
  const [clientId, setClientId] = useState(clients[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const client = clients.find((c) => c.id === clientId);
    if (!client || !title.trim()) return;
    setBusy(true);
    try {
      const id = await createProject({
        clientId: client.id,
        clientName: client.name,
        title,
      });
      onCreated();
      navigate(`/projects/${id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="cc-card mb-6 grid gap-3 p-5 md:grid-cols-[1fr_1fr_auto] md:items-end">
      <label className="block">
        <span className="cc-eyebrow mb-2 block">Client</span>
        <select
          className="cc-input"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
        >
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="cc-eyebrow mb-2 block">Project title</span>
        <input
          type="text"
          autoFocus
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="cc-input"
          placeholder="e.g. Wonde-driven staff onboarding"
        />
      </label>
      <div className="flex gap-2">
        <button type="submit" className="cc-btn-primary" disabled={busy || !title.trim()}>
          {busy ? 'Creating…' : 'Create'}
        </button>
        <button type="button" className="cc-btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/**
 * @deprecated Prefer `formatRelativeDate` from `lib/dateFormat` — it produces
 * the same absolute output for dates > 7 days from today, but also gives
 * "Today" / "Yesterday" / "N days ago" for nearby dates. Kept as a thin
 * wrapper for callers that haven't migrated yet.
 */
export const formatISODate = formatRelativeDate;
