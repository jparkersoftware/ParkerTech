import { HashRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { AutoSyncProvider } from './lib/autoSync';
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
import Invoices from './routes/Invoices';
import InvoiceDetail from './routes/InvoiceDetail';
import InvoicePrint from './routes/InvoicePrint';
import Expenses from './routes/Expenses';
import ExpenseDetail from './routes/ExpenseDetail';
import Correspondence from './routes/Correspondence';
import Inbox from './routes/Inbox';
import Settings from './routes/Settings';

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
    <AutoSyncProvider>
      <HashRouter>
        <Routes>
          <Route path="quotes/:id/print" element={<QuotePrint />} />
          <Route path="invoices/:id/print" element={<InvoicePrint />} />
          <Route element={<AppShell />}>
            <Route index element={<Dashboard />} />
            <Route path="inbox" element={<Inbox />} />
            <Route path="clients" element={<Clients />} />
            <Route path="clients/:id" element={<ClientDetail />} />
            <Route path="projects" element={<Projects />} />
            <Route path="projects/:id" element={<ProjectDetail />} />
            <Route path="quotes" element={<Quotes />} />
            <Route path="quotes/:id" element={<QuoteDetail />} />
            <Route path="invoices" element={<Invoices />} />
            <Route path="invoices/:id" element={<InvoiceDetail />} />
            <Route path="expenses" element={<Expenses />} />
            <Route path="expenses/:id" element={<ExpenseDetail />} />
            <Route path="correspondence" element={<Correspondence />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </HashRouter>
    </AutoSyncProvider>
  );
}
