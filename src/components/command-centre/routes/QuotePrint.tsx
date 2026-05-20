import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { GBP, quoteTotals, watchQuote } from '../lib/quotes';
import { watchClients } from '../lib/clients';
import type { Client, Quote } from '../lib/types';
import { formatISODate } from './Quotes';

export default function QuotePrint() {
  const { id = '' } = useParams<{ id: string }>();
  const [quote, setQuote] = useState<Quote | null | undefined>(undefined);
  const [clients, setClients] = useState<Client[]>([]);

  useEffect(() => watchQuote(id, setQuote), [id]);
  useEffect(() => watchClients(setClients), []);

  if (quote === undefined) {
    return <div className="cc-print"><p>Loading…</p></div>;
  }
  if (quote === null) {
    return <div className="cc-print"><p>Quote not found.</p></div>;
  }

  const client = clients.find((c) => c.id === quote.clientId);
  const { subtotal, vat, total } = quoteTotals(quote);

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
            <p className="cc-print-label">Quote</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.2rem' }}>
              {quote.number}
            </p>
            <p style={{ marginTop: '0.4rem', color: '#666', fontSize: '0.9rem' }}>
              Issued {formatISODate(quote.issueDate)}
              {quote.validUntil && (
                <>
                  <br />Valid until {formatISODate(quote.validUntil)}
                </>
              )}
            </p>
          </div>
        </header>

        <section className="cc-print-section">
          <p className="cc-print-label">Prepared for</p>
          <p style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: '0.25rem' }}>
            {quote.clientName}
          </p>
          {quote.projectTitle && (
            <p style={{ color: '#666', marginTop: '0.15rem' }}>{quote.projectTitle}</p>
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

        {quote.introNote && (
          <section className="cc-print-section">
            <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{quote.introNote}</p>
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
              {(quote.lineItems ?? []).map((li) => (
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
            {quote.vatRate > 0 && (
              <div className="cc-print-totals-row">
                <span>VAT ({quote.vatRate}%)</span>
                <span>{GBP.format(vat)}</span>
              </div>
            )}
            <div className="cc-print-totals-row is-total">
              <span>Total</span>
              <span>{GBP.format(total)}</span>
            </div>
          </div>
        </section>

        {quote.termsNote && (
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
              {quote.termsNote}
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
