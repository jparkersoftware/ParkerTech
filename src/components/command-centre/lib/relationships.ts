import type { Client, Contact, Correspondence } from './types';

export type RelationshipStatus = {
  contact: Contact;
  clientId: string;
  clientName: string;
  lastContact: string | null;
  /** Days since last contact; null if never contacted. */
  daysAgo: number | null;
};

/** Map of contactId → ISO date of most recent correspondence mention. */
export function lastContactMap(
  correspondence: Correspondence[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const c of correspondence) {
    for (const id of c.contactIds ?? []) {
      const existing = map.get(id);
      if (!existing || c.date > existing) map.set(id, c.date);
    }
  }
  return map;
}

export function relationshipStatuses(
  clients: Client[],
  correspondence: Correspondence[],
): RelationshipStatus[] {
  const lastMap = lastContactMap(correspondence);
  const today = isoToday();
  const out: RelationshipStatus[] = [];
  for (const client of clients) {
    for (const contact of client.contacts ?? []) {
      const last = lastMap.get(contact.id) ?? null;
      out.push({
        contact,
        clientId: client.id,
        clientName: client.name,
        lastContact: last,
        daysAgo: last ? daysBetween(last, today) : null,
      });
    }
  }
  return out;
}

export function staleRelationships(
  clients: Client[],
  correspondence: Correspondence[],
  staleThresholdDays = 30,
  limit = 8,
): RelationshipStatus[] {
  return relationshipStatuses(clients, correspondence)
    .filter(
      (r) => r.daysAgo === null || r.daysAgo >= staleThresholdDays,
    )
    .sort((a, b) => {
      // Treat "never contacted" as infinitely stale — surface first.
      const aDays = a.daysAgo ?? Number.POSITIVE_INFINITY;
      const bDays = b.daysAgo ?? Number.POSITIVE_INFINITY;
      return bDays - aDays;
    })
    .slice(0, limit);
}

export function formatLastContact(r: RelationshipStatus): string {
  if (r.daysAgo === null) return 'Never';
  if (r.daysAgo === 0) return 'Today';
  if (r.daysAgo === 1) return 'Yesterday';
  if (r.daysAgo < 7) return `${r.daysAgo} days ago`;
  if (r.daysAgo < 30) return `${Math.round(r.daysAgo / 7)} weeks ago`;
  if (r.daysAgo < 365) return `${Math.round(r.daysAgo / 30)} months ago`;
  return `${Math.round(r.daysAgo / 365)} years ago`;
}

function daysBetween(isoFrom: string, isoTo: string): number {
  const from = new Date(isoFrom).getTime();
  const to = new Date(isoTo).getTime();
  return Math.max(0, Math.floor((to - from) / 86_400_000));
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}
