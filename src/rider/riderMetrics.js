// Rider performance derivations. All INCOME/bucketing maths live in riderIncome.js (the
// single source of truth) and are re-exported here so existing importers keep one import
// path and there is no duplicated logic.
import { normalizeStatus } from "../store/orderStatus";

export {
  orderGross, orderNet, orderTax, orderAdjustment, orderCoins, orderDistanceKm,
  completedWithDate, periodStart, addPeriods, bucketFor, recentPeriods,
  summarizeIncome, fmtTHB, fmtTHB0,
} from "./riderIncome";

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
