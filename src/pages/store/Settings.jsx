import { useEffect, useState } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import {
  Store,
  Bell,
  Printer,
  Clock,
  Shield,
  ChevronRight,
  CheckCircle2,
  Save,
  Loader2,
  Volume2,
  VolumeX,
  Phone,
  MapPin,
  AlertCircle,
} from "lucide-react";
import { db } from "../../firebase";
import { STORE_ID } from "../../config";
import { useAuth } from "../../AuthContext";

/* ─── helpers ─── */
function SettingSection({ icon: Icon, title, description, children }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="flex items-center gap-4 px-5 md:px-6 py-5 border-b border-gray-50">
        <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Icon size={20} className="text-primary" />
        </div>
        <div>
          <p className="text-base font-black text-gray-900">{title}</p>
          {description && <p className="text-xs font-medium text-gray-400 mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="px-5 md:px-6 py-5 space-y-5">
        {children}
      </div>
    </div>
  );
}

function SettingRow({ label, description, children }) {
  return (
    <div className="flex items-center justify-between gap-4 min-h-[48px]">
      <div className="min-w-0">
        <p className="text-sm font-bold text-gray-800">{label}</p>
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ value, onChange }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative w-12 h-6 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary flex-shrink-0
        ${value ? "bg-primary" : "bg-gray-300"}`}
    >
      <span
        className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? "translate-x-7" : "translate-x-1"}`}
      />
    </button>
  );
}

