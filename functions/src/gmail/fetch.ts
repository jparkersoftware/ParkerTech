/**
 * Manual Gmail fetch — pulls new messages, dedupes by Gmail messageId, writes
 * each new one to `emailCandidates/` with status=`pending`. The Correspondence
 * page renders the queue and lets Joseph approve or skip each.
 *
 * Callable (rather than raw HTTP) so we get the Firebase Auth context for the
 * UID gate without writing a bearer-token check ourselves.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { google, gmail_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { initAdmin, ALLOWED_UID } from '../adminInit';
import {
  GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET,
  GMAIL_REDIRECT_URI,
} from './oauth';

initAdmin();

type Result = {
  ok: boolean;
  fetched: number;
  alreadyKnown: number;
  errors: { messageId: string; error: string }[];
};

export const gmailFetchPendingEmails = onCall(
  {
    secrets: [GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REDIRECT_URI],
    timeoutSeconds: 300,
    memory: '512MiB',
  },
  async (request): Promise<Result> => {
    if (request.auth?.uid !== ALLOWED_UID) {
      throw new HttpsError('permission-denied', 'Not authorised.');
    }

    const days = clampInt((request.data as { days?: number } | null)?.days, 1, 90, 7);
    const clientDomains = sanitiseDomains(
      (request.data as { clientDomains?: unknown } | null)?.clientDomains,
    );
    return runGmailFetch(days, clientDomains);
  },
);

/**
 * Scheduled pull every 6 hours. Unlike the manual button (which can sweep
 * everything), this stays scoped to client-contact domains derived live from
 * the clients collection, so the queue fills with relevant mail only.
 */
export const gmailScheduledFetch = onSchedule(
  {
    schedule: 'every 6 hours',
    timeZone: 'Europe/London',
    secrets: [GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REDIRECT_URI],
    timeoutSeconds: 300,
    memory: '512MiB',
  },
  async () => {
    const domains = await deriveClientDomains();
    if (domains.length === 0) {
      logger.info('Scheduled Gmail fetch skipped — no client contact domains');
      return;
    }
    const res = await runGmailFetch(2, domains);
    logger.info('Scheduled Gmail fetch done', {
      fetched: res.fetched,
      alreadyKnown: res.alreadyKnown,
      errors: res.errors.length,
    });
  },
);

/** Free-mail domains that would match far too much if used as filters. */
const GENERIC_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'hotmail.co.uk',
  'yahoo.com',
  'yahoo.co.uk',
  'icloud.com',
  'me.com',
  'live.com',
  'live.co.uk',
]);

/** Client-contact email domains, straight from the clients collection. */
async function deriveClientDomains(): Promise<string[]> {
  const db = getFirestore();
  const snap = await db.collection('clients').get();
  const domains = new Set<string>();
  for (const docSnap of snap.docs) {
    const contacts = (docSnap.data().contacts ?? []) as { email?: string }[];
    for (const c of contacts) {
      const at = c.email?.lastIndexOf('@') ?? -1;
      if (!c.email || at < 0) continue;
      const d = c.email.slice(at + 1).toLowerCase().trim();
      if (d && !GENERIC_DOMAINS.has(d)) domains.add(d);
    }
  }
  return [...domains];
}

async function runGmailFetch(days: number, clientDomains: string[]): Promise<Result> {
    const db = getFirestore();
    const integrationRef = db.collection('integrations').doc('gmail');
    const integrationSnap = await integrationRef.get();
    if (!integrationSnap.exists) {
      throw new HttpsError('failed-precondition', 'Gmail is not connected yet.');
    }
    const integration = integrationSnap.data() as {
      accessToken?: string;
      refreshToken?: string;
      expiryDate?: number | null;
      scope?: string;
      email?: string;
    };

    if (!integration.refreshToken) {
      throw new HttpsError(
        'failed-precondition',
        'No refresh token stored — reconnect Gmail (the consent screen must grant offline access).',
      );
    }

    const oauth2Client = new google.auth.OAuth2(
      GMAIL_CLIENT_ID.value(),
      GMAIL_CLIENT_SECRET.value(),
      GMAIL_REDIRECT_URI.value(),
    );
    oauth2Client.setCredentials({
      access_token: integration.accessToken ?? undefined,
      refresh_token: integration.refreshToken,
      expiry_date: integration.expiryDate ?? undefined,
      scope: integration.scope ?? undefined,
      token_type: 'Bearer',
    });

    // googleapis auto-refreshes when expired. Persist any new token so future
    // calls don't have to refresh again unnecessarily.
    oauth2Client.on('tokens', (tokens) => {
      const patch: Record<string, unknown> = {};
      if (tokens.access_token) patch.accessToken = tokens.access_token;
      if (tokens.refresh_token) patch.refreshToken = tokens.refresh_token;
      if (tokens.expiry_date) patch.expiryDate = tokens.expiry_date;
      if (Object.keys(patch).length > 0) {
        integrationRef.set(patch, { merge: true }).catch((err) => {
          logger.warn('Failed to persist refreshed tokens', err);
        });
      }
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const q = buildGmailQuery(days, clientDomains);
    logger.info('Gmail fetch starting', { q, days, clientDomainsCount: clientDomains.length });

    const messageIds = await listMessageIds(gmail, q);

    let fetched = 0;
    let alreadyKnown = 0;
    const errors: { messageId: string; error: string }[] = [];

    for (const id of messageIds) {
      try {
        const existing = await db
          .collection('emailCandidates')
          .where('messageId', '==', id)
          .limit(1)
          .get();
        if (!existing.empty) {
          alreadyKnown += 1;
          continue;
        }

        const msg = await gmail.users.messages.get({
          userId: 'me',
          id,
          format: 'full',
        });
        const parsed = parseMessage(msg.data);
        await db.collection('emailCandidates').add({
          ...parsed,
          status: 'pending',
          fetchedAt: FieldValue.serverTimestamp(),
        });
        fetched += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.warn('Skipping message after error', { id, message });
        errors.push({ messageId: id, error: message });
      }
    }

    // Stamp last-fetch metadata for the Settings UI.
    await integrationRef.set(
      {
        lastFetchAt: FieldValue.serverTimestamp(),
        lastFetchFetched: fetched,
        lastFetchAlreadyKnown: alreadyKnown,
        lastFetchErrors: errors.length,
        lastFetchDays: days,
      },
      { merge: true },
    );

    return { ok: true, fetched, alreadyKnown, errors };
}

async function listMessageIds(
  gmail: gmail_v1.Gmail,
  q: string,
): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const resp = await gmail.users.messages.list({
      userId: 'me',
      q,
      maxResults: 100,
      pageToken,
    });
    for (const m of resp.data.messages ?? []) {
      if (m.id) ids.push(m.id);
    }
    pageToken = resp.data.nextPageToken ?? undefined;
    // Safety cap — don't slurp 10k messages in a single call.
    if (ids.length >= 500) break;
  } while (pageToken);
  return ids;
}

