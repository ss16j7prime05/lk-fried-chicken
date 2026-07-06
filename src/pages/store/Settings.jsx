import { useEffect, useState } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import {
  Store, Bell, Printer, Shield, CheckCircle2, Save, Loader2,
  Volume2, VolumeX, Moon, Play,
} from "lucide-react";
import { db } from "../../firebase";
import { STORE_ID } from "../../config";
import { useAuth } from "../../AuthContext";
import { getAlarmAudioCtx, playSound, SOUND_LABELS, SOUND_KEYS } from "../../store/alarmSounds";

/* ─── default settings ─── */
const DEFAULT_NOTIF = {
  enabled: true,
  volume: 80,
  sound: "classic",
  nightMode: { enabled: false, startTime: "22:00", endTime: "07:00", volume: 30 },
};

const VOLUME_OPTIONS = [0, 25, 50, 75, 100];

/* ─── shared UI primitives ─── */
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
      <div className="px-5 md:px-6 py-5 space-y-5">{children}</div>
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
      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? "translate-x-7" : "translate-x-1"}`} />
    </button>
  );
}

function FieldInput({ value, onChange, placeholder, type = "text" }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all">
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

/* ─── Volume picker (5 preset levels) ─── */
function VolumePicker({ value, onChange }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        {value === 0 ? <VolumeX size={15} className="text-gray-400" /> : <Volume2 size={15} className="text-gray-400" />}
        <span className="text-xs font-bold text-gray-500">{value}%</span>
      </div>
      <div className="flex gap-2">
        {VOLUME_OPTIONS.map((v) => (
          <button
            key={v}
            onClick={() => onChange(v)}
            className={`flex-1 py-3 min-h-[44px] rounded-xl text-sm font-bold transition-colors min-w-0
              ${value === v ? "bg-primary text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            {v}%
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Sound selector (radio cards) ─── */
function SoundSelector({ value, onChange }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {SOUND_KEYS.map((key) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-colors
            ${value === key ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300 bg-white"}`}
        >
          <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center
            ${value === key ? "border-primary" : "border-gray-300"}`}>
            {value === key && <div className="w-2 h-2 rounded-full bg-primary" />}
          </div>
          <span className={`text-sm font-bold ${value === key ? "text-primary" : "text-gray-700"}`}>
            {SOUND_LABELS[key]}
          </span>
        </button>
      ))}
    </div>
  );
}

/* ─── Settings ─── */
export function Settings() {
  const { profile } = useAuth();

  /* store info */
  const [storeName, setStoreName] = useState("");
  const [storePhone, setStorePhone] = useState("");
  const [storeAddr, setStoreAddr] = useState("");
  const [savingStore, setSavingStore] = useState(false);
  const [savedStore, setSavedStore] = useState(false);

  /* notification settings — local draft */
  const [notif, setNotif] = useState(DEFAULT_NOTIF);
  const [savingNotif, setSavingNotif] = useState(false);
  const [savedNotif, setSavedNotif] = useState(false);
  const [testingSound, setTestingSound] = useState(false);

  /* receipt */
  const [autoPrint, setAutoPrint] = useState(() => localStorage.getItem("store_auto_print") === "1");
  const [printSize, setPrintSize] = useState(() => localStorage.getItem("store_print_size") || "80mm");
  const [autoScroll, setAutoScroll] = useState(() => localStorage.getItem("store_auto_scroll") === "1");

  /* load from Firestore */
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "stores", STORE_ID), (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      setStoreName(d.storeName || "");
      setStorePhone(d.phone    || "");
      setStoreAddr(d.address   || "");
      if (d.notificationSettings) {
        setNotif((prev) => ({
          ...DEFAULT_NOTIF,
          ...d.notificationSettings,
          nightMode: { ...DEFAULT_NOTIF.nightMode, ...(d.notificationSettings.nightMode || {}) },
        }));
      }
    });
    return unsub;
  }, []);

  /* ── store info save ── */
  const handleSaveStore = async () => {
    setSavingStore(true);
    try {
      await updateDoc(doc(db, "stores", STORE_ID), {
        storeName: storeName.trim() || "LK Fried Chicken",
        phone:     storePhone.trim(),
        address:   storeAddr.trim(),
      });
      setSavedStore(true);
      setTimeout(() => setSavedStore(false), 2500);
    } catch { alert("Save failed. Please try again."); }
    finally { setSavingStore(false); }
  };

  /* ── notification settings save ── */
  const handleSaveNotif = async () => {
    setSavingNotif(true);
    try {
      await updateDoc(doc(db, "stores", STORE_ID), { notificationSettings: notif });
      setSavedNotif(true);
      setTimeout(() => setSavedNotif(false), 2500);
    } catch { alert("Save failed. Please try again."); }
    finally { setSavingNotif(false); }
  };

  /* ── test sound ── */
  const handleTestSound = async () => {
    setTestingSound(true);
    try {
      const ctx = getAlarmAudioCtx();
      if (ctx.state === "suspended") await ctx.resume();
      playSound(notif.sound || "classic", ctx, (notif.volume ?? 80) / 100);
    } catch {}
    setTimeout(() => setTestingSound(false), 1000);
  };

  /* ── helper setters ── */
  const setN = (key, val) => setNotif((p) => ({ ...p, [key]: val }));
  const setNM = (key, val) => setNotif((p) => ({ ...p, nightMode: { ...p.nightMode, [key]: val } }));

  const handleAutoPrint = (v) => { setAutoPrint(v); localStorage.setItem("store_auto_print", v ? "1" : "0"); };
  const handlePrintSize = (v) => { setPrintSize(v); localStorage.setItem("store_print_size", v); };
  const handleAutoScroll = (v) => { setAutoScroll(v); localStorage.setItem("store_auto_scroll", v ? "1" : "0"); };

  return (
    <div className="p-4 md:p-5 lg:p-6 space-y-5 max-w-[900px] mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-black text-gray-900">Settings</h1>
        <p className="text-sm text-gray-400 font-medium mt-0.5">Manage your store configuration</p>
      </div>

      {/* ── Store Info ── */}
      <SettingSection icon={Store} title="Store Information" description="Basic store details shown to customers">
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Store Name</label>
            <div className="mt-1.5"><FieldInput value={storeName} onChange={setStoreName} placeholder="LK Fried Chicken" /></div>
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Phone Number</label>
            <div className="mt-1.5"><FieldInput value={storePhone} onChange={setStorePhone} placeholder="+66 8X XXX XXXX" type="tel" /></div>
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Address</label>
            <div className="mt-1.5"><FieldInput value={storeAddr} onChange={setStoreAddr} placeholder="Store address…" /></div>
          </div>
        </div>
        <button
          onClick={handleSaveStore}
          disabled={savingStore}
          className="flex items-center justify-center gap-2 w-full py-4 rounded-xl bg-primary text-white font-black hover:bg-primary-dark disabled:opacity-50 transition-colors text-sm mt-2"
        >
          {savingStore ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : savedStore ? <><CheckCircle2 size={16} /> Saved!</> : <><Save size={16} /> Save Store Info</>}
        </button>
      </SettingSection>

      {/* ── Notification Sound ── */}
      <SettingSection icon={Bell} title="Notification Sound" description="Order alert alarm — saved to cloud, applies to all devices">
        {/* Master enable */}
        <SettingRow label="Enable Order Alert" description="Play alarm when a new order arrives">
          <Toggle value={notif.enabled} onChange={(v) => setN("enabled", v)} />
        </SettingRow>

        {notif.enabled && (
          <>
            {/* Volume */}
            <div className="pt-4 border-t border-gray-50">
              <p className="text-sm font-bold text-gray-800 mb-3">Alert Volume</p>
              <VolumePicker value={notif.volume} onChange={(v) => setN("volume", v)} />
            </div>

            {/* Sound type */}
            <div className="pt-4 border-t border-gray-50">
              <p className="text-sm font-bold text-gray-800 mb-3">Alarm Sound</p>
              <SoundSelector value={notif.sound} onChange={(v) => setN("sound", v)} />
            </div>

            {/* Test button */}
            <button
              onClick={handleTestSound}
              disabled={testingSound}
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl border-2 border-primary text-primary font-black hover:bg-primary/5 disabled:opacity-50 transition-colors text-sm"
            >
              <Play size={16} />
              {testingSound ? "Playing…" : "Test Sound"}
            </button>
          </>
        )}

        {/* Save */}
        <button
          onClick={handleSaveNotif}
          disabled={savingNotif}
          className="flex items-center justify-center gap-2 w-full py-4 rounded-xl bg-primary text-white font-black hover:bg-primary-dark disabled:opacity-50 transition-colors text-sm"
        >
          {savingNotif ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : savedNotif ? <><CheckCircle2 size={16} /> Saved!</> : <><Save size={16} /> Save Sound Settings</>}
        </button>
      </SettingSection>

      {/* ── Night Mode ── */}
      <SettingSection icon={Moon} title="Night Mode" description="Automatically reduce alarm volume during late hours">
        <SettingRow label="Enable Night Mode" description="Lower volume between set times">
          <Toggle value={notif.nightMode?.enabled ?? false} onChange={(v) => setNM("enabled", v)} />
        </SettingRow>

        {notif.nightMode?.enabled && (
          <>
            <div className="pt-4 border-t border-gray-50 grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Start Time</label>
                <input
                  type="time"
                  value={notif.nightMode?.startTime || "22:00"}
                  onChange={(e) => setNM("startTime", e.target.value)}
                  className="mt-1.5 w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm font-bold text-gray-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">End Time</label>
                <input
                  type="time"
                  value={notif.nightMode?.endTime || "07:00"}
                  onChange={(e) => setNM("endTime", e.target.value)}
                  className="mt-1.5 w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm font-bold text-gray-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-gray-50">
              <p className="text-sm font-bold text-gray-800 mb-3">Night Volume</p>
              <VolumePicker value={notif.nightMode?.volume ?? 30} onChange={(v) => setNM("volume", v)} />
            </div>
          </>
        )}

        <button
          onClick={handleSaveNotif}
          disabled={savingNotif}
          className="flex items-center justify-center gap-2 w-full py-4 rounded-xl bg-primary text-white font-black hover:bg-primary-dark disabled:opacity-50 transition-colors text-sm"
        >
          {savingNotif ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : savedNotif ? <><CheckCircle2 size={16} /> Saved!</> : <><Save size={16} /> Save Night Mode</>}
        </button>
      </SettingSection>

      {/* ── Printing ── */}
      <SettingSection icon={Printer} title="Receipt Printing" description="Configure receipt size and auto-print behavior">
        <SettingRow label="Auto-print on Accept" description="Automatically print receipt when accepting an order">
          <Toggle value={autoPrint} onChange={handleAutoPrint} />
        </SettingRow>
        <div className="pt-2 border-t border-gray-50">
          <SettingRow label="Auto-scroll to New Orders" description="Scroll order list to newest items">
            <Toggle value={autoScroll} onChange={handleAutoScroll} />
          </SettingRow>
        </div>
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
          <span className="text-sm font-bold text-gray-500">{profile?.email || "—"}</span>
        </SettingRow>
        <div className="pt-2 border-t border-gray-50">
          <SettingRow label="Role" description="Account role in the system">
            <span className="text-xs font-bold px-3 py-1.5 bg-primary/10 text-primary rounded-full">Store Manager</span>
          </SettingRow>
        </div>
        <div className="pt-2 border-t border-gray-50">
          <SettingRow label="Store ID" description="Firestore document ID">
            <span className="text-xs font-mono text-gray-400">{STORE_ID}</span>
          </SettingRow>
        </div>
      </SettingSection>

      <div className="text-center py-4">
        <p className="text-xs text-gray-300 font-medium">LK Fried Chicken — Store Portal</p>
        <p className="text-[10px] text-gray-200 mt-0.5">Production v4 · Module 4+</p>
      </div>
    </div>
  );
}
