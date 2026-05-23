import {
  CORRESPONDENCE_TYPE_LABEL,
  INVOICE_STATUS_LABEL,
  MILESTONE_STATUS_LABEL,
  PROJECT_STATUS_LABEL,
  QUOTE_STATUS_LABEL,
  type Client,
  type Contact,
  type Correspondence,
  type InboxItem,
  type Invoice,
  type Project,
  type Quote,
} from './types';
import { quoteTotals, GBP } from './quotes';
import { invoiceTotals } from './invoices';

/**
 * One file per entity. File paths are slug-based for human readability;
 * frontmatter `id` is the stable Firestore ID (so this stays robust if a
 * name changes later).
 */

export type VaultFile = { path: string; content: string; message: string };

export function clientFile(
  client: Client,
  projects: Project[],
  quotes: Quote[],
  invoices: Invoice[],
  correspondence: Correspondence[],
): VaultFile {
  const slug = entitySlug(client.name);
  const clientProjects = projects.filter((p) => p.clientId === client.id);
  const clientQuotes = quotes.filter((q) => q.clientId === client.id);
  const clientInvoices = invoices.filter((i) => i.clientId === client.id);
  const clientCorr = correspondence.filter((c) => c.clientId === client.id);

  const frontmatter = yamlFrontmatter({
    type: 'client',
    id: client.id,
    name: client.name,
    contacts: (client.contacts ?? []).length,
    updated: tsIso(client.updatedAt),
    source: 'command-centre',
  });

  const body: string[] = [`# ${client.name}`, ''];
  if (client.notes) body.push(client.notes, '');

  if ((client.contacts ?? []).length > 0) {
    body.push('## Contacts', '');
    for (const c of client.contacts) {
      body.push(`- [[People/${entitySlug(c.name)}]]${c.role ? ` — ${c.role}` : ''}`);
    }
    body.push('');
  }

  if (clientProjects.length > 0) {
    body.push('## Projects', '');
    for (const p of clientProjects) {
      body.push(
        `- [[Projects/${entitySlug(p.title)}]] · ${PROJECT_STATUS_LABEL[p.status]}`,
      );
    }
    body.push('');
  }

  if (clientQuotes.length > 0) {
    body.push('## Quotes', '');
    for (const q of clientQuotes) {
      const { total } = quoteTotals(q);
      body.push(
        `- [[Quotes/${q.number}]] · ${QUOTE_STATUS_LABEL[q.status]} · ${GBP.format(total)}`,
      );
    }
    body.push('');
  }

  if (clientInvoices.length > 0) {
    body.push('## Invoices', '');
    for (const inv of clientInvoices) {
      const { total } = invoiceTotals(inv);
      body.push(
        `- [[Invoices/${inv.number}]] · ${INVOICE_STATUS_LABEL[inv.status]} · ${GBP.format(total)}`,
      );
    }
    body.push('');
  }

  if (clientCorr.length > 0) {
    body.push('## Correspondence', '');
    for (const c of clientCorr.slice(0, 30)) {
      body.push(
        `- ${c.date} · ${CORRESPONDENCE_TYPE_LABEL[c.type]} · [[Correspondence/${correspondenceSlug(c)}|${c.title}]]`,
      );
    }
    body.push('');
  }

  return {
    path: `Clients/${slug}.md`,
    content: frontmatter + body.join('\n'),
    message: `client: ${client.name}`,
  };
}

