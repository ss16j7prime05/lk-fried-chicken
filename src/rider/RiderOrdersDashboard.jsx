import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { Link } from "react-router-dom";
import { Phone, MapPin, LogOut, User, Package, Bike } from "lucide-react";
import { db } from "../firebase";
import { STORE_ID } from "../config";
import { useAuth } from "../AuthContext.jsx";
import Chat from "../Chat.jsx";
import DeliveryMap from "../location/DeliveryMap.jsx";
import MapButton from "../location/MapButton.jsx";
import { getRoute, haversineKm } from "../location/locationUtils";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Loading } from "../components/ui/Loading";
import {
  DELIVERED_STATUS,
  DELIVERING_STATUS,
  PICKED_UP_STATUS,
  READY_STATUS,
  STATUS_LABEL,
  isReadyForDelivery,
} from "./riderStatus";

// ค่าเริ่มต้น ใช้เมื่อยังไม่มี lat/lng ใน Firestore stores/{STORE_ID}
const FALLBACK_STORE_LAT = 13.8294079;
const FALLBACK_STORE_LNG = 100.0529543;

const GPS_UPDATE_INTERVAL_MS = 5000;

const STATUS_BADGE_COLOR = {
  [READY_STATUS]: "blue",
  [PICKED_UP_STATUS]: "orange",
  [DELIVERING_STATUS]: "blue",
  [DELIVERED_STATUS]: "green",
};

const optionLabel = (value) => {
  if (!value) return "";
  if (typeof value === "object") return value.name || "";
  return value;
};

const formatDate = (createdAt) => {
  if (!createdAt) return "-";
  const d = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
  return d.toLocaleString("th-TH");
};

