import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Raizechem Admin'
const COMPANY = 'Raizechem'

interface OverdueInvoice {
  invoice_number: string
  invoice_date: string
  due_date?: string
  outstanding: number
  days_overdue: number
}

interface Props {
  dealerName?: string
  totalOutstanding?: number
  maxDaysOverdue?: number
  invoices?: OverdueInvoice[]
  contactPerson?: string
}

const fmt = (n: number) =>
  '₹' + (n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })

const DealerOverdueReminderEmail = ({
  dealerName = 'Valued Partner',
  totalOutstanding = 0,
  maxDaysOverdue = 0,
  invoices = [],
  contactPerson,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      Payment reminder: {fmt(totalOutstanding)} outstanding
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Payment Reminder</Heading>
        <Text style={text}>
          Dear {contactPerson || dealerName},
        </Text>
        <Text style={text}>
          This is a friendly reminder from <strong>{COMPANY}</strong> regarding
          outstanding invoices on your account <strong>{dealerName}</strong>.
        </Text>

        <Section style={highlightBox}>
          <Text style={highlightLabel}>Total Outstanding</Text>
          <Text style={highlightAmount}>{fmt(totalOutstanding)}</Text>
          <Text style={highlightSub}>
            Oldest invoice: {maxDaysOverdue} days overdue
          </Text>
        </Section>

        {invoices.length > 0 && (
          <>
            <Heading as="h2" style={h2}>Invoice Breakdown</Heading>
            <table style={table} cellPadding={0} cellSpacing={0}>
              <thead>
                <tr>
                  <th style={th}>Invoice</th>
                  <th style={th}>Date</th>
                  <th style={thRight}>Outstanding</th>
                  <th style={thRight}>Days</th>
                </tr>
              </thead>
              <tbody>
                {invoices.slice(0, 25).map((inv) => (
                  <tr key={inv.invoice_number}>
                    <td style={td}>{inv.invoice_number}</td>
                    <td style={td}>{inv.invoice_date}</td>
                    <td style={tdRight}>{fmt(inv.outstanding)}</td>
                    <td style={tdRight}>{inv.days_overdue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {invoices.length > 25 && (
              <Text style={muted}>
                + {invoices.length - 25} more invoice(s) — full statement available
                on request.
              </Text>
            )}
          </>
        )}

        <Hr style={hr} />
        <Text style={text}>
          Kindly arrange payment at your earliest convenience. If payment has
          already been made, please share the reference so we can update our
          records. For any clarification, reply to this email or contact your
          account manager.
        </Text>
        <Text style={footer}>Regards,<br />Accounts Team — {COMPANY}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: DealerOverdueReminderEmail,
  subject: (d: Record<string, any>) =>
    `Payment Reminder — ${fmt(d?.totalOutstanding ?? 0)} overdue`,
  displayName: 'Dealer overdue reminder',
  previewData: {
    dealerName: 'Sample Agro Distributors',
    contactPerson: 'Mr. Reddy',
    totalOutstanding: 145320,
    maxDaysOverdue: 95,
    invoices: [
      { invoice_number: 'TG/INV/24-25/0123', invoice_date: '2024-12-10', outstanding: 80000, days_overdue: 95 },
      { invoice_number: 'TG/INV/24-25/0156', invoice_date: '2025-01-05', outstanding: 65320, days_overdue: 70 },
    ],
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { padding: '24px', maxWidth: '600px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#0a0a0a', margin: '0 0 16px' }
const h2 = { fontSize: '16px', fontWeight: 'bold', color: '#0a0a0a', margin: '24px 0 8px' }
const text = { fontSize: '14px', color: '#374151', lineHeight: '1.6', margin: '0 0 14px' }
const muted = { fontSize: '12px', color: '#6b7280', margin: '8px 0' }
const footer = { fontSize: '13px', color: '#374151', margin: '24px 0 0' }
const hr = { borderColor: '#e5e7eb', margin: '20px 0' }
const highlightBox = { backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '16px', margin: '16px 0', textAlign: 'center' as const }
const highlightLabel = { fontSize: '12px', color: '#991b1b', textTransform: 'uppercase' as const, margin: '0 0 4px', fontWeight: 'bold' }
const highlightAmount = { fontSize: '26px', color: '#991b1b', fontWeight: 'bold', margin: '0' }
const highlightSub = { fontSize: '12px', color: '#7f1d1d', margin: '4px 0 0' }
const table = { width: '100%', borderCollapse: 'collapse' as const, fontSize: '13px', margin: '8px 0' }
const th = { textAlign: 'left' as const, padding: '8px', borderBottom: '2px solid #e5e7eb', color: '#374151' }
const thRight = { ...th, textAlign: 'right' as const }
const td = { padding: '6px 8px', borderBottom: '1px solid #f3f4f6', color: '#1f2937' }
const tdRight = { ...td, textAlign: 'right' as const }
