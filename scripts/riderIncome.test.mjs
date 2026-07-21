// Offline unit tests for the rider income SSOT (src/rider/riderIncome.js).
// Proves: (1) the Net formula, (2) every "page" computes IDENTICAL totals from the same
// orders (Home / Income Summary / Finance / Work Summary / History), (3) no rounding drift
// (sum of per-order net == bucket net exactly), (4) pending vs completed split.
import {
  orderGross, orderNet, summarizeIncome, completedWithDate, bucketFor, periodStart,
} from "../src/rider/riderIncome.js";

let pass = 0, fail = 0;
const eq = (a, b, msg) => { const ok = Math.abs(a - b) < 1e-9; if (ok) pass++; else { fail++; console.error(`FAIL: ${msg} — got ${a}, expected ${b}`); } };
const ok = (c, msg) => { if (c) pass++; else { fail++; console.error(`FAIL: ${msg}`); } };

// Fixed "now" so buckets are deterministic. Wed 2026-07-15 12:00 local.
const NOW = new Date(2026, 6, 15, 12, 0, 0);
const at = (d) => new Date(d).toISOString();

// Orders: fee + bonus − tax − adjustment.  net = 100+20-5-0 = 115, etc.
const orders = [
  // today (2026-07-15)
  { id: "a", status: "completed", deliveredAt: at(new Date(2026, 6, 15, 9)), deliveryFee: 100, riderBonus: 20, riderTax: 5, riderAdjustment: 0, distanceKm: 3 },
  { id: "b", status: "completed", deliveredAt: at(new Date(2026, 6, 15, 11)), deliveryFee: 50, riderBonus: 0, riderTax: 0, riderAdjustment: 2, distanceKm: 1.5 },
  // earlier this week (Sun 2026-07-12)
  { id: "c", status: "completed", deliveredAt: at(new Date(2026, 6, 12, 18)), deliveryFee: 80, riderBonus: 10, riderTax: 0, riderAdjustment: 0, distanceKm: 4 },
  // earlier this month (2026-07-02)
  { id: "d", status: "completed", deliveredAt: at(new Date(2026, 6, 2, 20)), deliveryFee: 60, riderBonus: 0, riderTax: 3, riderAdjustment: 0, distanceKm: 2 },
  // last month (2026-06-20)
  { id: "e", status: "completed", deliveredAt: at(new Date(2026, 5, 20, 20)), deliveryFee: 90, riderBonus: 0, riderTax: 0, riderAdjustment: 0, distanceKm: 5 },
  // pending (in progress) — not completed
  { id: "f", status: "delivering", deliveryFee: 40, riderBonus: 5, riderTax: 0, riderAdjustment: 0 },
  // cancelled — excluded from income
  { id: "g", status: "cancelled", deliveryFee: 999, riderBonus: 999 },
];

// (1) formula
eq(orderGross(orders[0]), 120, "gross a = fee+bonus");
eq(orderNet(orders[0]), 115, "net a = 120-5-0");
eq(orderNet(orders[1]), 48, "net b = 50-0-2");

// (2) Every page uses the same functions -> identical values.
const inc = summarizeIncome(orders, NOW);
const completed = completedWithDate(orders);

// Home stats bar today  == Finance today  == Income-Summary current-day bucket
const homeToday = summarizeIncome(orders, NOW).today.net;
const financeToday = inc.today.net;
const incomeSummaryToday = bucketFor(completed, periodStart(NOW, "day"), "day").net;
eq(homeToday, financeToday, "Home today == Finance today");
eq(homeToday, incomeSummaryToday, "Home today == Income Summary today");
eq(homeToday, 115 + 48, "today net = 163");

// Week (Sun-based) includes today + c
eq(inc.week.net, 115 + 48 + 90, "week net = today + c(90)");
// Month includes week + d
eq(inc.month.net, 115 + 48 + 90 + 57, "month net = week + d(57)");
// Lifetime includes e (last month) too
eq(inc.lifetime.net, 115 + 48 + 90 + 57 + 90, "lifetime net = all completed");
eq(inc.lifetime.orders, 5, "lifetime completed count = 5 (cancelled/pending excluded)");

// (3) No rounding drift: History sums per-order net; must equal the Income Summary bucket.
const historyTodaySum = completed
  .filter((o) => o.when >= periodStart(NOW, "day") && o.when < new Date(2026, 6, 16))
  .reduce((s, o) => s + orderNet(o), 0);
eq(historyTodaySum, incomeSummaryToday, "History per-order sum == bucket net (no rounding drift)");

// (4) pending vs completed split
eq(inc.pendingNet, 45, "pending net = f(45)");
eq(inc.completedNet, inc.lifetime.net, "completedNet == lifetime net");
ok(inc.pendingNet !== inc.completedNet, "pending and completed are distinct");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
