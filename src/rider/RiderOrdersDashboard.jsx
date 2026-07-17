import { useEffect, useRef, useState } from "react";
import { collection, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { AlertCircle, Navigation, Power, WifiOff } from "lucide-react";
import { db } from "../firebase";
import { STORE_ID } from "../config";
import { useAuth } from "../AuthContext.jsx";
import { usePreferences } from "../context/PreferencesContext";
import RiderOrderCard from "./RiderOrderCard.jsx";
import RiderIncomingOrderPopup from "./RiderIncomingOrderPopup.jsx";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { RiderCardGridSkeleton } from "../components/ui/Skeleton";
import {
  DELIVERED_STATUS,
  DELIVERING_STATUS,
  PICKED_UP_STATUS,
  READY_QUERY_STATUSES,
  READY_STATUS,
  isReadyForDelivery,
} from "./riderStatus";
import { byNewest, normalizeStatus } from "../store/orderStatus";
import { useStoreStatus } from "../store/useStoreStatus";
import { transition } from "../store/orderStateMachine";
import { acceptOrder, rejectOrder, hasRejected } from "./riderAcceptReject";
import { useDeliveryBroadcast, getDestination } from "./riderLocationService";
import { GEO_STATE, useGeolocationStatus } from "../location/mapsService";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { logError } from "../errorCenter";

// ค่าเริ่มต้น ใช้เมื่อยังไม่มี lat/lng ใน Firestore stores/{STORE_ID}
const FALLBACK_STORE_LAT = 13.8294079;
const FALLBACK_STORE_LNG = 100.0529543;

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

// Rider Dashboard ใหม่: เห็นงานพร้อมส่งทั้งหมด, รับงานได้, อัปเดตสถานะแบบ realtime
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
  const [tab, setTab] = useState("available");
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

  // คิวงานของไรเดอร์คนนี้ แยกตามสถานะเดิม: Assigned (picked_up) / Active (delivering) / Completed
  const mine = orders.filter((o) => o.riderId === user?.uid);
  const assignedOrders = mine.filter((o) => o.status === PICKED_UP_STATUS).sort(byNewest());
  const activeOrders = mine.filter((o) => o.status === DELIVERING_STATUS).sort(byNewest());
  const completedOrders = mine
    .filter((o) => normalizeStatus(o.status) === DELIVERED_STATUS)
    .sort(byNewest());

  // งานที่กำลังส่งอยู่จริง = สิ่งที่ต้องกระจายตำแหน่งให้ลูกค้าติดตาม
  const deliveries = activeOrders
    .map((o) => {
      const { lat, lng } = getDestination(o);
      return { id: o.id, lat, lng };
    })
    .filter((d) => d.lat != null && d.lng != null);
  // ออฟไลน์ = เขียนไม่ถึง Firestore อยู่แล้ว หยุดอ่าน GPS ไปเลย (ประหยัดแบต)
  const { geoError } = useDeliveryBroadcast(deliveries, isOnline && networkOnline);
  const locationAlert = pickLocationAlert(networkOnline, geoError, geoPermission.state);

  // สลับความพร้อมรับงาน — เขียน users/{uid}.riderStatus (ฟิลด์เดิม ไม่เพิ่ม schema)
  const toggleAvailability = async () => {
    if (!user) return;
    try {
      await updateDoc(doc(db, "users", user.uid), {
        riderStatus: isOnline ? "offline" : "online",
      });
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

  // รับงาน: ผ่าน acceptOrder (transaction) เท่านั้น — re-read ออเดอร์ใน transaction แล้วเคลมต่อเมื่อ
  // ยังพร้อมส่งและยังไม่มีคนรับ จึงกันสองไรเดอร์กดพร้อมกันแล้วได้งานใบเดียวกันทั้งคู่
  const acceptDelivery = async (order) => {
    if (!user || !isOnline || busyId) return;
    setBusyId(order.id);
    setActionError("");
    const { ok, reason } = await acceptOrder(order, riderIdentity());
    // สำเร็จแล้วออเดอร์จะหายจากแท็บ Available ไปโผล่ที่ Assigned — พาไรเดอร์ตามไปเลย
    if (ok) setTab("assigned");
    else setActionError(t(actionMessageKey(reason)));
    dismissIncoming(order.id); // ปิดป๊อปอัป/หยุดเสียงไม่ว่าผลจะสำเร็จหรือไม่
    setBusyId("");
  };

  // ปฏิเสธงาน: ออเดอร์ยังพร้อมส่งและว่างเหมือนเดิม แค่ซ่อนจากพูลของไรเดอร์คนนี้ (rejectedBy)
  const rejectDelivery = async (order) => {
    if (!user || busyId) return;
    setBusyId(order.id);
    setActionError("");
    const { ok, reason } = await rejectOrder(order, riderIdentity());
    if (!ok) setActionError(t(actionMessageKey(reason)));
    dismissIncoming(order.id); // ปิดป๊อปอัป/หยุดเสียง
    setBusyId("");
  };
  // เปลี่ยนสถานะงาน: ผ่าน orderStateMachine.transition (SSOT ด่านเดียวของการเปลี่ยนสถานะ)
  const runTransition = async (order, to) => {
    if (!user || busyId) return;
    setBusyId(order.id);
    setActionError("");
    const { ok, reason } = await transition(order, to, { by: user.uid });
    if (!ok) setActionError(t(actionMessageKey(reason)));
    setBusyId("");
  };
  const startDelivering = (order) => runTransition(order, DELIVERING_STATUS);
  const markDelivered = (order) => runTransition(order, DELIVERED_STATUS);

  // แท็บทั้งหมด: พูลงานว่าง + คิวงานของไรเดอร์ (ใช้ RiderOrderCard ตัวเดิมทุกแท็บ)
  const TABS = [
    { key: "available", list: availableOrders },
    { key: "assigned", list: assignedOrders },
    { key: "active", list: activeOrders },
    { key: "completed", list: completedOrders },
  ];
  const activeTab = TABS.find((tb) => tb.key === tab) ?? TABS[0];
  const list = activeTab.list;

  return (
    <div className="space-y-6">
      {/* งานใหม่เข้า -> ป๊อปอัปเต็มจอ + เสียงเรียกวนซ้ำจนกดรับ/ปฏิเสธ/หมดเวลา */}
      <RiderIncomingOrderPopup
        key={incomingOrder?.id || "none"}
        order={incomingOrder}
        storeLocation={storeLocation}
        busy={Boolean(busyId)}
        onAccept={acceptDelivery}
        onReject={rejectDelivery}
        onDismiss={() => incomingOrder && dismissIncoming(incomingOrder.id)}
      />

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

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={`px-5 py-2 rounded-2xl text-sm font-bold whitespace-nowrap border transition-all ${
              tab === tb.key
                ? "bg-primary text-white border-primary"
                : "bg-white text-gray-500 border-gray-100 hover:border-primary"
            }`}
          >
            {t(`ro.tab.${tb.key}`)} ({tb.list.length})
          </button>
        ))}
      </div>

      {/* ตำแหน่ง/เน็ตมีปัญหา = นำทางไม่ได้ + ลูกค้าติดตามไม่ได้ ไรเดอร์ต้องรู้ตัว (เดิมพังเงียบ) */}
      {locationAlert && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-100 text-amber-700">
          {networkOnline ? (
            <Navigation size={20} className="shrink-0 mt-0.5" />
          ) : (
            <WifiOff size={20} className="shrink-0 mt-0.5" />
          )}
          <div className="min-w-0 flex-1">
            <p className="font-black text-sm">{t(`ro.loc.${locationAlert.key}.title`)}</p>
            <p className="text-xs font-medium text-amber-600 mt-0.5">{t(`ro.loc.${locationAlert.key}.desc`)}</p>
          </div>
          {locationAlert.retry && (
            <button
              onClick={geoPermission.request}
              className="text-xs font-black text-amber-700 underline shrink-0 mt-0.5"
            >
              {t("ro.retry")}
            </button>
          )}
        </div>
      )}

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

      {actionError && (
        <div
          role="alert"
          className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 border border-red-100 text-red-600"
        >
          <AlertCircle size={20} className="shrink-0 mt-0.5" />
          <p className="text-sm font-bold min-w-0 flex-1">{actionError}</p>
          <button
            onClick={() => setActionError("")}
            className="text-xs font-black text-red-400 hover:text-red-600 shrink-0"
          >
            {t("ro.dismiss")}
          </button>
        </div>
      )}

      {tab === "available" && storeClosed && (
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
      ) : tab === "available" && !isOnline ? (
        <div className="space-y-4">
          <EmptyState icon="🌙" title={t("ro.offlineTitle")} description={t("ro.offlineDesc")} />
          <div className="flex justify-center">
            <Button className="!px-6" onClick={toggleAvailability}>
              <Power size={16} />
              {t("ro.goOnline")}
            </Button>
          </div>
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon="🛵"
          title={t(`ro.empty.${activeTab.key}.title`)}
          description={t(`ro.empty.${activeTab.key}.desc`)}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((order) => (
            <RiderOrderCard
              key={order.id}
              order={order}
              effectiveStatus={tab === "available" ? READY_STATUS : order.status}
              storeLocation={storeLocation}
              networkOnline={networkOnline}
              busy={busyId === order.id}
              disabled={Boolean(busyId) && busyId !== order.id}
              onAccept={acceptDelivery}
              onReject={rejectDelivery}
              onStartDelivering={startDelivering}
              onDelivered={markDelivered}
            />
          ))}
        </div>
      )}
    </div>
  );
}
