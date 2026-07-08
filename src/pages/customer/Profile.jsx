import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  Banknote,
  QrCode,
  LogOut,
  ShoppingBag,
  Wallet,
  Heart,
  Camera,
  MapPin,
  ChevronRight,
} from "lucide-react";
import { db, storage } from "../../firebase";
import { useAuth } from "../../AuthContext";
import { usePreferences } from "../../context/PreferencesContext";
import { normalizeStatus } from "../../store/orderStatus";
import { useCustomerOrders } from "./useCustomerOrders";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Loading } from "../../components/ui/Loading";

const SectionTitle = ({ children }) => (
  <h2 className="text-base font-black text-gray-900 mb-4">{children}</h2>
);

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

const formatMemberSince = (timestamp, locale) => {
  const d = timestamp?.toDate ? timestamp.toDate() : timestamp ? new Date(timestamp) : null;
  if (!d || Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString(locale === "th" ? "th-TH" : "en-GB", { month: "short", year: "numeric" });
};

export const Profile = () => {
  const { user, logout } = useAuth();
  const { t, language } = usePreferences();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);

  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState(null);

  const [logoutOpen, setLogoutOpen] = useState(false);

  // Real users/{uid} document — kept live so edits made here (or elsewhere) always
  // reflect immediately, without needing to touch AuthContext.
  useEffect(() => {
    if (!user?.uid) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }
    const unsubscribe = onSnapshot(doc(db, "users", user.uid), (snap) => {
      const data = snap.exists() ? snap.data() : null;
      setProfile(data);
      setFullName(data?.name || "");
      setPhone(data?.phone || "");
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user?.uid]);

  // Shared customer orders subscription. sort:false preserves this page's original
  // unsorted array (stats are order-independent, so ordering has no visible effect).
  const { orders } = useCustomerOrders(profile?.phone, { sort: false });

  const stats = useMemo(() => {
    const completed = orders.filter((o) => normalizeStatus(o.status) === "completed");
    const totalSpent = completed.reduce((sum, o) => sum + (o.grandTotal || 0), 0);

    const itemCounts = {};
    orders.forEach((o) => {
      (o.items ?? []).forEach((item) => {
        if (!item.name) return;
        itemCounts[item.name] = (itemCounts[item.name] || 0) + (item.qty || 1);
      });
    });
    const favoriteMenu =
      Object.entries(itemCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "-";

    return { totalOrders: orders.length, totalSpent, favoriteMenu };
  }, [orders]);

  const handleSaveProfile = async () => {
    if (!user?.uid) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        name: fullName.trim(),
        phone: phone.trim(),
      });
      setSaveMessage(t("profile.saved"));
    } catch (err) {
      console.error("Failed to save profile:", err);
      setSaveMessage(t("profile.saveFail"));
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user?.uid) return;

    setAvatarUploading(true);
    setAvatarError(null);
    try {
      // Flat "avatars/{file}" path (no nested uid subfolder) matches the existing
      // generic storage.rules catch-all (`/{folder}/{file}`: any authenticated
      // user, image, <5MB) with zero rules changes.
      const avatarRef = ref(storage, `avatars/${user.uid}_${file.name}`);
      await uploadBytes(avatarRef, file);
      const url = await getDownloadURL(avatarRef);
      await updateDoc(doc(db, "users", user.uid), { avatarUrl: url });
    } catch (err) {
      console.error("Failed to upload avatar:", err);
      setAvatarError(t("profile.avatarFail"));
    } finally {
      setAvatarUploading(false);
    }
  };

  if (loading) {
    return <Loading text={t("profile.loading")} />;
  }

  const displayName = profile?.name || user?.email || t("profile.customer");

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-8 space-y-6">
      {/* Profile Header */}
      <Card className="p-6 flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
        <label className="relative shrink-0 cursor-pointer group">
          {profile?.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt={displayName}
              className="w-20 h-20 rounded-full object-cover ring-4 ring-primary-light"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-primary-light text-primary flex items-center justify-center text-2xl font-black ring-4 ring-primary-light">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center border-2 border-white group-hover:bg-primary-dark transition-colors">
            <Camera size={14} />
          </div>
          <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        </label>
        <div className="flex-1">
          <h1 className="text-xl font-black text-gray-900">{displayName}</h1>
          <p className="text-sm text-gray-500 font-medium mt-1">{profile?.phone || "-"}</p>
          <p className="text-xs text-gray-400 font-medium mt-1">
            {t("profile.memberSince", { date: formatMemberSince(profile?.createdAt, language) })}
          </p>
          {avatarUploading && (
            <p className="text-xs text-primary font-bold mt-1">{t("profile.uploadingPhoto")}</p>
          )}
          {avatarError && <p className="text-xs text-secondary font-bold mt-1">{avatarError}</p>}
        </div>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={ShoppingBag} label={t("profile.totalOrders")} value={stats.totalOrders} />
        <StatCard icon={Wallet} label={t("profile.totalSpent")} value={`฿${stats.totalSpent.toLocaleString()}`} />
        <StatCard icon={Heart} label={t("profile.favoriteMenu")} value={stats.favoriteMenu} />
      </div>

      {/* Personal Information */}
      <Card className="p-6">
        <SectionTitle>{t("profile.personalInfo")}</SectionTitle>
        <div className="space-y-4">
          <Input label={t("profile.fullName")} value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <Input label={t("profile.phone")} value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input label={t("profile.email")} value={profile?.email || user?.email || "-"} readOnly disabled />
          <div className="flex items-center gap-3">
            <Button className="w-full sm:w-auto" onClick={handleSaveProfile} disabled={saving}>
              {saving ? t("profile.saving") : t("profile.save")}
            </Button>
            {saveMessage && (
              <span className="text-sm font-bold text-gray-500">{saveMessage}</span>
            )}
          </div>
        </div>
      </Card>

      {/* Delivery Addresses */}
      <Card className="p-6">
        <SectionTitle>{t("profile.deliveryAddresses")}</SectionTitle>
        <Link
          to="/shop/addresses"
          className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 hover:bg-primary-light/50 transition-colors"
        >
          <div className="p-3 rounded-2xl bg-white text-primary shrink-0">
            <MapPin size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-gray-900">{t("profile.manageAddresses")}</p>
            <p className="text-xs text-gray-500 font-medium mt-0.5">
              {t("profile.manageAddressesDesc")}
            </p>
          </div>
          <ChevronRight size={20} className="text-gray-300 shrink-0" />
        </Link>
      </Card>

      {/* Payment Methods */}
      <Card className="p-6">
        <SectionTitle>{t("profile.paymentMethods")}</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-gray-50">
            <Banknote size={20} className="text-primary" />
            <span className="font-bold text-sm text-gray-700">{t("payment.cash")}</span>
          </div>
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-gray-50">
            <QrCode size={20} className="text-primary" />
            <span className="font-bold text-sm text-gray-700">{t("payment.promptpay")}</span>
          </div>
        </div>
      </Card>

      {/* Danger Zone */}
      <Card className="p-6">
        <SectionTitle>{t("profile.dangerZone")}</SectionTitle>
        <Button
          variant="outline"
          className="w-full text-secondary border-secondary/30 hover:border-secondary"
          onClick={() => setLogoutOpen(true)}
        >
          <LogOut size={18} />
          {t("profile.logout")}
        </Button>
      </Card>

      <ConfirmDialog
        open={logoutOpen}
        title={t("profile.logout")}
        message={t("profile.logoutConfirm")}
        confirmText={t("profile.logout")}
        cancelText={t("addr.cancel")}
        onConfirm={() => {
          setLogoutOpen(false);
          logout();
        }}
        onCancel={() => setLogoutOpen(false)}
      />
    </div>
  );
};
