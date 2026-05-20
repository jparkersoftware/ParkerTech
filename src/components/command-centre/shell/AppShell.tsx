import { Outlet } from 'react-router-dom';
import { signOutNow, useAuth } from '../auth/AuthProvider';
import SideNav from './SideNav';

export default function AppShell() {
  const state = useAuth();
  const email = state.status === 'authed' ? state.user.email : null;

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col">
        <div className="border-b border-slate-200 px-5 py-4">
          <p className="text-sm font-semibold tracking-tight">Command Centre</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-400">
            ParkerTech
          </p>
        </div>
        <SideNav />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
          <p className="text-xs text-slate-500">{email}</p>
          <button
            type="button"
            onClick={() => signOutNow()}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Sign out
          </button>
        </header>
        <main className="flex-1 px-6 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
