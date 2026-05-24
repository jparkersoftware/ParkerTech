/**
 * Functions entry. Re-exports each deployable function so `firebase deploy
 * --only functions` picks them up. Per-function imports keep the cold-start
 * cost down — only the file actually invoked is loaded into memory.
 */
export { gmailOAuthStart, gmailOAuthCallback } from './gmail/oauth';
export { gmailFetchPendingEmails } from './gmail/fetch';
