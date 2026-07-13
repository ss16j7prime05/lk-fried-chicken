import { useEffect, useState } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import {
  Store, Bell, Printer, Shield, CheckCircle2, Save, Loader2,
  Volume2, VolumeX, Moon, Sun, Monitor, Play,
  Upload, Image as ImageIcon, MapPin, Clock,
  Power, Truck, CalendarX, Plus, Trash2,
  Phone, CreditCard, User, Users, Globe, HelpCircle, FileText, LogOut,
  ChevronRight, ChevronLeft, Wrench, AlertCircle,
  Link2, MessageCircle, AtSign, Music2, Copy, Check,
  Receipt,
  Mail, PhoneCall,
  Banknote, QrCode, Landmark,
} from "lucide-react";
import { db, storage } from "../../firebase";
import { STORE_ID, EST_PREP_MINUTES } from "../../config";
import { MAX_DELIVERY_RADIUS_KM, STORE_LOCATION, isValidThaiPhone } from "../../constants/address";
import { useAuth } from "../../AuthContext";
import { usePreferences } from "../../context/PreferencesContext";
import { getAlarmAudioCtx, playSound, SOUND_LABELS, SOUND_KEYS } from "../../store/alarmSounds";
import LocationPicker from "../../location/LocationPicker";
import MapButton from "../../location/MapButton";
import {
  PAYMENT_KEYS, DEFAULT_PAYMENT, normalizePayment,
  isValidPromptPayId, isValidAccountNumber, promptPayQrUrl,
} from "../../payment/paymentSettings";
import BannerCropper from "../../components/store/BannerCropper";
import { DAY_ORDER, computeStatus } from "../../store/storeStatus";

/* ─── store-profile validators (reuse isValidThaiPhone from address constants) ─── */
const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim());
const isValidTaxId = (v) => /^\d{13}$/.test(String(v).replace(/[\s-]/g, ""));
const inRange = (n, lo, hi) => Number.isFinite(n) && n >= lo && n <= hi;

