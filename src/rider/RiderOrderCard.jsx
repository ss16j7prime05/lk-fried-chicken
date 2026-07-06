import { useEffect, useState } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { Bike, CreditCard, MapPin, Package, Phone, User } from "lucide-react";
import { db } from "../firebase";
import Chat from "../Chat.jsx";
import DeliveryMap from "../location/DeliveryMap.jsx";
import MapButton from "../location/MapButton.jsx";
import { getRoute, haversineKm } from "../location/locationUtils";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import {
  DELIVERED_STATUS,
  DELIVERING_STATUS,
  PICKED_UP_STATUS,
  READY_STATUS,
  STATUS_LABEL,
} from "./riderStatus";
import { formatDate } from "./riderFormat";

const GPS_UPDATE_INTERVAL_MS = 5000;

const STATUS_BADGE_COLOR = {
  [READY_STATUS]: "blue",
  [PICKED_UP_STATUS]: "orange",
  [DELIVERING_STATUS]: "blue",
  [DELIVERED_STATUS]: "green",
};

const PAYMENT_LABEL = { cash: "Cash", promptpay: "PromptPay", transfer: "Transfer" };

const optionLabel = (value) => {
  if (!value) return "";
  if (typeof value === "object") return value.name || "";
  return value;
};

// จุดส่งของออเดอร์ รองรับทั้ง schema ใหม่ (deliveryLocation) และฟิลด์เดิม
const getDestination = (order) => ({
  lat: order.deliveryLocation?.lat ?? order.lat ?? order.latitude,
  lng: order.deliveryLocation?.lng ?? order.lng ?? order.longitude,
  address: order.deliveryLocation?.address || order.deliveryAddress || order.address,
});

const itemOptions = (item) =>
  [item.top_chicken, item.spicy, item.Sauce, item.sauce, item.powder, item.tableCheese]
    .map(optionLabel)
    .filter(Boolean);

// ระยะทาง + เวลาเดินทางจากร้าน -> จุดส่ง (OSRM, fallback เป็นเส้นตรงถ้า routing ล่ม)
function useStoreRoute(storeLocation, dLat, dLng) {
  const [route, setRoute] = useState(null);

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

  return route;
}

