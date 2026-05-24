/**
 * Email candidate queue — renders the pending Gmail imports as expandable
 * cards. Each card lets Joseph approve (opens the inline EntryForm pre-filled
 * from the email) or skip.
 *
 * Lives under components/ rather than inline in Correspondence.tsx so the
 * route file stays readable, and so the same queue can be dropped elsewhere
 * later (e.g. a dashboard widget) without lifting.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  approveCandidate,
  emailAddress,
  emailDomain,
  skipCandidate,
  watchPendingCandidates,
  type EmailCandidate,
} from '../lib/emailCandidates';
import { fetchGmailNow } from '../lib/integrations';
import { formatRelativeDate } from '../lib/dateFormat';
import { EntryForm } from '../routes/Correspondence';
import type { Client, Correspondence, Project } from '../lib/types';

type Props = {
  clients: Client[];
  projects: Project[];
};

export default function EmailCandidateQueue({ clients, projects }: Props) {
  const [candidates, setCandidates] = useState<EmailCandidate[] | null>(null);
  const [open, setOpen] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => watchPendingCandidates(setCandidates), []);

  const pendingCount = candidates?.length ?? 0;

  async function handlePull() {
    setFetching(true);
    setFetchError(null);
    setLastResult(null);
    try {
      const res = await fetchGmailNow({ days: 7 });
      setLastResult(
        `${res.fetched} new · ${res.alreadyKnown} already known${
          res.errors.length ? ` · ${res.errors.length} errored` : ''
        }`,
      );
      if (res.fetched > 0) setOpen(true);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : String(err));
    } finally {
      setFetching(false);
    }
  }

  // Don't render anything until we have a definitive answer about pending
  // count — avoids the section flashing in and out on first load.
  if (candidates === null) return null;

  return (
    <section className="mb-6">
      <div className="cc-card flex flex-wrap items-center justify-between gap-3 p-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="cc-back-link"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          {open ? '▾' : '▸'} Email candidates
          <span style={{ color: 'var(--text-dim)' }}>
            · {pendingCount} pending
          </span>
        </button>
        <div className="flex flex-wrap items-center gap-2">
          {lastResult && (
            <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
              {lastResult}
            </span>
          )}
          {fetchError && (
            <span className="text-xs" style={{ color: '#fda4af' }}>
              {fetchError}
            </span>
          )}
          <button
            type="button"
            className="cc-btn-ghost"
            onClick={handlePull}
            disabled={fetching}
          >
            {fetching ? 'Pulling…' : 'Pull new correspondence'}
          </button>
        </div>
      </div>

      {open && pendingCount === 0 && (
        <p className="cc-empty-inline mt-3">
          <span style={{ color: 'var(--text-dim)' }}>—</span> Nothing in the
          queue. Hit “Pull new correspondence” to fetch from Gmail.
        </p>
      )}

      {open && pendingCount > 0 && (
        <ul className="mt-3 space-y-3">
          {candidates!.map((c) => (
            <li key={c.id}>
              <CandidateCard
                candidate={c}
                clients={clients}
                projects={projects}
                isEditing={editingId === c.id}
                onStartEdit={() => setEditingId(c.id)}
                onCloseEdit={() => setEditingId(null)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CandidateCard({
  candidate,
  clients,
  projects,
  isEditing,
  onStartEdit,
  onCloseEdit,
}: {
  candidate: EmailCandidate;
  clients: Client[];
  projects: Project[];
  isEditing: boolean;
  onStartEdit: () => void;
  onCloseEdit: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guess the client from the from/to domain — preselects the client picker
  // in the EntryForm so Joseph doesn't have to pick it manually for known
  // domains.
  const guessedClientId = useMemo(
    () => guessClientFromCandidate(candidate, clients),
    [candidate, clients],
  );

  async function handleSkip() {
    setBusy(true);
    setError(null);
    try {
      await skipCandidate(candidate.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleQuickSave() {
    const client = clients.find((c) => c.id === guessedClientId);
    if (!client) {
      onStartEdit();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await approveCandidate(candidate.id, {
        clientId: client.id,
        clientName: client.name,
        type: 'email',
        date: candidate.date,
        title: candidate.subject || '(no subject)',
        body: candidate.bodySnippet,
        transcript: candidate.bodyFull,
        contactIds: matchContactsForCandidate(candidate, client),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (isEditing) {
    return (
      <div className="cc-card p-5">
        <CandidateHeader candidate={candidate} />
        <div className="mt-4">
          <EntryForm
            clients={clients}
            projects={projects}
            defaultClientId={guessedClientId}
            initial={candidatePrefill(candidate)}
            onCancel={onCloseEdit}
            onSubmit={async (data) => {
              await approveCandidate(candidate.id, data);
              onCloseEdit();
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <article className="cc-card p-5">
      <CandidateHeader candidate={candidate} />
      <p
        className="mt-3 whitespace-pre-wrap text-sm"
        style={{ color: 'var(--text-muted)' }}
      >
        {candidate.bodySnippet}
      </p>
      {error && <p className="cc-error mt-3">{error}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="cc-btn-primary"
          onClick={onStartEdit}
          disabled={busy}
        >
          Save as correspondence
        </button>
        {guessedClientId && (
          <button
            type="button"
            className="cc-btn-ghost"
            onClick={handleQuickSave}
            disabled={busy}
            title="Save with defaults (matched client, email body as transcript)"
          >
            {busy ? 'Saving…' : 'Save & next'}
          </button>
        )}
        <button
          type="button"
          className="cc-btn-ghost"
          onClick={handleSkip}
          disabled={busy}
        >
          Skip
        </button>
        {guessedClientId && (
          <span
            className="ml-auto text-xs"
            style={{ color: 'var(--text-dim)' }}
          >
            matched: {clients.find((c) => c.id === guessedClientId)?.name}
          </span>
        )}
      </div>
    </article>
  );
}

function CandidateHeader({ candidate }: { candidate: EmailCandidate }) {
  return (
    <header>
      <div className="flex flex-wrap items-center gap-2">
        <span className="cc-chip-static">email</span>
        <span className="text-sm" style={{ color: 'var(--text-dim)' }}>
          {formatRelativeDate(candidate.date)}
        </span>
      </div>
      <h3 className="cc-display mt-2 text-base">
        {candidate.subject || '(no subject)'}
      </h3>
      <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
        <strong>From:</strong> {candidate.from}
        {candidate.to.length > 0 && (
          <>
            <span style={{ color: 'var(--text-dim)' }}> · </span>
            <strong>To:</strong> {candidate.to.join(', ')}
          </>
        )}
      </p>
    </header>
  );
}

/**
 * Build a partial Correspondence shape so the EntryForm renders pre-filled.
 * `id` is dummied because EntryForm uses it as the "edit existing" signal —
 * but our onSubmit creates a new record via approveCandidate, so the id is
 * never read.
 */
