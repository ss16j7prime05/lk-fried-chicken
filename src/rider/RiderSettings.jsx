import { useEffect, useState } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { Link } from "react-router-dom";
import {
  Bell,
  Bike,
  ChevronRight,
  Globe,
  History,
  IdCard,
  Info,
  Landmark,
  LogOut,
  Moon,
  Package,
  Phone,
  Sun,
  User,
} from "lucide-react";
import { db } from "../firebase";
import { useAuth } from "../AuthContext.jsx";
import { STORE_PHONE, PROMPTPAY_ACCOUNT_NAME } from "../config";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Loading } from "../components/ui/Loading";

const SectionTitle = ({ children }) => (
  <h2 className="text-base font-black text-gray-900 mb-4">{children}</h2>
);

const Toggle = ({ checked, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${
      checked ? "bg-primary" : "bg-gray-200"
    }`}
  >
    <span
      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-soft transition-transform ${
        checked ? "translate-x-5" : "translate-x-0"
      }`}
    />
  </button>
);

const SettingRow = ({ icon: Icon, label, description, control }) => (
  <div className="flex items-center justify-between gap-3 py-3 border-b border-gray-50 last:border-0">
    <div className="flex items-center gap-3 min-w-0">
      <Icon size={18} className="text-gray-400 shrink-0" />
      <div className="min-w-0">
        <p className="font-bold text-gray-700 text-sm">{label}</p>
        {description && (
          <p className="text-xs text-gray-400 font-medium mt-0.5">{description}</p>
        )}
      </div>
    </div>
    {control}
  </div>
);

const InfoRow = ({ icon: Icon, label, value }) => (
  <SettingRow
    icon={Icon}
    label={label}
    control={<span className="font-bold text-gray-900 text-sm text-right">{value}</span>}
  />
);

