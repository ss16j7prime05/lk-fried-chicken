import { useMemo, useState } from "react";
import { MapPin, Map as MapIcon, LocateFixed, Check, Star } from "lucide-react";
import { Input } from "../../ui/Input";
import { Button } from "../../ui/Button";
import { usePreferences } from "../../../context/PreferencesContext";
import LocationPicker from "../../../location/LocationPicker.jsx";
import { reverseGeocode } from "../../../location/locationUtils";
import {
  ADDRESS_LABELS,
  STORE_LOCATION,
  emptyAddress,
  validateAddress,
  findDuplicateGps,
} from "../../../constants/address";

// One labelled input with an inline error message + red ring when invalid.
// `error` is an already-translated string (or falsy).
const Field = ({ label, required, error, className = "", ...props }) => (
  <div className="space-y-1">
    <Input
      label={required ? `${label} *` : label}
      className={
        error
          ? "border-secondary bg-secondary/5 focus:border-secondary focus:ring-secondary/20"
          : className
      }
      {...props}
    />
    {error && <p className="text-xs font-bold text-secondary pl-1">{error}</p>}
  </div>
);

const SectionLabel = ({ children }) => (
  <p className="text-xs font-black text-gray-400 uppercase tracking-wider">{children}</p>
);

// Address create/edit form. Controlled entirely in local state; calls onSubmit(data)
// with the full record (GPS is mandatory and validated before submit).
// `others` = the customer's other saved addresses (used to reject a duplicate GPS pin).
export const AddressForm = ({ initial, others = [], onSubmit, onCancel, submitting = false, lockDefault = false }) => {
  const { t } = usePreferences();
  const [form, setForm] = useState(() => ({
    ...emptyAddress(),
    ...(initial || {}),
    ...(lockDefault ? { isDefault: true } : {}),
  }));
  const [errors, setErrors] = useState({}); // { field: i18nKey }
  const [mapOpen, setMapOpen] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [gpsText, setGpsText] = useState("");

  const set = (key) => (e) => {
    const value = e?.target ? e.target.value : e;
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const hasGps = form.lat != null && form.lng != null;

  // accuracy: metres from the Geolocation API; null for a manual map pin (treated as exact).
  const applyLocation = async (lat, lng, knownAddress, accuracy = null) => {
    setForm((prev) => ({ ...prev, lat, lng, gpsAccuracy: accuracy }));
    setErrors((prev) => ({ ...prev, _gps: undefined }));
    const text = knownAddress || (await reverseGeocode(lat, lng));
    setGpsText(text);
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setErrors((prev) => ({ ...prev, _gps: "valid.deviceNoGps" }));
      return;
    }
    setGpsBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await applyLocation(
          pos.coords.latitude,
          pos.coords.longitude,
          null,
          pos.coords.accuracy != null ? Math.round(pos.coords.accuracy) : null
        );
        setGpsBusy(false);
      },
      () => {
        setErrors((prev) => ({ ...prev, _gps: "valid.gpsFailed" }));
        setGpsBusy(false);
      }
    );
  };

  const handleConfirmMap = async ({ lat, lng, address }) => {
    await applyLocation(lat, lng, address);
    setMapOpen(false);
  };

  const handleSubmit = () => {
    const errs = validateAddress(form);
    const dup = findDuplicateGps(others, form.lat, form.lng);
    if (dup) errs._gps = "addr.duplicateGps";
    setErrors(errs);
    if (Object.keys(errs).filter((k) => errs[k]).length > 0) return;
    onSubmit(form);
  };

  // translated messages for the "please fix" summary
  const errorList = useMemo(
    () => Object.values(errors).filter(Boolean).map((k) => t(k)),
    [errors, t]
  );

  return (
    <div className="flex flex-col max-h-[88vh]">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-gray-100">
        <h2 className="text-xl font-black text-gray-900">
          {initial ? t("addr.edit") : t("addr.new")}
        </h2>
        <p className="text-sm text-gray-400 font-medium mt-0.5">{t("addr.formSubtitle")}</p>
      </div>

      {/* Scrollable body */}
      <div className="px-6 py-5 space-y-6 overflow-y-auto">
        {/* Label chips */}
        <div className="space-y-2">
          <SectionLabel>{t("addr.labelSection")}</SectionLabel>
          <div className="flex gap-3">
            {ADDRESS_LABELS.map((l) => {
              const active = form.label === l.key;
              return (
                <button
                  key={l.key}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, label: l.key }))}
                  className={`flex-1 py-3 rounded-2xl font-bold text-sm border transition-all ${
                    active
                      ? "bg-primary text-white border-primary"
                      : "bg-gray-50 text-gray-600 border-gray-100 hover:border-primary"
                  }`}
                >
                  <span className="mr-1">{l.emoji}</span>
                  {t(`addr.label.${l.key}`)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Receiver */}
        <div className="space-y-3">
          <SectionLabel>{t("addr.receiverSection")}</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field
              label={t("addr.receiverName")}
              required
              placeholder={t("addr.namePlaceholder")}
              value={form.receiverName}
              onChange={set("receiverName")}
              error={errors.receiverName && t(errors.receiverName)}
            />
            <Field
              label={t("addr.receiverPhone")}
              required
              type="tel"
              placeholder={t("addr.phonePlaceholder")}
              value={form.receiverPhone}
              onChange={set("receiverPhone")}
              error={errors.receiverPhone && t(errors.receiverPhone)}
            />
          </div>
        </div>

        {/* GPS */}
        <div className="space-y-2">
          <SectionLabel>{t("addr.gpsSection")}</SectionLabel>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={useCurrentLocation}
              disabled={gpsBusy}
              type="button"
            >
              <LocateFixed size={18} />
              {gpsBusy ? t("addr.locating") : t("addr.useCurrent")}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setMapOpen(true)}
              type="button"
            >
              <MapIcon size={18} />
              {t("addr.pickMap")}
            </Button>
          </div>

          {hasGps ? (
            <div className="rounded-2xl bg-primary-light/60 border border-primary/20 p-3 flex items-start gap-2">
              <Check size={16} className="text-primary mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-black text-primary">
                  {t("addr.gpsAccuracy")}
                  {form.gpsAccuracy != null && (
                    <span className="ml-1.5 text-[10px] font-bold text-gray-400">
                      (±{form.gpsAccuracy} m)
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-500 font-medium truncate">
                  {gpsText || `${form.lat.toFixed(5)}, ${form.lng.toFixed(5)}`}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-gray-50 border border-dashed border-gray-200 p-3 flex items-center gap-2 text-gray-400">
              <MapPin size={16} />
              <p className="text-xs font-bold">{t("addr.noGps")}</p>
            </div>
          )}
          {errors._gps && <p className="text-xs font-bold text-secondary pl-1">{t(errors._gps)}</p>}
        </div>

        {/* Address detail */}
        <div className="space-y-3">
          <SectionLabel>{t("addr.addressSection")}</SectionLabel>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field label={t("addr.houseNo")} required placeholder="123/45" value={form.houseNo} onChange={set("houseNo")} error={errors.houseNo && t(errors.houseNo)} />
            <Field label={t("addr.village")} placeholder="—" value={form.village} onChange={set("village")} />
            <Field label={t("addr.building")} placeholder="—" value={form.building} onChange={set("building")} />
            <Field label={t("addr.floor")} placeholder="—" value={form.floor} onChange={set("floor")} />
            <Field label={t("addr.room")} placeholder="—" value={form.room} onChange={set("room")} />
            <Field label={t("addr.soi")} placeholder="—" value={form.soi} onChange={set("soi")} />
          </div>
          <Field label={t("addr.road")} placeholder="—" value={form.road} onChange={set("road")} />
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("addr.subdistrict")} required placeholder="ตำบล/แขวง" value={form.subdistrict} onChange={set("subdistrict")} error={errors.subdistrict && t(errors.subdistrict)} />
            <Field label={t("addr.district")} required placeholder="อำเภอ/เขต" value={form.district} onChange={set("district")} error={errors.district && t(errors.district)} />
            <Field label={t("addr.province")} required placeholder="จังหวัด" value={form.province} onChange={set("province")} error={errors.province && t(errors.province)} />
            <Field label={t("addr.postcode")} required placeholder="73000" inputMode="numeric" value={form.postcode} onChange={set("postcode")} error={errors.postcode && t(errors.postcode)} />
          </div>
        </div>

        {/* Extra */}
        <div className="space-y-3">
          <SectionLabel>{t("addr.extraSection")}</SectionLabel>
          <Field label={t("addr.landmark")} placeholder={t("addr.landmarkPlaceholder")} value={form.landmark} onChange={set("landmark")} />
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">{t("addr.deliveryNote")}</label>
            <textarea
              value={form.note}
              onChange={set("note")}
              rows={2}
              placeholder={t("addr.notePlaceholder")}
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 font-medium outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none"
            />
          </div>
          <Field label={t("addr.taxId")} placeholder={t("addr.taxIdPlaceholder")} value={form.taxId} onChange={set("taxId")} />
        </div>

        {/* Default toggle */}
        <button
          type="button"
          disabled={lockDefault}
          onClick={() => !lockDefault && setForm((p) => ({ ...p, isDefault: !p.isDefault }))}
          className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${
            form.isDefault ? "bg-primary-light border-primary/30" : "bg-gray-50 border-gray-100"
          } ${lockDefault ? "cursor-not-allowed opacity-90" : ""}`}
        >
          <span className="flex flex-col items-start">
            <span className="flex items-center gap-2 text-sm font-bold text-gray-700">
              <Star size={16} className={form.isDefault ? "text-primary fill-primary" : "text-gray-400"} />
              {t("addr.setDefaultLong")}
            </span>
            {lockDefault && (
              <span className="text-[11px] font-medium text-gray-400 pl-6">
                {t("addr.onlyDefaultHint")}
              </span>
            )}
          </span>
          <span className={`relative w-11 h-6 rounded-full transition-colors ${form.isDefault ? "bg-primary" : "bg-gray-300"}`}>
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.isDefault ? "translate-x-5" : "translate-x-0.5"}`} />
          </span>
        </button>

        {errorList.length > 0 && (
          <div className="rounded-2xl bg-secondary/5 border border-secondary/20 p-3">
            <p className="text-xs font-black text-secondary uppercase tracking-wider mb-1">{t("addr.pleaseFix")}</p>
            <ul className="list-disc list-inside space-y-0.5">
              {errorList.map((msg, i) => (
                <li key={i} className="text-xs font-medium text-secondary">{msg}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onCancel} type="button" disabled={submitting}>
          {t("addr.cancel")}
        </Button>
        <Button className="flex-1" onClick={handleSubmit} type="button" disabled={submitting}>
          {submitting ? t("addr.saving") : t("addr.save")}
        </Button>
      </div>

      <LocationPicker
        isOpen={mapOpen}
        storeLocation={STORE_LOCATION}
        initialPosition={hasGps ? { lat: form.lat, lng: form.lng } : null}
        onConfirm={handleConfirmMap}
        onClose={() => setMapOpen(false)}
      />
    </div>
  );
};
