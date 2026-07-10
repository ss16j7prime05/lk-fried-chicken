// Single source of truth for the store's e-payment configuration, stored on
// stores/{STORE_ID}.paymentSettings (no separate collection). Shared by the
// Store Settings editor (writer) and Customer Checkout (reader) so the shape,
// defaults and validation never diverge.

// Method keys match the values written to orders (order.payment.method):
// 'cash' | 'promptpay' | 'transfer'.
export const PAYMENT_KEYS = ["cash", "promptpay", "transfer"];

export const EMPTY_BANK = { bankName: "", accountName: "", accountNumber: "" };

export const DEFAULT_PAYMENT = {
  cash: true, promptpay: true, transfer: true, default: "cash",
  promptpayId: "",           // Thai PromptPay ID — phone (10 digits) or national ID (13)
  bankTransfer: EMPTY_BANK,  // bank account for manual transfer
};

// Merge stored settings over defaults, keep at least one method enabled, and
// keep `default` pointing at an enabled method (falls back to the first enabled).
export const normalizePayment = (p) => {
  const next = {
    ...DEFAULT_PAYMENT,
    ...(p || {}),
    bankTransfer: { ...EMPTY_BANK, ...(p?.bankTransfer || {}) },
  };
  const enabled = PAYMENT_KEYS.filter((k) => next[k]);
  if (enabled.length === 0) return { ...next, cash: true, default: "cash" };
  if (!next[next.default]) next.default = enabled[0];
  return next;
};

// The list of enabled methods, in canonical order.
export const enabledMethods = (p) => PAYMENT_KEYS.filter((k) => !!p?.[k]);

// PromptPay ID = 10-digit phone or 13-digit national ID; bank account = 10–15 digits.
export const isValidPromptPayId = (v) => { const s = String(v).replace(/\D/g, ""); return s.length === 10 || s.length === 13; };
export const isValidAccountNumber = (v) => { const s = String(v).replace(/\D/g, ""); return s.length >= 10 && s.length <= 15; };

// PromptPay QR image URL via the public promptpay.io service (no extra dependency);
// returns "" when the id isn't a valid PromptPay target.
export const promptPayQrUrl = (v) => { const s = String(v).replace(/\D/g, ""); return isValidPromptPayId(s) ? `https://promptpay.io/${s}.png` : ""; };
