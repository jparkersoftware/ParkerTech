/**
 * Google OAuth flow for the Gmail integration.
 *
 * The web app never sees the client secret — it asks `gmailOAuthStart` for a
 * redirect URL, sends the user there, and Google calls `gmailOAuthCallback`
 * with the auth code. We exchange that code for tokens and stash them in
 * Firestore at `integrations/gmail`. The Firestore catch-all rule (UID-gated)
 * means only Joseph can read them back.
 */
import { defineSecret } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { google } from 'googleapis';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { initAdmin, ALLOWED_UID } from '../adminInit';

initAdmin();

export const GMAIL_CLIENT_ID = defineSecret('GMAIL_CLIENT_ID');
export const GMAIL_CLIENT_SECRET = defineSecret('GMAIL_CLIENT_SECRET');
export const GMAIL_REDIRECT_URI = defineSecret('GMAIL_REDIRECT_URI');

/** Read-only Gmail scope. We never write or send. */
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

/**
 * Returns the Google consent URL the web app should open. The web app passes
 * the signed-in user's Firebase ID token in the Authorization header — we
 * verify it here so an unauthenticated caller can't generate auth URLs that
 * grant tokens stored under Joseph's UID.
 */
export const gmailOAuthStart = onRequest(
  {
    cors: true,
    secrets: [GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REDIRECT_URI],
  },
  async (req, res) => {
    try {
      await requireAllowedUid(req);
    } catch (err) {
      res.status(401).json({ error: (err as Error).message });
      return;
    }

    const oauth2Client = makeOAuthClient();
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent', // force refresh_token on every consent
      scope: SCOPES,
      include_granted_scopes: true,
    });
    res.json({ url });
  },
);

/**
 * Google calls this with `?code=...`. Exchange for tokens, write to Firestore,
 * return a tiny HTML page that closes the popup (or shows success if the user
 * navigated in the same tab).
 */
export const gmailOAuthCallback = onRequest(
  {
    secrets: [GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REDIRECT_URI],
  },
  async (req, res) => {
    const code = req.query.code as string | undefined;
    const error = req.query.error as string | undefined;

    if (error) {
      res.status(400).send(renderHtml(`Google reported: ${error}`, false));
      return;
    }
    if (!code) {
      res.status(400).send(renderHtml('Missing `code` query param.', false));
      return;
    }

    try {
      const oauth2Client = makeOAuthClient();
      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);

      // Pull the connected email so we can show it in the UI. Gmail's own
      // getProfile works with gmail.readonly alone; the userinfo endpoint
      // would need an extra identity scope.
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      const profile = await gmail.users.getProfile({ userId: 'me' });
      const email = profile.data.emailAddress ?? '';

      const db = getFirestore();
      await db.collection('integrations').doc('gmail').set(
        {
          accessToken: tokens.access_token ?? '',
          refreshToken: tokens.refresh_token ?? '',
          scope: tokens.scope ?? SCOPES.join(' '),
          expiryDate: tokens.expiry_date ?? null,
          email,
          connectedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      res.status(200).send(renderHtml(`Connected ${email}. You can close this window.`, true));
    } catch (err) {
      logger.error('OAuth callback failed', err);
      res
        .status(500)
        .send(renderHtml(`Token exchange failed: ${(err as Error).message}`, false));
    }
  },
);

function makeOAuthClient() {
  return new google.auth.OAuth2(
    GMAIL_CLIENT_ID.value(),
    GMAIL_CLIENT_SECRET.value(),
    GMAIL_REDIRECT_URI.value(),
  );
}

/**
 * Verifies the Firebase ID token on the request and confirms it belongs to
 * the single allowed UID. Throws on failure.
 */
async function requireAllowedUid(req: { headers: { authorization?: string } }): Promise<void> {
  const header = req.headers.authorization ?? '';
  const match = header.match(/^Bearer (.+)$/);
  if (!match) throw new Error('Missing bearer token.');
  const { getAuth } = await import('firebase-admin/auth');
  const decoded = await getAuth().verifyIdToken(match[1]!);
  if (decoded.uid !== ALLOWED_UID) {
    throw new Error('Not authorised.');
  }
}

function renderHtml(message: string, ok: boolean): string {
  const colour = ok ? '#15803d' : '#b91c1c';
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Gmail OAuth</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; background:#0a0a0a; color:#e4e4e7; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; }
  .card { background:#171717; border:1px solid #262626; border-radius:12px; padding:32px 40px; max-width:480px; text-align:center; }
  .dot { display:inline-block; width:10px; height:10px; border-radius:50%; background:${colour}; margin-right:8px; }
  p { line-height:1.5; }
  small { color:#a3a3a3; }
</style>
</head><body>
<div class="card">
  <p><span class="dot"></span>${escapeHtml(message)}</p>
  <small>You can close this window and return to the Command Centre.</small>
</div>
<script>
  // Close if opened as a popup.
  try { if (window.opener) { window.opener.postMessage({ source: 'gmail-oauth', ok: ${ok} }, '*'); setTimeout(() => window.close(), 1500); } } catch (e) {}
</script>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[c] as string);
}
