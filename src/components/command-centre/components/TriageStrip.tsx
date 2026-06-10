/**
 * Dashboard triage strip — works through pending email candidates one at a
 * time, card-stack style. Quick-log uses the domain-matched client; anything
 * unmatched hands off to the full queue on the Correspondence page.
 *
 * Renders nothing while loading, a quiet "inbox zero" chip when the queue is
 * empty, and the top card + progress when there's work to do.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  approveCandidate,
  guessClientFromCandidate,
  matchContactsForCandidate,
  skipCandidate,
  watchPendingCandidates,
  type EmailCandidate,
} from '../lib/emailCandidates';
import { formatRelativeDate } from '../lib/dateFormat';
import Icon from './Icon';
import type { Client } from '../lib/types';

type Props = { clients: Client[] };

export default function TriageStrip({ clients }: Props) {
  const [candidates, setCandidates] = useState<EmailCandidate[] | null>(null);
  const [leaving, setLeaving] = useState<'logged' | 'skipped' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionDone, setSessionDone] = useState(0);
  const navigate = useNavigate();

  useEffect(() => watchPendingCandidates(setCandidates), []);

  const current = candidates?.[0] ?? null;
  const guessedClient = useMemo(() => {
    if (!current) return undefined;
    const id = guessClientFromCandidate(current, clients);
    return clients.find((c) => c.id === id);
  }, [current, clients]);

  if (candidates === null) return null;

  if (candidates.length === 0) {
    return (
      <div className="cc-triage-zero mb-8">
        <Icon name="check" className="cc-triage-zero-icon" />
        <span>
          Email queue clear
          {sessionDone > 0 && ` — ${sessionDone} triaged just now`}
        </span>
      </div>
    );
  }

  async function act(kind: 'logged' | 'skipped') {
    if (!current || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (kind === 'logged') {
        if (!guessedClient) return; // button hidden in this case anyway
        await approveCandidate(current.id, {
          clientId: guessedClient.id,
          clientName: guessedClient.name,
          type: 'email',
          date: current.date,
          title: current.subject || '(no subject)',
          body: current.bodySnippet,
          transcript: current.bodyFull,
          contactIds: matchContactsForCandidate(current, guessedClient),
        });
      } else {
        await skipCandidate(current.id);
      }
      setLeaving(kind);
      setSessionDone((n) => n + 1);
      // Let the slide-out play before the snapshot listener swaps the card.
      setTimeout(() => setLeaving(null), 220);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-8">
      <div className="cc-section-head-v2">
        <Icon name="message" className="cc-section-icon" />
        <h2 className="cc-section-title-v2">Email triage</h2>
        <span className="cc-triage-count">
          {candidates.length} waiting
          {sessionDone > 0 && ` · ${sessionDone} done`}
        </span>
        <button
          type="button"
          className="cc-triage-all"
          onClick={() => navigate('/correspondence')}
        >
          Full queue →
        </button>
      </div>

      <article
        key={current!.id}
        className={`cc-card cc-triage-card ${leaving ? `is-leaving-${leaving}` : 'is-entering'}`}
      >
        <div className="cc-triage-top">
          <span className="cc-chip-static">email</span>
          <span className="cc-triage-date">{formatRelativeDate(current!.date)}</span>
          {guessedClient ? (
            <span className="cc-triage-match">
              <Icon name="users" /> {guessedClient.name}
            </span>
          ) : (
            <span className="cc-triage-match is-unknown">no client match</span>
          )}
        </div>
        <h3 className="cc-display cc-triage-subject">
          {current!.subject || '(no subject)'}
        </h3>
        <p className="cc-triage-from">{current!.from}</p>
        <p className="cc-triage-snippet">{current!.bodySnippet}</p>
        {error && <p className="cc-error mt-3">{error}</p>}
        <div className="cc-triage-actions">
          {guessedClient ? (
            <button
              type="button"
              className="cc-btn-primary"
              onClick={() => act('logged')}
              disabled={busy}
            >
              {busy ? 'Logging…' : `Log to ${guessedClient.name}`}
            </button>
          ) : (
            <button
              type="button"
              className="cc-btn-primary"
              onClick={() => navigate('/correspondence')}
            >
              Review in queue
            </button>
          )}
          <button
            type="button"
            className="cc-btn-ghost"
            onClick={() => act('skipped')}
            disabled={busy}
          >
            Skip
          </button>
        </div>
      </article>
    </section>
  );
}