/* ─── contact action links (pure helpers) ─── */
const telHref = (v) => { const s = String(v || "").replace(/[\s-]/g, ""); return s ? `tel:${s}` : ""; };
const mailHref = (v) => { const s = String(v || "").trim(); return s ? `mailto:${s}` : ""; };
// LINE: accept a full URL, an @id, or a bare id → deep link to the LINE profile.
const lineHref = (v) => {
  const s = String(v || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  return `https://line.me/R/ti/p/${s.startsWith("@") ? s : `@${s}`}`;
};

// Blank sub-objects — mirror the Firestore field shape so a missing doc field
// never throws. Stored under stores/{STORE_ID} (no new collection).
const EMPTY_SOCIAL = { facebook: "", line: "", instagram: "", tiktok: "", website: "" };
const EMPTY_TAX = { taxId: "", companyName: "", branch: "" };

// Single social source. LINE OA lives in Contact (richer open-LINE action) and is
// edited via the same social.line field, so it is intentionally not repeated here.
const SOCIAL_FIELDS = [
  { key: "website",   icon: Globe,          labelKey: "si.website",   ph: "https://…" },
  { key: "facebook",  icon: Link2,          labelKey: "si.facebook",  ph: "https://facebook.com/…" },
  { key: "instagram", icon: AtSign,         labelKey: "si.instagram", ph: "@yourhandle" },
  { key: "tiktok",    icon: Music2,         labelKey: "si.tiktok",    ph: "@yourhandle" },
];

/* ─── default settings ─── */
const DEFAULT_NOTIF = {
  enabled: true,
  volume: 80,
  sound: "classic",
  nightMode: { enabled: false, startTime: "22:00", endTime: "07:00", volume: 30 },
};

const VOLUME_OPTIONS = [0, 25, 50, 75, 100];
const PREP_OPTIONS = [10, 15, 20, 30, 45, 60];

/* ─── E-payment methods — keys match the values Customer Checkout writes to
   orders (`cash` | `promptpay` | `transfer`), so a single source of truth is
   shared with the storefront. Stored under stores/{STORE_ID}.paymentSettings. ─── */
const PAYMENT_METHODS = [
  { key: "cash",      icon: Banknote, labelKey: "payment.cash",      descKey: "sp.cashDesc" },
  { key: "promptpay", icon: QrCode,   labelKey: "payment.promptpay", descKey: "sp.promptpayDesc" },
  { key: "transfer",  icon: Landmark, labelKey: "payment.transfer",  descKey: "sp.transferDesc" },
];
// Payment shape/defaults/validators live in ../../payment/paymentSettings (shared
// with Customer Checkout). PAYMENT_METHODS below only adds the editor's icons/labels.

const DAY_LABELS = {
  mon: "ss.dayMon", tue: "ss.dayTue", wed: "ss.dayWed", thu: "ss.dayThu",
  fri: "ss.dayFri", sat: "ss.daySat", sun: "ss.daySun",
};
const DEFAULT_RANGE = { open: "10:00", close: "21:00" };

const STATUS_META = {
  open:         { labelKey: "ss.statusOpen",         cls: "bg-green-100 text-green-700" },
  closing_soon: { labelKey: "ss.statusClosingSoon", cls: "bg-amber-100 text-amber-700" },
  closed:       { labelKey: "ss.statusClosed",       cls: "bg-red-100 text-red-600" },
};

// LINE MAN-style grouped settings menu. Each item routes to a section within this same
// page (no new router routes). labelKey/titleKey resolve through the shared i18n t().
const MENU_GROUPS = [
  {
    titleKey: "ss.groupStore",
    items: [
      { key: "store-info",    icon: Store,      labelKey: "ss.storeInfo" },
      { key: "hours",         icon: Clock,      labelKey: "ss.hours" },
      { key: "open-close",    icon: Power,      labelKey: "ss.openClose" },
      { key: "contact",       icon: Phone,      labelKey: "ss.contact" },
      { key: "notifications", icon: Bell,       labelKey: "ss.notifications" },
      { key: "payment",       icon: CreditCard, labelKey: "ss.payment" },
    ],
  },
  {
    titleKey: "ss.groupAccount",
    items: [
      { key: "account", icon: User,  labelKey: "ss.myAccount" },
      { key: "staff",   icon: Users, labelKey: "ss.staff" },
    ],
  },
  {
    titleKey: "ss.groupApp",
    items: [
      { key: "appearance", icon: Moon,     labelKey: "settings.appearance" },
      { key: "language", icon: Globe,      labelKey: "ss.language" },
      { key: "help",     icon: HelpCircle, labelKey: "ss.help" },
      { key: "privacy",  icon: Shield,     labelKey: "ss.privacy" },
      { key: "terms",    icon: FileText,   labelKey: "ss.terms" },
      { key: "logout",   icon: LogOut,     labelKey: "ss.logout", danger: true },
    ],
  },
];

// Flat lookup for the section header title.
const SECTION_TITLE = MENU_GROUPS.flatMap((g) => g.items).reduce(
  (acc, it) => ({ ...acc, [it.key]: it.labelKey }),
  {}
);

/* ─── Grouped menu (default view) ─── */
function SettingsMenu({ t, onSelect, onLogout }) {
  return (
    <div className="space-y-6">
      {MENU_GROUPS.map((group) => (
        <div key={group.titleKey}>
          <p className="text-[11px] font-black text-gray-400 uppercase tracking-wider mb-2 px-1">
            {t(group.titleKey)}
          </p>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {group.items.map((it, idx) => (
              <button
                key={it.key}
                type="button"
                onClick={() => (it.key === "logout" ? onLogout() : onSelect(it.key))}
                className={`w-full flex items-center gap-4 px-5 py-4 min-h-[56px] text-left hover:bg-gray-50 transition-colors ${idx > 0 ? "border-t border-gray-50" : ""}`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${it.danger ? "bg-red-50 text-red-500" : "bg-primary/10 text-primary"}`}>
                  <it.icon size={18} />
                </div>
                <span className={`flex-1 text-sm font-bold ${it.danger ? "text-red-500" : "text-gray-800"}`}>
                  {t(it.labelKey)}
                </span>
                {!it.danger && <ChevronRight size={18} className="text-gray-300 flex-shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Placeholder for sections not built yet (production layout) ─── */
function PlaceholderSection({ t }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
      <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
        <Wrench size={22} className="text-gray-300" />
      </div>
      <p className="text-base font-black text-gray-800">{t("ss.comingSoon")}</p>
      <p className="text-sm text-gray-400 font-medium mt-1">{t("ss.placeholderDesc")}</p>
    </div>
  );
}

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

/* ─── Multi-line text field (Description) ─── */
function TextArea({ value, onChange, placeholder, rows = 3 }) {
  return (
    <div className="px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full bg-transparent text-sm font-medium text-gray-800 outline-none resize-y placeholder:text-gray-300"
      />
    </div>
  );
}

/* ─── Inline field error ─── */
function FieldError({ message }) {
  if (!message) return null;
  return (
    <p className="flex items-center gap-1 text-xs font-bold text-red-500 mt-1.5">
      <AlertCircle size={12} className="flex-shrink-0" /> {message}
    </p>
  );
}

/* ─── Copy-to-clipboard button (single clipboard primitive — reused for phone,
   email and the map link, so the copy logic lives in one place) ─── */
function CopyButton({ text, label, t, className }) {
  const [copied, setCopied] = useState(false);
  const value = String(text || "").trim();
  const copy = async (e) => {
    e?.stopPropagation?.();
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked */ }
  };
  // Labeled variant (full-width button, e.g. map link)
  if (label) {
    return (
      <button type="button" onClick={copy} disabled={!value} className={className}>
        {copied ? <><Check size={16} className="text-green-500" /> {t("si.copied")}</> : <><Copy size={16} /> {label}</>}
      </button>
    );
  }
  // Icon-only variant (contact rows)
  return (
    <button
      type="button"
      onClick={copy}
      disabled={!value}
      aria-label={t("sc.copy")}
      className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border-2 border-gray-200 text-gray-500 hover:border-primary hover:text-primary disabled:opacity-40 transition-colors flex-shrink-0"
    >
      {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
    </button>
  );
}

/* ─── Action link button (call / open LINE / open website) — renders a disabled
   placeholder when there's nothing to link to. Reused for every contact action. ─── */
function LinkIconButton({ href, icon: Icon, label, external = true }) {
  const cls = "min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border-2 border-gray-200 text-gray-500 hover:border-primary hover:text-primary transition-colors flex-shrink-0";
  if (!href) {
    return <span className={`${cls} opacity-40`} aria-label={label}><Icon size={16} /></span>;
  }
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel="noreferrer"
      aria-label={label}
      className={cls}
    >
      <Icon size={16} />
    </a>
  );
}

/* ─── Image upload (logo / banner) with preview, replace + delete ─── */
/* ─── Inline upload error + retry (shared by logo & banner) ─── */
function UploadError({ error, onRetry, t }) {
  if (!error) return null;
  return (
    <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-100 text-xs font-bold text-red-600">
      <AlertCircle size={14} className="flex-shrink-0" />
      <span className="flex-1 min-w-0">{error}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-1 px-2.5 py-1.5 min-h-[32px] rounded-lg border border-red-200 text-red-600 hover:bg-red-100 transition-colors flex-shrink-0"
        >
          {t("si.retry")}
        </button>
      )}
    </div>
  );
}

function ImageUpload({ label, value, previewClass, uploading, error, onSelect, onDelete, onRetry, t }) {
  return (
    <LabeledField label={label}>
      <div className="flex items-center gap-3">
        <div className={`${previewClass} rounded-xl border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center flex-shrink-0`}>
          {value
            ? <img src={value} alt={label} className="w-full h-full object-cover" />
            : <ImageIcon size={20} className="text-gray-300" />}
        </div>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl border-2 border-gray-200 hover:border-primary text-gray-600 text-sm font-bold cursor-pointer transition-colors">
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {uploading ? t("si.uploading") : value ? t("si.replace") : t("si.upload")}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={(e) => { onSelect(e.target.files?.[0] ?? null); e.target.value = ""; }}
            />
          </label>
          {value && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl border-2 border-gray-200 hover:border-red-400 text-gray-500 hover:text-red-500 text-sm font-bold transition-colors disabled:opacity-50"
            >
              <Trash2 size={16} /> {t("si.delete")}
            </button>
          )}
        </div>
      </div>
      <UploadError error={error} onRetry={onRetry} t={t} />
    </LabeledField>
  );
}

/* ─── Time-range row (one open–close slot) ─── */
function TimeRangeRow({ range, onChange, onRemove, t }) {
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
        aria-label={t("ss.removeSlot")}
        className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}

/* ─── Weekly hours editor (per-day, multiple slots) ─── */
function DayHoursEditor({ hours, onChange, t }) {
  const setDay = (day, ranges) => onChange({ ...hours, [day]: ranges });
  return (
    <div className="space-y-3">
      {DAY_ORDER.map((day) => {
        const ranges = Array.isArray(hours?.[day]) ? hours[day] : [];
        const dayOpen = ranges.length > 0;
        return (
          <div key={day} className="pb-3 border-b border-gray-50 last:border-0 last:pb-0">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-gray-800">{t(DAY_LABELS[day])}</span>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold ${dayOpen ? "text-gray-400" : "text-red-400"}`}>
                  {dayOpen ? t("ss.dayOpen") : t("ss.dayClosed")}
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
                    t={t}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => setDay(day, [...ranges, { ...DEFAULT_RANGE }])}
                  className="flex items-center gap-1.5 text-xs font-black text-primary hover:text-primary-dark transition-colors"
                >
                  <Plus size={14} /> {t("ss.addSlot")}
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
function HolidaysEditor({ holidays, onChange, t }) {
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
                <p className="text-sm font-bold text-gray-800 truncate">{h.name || t("ss.holiday")}</p>
                <p className="text-xs text-gray-400 font-medium">
                  {h.start}{h.end && h.end !== h.start ? ` → ${h.end}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove(h.id)}
                aria-label={t("ss.removeHoliday")}
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
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">{t("ss.from")}</label>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={`mt-1.5 ${dateCls}`} />
        </div>
        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">{t("ss.toOptional")}</label>
          <input type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} className={`mt-1.5 ${dateCls}`} />
        </div>
      </div>
      <FieldInput value={name} onChange={setName} placeholder={t("ss.holidayNamePh")} />
      <button
        type="button"
        onClick={add}
        disabled={!start}
        className="flex items-center justify-center gap-2 w-full py-3 min-h-[44px] rounded-xl border-2 border-primary text-primary font-black hover:bg-primary/5 disabled:opacity-40 transition-colors text-sm"
      >
        <Plus size={16} /> {t("ss.addHoliday")}
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
  const { profile, logout } = useAuth();
  const { t, language, setLanguage, theme, setTheme } = usePreferences();

  // Which menu section is open (null = the grouped menu itself). Stays on the existing
  // /store/settings route — no new router routes.
  const [activeSection, setActiveSection] = useState(null);

  /* store info */
  const [storeName, setStoreName] = useState("");
  const [storeCategory, setStoreCategory] = useState("");
  const [storeDesc, setStoreDesc] = useState("");
  const [storePhone, setStorePhone] = useState("");
  const [extraPhones, setExtraPhones] = useState([]); // additional numbers beyond the primary `phone`
  const [mobile, setMobile] = useState("");
  const [storeEmail, setStoreEmail] = useState("");
  const [storeAddr, setStoreAddr] = useState("");
  const [storeLogo, setStoreLogo] = useState("");
  const [storeBanner, setStoreBanner] = useState("");
  const [mapLink, setMapLink] = useState("");
  const [storeLat, setStoreLat] = useState("");
  const [storeLng, setStoreLng] = useState("");
  const [deliveryRadius, setDeliveryRadius] = useState(String(MAX_DELIVERY_RADIUS_KM));
  const [prepMinutes, setPrepMinutes] = useState(EST_PREP_MINUTES);
  const [social, setSocial] = useState(EMPTY_SOCIAL);
  const [tax, setTax] = useState(EMPTY_TAX);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  // Immediate local preview (object URL) shown while uploading; separate from the
  // saved URL so an in-progress/failed upload never gets written to Firestore.
  const [logoPreview, setLogoPreview] = useState("");
  const [bannerPreview, setBannerPreview] = useState("");
  const [logoErr, setLogoErr] = useState("");
  const [bannerErr, setBannerErr] = useState("");
  const [lastLogoFile, setLastLogoFile] = useState(null);
  const [lastBannerBlob, setLastBannerBlob] = useState(null);
  const [showMapModal, setShowMapModal] = useState(false);
  const [cropFile, setCropFile] = useState(null);   // banner file awaiting crop
  const [errors, setErrors] = useState({});
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

  /* e-payment settings — local draft */
  const [paySettings, setPaySettings] = useState(DEFAULT_PAYMENT);
  const [payErrors, setPayErrors] = useState({});
  const [savingPay, setSavingPay] = useState(false);
  const [savedPay, setSavedPay] = useState(false);

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
      setStoreDesc(d.description || "");
      setStorePhone(d.phone    || "");
      setExtraPhones(Array.isArray(d.phones) ? d.phones : []);
      setMobile(d.mobile || "");
      setStoreEmail(d.email    || "");
      setStoreAddr(d.address   || "");
      setStoreLogo(d.storeLogo || "");
      setStoreBanner(d.storeBanner || "");
      setMapLink(d.mapLink || "");
      setStoreLat(d.lat != null ? String(d.lat) : "");
      setStoreLng(d.lng != null ? String(d.lng) : "");
      setDeliveryRadius(d.deliveryRadius != null ? String(d.deliveryRadius) : String(MAX_DELIVERY_RADIUS_KM));
      setPrepMinutes(d.prepMinutes != null ? d.prepMinutes : EST_PREP_MINUTES);
      setSocial({ ...EMPTY_SOCIAL, ...(d.social || {}) });
      setTax({ ...EMPTY_TAX, ...(d.tax || {}) });
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
      setPaySettings(normalizePayment(d.paymentSettings));
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
    } catch { alert(t("ss.saveFailed")); }
  };

  /* ── opening-hours save (hours + delivery + holidays) ── */
  const handleSaveHours = async () => {
    setSavingHours(true);
    try {
      await updateDoc(doc(db, "stores", STORE_ID), { storeHours, deliveryHours, holidays });
      setSavedHours(true);
      setTimeout(() => setSavedHours(false), 2500);
    } catch { alert(t("ss.saveFailed")); }
    finally { setSavingHours(false); }
  };

  /* ── upload a file/blob to storage and return its URL ── */
  const uploadTo = async (data, kind, name) => {
    const r = ref(storage, `stores/${STORE_ID}/${kind}_${Date.now()}_${name}`);
    await uploadBytes(r, data);
    return getDownloadURL(r);
  };

  /* ── logo: preview immediately, upload, keep preview + retry on failure ── */
  const handleUploadLogo = async (file) => {
    if (!file) return;
    setLogoErr("");
    setLastLogoFile(file);
    setLogoPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(file); });
    setUploadingLogo(true);
    try {
      const url = await uploadTo(file, "logo", file.name);
      setStoreLogo(url);
      setLogoPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return ""; });
    } catch {
      setLogoErr(t("si.uploadError"));
    } finally {
      setUploadingLogo(false); // always clears the "กำลังอัปโหลด" state
    }
  };

  /* ── logo: delete (best-effort remove from storage + clear field) ── */
  const handleDeleteLogo = async () => {
    if (!storeLogo) return;
    if (!window.confirm(t("si.deleteLogoConfirm"))) return;
    const prev = storeLogo;
    setStoreLogo("");
    try {
      await deleteObject(ref(storage, prev));
    } catch { /* file may be gone / not a storage URL — clearing the field is enough */ }
  };

  /* ── banner: crop, preview immediately, upload, keep preview + retry on failure ── */
  const handleBannerCropped = async (blob) => {
    if (!blob) return;
    setCropFile(null);
    setBannerErr("");
    setLastBannerBlob(blob);
    setBannerPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob); });
    setUploadingBanner(true);
    try {
      const url = await uploadTo(blob, "banner", "banner.jpg");
      setStoreBanner(url);
      setBannerPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return ""; });
    } catch {
      setBannerErr(t("si.uploadError"));
    } finally {
      setUploadingBanner(false); // always clears the "กำลังอัปโหลด" state
    }
  };

  /* ── map picker confirm ── */
  const handleConfirmMap = ({ lat, lng }) => {
    setStoreLat(String(lat));
    setStoreLng(String(lng));
    setShowMapModal(false);
  };

  /* ── validation (Phone, Email, Tax ID, Lat, Lng) — empty optional fields pass ── */
  const validateStore = () => {
    const e = {};
    const latNum = parseFloat(storeLat);
    const lngNum = parseFloat(storeLng);
    if (storePhone.trim() && !isValidThaiPhone(storePhone)) e.phone = t("si.errPhone");
    if (mobile.trim() && !isValidThaiPhone(mobile)) e.mobile = t("si.errPhone");
    extraPhones.forEach((p, i) => {
      if (p.trim() && !isValidThaiPhone(p)) e[`extraPhone_${i}`] = t("si.errPhone");
    });
    if (storeEmail.trim() && !isValidEmail(storeEmail)) e.email = t("si.errEmail");
    if (tax.taxId.trim() && !isValidTaxId(tax.taxId)) e.taxId = t("si.errTaxId");
    if (storeLat.trim() && !inRange(latNum, -90, 90)) e.lat = t("si.errLat");
    if (storeLng.trim() && !inRange(lngNum, -180, 180)) e.lng = t("si.errLng");
    return e;
  };

  /* ── store info save ── */
  const handleSaveStore = async () => {
    const e = validateStore();
    setErrors(e);
    if (Object.keys(e).length > 0) return; // block save until fields are clean
    setSavingStore(true);
    try {
      const latNum = parseFloat(storeLat);
      const lngNum = parseFloat(storeLng);
      const radiusNum = parseFloat(deliveryRadius);
      // lat/lng/storeName/phone/address are the exact fields Customer (Checkout) and
      // Rider already read from stores/{STORE_ID} — kept identical so nothing breaks.
      // description/social/tax are new fields on the same doc (no new collection).
      const patch = {
        storeName:   storeName.trim() || "LK Fried Chicken",
        category:    storeCategory.trim(),
        description: storeDesc.trim(),
        phone:       storePhone.trim(),
        // `phone` stays the single primary number Customer/Rider read; `phones` holds
        // the extra numbers so nothing else has to change (no duplicate source of truth).
        phones:      extraPhones.map((p) => p.trim()).filter(Boolean),
        mobile:      mobile.trim(),
        email:       storeEmail.trim(),
        address:     storeAddr.trim(),
        storeLogo,
        storeBanner,
        mapLink:     mapLink.trim(),
        deliveryRadius: Number.isFinite(radiusNum) ? radiusNum : MAX_DELIVERY_RADIUS_KM,
        prepMinutes: Number(prepMinutes),
        social: {
          facebook:  social.facebook.trim(),
          line:      social.line.trim(),
          instagram: social.instagram.trim(),
          tiktok:    social.tiktok.trim(),
          website:   social.website.trim(),
        },
        tax: {
          taxId:       tax.taxId.replace(/[\s-]/g, ""),
          companyName: tax.companyName.trim(),
          branch:      tax.branch.trim(),
        },
      };
      // Only overwrite coordinates when valid, so a bad manual edit can't wipe the
      // store location Customer/Rider depend on.
      if (Number.isFinite(latNum)) patch.lat = latNum;
      if (Number.isFinite(lngNum)) patch.lng = lngNum;
      await updateDoc(doc(db, "stores", STORE_ID), patch);
      setSavedStore(true);
      setTimeout(() => setSavedStore(false), 2500);
    } catch { alert(t("ss.saveFailed")); }
    finally { setSavingStore(false); }
  };

  /* ── notification settings save ── */
  const handleSaveNotif = async () => {
    setSavingNotif(true);
    try {
      await updateDoc(doc(db, "stores", STORE_ID), { notificationSettings: notif });
      setSavedNotif(true);
      setTimeout(() => setSavedNotif(false), 2500);
    } catch { alert(t("ss.saveFailed")); }
    finally { setSavingNotif(false); }
  };

  /* ── e-payment: toggle a method (keeps ≥1 on, repoints default if needed) ── */
  const handleTogglePay = (key, v) =>
    setPaySettings((p) => {
      const next = { ...p, [key]: v };
      if (PAYMENT_KEYS.filter((k) => next[k]).length === 0) return p; // block turning off the last
      return normalizePayment(next);
    });
  const handleDefaultPay = (key) =>
    setPaySettings((p) => (p[key] ? { ...p, default: key } : p));
  const setBank = (key, v) =>
    setPaySettings((p) => ({ ...p, bankTransfer: { ...p.bankTransfer, [key]: v } }));

  /* ── e-payment validation — an enabled method requires its account details;
     a filled field must be well-formed even when its method is off ── */
  const validatePayment = () => {
    const e = {};
    const { promptpay, transfer, promptpayId, bankTransfer: b } = paySettings;
    if (promptpay && !promptpayId.trim()) e.promptpayId = t("sp.errRequired");
    else if (promptpayId.trim() && !isValidPromptPayId(promptpayId)) e.promptpayId = t("sp.errPromptpay");
    if (transfer && !b.bankName.trim()) e.bankName = t("sp.errRequired");
    if (transfer && !b.accountName.trim()) e.accountName = t("sp.errRequired");
    if (transfer && !b.accountNumber.trim()) e.accountNumber = t("sp.errRequired");
    else if (b.accountNumber.trim() && !isValidAccountNumber(b.accountNumber)) e.accountNumber = t("sp.errAccount");
    return e;
  };

  /* ── e-payment settings save ── */
  const handleSavePayment = async () => {
    const e = validatePayment();
    setPayErrors(e);
    if (Object.keys(e).length > 0) return;
    setSavingPay(true);
    try {
      const clean = normalizePayment({
        ...paySettings,
        promptpayId: paySettings.promptpayId.replace(/\D/g, ""),
        bankTransfer: {
          bankName:      paySettings.bankTransfer.bankName.trim(),
          accountName:   paySettings.bankTransfer.accountName.trim(),
          accountNumber: paySettings.bankTransfer.accountNumber.replace(/\D/g, ""),
        },
      });
      await updateDoc(doc(db, "stores", STORE_ID), { paymentSettings: clean });
      setSavedPay(true);
      setTimeout(() => setSavedPay(false), 2500);
    } catch { alert(t("ss.saveFailed")); }
    finally { setSavingPay(false); }
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

  const handleLogout = () => { logout(); };

  // Live storefront status for the badge — reflects unsaved edits too.
  const liveStatus = computeStatus({ isOpen, storeHours, holidays }, new Date(nowTs), "store").status;
  const statusMeta = STATUS_META[liveStatus] || STATUS_META.closed;

  const sec = activeSection;
  const isMenu = sec === null;

  return (
    <div className="p-4 md:p-5 lg:p-6 space-y-5 max-w-[900px] mx-auto">
      {/* Header — shows a back button once inside a section */}
      <div>
        {!isMenu && (
          <button
            type="button"
            onClick={() => setActiveSection(null)}
            className="flex items-center gap-1.5 text-sm font-bold text-gray-500 hover:text-primary transition-colors mb-2"
          >
            <ChevronLeft size={18} /> {t("ss.back")}
          </button>
        )}
        <h1 className="text-xl md:text-2xl font-black text-gray-900">
          {isMenu ? t("ss.title") : t(SECTION_TITLE[sec] || "ss.title")}
        </h1>
        {isMenu && (
          <p className="text-sm text-gray-400 font-medium mt-0.5">{t("ss.subtitle")}</p>
        )}
      </div>

      {/* Grouped menu (default view) */}
      {isMenu && (
        <SettingsMenu t={t} onSelect={setActiveSection} onLogout={handleLogout} />
      )}

      {/* ── Store Info (Store Profile — production) ── */}
      {sec === "store-info" && (<>
      {/* Logo & Banner */}
      <SettingSection icon={ImageIcon} title={t("si.secMedia")} description={t("si.secMediaDesc")}>
        <ImageUpload
          label={t("si.logo")}
          value={logoPreview || storeLogo}
          previewClass="w-16 h-16"
          uploading={uploadingLogo}
          error={logoErr}
          onSelect={handleUploadLogo}
          onDelete={handleDeleteLogo}
          onRetry={() => handleUploadLogo(lastLogoFile)}
          t={t}
        />
        {/* Banner: full-width preview + crop-on-select */}
        <LabeledField label={t("si.banner")}>
          <div className="space-y-3">
            <div className="w-full aspect-[2/1] rounded-xl border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center">
              {(bannerPreview || storeBanner)
                ? <img src={bannerPreview || storeBanner} alt={t("si.banner")} className="w-full h-full object-cover" />
                : <ImageIcon size={24} className="text-gray-300" />}
            </div>
            <div className="flex gap-2">
              <label className="flex items-center justify-center gap-2 flex-1 py-2.5 min-h-[44px] rounded-xl border-2 border-gray-200 hover:border-primary text-gray-600 text-sm font-bold cursor-pointer transition-colors">
                {uploadingBanner ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {uploadingBanner ? t("si.uploading") : storeBanner ? t("si.replace") : t("si.upload")}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploadingBanner}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) setCropFile(f); e.target.value = ""; }}
                />
              </label>
            </div>
            <UploadError error={bannerErr} onRetry={() => lastBannerBlob && handleBannerCropped(lastBannerBlob)} t={t} />
          </div>
        </LabeledField>
      </SettingSection>

      {/* Basic Information */}
      <SettingSection icon={Store} title={t("si.secBasic")} description={t("si.secBasicDesc")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <LabeledField label={t("si.storeName")}>
            <FieldInput value={storeName} onChange={setStoreName} placeholder="LK Fried Chicken" />
          </LabeledField>
          <LabeledField label={t("si.category")}>
            <FieldInput value={storeCategory} onChange={setStoreCategory} placeholder={t("si.categoryPh")} />
          </LabeledField>
        </div>
        <LabeledField label={t("si.description")}>
          <TextArea value={storeDesc} onChange={setStoreDesc} placeholder={t("si.descriptionPh")} rows={4} />
        </LabeledField>
      </SettingSection>

      {/* Social Media (single social section — placed directly under Basic Information) */}
      <SettingSection icon={Link2} title={t("si.secSocial")} description={t("si.secSocialDesc")}>
        <div className="space-y-3">
          {SOCIAL_FIELDS.map(({ key, icon: Icon, labelKey, ph }) => (
            <div key={key} className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Icon size={16} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <FieldInput
                  value={social[key]}
                  onChange={(v) => setSocial((p) => ({ ...p, [key]: v }))}
                  placeholder={`${t(labelKey)} · ${ph}`}
                  type="url"
                />
              </div>
            </div>
          ))}
        </div>
      </SettingSection>

      {/* Contact & Location */}
      <SettingSection icon={MapPin} title={t("si.secContact")} description={t("si.secContactDesc")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <LabeledField label={t("si.phone")}>
              <FieldInput value={storePhone} onChange={setStorePhone} placeholder="08X-XXX-XXXX" type="tel" />
            </LabeledField>
            <FieldError message={errors.phone} />
          </div>
          <div>
            <LabeledField label={t("si.email")}>
              <FieldInput value={storeEmail} onChange={setStoreEmail} placeholder="store@example.com" type="email" />
            </LabeledField>
            <FieldError message={errors.email} />
          </div>
        </div>

        <LabeledField label={t("si.address")}>
          <FieldInput value={storeAddr} onChange={setStoreAddr} placeholder={t("si.addressPh")} />
        </LabeledField>

        {/* Google Maps link + copy */}
        <div>
          <LabeledField label={t("si.mapLink")}>
            <FieldInput value={mapLink} onChange={setMapLink} placeholder="https://maps.google.com/…" type="url" />
          </LabeledField>
          <div className="mt-2 flex flex-col sm:flex-row gap-2">
            <MapButton
              lat={parseFloat(storeLat)}
              lng={parseFloat(storeLng)}
              mapLink={mapLink.trim() || undefined}
              mode="view"
              label={`🗺️ ${t("si.openMap")}`}
              style={{ flex: 1, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 12 }}
            />
            <CopyButton
              text={mapLink}
              label={t("si.copyLink")}
              t={t}
              className="flex items-center justify-center gap-2 flex-1 py-3 min-h-[44px] rounded-xl border-2 border-gray-200 hover:border-primary text-gray-600 text-sm font-bold transition-colors disabled:opacity-40"
            />
          </div>
        </div>

        {/* GPS coordinates */}
        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">{t("si.gps")}</label>
          <div className="mt-1.5 grid grid-cols-2 gap-3">
            <div>
              <FieldInput value={storeLat} onChange={setStoreLat} placeholder={t("si.lat")} type="number" />
              <FieldError message={errors.lat} />
            </div>
            <div>
              <FieldInput value={storeLng} onChange={setStoreLng} placeholder={t("si.lng")} type="number" />
              <FieldError message={errors.lng} />
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowMapModal(true)}
            className="mt-2 flex items-center justify-center gap-2 w-full py-3 min-h-[44px] rounded-xl border-2 border-gray-200 hover:border-primary text-gray-600 text-sm font-bold transition-colors"
          >
            <MapPin size={16} /> {t("si.pickOnMap")}
          </button>
        </div>

        {/* Delivery radius */}
        <LabeledField label={t("si.deliveryRadius")}>
          <FieldInput value={deliveryRadius} onChange={setDeliveryRadius} placeholder="8" type="number" />
        </LabeledField>

        {/* Prep time */}
        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <Clock size={12} /> {t("si.prepTime")}
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
      </SettingSection>

      {/* Tax Information */}
      <SettingSection icon={Receipt} title={t("si.secTax")} description={t("si.secTaxDesc")}>
        <div>
          <LabeledField label={t("si.taxId")}>
            <FieldInput
              value={tax.taxId}
              onChange={(v) => setTax((p) => ({ ...p, taxId: v }))}
              placeholder="0-0000-00000-00-0"
              type="text"
            />
          </LabeledField>
          <FieldError message={errors.taxId} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <LabeledField label={t("si.companyName")}>
            <FieldInput value={tax.companyName} onChange={(v) => setTax((p) => ({ ...p, companyName: v }))} placeholder={t("si.companyName")} />
          </LabeledField>
          <LabeledField label={t("si.branch")}>
            <FieldInput value={tax.branch} onChange={(v) => setTax((p) => ({ ...p, branch: v }))} placeholder={t("si.branchPh")} />
          </LabeledField>
        </div>
      </SettingSection>

      {/* Validation summary + Save */}
      {Object.keys(errors).length > 0 && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-sm font-bold text-red-600">
          <AlertCircle size={16} className="flex-shrink-0" /> {t("si.fixErrors")}
        </div>
      )}
      <button
        onClick={handleSaveStore}
        disabled={savingStore}
        className="flex items-center justify-center gap-2 w-full py-4 rounded-xl bg-primary text-white font-black hover:bg-primary-dark disabled:opacity-50 transition-colors text-sm"
      >
        {savingStore ? <><Loader2 size={16} className="animate-spin" /> {t("si.saving")}</> : savedStore ? <><CheckCircle2 size={16} /> {t("si.saved")}</> : <><Save size={16} /> {t("si.save")}</>}
      </button>
      </>)}

      {/* ── Contact (production — multi-phone, mobile, email, LINE, web & social) ── */}
      {sec === "contact" && (<>
      {/* Phone & Mobile */}
      <SettingSection icon={Phone} title={t("sc.secPhone")} description={t("sc.secPhoneDesc")}>
        {/* Primary phone (this is the shared `phone` Customer/Rider read) */}
        <div>
          <LabeledField label={t("sc.primaryPhone")}>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <FieldInput value={storePhone} onChange={setStorePhone} placeholder="08X-XXX-XXXX" type="tel" />
              </div>
              <LinkIconButton href={telHref(storePhone)} icon={PhoneCall} label={t("sc.call")} external={false} />
              <CopyButton text={storePhone} t={t} />
            </div>
          </LabeledField>
          <FieldError message={errors.phone} />
        </div>

        {/* Additional phone numbers (add / edit / delete) */}
        {extraPhones.map((p, i) => (
          <div key={i}>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <FieldInput
                  value={p}
                  onChange={(v) => setExtraPhones((prev) => prev.map((x, j) => (j === i ? v : x)))}
                  placeholder="0X-XXX-XXXX"
                  type="tel"
                />
              </div>
              <LinkIconButton href={telHref(p)} icon={PhoneCall} label={t("sc.call")} external={false} />
              <CopyButton text={p} t={t} />
              <button
                type="button"
                onClick={() => setExtraPhones((prev) => prev.filter((_, j) => j !== i))}
                aria-label={t("si.delete")}
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
              >
                <Trash2 size={16} />
              </button>
            </div>
            <FieldError message={errors[`extraPhone_${i}`]} />
          </div>
        ))}

        <button
          type="button"
          onClick={() => setExtraPhones((prev) => [...prev, ""])}
          className="flex items-center gap-1.5 text-xs font-black text-primary hover:text-primary-dark transition-colors"
        >
          <Plus size={14} /> {t("sc.addPhone")}
        </button>

        {/* Mobile */}
        <div className="pt-4 border-t border-gray-50">
          <LabeledField label={t("sc.mobile")}>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <FieldInput value={mobile} onChange={setMobile} placeholder="08X-XXX-XXXX" type="tel" />
              </div>
              <LinkIconButton href={telHref(mobile)} icon={PhoneCall} label={t("sc.call")} external={false} />
              <CopyButton text={mobile} t={t} />
            </div>
          </LabeledField>
          <FieldError message={errors.mobile} />
        </div>
      </SettingSection>

      {/* Email & Messaging */}
      <SettingSection icon={Mail} title={t("sc.secOnline")} description={t("sc.secOnlineDesc")}>
        <div>
          <LabeledField label={t("si.email")}>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <FieldInput value={storeEmail} onChange={setStoreEmail} placeholder="store@example.com" type="email" />
              </div>
              <LinkIconButton href={mailHref(storeEmail)} icon={Mail} label={t("si.email")} external={false} />
              <CopyButton text={storeEmail} t={t} />
            </div>
          </LabeledField>
          <FieldError message={errors.email} />
        </div>

        <LabeledField label={t("sc.lineOa")}>
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <FieldInput value={social.line} onChange={(v) => setSocial((p) => ({ ...p, line: v }))} placeholder="@yourlineid" />
            </div>
            <LinkIconButton href={lineHref(social.line)} icon={MessageCircle} label={t("sc.openLine")} />
          </div>
        </LabeledField>
      </SettingSection>

      {Object.keys(errors).length > 0 && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-sm font-bold text-red-600">
          <AlertCircle size={16} className="flex-shrink-0" /> {t("si.fixErrors")}
        </div>
      )}
      <button
        onClick={handleSaveStore}
        disabled={savingStore}
        className="flex items-center justify-center gap-2 w-full py-4 rounded-xl bg-primary text-white font-black hover:bg-primary-dark disabled:opacity-50 transition-colors text-sm"
      >
        {savingStore ? <><Loader2 size={16} className="animate-spin" /> {t("si.saving")}</> : savedStore ? <><CheckCircle2 size={16} /> {t("si.saved")}</> : <><Save size={16} /> {t("si.save")}</>}
      </button>
      </>)}

      {/* ── Appearance (Theme selector — reuses PreferencesContext setTheme, which
             persists to localStorage + users/{uid}, so no new storage/schema) ── */}
      {sec === "appearance" && (
      <SettingSection icon={Moon} title={t("settings.theme")} description={t("settings.themeDesc")}>
        <div className="grid grid-cols-3 gap-2">
          {[
            { key: "light",  icon: Sun },
            { key: "dark",   icon: Moon },
            { key: "system", icon: Monitor },
          ].map(({ key, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTheme(key)}
              aria-pressed={theme === key}
              className={`flex flex-col items-center justify-center gap-2 p-4 min-h-[72px] rounded-xl border-2 transition-colors
                ${theme === key ? "border-primary bg-primary/5 text-primary" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}
            >
              <Icon size={20} />
              <span className="text-sm font-bold">{t(`settings.${key}`)}</span>
            </button>
          ))}
        </div>
      </SettingSection>
      )}

      {/* ── Open / Close Store (master switch) ── */}
      {sec === "open-close" && (
      <SettingSection icon={Power} title={t("ss.storeStatus")} description={t("ss.storeStatusDesc")}>
        <SettingRow
          label={isOpen ? t("ss.storeIsOpen") : t("ss.storeIsClosed")}
          description={isOpen ? t("ss.acceptingOrders") : t("ss.notAcceptingOrders")}
        >
          <div className="flex items-center gap-3">
            <span className={`text-xs font-black px-3 py-1.5 rounded-full ${statusMeta.cls}`}>{t(statusMeta.labelKey)}</span>
            <Toggle value={isOpen} onChange={handleToggleOpen} />
          </div>
        </SettingRow>
      </SettingSection>
      )}

      {/* ── Opening Hours (store + delivery + holidays) ── */}
      {sec === "hours" && (<>
      <SettingSection icon={Clock} title={t("ss.storeHoursTitle")} description={t("ss.storeHoursDesc")}>
        <DayHoursEditor hours={storeHours} onChange={setStoreHours} t={t} />
      </SettingSection>

      {/* ── Delivery Hours ── */}
      <SettingSection icon={Truck} title={t("ss.deliveryHoursTitle")} description={t("ss.deliveryHoursDesc")}>
        <DayHoursEditor hours={deliveryHours} onChange={setDeliveryHours} t={t} />
      </SettingSection>

      {/* ── Special Holidays ── */}
      <SettingSection icon={CalendarX} title={t("ss.specialHolidays")} description={t("ss.specialHolidaysDesc")}>
        <HolidaysEditor holidays={holidays} onChange={setHolidays} t={t} />
      </SettingSection>

      {/* Save all opening-hours settings */}
      <button
        onClick={handleSaveHours}
        disabled={savingHours}
        className="flex items-center justify-center gap-2 w-full py-4 rounded-xl bg-primary text-white font-black hover:bg-primary-dark disabled:opacity-50 transition-colors text-sm"
      >
        {savingHours ? <><Loader2 size={16} className="animate-spin" /> {t("si.saving")}</> : savedHours ? <><CheckCircle2 size={16} /> {t("si.saved")}</> : <><Save size={16} /> {t("ss.saveOpeningHours")}</>}
      </button>
      </>)}

      {/* ── Notifications (sound + night mode + receipt) ── */}
      {sec === "notifications" && (<>
      <SettingSection icon={Bell} title={t("ss.notifSound")} description={t("ss.notifSoundDesc")}>
        {/* Master enable */}
        <SettingRow label={t("ss.enableAlert")} description={t("ss.enableAlertDesc")}>
          <Toggle value={notif.enabled} onChange={(v) => setN("enabled", v)} />
        </SettingRow>

        {notif.enabled && (
          <>
            {/* Volume */}
            <div className="pt-4 border-t border-gray-50">
              <p className="text-sm font-bold text-gray-800 mb-3">{t("ss.alertVolume")}</p>
              <VolumePicker value={notif.volume} onChange={(v) => setN("volume", v)} />
            </div>

            {/* Sound type */}
            <div className="pt-4 border-t border-gray-50">
              <p className="text-sm font-bold text-gray-800 mb-3">{t("ss.alarmSound")}</p>
              <SoundSelector value={notif.sound} onChange={(v) => setN("sound", v)} />
            </div>

            {/* Test button */}
            <button
              onClick={handleTestSound}
              disabled={testingSound}
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl border-2 border-primary text-primary font-black hover:bg-primary/5 disabled:opacity-50 transition-colors text-sm"
            >
              <Play size={16} />
              {testingSound ? t("ss.playing") : t("ss.testSound")}
            </button>
          </>
        )}

        {/* Save */}
        <button
          onClick={handleSaveNotif}
          disabled={savingNotif}
          className="flex items-center justify-center gap-2 w-full py-4 rounded-xl bg-primary text-white font-black hover:bg-primary-dark disabled:opacity-50 transition-colors text-sm"
        >
          {savingNotif ? <><Loader2 size={16} className="animate-spin" /> {t("si.saving")}</> : savedNotif ? <><CheckCircle2 size={16} /> {t("si.saved")}</> : <><Save size={16} /> {t("ss.saveSoundSettings")}</>}
        </button>
      </SettingSection>

      {/* ── Night Mode ── */}
      <SettingSection icon={Moon} title={t("ss.nightMode")} description={t("ss.nightModeDesc")}>
        <SettingRow label={t("ss.enableNightMode")} description={t("ss.enableNightModeDesc")}>
          <Toggle value={notif.nightMode?.enabled ?? false} onChange={(v) => setNM("enabled", v)} />
        </SettingRow>

        {notif.nightMode?.enabled && (
          <>
            <div className="pt-4 border-t border-gray-50 grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">{t("ss.startTime")}</label>
                <input
                  type="time"
                  value={notif.nightMode?.startTime || "22:00"}
                  onChange={(e) => setNM("startTime", e.target.value)}
                  className="mt-1.5 w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm font-bold text-gray-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">{t("ss.endTime")}</label>
                <input
                  type="time"
                  value={notif.nightMode?.endTime || "07:00"}
                  onChange={(e) => setNM("endTime", e.target.value)}
                  className="mt-1.5 w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm font-bold text-gray-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-gray-50">
              <p className="text-sm font-bold text-gray-800 mb-3">{t("ss.nightVolume")}</p>
              <VolumePicker value={notif.nightMode?.volume ?? 30} onChange={(v) => setNM("volume", v)} />
            </div>
          </>
        )}

        <button
          onClick={handleSaveNotif}
          disabled={savingNotif}
          className="flex items-center justify-center gap-2 w-full py-4 rounded-xl bg-primary text-white font-black hover:bg-primary-dark disabled:opacity-50 transition-colors text-sm"
        >
          {savingNotif ? <><Loader2 size={16} className="animate-spin" /> {t("si.saving")}</> : savedNotif ? <><CheckCircle2 size={16} /> {t("si.saved")}</> : <><Save size={16} /> {t("ss.saveNightMode")}</>}
        </button>
      </SettingSection>

      {/* ── Printing ── */}
      <SettingSection icon={Printer} title={t("ss.receiptPrinting")} description={t("ss.receiptPrintingDesc")}>
        <SettingRow label={t("ss.autoPrint")} description={t("ss.autoPrintDesc")}>
          <Toggle value={autoPrint} onChange={handleAutoPrint} />
        </SettingRow>
        <div className="pt-2 border-t border-gray-50">
          <SettingRow label={t("ss.autoScroll")} description={t("ss.autoScrollDesc")}>
            <Toggle value={autoScroll} onChange={handleAutoScroll} />
          </SettingRow>
        </div>
        <div className="pt-2 border-t border-gray-50">
          <SettingRow label={t("ss.defaultReceiptSize")} description={t("ss.defaultReceiptSizeDesc")}>
            <select
              value={printSize}
              onChange={(e) => handlePrintSize(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-700 outline-none focus:border-primary bg-white"
            >
              <option value="58mm">58mm</option>
              <option value="80mm">80mm</option>
              <option value="a4">{t("ss.a4Invoice")}</option>
            </select>
          </SettingRow>
        </div>
      </SettingSection>
      </>)}

      {/* ── Account ── */}
      {sec === "account" && (
      <SettingSection icon={User} title={t("ss.myAccountTitle")} description={t("ss.myAccountDesc")}>
        <SettingRow label={t("ss.emailLabel")} description={t("ss.emailDesc")}>
          <span className="text-sm font-bold text-gray-500">{profile?.email || "—"}</span>
        </SettingRow>
        <div className="pt-2 border-t border-gray-50">
          <SettingRow label={t("ss.roleLabel")} description={t("ss.roleDesc")}>
            <span className="text-xs font-bold px-3 py-1.5 bg-primary/10 text-primary rounded-full">{t("ss.storeManager")}</span>
          </SettingRow>
        </div>
        <div className="pt-2 border-t border-gray-50">
          <SettingRow label={t("ss.storeIdLabel")} description={t("ss.storeIdDesc")}>
            <span className="text-xs font-mono text-gray-400">{STORE_ID}</span>
          </SettingRow>
        </div>
      </SettingSection>
      )}

      {/* ── Language (reuses the shared i18n language switch) ── */}
      {sec === "language" && (
      <SettingSection icon={Globe} title={t("ss.language")} description={t("ss.languageDesc")}>
        <SettingRow label={t("ss.language")}>
          <div className="flex gap-1 bg-gray-50 rounded-2xl p-1">
            {[{ value: "en", label: "EN" }, { value: "th", label: "TH" }].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setLanguage(opt.value)}
                className={`px-4 py-2 min-h-[40px] rounded-xl text-xs font-black transition-all ${language === opt.value ? "bg-primary text-white" : "text-gray-500"}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </SettingRow>
      </SettingSection>
      )}

      {/* ── E-Payment (accepted methods + default) ── */}
      {sec === "payment" && (<>
      <SettingSection icon={CreditCard} title={t("sp.secMethods")} description={t("sp.secMethodsDesc")}>
        {PAYMENT_METHODS.map(({ key, icon: Icon, labelKey, descKey }, idx) => (
          <div key={key} className={idx > 0 ? "pt-4 border-t border-gray-50" : ""}>
            <div className="flex items-center justify-between gap-4 min-h-[48px]">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon size={16} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-800">{t(labelKey)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{t(descKey)}</p>
                </div>
              </div>
              <Toggle value={!!paySettings[key]} onChange={(v) => handleTogglePay(key, v)} />
            </div>
          </div>
        ))}
        <p className="text-xs font-medium text-gray-400">{t("sp.needOne")}</p>
      </SettingSection>

      {/* PromptPay configuration — shown when the method is enabled */}
      {paySettings.promptpay && (
      <SettingSection icon={QrCode} title={t("sp.secPromptpay")} description={t("sp.secPromptpayDesc")}>
        <div>
          <LabeledField label={t("sp.promptpayId")}>
            <FieldInput
              value={paySettings.promptpayId}
              onChange={(v) => setPaySettings((p) => ({ ...p, promptpayId: v }))}
              placeholder="08X-XXX-XXXX / 1-XXXX-XXXXX-XX-X"
              type="tel"
            />
          </LabeledField>
          <FieldError message={payErrors.promptpayId} />
        </div>
        {promptPayQrUrl(paySettings.promptpayId) && (
          <div className="flex flex-col items-center gap-2 pt-2">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">{t("sp.qrPreview")}</span>
            <img
              src={promptPayQrUrl(paySettings.promptpayId)}
              alt={t("sp.qrPreview")}
              className="w-44 h-44 rounded-xl border border-gray-200 bg-white p-2 object-contain"
            />
          </div>
        )}
      </SettingSection>
      )}

      {/* Bank Transfer configuration — shown when the method is enabled */}
      {paySettings.transfer && (
      <SettingSection icon={Landmark} title={t("sp.secBank")} description={t("sp.secBankDesc")}>
        <div>
          <LabeledField label={t("sp.bankName")}>
            <FieldInput value={paySettings.bankTransfer.bankName} onChange={(v) => setBank("bankName", v)} placeholder={t("sp.bankNamePh")} />
          </LabeledField>
          <FieldError message={payErrors.bankName} />
        </div>
        <div>
          <LabeledField label={t("sp.accountName")}>
            <FieldInput value={paySettings.bankTransfer.accountName} onChange={(v) => setBank("accountName", v)} placeholder={t("sp.accountNamePh")} />
          </LabeledField>
          <FieldError message={payErrors.accountName} />
        </div>
        <div>
          <LabeledField label={t("sp.accountNumber")}>
            <FieldInput value={paySettings.bankTransfer.accountNumber} onChange={(v) => setBank("accountNumber", v)} placeholder="XXX-X-XXXXX-X" type="tel" />
          </LabeledField>
          <FieldError message={payErrors.accountNumber} />
        </div>
      </SettingSection>
      )}

      {/* Default method — chosen from the enabled ones only */}
      <SettingSection icon={CheckCircle2} title={t("sp.secDefault")} description={t("sp.secDefaultDesc")}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {PAYMENT_METHODS.filter((m) => paySettings[m.key]).map(({ key, icon: Icon, labelKey }) => {
            const active = paySettings.default === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleDefaultPay(key)}
                className={`flex items-center gap-3 p-4 min-h-[56px] rounded-xl border-2 text-left transition-colors
                  ${active ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300 bg-white"}`}
              >
                <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${active ? "border-primary" : "border-gray-300"}`}>
                  {active && <div className="w-2 h-2 rounded-full bg-primary" />}
                </div>
                <Icon size={16} className={active ? "text-primary" : "text-gray-400"} />
                <span className={`flex-1 text-sm font-bold ${active ? "text-primary" : "text-gray-700"}`}>{t(labelKey)}</span>
              </button>
            );
          })}
        </div>
      </SettingSection>

      {Object.keys(payErrors).length > 0 && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-sm font-bold text-red-600">
          <AlertCircle size={16} className="flex-shrink-0" /> {t("si.fixErrors")}
        </div>
      )}
      <button
        onClick={handleSavePayment}
        disabled={savingPay}
        className="flex items-center justify-center gap-2 w-full py-4 rounded-xl bg-primary text-white font-black hover:bg-primary-dark disabled:opacity-50 transition-colors text-sm"
      >
        {savingPay ? <><Loader2 size={16} className="animate-spin" /> {t("si.saving")}</> : savedPay ? <><CheckCircle2 size={16} /> {t("si.saved")}</> : <><Save size={16} /> {t("sp.save")}</>}
      </button>
      </>)}

      {/* ── Placeholder sections (not built yet) ── */}
      {(sec === "staff" || sec === "help" || sec === "privacy" || sec === "terms") && (
        <PlaceholderSection t={t} />
      )}

      {isMenu && (
      <div className="text-center py-4">
        <p className="text-xs text-gray-300 font-medium">LK Fried Chicken — Store Portal</p>
        <p className="text-[10px] text-gray-200 mt-0.5">Production v4 · Module 4+</p>
      </div>
      )}

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

      {/* Banner cropper — opens when a banner file is picked, uploads the cropped blob */}
      {cropFile && (
        <BannerCropper
          file={cropFile}
          onCancel={() => setCropFile(null)}
          onCropped={handleBannerCropped}
        />
      )}
    </div>
  );
}
