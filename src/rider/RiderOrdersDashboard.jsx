import { useEffect, useRef, useState } from "react";
import { collection, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { AlertCircle, Banknote, Bike, CheckCircle2, Coins, MapPin, Navigation, Package, Power, Store, WifiOff } from "lucide-react";
import { db } from "../firebase";
import { STORE_ID } from "../config";
import { useAuth } from "../AuthContext.jsx";
import { usePreferences } from "../context/PreferencesContext";
import RiderIncomingOrderPopup from "./RiderIncomingOrderPopup.jsx";
import RiderOrderDetailSheet from "./RiderOrderDetailSheet.jsx";
import RiderActiveOrder from "./RiderActiveOrder.jsx";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { RiderCardGridSkeleton } from "../components/ui/Skeleton";
import {
  DELIVERED_STATUS,
  DELIVERING_STATUS,
  PICKED_UP_STATUS,
  READY_QUERY_STATUSES,
  isReadyForDelivery,
} from "./riderStatus";
import { byNewest, normalizeStatus, toDate } from "../store/orderStatus";
import { useStoreStatus } from "../store/useStoreStatus";
import { acceptOrder, rejectOrder, hasRejected } from "./riderAcceptReject";
import { useDeliveryBroadcast, getDestination } from "./riderLocationService";
import { haversineKm } from "../location/locationUtils";
import { GEO_STATE, useGeolocationStatus } from "../location/mapsService";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { logError } from "../errorCenter";

// ค่าเริ่มต้น ใช้เมื่อยังไม่มี lat/lng ใน Firestore stores/{STORE_ID}
const FALLBACK_STORE_LAT = 13.8294079;
const FALLBACK_STORE_LNG = 100.0529543;

// Firestore Timestamp | ISO | ms -> ms (0 ถ้าไม่มี)
const orderMs = (ts) => (ts?.toMillis ? ts.toMillis() : ts ? new Date(ts).getTime() : 0);

const money = (n) => `฿${Number(n || 0).toLocaleString("th-TH", { maximumFractionDigits: 0 })}`;
const isSameDay = (d, ref) =>
  !!d && d.getDate() === ref.getDate() && d.getMonth() === ref.getMonth() && d.getFullYear() === ref.getFullYear();

// ตัวเลือกจำนวนเงินสดที่ไรเดอร์มี (กรองงานเก็บเงินปลายทางที่เกินวงเงิน) — null = ทั้งหมด
const CASH_OPTIONS = [500, 1000, Infinity];
// งานผ่านตัวกรองเงินสดไหม: งานจ่ายออนไลน์ผ่านเสมอ (ไม่ต้องใช้เงินสด) ; COD ต้อง <= วงเงินที่เลือก
const passesCash = (order, cashLimit) => {
  if (cashLimit == null) return true;
  if ((order.paymentMethod || "cash") !== "cash") return true;
  return Number(order.grandTotal ?? order.subtotal ?? 0) <= cashLimit;
};

// ยิง browser notification เมื่อมีงานใหม่ (เฉพาะเมื่อได้รับอนุญาตแล้ว) — ไม่ขอสิทธิ์เอง
// (ให้ไปกดอนุญาตในหน้า Device Check). ปลอดภัยถ้า Notification API ไม่มี
const sendJobNotification = (order, title, body) => {
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const n = new Notification(title, { body, tag: `lk-rider-job-${order.id}`, requireInteraction: true });
    n.onclick = () => window.focus();
  } catch { /* ignore */ }
};

// เหตุผลที่รับ/ปฏิเสธงานไม่สำเร็จ (reason จาก riderAcceptReject) -> คีย์แปลภาษา ro.err.*
// ที่สำคัญที่สุดคือ already_taken: ไรเดอร์ต้องรู้ว่าโดนตัดหน้า ไม่ใช่กดแล้วเงียบ
const KNOWN_ACTION_ERRORS = new Set([
  "already_taken", "not_ready", "offered_to_other", "not_found",
  "invalid", "invalid_transition", "terminal", "error",
]);
const actionMessageKey = (reason) => `ro.err.${KNOWN_ACTION_ERRORS.has(reason) ? reason : "error"}`;

