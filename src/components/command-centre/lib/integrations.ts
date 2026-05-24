/**
 * Client-side helpers for the Gmail integration.
 *
 * The web app never sees the OAuth client secret. It just:
 *   1. asks the `gmailOAuthStart` Function for a URL,
 *   2. opens it in a popup,
 *   3. watches Firestore for the `integrations/gmail` doc to appear,
 *   4. uses the Callable `gmailFetchPendingEmails` to pull new mail.
 */
import {
  deleteDoc,
  doc,
  onSnapshot,
  type Unsubscribe,
  type Timestamp,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { auth, db, app } from './firebase';

const REGION = 'us-central1';

export type GmailIntegration = {
  email?: string;
  connectedAt?: Timestamp;
  lastFetchAt?: Timestamp;
  lastFetchFetched?: number;
  lastFetchAlreadyKnown?: number;
  lastFetchErrors?: number;
  lastFetchDays?: number;
};

const REF = doc(db, 'integrations', 'gmail');

export function watchGmailIntegration(
  cb: (state: GmailIntegration | null) => void,
): Unsubscribe {
  return onSnapshot(REF, (snap) => {
    if (!snap.exists()) {
      cb(null);
      return;
    }
    // Strip the secret-ish fields so they don't accidentally show up in
    // anywhere the React tree dumps state.
    const raw = snap.data() as GmailIntegration & {
      accessToken?: string;
      refreshToken?: string;
    };
    const { accessToken, refreshToken, ...safe } = raw;
    void accessToken;
    void refreshToken;
    cb(safe);
  });
}

/**
 * Kick off the OAuth flow. Returns once the integration doc shows up in
 * Firestore (resolves with the connected email) or rejects after a timeout.
 */
export async function connectGmail(options: {
  timeoutMs?: number;
} = {}): Promise<{ email: string }> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in before connecting Gmail.');
  const idToken = await user.getIdToken();

  const startUrl = startEndpointUrl();
  const resp = await fetch(startUrl, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`gmailOAuthStart failed: ${resp.status} ${text}`);
  }
  const { url } = (await resp.json()) as { url: string };

  const popup = window.open(url, 'gmail-oauth', 'width=520,height=640');
  if (!popup) {
    // Popup blocked — fall back to full redirect. The caller's promise will
    // never resolve because the page navigates away; that's fine.
    window.location.href = url;
    return new Promise(() => undefined);
  }

  return new Promise<{ email: string }>((resolve, reject) => {
    const timeoutMs = options.timeoutMs ?? 5 * 60 * 1000;
    const started = Date.now();

    const unsub = onSnapshot(REF, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as GmailIntegration & { connectedAt?: Timestamp };
      const ts = data.connectedAt?.toMillis?.() ?? 0;
      // Only resolve on a *fresh* connection — older docs (from a previous
      // sign-in) shouldn't unblock the current flow.
      if (ts && ts >= started - 5_000) {
        unsub();
        clearInterval(poll);
        resolve({ email: data.email ?? '' });
      }
    });

    const poll = setInterval(() => {
      if (popup.closed) {
        // Give Firestore a moment to land the write, then bail.
        setTimeout(() => {
          unsub();
          clearInterval(poll);
          reject(new Error('OAuth window closed before completing.'));
        }, 2_500);
      }
      if (Date.now() - started > timeoutMs) {
        unsub();
        clearInterval(poll);
        try { popup.close(); } catch { /* ignore */ }
        reject(new Error('OAuth timed out.'));
      }
    }, 1_000);
  });
}

export async function disconnectGmail(): Promise<void> {
  await deleteDoc(REF);
}

export type FetchResult = {
  ok: boolean;
  fetched: number;
  alreadyKnown: number;
  errors: { messageId: string; error: string }[];
};

export async function fetchGmailNow(options: {
  days?: number;
  clientDomains?: string[];
} = {}): Promise<FetchResult> {
  const fns = getFunctions(app, REGION);
  const call = httpsCallable<
    { days?: number; clientDomains?: string[] },
    FetchResult
  >(fns, 'gmailFetchPendingEmails');
  const res = await call(options);
  return res.data;
}

/**
 * Build the gmailOAuthStart URL from the Firebase project ID. We *could* hard-
 * code the deployed URL, but reading it from the existing config keeps the
 * bundle environment-agnostic (e.g. for the emulator).
 */
function startEndpointUrl(): string {
  // app.options.projectId is set during initializeApp.
  const projectId = app.options.projectId as string | undefined;
  if (!projectId) throw new Error('Firebase projectId not available.');
  return `https://${REGION}-${projectId}.cloudfunctions.net/gmailOAuthStart`;
}
