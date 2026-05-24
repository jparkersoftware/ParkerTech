/**
 * Inbox — triage workflow.
 *
 * An inbox is a holding pen that flows OUT to actionable destinations.
 * Every item has 6 "Convert to" paths plus archive:
 *   1. Task (project + priority + due date)
 *   2. Correspondence (client + type + title)
 *   3. Knowledge note (writes a `knowledgeDrafts/` doc; Joseph runs
 *      vault_write_knowledge from Claude to ship it to the vault)
 *   4. Feature Request (project + status)
 *   5. Project (optional client + name + status)
 *   6. Quick reply (contact picker → mailto:)
 *
 * Capture adds:
 *   - @mention autocomplete (clients / projects / contacts / quotes)
 *   - #tag autocomplete (from existing inbox tags)
 *   - Attachment drag-drop (Storage path `inbox/{itemId}/{uuid}.{ext}`)
 *
 * Per-card extras:
 *   - Snooze (hidden from main list until the date passes)
 *   - Pin (sorts to top with subtle border accent)
 *   - Inline tag edit (popover; same suggestion list as capture)
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import {
  archiveInboxItem,
  collectInboxTags,
  createInboxItem,
  createKnowledgeDraft,
  deleteInboxAttachment,
  deleteInboxItem,
  isSnoozedActive,
  isoToday,
  parseTagString,
  setInboxItemPinned,
  setInboxItemSnooze,
  unarchiveInboxItem,
  updateInboxItem,
  uploadInboxAttachment,
  watchInbox,
  type KnowledgeDraftCategory,
} from '../lib/inbox';
import { watchClients } from '../lib/clients';
import { watchProjects } from '../lib/projects';
import { watchQuotes } from '../lib/quotes';
import { addTask, createProject, addFeatureRequest } from '../lib/projects';
import { createCorrespondence } from '../lib/correspondence';
import type {
  Client,
  Contact,
  InboxItem,
  InboxItemAttachment,
  InboxItemMention,
  InboxItemMentionType,
  Project,
  Quote,
} from '../lib/types';
import {
  CORRESPONDENCE_TYPES,
  CORRESPONDENCE_TYPE_LABEL,
  FEATURE_REQUEST_STATUSES,
  FEATURE_REQUEST_STATUS_LABEL,
  PROJECT_STATUSES_UI,
  PROJECT_STATUS_LABEL,
} from '../lib/types';
import { formatRelativeDate, fullTimestamp } from '../lib/dateFormat';
import Icon, { type IconName } from '../components/Icon';

// ── Mention index ───────────────────────────────────────────────

type MentionEntity = {
  type: InboxItemMentionType;
  id: string;
  displayName: string;
  /** Secondary string for filter ranking (e.g. client name for a project). */
  hint?: string;
};

function buildMentionIndex(
  clients: Client[],
  projects: Project[],
  quotes: Quote[],
): MentionEntity[] {
  const out: MentionEntity[] = [];
  for (const c of clients) {
    out.push({ type: 'client', id: c.id, displayName: c.name });
    for (const contact of c.contacts ?? []) {
      out.push({
        type: 'contact',
        id: `${c.id}:${contact.id}`,
        displayName: contact.name,
        hint: c.name,
      });
    }
  }
  for (const p of projects) {
    out.push({
      type: 'project',
      id: p.id,
      displayName: p.title,
      hint: p.clientName,
    });
  }
  for (const q of quotes) {
    out.push({
      type: 'quote',
      id: q.id,
      displayName: q.number,
      hint: q.clientName,
    });
  }
  return out;
}

const MENTION_ICON: Record<InboxItemMentionType, IconName> = {
  client: 'briefcase', // mapping per spec: "client = building" — briefcase is closest in our set
  project: 'folder',
  contact: 'users',
  quote: 'pound',
};

const MENTION_LABEL: Record<InboxItemMentionType, string> = {
  client: 'Client',
  project: 'Project',
  contact: 'Contact',
  quote: 'Quote',
};

// ── Top-level component ─────────────────────────────────────────

