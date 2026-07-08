// Single source of truth for the store open/closed logic — shared by Store Settings
// (editor + live badge), Customer (order gate) and Rider (no new jobs).
//
// Reads these fields off stores/{STORE_ID} (no new collection):
//   isOpen        : boolean            — manual master switch; false = force closed
//   storeHours    : { mon:[{open,close}], … }  — storefront hours (empty day = closed)
//   deliveryHours : { mon:[{open,close}], … }  — delivery hours (separate from storefront)
//   holidays      : [{ id, start:"YYYY-MM-DD", end:"YYYY-MM-DD", name }]  — single or multi-day
//
// A "range" is { open:"HH:MM", close:"HH:MM" }. Days may hold several ranges so a
// store can close for lunch and reopen (e.g. 08:00-12:00, 13:00-17:00, 18:00-21:00).

// Date.getDay() → key
export const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
// Monday-first order for the settings UI
export const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

// A range closing within this many minutes reports "closing_soon".
export const CLOSING_SOON_MINUTES = 30;

const toMin = (hhmm) => {
  const [h, m] = String(hhmm || "").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

const pad2 = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

// Holiday matching a given date (inclusive range, or single day when start===end/no end).
export const findHoliday = (holidays, date) => {
  const key = ymd(date);
  return (
    (holidays || []).find((h) => {
      if (!h || !h.start) return false;
      const end = h.end || h.start;
      return key >= h.start && key <= end;
    }) || null
  );
};

const dayRanges = (hours, dayKey) => {
  const arr = hours?.[dayKey];
  return Array.isArray(arr) ? arr.filter((r) => r && r.open && r.close) : [];
};

const pickHours = (store, which) =>
  which === "delivery" ? store?.deliveryHours : store?.storeHours;

// True once at least one day has a usable range — until then hours are considered
// "not configured" and the store is treated as always-open (backward compatible with
// stores created before this feature; only the manual switch/holidays can close them).
const hasConfiguredHours = (hours) =>
  !!hours &&
  Object.values(hours).some(
    (arr) => Array.isArray(arr) && arr.some((r) => r && r.open && r.close)
  );

// Next opening Date within the next 7 days, or null (also null when manually closed,
// since a manual close has no scheduled reopen).
export function nextOpenTime(store, now, which = "store") {
  if (store?.isOpen === false) return null;
  const hours = pickHours(store, which);
  for (let i = 0; i < 8; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    if (findHoliday(store?.holidays, d)) continue;
    const ranges = dayRanges(hours, DAY_KEYS[d.getDay()])
      .slice()
      .sort((a, b) => toMin(a.open) - toMin(b.open));
    for (const r of ranges) {
      const o = toMin(r.open);
      const cand = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(o / 60), o % 60);
      if (cand > now) return cand;
    }
  }
  return null;
}

// Computes the live status for a store.
// which: "store" (storefront) | "delivery"
// Returns { status: "open" | "closing_soon" | "closed", reason?, holidayName?, closesAt?, nextOpen? }
export function computeStatus(store, now = new Date(), which = "store") {
  if (store?.isOpen === false) {
    return { status: "closed", reason: "manual", nextOpen: null };
  }
  const holiday = findHoliday(store?.holidays, now);
  if (holiday) {
    return {
      status: "closed",
      reason: "holiday",
      holidayName: holiday.name || "",
      nextOpen: nextOpenTime(store, now, which),
    };
  }
  const hours = pickHours(store, which);
  if (!hasConfiguredHours(hours)) {
    return { status: "open", nextOpen: null };
  }
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const ranges = dayRanges(hours, DAY_KEYS[now.getDay()]);
  for (const r of ranges) {
    const o = toMin(r.open);
    const c = toMin(r.close);
    if (nowMin >= o && nowMin < c) {
      const closingSoon = c - nowMin <= CLOSING_SOON_MINUTES;
      return { status: closingSoon ? "closing_soon" : "open", closesAt: r.close, nextOpen: null };
    }
  }
  return { status: "closed", reason: "hours", nextOpen: nextOpenTime(store, now, which) };
}

// Convenience: can a customer place a delivery order right now?
export const canOrder = (store, now = new Date()) =>
  computeStatus(store, now, "delivery").status !== "closed";