function buildGmailQuery(days: number, clientDomains: string[]): string {
  // -from:me — Joseph's own sent replies aren't correspondence candidates;
  // they were flooding the triage queue as "no client match".
  const base = `newer_than:${days}d -from:me`;
  if (clientDomains.length === 0) return base;
  const domainPart = clientDomains
    .map((d) => `from:${d} OR to:${d}`)
    .join(' OR ');
  return `${base} (${domainPart})`;
}

type ParsedMessage = {
  messageId: string;
  threadId: string;
  subject: string;
  from: string;
  to: string[];
  cc: string[];
  date: string; // ISO YYYY-MM-DD
  receivedAt: number; // epoch ms (from Gmail internalDate)
  bodySnippet: string;
  bodyFull: string;
};

function parseMessage(msg: gmail_v1.Schema$Message): ParsedMessage {
  const headers = (msg.payload?.headers ?? []) as { name?: string | null; value?: string | null }[];
  const headerMap = new Map<string, string>();
  for (const h of headers) {
    if (h.name && h.value) headerMap.set(h.name.toLowerCase(), h.value);
  }

  const subject = headerMap.get('subject') ?? '';
  const from = headerMap.get('from') ?? '';
  const to = splitAddresses(headerMap.get('to'));
  const cc = splitAddresses(headerMap.get('cc'));

  const internalDate = msg.internalDate ? Number(msg.internalDate) : Date.now();
  const date = new Date(internalDate).toISOString().slice(0, 10);

  const bodyFull = extractBody(msg.payload);
  const bodySnippet = msg.snippet ?? bodyFull.slice(0, 200);

  return {
    messageId: msg.id ?? '',
    threadId: msg.threadId ?? '',
    subject,
    from,
    to,
    cc,
    date,
    receivedAt: internalDate,
    bodySnippet,
    bodyFull,
  };
}

function splitAddresses(raw: string | undefined): string[] {
  if (!raw) return [];
  // Naive split — good enough for the queue card UI; full parsing isn't worth it.
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Walk the MIME tree and return the best text representation of the body.
 * Prefer text/plain; fall back to a stripped text/html.
 */
function extractBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return '';
  const text = findPart(payload, 'text/plain');
  if (text) return decodeBody(text.body?.data);
  const html = findPart(payload, 'text/html');
  if (html) return htmlToText(decodeBody(html.body?.data));
  // Single-part message — body might be at the root.
  if (payload.body?.data) {
    const decoded = decodeBody(payload.body.data);
    if (payload.mimeType === 'text/html') return htmlToText(decoded);
    return decoded;
  }
  return '';
}

function findPart(
  part: gmail_v1.Schema$MessagePart,
  mime: string,
): gmail_v1.Schema$MessagePart | null {
  if (part.mimeType === mime && part.body?.data) return part;
  for (const child of part.parts ?? []) {
    const found = findPart(child, mime);
    if (found) return found;
  }
  return null;
}

function decodeBody(data: string | null | undefined): string {
  if (!data) return '';
  // Gmail uses URL-safe base64.
  const buf = Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  return buf.toString('utf-8');
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function clampInt(
  raw: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function sanitiseDomains(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((d) => (typeof d === 'string' ? d.trim().toLowerCase() : ''))
    .filter((d) => d && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(d));
}

// Re-export so the OAuth client constants are reachable for other modules.
export { OAuth2Client };
