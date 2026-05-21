import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { syncAllToVault } from './sync';
import { watchSettings, type Settings } from './settings';

const DEBOUNCE_MS = 15_000;
const WATCHED = ['clients', 'projects', 'correspondence', 'quotes', 'inbox'] as const;

export type AutoSyncStatus =
  | { kind: 'disabled' }
  | { kind: 'idle'; lastAt?: number }
  | { kind: 'pending'; queuedAt: number }
  | { kind: 'syncing'; startedAt: number }
  | { kind: 'error'; message: string; at: number };

const Ctx = createContext<AutoSyncStatus>({ kind: 'disabled' });

export function useAutoSyncStatus(): AutoSyncStatus {
  return useContext(Ctx);
}

export function AutoSyncProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AutoSyncStatus>({ kind: 'disabled' });
  const settingsRef = useRef<Settings>({});
  const dirtyRef = useRef(false);
  const syncingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seenInitialRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const unsubSettings = watchSettings((s) => {
      settingsRef.current = s ?? {};
      if (!canSync(s)) setStatus({ kind: 'disabled' });
      else setStatus((prev) => (prev.kind === 'disabled' ? { kind: 'idle' } : prev));
    });

    const unsubColls = WATCHED.map((col) =>
      onSnapshot(collection(db, col), () => {
        if (!seenInitialRef.current.has(col)) {
          seenInitialRef.current.add(col);
          return;
        }
        markDirty();
      }),
    );

    function markDirty() {
      dirtyRef.current = true;
      if (!canSync(settingsRef.current)) return;
      if (syncingRef.current) return;
      setStatus({ kind: 'pending', queuedAt: Date.now() });
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(runSync, DEBOUNCE_MS);
    }

    async function runSync() {
      if (!canSync(settingsRef.current)) return;
      if (syncingRef.current) return;
      syncingRef.current = true;
      dirtyRef.current = false;
      setStatus({ kind: 'syncing', startedAt: Date.now() });
      try {
        await syncAllToVault(settingsRef.current.github!);
        setStatus({ kind: 'idle', lastAt: Date.now() });
      } catch (err) {
        setStatus({
          kind: 'error',
          message: err instanceof Error ? err.message : String(err),
          at: Date.now(),
        });
      } finally {
        syncingRef.current = false;
        if (dirtyRef.current) {
          setStatus({ kind: 'pending', queuedAt: Date.now() });
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(runSync, DEBOUNCE_MS);
        }
      }
    }

    return () => {
      unsubSettings();
      unsubColls.forEach((u) => u());
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return <Ctx.Provider value={status}>{children}</Ctx.Provider>;
}

function canSync(s: Settings | undefined): boolean {
  return (
    !!s?.github?.pat &&
    !!s.github.owner &&
    !!s.github.repo &&
    s?.sync?.autoSync === true
  );
}
