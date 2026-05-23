import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient, watchClients } from '../lib/clients';
import type { Client } from '../lib/types';
import { formatRelativeDate, fullTimestamp } from '../lib/dateFormat';

export default function Clients() {
  const [clients, setClients] = useState<Client[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => watchClients(setClients), []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      const id = await createClient(name);
      setNewName('');
      setAdding(false);
      navigate(`/clients/${id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <header className="cc-page-head">
        <div>
          <h1 className="cc-page-title">Clients</h1>
          <p className="cc-page-head-meta">
            {clients === null
              ? 'Loading…'
              : `${clients.length} client${clients.length === 1 ? '' : 's'}`}
          </p>
        </div>
        {!adding && (
          <button type="button" className="cc-btn-primary" onClick={() => setAdding(true)}>
            New client
          </button>
        )}
      </header>

      {adding && (
        <form onSubmit={handleCreate} className="cc-card mb-6 flex flex-col gap-3 p-5 md:flex-row md:items-end">
          <label className="block flex-1">
            <span className="cc-eyebrow mb-2 block">School name</span>
            <input
              type="text"
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="cc-input"
              placeholder="e.g. St. John's High School"
            />
          </label>
          <div className="flex gap-2">
            <button type="submit" className="cc-btn-primary" disabled={busy || !newName.trim()}>
              {busy ? 'Creating…' : 'Create'}
            </button>
            <button
              type="button"
              className="cc-btn-ghost"
              onClick={() => {
                setAdding(false);
                setNewName('');
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {clients === null ? (
        <p className="text-sm text-[var(--text-dim)]">Loading…</p>
      ) : clients.length === 0 ? (
        <div className="cc-empty">
          <p>No clients yet.</p>
          {!adding && (
            <button
              type="button"
              className="cc-btn-ghost mt-4"
              onClick={() => setAdding(true)}
            >
              Add your first client
            </button>
          )}
        </div>
      ) : (
        <div className="cc-card overflow-hidden">
          <table className="cc-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Contacts</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr
                  key={c.id}
                  className="cc-row"
                  onClick={() => navigate(`/clients/${c.id}`)}
                >
                  <td className="font-medium">{c.name}</td>
                  <td>
                    <span className="cc-pill">{c.contacts?.length ?? 0}</span>
                  </td>
                  <td
                    className="text-[var(--text-dim)]"
                    title={fullTimestamp(c.updatedAt)}
                  >
                    {formatRelativeDate(c.updatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

