// ── Rider Income — Single Source of Truth ────────────────────────────────────────────
// Every rider income figure in the app (Home, Dashboard, Income Summary, Finance, History,
// Work Summary) is derived from THIS module so the numbers are always identical. Do not
// re-implement any income maths anywhere else — import from here.
//
// Formula (production):
//   Gross = deliveryFee + riderBonus
//   Net   = Gross − Tax (riderTax) − Adjustment (riderAdjustment)
// Missing fields default to 0 (no mock). "Completed" income = delivered orders; "Pending"
// income = orders the rider is actively carrying (picked_up / delivering) but hasn't
// delivered yet.
import { normalizeStatus, toDate } from "../store/orderStatus.js";

/* ── per-order maths ── */
export const orderGross = (o) => Number(o.deliveryFee || 0) + Number(o.riderBonus || 0);
export const orderTax = (o) => Number(o.riderTax || 0);
export const orderAdjustment = (o) => Number(o.riderAdjustment || 0);
export const orderNet = (o) => orderGross(o) - orderTax(o) - orderAdjustment(o);
export const orderCoins = (o) => Number(o.riderCoins || 0);
export const orderDistanceKm = (o) => {
  const k = o.distanceKm ?? o.distance ?? o.deliveryDistance;
  return typeof k === "number" && Number.isFinite(k) ? k : 0;
};
export const orderWhen = (o) => toDate(o.deliveredAt ?? o.completedAt ?? o.createdAt);

export const isCompleted = (o) => normalizeStatus(o.status) === "completed";
export const isPending = (o) => {
  const s = normalizeStatus(o.status);
  return s === "picked_up" || s === "delivering";
};

/* ── currency (one formatter, no rounding drift) ── */
export const fmtTHB = (n) => `฿${Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const fmtTHB0 = (n) => `฿${Number(n || 0).toLocaleString("th-TH", { maximumFractionDigits: 0 })}`;

/* ── date bucketing ── */
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const startOfWeek = (d) => { const x = startOfDay(d); x.setDate(x.getDate() - x.getDay()); return x; }; // Sun
const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);

export const periodStart = (d, gran) =>
  gran === "month" ? startOfMonth(d) : gran === "week" ? startOfWeek(d) : startOfDay(d);

export const addPeriods = (start, gran, n) => {
  const x = new Date(start);
  if (gran === "day") x.setDate(x.getDate() + n);
  else if (gran === "week") x.setDate(x.getDate() + n * 7);
  else x.setMonth(x.getMonth() + n);
  return x;
};

// Completed orders with a resolved delivery date (the basis for every income bucket).
export const completedWithDate = (orders) =>
  orders.filter(isCompleted).map((o) => ({ ...o, when: orderWhen(o) })).filter((o) => o.when);

const emptyBucket = (start = null, end = null) => ({ start, end, gross: 0, net: 0, tax: 0, orders: 0, distanceKm: 0, coins: 0 });

// Sum a set of completed(+dated) orders into a bucket. Reused for every period + lifetime.
const sumBucket = (list, start, end) =>
  list.reduce((b, o) => ({
    start, end,
    gross: b.gross + orderGross(o),
    net: b.net + orderNet(o),
    tax: b.tax + orderTax(o),
    orders: b.orders + 1,
    distanceKm: b.distanceKm + orderDistanceKm(o),
    coins: b.coins + orderCoins(o),
  }), emptyBucket(start, end));

// One period [start, start+1): the single place a period total is computed.
export const bucketFor = (completed, start, gran) => {
  const end = addPeriods(start, gran, 1);
  return sumBucket(completed.filter((o) => o.when >= start && o.when < end), start, end);
};

// The last `count` period starts ending at refDate (oldest → newest), for the chip row.
export const recentPeriods = (refDate, gran, count) => {
  const cur = periodStart(refDate, gran);
  const list = [];
  for (let i = count - 1; i >= 0; i--) list.push(addPeriods(cur, gran, -i));
  return list;
};

// The ONE summary every page reads — identical numbers guaranteed.
export function summarizeIncome(orders, refDate = new Date()) {
  const completed = completedWithDate(orders);
  const lifetime = sumBucket(completed, null, null);
  const pendingNet = orders.filter(isPending).reduce((s, o) => s + orderNet(o), 0);
  return {
    today: bucketFor(completed, periodStart(refDate, "day"), "day"),
    week: bucketFor(completed, periodStart(refDate, "week"), "week"),
    month: bucketFor(completed, periodStart(refDate, "month"), "month"),
    lifetime,
    completedNet: lifetime.net, // completed income = delivered net (within the loaded window)
    pendingNet,                 // income the rider is carrying but hasn't delivered yet
  };
}
