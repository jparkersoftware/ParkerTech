/**
 * Shared firebase-admin initialiser. Cloud Functions can import this from
 * any module without worrying about double-initialising the app.
 */
import { initializeApp, getApps } from 'firebase-admin/app';

export const ALLOWED_UID = 'vLqAisb7mAd93ZSF6Lq0IaS32hy2';

export function initAdmin(): void {
  if (getApps().length === 0) initializeApp();
}
