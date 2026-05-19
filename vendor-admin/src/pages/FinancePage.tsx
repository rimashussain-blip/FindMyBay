// Vendor admin → Finance.
//
// Three tabs: Overview, Invoices, VAT. A Refunds tab lives on the right
// side of Invoices (any refund is logged against its invoice). The page
// uses the existing brand palette — mint→sand gradients, 1.5dp primary
// outline, sand "Owner" chip language — to match Promotions + Staff.

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getFinanceOverview,
  getInvoiceDetail,
  getVatSummary,
  listInvoices,
  listRefunds,
  recordRefund,
  vatSummaryCsvUrl,
  voidRefund,
  type FinanceOverview,
  type InvoiceDetail,
  type InvoiceRow,
  type PaymentStatusFilter,
  type RefundRow,
  type VatSummary,
} from '../api/finance';
import { useAuth } from '../store/auth';

type Tab = 'overview' | 'invoices' | 'refunds' | 'vat';

// Default range = trailing 30 days, both ends inclusive (UTC midnight).
function defaultRange() {
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 86_400_000);
  return { from: from.toISOString(), to: to.toISOString() };
}

export default function FinancePage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [{ from, to }, setRange] = useState(defaultRange);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="label-eyebrow mb-1">Money</div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">Finance</h1>
          <p className="mt-1 text-sm text-ink-soft max-w-[620px]">
            Revenue, VAT, invoices, and refunds. Numbers reflect completed
            bookings (excluding cancellations + no-shows) and refunds logged
            against billable invoices.
          </p>
        </div>
        <RangePicker from={from} to={to} onChange={(f, t) => setRange({ from: f, to: t })} />
      </header>

      <div className="flex items-center gap-1 rounded-2xl border border-mint-edge bg-white p-1 w-fit">
        {(['overview', 'invoices', 'refunds', 'vat'] as const).map((t) => {
          const on = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={[
                'rounded-xl px-4 py-2 text-sm font-semibold transition capitalize',
                on ? 'bg-primary text-white shadow-sm' : 'text-ink-soft hover:text-ink',
              ].join(' ')}
            >
              {t === 'vat' ? 'VAT' : t}
            </button>
          );
        })}
      </div>

      {tab === 'overview' && <OverviewTab from={from} to={to} />}
      {tab === 'invoices' && <InvoicesTab from={from} to={to} />}
      {tab === 'refunds' && <RefundsTab from={from} to={to} />}
      {tab === 'vat' && <VatTab from={from} to={to} />}
    </div>
  );
}

// ── Range picker ─────────────────────────────────────────────────────────