export function projectFile(
  project: Project,
  correspondence: Correspondence[],
  quotes: Quote[],
  invoices: Invoice[],
): VaultFile {
  const slug = entitySlug(project.title);
  const projCorr = correspondence.filter((c) => c.projectId === project.id);
  const projQuotes = quotes.filter((q) => q.projectId === project.id);
  const projInvoices = invoices.filter((i) => i.projectId === project.id);

  const frontmatter = yamlFrontmatter({
    type: 'project',
    id: project.id,
    title: project.title,
    status: project.status,
    client: `[[Clients/${entitySlug(project.clientName)}]]`,
    start: project.startDate ?? '',
    target: project.targetDate ?? '',
    updated: tsIso(project.updatedAt),
    source: 'command-centre',
  });

  const body: string[] = [
    `# ${project.title}`,
    '',
    `Client: [[Clients/${entitySlug(project.clientName)}|${project.clientName}]] · Status: ${PROJECT_STATUS_LABEL[project.status]}`,
    '',
  ];

  if (project.brief) body.push('## Brief', '', project.brief, '');

  const ms = project.milestones ?? [];
  if (ms.length > 0) {
    body.push('## Milestones', '');
    for (const m of ms) {
      const targetBit = m.targetDate ? ` · target ${m.targetDate}` : '';
      body.push(
        `### ${m.title} — ${MILESTONE_STATUS_LABEL[m.status]}${targetBit}`,
        '',
      );
      if (m.description) body.push(m.description, '');
      if (m.checklist.length > 0) {
        for (const item of m.checklist) {
          body.push(`- [${item.done ? 'x' : ' '}] ${item.text}`);
        }
        body.push('');
      }
    }
  }

  const openTasks = (project.tasks ?? []).filter((t) => !t.done);
  const doneTasks = (project.tasks ?? []).filter((t) => t.done);
  if (openTasks.length + doneTasks.length > 0) {
    body.push('## Tasks', '');
    for (const t of openTasks) {
      const meta: string[] = [];
      if (t.dueDate) meta.push(`due ${t.dueDate}`);
      if (t.priority && t.priority !== 'normal') meta.push(t.priority);
      body.push(`- [ ] ${t.title}${meta.length ? ` (${meta.join(', ')})` : ''}`);
    }
    for (const t of doneTasks) body.push(`- [x] ${t.title}`);
    body.push('');
  }

  if (projQuotes.length > 0) {
    body.push('## Quotes', '');
    for (const q of projQuotes) {
      const { total } = quoteTotals(q);
      body.push(
        `- [[Quotes/${q.number}]] · ${QUOTE_STATUS_LABEL[q.status]} · ${GBP.format(total)}`,
      );
    }
    body.push('');
  }

  if (projInvoices.length > 0) {
    body.push('## Invoices', '');
    for (const inv of projInvoices) {
      const { total } = invoiceTotals(inv);
      body.push(
        `- [[Invoices/${inv.number}]] · ${INVOICE_STATUS_LABEL[inv.status]} · ${GBP.format(total)}`,
      );
    }
    body.push('');
  }

  if (projCorr.length > 0) {
    body.push('## Correspondence', '');
    for (const c of projCorr) {
      body.push(
        `- ${c.date} · ${CORRESPONDENCE_TYPE_LABEL[c.type]} · [[Correspondence/${correspondenceSlug(c)}|${c.title}]]`,
      );
    }
    body.push('');
  }

  return {
    path: `Projects/${slug}.md`,
    content: frontmatter + body.join('\n'),
    message: `project: ${project.title}`,
  };
}

export function contactFile(
  contact: Contact,
  client: Client,
  lastContactDate: string | null,
): VaultFile {
  const slug = entitySlug(contact.name);
  const frontmatter = yamlFrontmatter({
    type: 'person',
    id: contact.id,
    name: contact.name,
    role: contact.role ?? '',
    email: contact.email ?? '',
    phone: contact.phone ?? '',
    client: `[[Clients/${entitySlug(client.name)}]]`,
    lastContact: lastContactDate ?? '',
    source: 'command-centre',
  });

  const body: string[] = [`# ${contact.name}`, ''];
  const subtitle: string[] = [];
  if (contact.role) subtitle.push(contact.role);
  subtitle.push(`[[Clients/${entitySlug(client.name)}|${client.name}]]`);
  body.push(subtitle.join(' · '), '');

  if (contact.email || contact.phone) {
    if (contact.email) body.push(`- Email: ${contact.email}`);
    if (contact.phone) body.push(`- Phone: ${contact.phone}`);
    body.push('');
  }

  if (contact.notes) body.push('## Notes', '', contact.notes, '');

  if (lastContactDate) {
    body.push(`Last contacted: ${lastContactDate}`, '');
  }

  return {
    path: `People/${slug}.md`,
    content: frontmatter + body.join('\n'),
    message: `person: ${contact.name}`,
  };
}

