import { useEffect, useState } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import {
  Bell,
  Moon,
  Sun,
  Monitor,
  Globe,
  Info,
  Shield,
  FileText,
  Phone,
  ChevronRight,
} from "lucide-react";
import { db } from "../../firebase";
import { useAuth } from "../../AuthContext";
import { usePreferences } from "../../context/PreferencesContext";
import { useStore } from "../../store/useStore";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { Loading } from "../../components/ui/Loading";

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

const InfoModal = ({ open, onClose, title, closeLabel, children }) => (
  <Modal open={open} onClose={onClose} className="max-w-lg max-h-[80vh] overflow-y-auto">
    <div className="p-6 sm:p-8 space-y-4">
      <h2 className="text-xl font-black text-gray-900">{title}</h2>
      <div className="text-sm text-gray-500 space-y-3 leading-relaxed">{children}</div>
      <Button variant="outline" className="w-full" onClick={onClose}>
        {closeLabel}
      </Button>
    </div>
  </Modal>
);

// Defaults applied whenever a preference hasn't been saved yet — these are the
// "real settings" starting values for every customer document, not mock data.
const DEFAULT_SETTINGS = {
  notifyOrderUpdates: true,
  notifyPromotions: true,
  theme: "light",
  language: "en",
};

export const Settings = () => {
  const { user } = useAuth();
  // Theme/language come from PreferencesContext (applies app-wide instantly and
  // persists to localStorage + users/{uid}); this page only renders the controls.
  const { theme, setTheme, language, setLanguage, t } = usePreferences();
  const store = useStore(); // live stores/{STORE_ID} — single source of truth
  const storeName = store?.storeName || "LK Fried Chicken";
  const storePhone = store?.phone || ""; // เบอร์ร้านจาก Firestore เท่านั้น — ไม่มี placeholder

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState(null); // 'about' | 'privacy' | 'terms' | null

  useEffect(() => {
    if (!user?.uid) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }
    const unsubscribe = onSnapshot(doc(db, "users", user.uid), (snap) => {
      const data = snap.exists() ? snap.data() : {};
      setSettings({
        notifyOrderUpdates: data.notifyOrderUpdates ?? DEFAULT_SETTINGS.notifyOrderUpdates,
        notifyPromotions: data.notifyPromotions ?? DEFAULT_SETTINGS.notifyPromotions,
        theme: data.theme ?? DEFAULT_SETTINGS.theme,
        language: data.language ?? DEFAULT_SETTINGS.language,
      });
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user?.uid]);

  // Every preference saves immediately to users/{uid} — the same document
  // Profile.jsx already reads/writes, no new collection or rule involved.
  const saveSetting = (patch) => {
    setSettings((prev) => ({ ...prev, ...patch }));
    if (!user?.uid) return;
    updateDoc(doc(db, "users", user.uid), patch).catch((err) => {
      console.error("Failed to save setting:", err);
    });
  };

  const handleContactStore = () => {
    // โทรเบอร์ร้านจาก Firestore เท่านั้น — ไม่มีเบอร์ = ไม่โทร (ไม่โทร placeholder)
    if (storePhone) window.location.href = `tel:${storePhone}`;
  };

  if (loading) {
    return <Loading text={t("common.loading")} />;
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-8 space-y-6">
      <h1 className="text-2xl font-black text-gray-900">{t("settings.title")}</h1>

      {/* Notification Preferences */}
      <Card className="p-6">
        <SectionTitle>{t("settings.notifications")}</SectionTitle>
        <SettingRow
          icon={Bell}
          label={t("settings.orderUpdates")}
          description={t("settings.orderUpdatesDesc")}
          control={
            <Toggle
              checked={settings.notifyOrderUpdates}
              onChange={(v) => saveSetting({ notifyOrderUpdates: v })}
            />
          }
        />
        <SettingRow
          icon={Bell}
          label={t("settings.promotions")}
          description={t("settings.promotionsDesc")}
          control={
            <Toggle
              checked={settings.notifyPromotions}
              onChange={(v) => saveSetting({ notifyPromotions: v })}
            />
          }
        />
      </Card>

      {/* Appearance */}
      <Card className="p-6">
        <SectionTitle>{t("settings.appearance")}</SectionTitle>
        <SettingRow
          icon={theme === "dark" ? Moon : theme === "system" ? Monitor : Sun}
          label={t("settings.theme")}
          description={t("settings.themeDesc")}
          control={
            <div className="flex gap-1 bg-gray-50 rounded-2xl p-1">
              {["light", "dark", "system"].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setTheme(option)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    theme === option ? "bg-primary text-white" : "text-gray-500"
                  }`}
                >
                  {t(`settings.${option}`)}
                </button>
              ))}
            </div>
          }
        />
        <SettingRow
          icon={Globe}
          label={t("settings.language")}
          description={t("settings.languageDesc")}
          control={
            <div className="flex gap-1 bg-gray-50 rounded-2xl p-1">
              {[
                { value: "en", label: "EN" },
                { value: "th", label: "TH" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setLanguage(option.value)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    language === option.value ? "bg-primary text-white" : "text-gray-500"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          }
        />
      </Card>

      {/* Support & Legal */}
      <Card className="p-6">
        <SectionTitle>{t("settings.support")}</SectionTitle>
        <LinkRow icon={Phone} label={t("settings.contactStore")} onClick={handleContactStore} />
        <LinkRow icon={Info} label={t("settings.about")} onClick={() => setActiveModal("about")} />
        <LinkRow icon={Shield} label={t("settings.privacy")} onClick={() => setActiveModal("privacy")} />
        <LinkRow icon={FileText} label={t("settings.terms")} onClick={() => setActiveModal("terms")} />
      </Card>

      <InfoModal
        open={activeModal === "about"}
        onClose={() => setActiveModal(null)}
        title={t("settings.about")}
        closeLabel={t("common.close")}
      >
        <p>{t("settings.aboutBody", { name: storeName })}</p>
        <p>{t("settings.version")}</p>
        <p>
          {t("settings.aboutContact")}{" "}
          {storePhone ? (
            <a href={`tel:${storePhone}`} className="text-primary font-bold">
              {storePhone}
            </a>
          ) : (
            <span className="text-gray-400 font-bold">-</span>
          )}
        </p>
      </InfoModal>

      <InfoModal
        open={activeModal === "privacy"}
        onClose={() => setActiveModal(null)}
        title={t("settings.privacy")}
        closeLabel={t("common.close")}
      >
        <p>{t("settings.privacy1")}</p>
        <p>{t("settings.privacy2")}</p>
        <p>{t("settings.privacy3")}</p>
        <p>{t("settings.privacy4")}</p>
      </InfoModal>

      <InfoModal
        open={activeModal === "terms"}
        onClose={() => setActiveModal(null)}
        title={t("settings.terms")}
        closeLabel={t("common.close")}
      >
        <p>{t("settings.terms1")}</p>
        <p>{t("settings.terms2")}</p>
        <p>{t("settings.terms3")}</p>
      </InfoModal>
    </div>
  );
};
