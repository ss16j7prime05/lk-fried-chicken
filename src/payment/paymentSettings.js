// Single source of truth for the store's e-payment configuration, stored on
// stores/{STORE_ID}.paymentSettings (no separate collection). Shared by the
// Store Settings editor (writer) and Customer Checkout (reader) so the shape,
// defaults and validation never diverge.
//
// The order document's payment method (order.payment.method) still uses the
// canonical keys 'cash' | 'promptpay' | 'transfer' — read by Store/Rider/Admin
// dashboards and refunds — so those are NOT renamed. The *settings* object uses
// explicit enable flags (cashEnabled / promptPayEnabled / bankEnabled) plus flat
// account fields; the mapping between the two lives in PAYMENT_ENABLE_FLAG.

// Canonical order-method keys (order.payment.method) — unchanged.
export const PAYMENT_KEYS = ["cash", "promptpay", "transfer"];

// order-method key -> paymentSettings enable-flag name.
export const PAYMENT_ENABLE_FLAG = {
  cash: "cashEnabled",
  promptpay: "promptPayEnabled",
  transfer: "bankEnabled",
};

export const DEFAULT_PAYMENT = {
  cashEnabled: true,
  promptPayEnabled: true,
  promptPayNumber: "",   // Thai PromptPay target — phone (10 digits) or national ID (13)
  promptPayQrUrl: "",    // Cloudinary URL of the store's uploaded PromptPay QR image
  bankEnabled: true,
  bankName: "",
  accountName: "",
  accountNumber: "",
  default: "cash",       // one of PAYMENT_KEYS
};

// Merge stored settings over defaults — reading BOTH the new field names and the
// legacy shape (cash/promptpay/transfer, promptpayId, bankTransfer{}) so existing
// store docs keep working. Keeps at least one method enabled and `default`
// pointing at an enabled method (falls back to the first enabled).
export const normalizePayment = (p) => {
  const raw = p || {};
  const b = raw.bankTransfer || {};
  const next = {
    cashEnabled:      raw.cashEnabled      ?? raw.cash        ?? true,
    promptPayEnabled: raw.promptPayEnabled ?? raw.promptpay   ?? true,
    promptPayNumber:  raw.promptPayNumber  ?? raw.promptpayId ?? "",
    promptPayQrUrl:   raw.promptPayQrUrl   ?? "",
    bankEnabled:      raw.bankEnabled       ?? raw.transfer   ?? true,
    bankName:         raw.bankName          ?? b.bankName      ?? "",
    accountName:      raw.accountName       ?? b.accountName   ?? "",
    accountNumber:    raw.accountNumber     ?? b.accountNumber ?? "",
    default:          raw.default ?? "cash",
  };
  const enabled = PAYMENT_KEYS.filter((k) => next[PAYMENT_ENABLE_FLAG[k]]);
  if (enabled.length === 0) { next.cashEnabled = true; next.default = "cash"; return next; }
  if (!next[PAYMENT_ENABLE_FLAG[next.default]]) next.default = enabled[0];
  return next;
};

// The list of enabled order-method keys, in canonical order.
export const enabledMethods = (p) => PAYMENT_KEYS.filter((k) => !!p?.[PAYMENT_ENABLE_FLAG[k]]);

// PromptPay ID = 10-digit phone or 13-digit national ID; bank account = 10–15 digits.
export const isValidPromptPayId = (v) => { const s = String(v).replace(/\D/g, ""); return s.length === 10 || s.length === 13; };
export const isValidAccountNumber = (v) => { const s = String(v).replace(/\D/g, ""); return s.length >= 10 && s.length <= 15; };
