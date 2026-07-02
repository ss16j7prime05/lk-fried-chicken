import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot, updateDoc, collection, query, where } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  Home as HomeIcon,
  Banknote,
  QrCode,
  LogOut,
  ShoppingBag,
  Wallet,
  Heart,
  Camera,
  Plus,
  Trash2,
} from "lucide-react";
import { db, storage } from "../../firebase";
import { useAuth } from "../../AuthContext";
import { normalizeStatus } from "../../store/orderStatus";
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

const formatMemberSince = (timestamp) => {
  const d = timestamp?.toDate ? timestamp.toDate() : timestamp ? new Date(timestamp) : null;
  if (!d || Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
};

export const Profile = () => {
  const { user, logout } = useAuth();

  const [profile, setProfile] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);

  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState(null);

  const [newAddressLabel, setNewAddressLabel] = useState("");
  const [newAddressDetail, setNewAddressDetail] = useState("");
  const [addingAddress, setAddingAddress] = useState(false);

  const [logoutOpen, setLogoutOpen] = useState(false);

  // Real users/{uid} document — kept live so edits made here (or elsewhere) always
  // reflect immediately, without needing to touch AuthContext.
  useEffect(() => {
    if (!user?.uid) {
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

  // Same query shape as src/pages/customer/Orders.jsx — no orderBy() on purpose:
  // where("phone","==") + orderBy("createdAt") needs a composite Firestore index
  // that doesn't exist for this project.
  useEffect(() => {
    if (!profile?.phone) {
      setOrders([]);
      return;
    }
    const ordersQuery = query(collection(db, "orders"), where("phone", "==", profile.phone));
    const unsubscribe = onSnapshot(ordersQuery, (snapshot) => {
      setOrders(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, [profile?.phone]);

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

  const addresses = profile?.addresses ?? [];

  const handleSaveProfile = async () => {
    if (!user?.uid) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        name: fullName.trim(),
        phone: phone.trim(),
      });
      setSaveMessage("Saved!");
    } catch (err) {
      console.error("Failed to save profile:", err);
      setSaveMessage("Failed to save. Please try again.");
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
      setAvatarError("Failed to upload photo. Please try again.");
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleAddAddress = async () => {
    if (!user?.uid || !newAddressLabel.trim() || !newAddressDetail.trim()) return;
    setAddingAddress(true);
    try {
      const next = [...addresses, { label: newAddressLabel.trim(), detail: newAddressDetail.trim() }];
      await updateDoc(doc(db, "users", user.uid), { addresses: next });
      setNewAddressLabel("");
      setNewAddressDetail("");
    } catch (err) {
      console.error("Failed to add address:", err);
    } finally {
      setAddingAddress(false);
    }
  };

  const handleRemoveAddress = async (index) => {
    if (!user?.uid) return;
    const next = addresses.filter((_, i) => i !== index);
    try {
      await updateDoc(doc(db, "users", user.uid), { addresses: next });
    } catch (err) {
      console.error("Failed to remove address:", err);
    }
  };

  if (loading) {
    return <Loading text="Loading your profile..." />;
  }

  const displayName = profile?.name || user?.email || "Customer";

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
            Member since {formatMemberSince(profile?.createdAt)}
          </p>
          {avatarUploading && (
            <p className="text-xs text-primary font-bold mt-1">Uploading photo...</p>
          )}
          {avatarError && <p className="text-xs text-secondary font-bold mt-1">{avatarError}</p>}
        </div>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={ShoppingBag} label="Total Orders" value={stats.totalOrders} />
        <StatCard icon={Wallet} label="Total Spent" value={`฿${stats.totalSpent.toLocaleString()}`} />
        <StatCard icon={Heart} label="Favorite Menu" value={stats.favoriteMenu} />
      </div>

      {/* Personal Information */}
      <Card className="p-6">
        <SectionTitle>Personal Information</SectionTitle>
        <div className="space-y-4">
          <Input label="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input label="Email" value={profile?.email || user?.email || "-"} readOnly disabled />
          <div className="flex items-center gap-3">
            <Button className="w-full sm:w-auto" onClick={handleSaveProfile} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
            {saveMessage && (
              <span className="text-sm font-bold text-gray-500">{saveMessage}</span>
            )}
          </div>
        </div>
      </Card>

      {/* Delivery Addresses */}
      <Card className="p-6">
        <SectionTitle>Delivery Addresses</SectionTitle>
        <div className="space-y-3">
          {addresses.length === 0 && (
            <p className="text-sm text-gray-400 font-medium">No saved addresses yet.</p>
          )}
          {addresses.map((addr, index) => (
            <div
              key={`${addr.label}-${index}`}
              className="flex items-start gap-3 p-4 rounded-2xl bg-gray-50"
            >
              <div className="p-2 rounded-xl bg-white text-primary shrink-0">
                <HomeIcon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-gray-900">{addr.label}</p>
                <p className="text-xs text-gray-500 font-medium mt-0.5">{addr.detail}</p>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveAddress(index)}
                className="text-gray-300 hover:text-secondary transition-colors shrink-0"
                aria-label={`Remove ${addr.label}`}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Input
              placeholder="Label (e.g. Home)"
              value={newAddressLabel}
              onChange={(e) => setNewAddressLabel(e.target.value)}
              className="sm:w-40"
            />
            <Input
              placeholder="Address detail"
              value={newAddressDetail}
              onChange={(e) => setNewAddressDetail(e.target.value)}
              className="flex-1"
            />
            <Button
              variant="outline"
              onClick={handleAddAddress}
              disabled={addingAddress || !newAddressLabel.trim() || !newAddressDetail.trim()}
            >
              <Plus size={18} />
              Add
            </Button>
          </div>
        </div>
      </Card>

      {/* Payment Methods */}
      <Card className="p-6">
        <SectionTitle>Payment Methods</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-gray-50">
            <Banknote size={20} className="text-primary" />
            <span className="font-bold text-sm text-gray-700">Cash</span>
          </div>
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-gray-50">
            <QrCode size={20} className="text-primary" />
            <span className="font-bold text-sm text-gray-700">PromptPay</span>
          </div>
        </div>
      </Card>

      {/* Danger Zone */}
      <Card className="p-6">
        <SectionTitle>Danger Zone</SectionTitle>
        <Button
          variant="outline"
          className="w-full text-secondary border-secondary/30 hover:border-secondary"
          onClick={() => setLogoutOpen(true)}
        >
          <LogOut size={18} />
          Logout
        </Button>
      </Card>

      <ConfirmDialog
        open={logoutOpen}
        title="Logout"
        message="Are you sure you want to logout?"
        confirmText="Logout"
        cancelText="Cancel"
        onConfirm={() => {
          setLogoutOpen(false);
          logout();
        }}
        onCancel={() => setLogoutOpen(false)}
      />
    </div>
  );
};
