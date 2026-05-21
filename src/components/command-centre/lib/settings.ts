import {
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { Timestamp } from 'firebase/firestore';
import { db } from './firebase';

export type SyncResult = 'ok' | 'error';

export type Settings = {
  github?: {
    owner: string;
    repo: string;
    branch: string;
    pat: string;
  };
  sync?: {
    autoSync?: boolean;
    lastSyncAt?: Timestamp;
    lastSyncResult?: SyncResult;
    lastSyncError?: string;
    lastSyncCount?: number;
  };
};

const REF = doc(db, 'meta', 'settings');

export function watchSettings(cb: (s: Settings) => void): Unsubscribe {
  return onSnapshot(REF, (snap) => {
    cb((snap.data() as Settings) ?? {});
  });
}

export async function updateGithubSettings(
  github: NonNullable<Settings['github']>,
): Promise<void> {
  await setDoc(REF, { github }, { merge: true });
}

export async function setAutoSync(enabled: boolean): Promise<void> {
  await setDoc(REF, { sync: { autoSync: enabled } }, { merge: true });
}

export async function recordSyncResult(
  result: SyncResult,
  details: { count?: number; error?: string },
): Promise<void> {
  await setDoc(
    REF,
    {
      sync: {
        lastSyncAt: serverTimestamp(),
        lastSyncResult: result,
        lastSyncCount: details.count ?? 0,
        lastSyncError: details.error ?? '',
      },
    },
    { merge: true },
  );
}