// ปัญหาตำแหน่ง/เน็ต ที่ทำให้ "นำทาง + ให้ลูกค้าติดตาม" ใช้ไม่ได้ — descriptor (key + retry)
// ข้อความจริงแปลผ่าน ro.loc.<key>.title / .desc (ไม่มีอันไหน block การส่งอาหาร จึงเป็นคำเตือน)
const LOCATION_ALERT = {
  offline: { key: "offline" },
  [GEO_STATE.DENIED]: { key: "denied", retry: true },
  [GEO_STATE.UNAVAILABLE]: { key: "unavailable", retry: true },
  [GEO_STATE.TIMEOUT]: { key: "timeout", retry: true },
  [GEO_STATE.UNSUPPORTED]: { key: "unsupported" },
};

// เลือกคำเตือนที่ "จริงที่สุด" อันเดียว: ออฟไลน์มาก่อน -> ข้อผิดพลาดจริงจากการอ่าน GPS ->
// สิทธิ์ที่ Permissions API บอก (ท้ายสุดเพราะ iOS ไม่มี API นี้ ค่าจะเป็น unknown)
const pickLocationAlert = (online, geoError, permission) => {
  if (!online) return LOCATION_ALERT.offline;
  if (geoError) return LOCATION_ALERT[geoError] || null;
  if (permission === GEO_STATE.DENIED) return LOCATION_ALERT[GEO_STATE.DENIED];
  if (permission === GEO_STATE.UNSUPPORTED) return LOCATION_ALERT[GEO_STATE.UNSUPPORTED];
  return null;
};

