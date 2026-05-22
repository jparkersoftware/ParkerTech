import { useEffect, useState, type FormEvent } from 'react';
import { pingRepo } from '../lib/github';
import {
  setAutoSync,
  updateGithubSettings,
  watchSettings,
  type Settings,
} from '../lib/settings';
import { syncAllToVault, type SyncProgress } from '../lib/sync';

type TestState =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'ok' }
  | { kind: 'err'; message: string };

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => watchSettings((s) => setSettings(s ?? {})), []);

  if (settings === null) {
    return <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Loading…</p>;
  }

  return (
    <div className="max-w-3xl">
      <header className="cc-page-head">
        <div>
          <h1 className="cc-page-title">Settings</h1>
          <p className="cc-page-head-meta">
            {settings.github?.pat ? 'Vault configured · ' : 'Vault not configured yet · '}
            {settings.sync?.autoSync ? 'Auto-sync on' : 'Auto-sync off'}
          </p>
        </div>
      </header>

      <VaultSection settings={settings} />
    </div>
  );
}

function VaultSection({ settings }: { settings: Settings }) {
  const initial = settings.github;
  const [owner, setOwner] = useState(initial?.owner ?? 'jparkersoftware');
  const [repo, setRepo] = useState(initial?.repo ?? 'ParkerTechFire');
  const [branch, setBranch] = useState(initial?.branch ?? 'main');
  const [pat, setPat] = useState(initial?.pat ?? '');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [test, setTest] = useState<TestState>({ kind: 'idle' });
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const lastSyncAt = settings.sync?.lastSyncAt;
  const lastSyncResult = settings.sync?.lastSyncResult;
  const lastSyncCount = settings.sync?.lastSyncCount;
  const lastSyncError = settings.sync?.lastSyncError;

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateGithubSettings({
        owner: owner.trim(),
        repo: repo.trim(),
        branch: branch.trim() || 'main',
        pat: pat.trim(),
      });
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTest({ kind: 'busy' });
    try {
      await pingRepo({
        owner: owner.trim(),
        repo: repo.trim(),
        branch: branch.trim() || 'main',
        pat: pat.trim(),
      });
      setTest({ kind: 'ok' });
    } catch (err) {
      setTest({
        kind: 'err',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function handleSyncAll() {
    if (!pat.trim()) {
      setSyncError('Save a personal access token first.');
      return;
    }
    setSyncing(true);
    setSyncError(null);
    setProgress(null);
    try {
      await syncAllToVault(
        {
          owner: owner.trim(),
          repo: repo.trim(),
          branch: branch.trim() || 'main',
          pat: pat.trim(),
        },
        (p) => setProgress(p),
      );
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
    }
  }

  return (
    <section className="mb-10">
      <h2 className="cc-display mb-3 text-xl">Obsidian vault sync</h2>
      <p className="mb-4 text-sm" style={{ color: 'var(--text-muted)' }}>
        Command Centre commits markdown files into your private GitHub repo; the
        Obsidian Git plugin on your Mac pulls them down. The token below is
        stored in Firestore under your UID — never in the bundle, never in chat.
      </p>

      <form onSubmit={handleSave} className="cc-card mb-4 space-y-4 p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="block">
            <span className="cc-eyebrow mb-2 block">Owner</span>
            <input
              type="text"
              required
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              className="cc-input"
            />
          </label>
          <label className="block">
            <span className="cc-eyebrow mb-2 block">Repo</span>
            <input
              type="text"
              required
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              className="cc-input"
            />
          </label>
          <label className="block">
            <span className="cc-eyebrow mb-2 block">Branch</span>
            <input
              type="text"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="cc-input"
            />
          </label>
        </div>
        <label className="block">
          <span className="cc-eyebrow mb-2 block">
            Personal access token{' '}
            <span style={{ color: 'var(--text-dim)', textTransform: 'none', letterSpacing: 0 }}>
              · fine-grained, Contents read/write on this repo only
            </span>
          </span>
          <input
            type="password"
            autoComplete="off"
            value={pat}
            onChange={(e) => setPat(e.target.value)}
            className="cc-input"
            placeholder={initial?.pat ? '••••••• (saved — replace to change)' : 'github_pat_...'}
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" className="cc-btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            className="cc-btn-ghost"
            onClick={handleTest}
            disabled={test.kind === 'busy' || !pat.trim()}
          >
            {test.kind === 'busy' ? 'Testing…' : 'Test connection'}
          </button>
          {savedAt && (
            <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
              Saved
            </span>
          )}
          {test.kind === 'ok' && (
            <span className="text-xs" style={{ color: '#86efac' }}>
              ✓ Connected
            </span>
          )}
          {test.kind === 'err' && (
            <span className="text-xs" style={{ color: '#fda4af' }}>
              {test.message}
            </span>
          )}
        </div>
      </form>

      <div className="cc-card mb-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium">Auto-sync on save</p>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
              When on, every change in Command Centre (new client, edited
              project, logged correspondence, etc.) is debounced 15s and pushed
              to the vault automatically. Status shows in the header.
            </p>
          </div>
          <button
            type="button"
            className="cc-btn-ghost"
            onClick={() => setAutoSync(!settings.sync?.autoSync)}
            disabled={!settings.github?.pat}
          >
            {settings.sync?.autoSync ? 'Turn off' : 'Turn on'}
          </button>
        </div>
      </div>

      <div className="cc-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-medium">Sync everything now</p>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
              Generates a markdown file for every client, project, contact,
              correspondence entry and quote, and commits them to your vault.
              Safe to run any time — it overwrites existing generated files in
              place.
            </p>
          </div>
          <button
            type="button"
            className="cc-btn-primary"
            onClick={handleSyncAll}
            disabled={syncing || !settings.github?.pat}
          >
            {syncing ? 'Syncing…' : 'Sync now'}
          </button>
        </div>

        {progress && (
          <div className="mt-4">
            {progress.phase !== 'done' && (
              <div className="cc-progress mb-2">
                <div
                  className="cc-progress-bar"
                  style={{
                    width: `${progress.total > 0 ? (progress.written / progress.total) * 100 : 0}%`,
                  }}
                />
              </div>
            )}
            <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
              {progress.phase === 'reading' && 'Reading from Firestore…'}
              {progress.phase === 'writing' &&
                `Writing ${progress.written} of ${progress.total}${progress.current ? ` · ${progress.current}` : ''}`}
              {progress.phase === 'done' &&
                `✓ Synced ${progress.written} files to the vault.`}
            </p>
          </div>
        )}

        {syncError && (
          <p className="cc-error mt-4">{syncError}</p>
        )}

        <div className="mt-5 text-xs" style={{ color: 'var(--text-dim)' }}>
          {lastSyncAt?.toDate ? (
            <>
              Last sync: {lastSyncAt.toDate().toLocaleString('en-GB')} ·{' '}
              {lastSyncResult === 'ok' ? `✓ ${lastSyncCount ?? 0} files` : `✗ ${lastSyncError ?? 'failed'}`}
            </>
          ) : (
            'Never synced.'
          )}
        </div>
      </div>
    </section>
  );
}
