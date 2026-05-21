import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import {
  archiveInboxItem,
  createInboxItem,
  deleteInboxItem,
  parseTagString,
  unarchiveInboxItem,
  updateInboxItem,
  watchInbox,
} from '../lib/inbox';
import type { InboxItem } from '../lib/types';

export default function Inbox() {
  const [items, setItems] = useState<InboxItem[] | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => watchInbox(setItems), []);

  const open = useMemo(
    () => (items ?? []).filter((i) => !i.archived),
    [items],
  );
  const archived = useMemo(
    () => (items ?? []).filter((i) => i.archived),
    [items],
  );

  return (
    <div className="max-w-3xl">
      <header className="cc-page-head">
        <div>
          <p className="cc-eyebrow">Section</p>
          <h1 className="cc-page-title mt-2">Inbox</h1>
        </div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {open.length} open
        </p>
      </header>

      <CaptureForm />

      {items === null ? (
        <p className="mt-8 text-sm" style={{ color: 'var(--text-dim)' }}>Loading…</p>
      ) : open.length === 0 ? (
        <div className="cc-empty mt-8">
          Nothing in the inbox. Capture a thought above.
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {open.map((item) => (
            <li key={item.id}>
              <InboxCard item={item} />
            </li>
          ))}
        </ul>
      )}

      {archived.length > 0 && (
        <section className="mt-10">
          <button
            type="button"
            className="cc-back-link"
            onClick={() => setShowArchived((v) => !v)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            {showArchived ? '▾' : '▸'} {archived.length} archived
          </button>
          {showArchived && (
            <ul className="mt-3 space-y-3">
              {archived.map((item) => (
                <li key={item.id}>
                  <ArchivedCard item={item} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function CaptureForm() {
  const [text, setText] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      await createInboxItem({ text, tags: parseTagString(tagInput) });
      setText('');
      setTagInput('');
    } finally {
      setBusy(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      void handleSubmit(e as unknown as FormEvent);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="cc-card space-y-3 p-5">
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        className="cc-textarea"
        style={{ minHeight: '5rem' }}
        placeholder="Capture a stray thought, idea, or observation. ⌘↵ to save."
      />
      <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
        <input
          type="text"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          className="cc-input"
          placeholder="Tags (comma-separated, optional) — e.g. idea, schools, wonde"
        />
        <button
          type="submit"
          className="cc-btn-primary"
          disabled={busy || !text.trim()}
        >
          {busy ? 'Adding…' : 'Add'}
        </button>
      </div>
    </form>
  );
}

function InboxCard({ item }: { item: InboxItem }) {
  const [editing, setEditing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [archiveNote, setArchiveNote] = useState('');

  if (editing) {
    return <EditForm item={item} onDone={() => setEditing(false)} />;
  }

  if (archiving) {
    return (
      <div className="cc-card space-y-3 p-5">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          What did you do with this? (optional)
        </p>
        <input
          type="text"
          value={archiveNote}
          onChange={(e) => setArchiveNote(e.target.value)}
          className="cc-input"
          placeholder='e.g. "Logged as project: Wonde rollout"'
          autoFocus
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="cc-btn-primary"
            onClick={async () => {
              await archiveInboxItem(item.id, archiveNote);
              setArchiving(false);
            }}
          >
            Archive
          </button>
          <button
            type="button"
            className="cc-btn-ghost"
            onClick={() => {
              setArchiving(false);
              setArchiveNote('');
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="cc-card p-5">
      <p
        className="whitespace-pre-wrap text-sm"
        style={{ color: 'var(--text)' }}
      >
        {item.text}
      </p>
      {item.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {item.tags.map((t) => (
            <span key={t} className="cc-chip-static">
              {t}
            </span>
          ))}
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span
          className="text-xs"
          style={{ color: 'var(--text-dim)' }}
        >
          {formatCreated(item.createdAt)}
        </span>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          className="cc-btn-ghost"
          onClick={() => setEditing(true)}
        >
          Edit
        </button>
        <button
          type="button"
          className="cc-btn-ghost"
          onClick={() => setArchiving(true)}
        >
          Archive
        </button>
      </div>
    </div>
  );
}

function EditForm({
  item,
  onDone,
}: {
  item: InboxItem;
  onDone: () => void;
}) {
  const [text, setText] = useState(item.text);
  const [tagInput, setTagInput] = useState(item.tags.join(', '));
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await updateInboxItem(item.id, {
        text,
        tags: parseTagString(tagInput),
      });
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="cc-card space-y-3 p-5">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="cc-textarea"
        autoFocus
      />
      <input
        type="text"
        value={tagInput}
        onChange={(e) => setTagInput(e.target.value)}
        className="cc-input"
        placeholder="Tags (comma-separated)"
      />
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="cc-btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="cc-btn-ghost" onClick={onDone}>
          Cancel
        </button>
        <button
          type="button"
          className="cc-btn-danger ml-auto"
          onClick={async () => {
            if (!confirm('Delete this inbox item?')) return;
            await deleteInboxItem(item.id);
            onDone();
          }}
        >
          Delete
        </button>
      </div>
    </form>
  );
}

function ArchivedCard({ item }: { item: InboxItem }) {
  return (
    <div className="cc-card p-4" style={{ opacity: 0.65 }}>
      <p
        className="whitespace-pre-wrap text-sm"
        style={{ color: 'var(--text-muted)' }}
      >
        {item.text}
      </p>
      {item.archivedNote && (
        <p className="mt-2 text-xs" style={{ color: 'var(--text-dim)' }}>
          → {item.archivedNote}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
          {formatCreated(item.createdAt)}
        </span>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          className="cc-btn-ghost"
          onClick={() => unarchiveInboxItem(item.id)}
        >
          Bring back
        </button>
        <button
          type="button"
          className="cc-btn-danger"
          onClick={async () => {
            if (!confirm('Delete this inbox item permanently?')) return;
            await deleteInboxItem(item.id);
          }}
          style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem' }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function formatCreated(ts: { toDate?: () => Date } | undefined): string {
  if (!ts?.toDate) return '';
  const d = ts.toDate();
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
