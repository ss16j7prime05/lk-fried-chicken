// Full date-time label (th-TH locale) from a Firestore Timestamp / Date / string.
// Extracted verbatim from RiderOrderHistory and RiderOrderCard, where it was byte-identical.
export const formatDate = (createdAt) => {
  if (!createdAt) return "-";
  const d = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
  return d.toLocaleString("th-TH");
};
