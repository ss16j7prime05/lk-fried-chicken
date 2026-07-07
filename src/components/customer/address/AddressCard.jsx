import { motion } from "framer-motion";
import { Phone, Pencil, Trash2, Star, Navigation, MapPin, AlertTriangle } from "lucide-react";
import { Card } from "../../ui/Card";
import { usePreferences } from "../../../context/PreferencesContext";
import { calcDeliveryFee } from "../../../location/locationUtils";
import { labelMeta, formatFullAddress, isOutOfZone, MAX_DELIVERY_RADIUS_KM } from "../../../constants/address";

// Single saved-address card: label + receiver, default/GPS badges, full address,
// distance from store, and Edit / Delete / Set Default actions.
export const AddressCard = ({ address, onEdit, onDelete, onSetDefault, busy = false }) => {
  const { t } = usePreferences();
  const meta = labelMeta(address.label);
  const hasGps = address.lat != null && address.lng != null;
  const outOfZone = isOutOfZone(address.distanceKm);
  const estFee = address.distanceKm != null ? calcDeliveryFee(Number(address.distanceKm)) : null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
      <Card className={`p-5 ${address.isDefault ? "ring-2 ring-primary/40" : ""}`}>
        {/* header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-2xl leading-none">{meta.emoji}</span>
            <div className="min-w-0">
              <p className="font-black text-gray-900 truncate">{t(`addr.label.${meta.key}`)}</p>
              <p className="text-sm font-bold text-gray-700 truncate">{address.receiverName}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {address.isDefault && (
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full bg-primary-light text-primary">
                <Star size={11} className="fill-primary" /> {t("addr.default")}
              </span>
            )}
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full ${
                hasGps ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-400"
              }`}
            >
              <Navigation size={11} /> {hasGps ? "GPS" : t("addr.noGpsBadge")}
            </span>
          </div>
        </div>

        {/* body */}
        <div className="mt-3 space-y-1.5">
          <p className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
            <Phone size={13} className="text-gray-400 shrink-0" />
            {address.receiverPhone || "—"}
          </p>
          <p className="text-sm text-gray-600 font-medium flex items-start gap-1.5">
            <MapPin size={14} className="text-gray-400 shrink-0 mt-0.5" />
            <span className="min-w-0">{formatFullAddress(address) || "—"}</span>
          </p>
          {address.landmark && (
            <p className="text-xs text-gray-400 font-medium pl-[22px]">{t("addr.landmark")}: {address.landmark}</p>
          )}
          {address.note && (
            <p className="text-xs text-gray-400 font-medium pl-[22px]">{t("addr.noteLabel")}: {address.note}</p>
          )}
        </div>

        {/* distance + estimated fee */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-gray-50 px-4 py-2.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{t("addr.distance")}</p>
            <p className="text-sm font-black text-gray-800">
              {address.distanceKm != null ? `${Number(address.distanceKm).toFixed(1)} km` : "—"}
            </p>
          </div>
          <div className="rounded-2xl bg-gray-50 px-4 py-2.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{t("addr.estFee")}</p>
            <p className="text-sm font-black text-gray-800">{estFee != null ? `฿${estFee}` : "—"}</p>
          </div>
        </div>

        {/* out-of-zone warning */}
        {outOfZone && (
          <div className="mt-2 flex items-center gap-2 rounded-2xl bg-secondary/5 border border-secondary/20 px-4 py-2.5">
            <AlertTriangle size={15} className="text-secondary shrink-0" />
            <p className="text-xs font-bold text-secondary">
              {t("addr.outOfZone", { km: MAX_DELIVERY_RADIUS_KM })}
            </p>
          </div>
        )}

        {/* actions */}
        <div className="mt-4 flex items-center gap-2">
          {!address.isDefault && (
            <button
              type="button"
              onClick={() => onSetDefault(address)}
              disabled={busy}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary-light text-primary text-sm font-black hover:brightness-95 transition disabled:opacity-50"
            >
              <Star size={15} /> {t("addr.setDefaultAction")}
            </button>
          )}
          <button
            type="button"
            onClick={() => onEdit(address)}
            disabled={busy}
            className={`${address.isDefault ? "flex-1" : ""} flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-gray-100 text-gray-700 text-sm font-black hover:bg-gray-200 transition disabled:opacity-50`}
          >
            <Pencil size={15} /> {t("common.edit")}
          </button>
          <button
            type="button"
            onClick={() => onDelete(address)}
            disabled={busy}
            aria-label={t("addr.deleteAria")}
            className="flex items-center justify-center py-2.5 px-4 rounded-xl bg-gray-100 text-gray-500 hover:bg-secondary/10 hover:text-secondary transition disabled:opacity-50"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </Card>
    </motion.div>
  );
};

// Skeleton placeholder shown while the address list loads.
export const AddressCardSkeleton = () => (
  <Card className="p-5 animate-pulse">
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 rounded-lg bg-gray-100" />
      <div className="space-y-1.5">
        <div className="h-3 w-16 bg-gray-100 rounded" />
        <div className="h-3 w-24 bg-gray-100 rounded" />
      </div>
    </div>
    <div className="mt-4 space-y-2">
      <div className="h-3 w-32 bg-gray-100 rounded" />
      <div className="h-3 w-full bg-gray-100 rounded" />
      <div className="h-3 w-2/3 bg-gray-100 rounded" />
    </div>
    <div className="h-10 w-full bg-gray-100 rounded-2xl mt-4" />
    <div className="h-10 w-full bg-gray-100 rounded-xl mt-4" />
  </Card>
);
