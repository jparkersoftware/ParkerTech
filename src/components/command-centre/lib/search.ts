import {
  CORRESPONDENCE_TYPE_LABEL,
  PROJECT_STATUS_LABEL,
  QUOTE_STATUS_LABEL,
  type Client,
  type Correspondence,
  type Project,
  type Quote,
} from './types';

export type ItemKind =
  | 'client'
  | 'project'
  | 'task'
  | 'milestone'
  | 'contact'
  | 'correspondence'
  | 'quote';

export type SearchableItem = {
  id: string;
  kind: ItemKind;
  title: string;
  subtitle: string;
  /** Concatenated text the matcher searches against. Lower-cased. */
  haystack: string;
  /** The full source string most likely to contain the match (for snippet display). */
  longText?: string;
  route: string;
};

export function buildSearchIndex(
  clients: Client[],
  projects: Project[],
  correspondence: Correspondence[],
  quotes: Quote[],
): SearchableItem[] {
  const items: SearchableItem[] = [];

  for (const c of clients) {
    items.push({
      id: c.id,
      kind: 'client',
      title: c.name,
      subtitle: `Client · ${(c.contacts ?? []).length} contact${(c.contacts ?? []).length === 1 ? '' : 's'}`,
      haystack: lower(`${c.name} ${c.notes ?? ''}`),
      longText: c.notes,
      route: `/clients/${c.id}`,
    });
    for (const contact of c.contacts ?? []) {
      items.push({
        id: contact.id,
        kind: 'contact',
        title: contact.name,
        subtitle: `Contact · ${contact.role ?? ''}${contact.role ? ' · ' : ''}${c.name}`,
        haystack: lower(
          `${contact.name} ${contact.role ?? ''} ${contact.email ?? ''} ${contact.phone ?? ''} ${contact.notes ?? ''} ${c.name}`,
        ),
        longText: contact.notes,
        route: `/clients/${c.id}`,
      });
    }
  }

  for (const p of projects) {
    items.push({
      id: p.id,
      kind: 'project',
      title: p.title,
      subtitle: `Project · ${PROJECT_STATUS_LABEL[p.status]} · ${p.clientName}`,
      haystack: lower(`${p.title} ${p.brief ?? ''} ${p.clientName}`),
      longText: p.brief,
      route: `/projects/${p.id}`,
    });
    for (const t of p.tasks ?? []) {
      items.push({
        id: `${p.id}::${t.id}`,
        kind: 'task',
        title: t.title,
        subtitle: `Task · ${p.title}${t.done ? ' · done' : ''}`,
        haystack: lower(`${t.title} ${t.notes ?? ''} ${p.title} ${p.clientName}`),
        longText: t.notes,
        route: `/projects/${p.id}`,
      });
    }
    for (const m of p.milestones ?? []) {
      items.push({
        id: `${p.id}::${m.id}`,
        kind: 'milestone',
        title: m.title,
        subtitle: `Milestone · ${p.title}`,
        haystack: lower(
          `${m.title} ${m.description ?? ''} ${p.title} ${p.clientName} ${m.checklist.map((c) => c.text).join(' ')}`,
        ),
        longText: m.description,
        route: `/projects/${p.id}`,
      });
    }
  }

  for (const c of correspondence) {
    items.push({
      id: c.id,
      kind: 'correspondence',
      title: c.title,
      subtitle: `${CORRESPONDENCE_TYPE_LABEL[c.type]} · ${c.date} · ${c.clientName}`,
      haystack: lower(`${c.title} ${c.body ?? ''} ${c.transcript ?? ''} ${c.clientName} ${c.projectTitle ?? ''}`),
      longText: c.transcript || c.body,
      route: '/correspondence',
    });
  }

  for (const q of quotes) {
    items.push({
      id: q.id,
      kind: 'quote',
      title: q.number,
      subtitle: `Quote · ${QUOTE_STATUS_LABEL[q.status]} · ${q.clientName}${q.projectTitle ? ` · ${q.projectTitle}` : ''}`,
      haystack: lower(
        `${q.number} ${q.clientName} ${q.projectTitle ?? ''} ${q.introNote ?? ''} ${q.termsNote ?? ''} ${(q.lineItems ?? []).map((li) => li.description).join(' ')}`,
      ),
      longText: q.introNote,
      route: `/quotes/${q.id}`,
    });
  }

  return items;
}

export type SearchHit = {
  item: SearchableItem;
  score: number;
  snippet?: string;
};

export function searchItems(items: SearchableItem[], query: string, max = 30): SearchHit[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const tokens = trimmed.toLowerCase().split(/\s+/).filter(Boolean);

  const hits: SearchHit[] = [];
  for (const item of items) {
    let allMatched = true;
    let score = 0;
    for (const token of tokens) {
      const idx = item.haystack.indexOf(token);
      if (idx < 0) {
        allMatched = false;
        break;
      }
      // Earlier matches score higher; bonus for matching in the title.
      score += 1 / (idx + 1);
      if (item.title.toLowerCase().includes(token)) score += 2;
    }
    if (!allMatched) continue;
    hits.push({
      item,
      score,
      snippet: makeSnippet(item.longText, tokens[0]!),
    });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, max);
}

function makeSnippet(text: string | undefined, token: string): string | undefined {
  if (!text) return undefined;
  const idx = text.toLowerCase().indexOf(token);
  if (idx < 0) return undefined;
  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + token.length + 80);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
}

function lower(s: string): string {
  return s.toLowerCase();
}

export const KIND_LABEL: Record<ItemKind, string> = {
  client: 'Client',
  project: 'Project',
  task: 'Task',
  milestone: 'Milestone',
  contact: 'Contact',
  correspondence: 'Correspondence',
  quote: 'Quote',
};
