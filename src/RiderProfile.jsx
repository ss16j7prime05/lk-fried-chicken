import { useEffect, useState } from "react";
import { db, auth } from "./firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { Link } from "react-router-dom";
import { Package, LogOut, User, Phone, Bike, CalendarCheck, Star, MessageSquare, Mail, Settings } from "lucide-react";
import { useAuth } from "./AuthContext.jsx";
import { Card } from "./components/ui/Card";
import { Button } from "./components/ui/Button";
import { Badge } from "./components/ui/Badge";
import { Loading } from "./components/ui/Loading";

const toDate = (createdAt) => {
  if (!createdAt) return null;
  return createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
};
const isToday = (d, ref) =>
  d &&
  d.getDate() === ref.getDate() &&
  d.getMonth() === ref.getMonth() &&
  d.getFullYear() === ref.getFullYear();

const vehicleLabel = (v) =>
  v === "car" ? "รถยนต์" : v === "motorcycle" ? "มอเตอร์ไซค์" : v || "-";

const StatCard = ({ icon: Icon, label, value }) => (
  <Card className="p-5 flex items-center gap-4">
    <div className="p-3 rounded-2xl bg-primary-light text-primary shrink-0">
      <Icon size={22} />
    </div>
    <div className="min-w-0">
      <p className="text-xs font-bold text-gray-400 uppercase truncate">{label}</p>
      <p className="text-lg font-black text-gray-900 truncate">{value}</p>
    </div>
  </Card>
);

const InfoRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
    <div className="flex items-center gap-3">
      <Icon size={18} className="text-gray-400" />
      <span className="font-bold text-gray-700 text-sm">{label}</span>
    </div>
    <span className="font-bold text-gray-900 text-sm">{value}</span>
  </div>
);

function RiderProfile() {
  const { profile, logout } = useAuth();
  const [orders, setOrders] = useState([]);
  const [reviews, setReviews] = useState([]);
  // ไม่มี uid (ปกติไม่เกิด เพราะผ่าน ProtectedRoute มาแล้ว) = ไม่มีอะไรให้โหลด
  const [loading, setLoading] = useState(() => Boolean(auth.currentUser?.uid));

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const q = query(collection(db, "orders"), where("riderId", "==", uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setOrders(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    const rq = query(collection(db, "reviews"), where("riderId", "==", uid));
    const unsubRev = onSnapshot(rq, (snapshot) => {
      setReviews(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => {
      unsubscribe();
      unsubRev();
    };
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
    return <Loading text="Loading profile..." />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto p-4 sm:p-8 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-2xl font-black text-gray-900">Rider Profile</h1>
          <div className="flex gap-2">
            <Link to="/rider">
              <Button variant="outline" className="!px-4 !py-2 text-sm">
                <Package size={16} />
                Jobs
              </Button>
            </Link>
            <Link to="/rider/settings">
              <Button variant="outline" className="!px-4 !py-2 text-sm">
                <Settings size={16} />
                Settings
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

        <Card className="p-6 flex items-center gap-5">
          <div className="w-16 h-16 rounded-full bg-primary-light text-primary flex items-center justify-center text-2xl font-black ring-4 ring-primary-light shrink-0">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-black text-gray-900 truncate">{displayName}</h2>
              {profile?.status === "approved" && <Badge color="green">Approved</Badge>}
            </div>
            <p className="text-sm text-gray-500 font-medium mt-1">{profile?.phone || "-"}</p>
          </div>
        </Card>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard icon={Package} label="Total Jobs" value={totalJobs} />
          <StatCard icon={CalendarCheck} label="Today" value={todayJobs} />
          <StatCard icon={Star} label="Rating" value={rating} />
          <StatCard icon={MessageSquare} label="Reviews" value={reviewCount} />
        </div>

        <Card className="p-6">
          <InfoRow icon={User} label="Name" value={displayName} />
          <InfoRow icon={Phone} label="Phone" value={profile?.phone || "-"} />
          <InfoRow icon={Mail} label="Email" value={profile?.email || "-"} />
          <InfoRow icon={Bike} label="Vehicle" value={vehicleLabel(profile?.vehicleType)} />
        </Card>
      </div>
    </div>
  );
}

export default RiderProfile;
