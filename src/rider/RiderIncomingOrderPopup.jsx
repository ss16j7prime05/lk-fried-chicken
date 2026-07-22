import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Banknote, Bike, Clock, CreditCard, Eye, MapPin, Package, Store, User, X } from "lucide-react";
import { usePreferences } from "../context/PreferencesContext";
import { getAlarmAudioCtx, playSound, getEffectiveVolume } from "../store/alarmSounds";
import { getDestination } from "./riderLocationService";
import { haversineKm } from "../location/locationUtils";

// จังหวะเล่นเสียง/สั่นซ้ำระหว่างรอไรเดอร์ตัดสินใจ (เท่ากับ StoreLayout alarm loop)
const ALARM_INTERVAL_MS = 2000;
// เวลานับถอยหลัง fallback เมื่อไม่มี offerExpiresAt (งานแบบเดิม) — dispatch จะส่ง expiresAt มาแทน
const AUTO_DISMISS_SEC = 30;

// เสียงเรียกงานใหม่วนซ้ำจนกว่าจะกดรับ/ปฏิเสธ/หมดเวลา — ใช้เครื่องเสียงเดียวกับฝั่งร้าน
// (Web Audio, ไม่ต้องมีไฟล์เสียง) และปลุก AudioContext จาก user gesture เดิมที่ RiderLayout ทำไว้
function useIncomingAlarm(active) {
  const intervalRef = useRef(null);
  useEffect(() => {
    if (!active) return undefined;
    const tick = () => {
      try {
        const ctx = getAlarmAudioCtx();
        if (ctx.state === "suspended") { ctx.resume().catch(() => {}); return; }
        playSound("kitchen", ctx, getEffectiveVolume({ volume: 90 }));
      } catch { /* เสียงล้มเหลวต้องไม่ทำให้ popup พัง */ }
    };
    tick();
    intervalRef.current = setInterval(tick, ALARM_INTERVAL_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); intervalRef.current = null; };
  }, [active]);
}

// สั่นซ้ำระหว่างที่ป๊อปอัปแสดงอยู่ (บนอุปกรณ์ที่รองรับ Vibration API). แยกจากเสียง — สั่นทำงาน
// แม้ผู้ใช้ปิดเสียงไว้ (req 7/8: ต้องมีทั้งเสียงและการสั่น). หยุดสั่นเมื่อ unmount/รับ/ปฏิเสธ
function useIncomingVibration(active) {
  useEffect(() => {
    if (!active) return undefined;
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return undefined;
    const buzz = () => { try { navigator.vibrate([400, 150, 400]); } catch { /* ignore */ } };
    buzz();
    const id = setInterval(buzz, ALARM_INTERVAL_MS);
    return () => { clearInterval(id); try { navigator.vibrate(0); } catch { /* ignore */ } };
  }, [active]);
}

const Stat = ({ icon: Icon, label, value }) => (
  <div className="flex flex-col items-center gap-1 px-1 text-center">
    <Icon size={18} className="text-primary" />
    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wide leading-none">{label}</span>
    <span className="text-xs font-black text-gray-900 leading-tight break-words">{value}</span>
  </div>
);

// Full-screen incoming-order popup: shows store/customer/distance/earnings + countdown,
// loops a loud alarm until the rider accepts or rejects (or the countdown auto-dismisses,
// which just closes the popup — the job stays in the Available list). All data is real
// order data; no mock values.
// This component is keyed by order id in the parent, so it remounts per incoming order —
// the countdown state initialises fresh on mount (no setState-in-effect to reset it).
// Countdown seconds from a deadline (offerExpiresAt) — clamps at 0. Recomputed from the clock
// each tick so it stays correct after a background tab / refresh instead of drifting.
const secsUntil = (deadline) => Math.max(0, Math.ceil((deadline - Date.now()) / 1000));

