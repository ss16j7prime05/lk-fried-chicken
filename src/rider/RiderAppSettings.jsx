import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { ArrowLeft, Bell, Volume2, Zap, Sun, Moon, Globe } from "lucide-react";
import { db } from "../firebase";
import { useAuth } from "../AuthContext.jsx";
import { usePreferences } from "../context/PreferencesContext";
import { logError } from "../errorCenter";
import { Card } from "../components/ui/Card";
import { Loading } from "../components/ui/Loading";

const Toggle = ({ checked, onChange }) => (
  <button
    type="button"
    aria-pressed={checked}
    onClick={() => onChange(!checked)}
    className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${checked ? "bg-primary" : "bg-gray-200"}`}
  >
    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-soft transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`} />
  </button>
);

const Row = ({ icon: Icon, label, description, control }) => (
  <div className="flex items-center justify-between gap-3 py-3.5 border-b border-gray-50 last:border-0">
    <div className="flex items-start gap-3 min-w-0">
      <Icon size={18} className="text-gray-400 shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="font-bold text-gray-800 text-sm">{label}</p>
        {description && <p className="text-xs text-gray-400 font-medium mt-0.5">{description}</p>}
      </div>
    </div>
    {control}
  </div>
);

const Segmented = ({ options, value, onChange }) => (
  <div className="flex gap-1 bg-gray-50 rounded-2xl p-1 shrink-0">
    {options.map((opt) => (
      <button
        key={opt.value}
        type="button"
        onClick={() => onChange(opt.value)}
        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${value === opt.value ? "bg-primary text-white" : "text-gray-500"}`}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

// App Settings — new-job notification, notification sound, auto-accept (persisted to the
// rider's users/{uid} doc, additive fields) + theme/language via PreferencesContext.
export default function RiderAppSettings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, theme, setTheme, language, setLanguage } = usePreferences();

  const [notifyNewJob, setNotifyNewJob] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoAccept, setAutoAccept] = useState(false);
  const [loading, setLoading] = useState(() => Boolean(user?.uid));

  useEffect(() => {
    if (!user?.uid) return undefined;
    const unsub = onSnapshot(
      doc(db, "users", user.uid),
      (snap) => {
        const d = snap.exists() ? snap.data() : {};
        setNotifyNewJob(d.notifyNewJob ?? d.notifyOrderUpdates ?? true);
        setSoundEnabled(d.notifSoundEnabled ?? true);
        setAutoAccept(d.autoAccept ?? false);
        setLoading(false);
      },
      (err) => { logError(err, "RiderAppSettings"); setLoading(false); }
    );
    return () => unsub();
  }, [user?.uid]);

  const save = (patch) => {
    if (!user?.uid) return;
    updateDoc(doc(db, "users", user.uid), patch).catch((e) => logError(e, "RiderAppSettings.save"));
  };
  const toggle = (setter, field) => (v) => { setter(v); save({ [field]: v }); };

  if (loading) return <Loading text={t("ro.loading.settings")} />;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button onClick={() => navigate("/rider/settings")} className="flex items-center gap-2 text-lg font-black text-gray-900 hover:text-primary">
        <ArrowLeft size={20} /> {t("ro.menu.appSettings")}
      </button>

      <Card className="p-5">
        <p className="text-sm font-black text-gray-700 mb-1">{t("ro.notifications")}</p>
        <Row icon={Bell} label={t("ro.app.newJob")} description={t("ro.app.newJobDesc")} control={<Toggle checked={notifyNewJob} onChange={toggle(setNotifyNewJob, "notifyNewJob")} />} />
        <Row icon={Volume2} label={t("ro.app.sound")} description={t("ro.app.soundDesc")} control={<Toggle checked={soundEnabled} onChange={toggle(setSoundEnabled, "notifSoundEnabled")} />} />
      </Card>

      <Card className="p-5">
        <p className="text-sm font-black text-gray-700 mb-1">{t("ro.app.jobResponse")}</p>
        <Row icon={Zap} label={t("ro.app.autoAccept")} description={t("ro.app.autoAcceptDesc")} control={<Toggle checked={autoAccept} onChange={toggle(setAutoAccept, "autoAccept")} />} />
      </Card>

      <Card className="p-5">
        <p className="text-sm font-black text-gray-700 mb-1">{t("ro.appearance")}</p>
        <Row
          icon={theme === "dark" ? Moon : Sun}
          label={t("ro.theme")}
          control={<Segmented value={theme === "dark" ? "dark" : "light"} onChange={setTheme} options={[{ value: "light", label: t("ro.light") }, { value: "dark", label: t("ro.dark") }]} />}
        />
        <Row
          icon={Globe}
          label={t("ro.language")}
          control={<Segmented value={language} onChange={setLanguage} options={[{ value: "en", label: "EN" }, { value: "th", label: "TH" }]} />}
        />
      </Card>
    </div>
  );
}
