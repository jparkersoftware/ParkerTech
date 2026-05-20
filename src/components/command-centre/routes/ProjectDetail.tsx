import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  addTask,
  deleteProject,
  removeTask,
  updateProjectFields,
  updateTask,
  watchProject,
} from '../lib/projects';
import { watchClients } from '../lib/clients';
import {
  PROJECT_STATUSES,
  PROJECT_STATUS_LABEL,
  type Client,
  type Project,
  type ProjectStatus,
  type Task,
  type TaskPriority,
} from '../lib/types';
import StatusPill from '../components/StatusPill';
import { formatISODate } from './Projects';

export default function ProjectDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null | undefined>(undefined);
  const [clients, setClients] = useState<Client[]>([]);

  useEffect(() => watchProject(id, setProject), [id]);
  useEffect(() => watchClients(setClients), []);

  if (project === undefined) {
    return <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Loading…</p>;
  }
  if (project === null) {
    return (
      <div>
        <Link to="/projects" className="cc-eyebrow inline-block">
          ← Projects
        </Link>
        <p className="mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>
          This project doesn't exist (or has been deleted).
        </p>
      </div>
    );
  }

  async function handleDelete() {
    if (!confirm(`Delete project "${project!.title}"? This can't be undone.`)) return;
    await deleteProject(project!.id);
    navigate('/projects');
  }

  return (
    <div className="max-w-3xl">
      <Link to="/projects" className="cc-eyebrow inline-block">
        ← Projects
      </Link>

      <DetailsSection project={project} clients={clients} onDelete={handleDelete} />
      <TasksSection project={project} />
    </div>
  );
}

