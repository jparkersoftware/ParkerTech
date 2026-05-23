import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  watchCorrespondenceForClient,
  watchCorrespondenceForProject,
} from '../lib/correspondence';
import type { Correspondence } from '../lib/types';
import TypePill from './TypePill';
import AutoLinkText from './AutoLinkText';
import { formatRelativeDate, fullTimestamp } from '../lib/dateFormat';

type Props =
  | { scope: 'client'; id: string; fallbackClientId?: undefined }
  | { scope: 'project'; id: string; fallbackClientId?: string };

export default function CorrespondenceFeed({
  scope,
  id,
  fallbackClientId,
}: Props) {
  const [entries, setEntries] = useState<Correspondence[] | null>(null);
  const [clientFallback, setClientFallback] = useState<Correspondence[] | null>(
    null,
  );

  useEffect(() => {
    return scope === 'client'
      ? watchCorrespondenceForClient(id, setEntries)
      : watchCorrespondenceForProject(id, setEntries);
  }, [scope, id]);

  // For project scope: also watch the parent client's correspondence so we
  // can fall back to client-level entries when the project itself has none.
  useEffect(() => {
    if (scope !== 'project' || !fallbackClientId) {
      setClientFallback(null);
      return;
    }
    return watchCorrespondenceForClient(fallbackClientId, setClientFallback);
  }, [scope, fallbackClientId]);

  if (entries === null) {
    return <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Loading…</p>;
  }

  if (entries.length > 0) {
    return <EntryList entries={entries} />;
  }

  // Project scope, no direct entries — try the client fallback.
  if (scope === 'project' && fallbackClientId) {
    if (clientFallback === null) {
      return <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Loading…</p>;
    }
    if (clientFallback.length > 0) {
      return (
        <div className="space-y-2">
          <p
            className="cc-eyebrow"
            style={{ fontSize: '0.66rem' }}
          >
            From the client (not project-tagged)
          </p>
          <EntryList entries={clientFallback} />
        </div>
      );
    }
  }

  return (
    <p className="cc-empty-inline">
      <span style={{ color: 'var(--text-dim)' }}>—</span> No correspondence logged yet.
    </p>
  );
}

function EntryList({ entries }: { entries: Correspondence[] }) {
  return (
    <ul className="space-y-3">
      {entries.slice(0, 8).map((e) => (
        <li key={e.id}>
          <Link
            to="/correspondence"
            className="cc-card flex items-start justify-between gap-3 p-4 transition hover:bg-[var(--surface-hover)]"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <TypePill type={e.type} />
                <span
                  className="text-xs"
                  style={{ color: 'var(--text-dim)' }}
                  title={fullTimestamp(e.date)}
                >
                  {formatRelativeDate(e.date)}
                </span>
              </div>
              <p className="mt-2 font-medium">{e.title}</p>
              {e.body && (
                <p
                  className="mt-1 line-clamp-2 text-sm"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <AutoLinkText text={e.body} />
                </p>
              )}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