// อัปเดตตำแหน่ง GPS ของไรเดอร์ทุก 5 วินาที เฉพาะตอนสถานะ "delivering", ไรเดอร์ออนไลน์ และเป็นไรเดอร์ที่รับงานนี้เท่านั้น
// (ความปลอดภัย: Firestore rule อนุญาตแก้ไข order นี้เฉพาะ riderId == auth.uid)
// ออฟไลน์ = cleanup ทำงาน หยุดกระจายตำแหน่งทันที
function useRiderGpsBroadcast(effectiveStatus, orderId, dLat, dLng, isOnline) {
  useEffect(() => {
    if (!isOnline) return;
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
          await updateDoc(doc(db, "orders", orderId), {
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
  }, [effectiveStatus, orderId, dLat, dLng, isOnline]);
}

/* ── presentational sections ── */

const InfoRow = ({ icon: Icon, children, top = false }) => (
  <p className={`flex ${top ? "items-start" : "items-center"} gap-1.5 text-sm text-gray-700 font-medium`}>
    <Icon size={14} className={`text-gray-400 shrink-0 ${top ? "mt-0.5" : ""}`} />
    <span className="min-w-0">{children}</span>
  </p>
);

const CustomerSection = ({ order, address }) => (
  <div className="space-y-1.5 mb-3">
    <InfoRow icon={User}>{order.customerName || "-"}</InfoRow>
    <InfoRow icon={Phone}>{order.phone || "-"}</InfoRow>
    <InfoRow icon={MapPin} top>
      <span className="text-gray-500">{address || "-"}</span>
    </InfoRow>
    <InfoRow icon={CreditCard}>
      <span className="text-gray-500">
        {PAYMENT_LABEL[order.paymentMethod] || order.paymentMethod || "-"}
      </span>
    </InfoRow>
    {order.note && (
      <p className="text-xs text-gray-500 bg-yellow-50 border border-yellow-100 rounded-xl px-3 py-2">
        Note: {order.note}
      </p>
    )}
  </div>
);

const ItemsSection = ({ items }) => (
  <div className="mb-3 divide-y divide-gray-50">
    {(items || []).map((item, index) => {
      const options = itemOptions(item);
      return (
        <div key={index} className="flex justify-between gap-2 py-2 text-xs">
          <div className="min-w-0">
            <p className="text-gray-700 font-medium">
              {item.qty || 1}x {item.name}
            </p>
            {options.length > 0 && (
              <p className="text-gray-400 mt-0.5">{options.join(" • ")}</p>
            )}
            {item.note && <p className="text-gray-400 mt-0.5">Note: {item.note}</p>}
          </div>
          <span className="text-gray-500 whitespace-nowrap">
            ฿{(item.price || 0) * (item.qty || 1)}
          </span>
        </div>
      );
    })}
  </div>
);

const TotalsSection = ({ order }) => (
  <div className="rounded-2xl bg-gray-50 p-3 space-y-1 mb-3 text-sm">
    {order.subtotal != null && (
      <div className="flex justify-between text-gray-500 font-medium">
        <span>Subtotal</span>
        <span>฿{order.subtotal}</span>
      </div>
    )}
    {order.deliveryFee != null && (
      <div className="flex justify-between text-gray-500 font-medium">
        <span>Delivery Fee</span>
        <span>฿{order.deliveryFee}</span>
      </div>
    )}
    <div className="flex justify-between font-black text-gray-900">
      <span>Total</span>
      <span className="text-primary text-lg">฿{order.grandTotal ?? order.subtotal ?? 0}</span>
    </div>
  </div>
);

// การ์ดรายละเอียดออเดอร์ของไรเดอร์: ข้อมูลลูกค้า + รายการอาหาร + แผนที่/ระยะทาง + ปุ่ม Maps/โทร/แชท + ปุ่มเปลี่ยนสถานะ
export default function RiderOrderCard({ order, effectiveStatus, storeLocation, isOnline, onAccept, onStartDelivering, onDelivered }) {
  const [showMap, setShowMap] = useState(false);
  // optimistic เฉพาะหลังกดปุ่ม ระหว่างรอ nearPressed จริงจาก snapshot ของออเดอร์
  const [nearPressedLocally, setNearPressedLocally] = useState(false);
  const nearNotified = nearPressedLocally || Boolean(order.nearPressed);

  const { lat: dLat, lng: dLng, address: dAddress } = getDestination(order);
  const route = useStoreRoute(storeLocation, dLat, dLng);
  useRiderGpsBroadcast(effectiveStatus, order.id, dLat, dLng, isOnline);

  const markNear = async () => {
    await updateDoc(doc(db, "orders", order.id), { nearPressed: true });
    setNearPressedLocally(true);
  };

  return (
    <Card className="p-5">
      {/* header: order no. + created time + status */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="font-black text-gray-900">{order.orderNo || order.id}</p>
          <p className="text-xs font-medium text-gray-400 mt-0.5">{formatDate(order.createdAt)}</p>
        </div>
        <Badge color={STATUS_BADGE_COLOR[effectiveStatus] ?? "blue"}>
          {STATUS_LABEL[effectiveStatus] || effectiveStatus}
        </Badge>
      </div>

      <CustomerSection order={order} address={dAddress} />
      <ItemsSection items={order.items} />
      <TotalsSection order={order} />

      {route && (
        <p className="text-xs text-gray-400 font-medium mb-3">
          {route.distanceKm.toFixed(1)} km from store
          {route.durationMin != null && <> · ~{route.durationMin} min</>}
        </p>
      )}

      {/* navigate + call */}
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

      {/* inline customer map */}
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

      {/* status actions: ready -> [Accept] -> picked_up -> [Start Delivering] -> delivering -> [Delivered] */}
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
            <Button variant="outline" className="flex-1" onClick={markNear} disabled={nearNotified}>
              <MapPin size={16} />
              {nearNotified ? "Customer Notified" : "I'm Near"}
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
}
