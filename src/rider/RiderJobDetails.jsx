import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { ArrowLeft } from "lucide-react";
import { db } from "../firebase";
import { STORE_ID } from "../config";
import { usePreferences } from "../context/PreferencesContext";
import { logError } from "../errorCenter";
import { Loading } from "../components/ui/Loading";
import { EmptyState } from "../components/ui/EmptyState";
import RiderActiveOrder from "./RiderActiveOrder.jsx";

const FALLBACK_STORE_LAT = 13.8294079;
const FALLBACK_STORE_LNG = 100.0529543;

// Thin route wrapper around the shared RiderActiveOrder workflow: subscribe to the order
// (real-time) + store location by :id, then hand off to RiderActiveOrder. Deep links keep
// working and the same workflow implementation is reused by the dashboard's active job.
export default function RiderJobDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = usePreferences();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [storeLocation, setStoreLocation] = useState({ lat: FALLBACK_STORE_LAT, lng: FALLBACK_STORE_LNG, name: "LK Fried Chicken", phone: "" });

  useEffect(() => {
    if (!id) return undefined;
    const unsub = onSnapshot(
      doc(db, "orders", id),
      (snap) => {
        if (!snap.exists()) { setOrder(null); setNotFound(true); }
        else { setOrder({ id: snap.id, ...snap.data() }); setNotFound(false); }
        setLoading(false);
      },
      (err) => { logError(err, "RiderJobDetails.order"); setLoading(false); setNotFound(true); }
    );
    return () => unsub();
  }, [id]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "stores", STORE_ID), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setStoreLocation({ lat: d.lat ?? FALLBACK_STORE_LAT, lng: d.lng ?? FALLBACK_STORE_LNG, name: d.storeName || "LK Fried Chicken", phone: d.phone ?? "" });
      }
    }, (err) => logError(err, "RiderJobDetails.store"));
    return () => unsub();
  }, []);

  if (loading) return <Loading text={t("ro.loading.deliveries")} />;
  if (notFound || !order) {
    return (
      <div className="space-y-6">
        <button onClick={() => navigate(-1)} aria-label={t("ro.jobDetails.title")} className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-primary">
          <ArrowLeft size={18} /> {t("ro.jobDetails.title")}
        </button>
        <EmptyState icon="🛵" title={t("ro.jobDetails.loadErr")} description={t("ro.history.emptyDesc")} />
      </div>
    );
  }

  return (
    <RiderActiveOrder
      order={order}
      storeLocation={storeLocation}
      onBack={() => navigate(-1)}
      onDone={() => navigate("/rider")}
    />
  );
}