/**
 * Build the partial Correspondence the EntryForm renders from. EntryForm
 * only reads a handful of fields; the cast through `unknown` lets us skip
 * the Timestamps we don't actually need for the create flow.
 */
function candidatePrefill(c: EmailCandidate): Correspondence {
  return {
    id: c.id,
    clientId: '',
    clientName: '',
    type: 'email',
    date: c.date,
    title: c.subject || '(no subject)',
    body: c.bodySnippet,
    transcript: c.bodyFull,
    contactIds: [],
  } as unknown as Correspondence;
}

function guessClientFromCandidate(
  c: EmailCandidate,
  clients: Client[],
): string | undefined {
  const domains = new Set<string>();
  for (const addr of [c.from, ...c.to, ...c.cc]) {
    const d = emailDomain(addr);
    if (d) domains.add(d);
  }
  for (const client of clients) {
    for (const contact of client.contacts ?? []) {
      if (!contact.email) continue;
      const d = emailDomain(contact.email);
      if (d && domains.has(d)) return client.id;
    }
  }
  return undefined;
}

function matchContactsForCandidate(c: EmailCandidate, client: Client): string[] {
  const addresses = new Set(
    [c.from, ...c.to, ...c.cc].map((a) => emailAddress(a)),
  );
  return (client.contacts ?? [])
    .filter((contact) => contact.email && addresses.has(contact.email.toLowerCase()))
    .map((contact) => contact.id);
}
