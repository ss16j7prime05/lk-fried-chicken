import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import {
  ChevronDown,
  Phone,
  MessageCircle,
  AlertTriangle,
  Info,
  HelpCircle,
} from "lucide-react";
import { db } from "../../firebase";
import { STORE_ID, STORE_PHONE, PROMPTPAY_ACCOUNT_NAME } from "../../config";
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

// Answers reflect this app's actual, verified behavior (delivery radius, payment
// methods, no self-serve cancel/edit, etc.) — not generic placeholder copy.
const FAQ_ITEMS = [
  {
    question: "How do I track my order?",
    answer:
      "Open My Orders and tap the order — you'll see live status updates, and once a rider is on the way, a real-time map with their location and ETA.",
  },
  {
    question: "What payment methods are accepted?",
    answer: "Cash on delivery, PromptPay (QR code), or bank transfer with a payment slip upload.",
  },
  {
    question: "What's the delivery area?",
    answer:
      "We deliver within about 8 km of the store. If your address is outside that range, checkout will let you know before you place the order.",
  },
  {
    question: "Can I cancel or change my order after placing it?",
    answer:
      "Orders can't be edited or cancelled from the app once placed. Please call the store directly as soon as possible.",
  },
  {
    question: "How do I leave a review?",
    answer:
      "Once an order is marked Completed, go to the Reviews page — you'll find it listed there with a \"Write a Review\" option.",
  },
  {
    question: "My payment slip was rejected. What do I do?",
    answer:
      "Check the Payment section on your order's detail page for the status, then contact the store to resolve it and re-upload if needed.",
  },
];

const FaqAccordionItem = ({ item, open, onToggle }) => (
  <div className="border-b border-gray-50 last:border-0">
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between gap-3 py-4 text-left"
    >
      <span className="font-bold text-sm text-gray-800">{item.question}</span>
      <ChevronDown
        size={18}
        className={`text-gray-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
      />
    </button>
    {open && <p className="text-sm text-gray-500 pb-4 leading-relaxed">{item.answer}</p>}
  </div>
);

export const HelpCenter = () => {
  const [storeLocation, setStoreLocation] = useState(null);
  const [reportText, setReportText] = useState("");
  const [openFaqIndex, setOpenFaqIndex] = useState(0);

  useEffect(() => {
    getDoc(doc(db, "stores", STORE_ID)).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.lat != null && data.lng != null) {
          setStoreLocation({ lat: data.lat, lng: data.lng });
        }
      }
    });
  }, []);

  const resolvedStoreLocation = storeLocation ?? {
    lat: FALLBACK_STORE_LAT,
    lng: FALLBACK_STORE_LNG,
  };

  const handleCallStore = () => {
    window.location.href = `tel:${STORE_PHONE}`;
  };

  // No Firestore collection exists to persist a free-text report (and adding one
  // is out of scope here), so "sending" it opens a pre-filled SMS to the store's
  // real phone number instead — the text is actually transmitted, just not stored
  // in the app.
  const handleSendReport = () => {
    const body = encodeURIComponent(reportText.trim() || "I'd like to report an issue with my order.");
    window.location.href = `sms:${STORE_PHONE}?body=${body}`;
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-8 space-y-6">
      <h1 className="text-2xl font-black text-gray-900">Help Center</h1>

      {/* FAQ */}
      <Card className="p-6">
        <SectionTitle>Frequently Asked Questions</SectionTitle>
        <div>
          {FAQ_ITEMS.map((item, index) => (
            <FaqAccordionItem
              key={item.question}
              item={item}
              open={openFaqIndex === index}
              onToggle={() => setOpenFaqIndex((prev) => (prev === index ? -1 : index))}
            />
          ))}
        </div>
      </Card>

      {/* Contact Store */}
      <Card className="p-6">
        <SectionTitle>Contact Store</SectionTitle>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-2xl bg-primary-light text-primary shrink-0">
            <Phone size={20} />
          </div>
          <div>
            <p className="font-bold text-gray-900">{PROMPTPAY_ACCOUNT_NAME}</p>
            <p className="text-sm text-gray-400 font-medium">{STORE_PHONE}</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button className="flex-1" onClick={handleCallStore}>
            <Phone size={18} />
            Call Store
          </Button>
          <MapButton
            lat={resolvedStoreLocation.lat}
            lng={resolvedStoreLocation.lng}
            mode="view"
            label="Open Google Maps"
            style={{ flex: 1, textAlign: "center", display: "block" }}
          />
        </div>
      </Card>

      {/* LINE Official Account */}
      <Card className="p-6">
        <SectionTitle>Chat with Us</SectionTitle>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-2xl bg-gray-50 text-gray-400 shrink-0">
            <MessageCircle size={20} />
          </div>
          <p className="text-sm text-gray-500">
            LINE Official Account chat isn't set up for this store yet — call or send an SMS
            below in the meantime.
          </p>
        </div>
        <Button variant="outline" className="w-full" disabled>
          <MessageCircle size={18} />
          LINE Not Configured
        </Button>
      </Card>

      {/* Report a Problem */}
      <Card className="p-6">
        <SectionTitle>Report a Problem</SectionTitle>
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
            <AlertTriangle size={14} />
            This opens a text message to the store — it isn't saved in the app.
          </div>
          <textarea
            value={reportText}
            onChange={(e) => setReportText(e.target.value)}
            placeholder="Describe the issue (e.g. missing item, wrong order, late delivery)..."
            rows={4}
            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 font-medium outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none"
          />
          <Button className="w-full" onClick={handleSendReport}>
            <AlertTriangle size={18} />
            Send via SMS
          </Button>
        </div>
      </Card>

      {/* About App */}
      <Card className="p-6">
        <SectionTitle>About App</SectionTitle>
        <div className="flex items-center gap-3 mb-3">
          <div className="p-3 rounded-2xl bg-primary-light text-primary shrink-0">
            <Info size={20} />
          </div>
          <div>
            <p className="font-bold text-gray-900">{PROMPTPAY_ACCOUNT_NAME}</p>
            <p className="text-xs text-gray-400 font-medium">Version 1.0.0</p>
          </div>
        </div>
        <p className="text-sm text-gray-500 flex items-start gap-2">
          <HelpCircle size={16} className="text-gray-300 shrink-0 mt-0.5" />
          Online ordering, delivery, and pickup. For anything not covered here, contact the
          store directly using the options above.
        </p>
      </Card>
    </div>
  );
};