function FieldInput({ value, onChange, placeholder, type = "text", prefix }) {
  return (
    <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all ${prefix ? "gap-2" : ""}`}>
      {prefix && <span className="text-sm font-bold text-gray-400 flex-shrink-0">{prefix}</span>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-sm font-medium text-gray-800 outline-none min-w-0 placeholder:text-gray-300"
      />
    </div>
  );
}

/* ─── Settings page ─── */
export function Settings() {
  const { profile } = useAuth();

  /* store settings from Firestore */
  const [storeData, setStoreData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  /* local form state */
  const [storeName, setStoreName]   = useState("");
  const [storePhone, setStorePhone] = useState("");
  const [storeAddr, setStoreAddr]   = useState("");

  /* notification settings (localStorage) */
  const [soundOn, setSoundOn]       = useState(() => localStorage.getItem("kitchen_muted") !== "1");
  const [volume, setVolume]         = useState(() => Number(localStorage.getItem("kitchen_volume") ?? 0.6));
  const [autoScroll, setAutoScroll] = useState(() => localStorage.getItem("store_auto_scroll") === "1");
  const [autoPrint, setAutoPrint]   = useState(() => localStorage.getItem("store_auto_print") === "1");
  const [printSize, setPrintSize]   = useState(() => localStorage.getItem("store_print_size") || "80mm");

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "stores", STORE_ID), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setStoreData(d);
        setStoreName(d.storeName || "");
        setStorePhone(d.phone || "");
        setStoreAddr(d.address || "");
      }
    });
    return unsub;
  }, []);

  const handleSaveStore = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, "stores", STORE_ID), {
        storeName: storeName.trim() || "LK Fried Chicken",
        phone:     storePhone.trim(),
        address:   storeAddr.trim(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      alert("Save failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSoundToggle = (v) => {
    setSoundOn(v);
    localStorage.setItem("kitchen_muted", v ? "0" : "1");
  };

  const handleVolume = (v) => {
    setVolume(v);
    localStorage.setItem("kitchen_volume", String(v));
  };

  const handleAutoScroll = (v) => {
    setAutoScroll(v);
    localStorage.setItem("store_auto_scroll", v ? "1" : "0");
  };

  const handleAutoPrint = (v) => {
    setAutoPrint(v);
    localStorage.setItem("store_auto_print", v ? "1" : "0");
  };

  const handlePrintSize = (v) => {
    setPrintSize(v);
    localStorage.setItem("store_print_size", v);
  };

  return (
    <div className="p-4 md:p-5 lg:p-6 space-y-5 max-w-[900px] mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-black text-gray-900">Settings</h1>
        <p className="text-sm text-gray-400 font-medium mt-0.5">
          Manage your store configuration
        </p>
      </div>

      {/* ── Store Info ── */}
      <SettingSection icon={Store} title="Store Information" description="Basic store details shown to customers">
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Store Name</label>
            <div className="mt-1.5">
              <FieldInput
                value={storeName}
                onChange={setStoreName}
                placeholder="LK Fried Chicken"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Phone Number</label>
            <div className="mt-1.5">
              <FieldInput
                value={storePhone}
                onChange={setStorePhone}
                placeholder="+66 8X XXX XXXX"
                type="tel"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Address</label>
            <div className="mt-1.5">
              <FieldInput
                value={storeAddr}
                onChange={setStoreAddr}
                placeholder="Store address…"
              />
            </div>
          </div>
        </div>

        <button
          onClick={handleSaveStore}
          disabled={saving}
          className="flex items-center justify-center gap-2 w-full py-4 rounded-xl bg-primary text-white font-black hover:bg-primary-dark disabled:opacity-50 transition-colors text-sm mt-2"
        >
          {saving ? (
            <><Loader2 size={16} className="animate-spin" /> Saving…</>
          ) : saved ? (
            <><CheckCircle2 size={16} /> Saved!</>
          ) : (
            <><Save size={16} /> Save Store Info</>
          )}
        </button>
      </SettingSection>

      {/* ── Sound & Alerts ── */}
      <SettingSection icon={Bell} title="Sound & Alerts" description="Order notification sounds">
        <SettingRow label="Order Alert Sound" description="Play sound when a new order arrives">
          <Toggle value={soundOn} onChange={handleSoundToggle} />
        </SettingRow>

        {soundOn && (
          <div className="pt-2 border-t border-gray-50">
            <SettingRow label="Alert Volume" description={`Current: ${Math.round(volume * 100)}%`}>
              <div className="flex items-center gap-2">
                {volume === 0 ? <VolumeX size={15} className="text-gray-400" /> : <Volume2 size={15} className="text-gray-400" />}
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={volume}
                  onChange={(e) => handleVolume(Number(e.target.value))}
                  className="w-32 accent-primary"
                />
              </div>
            </SettingRow>
          </div>
        )}

        <div className="pt-2 border-t border-gray-50">
          <SettingRow label="Auto-scroll to New Orders" description="Automatically scroll the order list to new items">
            <Toggle value={autoScroll} onChange={handleAutoScroll} />
          </SettingRow>
        </div>
      </SettingSection>

      {/* ── Printing ── */}
      <SettingSection icon={Printer} title="Receipt Printing" description="Configure receipt size and auto-print behavior">
        <SettingRow label="Auto-print on Accept" description="Automatically print receipt when accepting an order">
          <Toggle value={autoPrint} onChange={handleAutoPrint} />
        </SettingRow>

        <div className="pt-2 border-t border-gray-50">
          <SettingRow label="Default Receipt Size" description="Paper size for thermal printer">
            <select
              value={printSize}
              onChange={(e) => handlePrintSize(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-700 outline-none focus:border-primary bg-white"
            >
              <option value="58mm">58mm</option>
              <option value="80mm">80mm</option>
              <option value="a4">A4 Invoice</option>
            </select>
          </SettingRow>
        </div>
      </SettingSection>

      {/* ── Account ── */}
      <SettingSection icon={Shield} title="Account" description="Your store manager account">
        <SettingRow label="Email" description="Login email address">
          <span className="text-sm font-bold text-gray-500">
            {profile?.email || "—"}
          </span>
        </SettingRow>
        <div className="pt-2 border-t border-gray-50">
          <SettingRow label="Role" description="Account role in the system">
            <span className="text-xs font-bold px-3 py-1.5 bg-primary/10 text-primary rounded-full">
              Store Manager
            </span>
          </SettingRow>
        </div>
        <div className="pt-2 border-t border-gray-50">
          <SettingRow label="Store ID" description="Firestore document ID">
            <span className="text-xs font-mono text-gray-400">{STORE_ID}</span>
          </SettingRow>
        </div>
      </SettingSection>

      {/* ── App info ── */}
      <div className="text-center py-4">
        <p className="text-xs text-gray-300 font-medium">LK Fried Chicken — Store Portal</p>
        <p className="text-[10px] text-gray-200 mt-0.5">Production v4 · Module 4</p>
      </div>
    </div>
  );
}
