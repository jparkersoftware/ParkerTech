import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  addContact,
  deleteClient,
  removeContact,
  updateClientFields,
  updateContact,
  watchClient,
} from '../lib/clients';
import { watchProjectsForClient } from '../lib/projects';
import type { Client, Contact, Project } from '../lib/types';
import StatusPill from '../components/StatusPill';
import CorrespondenceFeed from '../components/CorrespondenceFeed';

export default function ClientDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null | undefined>(undefined);

  useEffect(() => watchClient(id, setClient), [id]);

  if (client === undefined) {
    return <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Loading…</p>;
  }
  if (client === null) {
    return (
      <div>
        <Link to="/clients" className="cc-eyebrow inline-block">
          ← Clients
        </Link>
        <p className="mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>
          This client doesn't exist (or has been deleted).
        </p>
      </div>
    );
  }

  async function handleDeleteClient() {
    if (!confirm(`Delete ${client!.name}? This can't be undone.`)) return;
    await deleteClient(client!.id);
    navigate('/clients');
  }

  return (
    <div className="max-w-3xl">
      <Link to="/clients" className="cc-eyebrow inline-block">
        ← Clients
      </Link>

      <DetailsSection client={client} onDelete={handleDeleteClient} />
      <ContactsSection client={client} />
      <ProjectsForClient clientId={client.id} />

      <section className="mt-10">
        <h2 className="cc-display mb-3 text-xl">Correspondence</h2>
        <CorrespondenceFeed scope="client" id={client.id} />
      </section>
    </div>
  );
}

function ProjectsForClient({ clientId }: { clientId: string }) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const navigate = useNavigate();
  useEffect(() => watchProjectsForClient(clientId, setProjects), [clientId]);

  return (
    <section className="mt-10">
      <h2 className="cc-display mb-3 text-xl">Projects</h2>
      {projects === null ? (
        <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Loading…</p>
      ) : projects.length === 0 ? (
        <div className="cc-empty">No projects for this client yet.</div>
      ) : (
        <ul className="space-y-2">
          {projects.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => navigate(`/projects/${p.id}`)}
                className="cc-card flex w-full items-center justify-between gap-3 p-4 text-left transition hover:bg-[var(--surface-hover)]"
              >
                <span className="font-medium">{p.title}</span>
                <StatusPill status={p.status} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DetailsSection({
  client,
  onDelete,
}: {
  client: Client;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <DetailsForm
        client={client}
        onCancel={() => setEditing(false)}
        onSaved={() => setEditing(false)}
      />
    );
  }

  return (
    <section className="mt-3 mb-8">
      <header className="cc-page-head">
        <h1 className="cc-page-title">{client.name}</h1>
        <div className="flex gap-2">
          <button type="button" className="cc-btn-ghost" onClick={() => setEditing(true)}>
            Edit details
          </button>
          <button type="button" className="cc-btn-danger" onClick={onDelete}>
            Delete client
          </button>
        </div>
      </header>
      {client.notes ? (
        <div className="cc-card whitespace-pre-wrap p-6 text-sm" style={{ color: 'var(--text-muted)' }}>
          {client.notes}
        </div>
      ) : (
        <div className="cc-empty">No notes yet.</div>
      )}
    </section>
  );
}

function DetailsForm({
  client,
  onCancel,
  onSaved,
}: {
  client: Client;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(client.name);
  const [notes, setNotes] = useState(client.notes ?? '');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await updateClientFields(client.id, { name: trimmed, notes });
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="cc-card mt-3 mb-8 space-y-4 p-6">
      <label className="block">
        <span className="cc-eyebrow mb-2 block">School name</span>
        <input
          type="text"
          autoFocus
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="cc-input"
        />
      </label>
      <label className="block">
        <span className="cc-eyebrow mb-2 block">Notes</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="cc-textarea"
          placeholder="Anything worth remembering about this school — context, history, quirks."
        />
      </label>
      <div className="flex gap-2">
        <button type="submit" className="cc-btn-primary" disabled={busy || !name.trim()}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="cc-btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function ContactsSection({ client }: { client: Client }) {
  const [adding, setAdding] = useState(false);

  return (
    <section>
      <div className="mb-3 flex items-end justify-between">
        <h2 className="cc-display text-xl">Contacts</h2>
        {!adding && (
          <button type="button" className="cc-btn-ghost" onClick={() => setAdding(true)}>
            Add contact
          </button>
        )}
      </div>

      {adding && (
        <ContactForm
          onCancel={() => setAdding(false)}
          onSubmit={async (data) => {
            await addContact(client.id, client.contacts ?? [], data);
            setAdding(false);
          }}
        />
      )}

      {(client.contacts?.length ?? 0) === 0 && !adding ? (
        <div className="cc-empty">No contacts yet.</div>
      ) : (
        <ul className="space-y-3">
          {(client.contacts ?? []).map((c) => (
            <li key={c.id}>
              <ContactCard client={client} contact={c} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ContactCard({ client, contact }: { client: Client; contact: Contact }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <ContactForm
        initial={contact}
        onCancel={() => setEditing(false)}
        onSubmit={async (data) => {
          await updateContact(client.id, client.contacts ?? [], contact.id, data);
          setEditing(false);
        }}
        onDelete={async () => {
          if (!confirm(`Remove ${contact.name}?`)) return;
          await removeContact(client.id, client.contacts ?? [], contact.id);
          setEditing(false);
        }}
      />
    );
  }

  return (
    <div className="cc-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="font-medium">{contact.name}</p>
            {contact.role && (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {contact.role}
              </p>
            )}
          </div>
          {(contact.email || contact.phone) && (
            <p className="mt-1 text-sm" style={{ color: 'var(--text-dim)' }}>
              {contact.email}
              {contact.email && contact.phone && ' · '}
              {contact.phone}
            </p>
          )}
          {contact.notes && (
            <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              {contact.notes}
            </p>
          )}
        </div>
        <button type="button" className="cc-btn-ghost shrink-0" onClick={() => setEditing(true)}>
          Edit
        </button>
      </div>
    </div>
  );
}

function ContactForm({
  initial,
  onSubmit,
  onCancel,
  onDelete,
}: {
  initial?: Contact;
  onSubmit: (data: Omit<Contact, 'id'>) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [role, setRole] = useState(initial?.role ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await onSubmit({
        name: name.trim(),
        role: role.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        notes: notes.trim() || undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="cc-card mb-3 space-y-3 p-5">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="cc-eyebrow mb-2 block">Name</span>
          <input
            type="text"
            autoFocus
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="cc-input"
          />
        </label>
        <label className="block">
          <span className="cc-eyebrow mb-2 block">Role</span>
          <input
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="cc-input"
            placeholder="e.g. Headteacher"
          />
        </label>
        <label className="block">
          <span className="cc-eyebrow mb-2 block">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="cc-input"
          />
        </label>
        <label className="block">
          <span className="cc-eyebrow mb-2 block">Phone</span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="cc-input"
          />
        </label>
      </div>
      <label className="block">
        <span className="cc-eyebrow mb-2 block">Notes</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="cc-textarea"
          placeholder="Anything useful — preferences, things to remember."
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="cc-btn-primary" disabled={busy || !name.trim()}>
          {busy ? 'Saving…' : initial ? 'Save' : 'Add contact'}
        </button>
        <button type="button" className="cc-btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        {onDelete && (
          <button type="button" className="cc-btn-danger ml-auto" onClick={onDelete}>
            Remove contact
          </button>
        )}
      </div>
    </form>
  );
}
