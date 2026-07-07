import { haversineKm } from "../location/locationUtils";

// Central config + helpers for the customer delivery-address system.
// Firestore path: users/{uid}/addresses/{addressId}
// Single source of truth for the field list, label set, validation and formatting
// so the form, card, hook and Checkout all agree.

export const STORE_LOCATION = {
  lat: 13.8294079,
  lng: 100.0529543,
  name: "LK Fried Chicken",
};

// Delivery radius (km) — single source of truth shared by the address cards and
// Checkout so the "out of zone" rule is identical everywhere.
export const MAX_DELIVERY_RADIUS_KM = 8;

export const isOutOfZone = (distanceKm) =>
  distanceKm != null && Number(distanceKm) > MAX_DELIVERY_RADIUS_KM;

export const ADDRESS_LABELS = [
  { key: "home", label: "Home", emoji: "🏠" },
  { key: "work", label: "Work", emoji: "🏢" },
  { key: "other", label: "Other", emoji: "📍" },
];

export const labelMeta = (key) =>
  ADDRESS_LABELS.find((l) => l.key === key) || ADDRESS_LABELS[2];

// Blank address record — mirrors the Firestore field list exactly (minus the
// server-managed createdAt/updatedAt, which the hook adds on write).
export const emptyAddress = () => ({
  label: "home",
  receiverName: "",
  receiverPhone: "",
  houseNo: "",
  village: "",
  building: "",
  floor: "",
  room: "",
  soi: "",
  road: "",
  subdistrict: "",
  district: "",
  province: "",
  postcode: "",
  landmark: "",
  note: "",
  taxId: "",
  lat: null,
  lng: null,
  gpsAccuracy: null, // metres, from Geolocation API (null when pinned manually on the map)
  distanceKm: null,
  isDefault: false,
});

// Thai phone number: 9-10 digits starting with 0 (dashes/spaces allowed in input).
export const isValidThaiPhone = (phone) => /^0\d{8,9}$/.test(String(phone).replace(/[\s-]/g, ""));

// Two addresses closer than this are considered the same pin (duplicate guard).
const DUPLICATE_GPS_METERS = 15;
export const findDuplicateGps = (others, lat, lng) => {
  if (lat == null || lng == null) return null;
  return (
    others.find(
      (a) =>
        a.lat != null &&
        a.lng != null &&
        haversineKm(a.lat, a.lng, lat, lng) * 1000 < DUPLICATE_GPS_METERS
    ) || null
  );
};

// Required fields -> i18n message key used when empty.
export const REQUIRED_ADDRESS_FIELDS = [
  { key: "receiverName", msgKey: "valid.receiverNameRequired" },
  { key: "receiverPhone", msgKey: "valid.receiverPhoneRequired" },
  { key: "houseNo", msgKey: "valid.houseNoRequired" },
  { key: "subdistrict", msgKey: "valid.subdistrictRequired" },
  { key: "district", msgKey: "valid.districtRequired" },
  { key: "province", msgKey: "valid.provinceRequired" },
  { key: "postcode", msgKey: "valid.postcodeRequired" },
];

// Returns a { fieldKey: i18nKey } map for every problem (`_gps` for missing GPS).
// Values are translation keys — the form resolves them with t(). Empty = valid.
export const validateAddress = (a) => {
  const errors = {};
  for (const { key, msgKey } of REQUIRED_ADDRESS_FIELDS) {
    if (!String(a[key] ?? "").trim()) errors[key] = msgKey;
  }
  if (a.postcode && !/^\d{5}$/.test(String(a.postcode).trim())) {
    errors.postcode = "valid.postcodeFormat";
  }
  if (a.receiverPhone && !isValidThaiPhone(a.receiverPhone)) {
    errors.receiverPhone = "valid.phoneFormat";
  }
  if (a.lat == null || a.lng == null) {
    errors._gps = "valid.gpsRequired";
  }
  return errors;
};

// One-line human-readable address built from the structured fields.
export const formatFullAddress = (a) => {
  const parts = [
    a.houseNo && `No. ${a.houseNo}`,
    a.room && `Room ${a.room}`,
    a.floor && `Fl. ${a.floor}`,
    a.building,
    a.village,
    a.soi && `Soi ${a.soi}`,
    a.road && `${a.road} Rd.`,
    a.subdistrict,
    a.district,
    a.province,
    a.postcode,
  ].filter(Boolean);
  return parts.join(", ");
};
