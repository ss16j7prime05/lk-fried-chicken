import { useEffect, useState } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  Store, Bell, Printer, Shield, CheckCircle2, Save, Loader2,
  Volume2, VolumeX, Moon, Play,
  Upload, Image as ImageIcon, MapPin, Clock,
  Power, Truck, CalendarX, Plus, Trash2,
} from "lucide-react";
import { db, storage } from "../../firebase";
import { STORE_ID, EST_PREP_MINUTES } from "../../config";
import { MAX_DELIVERY_RADIUS_KM, STORE_LOCATION } from "../../constants/address";
import { useAuth } from "../../AuthContext";
import { getAlarmAudioCtx, playSound, SOUND_LABELS, SOUND_KEYS } from "../../store/alarmSounds";
import LocationPicker from "../../location/LocationPicker";
import MapButton from "../../location/MapButton";
import { DAY_ORDER, computeStatus } from "../../store/storeStatus";

/* ─── default settings ─── */
const DEFAULT_NOTIF = {
  enabled: true,
  volume: 80,
  sound: "classic",
  nightMode: { enabled: false, startTime: "22:00", endTime: "07:00", volume: 30 },
};

const VOLUME_OPTIONS = [0, 25, 50, 75, 100];
const PREP_OPTIONS = [10, 15, 20, 30, 45, 60];

const DAY_LABELS = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday",
  fri: "Friday", sat: "Saturday", sun: "Sunday",
};
const DEFAULT_RANGE = { open: "10:00", close: "21:00" };

const STATUS_META = {
  open:         { label: "Open",         cls: "bg-green-100 text-green-700" },
  closing_soon: { label: "Closing Soon", cls: "bg-amber-100 text-amber-700" },
  closed:       { label: "Closed",       cls: "bg-red-100 text-red-600" },
};

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

