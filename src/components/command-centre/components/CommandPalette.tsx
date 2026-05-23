import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { watchClients } from '../lib/clients';
import { watchProjects } from '../lib/projects';
import { watchCorrespondence } from '../lib/correspondence';
import { watchInbox } from '../lib/inbox';
import { watchQuotes } from '../lib/quotes';
import {
  KIND_LABEL,
  buildSearchIndex,
  searchItems,
  type SearchHit,
} from '../lib/search';
import type {
  Client,
  Correspondence,
  InboxItem,
  Project,
  Quote,
} from '../lib/types';

export default function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [correspondence, setCorrespondence] = useState<Correspondence[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();

  useEffect(() => watchClients(setClients), []);
  useEffect(() => watchProjects(setProjects), []);
  useEffect(() => watchCorrespondence(setCorrespondence), []);
  useEffect(() => watchQuotes(setQuotes), []);
  useEffect(() => watchInbox(setInbox), []);

  const index = useMemo(
    () => buildSearchIndex(clients, projects, correspondence, quotes, inbox),
    [clients, projects, correspondence, quotes, inbox],
  );

  const hits = useMemo(() => searchItems(index, query), [index, query]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  function pick(hit: SearchHit) {
    navigate(hit.item.route);
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (hits.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected((i) => Math.min(i + 1, hits.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const hit = hits[selected];
      if (hit) pick(hit);
    }
  }

  if (!open) return null;

  return (
    <div
      className="cc-palette-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="cc-palette" role="dialog" aria-label="Command palette">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search clients, projects, tasks, transcripts, quotes…"
          className="cc-palette-input"
          autoComplete="off"
        />

        {query.trim() === '' ? (
          <p className="cc-palette-hint">
            Start typing to search across everything in Command Centre. ↑↓ to
            move, ↵ to open, Esc to close.
          </p>
        ) : hits.length === 0 ? (
          <p className="cc-palette-hint">No matches.</p>
        ) : (
          <ul className="cc-palette-results">
            {hits.map((hit, i) => (
              <li
                key={`${hit.item.kind}-${hit.item.id}`}
                className={`cc-palette-row ${i === selected ? 'is-selected' : ''}`}
                onMouseEnter={() => setSelected(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(hit);
                }}
              >
                <span className="cc-palette-kind">{KIND_LABEL[hit.item.kind]}</span>
                <div className="min-w-0 flex-1">
                  <p className="cc-palette-title">
                    {highlight(hit.item.title, query)}
                  </p>
                  <p className="cc-palette-sub">{hit.item.subtitle}</p>
                  {hit.snippet && (
                    <p className="cc-palette-snippet">
                      {highlight(hit.snippet, query)}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * Case-insensitively wraps each query token in <mark>.
 * Multi-word queries highlight each token independently.
 */
function highlight(text: string, query: string): ReactNode {
  const tokens = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return text;
  const escaped = tokens
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  // Capturing group so `split` keeps the matched delimiters.
  const splitRe = new RegExp(`(${escaped})`, 'gi');
  const matchRe = new RegExp(`^(?:${escaped})$`, 'i');
  const parts = text.split(splitRe);
  return parts.map((part, i) =>
    matchRe.test(part) ? (
      <mark
        key={i}
        style={{
          background: 'rgba(125, 104, 255, 0.28)',
          color: 'var(--accent-bright)',
          padding: 0,
          borderRadius: 2,
        }}
      >
        {part}
      </mark>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}