// Order card — inlined here (not a separate file) since it's only ever used by
// this dashboard. Business logic (route calc, GPS watch, status transitions) is
// unchanged from the previous src/rider/RiderOrderCard.jsx implementation.
const RiderOrderCard = ({ order, effectiveStatus, storeLocation, onAccept, onStartDelivering, onDelivered }) => {
  const [showMap, setShowMap] = useState(false);
  const [route, setRoute] = useState(null);

  const dLat = order.deliveryLocation?.lat ?? order.lat ?? order.latitude;
  const dLng = order.deliveryLocation?.lng ?? order.lng ?? order.longitude;
  const dAddress = order.deliveryLocation?.address || order.deliveryAddress || order.address;

  useEffect(() => {
    if (dLat == null || dLng == null || !storeLocation) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await getRoute(storeLocation.lat, storeLocation.lng, dLat, dLng);
        if (!cancelled) setRoute(r);
      } catch {
        const km = haversineKm(storeLocation.lat, storeLocation.lng, dLat, dLng);
        if (!cancelled) setRoute({ distanceKm: km, durationMin: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dLat, dLng, storeLocation]);

  // อัปเดตตำแหน่ง GPS ของไรเดอร์ทุก 5 วินาที เฉพาะตอนสถานะ "delivering" และเป็นไรเดอร์ที่รับงานนี้เท่านั้น
  // (ความปลอดภัย: Firestore rule อนุญาตแก้ไข order นี้เฉพาะ riderId == auth.uid)
  useEffect(() => {
    if (effectiveStatus !== DELIVERING_STATUS) return;
    if (!navigator.geolocation) return;

    let cancelled = false;

    const updateLocation = () => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          if (cancelled) return;
          const { latitude, longitude, heading, speed } = pos.coords;
          let remainingDistance;
          let estimatedArrival = null;
          try {
            const r = await getRoute(latitude, longitude, dLat, dLng);
            remainingDistance = r.distanceKm;
            estimatedArrival = new Date(Date.now() + r.durationMin * 60000).toISOString();
          } catch {
            remainingDistance = haversineKm(latitude, longitude, dLat, dLng);
          }
          if (cancelled) return;
          await updateDoc(doc(db, "orders", order.id), {
            riderLocation: {
              lat: latitude,
              lng: longitude,
              heading: heading ?? null,
              speed: speed ?? null,
              updatedAt: serverTimestamp(),
              estimatedArrival,
              remainingDistance,
            },
          });
        },
        (err) => console.warn("ดึงตำแหน่ง GPS ไม่สำเร็จ", err),
        { enableHighAccuracy: true, maximumAge: 4000, timeout: 8000 }
      );
    };

    updateLocation();
    const interval = setInterval(updateLocation, GPS_UPDATE_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [effectiveStatus, order.id, dLat, dLng]);

  const markNear = async () => {
    await updateDoc(doc(db, "orders", order.id), { nearPressed: true });
    alert("แจ้งลูกค้าว่าใกล้ถึงแล้ว");
  };

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="font-black text-gray-900">{order.orderNo || order.id}</p>
          <p className="text-xs font-medium text-gray-400 mt-0.5">{formatDate(order.createdAt)}</p>
        </div>
        <Badge color={STATUS_BADGE_COLOR[effectiveStatus] ?? "blue"}>
          {STATUS_LABEL[effectiveStatus] || effectiveStatus}
        </Badge>
      </div>

      <div className="space-y-1.5 text-sm mb-3">
        <p className="flex items-center gap-1.5 text-gray-700 font-medium">
          <User size={14} className="text-gray-400" />
          {order.customerName || "-"}
        </p>
        <p className="flex items-center gap-1.5 text-gray-700 font-medium">
          <Phone size={14} className="text-gray-400" />
          {order.phone || "-"}
        </p>
        <p className="flex items-start gap-1.5 text-gray-500">
          <MapPin size={14} className="text-gray-400 shrink-0 mt-0.5" />
          {order.deliveryAddress || order.address || "-"}
        </p>
        <p className="text-gray-500">
          <span className="font-bold text-gray-700">Payment:</span> {order.paymentMethod || "-"}
        </p>
      </div>

      <div className="space-y-1 mb-3">
        {(order.items || []).map((item, index) => (
          <p key={index} className="text-xs text-gray-500 border-t border-gray-50 pt-2 mt-2">
            {item.name} ×{item.qty || 1}
            {optionLabel(item.top_chicken) ? ` (${optionLabel(item.top_chicken)})` : ""}
          </p>
        ))}
      </div>

      <p className="font-black text-lg text-primary mb-3">
        ฿{order.grandTotal ?? order.subtotal ?? 0}
      </p>

      {route && (
        <p className="text-xs text-gray-400 font-medium mb-3">
          {route.distanceKm.toFixed(1)} km from store
          {route.durationMin != null && <> · ~{route.durationMin} min</>}
        </p>
      )}

      <div className="flex flex-wrap gap-2 mb-2">
        <MapButton lat={dLat} lng={dLng} mode="navigate" style={{ flex: 1, minWidth: "130px" }} />
        <Button
          className="flex-1"
          onClick={() => {
            window.location.href = `tel:${order.phone}`;
          }}
        >
          <Phone size={16} />
          Call Customer
        </Button>
      </div>

      {dLat != null && dLng != null && (
        <Button variant="outline" className="w-full !py-2 text-sm mb-2" onClick={() => setShowMap((v) => !v)}>
          <MapPin size={16} />
          {showMap ? "Hide Map" : "View Customer Map"}
        </Button>
      )}
      {showMap && (
        <div className="mb-3">
          <DeliveryMap lat={dLat} lng={dLng} address={dAddress} storeLocation={storeLocation} height="180px" />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {effectiveStatus === READY_STATUS && (
          <Button className="flex-1" onClick={() => onAccept(order.id)}>
            <Package size={16} />
            Accept Delivery
          </Button>
        )}
        {effectiveStatus === PICKED_UP_STATUS && (
          <Button className="flex-1" onClick={() => onStartDelivering(order.id)}>
            <Bike size={16} />
            Start Delivering
          </Button>
        )}
        {effectiveStatus === DELIVERING_STATUS && (
          <>
            <Button variant="outline" className="flex-1" onClick={markNear}>
              <MapPin size={16} />
              I'm Near
            </Button>
            <Button className="flex-1" onClick={() => onDelivered(order.id)}>
              Delivered
            </Button>
          </>
        )}
      </div>

      {effectiveStatus !== READY_STATUS && <Chat orderId={order.id} sender="rider" />}
    </Card>
  );
};

// Rider Dashboard ใหม่: เห็นงานพร้อมส่งทั้งหมด, รับงานได้, อัปเดตสถานะแบบ realtime
export default function RiderOrdersDashboard() {
  const { user, profile, logout } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("available");
  const [storeLocation, setStoreLocation] = useState({
    lat: FALLBACK_STORE_LAT,
    lng: FALLBACK_STORE_LNG,
    name: "LK Fried Chicken",
  });

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "orders"), (snapshot) => {
      setOrders(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    const unsubStore = onSnapshot(doc(db, "stores", STORE_ID), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setStoreLocation({
          lat: data.lat ?? FALLBACK_STORE_LAT,
          lng: data.lng ?? FALLBACK_STORE_LNG,
          name: data.storeName || "LK Fried Chicken",
        });
      }
    });
    return () => {
      unsubscribe();
      unsubStore();
    };
  }, []);

  const availableOrders = orders.filter(
    (o) => !o.riderId && isReadyForDelivery(o.status)
  );

  const myOrders = orders
    .filter(
      (o) =>
        o.riderId === user?.uid &&
        (o.status === PICKED_UP_STATUS || o.status === DELIVERING_STATUS)
    )
    .sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() ?? 0;
      const tb = b.createdAt?.toMillis?.() ?? 0;
      return tb - ta;
    });

  // รับงาน: บันทึก riderId/riderName + ย้ายสถานะเป็น "picked_up" (ออเดอร์พร้อมส่งอยู่แล้วที่เคาน์เตอร์)
  const acceptDelivery = async (orderId) => {
    if (!user) return;
    await updateDoc(doc(db, "orders", orderId), {
      riderId: user.uid,
      riderName: profile?.name || profile?.riderName || user.email || "ไรเดอร์",
      riderPhone: profile?.phone || "",
      status: PICKED_UP_STATUS,
      acceptedAt: serverTimestamp(),
      pickedUpAt: serverTimestamp(),
    });
  };

  const startDelivering = async (orderId) => {
    await updateDoc(doc(db, "orders", orderId), {
      status: DELIVERING_STATUS,
    });
  };

  const markDelivered = async (orderId) => {
    await updateDoc(doc(db, "orders", orderId), {
      status: DELIVERED_STATUS,
      deliveredAt: serverTimestamp(),
    });
  };

  const list = tab === "available" ? availableOrders : myOrders;

  if (loading) {
    return <Loading text="Loading deliveries..." />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-4 sm:p-8 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-2xl font-black text-gray-900">Rider Dashboard</h1>
          <div className="flex gap-2">
            <Link to="/rider/profile">
              <Button variant="outline" className="!px-4 !py-2 text-sm">
                <User size={16} />
                Profile
              </Button>
            </Link>
            <Button
              variant="outline"
              className="!px-4 !py-2 text-sm text-secondary border-secondary/30 hover:border-secondary"
              onClick={logout}
            >
              <LogOut size={16} />
              Logout
            </Button>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setTab("available")}
            className={`px-5 py-2 rounded-2xl text-sm font-bold whitespace-nowrap border transition-all ${
              tab === "available"
                ? "bg-primary text-white border-primary"
                : "bg-white text-gray-500 border-gray-100 hover:border-primary"
            }`}
          >
            Available Deliveries ({availableOrders.length})
          </button>
          <button
            onClick={() => setTab("mine")}
            className={`px-5 py-2 rounded-2xl text-sm font-bold whitespace-nowrap border transition-all ${
              tab === "mine"
                ? "bg-primary text-white border-primary"
                : "bg-white text-gray-500 border-gray-100 hover:border-primary"
            }`}
          >
            My Deliveries ({myOrders.length})
          </button>
        </div>

        {list.length === 0 ? (
          <EmptyState
            icon="🛵"
            title={tab === "available" ? "No deliveries available" : "No active deliveries"}
            description={
              tab === "available"
                ? "New deliveries ready for pickup will show up here."
                : "Deliveries you accept will show up here until they're completed."
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {list.map((order) => (
              <RiderOrderCard
                key={order.id}
                order={order}
                effectiveStatus={tab === "available" ? READY_STATUS : order.status}
                storeLocation={storeLocation}
                onAccept={acceptDelivery}
                onStartDelivering={startDelivering}
                onDelivered={markDelivered}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
