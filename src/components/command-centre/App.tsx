import { HashRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import SignIn from './auth/SignIn';
import NotAuthorized from './auth/NotAuthorized';
import AppShell from './shell/AppShell';
import Dashboard from './routes/Dashboard';
import Clients from './routes/Clients';
import ClientDetail from './routes/ClientDetail';
import Projects from './routes/Projects';
import ProjectDetail from './routes/ProjectDetail';
import Quotes from './routes/Quotes';
import QuoteDetail from './routes/QuoteDetail';
import QuotePrint from './routes/QuotePrint';
import Correspondence from './routes/Correspondence';

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}

function Gate() {
  const state = useAuth();

  if (state.status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-[var(--text-dim)]">
        Loading…
      </div>
    );
  }
  if (state.status === 'signed-out') return <SignIn />;
  if (state.status === 'not-authorized')
    return <NotAuthorized email={state.user.email} />;

  return (
    <HashRouter>
      <Routes>
        <Route path="quotes/:id/print" element={<QuotePrint />} />
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="clients" element={<Clients />} />
          <Route path="clients/:id" element={<ClientDetail />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="quotes" element={<Quotes />} />
          <Route path="quotes/:id" element={<QuoteDetail />} />
          <Route path="correspondence" element={<Correspondence />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
