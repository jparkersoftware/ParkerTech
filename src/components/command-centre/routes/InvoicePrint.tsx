import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { GBP, invoiceTotals, watchInvoice } from '../lib/invoices';
import { watchClients } from '../lib/clients';
import type { Client, Invoice } from '../lib/types';
import { formatISODate } from './Invoices';

export default function InvoicePrint() {
  const { id = '' } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<Invoice | null | undefined>(undefined);
  const [clients, setClients] = useState<Client[]>([]);

  useEffect(() => watchInvoice(id, setInvoice), [id]);
  useEffect(() => watchClients(setClients), []);

  if (invoice === undefined) {
    return <div className="cc-print"><p>Loading…</p></div>;
  }
  if (invoice === null) {
    return <div className="cc-print"><p>Invoice not found.</p></div>;
  }

  const client = invoice.clientId
    ? clients.find((c) => c.id === invoice.clientId)
    : undefined;
  const { subtotal, vat, total } = invoiceTotals(invoice);

  return (
    <div className="cc-print">
      <div className="cc-print-inner">
        <div className="cc-print-actions">
          <button type="button" className="cc-print-btn" onClick={() => window.print()}>
            Print / Save as PDF
          </button>
          <button
            type="button"
            className="cc-print-btn is-ghost"
            onClick={() => window.close()}
          >
            Close
          </button>
        </div>

        <header className="cc-print-meta">
          <div>
            <p className="cc-print-brand">
              Parker<span className="accent">Tech</span>
            </p>
            <p style={{ marginTop: '0.4rem', color: '#666', fontSize: '0.92rem' }}>
              joseph@parkertech.co.uk
              <br />
              parkertech.co.uk
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p className="cc-print-label">Invoice</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.2rem' }}>
              {invoice.number}
            </p>
            <p style={{ marginTop: '0.4rem', color: '#666', fontSize: '0.9rem' }}>
              Issued {formatISODate(invoice.issueDate)}
              {invoice.dueDate && (
                <>
                  <br />Due {formatISODate(invoice.dueDate)}
                </>
              )}
            </p>
          </div>
        </header>

        <section className="cc-print-section">
          <p className="cc-print-label">Billed to</p>
          <p style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: '0.25rem' }}>
            {invoice.clientName ?? '—'}
          </p>
          {invoice.projectTitle && (
            <p style={{ color: '#666', marginTop: '0.15rem' }}>
              {invoice.projectTitle}
            </p>
          )}
          {client?.contacts && client.contacts.length > 0 && (
            <p style={{ color: '#666', marginTop: '0.5rem', fontSize: '0.92rem' }}>
              {client.contacts[0]!.name}
              {client.contacts[0]!.role && ` · ${client.contacts[0]!.role}`}
              {client.contacts[0]!.email && (
                <>
                  <br />
                  {client.contacts[0]!.email}
                </>
              )}
            </p>
          )}
        </section>

        {invoice.introNote && (
          <section className="cc-print-section">
            <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
              {invoice.introNote}
            </p>
          </section>
        )}

        <section className="cc-print-section">
          <table className="cc-print-table">
            <thead>
              <tr>
                <th>Description</th>
                <th className="is-num" style={{ width: '5rem' }}>Qty</th>
                <th style={{ width: '5rem' }}>Unit</th>
                <th className="is-num" style={{ width: '7rem' }}>Unit price</th>
                <th className="is-num" style={{ width: '7rem' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {(invoice.lineItems ?? []).map((li) => (
                <tr key={li.id}>
                  <td>{li.description}</td>
                  <td className="is-num">{li.quantity}</td>
                  <td>{li.unit ?? ''}</td>
                  <td className="is-num">{GBP.format(li.unitPrice)}</td>
                  <td className="is-num">
                    {GBP.format((li.quantity || 0) * (li.unitPrice || 0))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="cc-print-totals">
            <div className="cc-print-totals-row">
              <span>Subtotal</span>
              <span>{GBP.format(subtotal)}</span>
            </div>
            {invoice.vatRate > 0 && (
              <div className="cc-print-totals-row">
                <span>VAT ({invoice.vatRate}%)</span>
                <span>{GBP.format(vat)}</span>
              </div>
            )}
            <div className="cc-print-totals-row is-total">
              <span>Total</span>
              <span>{GBP.format(total)}</span>
            </div>
          </div>
        </section>

        {invoice.status === 'paid' && (
          <section className="cc-print-section">
            <p className="cc-print-label">Paid</p>
            <p
              style={{
                whiteSpace: 'pre-wrap',
                marginTop: '0.4rem',
                fontSize: '0.92rem',
                color: '#444',
              }}
            >
              {invoice.paidAmount !== undefined && (
                <>Amount: {GBP.format(invoice.paidAmount)}<br /></>
              )}
              {invoice.paymentMethod && (
                <>Method: {invoice.paymentMethod}<br /></>
              )}
              {invoice.paidAt && (
                <>Date: {invoice.paidAt.toDate().toISOString().slice(0, 10)}</>
              )}
            </p>
          </section>
        )}

        {invoice.termsNote && (
          <section className="cc-print-section">
            <p className="cc-print-label">Terms</p>
            <p
              style={{
                whiteSpace: 'pre-wrap',
                marginTop: '0.5rem',
                fontSize: '0.9rem',
                color: '#444',
                lineHeight: 1.6,
              }}
            >
              {invoice.termsNote}
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