export function correspondenceFile(
  entry: Correspondence,
  client: Client,
): VaultFile {
  const slug = correspondenceSlug(entry);
  const tagged = (client.contacts ?? []).filter((c) =>
    (entry.contactIds ?? []).includes(c.id),
  );

  const frontmatter = yamlFrontmatter({
    type: 'correspondence',
    id: entry.id,
    kind: entry.type,
    date: entry.date,
    client: `[[Clients/${entitySlug(entry.clientName)}]]`,
    project: entry.projectId && entry.projectTitle
      ? `[[Projects/${entitySlug(entry.projectTitle)}]]`
      : '',
    people: tagged.map((c) => `[[People/${entitySlug(c.name)}]]`),
    source: 'command-centre',
  });

  const body: string[] = [
    `# ${entry.title}`,
    '',
    `${CORRESPONDENCE_TYPE_LABEL[entry.type]} · ${entry.date} · [[Clients/${entitySlug(entry.clientName)}|${entry.clientName}]]`,
  ];
  if (entry.projectId && entry.projectTitle) {
    body[body.length - 1] +=
      ` · [[Projects/${entitySlug(entry.projectTitle)}|${entry.projectTitle}]]`;
  }
  body.push('');

  if (tagged.length > 0) {
    body.push('## People', '');
    for (const c of tagged) {
      body.push(`- [[People/${entitySlug(c.name)}]]${c.role ? ` — ${c.role}` : ''}`);
    }
    body.push('');
  }

  if (entry.body) body.push('## Summary', '', entry.body, '');

  if (entry.transcript) {
    body.push('## Transcript', '', entry.transcript, '');
  }

  return {
    path: `Correspondence/${slug}.md`,
    content: frontmatter + body.join('\n'),
    message: `correspondence: ${entry.title}`,
  };
}

export function quoteFile(quote: Quote): VaultFile {
  const { subtotal, vat, total } = quoteTotals(quote);

  const frontmatter = yamlFrontmatter({
    type: 'quote',
    id: quote.id,
    number: quote.number,
    status: quote.status,
    client: `[[Clients/${entitySlug(quote.clientName)}]]`,
    project: quote.projectId && quote.projectTitle
      ? `[[Projects/${entitySlug(quote.projectTitle)}]]`
      : '',
    issued: quote.issueDate,
    validUntil: quote.validUntil ?? '',
    total: total,
    source: 'command-centre',
  });

  const body: string[] = [
    `# ${quote.number}`,
    '',
    `${QUOTE_STATUS_LABEL[quote.status]} · ${GBP.format(total)} · [[Clients/${entitySlug(quote.clientName)}|${quote.clientName}]]`,
  ];
  if (quote.projectId && quote.projectTitle) {
    body[body.length - 1] +=
      ` · [[Projects/${entitySlug(quote.projectTitle)}|${quote.projectTitle}]]`;
  }
  body.push('', `Issued ${quote.issueDate}${quote.validUntil ? ` · valid until ${quote.validUntil}` : ''}`, '');

  if (quote.introNote) body.push(quote.introNote, '');

  if ((quote.lineItems ?? []).length > 0) {
    body.push('## Line items', '');
    body.push('| Description | Qty | Unit | Unit price | Total |');
    body.push('| --- | ---:| --- | ---:| ---:|');
    for (const li of quote.lineItems) {
      const lineTotal = (li.quantity || 0) * (li.unitPrice || 0);
      body.push(
        `| ${mdEscape(li.description)} | ${li.quantity} | ${li.unit ?? ''} | ${GBP.format(li.unitPrice)} | ${GBP.format(lineTotal)} |`,
      );
    }
    body.push('');
    body.push(`Subtotal: ${GBP.format(subtotal)}`);
    if (quote.vatRate > 0) body.push(`VAT (${quote.vatRate}%): ${GBP.format(vat)}`);
    body.push(`**Total: ${GBP.format(total)}**`, '');
  }

  if (quote.termsNote) body.push('## Terms', '', quote.termsNote, '');

  return {
    path: `Quotes/${quote.number}.md`,
    content: frontmatter + body.join('\n'),
    message: `quote: ${quote.number}`,
  };
}

