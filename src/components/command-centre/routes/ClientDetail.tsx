import { useEffect, useMemo, useState, type FormEvent } from 'react';
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
import { watchCorrespondenceForClient } from '../lib/correspondence';
import { lastContactMap, formatLastContact } from '../lib/relationships';
import type {
  Client,
  Contact,
  Correspondence,
  Project,
} from '../lib/types';
import StatusPill from '../components/StatusPill';
import CorrespondenceFeed from '../components/CorrespondenceFeed';
import QuotesFeed from '../components/QuotesFeed';
import Icon from '../components/Icon';

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
    <div className="cc-page-content">
      <Link to="/clients" className="cc-eyebrow inline-block">
        ← Clients
      </Link>

      <DetailsSection client={client} onDelete={handleDeleteClient} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,_2fr)_minmax(0,_1fr)]">
        <div className="space-y-8">
          <ContactsSection client={client} />
        </div>
        <aside className="space-y-8">
          <ProjectsForClient clientId={client.id} />

          <section>
            <SectionHead title="Quotes" icon="pound" />
            <QuotesFeed scope="client" id={client.id} />
          </section>

          <section>
            <SectionHead title="Correspondence" icon="message" />
            <CorrespondenceFeed scope="client" id={client.id} />
          </section>
        </aside>
      </div>
    </div>
  );
}

function SectionHead({ title, icon }: { title: string; icon: React.ComponentProps<typeof Icon>['name'] }) {
  return (
    <div className="cc-section-head-v2">
      <Icon name={icon} className="cc-section-icon" />
      <h2 className="cc-section-title-v2">{title}</h2>
    </div>
  );
}

function ProjectsForClient({ clientId }: { clientId: string }) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const navigate = useNavigate();
  useEffect(() => watchProjectsForClient(clientId, setProjects), [clientId]);

  return (
    <section>
      <SectionHead title="Projects" icon="briefcase" />
      {projects === null ? (
        <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Loading…</p>
      ) : projects.length === 0 ? (
        <p className="cc-empty-inline">
          <span style={{ color: 'var(--text-dim)' }}>—</span> No projects for this client yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {projects.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => navigate(`/projects/${p.id}`)}
                className="cc-card cc-stripe-violet flex w-full items-center justify-between gap-3 p-4 text-left transition hover:bg-[var(--surface-hover)]"
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
        <p className="cc-empty-inline">
          <span style={{ color: 'var(--text-dim)' }}>—</span> No notes yet. Click <em>Edit details</em> to add some context about this school.
        </p>
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
  const [correspondence, setCorrespondence] = useState<Correspondence[]>([]);

  useEffect(() => watchCorrespondenceForClient(client.id, setCorrespondence), [client.id]);

  const lastMap = useMemo(() => lastContactMap(correspondence), [correspondence]);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-3">
        <SectionHead title="Contacts" icon="users" />
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
        <p className="cc-empty-inline">
          <span style={{ color: 'var(--text-dim)' }}>—</span> No contacts yet. Click <em>Add contact</em>.
        </p>
      ) : (
        <ul className="space-y-3">
          {(client.contacts ?? []).map((c) => (
            <li key={c.id}>
              <ContactCard
                client={client}
                contact={c}
                lastContact={lastMap.get(c.id) ?? null}
                today={today}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ContactCard({
  client,
  contact,
  lastContact,
  today,
}: {
  client: Client;
  contact: Contact;
  lastContact: string | null;
  today: string;
}) {
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

  const daysAgo = lastContact
    ? Math.max(
        0,
        Math.floor(
          (new Date(today).getTime() - new Date(lastContact).getTime()) /
            86_400_000,
        ),
      )
    : null;
  const lastLabel = formatLastContact({
    contact,
    clientId: client.id,
    clientName: client.name,
    lastContact,
    daysAgo,
  });
  const stale = daysAgo === null || daysAgo >= 30;

  return (
    <div className={`cc-card cc-contact-card cc-stripe-${stale ? 'rose' : 'slate'}`}>
      <div className="cc-contact-card-grid">
        <div className="min-w-0 flex-1">
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
          <div className={`cc-contact-meta ${stale ? 'cc-contact-meta-stale' : ''}`}>
            <span>Last contacted</span>
            <span className={`cc-badge-${stale ? 'rose' : 'slate'}`}>{lastLabel}</span>
          </div>
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