export default function RiderIncomingOrderPopup({ order, storeLocation, busy, soundOn = true, autoAccept = false, expiresAt, onAccept, onReject, onViewDetails, onTimeout }) {
  const { t } = usePreferences();
  // Deadline is the dispatch offer's expiry (survives refresh); falls back to 30s for legacy jobs.
  // Fixed once per mount (lazy useState init) — the popup is keyed by order id + offerSeq so a
  // re-offer remounts fresh.
  const [deadline] = useState(() => expiresAt || Date.now() + AUTO_DISMISS_SEC * 1000);
  const [secondsLeft, setSecondsLeft] = useState(() => secsUntil(deadline));
  const timeoutRef = useRef(onTimeout);
  useEffect(() => { timeoutRef.current = onTimeout; }); // keep latest without re-arming the timer

  // Alarm loops while the popup is up, not busy, and Notification Sound is on. Vibration loops
  // independently of the sound setting (so a muted rider still feels the incoming job).
  useIncomingAlarm(Boolean(order) && !busy && soundOn);
  useIncomingVibration(Boolean(order) && !busy);

  // นับถอยหลังจาก deadline. หมดเวลา -> onTimeout (dispatch: คืนงานสู่ Pending แล้วยื่นต่อ; งานเดิม: ปิดป๊อปอัป)
  useEffect(() => {
    if (!order) return undefined;
    const id = setInterval(() => {
      const left = secsUntil(deadline);
      setSecondsLeft(left);
      if (left <= 0) { clearInterval(id); timeoutRef.current?.(order); }
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!order) return null;

  const dest = getDestination(order);
  const distanceKm =
    dest.lat != null && dest.lng != null && storeLocation
      ? haversineKm(storeLocation.lat, storeLocation.lng, dest.lat, dest.lng)
      : null;
  const earnings = Number(order.deliveryFee || 0);
  const method = order.paymentMethod || "cash";
  const isCod = method === "cash";
  const eta = Number(order.estimatedDeliveryMinutes || order.etaMinutes || 0);
  const pct = (secondsLeft / AUTO_DISMISS_SEC) * 100;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white shadow-2xl overflow-hidden animate-[popIn_0.2s_ease-out]">
        {/* header + countdown bar */}
        <div className="relative bg-primary px-5 pt-5 pb-4 text-white text-center">
          <div className="flex items-center justify-center gap-2">
            <Bike size={22} className="animate-bounce" />
            <p className="text-lg font-black">{t("ro.incoming.title")}</p>
          </div>
          <p className="text-xs font-bold text-white/80 mt-1">{order.orderNo || order.id?.slice(0, 8)}</p>
          <p className="text-[11px] font-bold text-white/70 mt-2">{t("ro.incoming.countdown", { sec: secondsLeft })}</p>
          {autoAccept && <p className="text-[10px] font-black text-white/90 mt-1">{t("ro.incoming.autoAccepting")}</p>}
          <div className="mt-1.5 h-1.5 w-full rounded-full bg-white/25 overflow-hidden">
            <div className="h-full bg-white rounded-full transition-all duration-1000 ease-linear" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* stats — distance / fee / payment / ETA */}
        <div className="grid grid-cols-4 px-3 py-5 border-b border-gray-50 divide-x divide-gray-100">
          <Stat icon={MapPin} label={t("ro.incoming.distance")} value={distanceKm != null ? `${distanceKm.toFixed(1)} km` : "—"} />
          <Stat icon={Package} label={t("ro.incoming.earnings")} value={`฿${earnings.toLocaleString("th-TH")}`} />
          <Stat icon={isCod ? Banknote : CreditCard} label={t("ro.incoming.payment")} value={t(`payment.${method}`)} />
          <Stat icon={Clock} label="ETA" value={eta > 0 ? `${eta}′` : "—"} />
        </div>

        {/* store + customer + COD hint */}
        <div className="px-5 py-4 space-y-2 text-sm">
          <p className="flex items-center gap-2 text-gray-700 font-medium">
            <Store size={15} className="text-gray-400 shrink-0" />
            <span className="min-w-0 truncate">{storeLocation?.name || "LK Fried Chicken"}</span>
          </p>
          <p className="flex items-start gap-2 text-gray-700 font-medium">
            <User size={15} className="text-gray-400 shrink-0 mt-0.5" />
            <span className="min-w-0">
              {order.customerName || "-"}
              {dest.address && <span className="block text-xs text-gray-400 mt-0.5">{dest.address}</span>}
            </span>
          </p>
          <p className={`flex items-center gap-1.5 text-xs font-bold ${isCod ? "text-secondary" : "text-primary"}`}>
            {isCod ? <Banknote size={13} className="shrink-0" /> : <CreditCard size={13} className="shrink-0" />}
            {isCod ? t("ro.incoming.collectCash", { amount: `฿${Number(order.grandTotal ?? order.subtotal ?? 0).toLocaleString("th-TH")}` }) : t("ro.incoming.prepaid")}
          </p>
        </div>

        {/* actions — View Details, then Reject / Accept */}
        <div className="px-5 pb-5 space-y-2.5">
          <button
            type="button"
            onClick={() => onViewDetails(order)}
            className="w-full flex items-center justify-center gap-1.5 py-3 rounded-2xl border border-gray-200 text-gray-700 font-black text-sm hover:border-primary hover:text-primary transition-colors"
          >
            <Eye size={17} /> {t("ro.incoming.viewDetails")}
          </button>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => onReject(order)}
              disabled={busy}
              className="flex-1 flex items-center justify-center gap-1.5 py-3.5 rounded-2xl border border-secondary/30 text-secondary font-black text-sm hover:border-secondary transition-colors disabled:opacity-50"
            >
              <X size={18} /> {t("ro.reject")}
            </button>
            <button
              type="button"
              onClick={() => onAccept(order)}
              disabled={busy}
              className="flex-[1.4] flex items-center justify-center gap-1.5 py-3.5 rounded-2xl bg-primary text-white font-black text-sm hover:bg-primary-dark transition-colors disabled:opacity-50"
            >
              <Package size={18} /> {busy ? t("ro.accepting") : t("ro.acceptDelivery")}
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes popIn{from{opacity:0;transform:scale(0.92)}to{opacity:1;transform:scale(1)}}`}</style>
    </div>,
    document.body
  );
}
