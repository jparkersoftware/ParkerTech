import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { watchClients } from '../lib/clients';
import { watchProjects } from '../lib/projects';
import {
  createCorrespondence,
  deleteCorrespondence,
  updateCorrespondence,
  watchCorrespondence,
} from '../lib/correspondence';
import {
  CORRESPONDENCE_TYPES,
  CORRESPONDENCE_TYPE_LABEL,
  type Client,
  type Correspondence,
  type CorrespondenceType,
  type Project,
} from '../lib/types';
import TypePill from '../components/TypePill';

type Filter = 'all' | CorrespondenceType;

export default function CorrespondencePage() {
  const [entries, setEntries] = useState<Correspondence[] | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');

  useEffect(() => watchCorrespondence(setEntries), []);
  useEffect(() => watchClients(setClients), []);
  useEffect(() => watchProjects(setProjects), []);

  const filtered = useMemo(() => {
    if (!entries) return null;
    return entries.filter(
      (e) =>
        (filter === 'all' || e.type === filter) &&
        (clientFilter === 'all' || e.clientId === clientFilter),
    );
  }, [entries, filter, clientFilter]);

  const canAdd = clients.length > 0;

  return (
    <div>
      <header className="cc-page-head">
        <div>
          <p className="cc-eyebrow">Section</p>
          <h1 className="cc-page-title mt-2">Correspondence</h1>
        </div>
        {!adding && canAdd && (
          <button type="button" className="cc-btn-primary" onClick={() => setAdding(true)}>
            Log an interaction
          </button>
        )}
      </header>

      {!canAdd && (
        <div className="cc-empty mb-6">Add a client first — correspondence belongs to a client.</div>
      )}

      {adding && (
        <EntryForm
          clients={clients}
          projects={projects}
          onCancel={() => setAdding(false)}
          onSubmit={async (data) => {
            await createCorrespondence(data);
            setAdding(false);
          }}
        />
      )}

      <Filters
        type={filter}
        client={clientFilter}
        clients={clients}
        onType={setFilter}
        onClient={setClientFilter}
      />

      {filtered === null ? (
        <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="cc-empty">
          {entries && entries.length === 0
            ? 'Nothing logged yet.'
            : 'Nothing matches those filters.'}
        </div>
      ) : (
        <ul className="space-y-4">
          {filtered.map((e) => (
            <li key={e.id}>
              <EntryCard
                entry={e}
                clients={clients}
                projects={projects}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Filters({
  type,
  client,
  clients,
  onType,
  onClient,
}: {
  type: Filter;
  client: string;
  clients: Client[];
  onType: (v: Filter) => void;
  onClient: (v: string) => void;
}) {
  const typeOptions: { value: Filter; label: string }[] = [
    { value: 'all', label: 'All types' },
    ...CORRESPONDENCE_TYPES.map((t) => ({ value: t, label: CORRESPONDENCE_TYPE_LABEL[t] })),
  ];

  return (
    <div className="mb-4 flex flex-wrap gap-3">
      <div className="flex flex-wrap gap-2">
        {typeOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onType(opt.value)}
            className={type === opt.value ? 'cc-filter is-active' : 'cc-filter'}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {clients.length > 1 && (
        <select
          className="cc-input"
          style={{ width: 'auto', minWidth: '12rem' }}
          value={client}
          onChange={(e) => onClient(e.target.value)}
        >
          <option value="all">All clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

function EntryCard({
  entry,
  clients,
  projects,
}: {
  entry: Correspondence;
  clients: Client[];
  projects: Project[];
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <EntryForm
        initial={entry}
        clients={clients}
        projects={projects}
        onCancel={() => setEditing(false)}
        onSubmit={async (data) => {
          await updateCorrespondence(entry.id, data);
          setEditing(false);
        }}
        onDelete={async () => {
          if (!confirm(`Delete this ${entry.type}?`)) return;
          await deleteCorrespondence(entry.id);
          setEditing(false);
        }}
      />
    );
  }

  const client = clients.find((c) => c.id === entry.clientId);
  const tagged =
    client?.contacts.filter((c) => entry.contactIds?.includes(c.id)) ?? [];

  return (
    <article className="cc-card p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <TypePill type={entry.type} />
            <span className="text-sm" style={{ color: 'var(--text-dim)' }}>
              {formatLongDate(entry.date)}
            </span>
          </div>
          <h3 className="cc-display mt-2 text-lg">{entry.title}</h3>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            <Link to={`/clients/${entry.clientId}`} className="hover:underline">
              {entry.clientName}
            </Link>
            {entry.projectId && entry.projectTitle && (
              <>
                <span className="mx-2" style={{ color: 'var(--text-dim)' }}>·</span>
                <Link to={`/projects/${entry.projectId}`} className="hover:underline">
                  {entry.projectTitle}
                </Link>
              </>
            )}
          </p>
        </div>
        <button type="button" className="cc-btn-ghost shrink-0" onClick={() => setEditing(true)}>
          Edit
        </button>
      </header>

      {entry.body && (
        <p
          className="mt-4 whitespace-pre-wrap text-sm"
          style={{ color: 'var(--text)' }}
        >
          {entry.body}
        </p>
      )}

      {entry.transcript && <TranscriptBlock transcript={entry.transcript} />}

      {tagged.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {tagged.map((c) => (
            <span key={c.id} className="cc-chip-static">
              {c.name}
              {c.role && (
                <span style={{ color: 'var(--text-dim)', marginLeft: 6 }}>· {c.role}</span>
              )}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

export function EntryForm({
  initial,
  clients,
  projects,
  defaultClientId,
  defaultProjectId,
  onSubmit,
  onCancel,
  onDelete,
}: {
  initial?: Correspondence;
  clients: Client[];
  projects: Project[];
  defaultClientId?: string;
  defaultProjectId?: string;
  onSubmit: (data: {
    clientId: string;
    clientName: string;
    projectId?: string;
    projectTitle?: string;
    type: CorrespondenceType;
    date: string;
    title: string;
    body: string;
    transcript?: string;
    contactIds: string[];
  }) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
}) {
  const [type, setType] = useState<CorrespondenceType>(initial?.type ?? 'meeting');
  const [date, setDate] = useState(initial?.date ?? new Date().toISOString().slice(0, 10));
  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [transcript, setTranscript] = useState(initial?.transcript ?? '');
  const [showTranscript, setShowTranscript] = useState(!!initial?.transcript);
  const [clientId, setClientId] = useState(
    initial?.clientId ?? defaultClientId ?? clients[0]?.id ?? '',
  );
  const [projectId, setProjectId] = useState(initial?.projectId ?? defaultProjectId ?? '');
  const [contactIds, setContactIds] = useState<string[]>(initial?.contactIds ?? []);
  const [busy, setBusy] = useState(false);

  const client = clients.find((c) => c.id === clientId);
  const clientProjects = projects.filter((p) => p.clientId === clientId);

  function handleClientChange(nextId: string) {
    setClientId(nextId);
    setContactIds([]);
    setProjectId('');
  }

  function toggleContact(id: string) {
    setContactIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!client || !title.trim()) return;
    const project = projectId ? projects.find((p) => p.id === projectId) : undefined;
    setBusy(true);
    try {
      await onSubmit({
        clientId: client.id,
        clientName: client.name,
        projectId: project?.id,
        projectTitle: project?.title,
        type,
        date,
        title: title.trim(),
        body,
        transcript: transcript.trim() || undefined,
        contactIds,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="cc-card mb-6 space-y-4 p-6">
      <div className="grid gap-4 md:grid-cols-3">
        <label className="block">
          <span className="cc-eyebrow mb-2 block">Type</span>
          <select
            className="cc-input"
            value={type}
            onChange={(e) => setType(e.target.value as CorrespondenceType)}
          >
            {CORRESPONDENCE_TYPES.map((t) => (
              <option key={t} value={t}>
                {CORRESPONDENCE_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="cc-eyebrow mb-2 block">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="cc-input"
            required
          />
        </label>
        <label className="block">
          <span className="cc-eyebrow mb-2 block">Client</span>
          <select
            className="cc-input"
            value={clientId}
            onChange={(e) => handleClientChange(e.target.value)}
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {clientProjects.length > 0 && (
        <label className="block">
          <span className="cc-eyebrow mb-2 block">Project (optional)</span>
          <select
            className="cc-input"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="">— not project-specific —</option>
            {clientProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="block">
        <span className="cc-eyebrow mb-2 block">Title</span>
        <input
          type="text"
          autoFocus
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="cc-input"
          placeholder="e.g. Termly review with SLT"
        />
      </label>

      <label className="block">
        <span className="cc-eyebrow mb-2 block">Summary</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="cc-textarea"
          style={{ minHeight: '8rem' }}
          placeholder="What was said, agreed, or actioned. Short and human."
        />
      </label>

      <div>
        {!showTranscript ? (
          <button
            type="button"
            onClick={() => setShowTranscript(true)}
            className="cc-back-link"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            ▸ Add full transcript / email / verbatim notes
          </button>
        ) : (
          <label className="block">
            <span className="cc-eyebrow mb-2 block">
              Full transcript / email{' '}
              <span style={{ color: 'var(--text-dim)', textTransform: 'none', letterSpacing: 0 }}>
                · saved verbatim for future AI context
              </span>
            </span>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              className="cc-textarea"
              style={{ minHeight: '14rem', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}
              placeholder="Paste the full transcript, email thread, or raw notes here."
            />
            <button
              type="button"
              onClick={() => {
                setTranscript('');
                setShowTranscript(false);
              }}
              className="cc-back-link mt-2"
              style={{ display: 'inline-block' }}
            >
              Remove transcript
            </button>
          </label>
        )}
      </div>

      {client && client.contacts.length > 0 && (
        <div>
          <p className="cc-eyebrow mb-2">People involved</p>
          <div className="flex flex-wrap gap-2">
            {client.contacts.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleContact(c.id)}
                className={contactIds.includes(c.id) ? 'cc-chip is-active' : 'cc-chip'}
              >
                {c.name}
                {c.role && (
                  <span style={{ color: 'inherit', opacity: 0.7 }}> · {c.role}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          className="cc-btn-primary"
          disabled={busy || !title.trim() || !client}
        >
          {busy ? 'Saving…' : initial ? 'Save' : 'Log it'}
        </button>
        <button type="button" className="cc-btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        {onDelete && (
          <button type="button" className="cc-btn-danger ml-auto" onClick={onDelete}>
            Delete
          </button>
        )}
      </div>
    </form>
  );
}

function TranscriptBlock({ transcript }: { transcript: string }) {
  const [open, setOpen] = useState(false);
  const wordCount = transcript.trim().split(/\s+/).length;
  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="cc-back-link"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
      >
        {open ? '▾' : '▸'} {open ? 'Hide' : 'Show'} full transcript / email
        <span style={{ color: 'var(--text-dim)' }}>· {wordCount} words</span>
      </button>
      {open && (
        <pre
          className="mt-3 whitespace-pre-wrap rounded-md p-4"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--text-muted)',
            fontSize: '0.82rem',
            fontFamily: 'var(--font-mono)',
            lineHeight: 1.6,
            maxHeight: '32rem',
            overflowY: 'auto',
          }}
        >
          {transcript}
        </pre>
      )}
    </div>
  );
}

function formatLongDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
