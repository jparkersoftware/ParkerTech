/**
 * Vault → CC read panels.
 *
 * VaultDailyCard (dashboard): today's Daily note from the Obsidian vault —
 * falls back to yesterday's so mornings still show context. Read-only,
 * with an Open-in-Obsidian deep link.
 *
 * VaultKnowledgePanel (client pages): Knowledge notes that mention this
 * client, parsed from the auto-generated Knowledge/Index.md catalogue.
 *
 * Both render nothing when the vault isn't configured or has nothing to
 * show — they're ambient, not chrome.
 */
import { useEffect, useState } from 'react';
import { watchSettings, type Settings } from '../lib/settings';
import {
  filterKnowledge,
  isoToday,
  parseKnowledgeIndex,
  readVaultFile,
  stripFrontmatter,
  type KnowledgeEntry,
} from '../lib/vaultRead';
import type { GithubConfig } from '../lib/github';
import Icon from './Icon';
import ObsidianLink from './ObsidianLink';

function useGithubConfig(): GithubConfig | null {
  const [cfg, setCfg] = useState<GithubConfig | null>(null);
  useEffect(
    () =>
      watchSettings((s: Settings) => {
        const g = s.github;
        setCfg(g?.owner && g.repo && g.pat ? g : null);
      }),
    [],
  );
  return cfg;
}

// ── Daily note on the dashboard ──────────────────────────────────

export function VaultDailyCard() {
  const cfg = useGithubConfig();
  const [state, setState] = useState<{
    date: string;
    text: string;
  } | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!cfg) return;
    let cancelled = false;
    (async () => {
      try {
        const today = isoToday();
        let date = today;
        let raw = await readVaultFile(cfg, `Daily/${today}.md`);
        if (!raw) {
          const y = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
          raw = await readVaultFile(cfg, `Daily/${y}.md`);
          date = y;
        }
        if (!cancelled && raw) {
          setState({ date, text: stripFrontmatter(raw).trim() });
        }
      } catch {
        // Vault read is ambient — never let it break the dashboard.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cfg]);

  if (!state) return null;

  const isToday = state.date === isoToday();
  const preview = state.text.split('\n').slice(0, open ? undefined : 6).join('\n');
  const truncated = !open && state.text.split('\n').length > 6;

  return (
    <section className="mb-8">
      <div className="cc-section-head-v2">
        <Icon name="file-text" className="cc-section-icon" />
        <h2 className="cc-section-title-v2">
          {isToday ? "Today's Daily note" : 'Latest Daily note'}
        </h2>
        <span className="cc-triage-count">{state.date} · from the vault</span>
        <span className="cc-vault-actions">
          <ObsidianLink file={`Daily/${state.date}`} label="Open" />
        </span>
      </div>
      <div className="cc-card cc-vault-note">
        <pre className="cc-vault-pre">{preview}</pre>
        {truncated && (
          <button type="button" className="cc-vault-more" onClick={() => setOpen(true)}>
            Show all ↓
          </button>
        )}
      </div>
    </section>
  );
}

// ── Knowledge panel on client pages ──────────────────────────────

export function VaultKnowledgePanel({ match }: { match: string }) {
  const cfg = useGithubConfig();
  const [entries, setEntries] = useState<KnowledgeEntry[] | null>(null);

  useEffect(() => {
    if (!cfg || !match) return;
    let cancelled = false;
    (async () => {
      try {
        const idx = await readVaultFile(cfg, 'Knowledge/Index.md');
        if (!idx || cancelled) return;
        setEntries(filterKnowledge(parseKnowledgeIndex(idx), match).slice(0, 8));
      } catch {
        // ambient — stay silent
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cfg, match]);

  if (!entries || entries.length === 0) return null;

  return (
    <section>
      <div className="cc-section-head-v2">
        <Icon name="file-text" className="cc-section-icon" />
        <h2 className="cc-section-title-v2">Knowledge</h2>
        <span className="cc-triage-count">from the vault</span>
      </div>
      <ul className="cc-card overflow-hidden p-0">
        {entries.map((e) => (
          <li key={e.path}>
            <a
              className="cc-vault-k-row"
              href={`obsidian://open?vault=ParkerTechFire&file=${encodeURIComponent(e.path)}`}
              title={e.path}
            >
              <p className="cc-task-title">{e.title}</p>
              <p className="cc-task-meta cc-vault-k-summary">{e.summary}</p>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
