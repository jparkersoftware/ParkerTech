import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  addMilestone,
  addTask,
  deleteProject,
  removeMilestone,
  removeTask,
  toggleChecklistItem,
  updateMilestone,
  updateProjectFields,
  updateTask,
  watchProject,
} from '../lib/projects';
import { watchClients } from '../lib/clients';
import {
  MILESTONE_STATUSES,
  MILESTONE_STATUS_LABEL,
  PROJECT_STATUSES,
  PROJECT_STATUS_LABEL,
  type ChecklistItem,
  type Client,
  type Milestone,
  type MilestoneStatus,
  type Project,
  type ProjectStatus,
  type Task,
  type TaskPriority,
} from '../lib/types';
import StatusPill from '../components/StatusPill';
import MilestoneStatusPill from '../components/MilestoneStatusPill';
import CorrespondenceFeed from '../components/CorrespondenceFeed';
import QuotesFeed from '../components/QuotesFeed';
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
      <RoadmapSection project={project} />
      <TasksSection project={project} />

      <section className="mt-10">
        <h2 className="cc-display mb-3 text-xl">Quotes</h2>
        <QuotesFeed scope="project" id={project.id} />
      </section>

      <section className="mt-10">
        <h2 className="cc-display mb-3 text-xl">Correspondence</h2>
        <CorrespondenceFeed scope="project" id={project.id} />
      </section>
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

