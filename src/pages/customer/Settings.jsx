import { useEffect, useState } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import {
  Bell,
  Moon,
  Sun,
  Globe,
  Info,
  Shield,
  FileText,
  Phone,
  ChevronRight,
} from "lucide-react";
import { db } from "../../firebase";
import { useAuth } from "../../AuthContext";
import { STORE_PHONE, PROMPTPAY_ACCOUNT_NAME } from "../../config";
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

const InfoModal = ({ open, onClose, title, children }) => (
  <Modal open={open} onClose={onClose} className="max-w-lg max-h-[80vh] overflow-y-auto">
    <div className="p-6 sm:p-8 space-y-4">
      <h2 className="text-xl font-black text-gray-900">{title}</h2>
      <div className="text-sm text-gray-500 space-y-3 leading-relaxed">{children}</div>
      <Button variant="outline" className="w-full" onClick={onClose}>
        Close
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

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState(null); // 'about' | 'privacy' | 'terms' | null

  useEffect(() => {
    if (!user?.uid) {
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
    window.location.href = `tel:${STORE_PHONE}`;
  };

  if (loading) {
    return <Loading text="Loading settings..." />;
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-8 space-y-6">
      <h1 className="text-2xl font-black text-gray-900">Settings</h1>

      {/* Notification Preferences */}
      <Card className="p-6">
        <SectionTitle>Notification Preferences</SectionTitle>
        <SettingRow
          icon={Bell}
          label="Order Updates"
          description="Status changes for your orders"
          control={
            <Toggle
              checked={settings.notifyOrderUpdates}
              onChange={(v) => saveSetting({ notifyOrderUpdates: v })}
            />
          }
        />
        <SettingRow
          icon={Bell}
          label="Promotions"
          description="Deals and special offers"
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
                    settings.theme === option
                      ? "bg-primary text-white"
                      : "text-gray-500"
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
                    settings.language === option.value
                      ? "bg-primary text-white"
                      : "text-gray-500"
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
        <SectionTitle>Support & Legal</SectionTitle>
        <LinkRow icon={Phone} label="Contact Store" onClick={handleContactStore} />
        <LinkRow icon={Info} label="About" onClick={() => setActiveModal("about")} />
        <LinkRow icon={Shield} label="Privacy Policy" onClick={() => setActiveModal("privacy")} />
        <LinkRow icon={FileText} label="Terms of Service" onClick={() => setActiveModal("terms")} />
      </Card>

      <InfoModal
        open={activeModal === "about"}
        onClose={() => setActiveModal(null)}
        title="About"
      >
        <p>
          <span className="font-bold text-gray-900">{PROMPTPAY_ACCOUNT_NAME}</span> — online
          ordering, delivery, and pickup.
        </p>
        <p>Version 1.0.0</p>
        <p>
          Questions or feedback? Call the store at{" "}
          <a href={`tel:${STORE_PHONE}`} className="text-primary font-bold">
            {STORE_PHONE}
          </a>
          .
        </p>
      </InfoModal>

      <InfoModal
        open={activeModal === "privacy"}
        onClose={() => setActiveModal(null)}
        title="Privacy Policy"
      >
        <p>
          We collect the information you provide when you order — your name, phone number,
          delivery address, and location — solely to prepare, deliver, and track your order.
        </p>
        <p>
          If you pay by PromptPay or bank transfer, the payment slip image you upload is used
          only to verify your payment.
        </p>
        <p>
          Your order history is only visible to your own account, matched by your phone
          number. We do not sell your personal information to third parties.
        </p>
        <p>Contact the store directly with any privacy questions or requests.</p>
      </InfoModal>

      <InfoModal
        open={activeModal === "terms"}
        onClose={() => setActiveModal(null)}
        title="Terms of Service"
      >
        <p>
          By placing an order, you confirm the delivery details and items in your cart are
          correct. Prices, delivery fees, and availability are set by the store and may change
          without notice.
        </p>
        <p>
          Orders may be cancelled by the store if items are unavailable or delivery isn't
          possible. Refunds for cancelled paid orders are handled by the store directly.
        </p>
        <p>
          Please contact the store for any order issues or disputes.
        </p>
      </InfoModal>
    </div>
  );
};
