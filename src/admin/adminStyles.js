// Shared inline-style constants for the Admin panels. Each object below was previously
// duplicated byte-for-byte across multiple panels; consolidated here so there is a single
// copy. Values are unchanged — behavior is identical.

export const card = {
  background: "#1e1e1e",
  borderRadius: "16px",
  padding: "16px",
  boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
};

export const input = {
  padding: "10px",
  borderRadius: "10px",
  border: "1px solid #444",
  background: "#2a2a2a",
  color: "#fff",
};

// Table header/cell pair A — OrdersPanel + PaymentsPanel (th nowrap, td top-aligned).
export const thA = { textAlign: "left", padding: "8px", color: "#999", fontSize: "12px", whiteSpace: "nowrap" };
export const tdA = { padding: "8px", fontSize: "13px", verticalAlign: "top" };

// Table header/cell pair B — CustomersPanel + RidersPanel (no nowrap / top-align). Kept
// separate from pair A on purpose.
export const thB = { textAlign: "left", padding: "8px", color: "#999", fontSize: "12px" };
export const tdB = { padding: "8px", fontSize: "13px" };
