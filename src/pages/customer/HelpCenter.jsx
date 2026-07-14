import { useEffect, useState } from "react";
import {
  ChevronDown,
  Phone,
  MessageCircle,
  AlertTriangle,
  Info,
  HelpCircle,
} from "lucide-react";
import { STORE_PHONE } from "../../config";
import { getStore } from "./getStore";
import { useStore } from "../../store/useStore";
import { usePreferences } from "../../context/PreferencesContext";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import MapButton from "../../location/MapButton.jsx";

// Fallback store coordinates, used only until stores/{STORE_ID} loads (matches the
// same fallback in Checkout.jsx / OrderDetail.jsx).
const FALLBACK_STORE_LAT = 13.8294079;
const FALLBACK_STORE_LNG = 100.0529543;

const SectionTitle = ({ children }) => (
  <h2 className="text-base font-black text-gray-900 mb-4">{children}</h2>
);

// FAQ content lives in the i18n dictionary (help.q1..q6 / help.a1..a6). Answers
// reflect this app's actual, verified behavior (delivery radius, payment methods,
// no self-serve cancel/edit, etc.) — not generic placeholder copy.
const FAQ_IDS = [1, 2, 3, 4, 5, 6];

const FaqAccordionItem = ({ question, answer, open, onToggle }) => (
  <div className="border-b border-gray-50 last:border-0">
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between gap-3 py-4 text-left"
    >
      <span className="font-bold text-sm text-gray-800">{question}</span>
      <ChevronDown
        size={18}
        className={`text-gray-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
      />
    </button>
    {open && <p className="text-sm text-gray-500 pb-4 leading-relaxed">{answer}</p>}
  </div>
);

export const HelpCenter = () => {
  const { t } = usePreferences();
  const store = useStore(); // live stores/{STORE_ID} — single source of truth
  const storePhone = store?.phone || STORE_PHONE;
  const [storeLocation, setStoreLocation] = useState(null);
  const [reportText, setReportText] = useState("");
  const [openFaqIndex, setOpenFaqIndex] = useState(0);

  useEffect(() => {
    getStore().then((s) => {
      if (s) setStoreLocation({ lat: s.lat, lng: s.lng });
    });
  }, []);

  const resolvedStoreLocation = storeLocation ?? {
    lat: FALLBACK_STORE_LAT,
    lng: FALLBACK_STORE_LNG,
  };

  const handleCallStore = () => {
    window.location.href = `tel:${storePhone}`;
  };

  // No Firestore collection exists to persist a free-text report (and adding one
  // is out of scope here), so "sending" it opens a pre-filled SMS to the store's
  // real phone number instead — the text is actually transmitted, just not stored
  // in the app.
  const handleSendReport = () => {
    const body = encodeURIComponent(reportText.trim() || t("help.reportDefault"));
    window.location.href = `sms:${storePhone}?body=${body}`;
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-8 space-y-6">
      <h1 className="text-2xl font-black text-gray-900">{t("help.title")}</h1>

      {/* FAQ */}
      <Card className="p-6">
        <SectionTitle>{t("help.faq")}</SectionTitle>
        <div>
          {FAQ_IDS.map((id, index) => (
            <FaqAccordionItem
              key={id}
              question={t(`help.q${id}`)}
              answer={t(`help.a${id}`)}
              open={openFaqIndex === index}
              onToggle={() => setOpenFaqIndex((prev) => (prev === index ? -1 : index))}
            />
          ))}
        </div>
      </Card>

      {/* Contact Store */}
      <Card className="p-6">
        <SectionTitle>{t("help.contactStore")}</SectionTitle>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-2xl bg-primary-light text-primary shrink-0">
            <Phone size={20} />
          </div>
          <div>
            <p className="font-bold text-gray-900">{store?.storeName || "LK Fried Chicken"}</p>
            <p className="text-sm text-gray-400 font-medium">{storePhone}</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button className="flex-1" onClick={handleCallStore}>
            <Phone size={18} />
            {t("help.callStore")}
          </Button>
          <MapButton
            lat={resolvedStoreLocation.lat}
            lng={resolvedStoreLocation.lng}
            mode="view"
            label={t("help.openMaps")}
            style={{ flex: 1, textAlign: "center", display: "block" }}
          />
        </div>
      </Card>

      {/* LINE Official Account */}
      <Card className="p-6">
        <SectionTitle>{t("help.chatTitle")}</SectionTitle>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-2xl bg-gray-50 text-gray-400 shrink-0">
            <MessageCircle size={20} />
          </div>
          <p className="text-sm text-gray-500">{t("help.lineNotSetup")}</p>
        </div>
        <Button variant="outline" className="w-full" disabled>
          <MessageCircle size={18} />
          {t("help.lineNotConfigured")}
        </Button>
      </Card>

      {/* Report a Problem */}
      <Card className="p-6">
        <SectionTitle>{t("help.reportTitle")}</SectionTitle>
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
            <AlertTriangle size={14} />
            {t("help.reportHint")}
          </div>
          <textarea
            value={reportText}
            onChange={(e) => setReportText(e.target.value)}
            placeholder={t("help.reportPlaceholder")}
            rows={4}
            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 font-medium outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none"
          />
          <Button className="w-full" onClick={handleSendReport}>
            <AlertTriangle size={18} />
            {t("help.sendSms")}
          </Button>
        </div>
      </Card>

      {/* About App */}
      <Card className="p-6">
        <SectionTitle>{t("help.aboutApp")}</SectionTitle>
        <div className="flex items-center gap-3 mb-3">
          <div className="p-3 rounded-2xl bg-primary-light text-primary shrink-0">
            <Info size={20} />
          </div>
          <div>
            <p className="font-bold text-gray-900">{store?.storeName || "LK Fried Chicken"}</p>
            <p className="text-xs text-gray-400 font-medium">{t("help.version")}</p>
          </div>
        </div>
        <p className="text-sm text-gray-500 flex items-start gap-2">
          <HelpCircle size={16} className="text-gray-300 shrink-0 mt-0.5" />
          {t("help.aboutDesc")}
        </p>
      </Card>
    </div>
  );
};
