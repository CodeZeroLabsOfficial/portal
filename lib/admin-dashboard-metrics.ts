import type { CustomerRecord } from "@/types/customer";
import type { InvoiceRecord } from "@/types/invoice";
import type { PaymentRecord } from "@/types/payment";
import type { SubscriptionRecord } from "@/types/subscription";

function startOfMonthMs(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

function startOfPreviousMonthMs(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime();
}

function startOfYearMs(d: Date): number {
  return new Date(d.getFullYear(), 0, 1).getTime();
}

/** CRM rows shown in the Customers directory (excludes account-only shells). */
export function isCrmDirectoryCustomer(c: CustomerRecord): boolean {
  return !c.accountOnly;
}

/** Contacts carry the sky “Contact” badge in the CRM UI (`crmType === "contact"`). */
export function isCrmContact(c: CustomerRecord): boolean {
  return isCrmDirectoryCustomer(c) && c.crmType === "contact";
}

export function countCrmContacts(customers: CustomerRecord[]): number {
  return customers.filter(isCrmContact).length;
}

/** Month-over-month % change in new CRM contacts created (calendar months). */
export function crmContactsMomStats(
  customers: CustomerRecord[],
  now: Date,
): { pct: number; neutral: boolean; lastMonthNew: number } {
  const contacts = customers.filter(isCrmContact);
  const thisMonthStart = startOfMonthMs(now);
  const lastMonthStart = startOfPreviousMonthMs(now);
  const nowMs = now.getTime();
  const newThisMonth = contacts.filter(
    (c) => c.createdAt >= thisMonthStart && c.createdAt <= nowMs,
  ).length;
  const newLastMonth = contacts.filter(
    (c) => c.createdAt >= lastMonthStart && c.createdAt < thisMonthStart,
  ).length;
  if (newLastMonth === 0 && newThisMonth === 0) {
    return { pct: 0, neutral: true, lastMonthNew: 0 };
  }
  if (newLastMonth === 0) {
    return {
      pct: newThisMonth > 0 ? 100 : 0,
      neutral: newThisMonth === 0,
      lastMonthNew: 0,
    };
  }
  const pct = ((newThisMonth - newLastMonth) / newLastMonth) * 100;
  return { pct, neutral: Math.abs(pct) < 0.05, lastMonthNew: newLastMonth };
}

/** Same recurring statuses as the admin subscriptions table (Active / Trialing badges). */
export function isBillableSubscriptionStatus(status: SubscriptionRecord["status"]): boolean {
  return status === "active" || status === "trialing";
}

/** Aligns with `resolvedMonthlyMinor` on the subscriptions directory. */
function subscriptionMrrMinor(s: SubscriptionRecord): number {
  if (typeof s.monthlyAmountMinor === "number" && s.monthlyAmountMinor > 0) {
    return s.monthlyAmountMinor;
  }
  if (s.interval === "month" && typeof s.mrrAmount === "number" && s.mrrAmount > 0) {
    return s.mrrAmount;
  }
  if (s.interval === "year" && typeof s.mrrAmount === "number" && s.mrrAmount > 0) {
    return Math.round(s.mrrAmount / 12);
  }
  if (typeof s.mrrAmount === "number" && s.mrrAmount > 0) {
    return s.mrrAmount;
  }
  return 0;
}

/** Sum of normalized monthly recurring revenue for active / trialing subscriptions. */
export function sumActiveSubscriptionMrrMinor(subscriptions: SubscriptionRecord[]): number {
  let total = 0;
  for (const s of subscriptions) {
    if (!isBillableSubscriptionStatus(s.status)) {
      continue;
    }
    total += subscriptionMrrMinor(s);
  }
  return total;
}

export function countActiveSubscriptions(subscriptions: SubscriptionRecord[]): number {
  return subscriptions.filter((s) => isBillableSubscriptionStatus(s.status)).length;
}

export function succeededPaymentsInRange(
  payments: PaymentRecord[],
  startMs: number,
  endMs: number,
): PaymentRecord[] {
  return payments.filter(
    (p) =>
      p.status === "succeeded" &&
      typeof p.createdAt === "number" &&
      p.createdAt >= startMs &&
      p.createdAt <= endMs,
  );
}

export function sumPaymentAmountMinor(payments: PaymentRecord[]): number {
  return payments.reduce((sum, p) => sum + (p.amount > 0 ? p.amount : 0), 0);
}

/** Succeeded payment volume: this month-to-date vs same day range last month. */
export function succeededPaymentsMomStats(
  payments: PaymentRecord[],
  now: Date,
): { pct: number; neutral: boolean; lastMinor: number } {
  const thisMonthStart = startOfMonthMs(now);
  const nowMs = now.getTime();
  const lastMonthStart = startOfPreviousMonthMs(now);
  const dom = now.getDate();
  const daysInPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  const cmpDom = Math.min(dom, daysInPrevMonth);
  const lastWindowEnd = new Date(
    now.getFullYear(),
    now.getMonth() - 1,
    cmpDom,
    23,
    59,
    59,
    999,
  ).getTime();
  const thisSlice = succeededPaymentsInRange(payments, thisMonthStart, nowMs);
  const lastSlice = succeededPaymentsInRange(payments, lastMonthStart, lastWindowEnd);
  const a = sumPaymentAmountMinor(thisSlice);
  const b = sumPaymentAmountMinor(lastSlice);
  if (a === 0 && b === 0) {
    return { pct: 0, neutral: true, lastMinor: 0 };
  }
  if (b === 0) {
    return { pct: a > 0 ? 100 : 0, neutral: a === 0, lastMinor: 0 };
  }
  const pct = ((a - b) / b) * 100;
  return { pct, neutral: Math.abs(pct) < 0.05, lastMinor: b };
}

export type PaymentsPeriodSummary = {
  amountMinor: number;
  count: number;
  useYtd: boolean;
  year: number;
};

/** This month’s succeeded payments, or YTD when the current month is empty. */
export function summarizeSucceededPayments(
  payments: PaymentRecord[],
  now: Date,
): PaymentsPeriodSummary {
  const monthStart = startOfMonthMs(now);
  const nowMs = now.getTime();
  const thisMonth = succeededPaymentsInRange(payments, monthStart, nowMs);
  const amountMinor = sumPaymentAmountMinor(thisMonth);
  const count = thisMonth.length;
  if (amountMinor > 0 || count > 0) {
    return { amountMinor, count, useYtd: false, year: now.getFullYear() };
  }
  const ytd = succeededPaymentsInRange(payments, startOfYearMs(now), nowMs);
  return {
    amountMinor: sumPaymentAmountMinor(ytd),
    count: ytd.length,
    useYtd: true,
    year: now.getFullYear(),
  };
}

export function paidInvoicesInRange(
  invoices: InvoiceRecord[],
  startMs: number,
  endMs: number,
): InvoiceRecord[] {
  return invoices.filter(
    (inv) =>
      inv.status === "paid" &&
      typeof inv.paidAt === "number" &&
      inv.paidAt >= startMs &&
      inv.paidAt <= endMs,
  );
}

export function sumInvoiceAmountDueMinor(invoices: InvoiceRecord[]): number {
  return invoices.reduce((sum, inv) => sum + inv.amountDue, 0);
}

/** Paid invoice revenue: this month-to-date vs same day range last month (Revenue card footer / delta). */
export function paidInvoiceRevenueMomStats(
  invoices: InvoiceRecord[],
  now: Date,
): { pct: number; neutral: boolean; lastMinor: number } {
  const thisMonthStart = startOfMonthMs(now);
  const nowMs = now.getTime();
  const lastMonthStart = startOfPreviousMonthMs(now);
  const dom = now.getDate();
  const daysInPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  const cmpDom = Math.min(dom, daysInPrevMonth);
  const lastWindowEnd = new Date(
    now.getFullYear(),
    now.getMonth() - 1,
    cmpDom,
    23,
    59,
    59,
    999,
  ).getTime();
  const thisSlice = paidInvoicesInRange(invoices, thisMonthStart, nowMs);
  const lastSlice = paidInvoicesInRange(invoices, lastMonthStart, lastWindowEnd);
  const a = sumInvoiceAmountDueMinor(thisSlice);
  const b = sumInvoiceAmountDueMinor(lastSlice);
  if (a === 0 && b === 0) {
    return { pct: 0, neutral: true, lastMinor: 0 };
  }
  if (b === 0) {
    return { pct: a > 0 ? 100 : 0, neutral: a === 0, lastMinor: 0 };
  }
  const pct = ((a - b) / b) * 100;
  return { pct, neutral: Math.abs(pct) < 0.05, lastMinor: b };
}

export function comparableLastMonthPaymentMinor(payments: PaymentRecord[], now: Date): number {
  const dom = now.getDate();
  const daysInPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  const cmpDom = Math.min(dom, daysInPrevMonth);
  const lastMonthComparableEnd = new Date(
    now.getFullYear(),
    now.getMonth() - 1,
    cmpDom,
    23,
    59,
    59,
    999,
  ).getTime();
  return sumPaymentAmountMinor(
    succeededPaymentsInRange(payments, startOfPreviousMonthMs(now), lastMonthComparableEnd),
  );
}
