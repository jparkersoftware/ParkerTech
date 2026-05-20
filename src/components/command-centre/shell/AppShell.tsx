import { Outlet } from 'react-router-dom';
import { signOutNow, useAuth } from '../auth/AuthProvider';
import SideNav from './SideNav';

export default function AppShell() {
  const state = useAuth();
  const email = state.status === 'authed' ? state.user.email : null;

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
        <header className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-soft)] px-6 py-3">
          <p className="text-xs text-[var(--text-dim)]">{email}</p>
          <button type="button" onClick={() => signOutNow()} className="cc-btn-ghost">
            Sign out
          </button>
        </header>
        <main className="flex-1 px-8 py-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
