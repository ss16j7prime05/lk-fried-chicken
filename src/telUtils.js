// Shared tel: link builder (SSOT) — one place that turns a stored phone number into a
// dialable href. `tel:` breaks on spaces, so numbers saved as "081-234 5678" must be
// stripped before use; and a missing number must produce "" (never "tel:undefined",
// which opens the dialer on a literal empty/garbage number).
//
// pages/store/Settings.jsx still has its own local copy of this and the other ~15 tel:
// call sites interpolate the raw value inline — migrating them is tracked in TODO.md.
export const telHref = (phone) => {
  const digits = String(phone ?? "").replace(/[\s-()]/g, "");
  return digits ? `tel:${digits}` : "";
};

// จะโทรได้ไหม — ใช้ตัดสินใจ enable/disable ปุ่มโทร ไม่ให้กดแล้วเปิดสมุดโทรศัพท์เปล่า ๆ
export const canCall = (phone) => Boolean(telHref(phone));
