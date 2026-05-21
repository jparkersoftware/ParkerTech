import { useAutoSyncStatus } from '../lib/autoSync';

export default function SyncIndicator() {
  const s = useAutoSyncStatus();

  const { tone, label, title } = describe(s);

  return (
    <span className={`cc-sync-indicator is-${tone}`} title={title}>
      <span className="cc-sync-dot" aria-hidden="true" />
      {label}
    </span>
  );
}

function describe(s: ReturnType<typeof useAutoSyncStatus>): {
  tone: 'off' | 'idle' | 'pending' | 'syncing' | 'error';
  label: string;
  title: string;
} {
  switch (s.kind) {
    case 'disabled':
      return {
        tone: 'off',
        label: 'Auto-sync off',
        title: 'Enable auto-sync in Settings to keep the Obsidian vault up to date.',
      };
    case 'idle':
      return {
        tone: 'idle',
        label: s.lastAt ? 'Vault synced' : 'Auto-sync on',
        title: s.lastAt
          ? `Last synced ${new Date(s.lastAt).toLocaleTimeString('en-GB')}`
          : 'Auto-sync is on. Nothing to push.',
      };
    case 'pending':
      return {
        tone: 'pending',
        label: 'Changes pending',
        title: 'Changes detected — will sync shortly.',
      };
    case 'syncing':
      return {
        tone: 'syncing',
        label: 'Syncing…',
        title: 'Pushing changes to the vault.',
      };
    case 'error':
      return {
        tone: 'error',
        label: 'Sync error',
        title: s.message,
      };
  }
}
