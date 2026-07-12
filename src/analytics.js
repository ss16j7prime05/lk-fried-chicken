// Shared Analytics (SSOT, Phase 4.7) — one aggregator for every dashboard metric.
// It works on the arrays the app ALREADY subscribes to (orders / customers / riders
// in Admin/Store dashboards), so it issues no new Firestore query and duplicates no
// subscription. Reuses normalizeStatus (the status SSOT) so "completed"/"cancelled"
// logic is never re-implemented. Pure aggregation — no side effects, backward safe.
import { useMemo } from "react";
import { normalizeStatus } from "./store/orderStatus";

const num = (v) => Number(v || 0);
const totalOf = (o) => num(o.grandTotal ?? o.subtotal ?? 0);
const isCompleted = (o) => normalizeStatus(o.status) === "completed";
const isCancelled = (o) => normalizeStatus(o.status) === "cancelled";

// Aggregate already-fetched data into the SSOT metric shape. Reuses existing queries
// (caller passes what it already has); duplicates no aggregation.
export function getAnalytics({ orders = [], customers = [], riders = [] } = {}) {
  const completed = orders.filter(isCompleted);
  const cancelled = orders.filter(isCancelled);
  const revenue = completed.reduce((s, o) => s + totalOf(o), 0);

  const ordersSummary = {
    total: orders.length,
    completed: completed.length,
    cancelled: cancelled.length,
    active: orders.length - completed.length - cancelled.length,
  };

  const salesSummary = {
    revenue,
    orders: completed.length,
    avgOrderValue: completed.length ? Math.round(revenue / completed.length) : 0,
  };

  const refunded = orders
    .filter((o) => (o.refundStatus || "none") === "refunded")
    .reduce((s, o) => s + num(o.refundAmount ?? o.grandTotal), 0);
  const revenueSummary = {
    gross: orders.reduce((s, o) => s + totalOf(o), 0),
    net: revenue,
    refunded,
  };

  // Customer activity derived from orders; falls back to a directory array if given.
  const custMap = new Map();
  orders.forEach((o) => {
    const k = o.phone || o.customerId;
    if (!k) return;
    const c = custMap.get(k) || { orders: 0, spent: 0 };
    c.orders += 1;
    if (isCompleted(o)) c.spent += totalOf(o);
    custMap.set(k, c);
  });
  const customerSummary = {
    total: customers.length || custMap.size,
    active: custMap.size,
    repeat: [...custMap.values()].filter((c) => c.orders > 1).length,
  };

  const riderSet = new Set(completed.filter((o) => o.riderId).map((o) => o.riderId));
  const riderSummary = {
    total: riders.length || riderSet.size,
    active: riderSet.size,
    deliveries: completed.filter((o) => o.riderId).length,
  };

  const dashboardMetrics = {
    revenue,
    orders: orders.length,
    completed: completed.length,
    cancelled: cancelled.length,
    customers: customerSummary.active,
    riders: riderSummary.active,
  };

  return {
    salesSummary,
    ordersSummary,
    customerSummary,
    riderSummary,
    revenueSummary,
    dashboardMetrics,
    generatedAt: Date.now(),
  };
}

// React hook: memoized analytics over data the caller already holds — no extra query,
// no duplicate hook. Shared by any role's dashboard.
export function useAnalytics(data) {
  return useMemo(() => getAnalytics(data || {}), [data]);
}
