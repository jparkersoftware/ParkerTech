import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { signOutNow, useAuth } from '../auth/AuthProvider';
import SideNav from './SideNav';
import SyncIndicator from '../components/SyncIndicator';
import CommandPalette from '../components/CommandPalette';

export default function AppShell() {
  const state = useAuth();
  const email = state.status === 'authed' ? state.user.email : null;
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 border-r border-[var(--border)] bg-[var(--bg-soft)] md:flex md:flex-col">
        <div className="border-b border-[var(--border)] px-5 py-5">
          <p className="cc-eyebrow">ParkerTech</p>
          <p className="cc-display mt-1 text-lg">Command Centre</p>
        </div>
        <SideNav />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--bg-soft)] px-6 py-3">
          <button
            type="button"
            className="cc-search-trigger"
            onClick={() => setPaletteOpen(true)}
            aria-label="Search Command Centre"
          >
            <span aria-hidden="true">🔍</span>
            <span>Search…</span>
            <kbd>⌘K</kbd>
          </button>
          <div className="flex items-center gap-3">
            <p className="text-xs text-[var(--text-dim)]">{email}</p>
            <SyncIndicator />
            <button type="button" onClick={() => signOutNow()} className="cc-btn-ghost">
              Sign out
            </button>
          </div>
        </header>
        <main className="flex-1 px-8 py-10">
          <Outlet />
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