function RangePicker({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}) {
  function preset(days: number) {
    const t = new Date();
    const f = new Date(t.getTime() - days * 86_400_000);
    onChange(f.toISOString(), t.toISOString());
  }

  return (
    <div className="flex items-center gap-2">
      <div className="rounded-2xl border border-mint-edge bg-white p-1 flex items-center gap-1">
        {[
          { label: '7d', days: 7 },
          { label: '30d', days: 30 },
          { label: '90d', days: 90 },
          { label: '1y', days: 365 },
        ].map((p) => (
          <button
            key={p.days}
            onClick={() => preset(p.days)}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-mint hover:text-ink"
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1 text-xs text-ink-soft">
        <input
          type="date"
          className="rounded-lg border border-mint-edge bg-white px-2 py-1.5 text-xs text-ink"
          value={from.slice(0, 10)}
          onChange={(e) => onChange(new Date(e.target.value).toISOString(), to)}
        />
        <span>→</span>
        <input
          type="date"
          className="rounded-lg border border-mint-edge bg-white px-2 py-1.5 text-xs text-ink"
          value={to.slice(0, 10)}
          onChange={(e) =>
            onChange(from, new Date(e.target.value + 'T23:59:59').toISOString())
          }
        />
      </div>
    </div>
  );
}

// ── Overview ─────────────────────────────────────────────────────────────

function OverviewTab({ from, to }: { from: string; to: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['finance-overview', from, to],
    queryFn: () => getFinanceOverview(from, to),
  });

  if (isLoading) return <CardSkeleton rows={3} />;
  if (error || !data) {
    return (
      <div className="rounded-xl bg-coral-soft text-coral p-4 text-sm">
        Couldn't load finance overview.
      </div>
    );
  }

  return <OverviewCards data={data} />;
}

function OverviewCards({ data }: { data: FinanceOverview }) {
  const cards: Array<{ label: string; value: string; hint?: string; accent?: 'mint' | 'sand' | 'coral' }> = [
    {
      label: 'Net revenue',
      value: aed(data.revenue.netAed),
      hint: `${aed(data.revenue.grossAed)} gross · ${aed(data.revenue.refundsAed)} refunded`,
      accent: 'mint',
    },
    {
      label: 'VAT due',
      value: aed(data.vat.netDueAed),
      hint: `${data.vat.ratePct}% UAE VAT · ${aed(data.vat.collectedAed)} collected − ${aed(data.vat.refundedAed)} refunded`,
      accent: 'sand',
    },
    {
      label: 'Net to vendor (ex-VAT)',
      value: aed(data.payout.netToVendorExVatAed),
      hint: 'After VAT pass-through. Settlement is processor-side (T+2).',
    },
    {
      label: 'Completed bookings',
      value: `${data.bookings.completed}`,
      hint: `${data.bookings.appPaid} app-paid · ${data.bookings.walkInCash} cash`,
    },
    {
      label: 'Promotions discount',
      value: aed(data.revenue.discountAed),
      hint: 'Total knocked off via promo codes in this window.',
    },
    {
      label: 'Refunds issued',
      value: `${data.refunds.count}`,
      hint: `${aed(data.refunds.totalAed)} returned to customers`,
      accent: data.refunds.count > 0 ? 'coral' : undefined,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map((c) => (
        <KpiCard key={c.label} {...c} />
      ))}
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: 'mint' | 'sand' | 'coral';
}) {
  const accentStyle =
    accent === 'mint'
      ? { backgroundImage: 'linear-gradient(135deg, #E6F7F4, #FFFFFF)' }
      : accent === 'sand'
        ? { backgroundImage: 'linear-gradient(135deg, #FCE7C8, #FFFFFF)' }
        : accent === 'coral'
          ? { backgroundImage: 'linear-gradient(135deg, #FFE3D9, #FFFFFF)' }
          : undefined;

  return (
    <div
      className="rounded-2xl border-[1.5px] border-primary/40 p-5 bg-white"
      style={{ ...accentStyle, boxShadow: '0 4px 14px rgba(15,118,110,0.06)' }}
    >
      <div className="label-eyebrow mb-1.5">{label}</div>
      <div className="text-2xl font-bold tracking-tight text-ink">{value}</div>
      {hint && <div className="mt-1.5 text-xs text-ink-soft leading-relaxed">{hint}</div>}
    </div>
  );
}

// ── Invoices ─────────────────────────────────────────────────────────────

function InvoicesTab({ from, to }: { from: string; to: string }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<PaymentStatusFilter | 'all'>('all');
  const [page, setPage] = useState(1);
  const [openInvoice, setOpenInvoice] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', from, to, q, status, page],
    queryFn: () =>
      listInvoices({
        from,
        to,
        q: q || undefined,
        status: status === 'all' ? undefined : status,
        page,
        pageSize: 20,
      }),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 flex-wrap">
        <input
          className="input max-w-xs"
          placeholder="Search invoice #, customer name, phone…"
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
        />
        <select
          className="rounded-lg border border-mint-edge bg-white px-3 py-2 text-sm text-ink"
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value as PaymentStatusFilter | 'all');
          }}
        >
          <option value="all">All payment statuses</option>
          <option value="paid">App-paid</option>
          <option value="unpaid">Unpaid</option>
          <option value="walkin">Walk-in (cash)</option>
          <option value="refunded">Has refunds</option>
        </select>
        <div className="ml-auto text-xs text-ink-soft">
          {data ? `${data.total.toLocaleString()} invoices` : '…'}
        </div>
      </div>

      <div className="rounded-2xl border border-mint-edge bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-mint/40 text-left text-[11px] font-bold uppercase tracking-wider text-ink-soft">
              <th className="px-4 py-3">Invoice #</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Service</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Refunded</th>
              <th className="px-4 py-3 text-right">Net</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-mint-edge">
            {isLoading && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-ink-soft">
                  Loading…
                </td>
              </tr>
            )}
            {data?.items.length === 0 && !isLoading && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-ink-soft">
                  No invoices in this window.
                </td>
              </tr>
            )}
            {data?.items.map((inv) => <InvoiceRowView key={inv.id} inv={inv} onOpen={() => setOpenInvoice(inv.id)} />)}
          </tbody>
        </table>
      </div>

      {data && data.total > data.pageSize && (
        <Pagination
          page={page}
          totalPages={Math.ceil(data.total / data.pageSize)}
          onChange={setPage}
        />
      )}

      {openInvoice && <InvoiceModal bookingId={openInvoice} onClose={() => setOpenInvoice(null)} />}
    </div>
  );
}