// Available-job card (idle browse list) — LINE MAN-style information layout in LK's design
// language. Tapping the body opens the pre-accept detail sheet; "รับงานนี้" accepts directly.
// All figures are real order data (earnings = deliveryFee ; COD = collect grandTotal).
const AvailableJobCard = ({ order, storeLocation, busy, disabled, onView, onAccept, t }) => {
  const dest = getDestination(order);
  const distanceKm =
    dest.lat != null && dest.lng != null
      ? haversineKm(storeLocation.lat, storeLocation.lng, dest.lat, dest.lng)
      : (order.distanceKm ?? order.distance ?? null);
  const isCod = (order.paymentMethod || "cash") === "cash";
  const codAmount = Number(order.grandTotal ?? order.subtotal ?? 0);
  return (
    <Card className="p-0 overflow-hidden flex flex-col">
      <button type="button" onClick={() => onView(order)} className="text-left p-4 focus-visible:outline-none">
        <div className="flex items-start justify-between gap-2 mb-3">
          <span className="inline-flex items-center gap-1 text-[11px] font-black text-primary bg-primary-light px-2.5 py-1 rounded-full">
            <Bike size={13} /> {t("ro.card.foodDelivery")}
          </span>
          {distanceKm != null && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-400">
              <Navigation size={12} /> {distanceKm.toFixed(1)} km
            </span>
          )}
        </div>

        {/* pickup (store) -> dropoff (customer) */}
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <Store size={15} className="text-primary shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-black text-gray-900 truncate">{storeLocation?.name || "LK Fried Chicken"}</p>
              {order.storeAddress && <p className="text-xs text-gray-400 font-medium truncate">{order.storeAddress}</p>}
            </div>
          </div>
          <div className="flex items-start gap-2">
            <MapPin size={15} className="text-secondary shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-bold text-gray-700 truncate">{order.customerName || "-"}</p>
              {dest.address && <p className="text-xs text-gray-400 font-medium truncate">{dest.address}</p>}
            </div>
          </div>
        </div>
      </button>

      {/* payment + earnings + accept */}
      <div className="px-4 pb-4 pt-1 space-y-3">
        <div className="flex items-center justify-between gap-2 rounded-2xl bg-gray-50 px-3 py-2.5">
          <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${isCod ? "text-secondary" : "text-primary"}`}>
            {isCod ? <Banknote size={14} /> : <CheckCircle2 size={14} />}
            {isCod ? t("ro.card.collect", { amount: money(codAmount) }) : t("ro.card.noCollect")}
          </span>
          <span className="text-right">
            <span className="block text-[10px] font-bold text-gray-400 uppercase leading-none">{t("ro.card.earnings")}</span>
            <span className="block text-lg font-black text-primary leading-tight">{money(order.deliveryFee)}</span>
          </span>
        </div>
        <Button className="w-full !py-2.5" loading={busy} disabled={disabled} onClick={() => onAccept(order)}>
          <Package size={16} /> {t("ro.card.acceptThis")}
        </Button>
      </div>
    </Card>
  );
};

// Rider stats bar (income today / credit / coins today) + online toggle. Income & coins are
// derived from the rider's own completed orders (real data) ; credit reads a real profile
// field, default 0 — no mock values.
const RiderStatsBar = ({ income, credit, coins, isOnline, onToggle, t }) => (
  <Card className="p-4">
    <div className="flex items-stretch gap-3">
      <div className="grid grid-cols-3 flex-1 divide-x divide-gray-100">
        <div className="flex flex-col items-center justify-center gap-0.5 px-1">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{t("ro.stats.income")}</span>
          <span className="text-base font-black text-primary leading-tight">{money(income)}</span>
        </div>
        <div className="flex flex-col items-center justify-center gap-0.5 px-1">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{t("ro.stats.credit")}</span>
          <span className="text-base font-black text-blue-600 leading-tight">{money(credit)}</span>
        </div>
        <div className="flex flex-col items-center justify-center gap-0.5 px-1">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{t("ro.stats.coins")}</span>
          <span className="flex items-center gap-1 text-base font-black text-amber-500 leading-tight"><Coins size={15} /> {coins}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={isOnline}
        className={`shrink-0 flex flex-col items-center justify-center gap-0.5 w-20 rounded-2xl font-black text-xs transition-colors ${
          isOnline ? "bg-primary text-white hover:bg-primary-dark" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
        }`}
      >
        <Power size={20} />
        {isOnline ? t("ro.online") : t("ro.offline")}
      </button>
    </div>
  </Card>
);

// Rider Dashboard v2 (single active order): incoming popup + pre-accept detail sheet when
// idle; a locked single-job workflow (RiderActiveOrder) once a job is accepted.
export default function RiderOrdersDashboard() {
  const { user, profile } = useAuth();
  const { t } = usePreferences();
  // Same live store status the Store portal writes / Customer reads — new orders can't
  // be created while closed, so no new jobs arrive; this just tells the rider why.
  const { status: storeStatus } = useStoreStatus("store");
  const storeClosed = storeStatus === "closed";
  const [availablePool, setAvailablePool] = useState([]);
  const [myJobs, setMyJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  // ข้อผิดพลาดจากการกดปุ่ม (รับ/ปฏิเสธ/สลับสถานะ) กับจากตัว feed เอง แยกกันคนละก้อน
  const [actionError, setActionError] = useState("");
  // แยกราย feed: feed หนึ่งหายดีต้องไม่ไปล้าง error ของอีก feed ที่ยังพังอยู่
  const [feedErrors, setFeedErrors] = useState({ available: "", mine: "" });
  // ออเดอร์ที่กำลังยิง action อยู่ — กันกดซ้ำ/กดหลายใบพร้อมกัน
  const [busyId, setBusyId] = useState("");
  // ความพร้อมรับงาน อ่านแบบ realtime จาก users/{uid}.riderStatus (ฟิลด์เดียวกับ RiderSettings/Admin)
  const [riderStatus, setRiderStatus] = useState(profile?.riderStatus || "offline");
  // ตั้งค่าแอปฝั่งไรเดอร์ อ่าน realtime จาก users/{uid} — สลับใน "ตั้งค่าแอป" แล้วมีผลทันทีไม่ต้องรีเฟรช
  const [settings, setSettings] = useState({
    notifyNewJob: profile?.notifyNewJob ?? profile?.notifyOrderUpdates ?? true,
    soundOn: profile?.notifSoundEnabled ?? true,
    autoAccept: profile?.autoAccept ?? false,
  });
  const [storeLocation, setStoreLocation] = useState({
    lat: FALLBACK_STORE_LAT,
    lng: FALLBACK_STORE_LNG,
    name: "LK Fried Chicken",
  });
  // คิวงานใหม่ที่เพิ่งเข้ามา -> ป๊อปอัปเต็มจอ + เสียงเรียก (ไล่ทีละใบตามลำดับที่เข้า)
  const [incomingIds, setIncomingIds] = useState([]);
  const [detailOrder, setDetailOrder] = useState(null); // ออเดอร์ที่เปิดดูรายละเอียดก่อนรับ (View Details)
  const [cashFilter, setCashFilter] = useState(null);   // วงเงินสดที่ไรเดอร์มี (กรอง COD) — null = ทั้งหมด
  const [doneIds, setDoneIds] = useState(() => new Set()); // งาน completed ที่กด Done แล้ว -> เลิกโชว์สรุป
  const [mountTime] = useState(() => Date.now()); // เวลาเปิดหน้า — ใช้แยก "งานเพิ่งจบ" ออกจากงานเก่าใน history
  const seenOrderIdsRef = useRef(new Set()); // เคยเห็นแล้ว ไม่ต้องเด้งซ้ำ (เหมือน StoreLayout)
  const notifiedIdsRef = useRef(new Set());  // งานที่ยิง browser notification ไปแล้ว (กันซ้ำ)
  const autoAcceptedRef = useRef(new Set());  // งานที่ auto-accept ไปแล้ว (กันรับซ้ำระหว่างรอ async)
  const availInitRef = useRef(false);        // snapshot แรก = งานเดิม ไม่ต้องเด้ง
  const isOnlineRef = useRef(false);         // สถานะล่าสุดสำหรับใช้ใน callback ของ snapshot
  const settingsRef = useRef(settings);      // ค่าล่าสุดสำหรับใช้ใน callback ของ snapshot
  const baseTitleRef = useRef(typeof document !== "undefined" ? document.title : ""); // ชื่อแท็บเดิม (ไว้ทำ badge)

  useEffect(() => {
    if (!user?.uid) return;
    // แทนการ subscribe ทั้ง collection: ดึงเฉพาะพูลงานว่าง (status พร้อมส่ง) + งานของไรเดอร์คนนี้
    const availableQ = query(collection(db, "orders"), where("status", "in", READY_QUERY_STATUSES));
    const mineQ = query(collection(db, "orders"), where("riderId", "==", user.uid));
    const markFeed = (key, msg) =>
      setFeedErrors((prev) => (prev[key] === msg ? prev : { ...prev, [key]: msg }));
    // ถ้า feed พัง (สิทธิ์/เน็ต) ต้องเลิกหมุนแล้วบอกเหตุผล ไม่ใช่ค้างที่ Loading ตลอดกาล
    const onFeedError = (err, key) => {
      logError(err, `RiderOrdersDashboard.${key}`);
      markFeed(key, key); // key = "available" | "mine" -> แปลผ่าน ro.feedErr.<key> ตอน render
      setLoading(false);
    };
    const unsubAvailable = onSnapshot(
      availableQ,
      (snapshot) => {
        setAvailablePool(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        markFeed("available", "");
        setLoading(false);

        // snapshot แรก: จำงานที่มีอยู่แล้วไว้ ไม่เด้งป๊อปอัปให้งานเก่า
        if (!availInitRef.current) {
          snapshot.docs.forEach((d) => seenOrderIdsRef.current.add(d.id));
          availInitRef.current = true;
          return;
        }
        // งานใหม่จริง ๆ ที่เพิ่งพร้อมส่ง -> เข้าคิวป๊อปอัป (เฉพาะตอนไรเดอร์เปิดรับงาน
        // และงานยังว่าง + เราไม่ได้ปฏิเสธไปแล้ว). งานที่ถูกรับ/หลุดพูล -> เอาออกจากคิว (หยุดเสียง)
        snapshot.docChanges().forEach((change) => {
          const order = { id: change.doc.id, ...change.doc.data() };
          if (change.type === "removed" || order.riderId || !isReadyForDelivery(order.status)) {
            setIncomingIds((prev) => (prev.includes(order.id) ? prev.filter((qid) => qid !== order.id) : prev));
            return;
          }
          if (change.type !== "added") return;
          if (seenOrderIdsRef.current.has(order.id)) return;
          seenOrderIdsRef.current.add(order.id);
          if (!isOnlineRef.current || hasRejected(order, user.uid)) return;
          setIncomingIds((prev) => (prev.includes(order.id) ? prev : [...prev, order.id]));
          // New Job Notification เปิด -> ยิง browser notification (ครั้งเดียวต่อออเดอร์). ปิด = ไม่ยิง
          if (settingsRef.current.notifyNewJob && !notifiedIdsRef.current.has(order.id)) {
            notifiedIdsRef.current.add(order.id);
            sendJobNotification(order, t("ro.notif.newJobTitle"), t("ro.notif.newJobBody", { name: order.customerName || "-" }));
          }
        });
      },
      (err) => onFeedError(err, "available")
    );
    const unsubMine = onSnapshot(
      mineQ,
      (snapshot) => {
        // อ่านด้วย serverTimestamps:"estimate" เพื่อให้ deliveredAt (serverTimestamp) มีค่าประมาณ
        // ทันทีตอนกดส่งสำเร็จ (ไม่เป็น null ระหว่างรอ server) — ไม่งั้นหน้าสรุปจะกระพริบหลุดไปหน้ารอรับงาน
        setMyJobs(snapshot.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) })));
        markFeed("mine", "");
        setLoading(false);
      },
      (err) => onFeedError(err, "mine")
    );
    const unsubStore = onSnapshot(
      doc(db, "stores", STORE_ID),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setStoreLocation({
            lat: data.lat ?? FALLBACK_STORE_LAT,
            lng: data.lng ?? FALLBACK_STORE_LNG,
            name: data.storeName || "LK Fried Chicken",
          });
        }
      },
      // ตำแหน่งร้านมี fallback อยู่แล้ว — ล้มเหลวได้โดยไม่ต้องกวนไรเดอร์
      (err) => logError(err, "RiderOrdersDashboard.store")
    );
    return () => {
      unsubAvailable();
      unsubMine();
      unsubStore();
    };
    // t ใช้แค่ทำข้อความ notification — ไม่ผูกเป็น dep เพื่อไม่ให้ re-subscribe listener ทุกครั้งที่สลับภาษา
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  // สถานะออนไลน์/ออฟไลน์ + ตั้งค่าแอป อ่าน realtime จาก users/{uid} (เอกสารเดียวที่ "ตั้งค่าแอป" เขียน)
  // -> สลับ toggle ในหน้าตั้งค่าแล้วมีผลกับ runtime ทันที ไม่ต้องรีเฟรช
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      setRiderStatus(d.riderStatus || "offline");
      setSettings({
        notifyNewJob: d.notifyNewJob ?? d.notifyOrderUpdates ?? true,
        soundOn: d.notifSoundEnabled ?? true,
        autoAccept: d.autoAccept ?? false,
      });
    });
    return () => unsub();
  }, [user?.uid]);

  const isOnline = riderStatus === "online";
  useEffect(() => { isOnlineRef.current = isOnline; }, [isOnline]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  const feedErrorKey = feedErrors.available || feedErrors.mine;
  // networkOnline = มีเน็ตไหม (คนละเรื่องกับ isOnline ที่แปลว่า "ไรเดอร์เปิดรับงาน")
  const networkOnline = useOnlineStatus();
  const geoPermission = useGeolocationStatus();

  // งานว่าง (riderId=="") กับงานของไรเดอร์ (riderId==uid) เป็นเซตที่ไม่ทับกัน รวมได้ตรง ๆ
  const orders = availablePool.concat(myJobs);

  // งานที่ไรเดอร์คนนี้กดปฏิเสธไปแล้ว ไม่ต้องโผล่ในพูลของเขาอีก (ของคนอื่นยังเห็นปกติ)
  const availableOrders = orders
    .filter((o) => !o.riderId && isReadyForDelivery(o.status) && !hasRejected(o, user?.uid))
    .sort(byNewest());
  // กรองด้วยวงเงินสดที่ไรเดอร์เลือก (งานเก็บเงินปลายทางที่เกินวงเงินจะไม่ขึ้น)
  const visibleAvailable = availableOrders.filter((o) => passesCash(o, cashFilter));

  // สถิติหัวจอ: รายได้/เหรียญ "วันนี้" คิดจากงานของไรเดอร์ที่ส่งสำเร็จวันนี้ (ข้อมูลจริง) ;
  // เครดิตอ่านจากโปรไฟล์จริง (default 0 ไม่มี mock). ใช้ mountTime เป็นวันอ้างอิง (คงที่ทั้งเซสชัน)
  const dayRef = new Date(mountTime);
  const doneToday = orders.filter(
    (o) => o.riderId === user?.uid && normalizeStatus(o.status) === DELIVERED_STATUS &&
      isSameDay(toDate(o.deliveredAt ?? o.completedAt ?? o.createdAt), dayRef)
  );
  const todayIncome = doneToday.reduce((s, o) => s + Number(o.deliveryFee || 0) + Number(o.riderBonus || 0), 0);
  const todayCoins = doneToday.reduce((s, o) => s + Number(o.riderCoins || 0), 0);
  const credit = Number(profile?.riderCredit ?? profile?.credit ?? 0);

  // ป๊อปอัปงานใหม่: แสดงงานแรกในคิวที่ยัง "ว่างจริง" (ถ้าไรเดอร์คนอื่นรับไปก่อน หรือหมดสถานะพร้อมส่ง
  // ก็ข้ามไปใบถัดไป). ปิดรับงาน = ไม่เด้ง (เผื่อสลับ offline ระหว่างที่ยังมีคิวค้าง). การตัดคิวที่
  // "ไม่ว่างแล้ว" ทำตอน snapshot (docChanges removed/modified) จึงไม่ต้อง setState ใน effect
  const firstIncomingId = incomingIds.find((qid) => availableOrders.some((o) => o.id === qid));
  const incomingOrder =
    isOnline && firstIncomingId ? availableOrders.find((o) => o.id === firstIncomingId) : null;

  const dismissIncoming = (id) => setIncomingIds((prev) => prev.filter((qid) => qid !== id));

  // ── งานเดียวต่อครั้ง (single active order) ──────────────────────────────────
  // งานที่ "กำลังทำ" = ออเดอร์ของเราที่ยัง picked_up/delivering (ใหม่สุดก่อน — ปกติมีใบเดียว)
  const mine = orders.filter((o) => o.riderId === user?.uid);
  const inProgress = mine
    .filter((o) => o.status === PICKED_UP_STATUS || o.status === DELIVERING_STATUS)
    .sort(byNewest());

  // งานที่เพิ่งส่งสำเร็จ "หลังเปิดหน้านี้" (deliveredAt > mountTime) และยังไม่กด Done -> คงหน้าสรุปไว้
  // ออเดอร์ completed เก่าที่โหลดมาตอนเปิดแอป (deliveredAt เก่ากว่า mountTime) จะไม่เด้งสรุปย้อนหลัง
  const justCompleted = mine.find(
    (o) => normalizeStatus(o.status) === DELIVERED_STATUS && !doneIds.has(o.id) && orderMs(o.deliveredAt ?? o.completedAt) >= mountTime
  );
  // ออเดอร์ที่กำลังโฟกัส (ล็อกทั้งหน้าจอ). hasActive = ยังส่งไม่จบ -> ห้ามรับงานใหม่
  const activeOrder = inProgress[0] || justCompleted || null;
  const hasActive = Boolean(inProgress[0]);

  // งานเข้าใหม่ที่ "รับได้จริง": ไม่มีงานกำลังทำ + ผ่านตัวกรองเงินสด (ใช้ทั้งป๊อปอัป/auto-accept/badge)
  const showIncoming = !activeOrder;
  const eligibleIncoming =
    showIncoming && incomingOrder && passesCash(incomingOrder, cashFilter) ? incomingOrder : null;
  // ป๊อปอัปแสดงเมื่อ: เปิด "แจ้งเตือนงานใหม่" + ไม่ได้เปิด auto-accept (auto-accept รับเองไม่ต้องเด้ง)
  // + ไม่ได้เปิดดูรายละเอียดอยู่. ปิดแจ้งเตือน = ไม่มีป๊อปอัป/ไม่มีเสียง
  const popupOrder =
    eligibleIncoming && !detailOrder && settings.notifyNewJob && !settings.autoAccept ? eligibleIncoming : null;

  // งานที่กำลังส่งอยู่จริง = สิ่งที่ต้องกระจายตำแหน่งให้ลูกค้าติดตาม (งานเดียว)
  const deliveries =
    activeOrder && activeOrder.status === DELIVERING_STATUS
      ? [{ id: activeOrder.id, ...getDestination(activeOrder) }].filter((d) => d.lat != null && d.lng != null)
      : [];
  // ออฟไลน์ = เขียนไม่ถึง Firestore อยู่แล้ว หยุดอ่าน GPS ไปเลย (ประหยัดแบต)
  const { geoError } = useDeliveryBroadcast(deliveries, isOnline && networkOnline);
  const locationAlert = pickLocationAlert(networkOnline, geoError, geoPermission.state);

  // สลับความพร้อมรับงาน — เขียน users/{uid}.riderStatus (ฟิลด์เดิม ไม่เพิ่ม schema)
  const toggleAvailability = async () => {
    if (!user) return;
    try {
      await updateDoc(doc(db, "users", user.uid), { riderStatus: isOnline ? "offline" : "online" });
      setActionError("");
    } catch (e) {
      logError(e, "RiderOrdersDashboard.toggleAvailability");
      setActionError(t("ro.availabilityErr"));
    }
  };

  // ตัวตนของไรเดอร์ที่เขียนลงออเดอร์ — รูปแบบเดียวกับที่ assignRider เคยใช้
  const riderIdentity = () => ({
    uid: user.uid,
    name: profile?.name || profile?.riderName || user.email || "ไรเดอร์",
    phone: profile?.phone || "",
  });

  // รับงาน: ผ่าน acceptOrder (transaction) — กันสองไรเดอร์กดพร้อมกัน. ล็อกให้มีงานเดียวต่อครั้ง
  const acceptDelivery = async (order) => {
    if (!user || !isOnline || busyId) return;
    if (hasActive) { setActionError(t("ro.oneActiveOnly")); return; }
    setBusyId(order.id);
    setActionError("");
    const { ok, reason } = await acceptOrder(order, riderIdentity());
    if (!ok) setActionError(t(actionMessageKey(reason)));
    // สำเร็จ -> งานกลายเป็น activeOrder แล้วหน้าจะสลับไปโหมดทำงานอัตโนมัติ (Firestore SSOT)
    dismissIncoming(order.id);
    setDetailOrder(null);
    setBusyId("");
  };

  // ปฏิเสธงาน: ซ่อนจากพูลของไรเดอร์คนนี้ (rejectedBy). ออเดอร์ยังว่างสำหรับคนอื่น
  const rejectDelivery = async (order) => {
    if (!user || busyId) return;
    setBusyId(order.id);
    setActionError("");
    const { ok, reason } = await rejectOrder(order, riderIdentity());
    if (!ok) setActionError(t(actionMessageKey(reason)));
    dismissIncoming(order.id);
    setDetailOrder(null);
    setBusyId("");
  };

  // กด Done บนหน้าสรุป -> เลิกล็อกหน้าจอ กลับสู่โหมดรับงาน
  const markDone = (order) => setDoneIds((prev) => new Set(prev).add(order.id));

  // Auto Accept: เปิดแล้วรับงานที่ "รับได้จริง" อัตโนมัติ (ผ่าน acceptDelivery = ตรวจ validation
  // เดิมครบทุกอย่าง ไม่ข้ามการกันรับซ้ำ/งานเดียว) โดยไม่ต้องกดยืนยัน. กันรับซ้ำด้วย autoAcceptedRef
  useEffect(() => {
    if (!settings.autoAccept || !isOnline || hasActive || busyId || detailOrder) return;
    if (!eligibleIncoming || autoAcceptedRef.current.has(eligibleIncoming.id)) return;
    autoAcceptedRef.current.add(eligibleIncoming.id);
    acceptDelivery(eligibleIncoming);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.autoAccept, isOnline, hasActive, busyId, detailOrder, eligibleIncoming?.id]);

  // Badge: จำนวนงานว่างที่รับได้ ขึ้นที่ชื่อแท็บเบราว์เซอร์ เมื่อเปิด "แจ้งเตือนงานใหม่" และยังว่าง
  const badgeCount = settings.notifyNewJob && isOnline && !activeOrder ? visibleAvailable.length : 0;
  useEffect(() => {
    const base = baseTitleRef.current || "LK Rider";
    document.title = badgeCount > 0 ? `(${badgeCount}) ${base}` : base;
    return () => { document.title = base; };
  }, [badgeCount]);

  // Render helpers (plain functions, not nested components) for the two shared banners.
  const renderAlert = () =>
    actionError ? (
      <div role="alert" className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 border border-red-100 text-red-600">
        <AlertCircle size={20} className="shrink-0 mt-0.5" />
        <p className="text-sm font-bold min-w-0 flex-1">{actionError}</p>
        <button onClick={() => setActionError("")} className="text-xs font-black text-red-400 hover:text-red-600 shrink-0">{t("ro.dismiss")}</button>
      </div>
    ) : null;

  const renderLocationAlert = () =>
    locationAlert ? (
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-100 text-amber-700">
        {networkOnline ? <Navigation size={20} className="shrink-0 mt-0.5" /> : <WifiOff size={20} className="shrink-0 mt-0.5" />}
        <div className="min-w-0 flex-1">
          <p className="font-black text-sm">{t(`ro.loc.${locationAlert.key}.title`)}</p>
          <p className="text-xs font-medium text-amber-600 mt-0.5">{t(`ro.loc.${locationAlert.key}.desc`)}</p>
        </div>
        {locationAlert.retry && (
          <button onClick={geoPermission.request} className="text-xs font-black text-amber-700 underline shrink-0 mt-0.5">{t("ro.retry")}</button>
        )}
      </div>
    ) : null;

  // ── โหมดทำงาน: มีงานเดียวที่กำลังทำ -> โชว์ workflow อย่างเดียว (ซ่อนงานเข้าใหม่ทั้งหมด) ──
  if (activeOrder) {
    return (
      <div className="space-y-4">
        {renderAlert()}
        {renderLocationAlert()}
        <RiderActiveOrder order={activeOrder} storeLocation={storeLocation} onDone={() => markDone(activeOrder)} />
      </div>
    );
  }

  // ── โหมดว่าง: ป๊อปอัปงานใหม่ + รายละเอียดก่อนรับ + รายการงานว่าง ──
  return (
    <div className="space-y-6">
      {/* งานใหม่เข้า -> ป๊อปอัปเต็มจอ + เสียงเรียกวนซ้ำจนกดรับ/ปฏิเสธ/หมดเวลา (ซ่อนตอนดูรายละเอียด) */}
      <RiderIncomingOrderPopup
        key={popupOrder?.id || "none"}
        order={popupOrder}
        storeLocation={storeLocation}
        busy={Boolean(busyId)}
        soundOn={settings.soundOn}
        onAccept={acceptDelivery}
        onReject={rejectDelivery}
        onViewDetails={setDetailOrder}
        onDismiss={() => popupOrder && dismissIncoming(popupOrder.id)}
      />

      {/* ดูรายละเอียดก่อนรับ (เต็มจอ) — Back กลับไปหน้าป๊อปอัป */}
      {detailOrder && (
        <RiderOrderDetailSheet
          order={detailOrder}
          storeLocation={storeLocation}
          busy={Boolean(busyId)}
          onAccept={acceptDelivery}
          onBack={() => setDetailOrder(null)}
        />
      )}

      {/* Stats bar: income / credit / coins + online toggle */}
      <RiderStatsBar income={todayIncome} credit={credit} coins={todayCoins} isOnline={isOnline} onToggle={toggleAvailability} t={t} />

      {/* Cash-on-hand filter — pick how much cash you have; matching jobs appear */}
      {isOnline && (
        <div>
          <p className="text-xs font-bold text-gray-500 mb-2">{t("ro.cash.label")}</p>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            <button
              type="button"
              onClick={() => setCashFilter(null)}
              className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap border transition-all ${
                cashFilter == null ? "bg-primary text-white border-primary" : "bg-white text-gray-500 border-gray-100 hover:border-primary"
              }`}
            >
              {t("ro.cash.all")}
            </button>
            {CASH_OPTIONS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCashFilter(c)}
                className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap border transition-all ${
                  cashFilter === c ? "bg-primary text-white border-primary" : "bg-white text-gray-500 border-gray-100 hover:border-primary"
                }`}
              >
                {c === Infinity ? t("ro.cash.over", { amount: money(1000) }) : money(c)}
              </button>
            ))}
          </div>
        </div>
      )}

      {renderLocationAlert()}

      {/* feed พัง = ไม่มีข้อมูลให้เชื่อถือ ต้องบอกตรง ๆ แทนที่จะโชว์ "ไม่มีงาน" ทั้งที่อาจมี */}
      {feedErrorKey && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 border border-red-100 text-red-600">
          <WifiOff size={20} className="shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="font-black text-sm">{t("ro.feedErrTitle")}</p>
            <p className="text-xs font-medium text-red-500 mt-0.5">{t(`ro.feedErr.${feedErrorKey}`)}</p>
          </div>
        </div>
      )}

      {renderAlert()}

      {isOnline && storeClosed && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 border border-red-100 text-red-600">
          <Power size={20} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-black text-sm">{t("ro.storeClosedTitle")}</p>
            <p className="text-xs font-medium text-red-500 mt-0.5">{t("ro.storeClosedDesc")}</p>
          </div>
        </div>
      )}

      {loading ? (
        <RiderCardGridSkeleton />
      ) : !isOnline ? (
        <div className="space-y-4">
          <EmptyState icon="🌙" title={t("ro.offlineTitle")} description={t("ro.offlineDesc")} />
          <div className="flex justify-center">
            <Button className="!px-6" onClick={toggleAvailability}>
              <Power size={16} />
              {t("ro.goOnline")}
            </Button>
          </div>
        </div>
      ) : visibleAvailable.length === 0 ? (
        <EmptyState
          icon="🛵"
          title={t("ro.waiting.title")}
          description={availableOrders.length > 0 ? t("ro.cash.noneMatch") : t("ro.waiting.desc")}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleAvailable.map((order) => (
            <AvailableJobCard
              key={order.id}
              order={order}
              storeLocation={storeLocation}
              busy={busyId === order.id}
              disabled={Boolean(busyId) && busyId !== order.id}
              onView={setDetailOrder}
              onAccept={acceptDelivery}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  );
}