function RoadmapSection({ project }: { project: Project }) {
  const [adding, setAdding] = useState(false);
  const milestones = project.milestones ?? [];

  return (
    <section className="mb-10">
      <div className="mb-3 flex items-end justify-between">
        <h2 className="cc-display text-xl">Roadmap</h2>
        {!adding && (
          <button type="button" className="cc-btn-ghost" onClick={() => setAdding(true)}>
            Add milestone
          </button>
        )}
      </div>

      {adding && (
        <MilestoneForm
          onCancel={() => setAdding(false)}
          onSubmit={async (data) => {
            await addMilestone(project.id, project.milestones ?? [], data);
            setAdding(false);
          }}
        />
      )}

      {milestones.length === 0 && !adding ? (
        <div className="cc-empty">
          No milestones yet. Break a larger project into measurable sections.
        </div>
      ) : (
        <ul className="space-y-4">
          {milestones.map((m) => (
            <li key={m.id}>
              <MilestoneCard project={project} milestone={m} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function MilestoneCard({
  project,
  milestone,
}: {
  project: Project;
  milestone: Milestone;
}) {
  const [editing, setEditing] = useState(false);
  const overdue =
    milestone.status !== 'done' &&
    milestone.status !== 'cancelled' &&
    milestone.targetDate &&
    isPast(milestone.targetDate);

  if (editing) {
    return (
      <MilestoneForm
        initial={milestone}
        onCancel={() => setEditing(false)}
        onSubmit={async (data) => {
          await updateMilestone(project.id, project.milestones ?? [], milestone.id, data);
          setEditing(false);
        }}
        onDelete={async () => {
          if (!confirm(`Remove milestone "${milestone.title}"?`)) return;
          await removeMilestone(project.id, project.milestones ?? [], milestone.id);
          setEditing(false);
        }}
      />
    );
  }

  const total = milestone.checklist.length;
  const done = milestone.checklist.filter((c) => c.done).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const complete = total > 0 && done === total;

  return (
    <div className="cc-card p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <MilestoneStatusPill status={milestone.status} />
            {milestone.targetDate && (
              <span
                className={overdue ? 'cc-task-overdue' : ''}
                style={{
                  fontSize: '0.85rem',
                  color: overdue ? undefined : 'var(--text-dim)',
                }}
              >
                Target {formatISODate(milestone.targetDate)}
              </span>
            )}
          </div>
          <h3 className="cc-display mt-2 text-lg">{milestone.title}</h3>
          {milestone.description && (
            <p
              className="mt-2 whitespace-pre-wrap text-sm"
              style={{ color: 'var(--text-muted)' }}
            >
              {milestone.description}
            </p>
          )}
        </div>
        <button type="button" className="cc-btn-ghost shrink-0" onClick={() => setEditing(true)}>
          Edit
        </button>
      </header>

      {total > 0 && (
        <>
          <ul className="mt-4 space-y-1">
            {milestone.checklist.map((item) => (
              <li key={item.id}>
                <label className={`cc-check ${item.done ? 'is-done' : ''}`}>
                  <input
                    type="checkbox"
                    className="cc-checkbox"
                    checked={item.done}
                    onChange={() =>
                      toggleChecklistItem(
                        project.id,
                        project.milestones ?? [],
                        milestone.id,
                        item.id,
                      )
                    }
                  />
                  <span className="cc-check-text">{item.text}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center gap-3">
            <div className="cc-progress flex-1">
              <div
                className={`cc-progress-bar ${complete ? 'is-complete' : ''}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span
              style={{
                fontSize: '0.85rem',
                color: 'var(--text-muted)',
                fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap',
              }}
            >
              {done}/{total} · {pct}%
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function MilestoneForm({
  initial,
  onSubmit,
  onCancel,
  onDelete,
}: {
  initial?: Milestone;
  onSubmit: (data: {
    title: string;
    description?: string;
    targetDate?: string;
    status: MilestoneStatus;
    checklist: ChecklistItem[];
  }) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [targetDate, setTargetDate] = useState(initial?.targetDate ?? '');
  const [status, setStatus] = useState<MilestoneStatus>(initial?.status ?? 'planned');
  const [checklist, setChecklist] = useState<ChecklistItem[]>(
    initial?.checklist ?? [],
  );
  const [newItemText, setNewItemText] = useState('');
  const [busy, setBusy] = useState(false);

  function addItem() {
    const text = newItemText.trim();
    if (!text) return;
    setChecklist((cs) => [...cs, { id: crypto.randomUUID(), text, done: false }]);
    setNewItemText('');
  }

  function updateItem(id: string, patch: Partial<ChecklistItem>) {
    setChecklist((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function removeItem(id: string) {
    setChecklist((cs) => cs.filter((c) => c.id !== id));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || undefined,
        targetDate: targetDate || undefined,
        status,
        checklist,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="cc-card mb-3 space-y-4 p-5">
      <label className="block">
        <span className="cc-eyebrow mb-2 block">Title</span>
        <input
          type="text"
          autoFocus
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="cc-input"
          placeholder="e.g. Discovery complete"
        />
      </label>
      <label className="block">
        <span className="cc-eyebrow mb-2 block">Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="cc-textarea"
          placeholder="What does this milestone cover? What does success look like?"
        />
      </label>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="cc-eyebrow mb-2 block">Target date</span>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="cc-input"
          />
        </label>
        <label className="block">
          <span className="cc-eyebrow mb-2 block">Status</span>
          <select
            className="cc-input"
            value={status}
            onChange={(e) => setStatus(e.target.value as MilestoneStatus)}
          >
            {MILESTONE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {MILESTONE_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <p className="cc-eyebrow mb-2">Measurable checklist</p>
        {checklist.length > 0 && (
          <ul className="mb-3 space-y-2">
            {checklist.map((item) => (
              <li key={item.id} className="flex items-center gap-2">
                <input
                  type="text"
                  value={item.text}
                  onChange={(e) => updateItem(item.id, { text: e.target.value })}
                  className="cc-input"
                />
                <button
                  type="button"
                  className="cc-btn-danger shrink-0"
                  onClick={() => removeItem(item.id)}
                  style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem' }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addItem();
              }
            }}
            className="cc-input"
            placeholder="Add a success criterion and press Enter"
          />
          <button
            type="button"
            className="cc-btn-ghost shrink-0"
            onClick={addItem}
            disabled={!newItemText.trim()}
          >
            Add
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="submit" className="cc-btn-primary" disabled={busy || !title.trim()}>
          {busy ? 'Saving…' : initial ? 'Save' : 'Add milestone'}
        </button>
        <button type="button" className="cc-btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        {onDelete && (
          <button type="button" className="cc-btn-danger ml-auto" onClick={onDelete}>
            Remove milestone
          </button>
        )}
      </div>
    </form>
  );
}
