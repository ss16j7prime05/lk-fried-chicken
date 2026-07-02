import { useEffect, useState } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { Phone, MapPin, User, Package, Bike } from "lucide-react";
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

// การ์ดออเดอร์เดียวสำหรับ Rider Dashboard: ข้อมูลลูกค้า + แผนที่/ระยะทาง/เวลา + ปุ่ม Maps/โทร/แชท + ปุ่มเปลี่ยนสถานะ
export default function RiderOrderCard({ order, effectiveStatus, storeLocation, onAccept, onStartDelivering, onDelivered }) {
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
}
