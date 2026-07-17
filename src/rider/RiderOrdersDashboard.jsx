import { useEffect, useRef, useState } from "react";
import { collection, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { AlertCircle, Banknote, ChevronRight, CreditCard, MapPin, Navigation, Package, Power, User, WifiOff } from "lucide-react";
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
import { byNewest, normalizeStatus } from "../store/orderStatus";
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

// Compact available-job card (idle browse list). Tapping opens the pre-accept detail
// sheet; the Accept button claims it directly. All figures are real order data.
const AvailableJobCard = ({ order, storeLocation, busy, disabled, onView, onAccept, t }) => {
  const dest = getDestination(order);
  const distanceKm =
    dest.lat != null && dest.lng != null
      ? haversineKm(storeLocation.lat, storeLocation.lng, dest.lat, dest.lng)
      : (order.distanceKm ?? order.distance ?? null);
  const method = order.paymentMethod || "cash";
  const isCod = method === "cash";
  return (
    <Card className="p-4 flex flex-col gap-3">
      <button type="button" onClick={() => onView(order)} className="text-left space-y-2 focus-visible:outline-none">
        <div className="flex items-center justify-between gap-2">
          <span className="font-black text-gray-900">{order.orderNo || order.id?.slice(0, 8)}</span>
          <span className="text-lg font-black text-primary">฿{Number(order.deliveryFee || 0).toLocaleString("th-TH")}</span>
        </div>
        <p className="flex items-center gap-1.5 text-sm text-gray-700 font-medium truncate">
          <User size={14} className="text-gray-400 shrink-0" /> {order.customerName || "-"}
        </p>
        <div className="flex items-center gap-3 text-xs font-bold text-gray-500">
          <span className="inline-flex items-center gap-1"><MapPin size={13} className="text-gray-400" /> {distanceKm != null ? `${distanceKm.toFixed(1)} km` : "—"}</span>
          <span className={`inline-flex items-center gap-1 ${isCod ? "text-secondary" : "text-primary"}`}>
            {isCod ? <Banknote size={13} /> : <CreditCard size={13} />} {t(`payment.${method}`)}
          </span>
        </div>
      </button>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1 !py-2 text-sm" onClick={() => onView(order)}>
          {t("ro.incoming.viewDetails")} <ChevronRight size={15} />
        </Button>
        <Button className="flex-1 !py-2 text-sm" loading={busy} disabled={disabled} onClick={() => onAccept(order)}>
          <Package size={15} /> {t("ro.acceptDelivery")}
        </Button>
      </div>
    </Card>
  );
};

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
  const [storeLocation, setStoreLocation] = useState({
    lat: FALLBACK_STORE_LAT,
    lng: FALLBACK_STORE_LNG,
    name: "LK Fried Chicken",
  });
  // คิวงานใหม่ที่เพิ่งเข้ามา -> ป๊อปอัปเต็มจอ + เสียงเรียก (ไล่ทีละใบตามลำดับที่เข้า)
  const [incomingIds, setIncomingIds] = useState([]);
  const [detailOrder, setDetailOrder] = useState(null); // ออเดอร์ที่เปิดดูรายละเอียดก่อนรับ (View Details)
  const [doneIds, setDoneIds] = useState(() => new Set()); // งาน completed ที่กด Done แล้ว -> เลิกโชว์สรุป
  const [mountTime] = useState(() => Date.now()); // เวลาเปิดหน้า — ใช้แยก "งานเพิ่งจบ" ออกจากงานเก่าใน history
  const seenOrderIdsRef = useRef(new Set()); // เคยเห็นแล้ว ไม่ต้องเด้งซ้ำ (เหมือน StoreLayout)
  const availInitRef = useRef(false);        // snapshot แรก = งานเดิม ไม่ต้องเด้ง
  const isOnlineRef = useRef(false);         // สถานะล่าสุดสำหรับใช้ใน callback ของ snapshot

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
        });
      },
      (err) => onFeedError(err, "available")
    );
    const unsubMine = onSnapshot(
      mineQ,
      (snapshot) => {
        setMyJobs(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
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
  }, [user?.uid]);

  // สถานะออนไลน์/ออฟไลน์ของไรเดอร์เอง (realtime) — RiderSettings เขียนฟิลด์เดียวกันนี้
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (snap.exists()) setRiderStatus(snap.data().riderStatus || "offline");
    });
    return () => unsub();
  }, [user?.uid]);

  const isOnline = riderStatus === "online";
  useEffect(() => { isOnlineRef.current = isOnline; }, [isOnline]);
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

  // ป๊อปอัป/รายการงานว่างแสดงเฉพาะตอน "ไม่มีงานกำลังทำ" (งานเดียวต่อครั้ง)
  const showIncoming = !activeOrder;
  const popupOrder = showIncoming && !detailOrder ? incomingOrder : null;

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

      {/* Header: title + availability toggle (nav + notifications live in RiderLayout) */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-black text-gray-900">{t("ro.jobs.title")}</h1>
        <Button
          variant={isOnline ? "primary" : "outline"}
          className={`!px-4 !py-2 text-sm shrink-0 ${isOnline ? "" : "text-gray-500"}`}
          onClick={toggleAvailability}
        >
          <Power size={16} />
          {isOnline ? t("ro.online") : t("ro.offline")}
        </Button>
      </div>

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
      ) : availableOrders.length === 0 ? (
        <EmptyState icon="🛵" title={t("ro.waiting.title")} description={t("ro.waiting.desc")} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {availableOrders.map((order) => (
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