function InvoiceRowView({ inv, onOpen }: { inv: InvoiceRow; onOpen: () => void }) {
  return (
    <tr className="hover:bg-mint/20">
      <td className="px-4 py-3 font-mono text-xs font-semibold text-ink">{inv.invoiceNumber}</td>
      <td className="px-4 py-3 text-ink-soft">{formatDate(inv.slotStart)}</td>
      <td className="px-4 py-3">
        <div className="font-medium text-ink">{inv.customerName ?? '—'}</div>
        <div className="text-xs text-ink-soft">{inv.customerPhone ?? '—'}</div>
      </td>
      <td className="px-4 py-3 text-ink-soft">{inv.serviceName}</td>
      <td className="px-4 py-3 text-right font-semibold text-ink">{aed(inv.totalAed)}</td>
      <td className="px-4 py-3 text-right text-coral">
        {inv.refundedAed > 0 ? `-${aed(inv.refundedAed)}` : '—'}
      </td>
      <td className="px-4 py-3 text-right font-semibold text-ink">{aed(inv.netAed)}</td>
      <td className="px-4 py-3">
        <PaymentChip status={inv.paymentStatus} />
      </td>
      <td className="px-4 py-3 text-right">
        <button
          onClick={onOpen}
          className="rounded-lg border border-mint-edge bg-white px-3 py-1.5 text-xs font-semibold text-primary-deep hover:bg-mint"
        >
          View
        </button>
      </td>
    </tr>
  );
}

function PaymentChip({ status }: { status: 'paid' | 'unpaid' | 'cash' }) {
  if (status === 'paid')
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-mint px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-deep">
        <span className="h-1.5 w-1.5 rounded-full bg-primary-deep" /> Paid
      </span>
    );
  if (status === 'cash')
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-sand px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#7a4d12]">
        Cash
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-coral-soft px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-coral">
      Unpaid
    </span>
  );
}

// ── Invoice modal (print-friendly) ───────────────────────────────────────

