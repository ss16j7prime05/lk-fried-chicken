// Shared rider performance/income derivations — all computed from the rider's REAL orders
// (users see only their own via useRiderOrders; completed = delivered). No mock data: every
// figure defaults to 0 when there are no matching orders.
import { normalizeStatus, toDate } from "../store/orderStatus";

// Rider income per order = delivery fee + bonus (same basis as the home stats bar).
export const orderIncome = (o) => Number(o.deliveryFee || 0) + Number(o.riderBonus || 0);
export const orderDistanceKm = (o) => {
  const k = o.distanceKm ?? o.distance ?? o.deliveryDistance;
  return typeof k === "number" && Number.isFinite(k) ? k : 0;
};

// Completed orders with a resolved delivery date (deliveredAt → completedAt → createdAt).
export const completedWithDate = (orders) =>
  orders
    .filter((o) => normalizeStatus(o.status) === "completed")
    .map((o) => ({ ...o, when: toDate(o.deliveredAt ?? o.completedAt ?? o.createdAt) }))
    .filter((o) => o.when);

// Acceptance / cancellation over the jobs this rider actually took (riderId == uid).
// Acceptance = completed / taken ; cancellation = cancelled / taken. Real, honest 0 when none.
export const performanceRates = (orders) => {
  const taken = orders.length;
  const completed = orders.filter((o) => normalizeStatus(o.status) === "completed").length;
  const cancelled = orders.filter((o) => normalizeStatus(o.status) === "cancelled").length;
  return {
    taken,
    completed,
    cancelled,
    acceptanceRate: taken > 0 ? (completed / taken) * 100 : 0,
    cancellationRate: taken > 0 ? (cancelled / taken) * 100 : 0,
  };
};

// Tier derived from lifetime completed count (used only when the profile has no explicit
// riderLevel). Real-data-derived, not mock.
export const riderTier = (completedCount) =>
  completedCount >= 200 ? "gold" : completedCount >= 50 ? "silver" : "bronze";

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

// Bucket completed orders into [start, start+1period): income / order count / distance.
export const bucketFor = (completed, start, gran) => {
  const end = addPeriods(start, gran, 1);
  const inRange = completed.filter((o) => o.when >= start && o.when < end);
  return {
    start,
    end,
    income: inRange.reduce((s, o) => s + orderIncome(o), 0),
    orders: inRange.length,
    distanceKm: inRange.reduce((s, o) => s + orderDistanceKm(o), 0),
  };
};

// The last `count` period starts ending at refDate (oldest → newest), for the chip row.
export const recentPeriods = (refDate, gran, count) => {
  const cur = periodStart(refDate, gran);
  const list = [];
  for (let i = count - 1; i >= 0; i--) list.push(addPeriods(cur, gran, -i));
  return list;
};