const LinkRow = ({ icon: Icon, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full flex items-center justify-between gap-3 py-3 border-b border-gray-50 last:border-0"
  >
    <div className="flex items-center gap-3">
      <Icon size={18} className="text-gray-400" />
      <span className="font-bold text-gray-700 text-sm">{label}</span>
    </div>
    <ChevronRight size={16} className="text-gray-300" />
  </button>
);

const vehicleLabel = (v) =>
  v === "car" ? "รถยนต์" : v === "motorcycle" ? "มอเตอร์ไซค์" : v === "bicycle" ? "จักรยาน" : v || "-";

// โชว์เฉพาะเลขท้ายบัญชี ป้องกันเลขเต็มค้างบนหน้าจอ
const maskAccountNumber = (num) => {
  if (!num) return "-";
  const s = String(num);
  return s.length <= 4 ? s : `•••• ${s.slice(-4)}`;
};

// ค่าเริ่มต้นเมื่อยังไม่เคยบันทึก preference — ฟิลด์เดียวกับที่ Customer Settings ใช้บน users/{uid}
const DEFAULT_SETTINGS = {
  notifyOrderUpdates: true,
  theme: "light",
  language: "en",
};

// Rider Settings: ความพร้อมรับงาน + การแจ้งเตือน + ธีม/ภาษา + ข้อมูลรถและบัญชีรับเงิน (อ่านอย่างเดียว)
export default function RiderSettings() {
  const { user, profile, logout } = useAuth();

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [riderStatus, setRiderStatus] = useState("offline");
  const [vehicle, setVehicle] = useState({});
  const [bank, setBank] = useState({});
  const [loading, setLoading] = useState(() => Boolean(user?.uid));
  const [aboutOpen, setAboutOpen] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    const unsubscribe = onSnapshot(doc(db, "users", user.uid), (snap) => {
      const data = snap.exists() ? snap.data() : {};
      setSettings({
        notifyOrderUpdates: data.notifyOrderUpdates ?? DEFAULT_SETTINGS.notifyOrderUpdates,
        theme: data.theme ?? DEFAULT_SETTINGS.theme,
        language: data.language ?? DEFAULT_SETTINGS.language,
      });
      setRiderStatus(data.riderStatus || "offline");
      setVehicle({
        type: data.vehicleType,
        brand: data.vehicleBrand,
        model: data.vehicleModel,
        color: data.vehicleColor,
        licensePlate: data.licensePlate,
      });
      setBank({
        bankName: data.bankName,
        accountName: data.accountName,
        accountNumber: data.accountNumber,
      });
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user?.uid]);

  // ทุกค่าบันทึกทันทีลง users/{uid} (เอกสารเดียวกับที่ Profile อ่านอยู่แล้ว ไม่แตะฟิลด์ status)
  const saveSetting = (patch) => {
    setSettings((prev) => ({ ...prev, ...patch }));
    if (!user?.uid) return;
    updateDoc(doc(db, "users", user.uid), patch).catch((err) => {
      console.error("Failed to save setting:", err);
    });
  };

  const saveRiderStatus = (online) => {
    const next = online ? "online" : "offline";
    setRiderStatus(next);
    if (!user?.uid) return;
    updateDoc(doc(db, "users", user.uid), { riderStatus: next }).catch((err) => {
      console.error("Failed to save rider status:", err);
    });
  };

  if (loading) {
    return <Loading text="Loading settings..." />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto p-4 sm:p-8 space-y-6">
        {/* header — same pattern as RiderOrdersDashboard / RiderProfile */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-2xl font-black text-gray-900">Rider Settings</h1>
          <div className="flex gap-2">
            <Link to="/rider">
              <Button variant="outline" className="!px-4 !py-2 text-sm">
                <Package size={16} />
                Jobs
              </Button>
            </Link>
            <Link to="/rider/profile">
              <Button variant="outline" className="!px-4 !py-2 text-sm">
                <User size={16} />
                Profile
              </Button>
            </Link>
            <Link to="/rider/history">
              <Button variant="outline" className="!px-4 !py-2 text-sm">
                <History size={16} />
                History
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

        {/* Availability */}
        <Card className="p-6">
          <SectionTitle>Availability</SectionTitle>
          <SettingRow
            icon={Bike}
            label="Ready for Deliveries"
            description={riderStatus === "online" ? "You appear as online" : "You appear as offline"}
            control={
              <Toggle checked={riderStatus === "online"} onChange={saveRiderStatus} />
            }
          />
        </Card>

        {/* Notifications */}
        <Card className="p-6">
          <SectionTitle>Notifications</SectionTitle>
          <SettingRow
            icon={Bell}
            label="Order Updates"
            description="Status changes for your deliveries"
            control={
              <Toggle
                checked={settings.notifyOrderUpdates}
                onChange={(v) => saveSetting({ notifyOrderUpdates: v })}
              />
            }
          />
        </Card>

        {/* Appearance */}
        <Card className="p-6">
          <SectionTitle>Appearance</SectionTitle>
          <SettingRow
            icon={settings.theme === "dark" ? Moon : Sun}
            label="Theme"
            description="Saved to your account"
            control={
              <div className="flex gap-1 bg-gray-50 rounded-2xl p-1">
                {["light", "dark"].map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => saveSetting({ theme: option })}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${
                      settings.theme === option ? "bg-primary text-white" : "text-gray-500"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            }
          />
          <SettingRow
            icon={Globe}
            label="Language"
            description="Saved to your account"
            control={
              <div className="flex gap-1 bg-gray-50 rounded-2xl p-1">
                {[
                  { value: "en", label: "EN" },
                  { value: "th", label: "TH" },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => saveSetting({ language: option.value })}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      settings.language === option.value ? "bg-primary text-white" : "text-gray-500"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            }
          />
        </Card>

        {/* Vehicle (read-only, from registration) */}
        <Card className="p-6">
          <SectionTitle>Vehicle</SectionTitle>
          <InfoRow icon={Bike} label="Type" value={vehicleLabel(vehicle.type)} />
          <InfoRow
            icon={Info}
            label="Model"
            value={[vehicle.brand, vehicle.model, vehicle.color].filter(Boolean).join(" · ") || "-"}
          />
          <InfoRow icon={IdCard} label="License Plate" value={vehicle.licensePlate || "-"} />
        </Card>

        {/* Payout account (read-only, from registration) */}
        <Card className="p-6">
          <SectionTitle>Payout Account</SectionTitle>
          <InfoRow icon={Landmark} label="Bank" value={bank.bankName || "-"} />
          <InfoRow icon={User} label="Account Name" value={bank.accountName || "-"} />
          <InfoRow icon={IdCard} label="Account Number" value={maskAccountNumber(bank.accountNumber)} />
        </Card>

        {/* Support */}
        <Card className="p-6">
          <SectionTitle>Support</SectionTitle>
          <LinkRow
            icon={Phone}
            label="Contact Store"
            onClick={() => {
              window.location.href = `tel:${STORE_PHONE}`;
            }}
          />
          <LinkRow icon={Info} label="About" onClick={() => setAboutOpen(true)} />
        </Card>

        <Modal open={aboutOpen} onClose={() => setAboutOpen(false)} className="max-w-lg">
          <div className="p-6 sm:p-8 space-y-4">
            <h2 className="text-xl font-black text-gray-900">About</h2>
            <div className="text-sm text-gray-500 space-y-3 leading-relaxed">
              <p>
                <span className="font-bold text-gray-900">{PROMPTPAY_ACCOUNT_NAME}</span> — rider
                app for deliveries.
              </p>
              <p>
                Signed in as{" "}
                <span className="font-bold text-gray-900">
                  {profile?.name || profile?.riderName || "-"}
                </span>
              </p>
              <p>
                Questions? Call the store at{" "}
                <a href={`tel:${STORE_PHONE}`} className="text-primary font-bold">
                  {STORE_PHONE}
                </a>
                .
              </p>
            </div>
            <Button variant="outline" className="w-full" onClick={() => setAboutOpen(false)}>
              Close
            </Button>
          </div>
        </Modal>
      </div>
    </div>
  );
}