function InvoiceModal({ bookingId, onClose }: { bookingId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const role = useAuth((s) => s.role);
  // Backend stores VendorMember role; useAuth role is the user-level enum.
  // Only show refund button if user is plausibly the owner — backend
  // re-checks anyway.
  const canRefund = role === 'vendor_owner' || role === 'admin';
  const { data, isLoading } = useQuery({
    queryKey: ['invoice', bookingId],
    queryFn: () => getInvoiceDetail(bookingId),
  });
  const [refundOpen, setRefundOpen] = useState(false);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4 py-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-mint-edge no-print">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold text-ink">Tax invoice</h3>
            {data && (
              <span className="rounded-full bg-mint px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-deep">
                {data.invoiceNumber}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => window.print()} className="btn-outlined text-sm">
              Print
            </button>
            {canRefund && data && !data.isWalkIn && data.summary.netAed > 0 && (
              <button
                onClick={() => setRefundOpen(true)}
                className="rounded-full bg-coral-soft px-4 py-2 text-sm font-semibold text-coral hover:bg-coral hover:text-white"
              >
                Issue refund
              </button>
            )}
            <button onClick={onClose} className="text-ink-soft hover:text-ink">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 print-body">
          {isLoading && <div className="text-sm text-ink-soft">Loading…</div>}
          {data && <InvoiceBody data={data} />}
        </div>
      </div>

      {refundOpen && data && (
        <div onClick={(e) => e.stopPropagation()}>
          <RefundModal
            invoice={data}
            onClose={() => setRefundOpen(false)}
            onSuccess={() => {
              setRefundOpen(false);
              qc.invalidateQueries({ queryKey: ['invoice', bookingId] });
              qc.invalidateQueries({ queryKey: ['invoices'] });
              qc.invalidateQueries({ queryKey: ['finance-overview'] });
              qc.invalidateQueries({ queryKey: ['refunds'] });
            }}
          />
        </div>
      )}
    </div>
  );
}

function InvoiceBody({ data }: { data: InvoiceDetail }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-between items-start gap-4">
        <div>
          <div className="text-lg font-bold text-ink">{data.vendor.brandName}</div>
          <div className="text-xs text-ink-soft mt-1">
            {data.vendor.addressLine ? `${data.vendor.addressLine}, ` : ''}
            {data.vendor.city}, {prettyEmirate(data.vendor.emirate)}
          </div>
          {data.vendor.trnNumber && (
            <div className="text-xs text-ink-soft mt-0.5">
              TRN: <span className="font-mono font-semibold text-ink">{data.vendor.trnNumber}</span>
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="label-eyebrow">Invoice no.</div>
          <div className="font-mono text-sm font-bold text-ink">{data.invoiceNumber}</div>
          <div className="mt-2 text-xs text-ink-soft">
            Issued {formatDate(data.issuedAt)}
            <br />
            Service date {formatDate(data.slotStart)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-xl bg-mint/30 p-4">
        <div>
          <div className="label-eyebrow mb-1">Billed to</div>
          <div className="text-sm font-semibold text-ink">{data.customer.name ?? '—'}</div>
          <div className="text-xs text-ink-soft">{data.customer.phone ?? ''}</div>
          {data.customer.email && (
            <div className="text-xs text-ink-soft">{data.customer.email}</div>
          )}
        </div>
        <div>
          <div className="label-eyebrow mb-1">Payment</div>
          <div className="text-sm font-semibold capitalize text-ink">
            {data.isWalkIn ? 'Cash at desk' : data.payment.status}
          </div>
          {data.payment.method && !data.isWalkIn && (
            <div className="text-xs text-ink-soft capitalize">via {data.payment.method}</div>
          )}
        </div>
      </div>

      <div>
        <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-ink-soft border-b border-mint-edge">
          <div className="col-span-7">Description</div>
          <div className="col-span-2 text-right">Subtotal</div>
          <div className="col-span-2 text-right">VAT ({data.summary.vatRatePct}%)</div>
          <div className="col-span-1 text-right">Total</div>
        </div>
        <div className="grid grid-cols-12 gap-2 px-3 py-3 text-sm">
          <div className="col-span-7">
            <div className="font-semibold text-ink">{data.line.serviceName}</div>
            <div className="text-xs text-ink-soft mt-0.5">Bay: {data.line.bayName}</div>
            {data.line.promoCode && (
              <div className="text-xs text-primary-deep mt-0.5">
                Promo applied: <span className="font-mono font-semibold">{data.line.promoCode}</span>
                {data.line.discountAed > 0 && ` (-${aed(data.line.discountAed)})`}
              </div>
            )}
          </div>
          <div className="col-span-2 text-right text-ink">{aed(data.line.subtotalAed)}</div>
          <div className="col-span-2 text-right text-ink">{aed(data.line.vatAed)}</div>
          <div className="col-span-1 text-right font-semibold text-ink">{aed(data.line.totalAed)}</div>
        </div>

        {data.refunds.filter((r) => r.status === 'processed').map((r) => (
          <div
            key={r.id}
            className="grid grid-cols-12 gap-2 px-3 py-2 text-sm bg-coral-soft/40 border-t border-mint-edge"
          >
            <div className="col-span-7">
              <div className="text-coral font-semibold">
                Credit note {r.creditNoteNumber ?? '—'}
              </div>
              <div className="text-xs text-ink-soft">
                {r.reason} · {formatDate(r.createdAt)}
              </div>
            </div>
            <div className="col-span-2 text-right text-coral">-{aed(r.amountAed - r.vatAed)}</div>
            <div className="col-span-2 text-right text-coral">-{aed(r.vatAed)}</div>
            <div className="col-span-1 text-right font-semibold text-coral">-{aed(r.amountAed)}</div>
          </div>
        ))}

        <div className="grid grid-cols-12 gap-2 px-3 py-3 text-sm bg-mint/30 border-t border-mint-edge">
          <div className="col-span-9 text-right font-bold text-ink">Net total</div>
          <div className="col-span-3 text-right font-bold text-ink">{aed(data.summary.netAed)}</div>
        </div>
      </div>

      <div className="text-[10px] text-ink-soft leading-relaxed">
        This is an FTA-compliant tax invoice. VAT is charged at the standard
        UAE rate of {data.summary.vatRatePct}%. Keep this invoice for your records.
      </div>
    </div>
  );
}

// ── Refund modal ─────────────────────────────────────────────────────────

function RefundModal({
  invoice,
  onClose,
  onSuccess,
}: {
  invoice: InvoiceDetail;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const remaining = invoice.summary.netAed;
  const [amount, setAmount] = useState(remaining);
  const [reason, setReason] = useState('');

  const mut = useMutation({
    mutationFn: () => recordRefund(invoice.id, { amountAed: amount, reason }),
    onSuccess,
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/50 px-4">
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-ink">Record refund</h3>
          <button onClick={onClose} className="text-ink-soft hover:text-ink" aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <p className="text-xs text-ink-soft leading-relaxed">
            Logs the refund + mints a sequential credit-note number. Issue the
            actual refund on your card terminal / cash drawer before clicking
            "Record". Remaining refundable: <span className="font-semibold text-ink">{aed(remaining)}</span>.
          </p>

          <div>
            <div className="label-eyebrow mb-1.5">Refund amount (AED)</div>
            <input
              type="number"
              className="input"
              min={1}
              max={remaining}
              value={amount}
              onChange={(e) => setAmount(Math.max(1, Math.min(remaining, Number(e.target.value))))}
            />
            <div className="mt-1 flex items-center gap-2">
              <button
                onClick={() => setAmount(remaining)}
                className="text-xs text-primary-deep hover:underline"
              >
                Full refund ({aed(remaining)})
              </button>
            </div>
          </div>

          <div>
            <div className="label-eyebrow mb-1.5">Reason</div>
            <textarea
              className="input min-h-[80px] resize-y"
              placeholder="Customer was unsatisfied, wash incomplete, no-show on our end…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={280}
            />
          </div>

          {mut.error && (
            <div className="rounded-lg bg-coral-soft px-3 py-2 text-xs text-coral">
              {extractError(mut.error)}
            </div>
          )}

          <div className="mt-2 flex items-center justify-end gap-2">
            <button onClick={onClose} className="btn-outlined">
              Cancel
            </button>
            <button
              onClick={() => mut.mutate()}
              disabled={!reason.trim() || amount < 1 || mut.isPending}
              className="rounded-full bg-coral px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
            >
              {mut.isPending ? 'Recording…' : `Record refund ${aed(amount)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Refunds tab ──────────────────────────────────────────────────────────

function RefundsTab({ from, to }: { from: string; to: string }) {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['refunds', from, to, page],
    queryFn: () => listRefunds({ from, to, page, pageSize: 20 }),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-mint-edge bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-mint/40 text-left text-[11px] font-bold uppercase tracking-wider text-ink-soft">
              <th className="px-4 py-3">Credit note</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Invoice</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-mint-edge">
            {isLoading && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-ink-soft">
                  Loading…
                </td>
              </tr>
            )}
            {data?.items.length === 0 && !isLoading && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-ink-soft">
                  No refunds in this window.
                </td>
              </tr>
            )}
            {data?.items.map((r) => (
              <RefundRowView
                key={r.id}
                row={r}
                onVoid={async () => {
                  if (!confirm(`Void credit note ${r.creditNoteNumber}? The refund row stays for audit.`)) return;
                  try {
                    await voidRefund(r.id);
                    qc.invalidateQueries({ queryKey: ['refunds'] });
                    qc.invalidateQueries({ queryKey: ['finance-overview'] });
                    qc.invalidateQueries({ queryKey: ['invoices'] });
                  } catch (e) {
                    alert(extractError(e));
                  }
                }}
              />
            ))}
          </tbody>
        </table>
      </div>

      {data && data.total > data.pageSize && (
        <Pagination
          page={page}
          totalPages={Math.ceil(data.total / data.pageSize)}
          onChange={setPage}
        />
      )}
    </div>
  );
}

function RefundRowView({ row, onVoid }: { row: RefundRow; onVoid: () => void }) {
  const isVoid = row.status === 'voided';
  return (
    <tr className={['hover:bg-mint/20', isVoid ? 'opacity-50' : ''].join(' ')}>
      <td className="px-4 py-3 font-mono text-xs font-semibold text-ink">
        {row.creditNoteNumber ?? '—'}
      </td>
      <td className="px-4 py-3 text-ink-soft">{formatDate(row.createdAt)}</td>
      <td className="px-4 py-3">
        <div className="font-medium text-ink">{row.booking.customerName ?? '—'}</div>
        <div className="text-xs text-ink-soft">{row.booking.customerPhone ?? '—'}</div>
      </td>
      <td className="px-4 py-3 font-mono text-xs text-ink-soft">
        {row.booking.invoiceNumber ?? '—'}
      </td>
      <td className="px-4 py-3 text-right font-semibold text-coral">-{aed(row.amountAed)}</td>
      <td className="px-4 py-3 text-xs text-ink-soft max-w-[220px] truncate" title={row.reason}>
        {row.reason}
      </td>
      <td className="px-4 py-3">
        {isVoid ? (
          <span className="inline-flex items-center rounded-full bg-mint-edge px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-ink-soft">
            Voided
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-coral-soft px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-coral">
            Processed
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        {!isVoid && (
          <button
            onClick={onVoid}
            className="rounded-lg border border-mint-edge bg-white px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-mint hover:text-ink"
          >
            Void
          </button>
        )}
      </td>
    </tr>
  );
}

// ── VAT tab ──────────────────────────────────────────────────────────────

function VatTab({ from, to }: { from: string; to: string }) {
  const [bucket, setBucket] = useState<'day' | 'month'>('month');
  const { data, isLoading } = useQuery({
    queryKey: ['vat-summary', from, to, bucket],
    queryFn: () => getVatSummary({ from, to, bucket }),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="rounded-xl border border-mint-edge bg-white p-1 flex items-center gap-1">
            {(['day', 'month'] as const).map((b) => (
              <button
                key={b}
                onClick={() => setBucket(b)}
                className={[
                  'rounded-lg px-3 py-1.5 text-xs font-semibold transition capitalize',
                  bucket === b ? 'bg-primary text-white' : 'text-ink-soft hover:text-ink',
                ].join(' ')}
              >
                {b === 'day' ? 'Daily' : 'Monthly'}
              </button>
            ))}
          </div>
          <span className="text-xs text-ink-soft">
            Standard UAE VAT rate · {data?.ratePct ?? 5}%
          </span>
        </div>
        <a
          href={vatSummaryCsvUrl({ from, to, bucket })}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary text-sm"
        >
          Download CSV
        </a>
      </div>

      <div className="rounded-2xl border border-mint-edge bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-mint/40 text-left text-[11px] font-bold uppercase tracking-wider text-ink-soft">
              <th className="px-4 py-3">Period</th>
              <th className="px-4 py-3 text-right">Bookings</th>
              <th className="px-4 py-3 text-right">Gross</th>
              <th className="px-4 py-3 text-right">Refunded</th>
              <th className="px-4 py-3 text-right">Net</th>
              <th className="px-4 py-3 text-right">VAT collected</th>
              <th className="px-4 py-3 text-right">VAT refunded</th>
              <th className="px-4 py-3 text-right">VAT due</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-mint-edge">
            {isLoading && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-ink-soft">
                  Loading…
                </td>
              </tr>
            )}
            {data?.items.length === 0 && !isLoading && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-ink-soft">
                  No data in this window.
                </td>
              </tr>
            )}
            {data?.items.map((b) => (
              <tr key={b.bucket} className="hover:bg-mint/20">
                <td className="px-4 py-3 font-mono text-xs text-ink">{b.bucket}</td>
                <td className="px-4 py-3 text-right text-ink-soft">{b.bookings}</td>
                <td className="px-4 py-3 text-right text-ink">{aed(b.grossAed)}</td>
                <td className="px-4 py-3 text-right text-coral">{b.refundedAed > 0 ? `-${aed(b.refundedAed)}` : '—'}</td>
                <td className="px-4 py-3 text-right font-semibold text-ink">{aed(b.netAed)}</td>
                <td className="px-4 py-3 text-right text-ink-soft">{aed(b.vatCollectedAed)}</td>
                <td className="px-4 py-3 text-right text-coral">{b.vatRefundedAed > 0 ? `-${aed(b.vatRefundedAed)}` : '—'}</td>
                <td className="px-4 py-3 text-right font-semibold text-ink">{aed(b.vatDueAed)}</td>
              </tr>
            ))}
            {data && data.items.length > 0 && (
              <tr className="bg-mint/30 font-bold">
                <td className="px-4 py-3 text-ink uppercase text-[11px] tracking-wider">Total</td>
                <td className="px-4 py-3 text-right text-ink">{data.totals.bookings}</td>
                <td className="px-4 py-3 text-right text-ink">{aed(data.totals.grossAed)}</td>
                <td className="px-4 py-3 text-right text-coral">
                  {data.totals.refundedAed > 0 ? `-${aed(data.totals.refundedAed)}` : '—'}
                </td>
                <td className="px-4 py-3 text-right text-ink">{aed(data.totals.netAed)}</td>
                <td className="px-4 py-3 text-right text-ink">{aed(data.totals.vatCollectedAed)}</td>
                <td className="px-4 py-3 text-right text-coral">
                  {data.totals.vatRefundedAed > 0 ? `-${aed(data.totals.vatRefundedAed)}` : '—'}
                </td>
                <td className="px-4 py-3 text-right text-ink">{aed(data.totals.vatDueAed)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Pagination ───────────────────────────────────────────────────────────

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  return (
    <div className="flex items-center justify-end gap-2 text-sm text-ink-soft">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="rounded-lg border border-mint-edge bg-white px-3 py-1.5 disabled:opacity-40"
      >
        Prev
      </button>
      <span>
        Page <span className="font-semibold text-ink">{page}</span> of {totalPages}
      </span>
      <button
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        className="rounded-lg border border-mint-edge bg-white px-3 py-1.5 disabled:opacity-40"
      >
        Next
      </button>
    </div>
  );
}

// ── Misc ─────────────────────────────────────────────────────────────────

function CardSkeleton({ rows }: { rows: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: rows * 3 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-mint-edge bg-white p-5 animate-pulse">
          <div className="h-3 w-1/3 bg-mint/60 rounded mb-3" />
          <div className="h-6 w-2/3 bg-mint/40 rounded" />
        </div>
      ))}
    </div>
  );
}

function aed(n: number): string {
  return `AED ${n.toLocaleString('en-AE')}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function prettyEmirate(e: string): string {
  return e.replace(/([A-Z])/g, ' $1').trim();
}

function extractError(e: unknown): string {
  if (typeof e === 'object' && e !== null && 'response' in e) {
    const resp = (e as { response?: { data?: { error?: { message?: string } } } }).response;
    return resp?.data?.error?.message ?? 'Request failed';
  }
  return e instanceof Error ? e.message : 'Request failed';
}
