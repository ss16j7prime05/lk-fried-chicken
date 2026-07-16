// Full date-time label (th-TH locale) from a Firestore Timestamp / Date / string.
// Extracted verbatim from RiderOrderHistory and RiderOrderCard, where it was byte-identical.
export const formatDate = (createdAt) => {
  if (!createdAt) return "-";
  const d = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
  return d.toLocaleString("th-TH");
};

// Translated vehicle-type label (registration stores the raw type). Shared by
// RiderProfile and RiderSettings (was duplicated byte-for-byte in both).
export const vehicleLabel = (v, t) =>
  v === "car"
    ? t("ro.vehicle.car")
    : v === "motorcycle"
    ? t("ro.vehicle.motorcycle")
    : v === "bicycle"
    ? t("ro.vehicle.bicycle")
    : v || "-";