export default function Inbox() {
  const [items, setItems] = useState<InboxItem[] | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [showSnoozed, setShowSnoozed] = useState(false);

  useEffect(() => watchInbox(setItems), []);
  useEffect(() => watchClients(setClients), []);
  useEffect(() => watchProjects(setProjects), []);
  useEffect(() => watchQuotes(setQuotes), []);

  const mentionIndex = useMemo(
    () => buildMentionIndex(clients, projects, quotes),
    [clients, projects, quotes],
  );
  const allItems = items ?? [];
  const tagPool = useMemo(() => collectInboxTags(allItems), [allItems]);
  const today = isoToday();

  // Split: archived | snoozed-active | open. Pinned float to the top of open.
  const archived = useMemo(() => allItems.filter((i) => i.archived), [allItems]);
  const snoozed = useMemo(
    () => allItems.filter((i) => !i.archived && isSnoozedActive(i, today)),
    [allItems, today],
  );
  const open = useMemo(() => {
    const visible = allItems.filter(
      (i) => !i.archived && !isSnoozedActive(i, today),
    );
    // Pinned first, then everything else, both in createdAt-desc which is
    // the order from the Firestore query.
    return visible.slice().sort((a, b) => {
      const aPin = a.pinned ? 1 : 0;
      const bPin = b.pinned ? 1 : 0;
      return bPin - aPin;
    });
  }, [allItems, today]);

  return (
    <div className="max-w-3xl">
      <header className="cc-page-head">
        <div>
          <h1 className="cc-page-title">Inbox</h1>
          <p className="cc-page-head-meta">
            {items === null
              ? 'Loading…'
              : `${open.length} open · ${snoozed.length} snoozed · ${archived.length} archived`}
          </p>
        </div>
      </header>

      <CaptureForm
        mentionIndex={mentionIndex}
        tagPool={tagPool}
      />

      {items === null ? (
        <p className="mt-8 text-sm" style={{ color: 'var(--text-dim)' }}>Loading…</p>
      ) : open.length === 0 ? (
        <p className="cc-empty-inline mt-8">
          <span style={{ color: '#86efac' }}>✓</span> Nothing in the inbox. Capture a thought above.
        </p>
      ) : (
        <ul className="mt-8 space-y-3">
          {open.map((item) => (
            <li key={item.id}>
              <InboxCard
                item={item}
                clients={clients}
                projects={projects}
                mentionIndex={mentionIndex}
                tagPool={tagPool}
              />
            </li>
          ))}
        </ul>
      )}

      {snoozed.length > 0 && (
        <section className="mt-10">
          <button
            type="button"
            className="cc-back-link"
            onClick={() => setShowSnoozed((v) => !v)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            {showSnoozed ? '▾' : '▸'} {snoozed.length} snoozed
          </button>
          {showSnoozed && (
            <ul className="mt-3 space-y-3">
              {snoozed.map((item) => (
                <li key={item.id}>
                  <InboxCard
                    item={item}
                    clients={clients}
                    projects={projects}
                    mentionIndex={mentionIndex}
                    tagPool={tagPool}
                    snoozedView
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
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

// ── Capture form ────────────────────────────────────────────────

function CaptureForm({
  mentionIndex,
  tagPool,
}: {
  mentionIndex: MentionEntity[];
  tagPool: string[];
}) {
  const [text, setText] = useState('');
  const [mentions, setMentions] = useState<InboxItemMention[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      // Create the doc FIRST so we have an id for the Storage path.
      const id = await createInboxItem({
        text,
        tags: parseTagString(tagInput),
        mentions: dedupeMentions(mentions),
      });
      // Then upload any pending files in parallel (each does a
      // read-modify-write to push into attachments[]).
      if (pendingFiles.length > 0) {
        await Promise.all(
          pendingFiles.map((f) => uploadInboxAttachment(id, f)),
        );
      }
      setText('');
      setTagInput('');
      setMentions([]);
      setPendingFiles([]);
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
      <MentionTextarea
        innerRef={textareaRef}
        value={text}
        onChange={setText}
        onAddMention={(m) =>
          setMentions((prev) =>
            prev.find((p) => p.id === m.id && p.type === m.type) ? prev : [...prev, m],
          )
        }
        mentionIndex={mentionIndex}
        onKeyDown={handleKeyDown}
        autoFocus
        placeholder="Capture a stray thought. Type @ to mention a client / project / contact. ⌘↵ to save."
        minHeight="5rem"
      />

      {mentions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {mentions.map((m) => (
            <MentionChip
              key={`${m.type}:${m.id}`}
              mention={m}
              onRemove={() =>
                setMentions((prev) =>
                  prev.filter((p) => !(p.id === m.id && p.type === m.type)),
                )
              }
            />
          ))}
        </div>
      )}

      <TagInputWithSuggestions
        value={tagInput}
        onChange={setTagInput}
        tagPool={tagPool}
        placeholder="Tags (comma-separated, optional) — e.g. idea, schools, wonde"
      />

      <AttachmentPicker
        pending={pendingFiles}
        onPendingChange={setPendingFiles}
      />

      <div className="flex flex-wrap items-center gap-2">
        <span style={{ flex: 1 }} />
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

function dedupeMentions(mentions: InboxItemMention[]): InboxItemMention[] {
  const seen = new Set<string>();
  const out: InboxItemMention[] = [];
  for (const m of mentions) {
    const k = `${m.type}:${m.id}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(m);
  }
  return out;
}

// ── Mention chip ─────────────────────────────────────────────────

function MentionChip({
  mention,
  onRemove,
}: {
  mention: InboxItemMention;
  onRemove?: () => void;
}) {
  return (
    <span className="cc-mention-chip">
      <Icon name={MENTION_ICON[mention.type]} size={12} />
      <strong>{mention.displayName}</strong>
      {onRemove && (
        <button
          type="button"
          className="cc-mention-chip-x"
          onClick={onRemove}
          aria-label={`Remove ${mention.displayName}`}
        >
          ×
        </button>
      )}
    </span>
  );
}

// ── Mention-aware textarea ──────────────────────────────────────

function MentionTextarea({
  innerRef,
  value,
  onChange,
  onAddMention,
  mentionIndex,
  onKeyDown,
  placeholder,
  autoFocus,
  minHeight,
}: {
  innerRef?: React.MutableRefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (next: string) => void;
  onAddMention: (m: InboxItemMention) => void;
  mentionIndex: MentionEntity[];
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  autoFocus?: boolean;
  minHeight?: string;
}) {
  const ownRef = useRef<HTMLTextAreaElement | null>(null);
  const ref = innerRef ?? ownRef;
  const [query, setQuery] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(0);

  // Recompute the @query whenever the value or caret moves.
  function refreshQuery() {
    const ta = ref.current;
    if (!ta) {
      setQuery(null);
      return;
    }
    const caret = ta.selectionStart ?? 0;
    const before = value.slice(0, caret);
    const match = before.match(/(?:^|\s)@([A-Za-z0-9._-]*)$/);
    if (match) {
      setQuery(match[1] ?? '');
      setHighlight(0);
    } else {
      setQuery(null);
    }
  }

  const filtered = useMemo<MentionEntity[]>(() => {
    if (query === null) return [];
    const q = query.trim().toLowerCase();
    const matches = mentionIndex.filter((e) => {
      if (!q) return true;
      return (
        e.displayName.toLowerCase().includes(q) ||
        (e.hint ?? '').toLowerCase().includes(q)
      );
    });
    return matches.slice(0, 8);
  }, [query, mentionIndex]);

  function pick(idx: number) {
    const ta = ref.current;
    if (!ta) return;
    const choice = filtered[idx];
    if (!choice) return;
    const caret = ta.selectionStart ?? 0;
    const before = value.slice(0, caret);
    const after = value.slice(caret);
    const newBefore = before.replace(
      /(?:^|\s)@([A-Za-z0-9._-]*)$/,
      (full, _q) => {
        const lead = full.startsWith('@') ? '' : full[0]!;
        return `${lead}@${choice.displayName} `;
      },
    );
    const next = newBefore + after;
    onChange(next);
    onAddMention({
      type: choice.type,
      id: choice.id,
      displayName: choice.displayName,
    });
    setQuery(null);
    // Restore caret just after the inserted mention.
    requestAnimationFrame(() => {
      if (!ta) return;
      const pos = newBefore.length;
      ta.focus();
      ta.setSelectionRange(pos, pos);
    });
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (query !== null && filtered.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlight((h) => (h + 1) % filtered.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlight((h) => (h - 1 + filtered.length) % filtered.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        pick(highlight);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setQuery(null);
        return;
      }
    }
    onKeyDown?.(e);
  }

  return (
    <div className="cc-mention-wrap">
      <textarea
        ref={ref}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          // Defer to next tick so the new value is reflected.
          requestAnimationFrame(refreshQuery);
        }}
        onKeyUp={refreshQuery}
        onClick={refreshQuery}
        onKeyDown={handleKey}
        className="cc-textarea"
        style={minHeight ? { minHeight } : undefined}
        placeholder={placeholder}
      />
      {query !== null && filtered.length > 0 && (
        <ul className="cc-suggest-popover">
          {filtered.map((entity, i) => (
            <li
              key={`${entity.type}:${entity.id}`}
              className={`cc-suggest-item${i === highlight ? ' is-active' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(i);
              }}
              onMouseEnter={() => setHighlight(i)}
            >
              <Icon name={MENTION_ICON[entity.type]} size={14} />
              <span>{entity.displayName}</span>
              <span className="cc-suggest-meta">
                {entity.hint
                  ? `${MENTION_LABEL[entity.type]} · ${entity.hint}`
                  : MENTION_LABEL[entity.type]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Tag input with suggestions ──────────────────────────────────

function TagInputWithSuggestions({
  value,
  onChange,
  tagPool,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  tagPool: string[];
  placeholder?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Active fragment = whatever is after the last comma (or the whole string).
  const fragment = useMemo(() => {
    const parts = value.split(',');
    return parts[parts.length - 1]!.replace(/^#/, '').trim();
  }, [value]);

  const existing = useMemo(
    () =>
      new Set(
        value
          .split(',')
          .map((t) => t.replace(/^#/, '').trim().toLowerCase())
          .filter(Boolean),
      ),
    [value],
  );

  const suggestions = useMemo(() => {
    if (!focused) return [];
    const q = fragment.toLowerCase();
    return tagPool
      .filter((t) => !existing.has(t) && (q === '' || t.includes(q)))
      .slice(0, 8);
  }, [tagPool, fragment, existing, focused]);

  function pick(idx: number) {
    const tag = suggestions[idx];
    if (!tag) return;
    const parts = value.split(',');
    parts[parts.length - 1] = ` ${tag}`;
    onChange(parts.join(',').replace(/^[\s,]+/, '') + ', ');
    setHighlight(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      pick(highlight);
    } else if (e.key === 'Escape') {
      setFocused(false);
    }
  }

  return (
    <div className="cc-mention-wrap">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        onKeyDown={handleKey}
        className="cc-input"
        placeholder={placeholder}
      />
      {focused && suggestions.length > 0 && (
        <ul className="cc-suggest-popover">
          {suggestions.map((tag, i) => (
            <li
              key={tag}
              className={`cc-suggest-item${i === highlight ? ' is-active' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(i);
              }}
              onMouseEnter={() => setHighlight(i)}
            >
              <span style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>#</span>
              <span>{tag}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Attachment picker (pending uploads on capture form) ─────────

function AttachmentPicker({
  pending,
  onPendingChange,
}: {
  pending: File[];
  onPendingChange: (next: File[]) => void;
}) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function addFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    onPendingChange([...pending, ...list]);
  }

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = '';
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDrag(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  }

  return (
    <div>
      {pending.length > 0 && (
        <div className="cc-attach-strip" style={{ marginBottom: '0.6rem' }}>
          {pending.map((f, i) => (
            <PendingTile
              key={`${f.name}-${i}`}
              file={f}
              onRemove={() =>
                onPendingChange(pending.filter((_, idx) => idx !== i))
              }
            />
          ))}
        </div>
      )}
      <label
        className={`cc-attach-dropzone cc-attach-dropzone--compact${drag ? ' is-drag' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          onChange={onPick}
        />
        <span>
          <Icon name="paperclip" size={14} />{' '}
          Drop an image or PDF, or <strong>tap to pick</strong>
        </span>
      </label>
    </div>
  );
}

function PendingTile({
  file,
  onRemove,
}: {
  file: File;
  onRemove: () => void;
}) {
  const isImage = file.type.startsWith('image/');
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!isImage) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file, isImage]);

  return (
    <div className="cc-attach-tile" title={file.name}>
      <button
        type="button"
        className="cc-attach-delete"
        onClick={onRemove}
        aria-label={`Remove ${file.name}`}
      >
        ×
      </button>
      {isImage && preview ? (
        <span style={{ display: 'block', height: 80, width: 80 }}>
          <img
            src={preview}
            alt={file.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </span>
      ) : (
        <div className="cc-attach-file">PDF</div>
      )}
      <div className="cc-attach-meta">{file.name}</div>
    </div>
  );
}

// ── InboxCard (the workhorse) ───────────────────────────────────

type Mode =
  | { kind: 'view' }
  | { kind: 'edit' }
  | { kind: 'archive' }
  | { kind: 'snooze' }
  | { kind: 'convert'; to: ConvertDestination };

type ConvertDestination =
  | 'task'
  | 'correspondence'
  | 'knowledge'
  | 'feature-request'
  | 'project'
  | 'email';

function InboxCard({
  item,
  clients,
  projects,
  mentionIndex,
  tagPool,
  snoozedView,
}: {
  item: InboxItem;
  clients: Client[];
  projects: Project[];
  mentionIndex: MentionEntity[];
  tagPool: string[];
  snoozedView?: boolean;
}) {
  const [mode, setMode] = useState<Mode>({ kind: 'view' });
  const [convertOpen, setConvertOpen] = useState(false);
  const [tagPopover, setTagPopover] = useState(false);
  const [archiveNote, setArchiveNote] = useState('');

  if (mode.kind === 'edit') {
    return (
      <EditForm
        item={item}
        mentionIndex={mentionIndex}
        tagPool={tagPool}
        onDone={() => setMode({ kind: 'view' })}
      />
    );
  }

  if (mode.kind === 'archive') {
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
              setMode({ kind: 'view' });
            }}
          >
            Archive
          </button>
          <button
            type="button"
            className="cc-btn-ghost"
            onClick={() => {
              setMode({ kind: 'view' });
              setArchiveNote('');
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (mode.kind === 'snooze') {
    return (
      <SnoozeForm
        item={item}
        onDone={() => setMode({ kind: 'view' })}
      />
    );
  }

  if (mode.kind === 'convert') {
    return (
      <ConvertForm
        item={item}
        destination={mode.to}
        clients={clients}
        projects={projects}
        onDone={() => setMode({ kind: 'view' })}
      />
    );
  }

  const cardClass = `cc-card cc-inbox-card p-5${item.pinned ? ' is-pinned' : ''}`;

  return (
    <div className={cardClass}>
      {item.pinned && (
        <div className="cc-inbox-pinned-mark" title="Pinned">
          <Icon name="flame" size={12} /> Pinned
        </div>
      )}
      <RichInboxText
        text={item.text}
        mentions={item.mentions ?? []}
      />

      {(item.tags.length > 0 || true) && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {item.tags.map((t) => (
            <span key={t} className="cc-chip-static">
              #{t}
            </span>
          ))}
          <button
            type="button"
            className="cc-chip"
            style={{ padding: '0.18rem 0.55rem', fontSize: '0.72rem' }}
            onClick={() => setTagPopover((v) => !v)}
            title="Edit tags"
          >
            {item.tags.length === 0 ? '+ tag' : 'edit'}
          </button>
        </div>
      )}

      {tagPopover && (
        <InlineTagEdit
          item={item}
          tagPool={tagPool}
          onClose={() => setTagPopover(false)}
        />
      )}

      <AttachmentThumbs
        attachments={item.attachments ?? []}
        itemId={item.id}
      />

      {item.snoozedUntil && !snoozedView && (
        <p className="mt-3 text-xs" style={{ color: 'var(--accent-bright)' }}>
          Snoozed until {item.snoozedUntil}
        </p>
      )}
      {item.snoozedUntil && snoozedView && (
        <p className="mt-3 text-xs" style={{ color: 'var(--text-dim)' }}>
          Snoozed until {item.snoozedUntil}
        </p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
        <span
          className="text-xs"
          style={{ color: 'var(--text-dim)' }}
          title={fullTimestamp(item.createdAt)}
        >
          {formatRelativeDate(item.createdAt)}
        </span>
        <span style={{ flex: 1 }} />
        <div className="cc-inbox-actions flex flex-wrap items-center gap-2 relative">
          <button
            type="button"
            className="cc-btn-ghost"
            onClick={() => setInboxItemPinned(item.id, !item.pinned)}
            title={item.pinned ? 'Unpin' : 'Pin'}
          >
            {item.pinned ? 'Unpin' : 'Pin'}
          </button>
          <button
            type="button"
            className="cc-btn-ghost"
            onClick={() => setMode({ kind: 'snooze' })}
          >
            Snooze
          </button>
          <button
            type="button"
            className="cc-btn-ghost"
            onClick={() => setMode({ kind: 'edit' })}
          >
            Edit
          </button>

          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="cc-btn-primary"
              style={{ padding: '0.45rem 0.95rem', fontSize: '0.82rem' }}
              onClick={() => setConvertOpen((v) => !v)}
            >
              Convert ▾
            </button>
            {convertOpen && (
              <ConvertMenu
                onPick={(to) => {
                  setConvertOpen(false);
                  setMode({ kind: 'convert', to });
                }}
                onClose={() => setConvertOpen(false)}
              />
            )}
          </div>

          <button
            type="button"
            className="cc-btn-ghost"
            onClick={() => setMode({ kind: 'archive' })}
          >
            Archive
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Rich text rendering with mention highlighting ───────────────

function RichInboxText({
  text,
  mentions,
}: {
  text: string;
  mentions: InboxItemMention[];
}) {
  // Walk the text once. Every "@DisplayName" substring that matches a
  // known mention by displayName gets rendered as a chip. Anything else
  // is plain text.
  if (mentions.length === 0) {
    return (
      <p
        className="whitespace-pre-wrap text-sm"
        style={{ color: 'var(--text)' }}
      >
        {text}
      </p>
    );
  }
  const byName = new Map(mentions.map((m) => [m.displayName, m]));
  // Longest first so "St Mary's High" beats "St Mary's".
  const names = mentions
    .map((m) => m.displayName)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegex);
  const re = new RegExp(`@(${names.join('|')})`, 'g');
  const parts: ReactNode[] = [];
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > lastIdx) parts.push(text.slice(lastIdx, m.index));
    const name = m[1]!;
    const mention = byName.get(name);
    if (mention) {
      parts.push(
        <MentionChip key={`m-${m.index}`} mention={mention} />,
      );
    } else {
      parts.push(m[0]);
    }
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));

  return (
    <p
      className="whitespace-pre-wrap text-sm"
      style={{ color: 'var(--text)' }}
    >
      {parts}
    </p>
  );
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Attachment thumbnails on a rendered card ────────────────────

function AttachmentThumbs({
  attachments,
  itemId,
}: {
  attachments: InboxItemAttachment[];
  itemId: string;
}) {
  if (attachments.length === 0) return null;
  const visible = attachments.slice(0, 5);
  const extra = attachments.length - visible.length;
  return (
    <div className="cc-attach-strip mt-3">
      {visible.map((att) => (
        <SmallAttachTile key={att.id} itemId={itemId} attachment={att} />
      ))}
      {extra > 0 && (
        <div className="cc-attach-tile" title={`${extra} more`}>
          <div className="cc-attach-file">+{extra}</div>
        </div>
      )}
    </div>
  );
}

function SmallAttachTile({
  itemId,
  attachment,
}: {
  itemId: string;
  attachment: InboxItemAttachment;
}) {
  const isImage = attachment.contentType.startsWith('image/');
  const sizeKb = Math.max(1, Math.round(attachment.sizeBytes / 1024));
  const title = `${attachment.fileName} · ${sizeKb} KB`;

  async function onDelete(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete attachment "${attachment.fileName}"?`)) return;
    await deleteInboxAttachment(itemId, attachment.id);
  }

  return (
    <div className="cc-attach-tile" title={title}>
      <button
        type="button"
        className="cc-attach-delete"
        onClick={onDelete}
        aria-label={`Delete ${attachment.fileName}`}
      >
        ×
      </button>
      <a href={attachment.downloadUrl} target="_blank" rel="noreferrer">
        {isImage ? (
          <img src={attachment.downloadUrl} alt={attachment.fileName} />
        ) : (
          <div className="cc-attach-file">PDF</div>
        )}
      </a>
      <div className="cc-attach-meta">{attachment.fileName}</div>
    </div>
  );
}

// ── Convert menu ────────────────────────────────────────────────

function ConvertMenu({
  onPick,
  onClose,
}: {
  onPick: (to: ConvertDestination) => void;
  onClose: () => void;
}) {
  // Close on outside-click / Escape.
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    function onDocClick(e: globalThis.MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const entries: { to: ConvertDestination; icon: IconName; label: string; sub: string }[] = [
    { to: 'task', icon: 'check-square', label: 'Task', sub: 'Add to a project' },
    { to: 'correspondence', icon: 'message', label: 'Correspondence', sub: 'Log against a client' },
    { to: 'knowledge', icon: 'lightbulb', label: 'Knowledge note', sub: 'Draft a vault note' },
    { to: 'feature-request', icon: 'flame', label: 'Feature Request', sub: 'On a project' },
    { to: 'project', icon: 'folder', label: 'Project', sub: 'Spin up a new project' },
    { to: 'email', icon: 'mail', label: 'Quick reply', sub: 'mailto: a contact' },
  ];

  return (
    <div ref={ref} className="cc-convert-menu">
      {entries.map((e) => (
        <button
          key={e.to}
          type="button"
          className="cc-convert-item"
          onClick={() => onPick(e.to)}
        >
          <Icon name={e.icon} size={14} />
          <span className="cc-convert-label">{e.label}</span>
          <span className="cc-convert-sub">{e.sub}</span>
        </button>
      ))}
    </div>
  );
}

// ── Inline tag edit ─────────────────────────────────────────────

function InlineTagEdit({
  item,
  tagPool,
  onClose,
}: {
  item: InboxItem;
  tagPool: string[];
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(item.tags.join(', '));
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const save = useCallback(async () => {
    const next = parseTagString(draft);
    await updateInboxItem(item.id, { tags: next });
    onClose();
  }, [draft, item.id, onClose]);

  useEffect(() => {
    function onDocMouse(e: globalThis.MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        void save();
      }
    }
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', onDocMouse);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouse);
      document.removeEventListener('keydown', onKey);
    };
  }, [save, onClose]);

  return (
    <div ref={wrapRef} className="mt-2" style={{ maxWidth: 480 }}>
      <TagInputWithSuggestions
        value={draft}
        onChange={setDraft}
        tagPool={tagPool}
        placeholder="Tags (comma-separated)"
      />
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          className="cc-btn-primary"
          style={{ padding: '0.45rem 0.95rem', fontSize: '0.82rem' }}
          onClick={() => void save()}
        >
          Save
        </button>
        <button
          type="button"
          className="cc-btn-ghost"
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Snooze form ─────────────────────────────────────────────────

function SnoozeForm({
  item,
  onDone,
}: {
  item: InboxItem;
  onDone: () => void;
}) {
  const todayDate = new Date();
  const tomorrow = isoOffset(todayDate, 1);
  const nextMonday = isoNextMonday(todayDate);
  const inAWeek = isoOffset(todayDate, 7);

  const [date, setDate] = useState(item.snoozedUntil ?? tomorrow);

  async function save() {
    await setInboxItemSnooze(item.id, date);
    onDone();
  }

  return (
    <div className="cc-card space-y-3 p-5">
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Snooze until — comes back on this date.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="cc-btn-ghost" onClick={() => setDate(tomorrow)}>
          Tomorrow
        </button>
        <button type="button" className="cc-btn-ghost" onClick={() => setDate(nextMonday)}>
          Next Monday
        </button>
        <button type="button" className="cc-btn-ghost" onClick={() => setDate(inAWeek)}>
          In a week
        </button>
      </div>
      <input
        type="date"
        className="cc-input"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" className="cc-btn-primary" onClick={() => void save()}>
          Snooze
        </button>
        {item.snoozedUntil && (
          <button
            type="button"
            className="cc-btn-ghost"
            onClick={async () => {
              await setInboxItemSnooze(item.id, null);
              onDone();
            }}
          >
            Unsnooze
          </button>
        )}
        <button type="button" className="cc-btn-ghost" onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function isoOffset(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function isoNextMonday(base: Date): string {
  const d = new Date(base);
  const day = d.getDay(); // 0 = Sun
  const delta = ((8 - day) % 7) || 7;
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

// ── Edit form (full) ────────────────────────────────────────────

function EditForm({
  item,
  mentionIndex,
  tagPool,
  onDone,
}: {
  item: InboxItem;
  mentionIndex: MentionEntity[];
  tagPool: string[];
  onDone: () => void;
}) {
  const [text, setText] = useState(item.text);
  const [tagInput, setTagInput] = useState(item.tags.join(', '));
  const [mentions, setMentions] = useState<InboxItemMention[]>(item.mentions ?? []);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await updateInboxItem(item.id, {
        text,
        tags: parseTagString(tagInput),
        mentions: dedupeMentions(mentions),
      });
      onDone();
    } finally {
      setBusy(false);
    }
  }

  async function handleFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    setUploading((u) => [...u, ...list.map((f) => f.name)]);
    try {
      for (const file of list) {
        await uploadInboxAttachment(item.id, file);
      }
    } finally {
      setUploading((u) => u.filter((n) => !list.find((f) => f.name === n)));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="cc-card space-y-3 p-5">
      <MentionTextarea
        value={text}
        onChange={setText}
        onAddMention={(m) =>
          setMentions((prev) =>
            prev.find((p) => p.id === m.id && p.type === m.type) ? prev : [...prev, m],
          )
        }
        mentionIndex={mentionIndex}
        autoFocus
      />
      {mentions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {mentions.map((m) => (
            <MentionChip
              key={`${m.type}:${m.id}`}
              mention={m}
              onRemove={() =>
                setMentions((prev) =>
                  prev.filter((p) => !(p.id === m.id && p.type === m.type)),
                )
              }
            />
          ))}
        </div>
      )}
      <TagInputWithSuggestions
        value={tagInput}
        onChange={setTagInput}
        tagPool={tagPool}
        placeholder="Tags (comma-separated)"
      />

      {/* Attachments — drag-drop directly into the existing item. */}
      <div>
        <p className="cc-eyebrow mb-2">Attachments</p>
        {(item.attachments?.length ?? 0) + uploading.length > 0 && (
          <div className="cc-attach-strip" style={{ marginBottom: '0.6rem' }}>
            {(item.attachments ?? []).map((att) => (
              <SmallAttachTile key={att.id} itemId={item.id} attachment={att} />
            ))}
            {uploading.map((n) => (
              <div key={`up-${n}`} className="cc-attach-tile">
                <div className="cc-attach-file">Uploading…</div>
                <div className="cc-attach-meta">{n}</div>
              </div>
            ))}
          </div>
        )}
        <label
          className="cc-attach-dropzone cc-attach-dropzone--compact"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files?.length) void handleFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            onChange={(e) => {
              if (e.target.files) void handleFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <span>
            <Icon name="paperclip" size={14} />{' '}
            Drop a file, or <strong>tap to pick</strong>
          </span>
        </label>
      </div>

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

// ── Convert forms ───────────────────────────────────────────────

function ConvertForm({
  item,
  destination,
  clients,
  projects,
  onDone,
}: {
  item: InboxItem;
  destination: ConvertDestination;
  clients: Client[];
  projects: Project[];
  onDone: () => void;
}) {
  switch (destination) {
    case 'task':
      return (
        <ConvertToTask item={item} projects={projects} onDone={onDone} />
      );
    case 'correspondence':
      return (
        <ConvertToCorrespondence
          item={item}
          clients={clients}
          projects={projects}
          onDone={onDone}
        />
      );
    case 'knowledge':
      return <ConvertToKnowledge item={item} onDone={onDone} />;
    case 'feature-request':
      return <ConvertToFR item={item} projects={projects} onDone={onDone} />;
    case 'project':
      return (
        <ConvertToProject item={item} clients={clients} onDone={onDone} />
      );
    case 'email':
      return (
        <ConvertToEmail item={item} clients={clients} onDone={onDone} />
      );
  }
}

function ConvertCardShell({
  title,
  children,
  onCancel,
}: {
  title: string;
  children: ReactNode;
  onCancel: () => void;
}) {
  return (
    <div className="cc-card cc-convert-form space-y-3 p-5">
      <div className="flex items-center justify-between">
        <span className="cc-eyebrow">Convert to {title}</span>
        <button
          type="button"
          className="cc-btn-ghost"
          onClick={onCancel}
          style={{ padding: '0.3rem 0.7rem', fontSize: '0.72rem' }}
        >
          Cancel
        </button>
      </div>
      {children}
    </div>
  );
}

async function finishConvert(
  item: InboxItem,
  destinationLabel: string,
  destinationTitle: string,
): Promise<void> {
  await archiveInboxItem(
    item.id,
    `→ Converted to ${destinationLabel}: ${destinationTitle}`,
  );
}

// ─ Convert → Task

function ConvertToTask({
  item,
  projects,
  onDone,
}: {
  item: InboxItem;
  projects: Project[];
  onDone: () => void;
}) {
  const firstLine = firstLineOf(item.text);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '');
  const [title, setTitle] = useState(firstLine);
  const [priority, setPriority] = useState<'low' | 'normal' | 'high'>('normal');
  const [dueDate, setDueDate] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const project = projects.find((p) => p.id === projectId);
  const canSubmit = !!project && title.trim().length > 0;

  async function submit() {
    if (!project) return;
    setBusy(true);
    try {
      await addTask(project.id, project.tasks ?? [], {
        title: title.trim(),
        priority,
        dueDate: dueDate || undefined,
        notes: notesFromTags(item.tags),
      });
      await finishConvert(item, 'Task', title.trim());
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConvertCardShell title="Task" onCancel={onDone}>
      {projects.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          No projects yet — create one first.
        </p>
      ) : (
        <>
          <label className="block">
            <span className="cc-eyebrow mb-1 block">Project</span>
            <select
              className="cc-input"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} · {p.clientName}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="cc-eyebrow mb-1 block">Title</span>
            <input
              className="cc-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="cc-eyebrow mb-1 block">Priority</span>
              <select
                className="cc-input"
                value={priority}
                onChange={(e) =>
                  setPriority(e.target.value as 'low' | 'normal' | 'high')
                }
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </label>
            <label className="block">
              <span className="cc-eyebrow mb-1 block">Due (optional)</span>
              <input
                type="date"
                className="cc-input"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </label>
          </div>
          <button
            type="button"
            className="cc-btn-primary"
            disabled={!canSubmit || busy}
            onClick={() => void submit()}
          >
            {busy ? 'Converting…' : 'Convert to task'}
          </button>
        </>
      )}
    </ConvertCardShell>
  );
}

// ─ Convert → Correspondence

function ConvertToCorrespondence({
  item,
  clients,
  projects,
  onDone,
}: {
  item: InboxItem;
  clients: Client[];
  projects: Project[];
  onDone: () => void;
}) {
  const today = isoToday();
  const firstLine = firstLineOf(item.text);
  // Pre-fill client if there's exactly one client mention.
  const clientMention = (item.mentions ?? []).find((m) => m.type === 'client');
  const [clientId, setClientId] = useState(
    clientMention?.id ?? clients[0]?.id ?? '',
  );
  const projectMention = (item.mentions ?? []).find((m) => m.type === 'project');
  const [projectId, setProjectId] = useState(projectMention?.id ?? '');
  const [type, setType] = useState<'meeting' | 'call' | 'email' | 'note'>('note');
  const [title, setTitle] = useState(firstLine);
  const [busy, setBusy] = useState(false);

  const client = clients.find((c) => c.id === clientId);
  const clientProjects = projects.filter((p) => p.clientId === clientId);
  const canSubmit = !!client && title.trim().length > 0;

  async function submit() {
    if (!client) return;
    const project = projectId ? projects.find((p) => p.id === projectId) : undefined;
    setBusy(true);
    try {
      await createCorrespondence({
        clientId: client.id,
        clientName: client.name,
        projectId: project?.id,
        projectTitle: project?.title,
        type,
        date: today,
        title: title.trim(),
        body: item.text,
        contactIds: [],
      });
      await finishConvert(item, 'Correspondence', title.trim());
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConvertCardShell title="Correspondence" onCancel={onDone}>
      {clients.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          No clients yet — add one first.
        </p>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="cc-eyebrow mb-1 block">Client</span>
              <select
                className="cc-input"
                value={clientId}
                onChange={(e) => {
                  setClientId(e.target.value);
                  setProjectId('');
                }}
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="cc-eyebrow mb-1 block">Type</span>
              <select
                className="cc-input"
                value={type}
                onChange={(e) =>
                  setType(e.target.value as 'meeting' | 'call' | 'email' | 'note')
                }
              >
                {CORRESPONDENCE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {CORRESPONDENCE_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {clientProjects.length > 0 && (
            <label className="block">
              <span className="cc-eyebrow mb-1 block">Project (optional)</span>
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
            <span className="cc-eyebrow mb-1 block">Title</span>
            <input
              className="cc-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
            The captured text becomes the correspondence body (today's date).
          </p>
          <button
            type="button"
            className="cc-btn-primary"
            disabled={!canSubmit || busy}
            onClick={() => void submit()}
          >
            {busy ? 'Converting…' : 'Convert to correspondence'}
          </button>
        </>
      )}
    </ConvertCardShell>
  );
}

// ─ Convert → Knowledge (writes a knowledgeDrafts/ doc; MCP picks up later)

const KNOWLEDGE_CATEGORIES: KnowledgeDraftCategory[] = [
  'Patterns',
  'Decisions',
  'Context',
  'Mistakes',
  'Systems',
  'People',
  'General',
];

function ConvertToKnowledge({
  item,
  onDone,
}: {
  item: InboxItem;
  onDone: () => void;
}) {
  const firstLine = firstLineOf(item.text);
  const [category, setCategory] = useState<KnowledgeDraftCategory>('Context');
  const [title, setTitle] = useState(firstLine);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await createKnowledgeDraft({
        category,
        title: title.trim(),
        body: item.text,
        tags: item.tags,
        sourceInboxItemId: item.id,
      });
      await finishConvert(item, 'Knowledge', title.trim());
      setDone(true);
      // Give the success message a moment, then close.
      setTimeout(onDone, 1800);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <ConvertCardShell title="Knowledge note" onCancel={onDone}>
        <p className="text-sm" style={{ color: 'var(--accent-bright)' }}>
          Draft saved.
        </p>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          To ship this to the vault, ask Claude:{' '}
          <code style={{ background: 'var(--surface-hover)', padding: '0.1em 0.4em', borderRadius: 4 }}>
            vault_write_knowledge category={category} title="{title}"
          </code>
        </p>
      </ConvertCardShell>
    );
  }

  return (
    <ConvertCardShell title="Knowledge note" onCancel={onDone}>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="cc-eyebrow mb-1 block">Category</span>
          <select
            className="cc-input"
            value={category}
            onChange={(e) => setCategory(e.target.value as KnowledgeDraftCategory)}
          >
            {KNOWLEDGE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="cc-eyebrow mb-1 block">Title</span>
          <input
            className="cc-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
      </div>
      <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
        Saved as a draft in <code>knowledgeDrafts/</code>. Run{' '}
        <code>vault_write_knowledge</code> from Claude to publish to the vault.
      </p>
      <button
        type="button"
        className="cc-btn-primary"
        disabled={busy || title.trim() === ''}
        onClick={() => void submit()}
      >
        {busy ? 'Saving…' : 'Save draft'}
      </button>
    </ConvertCardShell>
  );
}

// ─ Convert → Feature Request

function ConvertToFR({
  item,
  projects,
  onDone,
}: {
  item: InboxItem;
  projects: Project[];
  onDone: () => void;
}) {
  const projectMention = (item.mentions ?? []).find((m) => m.type === 'project');
  const [projectId, setProjectId] = useState(
    projectMention?.id ?? projects[0]?.id ?? '',
  );
  const [title, setTitle] = useState(firstLineOf(item.text));
  const [status, setStatus] = useState<typeof FEATURE_REQUEST_STATUSES[number]>('proposed');
  const [busy, setBusy] = useState(false);

  const project = projects.find((p) => p.id === projectId);
  const canSubmit = !!project && title.trim().length > 0;

  async function submit() {
    if (!project) return;
    setBusy(true);
    try {
      await addFeatureRequest(project.id, {
        title: title.trim(),
        description: notesFromTags(item.tags),
        status,
      });
      await finishConvert(item, 'Feature Request', title.trim());
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConvertCardShell title="Feature Request" onCancel={onDone}>
      {projects.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          No projects yet — create one first.
        </p>
      ) : (
        <>
          <label className="block">
            <span className="cc-eyebrow mb-1 block">Project</span>
            <select
              className="cc-input"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} · {p.clientName}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="cc-eyebrow mb-1 block">Title</span>
            <input
              className="cc-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="cc-eyebrow mb-1 block">Status</span>
            <select
              className="cc-input"
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as typeof FEATURE_REQUEST_STATUSES[number])
              }
            >
              {FEATURE_REQUEST_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {FEATURE_REQUEST_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="cc-btn-primary"
            disabled={!canSubmit || busy}
            onClick={() => void submit()}
          >
            {busy ? 'Converting…' : 'Convert to feature request'}
          </button>
        </>
      )}
    </ConvertCardShell>
  );
}

// ─ Convert → Project

function ConvertToProject({
  item,
  clients,
  onDone,
}: {
  item: InboxItem;
  clients: Client[];
  onDone: () => void;
}) {
  const clientMention = (item.mentions ?? []).find((m) => m.type === 'client');
  const [clientId, setClientId] = useState(clientMention?.id ?? '');
  const [name, setName] = useState(firstLineOf(item.text));
  const [status, setStatus] = useState<typeof PROJECT_STATUSES_UI[number]>('active');
  const [busy, setBusy] = useState(false);

  const canSubmit = clientId !== '' && name.trim().length > 0;

  async function submit() {
    const client = clients.find((c) => c.id === clientId);
    if (!client) return;
    setBusy(true);
    try {
      await createProject({
        clientId: client.id,
        clientName: client.name,
        title: name.trim(),
        status,
      });
      await finishConvert(item, 'Project', name.trim());
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConvertCardShell title="Project" onCancel={onDone}>
      {clients.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          No clients yet — add one first.
        </p>
      ) : (
        <>
          <label className="block">
            <span className="cc-eyebrow mb-1 block">Client</span>
            <select
              className="cc-input"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              <option value="">— pick a client —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="cc-eyebrow mb-1 block">Project name</span>
            <input
              className="cc-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="cc-eyebrow mb-1 block">Status</span>
            <select
              className="cc-input"
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as typeof PROJECT_STATUSES_UI[number])
              }
            >
              {PROJECT_STATUSES_UI.map((s) => (
                <option key={s} value={s}>
                  {PROJECT_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
            The captured text becomes the project brief.
          </p>
          <button
            type="button"
            className="cc-btn-primary"
            disabled={!canSubmit || busy}
            onClick={() => void submit()}
          >
            {busy ? 'Converting…' : 'Convert to project'}
          </button>
        </>
      )}
    </ConvertCardShell>
  );
}

// ─ Convert → Email (mailto:)

function ConvertToEmail({
  item,
  clients,
  onDone,
}: {
  item: InboxItem;
  clients: Client[];
  onDone: () => void;
}) {
  type ContactWithClient = Contact & { clientName: string };
  const allContacts: ContactWithClient[] = useMemo(
    () =>
      clients.flatMap((c) =>
        (c.contacts ?? [])
          .filter((p) => !!p.email)
          .map((p) => ({ ...p, clientName: c.name })),
      ),
    [clients],
  );

  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<ContactWithClient | null>(null);
  const [subject, setSubject] = useState(firstLineOf(item.text));

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allContacts.slice(0, 6);
    return allContacts
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.email ?? '').toLowerCase().includes(q) ||
          c.clientName.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [search, allContacts]);

  async function send() {
    if (!picked?.email) return;
    const url = `mailto:${encodeURIComponent(picked.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(item.text)}`;
    window.open(url, '_blank');
    await finishConvert(item, 'Quick reply', `${picked.name} <${picked.email}>`);
    onDone();
  }

  if (allContacts.length === 0) {
    return (
      <ConvertCardShell title="Quick reply" onCancel={onDone}>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          No contacts with email addresses yet. Add one under a client first.
        </p>
      </ConvertCardShell>
    );
  }

  return (
    <ConvertCardShell title="Quick reply (email)" onCancel={onDone}>
      <label className="block">
        <span className="cc-eyebrow mb-1 block">Recipient</span>
        {picked ? (
          <div className="flex items-center gap-2">
            <span className="cc-chip-static">
              {picked.name} &lt;{picked.email}&gt; · {picked.clientName}
            </span>
            <button
              type="button"
              className="cc-btn-ghost"
              onClick={() => setPicked(null)}
              style={{ padding: '0.3rem 0.7rem', fontSize: '0.72rem' }}
            >
              Change
            </button>
          </div>
        ) : (
          <>
            <input
              className="cc-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contacts by name, email, or client…"
              autoFocus
            />
            {matches.length > 0 && (
              <ul className="cc-suggest-popover" style={{ position: 'static', marginTop: 6 }}>
                {matches.map((c) => (
                  <li
                    key={`${c.id}`}
                    className="cc-suggest-item"
                    onClick={() => {
                      setPicked(c);
                      setSearch('');
                    }}
                  >
                    <Icon name="users" size={14} />
                    <span>{c.name}</span>
                    <span className="cc-suggest-meta">
                      {c.email} · {c.clientName}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </label>
      <label className="block">
        <span className="cc-eyebrow mb-1 block">Subject</span>
        <input
          className="cc-input"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
      </label>
      <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
        Opens your email client with the captured text as the body. The inbox item is auto-archived once the draft opens.
      </p>
      <button
        type="button"
        className="cc-btn-primary"
        disabled={!picked}
        onClick={() => void send()}
      >
        Open draft &amp; archive
      </button>
    </ConvertCardShell>
  );
}

// ── Archived card ───────────────────────────────────────────────

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
        <span
          className="text-xs"
          style={{ color: 'var(--text-dim)' }}
          title={fullTimestamp(item.createdAt)}
        >
          {formatRelativeDate(item.createdAt)}
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

// ── Small text helpers ──────────────────────────────────────────

function firstLineOf(text: string): string {
  return text.split('\n')[0]!.slice(0, 120).trim();
}

function notesFromTags(tags: string[]): string | undefined {
  if (tags.length === 0) return undefined;
  return `tags: ${tags.map((t) => `#${t}`).join(' ')}`;
}
