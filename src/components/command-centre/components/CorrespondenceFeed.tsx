import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  watchCorrespondenceForClient,
  watchCorrespondenceForProject,
} from '../lib/correspondence';
import type { Correspondence } from '../lib/types';
import TypePill from './TypePill';

export default function CorrespondenceFeed({
  scope,
  id,
}: {
  scope: 'client' | 'project';
  id: string;
}) {
  const [entries, setEntries] = useState<Correspondence[] | null>(null);

  useEffect(() => {
    return scope === 'client'
      ? watchCorrespondenceForClient(id, setEntries)
      : watchCorrespondenceForProject(id, setEntries);
  }, [scope, id]);

  if (entries === null) {
    return <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Loading…</p>;
  }
  if (entries.length === 0) {
    return <div className="cc-empty">No correspondence logged yet.</div>;
  }

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
                <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
                  {formatShortDate(e.date)}
                </span>
              </div>
              <p className="mt-2 font-medium">{e.title}</p>
              {e.body && (
                <p
                  className="mt-1 line-clamp-2 text-sm"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {e.body}
                </p>
              )}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
