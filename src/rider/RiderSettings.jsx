import { useEffect, useState } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import {
  Bell,
  Bike,
  ChevronRight,
  Globe,
  IdCard,
  Info,
  Landmark,
  LogOut,
  Moon,
  Phone,
  Sun,
  User,
} from "lucide-react";
import { db } from "../firebase";
import { useAuth } from "../AuthContext.jsx";
import { usePreferences } from "../context/PreferencesContext";
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
    control={<span className="font-bold text-gray-900 text-sm text-right truncate max-w-[45%]">{value}</span>}
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

// Segmented control reused for Theme + Language (single primitive, no duplication).
const Segmented = ({ options, value, onChange }) => (
  <div className="flex gap-1 bg-gray-50 rounded-2xl p-1">
    {options.map((opt) => (
      <button
        key={opt.value}
        type="button"
        onClick={() => onChange(opt.value)}
        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
          value === opt.value ? "bg-primary text-white" : "text-gray-500"
        }`}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

const vehicleLabel = (v, t) =>
  v === "car" ? t("ro.vehicle.car") : v === "motorcycle" ? t("ro.vehicle.motorcycle") : v === "bicycle" ? t("ro.vehicle.bicycle") : v || "-";

// โชว์เฉพาะเลขท้ายบัญชี ป้องกันเลขเต็มค้างบนหน้าจอ
const maskAccountNumber = (num) => {
  if (!num) return "-";
  const s = String(num);
  return s.length <= 4 ? s : `•••• ${s.slice(-4)}`;
};

// Rider Settings: ความพร้อมรับงาน + การแจ้งเตือน + ธีม/ภาษา + ข้อมูลรถและบัญชีรับเงิน (อ่านอย่างเดียว)
// ธีม/ภาษา อ่าน-เขียนผ่าน PreferencesContext (SSOT) — ใช้ทันทีทั้งแอป, เก็บลง users/{uid},
// และคืนค่าหลังรีเฟรชโดยอัตโนมัติ (onSnapshot ใน context)
export default function RiderSettings() {
  const { user, profile, logout } = useAuth();
  const { t, theme, setTheme, language, setLanguage } = usePreferences();

  const [notifyOrderUpdates, setNotifyOrderUpdates] = useState(true);
  const [riderStatus, setRiderStatus] = useState("offline");
  const [vehicle, setVehicle] = useState({});
  const [bank, setBank] = useState({});
  const [loading, setLoading] = useState(() => Boolean(user?.uid));
  const [aboutOpen, setAboutOpen] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    const unsubscribe = onSnapshot(doc(db, "users", user.uid), (snap) => {
      const data = snap.exists() ? snap.data() : {};
      setNotifyOrderUpdates(data.notifyOrderUpdates ?? true);
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

  // ค่าที่ไม่ใช่ธีม/ภาษา บันทึกตรงลง users/{uid} (เอกสารเดียวกับที่ Profile อ่าน ไม่แตะ status)
  const saveField = (patch) => {
    if (!user?.uid) return;
    updateDoc(doc(db, "users", user.uid), patch).catch((err) => {
      console.error("Failed to save setting:", err);
    });
  };

  const setNotify = (v) => {
    setNotifyOrderUpdates(v);
    saveField({ notifyOrderUpdates: v });
  };

  const saveRiderStatus = (online) => {
    const next = online ? "online" : "offline";
    setRiderStatus(next);
    saveField({ riderStatus: next });
  };

  if (loading) {
    return <Loading text={t("ro.loading.settings")} />;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-black text-gray-900">{t("ro.settings.title")}</h1>

      {/* Availability */}
      <Card className="p-6">
        <SectionTitle>{t("ro.availability")}</SectionTitle>
        <SettingRow
          icon={Bike}
          label={t("ro.readyForDeliveries")}
          description={riderStatus === "online" ? t("ro.appearOnline") : t("ro.appearOffline")}
          control={<Toggle checked={riderStatus === "online"} onChange={saveRiderStatus} />}
        />
      </Card>

      {/* Notifications */}
      <Card className="p-6">
        <SectionTitle>{t("ro.notifications")}</SectionTitle>
        <SettingRow
          icon={Bell}
          label={t("ro.orderUpdates")}
          description={t("ro.orderUpdatesDesc")}
          control={<Toggle checked={notifyOrderUpdates} onChange={setNotify} />}
        />
      </Card>

      {/* Appearance — theme + language via PreferencesContext (applies instantly, persists) */}
      <Card className="p-6">
        <SectionTitle>{t("ro.appearance")}</SectionTitle>
        <SettingRow
          icon={theme === "dark" ? Moon : Sun}
          label={t("ro.theme")}
          description={t("ro.savedToAccount")}
          control={
            <Segmented
              value={theme === "dark" ? "dark" : "light"}
              onChange={setTheme}
              options={[
                { value: "light", label: t("ro.light") },
                { value: "dark", label: t("ro.dark") },
              ]}
            />
          }
        />
        <SettingRow
          icon={Globe}
          label={t("ro.language")}
          description={t("ro.savedToAccount")}
          control={
            <Segmented
              value={language}
              onChange={setLanguage}
              options={[
                { value: "en", label: "EN" },
                { value: "th", label: "TH" },
              ]}
            />
          }
        />
      </Card>

      {/* Vehicle (read-only, from registration) */}
      <Card className="p-6">
        <SectionTitle>{t("ro.vehicleSection")}</SectionTitle>
        <InfoRow icon={Bike} label={t("ro.type")} value={vehicleLabel(vehicle.type, t)} />
        <InfoRow
          icon={Info}
          label={t("ro.model")}
          value={[vehicle.brand, vehicle.model, vehicle.color].filter(Boolean).join(" · ") || "-"}
        />
        <InfoRow icon={IdCard} label={t("ro.licensePlate")} value={vehicle.licensePlate || "-"} />
      </Card>

      {/* Payout account (read-only, from registration) */}
      <Card className="p-6">
        <SectionTitle>{t("ro.payout")}</SectionTitle>
        <InfoRow icon={Landmark} label={t("ro.bank")} value={bank.bankName || "-"} />
        <InfoRow icon={User} label={t("ro.accountName")} value={bank.accountName || "-"} />
        <InfoRow icon={IdCard} label={t("ro.accountNumber")} value={maskAccountNumber(bank.accountNumber)} />
      </Card>

      {/* Support */}
      <Card className="p-6">
        <SectionTitle>{t("ro.support")}</SectionTitle>
        <LinkRow
          icon={Phone}
          label={t("ro.contactStore")}
          onClick={() => {
            window.location.href = `tel:${STORE_PHONE}`;
          }}
        />
        <LinkRow icon={Info} label={t("ro.about")} onClick={() => setAboutOpen(true)} />
      </Card>

      {/* Logout — kept here so mobile riders (bottom nav has no logout) can sign out */}
      <Button
        variant="outline"
        className="w-full text-secondary border-secondary/30 hover:border-secondary"
        onClick={logout}
      >
        <LogOut size={18} />
        {t("ro.logout")}
      </Button>

      <Modal open={aboutOpen} onClose={() => setAboutOpen(false)} className="max-w-lg">
        <div className="p-6 sm:p-8 space-y-4">
          <h2 className="text-xl font-black text-gray-900">{t("ro.about")}</h2>
          <div className="text-sm text-gray-500 space-y-3 leading-relaxed">
            <p>
              <span className="font-bold text-gray-900">{PROMPTPAY_ACCOUNT_NAME}</span> — {t("ro.aboutRiderApp")}
            </p>
            <p>
              {t("ro.signedInAs")}{" "}
              <span className="font-bold text-gray-900">
                {profile?.name || profile?.riderName || "-"}
              </span>
            </p>
            <p>
              {t("ro.questionsCall")}{" "}
              <a href={`tel:${STORE_PHONE}`} className="text-primary font-bold">
                {STORE_PHONE}
              </a>
              .
            </p>
          </div>
          <Button variant="outline" className="w-full" onClick={() => setAboutOpen(false)}>
            {t("ro.close")}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