/* ─── Labeled field wrapper ─── */
function LabeledField({ label, children }) {
  return (
    <div>
      <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

/* ─── Image upload (logo / banner) with preview ─── */
function ImageUpload({ label, value, previewClass, uploading, onSelect }) {
  return (
    <LabeledField label={label}>
      <div className="flex items-center gap-3">
        <div className={`${previewClass} rounded-xl border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center flex-shrink-0`}>
          {value
            ? <img src={value} alt={label} className="w-full h-full object-cover" />
            : <ImageIcon size={20} className="text-gray-300" />}
        </div>
        <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-gray-200 hover:border-primary text-gray-600 text-sm font-bold cursor-pointer transition-colors">
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          {uploading ? "Uploading…" : value ? "Change" : "Upload"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>
    </LabeledField>
  );
}

/* ─── Time-range row (one open–close slot) ─── */
function TimeRangeRow({ range, onChange, onRemove }) {
  const timeCls =
    "px-3 py-2.5 min-h-[44px] rounded-xl border border-gray-200 bg-gray-50 text-sm font-bold text-gray-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all";
  return (
    <div className="flex items-center gap-2">
      <input type="time" value={range.open} onChange={(e) => onChange({ ...range, open: e.target.value })} className={timeCls} />
      <span className="text-gray-400 text-sm font-bold">–</span>
      <input type="time" value={range.close} onChange={(e) => onChange({ ...range, close: e.target.value })} className={timeCls} />
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove time slot"
        className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}

/* ─── Weekly hours editor (per-day, multiple slots) ─── */
function DayHoursEditor({ hours, onChange }) {
  const setDay = (day, ranges) => onChange({ ...hours, [day]: ranges });
  return (
    <div className="space-y-3">
      {DAY_ORDER.map((day) => {
        const ranges = Array.isArray(hours?.[day]) ? hours[day] : [];
        const dayOpen = ranges.length > 0;
        return (
          <div key={day} className="pb-3 border-b border-gray-50 last:border-0 last:pb-0">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-gray-800">{DAY_LABELS[day]}</span>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold ${dayOpen ? "text-gray-400" : "text-red-400"}`}>
                  {dayOpen ? "Open" : "Closed"}
                </span>
                <Toggle value={dayOpen} onChange={(v) => setDay(day, v ? [{ ...DEFAULT_RANGE }] : [])} />
              </div>
            </div>
            {dayOpen && (
              <div className="mt-3 space-y-2">
                {ranges.map((r, i) => (
                  <TimeRangeRow
                    key={i}
                    range={r}
                    onChange={(nr) => setDay(day, ranges.map((x, j) => (j === i ? nr : x)))}
                    onRemove={() => setDay(day, ranges.filter((_, j) => j !== i))}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => setDay(day, [...ranges, { ...DEFAULT_RANGE }])}
                  className="flex items-center gap-1.5 text-xs font-black text-primary hover:text-primary-dark transition-colors"
                >
                  <Plus size={14} /> Add time slot
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Holidays editor (add single/multi-day, list, remove) ─── */
function HolidaysEditor({ holidays, onChange }) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [name, setName] = useState("");

  const add = () => {
    if (!start) return;
    const item = { id: `hol_${Date.now()}`, start, end: end || start, name: name.trim() };
    onChange([...(holidays || []), item].sort((a, b) => a.start.localeCompare(b.start)));
    setStart(""); setEnd(""); setName("");
  };
  const remove = (id) => onChange((holidays || []).filter((h) => h.id !== id));

  const dateCls =
    "w-full px-3 py-2.5 min-h-[44px] rounded-xl border border-gray-200 bg-gray-50 text-sm font-bold text-gray-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all";

  return (
    <div className="space-y-4">
      {(holidays || []).length > 0 && (
        <div className="space-y-2">
          {holidays.map((h) => (
            <div key={h.id} className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-gray-50 border border-gray-100">
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-800 truncate">{h.name || "Holiday"}</p>
                <p className="text-xs text-gray-400 font-medium">
                  {h.start}{h.end && h.end !== h.start ? ` → ${h.end}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove(h.id)}
                aria-label="Remove holiday"
                className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">From</label>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={`mt-1.5 ${dateCls}`} />
        </div>
        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">To (optional)</label>
          <input type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} className={`mt-1.5 ${dateCls}`} />
        </div>
      </div>
      <FieldInput value={name} onChange={setName} placeholder="Holiday name (e.g. Songkran)" />
      <button
        type="button"
        onClick={add}
        disabled={!start}
        className="flex items-center justify-center gap-2 w-full py-3 min-h-[44px] rounded-xl border-2 border-primary text-primary font-black hover:bg-primary/5 disabled:opacity-40 transition-colors text-sm"
      >
        <Plus size={16} /> Add Holiday
      </button>
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
  const [storeCategory, setStoreCategory] = useState("");
  const [storePhone, setStorePhone] = useState("");
  const [storeEmail, setStoreEmail] = useState("");
  const [storeAddr, setStoreAddr] = useState("");
  const [storeLogo, setStoreLogo] = useState("");
  const [storeBanner, setStoreBanner] = useState("");
  const [mapLink, setMapLink] = useState("");
  const [storeLat, setStoreLat] = useState("");
  const [storeLng, setStoreLng] = useState("");
  const [deliveryRadius, setDeliveryRadius] = useState(String(MAX_DELIVERY_RADIUS_KM));
  const [prepMinutes, setPrepMinutes] = useState(EST_PREP_MINUTES);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [savingStore, setSavingStore] = useState(false);
  const [savedStore, setSavedStore] = useState(false);

  /* opening hours */
  const [isOpen, setIsOpen] = useState(true);
  const [storeHours, setStoreHours] = useState({});
  const [deliveryHours, setDeliveryHours] = useState({});
  const [holidays, setHolidays] = useState([]);
  const [savingHours, setSavingHours] = useState(false);
  const [savedHours, setSavedHours] = useState(false);
  // Re-render every minute so the live Open/Closing Soon/Closed badge stays accurate.
  const [nowTs, setNowTs] = useState(Date.now);

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
      setStoreCategory(d.category || "");
      setStorePhone(d.phone    || "");
      setStoreEmail(d.email    || "");
      setStoreAddr(d.address   || "");
      setStoreLogo(d.storeLogo || "");
      setStoreBanner(d.storeBanner || "");
      setMapLink(d.mapLink || "");
      setStoreLat(d.lat != null ? String(d.lat) : "");
      setStoreLng(d.lng != null ? String(d.lng) : "");
      setDeliveryRadius(d.deliveryRadius != null ? String(d.deliveryRadius) : String(MAX_DELIVERY_RADIUS_KM));
      setPrepMinutes(d.prepMinutes != null ? d.prepMinutes : EST_PREP_MINUTES);
      setIsOpen(d.isOpen !== false);
      setStoreHours(d.storeHours || {});
      setDeliveryHours(d.deliveryHours || {});
      setHolidays(Array.isArray(d.holidays) ? d.holidays : []);
      if (d.notificationSettings) {
        setNotif(() => ({
          ...DEFAULT_NOTIF,
          ...d.notificationSettings,
          nightMode: { ...DEFAULT_NOTIF.nightMode, ...(d.notificationSettings.nightMode || {}) },
        }));
      }
    });
    return unsub;
  }, []);

  /* live-status ticker (updates the Open/Closing Soon/Closed badge) */
  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  /* ── master open/close — saves instantly so orders pause/resume right away ── */
  const handleToggleOpen = async (v) => {
    setIsOpen(v);
    try {
      await updateDoc(doc(db, "stores", STORE_ID), { isOpen: v });
    } catch { alert("Save failed. Please try again."); }
  };

  /* ── opening-hours save (hours + delivery + holidays) ── */
  const handleSaveHours = async () => {
    setSavingHours(true);
    try {
      await updateDoc(doc(db, "stores", STORE_ID), { storeHours, deliveryHours, holidays });
      setSavedHours(true);
      setTimeout(() => setSavedHours(false), 2500);
    } catch { alert("Save failed. Please try again."); }
    finally { setSavingHours(false); }
  };

  /* ── image upload (logo / banner) ── */
  const handleUploadImage = async (file, kind) => {
    if (!file) return;
    const setUploading = kind === "logo" ? setUploadingLogo : setUploadingBanner;
    const setUrl = kind === "logo" ? setStoreLogo : setStoreBanner;
    setUploading(true);
    try {
      const r = ref(storage, `stores/${STORE_ID}/${kind}_${Date.now()}_${file.name}`);
      await uploadBytes(r, file);
      setUrl(await getDownloadURL(r));
    } catch { alert("Upload failed. Please try again."); }
    finally { setUploading(false); }
  };

  /* ── map picker confirm ── */
  const handleConfirmMap = ({ lat, lng }) => {
    setStoreLat(String(lat));
    setStoreLng(String(lng));
    setShowMapModal(false);
  };

  /* ── store info save ── */
  const handleSaveStore = async () => {
    setSavingStore(true);
    try {
      const latNum = parseFloat(storeLat);
      const lngNum = parseFloat(storeLng);
      const radiusNum = parseFloat(deliveryRadius);
      // lat/lng/storeName/phone/address are the exact fields Customer (Checkout) and
      // Rider already read from stores/{STORE_ID} — kept identical so nothing breaks.
      const patch = {
        storeName: storeName.trim() || "LK Fried Chicken",
        category:  storeCategory.trim(),
        phone:     storePhone.trim(),
        email:     storeEmail.trim(),
        address:   storeAddr.trim(),
        storeLogo,
        storeBanner,
        mapLink:   mapLink.trim(),
        deliveryRadius: Number.isFinite(radiusNum) ? radiusNum : MAX_DELIVERY_RADIUS_KM,
        prepMinutes: Number(prepMinutes),
      };
      // Only overwrite coordinates when valid, so a bad manual edit can't wipe the
      // store location Customer/Rider depend on.
      if (Number.isFinite(latNum)) patch.lat = latNum;
      if (Number.isFinite(lngNum)) patch.lng = lngNum;
      await updateDoc(doc(db, "stores", STORE_ID), patch);
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
    } catch { /* audio not available */ }
    setTimeout(() => setTestingSound(false), 1000);
  };

  /* ── helper setters ── */
  const setN = (key, val) => setNotif((p) => ({ ...p, [key]: val }));
  const setNM = (key, val) => setNotif((p) => ({ ...p, nightMode: { ...p.nightMode, [key]: val } }));

  const handleAutoPrint = (v) => { setAutoPrint(v); localStorage.setItem("store_auto_print", v ? "1" : "0"); };
  const handlePrintSize = (v) => { setPrintSize(v); localStorage.setItem("store_print_size", v); };
  const handleAutoScroll = (v) => { setAutoScroll(v); localStorage.setItem("store_auto_scroll", v ? "1" : "0"); };

  // Live storefront status for the badge — reflects unsaved edits too.
  const liveStatus = computeStatus({ isOpen, storeHours, holidays }, new Date(nowTs), "store").status;
  const statusMeta = STATUS_META[liveStatus] || STATUS_META.closed;

  return (
    <div className="p-4 md:p-5 lg:p-6 space-y-5 max-w-[900px] mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-black text-gray-900">Settings</h1>
        <p className="text-sm text-gray-400 font-medium mt-0.5">Manage your store configuration</p>
      </div>

      {/* ── Store Info ── */}
      <SettingSection icon={Store} title="Store Information" description="Basic store details shown to customers">
        <div className="space-y-4">
          {/* Logo + Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ImageUpload
              label="Store Logo"
              value={storeLogo}
              previewClass="w-16 h-16"
              uploading={uploadingLogo}
              onSelect={(f) => handleUploadImage(f, "logo")}
            />
            <ImageUpload
              label="Store Banner"
              value={storeBanner}
              previewClass="w-28 h-16"
              uploading={uploadingBanner}
              onSelect={(f) => handleUploadImage(f, "banner")}
            />
          </div>

          {/* Name + Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <LabeledField label="Store Name">
              <FieldInput value={storeName} onChange={setStoreName} placeholder="LK Fried Chicken" />
            </LabeledField>
            <LabeledField label="Category">
              <FieldInput value={storeCategory} onChange={setStoreCategory} placeholder="e.g. Fried Chicken" />
            </LabeledField>
          </div>

          {/* Phone + Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <LabeledField label="Phone Number">
              <FieldInput value={storePhone} onChange={setStorePhone} placeholder="+66 8X XXX XXXX" type="tel" />
            </LabeledField>
            <LabeledField label="Email">
              <FieldInput value={storeEmail} onChange={setStoreEmail} placeholder="store@example.com" type="email" />
            </LabeledField>
          </div>

          {/* Address */}
          <LabeledField label="Address">
            <FieldInput value={storeAddr} onChange={setStoreAddr} placeholder="Store address…" />
          </LabeledField>

          {/* Google Maps link */}
          <LabeledField label="Google Maps Link">
            <FieldInput value={mapLink} onChange={setMapLink} placeholder="https://maps.google.com/…" type="url" />
          </LabeledField>

          {/* GPS coordinates */}
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">GPS Coordinates</label>
            <div className="mt-1.5 grid grid-cols-2 gap-3">
              <FieldInput value={storeLat} onChange={setStoreLat} placeholder="Latitude" type="number" />
              <FieldInput value={storeLng} onChange={setStoreLng} placeholder="Longitude" type="number" />
            </div>
            <div className="mt-2 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => setShowMapModal(true)}
                className="flex items-center justify-center gap-2 flex-1 py-3 min-h-[44px] rounded-xl border-2 border-gray-200 hover:border-primary text-gray-600 text-sm font-bold transition-colors"
              >
                <MapPin size={16} /> Pick on Map
              </button>
              <MapButton
                lat={parseFloat(storeLat)}
                lng={parseFloat(storeLng)}
                mode="view"
                label="🗺️ View on Google Maps"
                style={{ flex: 1, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 12 }}
              />
            </div>
          </div>

          {/* Delivery radius */}
          <LabeledField label="Delivery Radius (km)">
            <FieldInput value={deliveryRadius} onChange={setDeliveryRadius} placeholder="8" type="number" />
          </LabeledField>

          {/* Prep time */}
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Clock size={12} /> Prep Time (minutes)
            </label>
            <div className="mt-1.5 grid grid-cols-3 sm:grid-cols-6 gap-2">
              {PREP_OPTIONS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPrepMinutes(m)}
                  className={`py-3 min-h-[44px] rounded-xl text-sm font-bold transition-colors
                    ${prepMinutes === m ? "bg-primary text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                >
                  {m}
                </button>
              ))}
            </div>
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

      {/* ── Open / Close Store (master switch) ── */}
      <SettingSection icon={Power} title="Store Status" description="Master switch — pauses new orders instantly when closed">
        <SettingRow
          label={isOpen ? "Store is Open" : "Store is Closed"}
          description={isOpen ? "Accepting new orders" : "Customers can't order; riders get no new jobs"}
        >
          <div className="flex items-center gap-3">
            <span className={`text-xs font-black px-3 py-1.5 rounded-full ${statusMeta.cls}`}>{statusMeta.label}</span>
            <Toggle value={isOpen} onChange={handleToggleOpen} />
          </div>
        </SettingRow>
      </SettingSection>

      {/* ── Store Hours ── */}
      <SettingSection icon={Clock} title="Store Hours" description="Weekly storefront hours — add several slots per day (e.g. break for lunch)">
        <DayHoursEditor hours={storeHours} onChange={setStoreHours} />
      </SettingSection>

      {/* ── Delivery Hours ── */}
      <SettingSection icon={Truck} title="Delivery Hours" description="When customers can place delivery orders — set separately from store hours">
        <DayHoursEditor hours={deliveryHours} onChange={setDeliveryHours} />
      </SettingSection>

      {/* ── Special Holidays ── */}
      <SettingSection icon={CalendarX} title="Special Holidays" description="Close on specific dates — single day or a range; remove to reopen">
        <HolidaysEditor holidays={holidays} onChange={setHolidays} />
      </SettingSection>

      {/* Save all opening-hours settings */}
      <button
        onClick={handleSaveHours}
        disabled={savingHours}
        className="flex items-center justify-center gap-2 w-full py-4 rounded-xl bg-primary text-white font-black hover:bg-primary-dark disabled:opacity-50 transition-colors text-sm"
      >
        {savingHours ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : savedHours ? <><CheckCircle2 size={16} /> Saved!</> : <><Save size={16} /> Save Opening Hours</>}
      </button>

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

      <LocationPicker
        isOpen={showMapModal}
        storeLocation={{
          lat: Number.isFinite(parseFloat(storeLat)) ? parseFloat(storeLat) : STORE_LOCATION.lat,
          lng: Number.isFinite(parseFloat(storeLng)) ? parseFloat(storeLng) : STORE_LOCATION.lng,
        }}
        initialPosition={
          Number.isFinite(parseFloat(storeLat)) && Number.isFinite(parseFloat(storeLng))
            ? { lat: parseFloat(storeLat), lng: parseFloat(storeLng) }
            : null
        }
        onConfirm={handleConfirmMap}
        onClose={() => setShowMapModal(false)}
      />
    </div>
  );
}
