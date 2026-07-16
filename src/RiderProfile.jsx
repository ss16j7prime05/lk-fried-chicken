import { useEffect, useState } from "react";
import { db, auth } from "./firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { User, Phone, Bike, CalendarCheck, Star, MessageSquare, Mail, Package, IdCard, LogOut } from "lucide-react";
import { useAuth } from "./AuthContext.jsx";
import { usePreferences } from "./context/PreferencesContext";
import { useRiderOrders } from "./rider/useRiderOrders";
import { Card } from "./components/ui/Card";
import { Badge } from "./components/ui/Badge";
import { Button } from "./components/ui/Button";
import { RiderCardGridSkeleton } from "./components/ui/Skeleton";
import { StatCard } from "./rider/riderUi";
import { vehicleLabel } from "./rider/riderFormat";

const toDate = (createdAt) => {
  if (!createdAt) return null;
  return createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
};
const isToday = (d, ref) =>
  d &&
  d.getDate() === ref.getDate() &&
  d.getMonth() === ref.getMonth() &&
  d.getFullYear() === ref.getFullYear();

const InfoRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-center justify-between gap-3 py-3 border-b border-gray-50 last:border-0">
    <div className="flex items-center gap-3 min-w-0">
      <Icon size={18} className="text-gray-400 shrink-0" />
      <span className="font-bold text-gray-700 text-sm">{label}</span>
    </div>
    <span className="font-bold text-gray-900 text-sm text-right truncate">{value}</span>
  </div>
);

function RiderProfile() {
  const { profile, logout } = useAuth();
  const { t } = usePreferences();
  // ไม่มี uid (ปกติไม่เกิด เพราะผ่าน ProtectedRoute มาแล้ว) = ไม่มีอะไรให้โหลด
  const { orders, loading } = useRiderOrders(auth.currentUser?.uid);
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const rq = query(collection(db, "reviews"), where("riderId", "==", uid));
    const unsubRev = onSnapshot(rq, (snapshot) => {
      setReviews(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsubRev();
  }, []);

  const now = new Date();
  const totalJobs = orders.length;
  const todayJobs = orders.filter((o) => isToday(toDate(o.createdAt), now)).length;
  // คะแนนเฉลี่ยจากรีวิวจริง
  const reviewCount = reviews.length;
  const rating =
    reviewCount > 0
      ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviewCount).toFixed(1)
      : "-";

  const displayName = profile?.name || profile?.riderName || "-";

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-black text-gray-900">{t("ro.profile.title")}</h1>
        <RiderCardGridSkeleton count={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-gray-900">{t("ro.profile.title")}</h1>

      <Card className="p-6 flex items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-primary-light text-primary flex items-center justify-center text-2xl font-black ring-4 ring-primary-light shrink-0">
          {displayName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-black text-gray-900 truncate">{displayName}</h2>
            {profile?.status === "approved" && <Badge color="green">{t("ro.approved")}</Badge>}
          </div>
          <p className="text-sm text-gray-500 font-medium mt-1">{profile?.phone || "-"}</p>
        </div>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={Package} label={t("ro.totalJobs")} value={totalJobs} />
        <StatCard icon={CalendarCheck} label={t("ro.today")} value={todayJobs} />
        <StatCard icon={Star} label={t("ro.rating")} value={rating} />
        <StatCard icon={MessageSquare} label={t("ro.reviews")} value={reviewCount} />
      </div>

      <Card className="p-6">
        <InfoRow icon={User} label={t("ro.name")} value={displayName} />
        <InfoRow icon={Phone} label={t("ro.phone")} value={profile?.phone || "-"} />
        <InfoRow icon={Mail} label={t("ro.email")} value={profile?.email || "-"} />
        <InfoRow icon={Bike} label={t("ro.vehicle")} value={vehicleLabel(profile?.vehicleType, t)} />
        <InfoRow icon={IdCard} label={t("ro.licensePlate")} value={profile?.licensePlate || "-"} />
      </Card>

      {/* Logout — reachable from Profile too (mobile bottom nav has no logout) */}
      <Button
        variant="outline"
        className="w-full text-secondary border-secondary/30 hover:border-secondary"
        onClick={logout}
      >
        <LogOut size={18} />
        {t("ro.logout")}
      </Button>
    </div>
  );
}

export default RiderProfile;