export function invoiceFile(invoice: Invoice): VaultFile {
  const { subtotal, vat, total } = invoiceTotals(invoice);
  const paid = invoice.status === 'paid';
  const paidDate = invoice.paidAt?.toDate
    ? invoice.paidAt.toDate().toISOString().slice(0, 10)
    : '';

  const frontmatter = yamlFrontmatter({
    type: 'invoice',
    id: invoice.id,
    number: invoice.number,
    status: invoice.status,
    client:
      invoice.clientName
        ? `[[Clients/${entitySlug(invoice.clientName)}]]`
        : '',
    project: invoice.projectId && invoice.projectTitle
      ? `[[Projects/${entitySlug(invoice.projectTitle)}]]`
      : '',
    issued: invoice.issueDate,
    due: invoice.dueDate ?? '',
    total: total,
    paid: paid,
    paid_amount: invoice.paidAmount ?? '',
    paid_date: paidDate,
    source: 'command-centre',
  });

  const headerBits: string[] = [
    INVOICE_STATUS_LABEL[invoice.status],
    GBP.format(total),
  ];
  if (invoice.clientName) {
    headerBits.push(
      `[[Clients/${entitySlug(invoice.clientName)}|${invoice.clientName}]]`,
    );
  }

  const body: string[] = [
    `# ${invoice.number}`,
    '',
    headerBits.join(' · '),
  ];
  if (invoice.projectId && invoice.projectTitle) {
    body[body.length - 1] +=
      ` · [[Projects/${entitySlug(invoice.projectTitle)}|${invoice.projectTitle}]]`;
  }
  body.push(
    '',
    `Issued ${invoice.issueDate}${invoice.dueDate ? ` · due ${invoice.dueDate}` : ''}`,
    '',
  );

  if (invoice.introNote) body.push(invoice.introNote, '');

  if ((invoice.lineItems ?? []).length > 0) {
    body.push('## Line items', '');
    body.push('| Description | Qty | Unit | Unit price | Total |');
    body.push('| --- | ---:| --- | ---:| ---:|');
    for (const li of invoice.lineItems) {
      const lineTotal = (li.quantity || 0) * (li.unitPrice || 0);
      body.push(
        `| ${mdEscape(li.description)} | ${li.quantity} | ${li.unit ?? ''} | ${GBP.format(li.unitPrice)} | ${GBP.format(lineTotal)} |`,
      );
    }
    body.push('');
    body.push(`Subtotal: ${GBP.format(subtotal)}`);
    if (invoice.vatRate > 0) body.push(`VAT (${invoice.vatRate}%): ${GBP.format(vat)}`);
    body.push(`**Total: ${GBP.format(total)}**`, '');
  }

  if (paid) {
    body.push('## Payment', '');
    if (invoice.paidAmount !== undefined) {
      body.push(`- Amount: ${GBP.format(invoice.paidAmount)}`);
    }
    if (invoice.paymentMethod) {
      body.push(`- Method: ${invoice.paymentMethod}`);
    }
    if (paidDate) {
      body.push(`- Date: ${paidDate}`);
    }
    body.push('');
  }

  if (invoice.termsNote) body.push('## Terms', '', invoice.termsNote, '');

  return {
    path: `Invoices/${invoice.number}.md`,
    content: frontmatter + body.join('\n'),
    message: `invoice: ${invoice.number}`,
  };
}

export function inboxFile(item: InboxItem): VaultFile {
  const date = item.createdAt?.toDate
    ? item.createdAt.toDate().toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const firstLine = item.text.split('\n')[0]!.slice(0, 50);
  const slug = `${date}-${entitySlug(firstLine)}-${item.id.slice(0, 6)}`;

  const frontmatter = yamlFrontmatter({
    type: 'inbox',
    id: item.id,
    created: date,
    tags: item.tags,
    archived: item.archived,
    archivedNote: item.archivedNote ?? '',
    source: 'command-centre',
  });

  const body: string[] = [`# Inbox · ${date}`, '', item.text, ''];
  if (item.archivedNote) {
    body.push(`> Archived: ${item.archivedNote}`, '');
  }

  return {
    path: `Inbox/${slug}.md`,
    content: frontmatter + body.join('\n'),
    message: `inbox: ${firstLine.replace(/\n/g, ' ')}`,
  };
}

// ── slugs and helpers ───────────────────────────────────────────

export function entitySlug(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80) || 'unnamed';
}

function correspondenceSlug(entry: Correspondence): string {
  return `${entry.date}-${entitySlug(entry.title)}`;
}

function tsIso(ts: { toDate?: () => Date } | undefined): string {
  if (!ts?.toDate) return '';
  return ts.toDate().toISOString();
}

function mdEscape(s: string): string {
  return s.replace(/\|/g, '\\|');
}

function yamlFrontmatter(fields: Record<string, unknown>): string {
  const lines = ['---'];
  for (const [k, v] of Object.entries(fields)) {
    if (Array.isArray(v)) {
      if (v.length === 0) continue;
      lines.push(`${k}:`);
      for (const item of v) lines.push(`  - ${yamlScalar(item)}`);
    } else if (v === '' || v === undefined || v === null) {
      continue;
    } else {
      lines.push(`${k}: ${yamlScalar(v)}`);
    }
  }
  lines.push('---', '');
  return lines.join('\n');
}

function yamlScalar(v: unknown): string {
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return String(v);
  const s = String(v);
  // Quote strings with reserved-ish chars OR containing wiki link brackets — keeps YAML parsers happy.
  if (/[:#&*?,\[\]{}\n"]|^\s|\s$|^\[\[/.test(s)) {
    return `"${s.replace(/"/g, '\\"')}"`;
  }
  return s;
}
