import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { ArrowLeft, User, Phone, Mail, IdCard, Bike, Landmark, Star, Pencil } from "lucide-react";
import { db } from "../firebase";
import { useAuth } from "../AuthContext.jsx";
import { usePreferences } from "../context/PreferencesContext";
import { useRiderOrders } from "./useRiderOrders";
import { performanceRates, riderTier } from "./riderMetrics";
import { vehicleLabel } from "./riderFormat";
import { logError } from "../errorCenter";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";

const maskAccount = (num) => {
  if (!num) return "-";
  const s = String(num);
  return s.length <= 4 ? s : `•••• ${s.slice(-4)}`;
};

const InfoRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-center justify-between gap-3 py-3 border-b border-gray-50 last:border-0">
    <span className="flex items-center gap-3 min-w-0 text-sm font-bold text-gray-500">
      <Icon size={18} className="text-gray-400 shrink-0" /> {label}
    </span>
    <span className="font-bold text-gray-900 text-sm text-right truncate max-w-[55%]">{value}</span>
  </div>
);

// My Account — identity + personal info from the real users/{uid} profile. Rating is the
// average of real reviews for this rider; level is profile.riderLevel or a tier derived
// from real completed-order count. "Edit profile" opens the existing profile page.
export default function RiderAccount() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { t } = usePreferences();
  const { orders } = useRiderOrders(user?.uid);
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    if (!user?.uid) return undefined;
    const rq = query(collection(db, "reviews"), where("riderId", "==", user.uid));
    const unsub = onSnapshot(
      rq,
      (snap) => setReviews(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => logError(err, "RiderAccount.reviews")
    );
    return () => unsub();
  }, [user?.uid]);

  const displayName = profile?.name || profile?.riderName || "-";
  const photo = profile?.photoURL || profile?.avatarUrl || profile?.profilePhoto || "";
  const riderCode = profile?.riderCode || user?.uid?.slice(0, 8).toUpperCase() || "-";
  const { completed } = performanceRates(orders);
  const level = profile?.riderLevel || t(`ro.tier.${riderTier(completed)}`);
  const rating = reviews.length > 0 ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length).toFixed(2) : "—";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button onClick={() => navigate("/rider/settings")} className="flex items-center gap-2 text-lg font-black text-gray-900 hover:text-primary">
        <ArrowLeft size={20} /> {t("ro.menu.account")}
      </button>

      {/* identity */}
      <Card className="p-6 flex flex-col items-center text-center">
        {photo ? (
          <img src={photo} alt="" className="w-24 h-24 rounded-full object-cover ring-4 ring-primary-light" />
        ) : (
          <div className="w-24 h-24 rounded-full bg-primary-light text-primary flex items-center justify-center text-4xl font-black">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
        <h2 className="text-xl font-black text-gray-900 mt-3">{displayName}</h2>
        <p className="text-xs font-bold text-gray-400 mt-0.5">{riderCode}</p>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[11px] font-black text-primary bg-primary-light px-2.5 py-1 rounded-full uppercase">{level}</span>
          <span className="inline-flex items-center gap-1 text-[11px] font-black text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
            <Star size={12} className="fill-amber-400 text-amber-400" /> {rating}
          </span>
        </div>
      </Card>

      {/* job types (vehicle) */}
      <Card className="p-5">
        <p className="text-sm font-black text-gray-700 mb-1">{t("ro.account.jobTypes")}</p>
        <InfoRow icon={Bike} label={t("ro.type")} value={vehicleLabel(profile?.vehicleType, t)} />
        <InfoRow icon={IdCard} label={t("ro.licensePlate")} value={profile?.licensePlate || "-"} />
      </Card>

      {/* personal info */}
      <Card className="p-5">
        <p className="text-sm font-black text-gray-700 mb-1">{t("ro.account.personal")}</p>
        <InfoRow icon={User} label={t("ro.name")} value={displayName} />
        <InfoRow icon={Phone} label={t("ro.phone")} value={profile?.phone || "-"} />
        <InfoRow icon={Mail} label={t("ro.email")} value={profile?.email || "-"} />
        <InfoRow icon={Landmark} label={t("ro.bank")} value={profile?.bankName || "-"} />
        <InfoRow icon={IdCard} label={t("ro.accountNumber")} value={maskAccount(profile?.accountNumber)} />
      </Card>

      <Button className="w-full" onClick={() => navigate("/rider/profile")}>
        <Pencil size={17} /> {t("ro.account.edit")}
      </Button>
    </div>
  );
}