function DetailsSection({
  project,
  clients,
  onDelete,
}: {
  project: Project;
  clients: Client[];
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <DetailsForm
        project={project}
        clients={clients}
        onCancel={() => setEditing(false)}
        onSaved={() => setEditing(false)}
      />
    );
  }

  return (
    <section className="mt-3 mb-8">
      <header className="cc-page-head">
        <div className="min-w-0">
          <h1 className="cc-page-title">{project.title}</h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            <Link to={`/clients/${project.clientId}`} className="underline-offset-4 hover:underline">
              {project.clientName}
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={project.status} />
          <button type="button" className="cc-btn-ghost" onClick={() => setEditing(true)}>
            Edit details
          </button>
          <button type="button" className="cc-btn-danger" onClick={onDelete}>
            Delete project
          </button>
        </div>
      </header>

      <div className="cc-card grid gap-4 p-6 md:grid-cols-2">
        <Field label="Start date">{formatISODate(project.startDate)}</Field>
        <Field label="Target date">{formatISODate(project.targetDate)}</Field>
        <div className="md:col-span-2">
          <p className="cc-eyebrow mb-2">Brief</p>
          {project.brief ? (
            <p className="whitespace-pre-wrap text-sm" style={{ color: 'var(--text-muted)' }}>
              {project.brief}
            </p>
          ) : (
            <p className="text-sm" style={{ color: 'var(--text-dim)' }}>—</p>
          )}
        </div>
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
  project,
  clients,
  onCancel,
  onSaved,
}: {
  project: Project;
  clients: Client[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(project.title);
  const [clientId, setClientId] = useState(project.clientId);
  const [status, setStatus] = useState<ProjectStatus>(project.status);
  const [brief, setBrief] = useState(project.brief ?? '');
  const [startDate, setStartDate] = useState(project.startDate ?? '');
  const [targetDate, setTargetDate] = useState(project.targetDate ?? '');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const client = clients.find((c) => c.id === clientId);
    if (!client) return;
    setBusy(true);
    try {
      await updateProjectFields(project.id, {
        title: title.trim(),
        clientId: client.id,
        clientName: client.name,
        status,
        brief,
        startDate: startDate || undefined,
        targetDate: targetDate || undefined,
      });
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="cc-card mt-3 mb-8 space-y-4 p-6">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block md:col-span-2">
          <span className="cc-eyebrow mb-2 block">Project title</span>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="cc-input"
          />
        </label>
        <label className="block">
          <span className="cc-eyebrow mb-2 block">Client</span>
          <select className="cc-input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="cc-eyebrow mb-2 block">Status</span>
          <select
            className="cc-input"
            value={status}
            onChange={(e) => setStatus(e.target.value as ProjectStatus)}
          >
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PROJECT_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="cc-eyebrow mb-2 block">Start date</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="cc-input"
          />
        </label>
        <label className="block">
          <span className="cc-eyebrow mb-2 block">Target date</span>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="cc-input"
          />
        </label>
      </div>
      <label className="block">
        <span className="cc-eyebrow mb-2 block">Brief</span>
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          className="cc-textarea"
          placeholder="What this project is about — scope, decisions, anything worth remembering."
        />
      </label>
      <div className="flex gap-2">
        <button type="submit" className="cc-btn-primary" disabled={busy || !title.trim()}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="cc-btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function TasksSection({ project }: { project: Project }) {
  const [adding, setAdding] = useState(false);
  const tasks = useMemo(() => sortTasks(project.tasks ?? []), [project.tasks]);

  return (
    <section>
      <div className="mb-3 flex items-end justify-between">
        <h2 className="cc-display text-xl">Tasks</h2>
        {!adding && (
          <button type="button" className="cc-btn-ghost" onClick={() => setAdding(true)}>
            Add task
          </button>
        )}
      </div>

      {adding && (
        <TaskForm
          onCancel={() => setAdding(false)}
          onSubmit={async (data) => {
            await addTask(project.id, project.tasks ?? [], data);
            setAdding(false);
          }}
        />
      )}

      {tasks.length === 0 && !adding ? (
        <div className="cc-empty">No tasks yet.</div>
      ) : tasks.length > 0 ? (
        <ul className="cc-card overflow-hidden p-0">
          {tasks.map((t) => (
            <li key={t.id}>
              <TaskRow project={project} task={t} />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function TaskRow({ project, task }: { project: Project; task: Task }) {
  const [editing, setEditing] = useState(false);

  async function toggleDone() {
    await updateTask(project.id, project.tasks ?? [], task.id, { done: !task.done });
  }

  if (editing) {
    return (
      <TaskForm
        initial={task}
        onCancel={() => setEditing(false)}
        onSubmit={async (data) => {
          await updateTask(project.id, project.tasks ?? [], task.id, data);
          setEditing(false);
        }}
        onDelete={async () => {
          if (!confirm(`Remove task "${task.title}"?`)) return;
          await removeTask(project.id, project.tasks ?? [], task.id);
          setEditing(false);
        }}
      />
    );
  }

  const overdue = !task.done && task.dueDate && isPast(task.dueDate);
  return (
    <div className={`cc-task ${task.done ? 'is-done' : ''}`}>
      <input
        type="checkbox"
        className="cc-checkbox"
        checked={task.done}
        onChange={toggleDone}
        aria-label={`Toggle "${task.title}" done`}
      />
      <div className="min-w-0 flex-1">
        <p className="cc-task-title">{task.title}</p>
        {(task.dueDate || task.priority || task.notes) && (
          <div className="cc-task-meta">
            {task.dueDate && (
              <span className={overdue ? 'cc-task-overdue' : ''}>
                Due {formatISODate(task.dueDate)}
              </span>
            )}
            {task.priority && task.priority !== 'normal' && (
              <span className="cc-pill">{task.priority}</span>
            )}
            {task.notes && <span>{task.notes}</span>}
          </div>
        )}
      </div>
      <button type="button" className="cc-btn-ghost shrink-0" onClick={() => setEditing(true)}>
        Edit
      </button>
    </div>
  );
}

function TaskForm({
  initial,
  onSubmit,
  onCancel,
  onDelete,
}: {
  initial?: Task;
  onSubmit: (data: {
    title: string;
    dueDate?: string;
    priority?: TaskPriority;
    notes?: string;
  }) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? '');
  const [priority, setPriority] = useState<TaskPriority>(initial?.priority ?? 'normal');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      await onSubmit({
        title: title.trim(),
        dueDate: dueDate || undefined,
        priority,
        notes: notes.trim() || undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="cc-card mb-3 space-y-3 p-5">
      <label className="block">
        <span className="cc-eyebrow mb-2 block">Title</span>
        <input
          type="text"
          autoFocus
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="cc-input"
        />
      </label>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="cc-eyebrow mb-2 block">Due date</span>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="cc-input"
          />
        </label>
        <label className="block">
          <span className="cc-eyebrow mb-2 block">Priority</span>
          <select
            className="cc-input"
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
          </select>
        </label>
      </div>
      <label className="block">
        <span className="cc-eyebrow mb-2 block">Notes</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="cc-textarea"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="cc-btn-primary" disabled={busy || !title.trim()}>
          {busy ? 'Saving…' : initial ? 'Save' : 'Add task'}
        </button>
        <button type="button" className="cc-btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        {onDelete && (
          <button type="button" className="cc-btn-danger ml-auto" onClick={onDelete}>
            Remove task
          </button>
        )}
      </div>
    </form>
  );
}

function sortTasks(tasks: Task[]): Task[] {
  const PRIO: Record<TaskPriority, number> = { high: 0, normal: 1, low: 2 };
  return [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const pa = PRIO[a.priority ?? 'normal'];
    const pb = PRIO[b.priority ?? 'normal'];
    if (pa !== pb) return pa - pb;
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0);
  });
}

function isPast(iso: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return iso < today;
}
