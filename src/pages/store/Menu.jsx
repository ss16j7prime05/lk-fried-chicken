import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  AlertTriangle,
  CheckSquare,
  ChevronDown,
  Copy,
  Eye,
  Grid3x3,
  Image,
  LayoutList,
  Loader2,
  Pencil,
  Plus,
  Search,
  Square,
  Star,
  Trash2,
  UtensilsCrossed,
  WifiOff,
  X,
  Clock,
  ArrowDownUp,
  SlidersHorizontal,
  CheckCheck,
  XCircle,
} from "lucide-react";
import { db, storage } from "../../firebase";
import { STORE_ID } from "../../config";

/* ═══════════════════════ constants ═══════════════════════ */
const PAGE_SIZE = 50;

const DEFAULT_CATEGORIES = [
  "ข้าวหน้าไก่ทอด",
  "อาหารทานเล่น",
  "เครื่องดื่ม",
  "เซ็ตรวม",
];

const SORT_OPTIONS = [
  { key: "displayOrder", label: "Display Order" },
  { key: "name_asc",    label: "Name A→Z"      },
  { key: "name_desc",   label: "Name Z→A"      },
  { key: "price_asc",   label: "Price Low→High" },
  { key: "price_desc",  label: "Price High→Low" },
  { key: "newest",      label: "Newest First"  },
  { key: "oldest",      label: "Oldest First"  },
];

const EMPTY_FORM = {
  name: "",
  description: "",
  category: DEFAULT_CATEGORIES[0],
  price: "",
  cost: "",
  image: "",
  available: true,
  popular: false,
  cookingTime: "",
  displayOrder: "",
};

/* ═══════════════════════ helpers ═══════════════════════ */
const fmtMoney = (n) => Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 0 });
const fmtDate = (ts) => {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
};

/* ═══════════════════════ image upload ═══════════════════════ */
async function uploadMenuImage(file) {
  const storageRef = ref(storage, `menus/${Date.now()}_${file.name}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

/* ═══════════════════════ Menu Card skeleton ═══════════════════════ */
function MenuSkeleton({ grid }) {
  if (!grid) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 flex items-center gap-4 p-4 animate-pulse">
        <div className="w-16 h-16 rounded-xl bg-gray-100 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-32 bg-gray-100 rounded" />
          <div className="h-3 w-20 bg-gray-100 rounded" />
        </div>
        <div className="h-6 w-16 bg-gray-100 rounded-full" />
      </div>
    );
  }
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
      <div className="h-44 bg-gray-100" />
      <div className="p-4 space-y-2">
        <div className="h-4 w-3/4 bg-gray-100 rounded" />
        <div className="h-3 w-1/2 bg-gray-100 rounded" />
        <div className="h-5 w-1/3 bg-gray-100 rounded" />
      </div>
    </div>
  );
}

/* ═══════════════════════ Availability big switch ═══════════════════════ */
function AvailabilitySwitch({ available, onChange, size = "sm" }) {
  return (
    <button
      onClick={() => onChange(!available)}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
        ${available ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-red-100 text-red-600 hover:bg-red-200"}`}
    >
      <span className={`w-2 h-2 rounded-full ${available ? "bg-green-500" : "bg-red-400"} ${available ? "animate-pulse" : ""}`} />
      {available ? "Selling" : "Sold Out"}
    </button>
  );
}

/* ═══════════════════════ Preview Modal ═══════════════════════ */
function PreviewModal({ menu, onClose }) {
  if (!menu) return null;
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="relative">
          {menu.image ? (
            <img src={menu.image} alt={menu.name} className="w-full h-56 object-cover" />
          ) : (
            <div className="w-full h-56 bg-gray-100 flex items-center justify-center">
              <UtensilsCrossed size={40} className="text-gray-300" />
            </div>
          )}
          <button onClick={onClose} className="absolute top-3 right-3 p-2 rounded-full bg-black/40 text-white hover:bg-black/60">
            <X size={18} />
          </button>
          {menu.popular && (
            <span className="absolute top-3 left-3 flex items-center gap-1 bg-amber-400 text-white text-xs font-black px-2.5 py-1 rounded-full">
              <Star size={11} /> Popular
            </span>
          )}
        </div>
        <div className="p-5 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xl font-black text-gray-900">{menu.name}</p>
              <p className="text-xs font-bold text-gray-400 mt-0.5">{menu.category}</p>
            </div>
            <p className="text-xl font-black text-primary whitespace-nowrap">฿{fmtMoney(menu.price)}</p>
          </div>
          {menu.description && <p className="text-sm text-gray-600">{menu.description}</p>}
          <div className="flex items-center gap-3 flex-wrap">
            <AvailabilitySwitch available={menu.available !== false} onChange={() => {}} />
            {menu.cookingTime && (
              <span className="flex items-center gap-1 text-xs font-bold text-gray-500"><Clock size={12} />{menu.cookingTime} min</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════ Delete Confirmation ═══════════════════════ */
function DeleteDialog({ item, onConfirm, onCancel }) {
  if (!item) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xs p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <Trash2 size={18} className="text-red-500" />
          </div>
          <div>
            <p className="font-black text-gray-900">Delete Menu?</p>
            <p className="text-xs text-gray-400 mt-0.5">This action cannot be undone.</p>
          </div>
        </div>
        <p className="text-sm text-gray-700 bg-gray-50 rounded-xl px-3 py-2 font-bold truncate mb-4">{item.name}</p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-black hover:bg-gray-200">Cancel</button>
          <button onClick={() => onConfirm(item.id)} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-black hover:bg-red-600">Delete</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════ Image upload field ═══════════════════════ */
function ImageField({ value, onChange }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadMenuImage(file);
      onChange(url);
    } catch {
      alert("Image upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Image</label>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Paste image URL…"
          className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50 flex-shrink-0"
        >
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Image size={14} />}
          Upload
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
      {value && (
        <div className="relative">
          <img src={value} alt="preview" className="w-full h-32 object-cover rounded-xl border border-gray-100" />
          <button onClick={() => onChange("")} className="absolute top-2 right-2 p-1 rounded-full bg-black/40 text-white hover:bg-black/60">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════ Menu Drawer (Add / Edit) ═══════════════════════ */
function MenuDrawer({ menu, categories, onClose, onSave }) {
  const isEdit = !!menu?.id;
  const [form, setForm] = useState(() =>
    menu
      ? { name: menu.name || "", description: menu.description || "", category: menu.category || DEFAULT_CATEGORIES[0], price: menu.price || "", cost: menu.cost || "", image: menu.image || "", available: menu.available !== false, popular: menu.popular || false, cookingTime: menu.cookingTime || "", displayOrder: menu.displayOrder || "" }
      : { ...EMPTY_FORM, category: categories[0] || DEFAULT_CATEGORIES[0] }
  );
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (key, val) => {
    setForm((f) => ({ ...f, [key]: val }));
    setErrors((e) => { const n = { ...e }; delete n[key]; return n; });
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.price || Number(form.price) <= 0) e.price = "Price must be greater than 0";
    if (!form.category) e.category = "Category is required";
    return e;
  };

  const handleSave = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      await onSave(form, menu?.id);
      onClose();
    } catch {
      alert("Save failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const Field = ({ label, error, children }) => (
    <div>
      <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">{label}{error && <span className="ml-2 text-red-400 normal-case font-bold text-[10px]">{error}</span>}</label>
      <div className="mt-1">{children}</div>
    </div>
  );

  const inputCls = (err) => `w-full px-3 py-2.5 rounded-xl border text-sm font-medium outline-none transition ${err ? "border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100" : "border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20"}`;

  const allCats = useMemo(() => {
    const set = new Set([...DEFAULT_CATEGORIES, ...categories]);
    return [...set];
  }, [categories]);

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full sm:max-w-lg bg-white shadow-2xl flex flex-col animate-[slideIn_0.2s_ease]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <p className="text-base font-black text-gray-900">{isEdit ? "Edit Menu Item" : "Add Menu Item"}</p>
          <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <Field label="Menu Name *" error={errors.name}>
            <input value={form.name} onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Crispy Fried Chicken" className={inputCls(errors.name)} autoFocus />
          </Field>

          <Field label="Description">
            <textarea value={form.description} onChange={(e) => set("description", e.target.value)}
              placeholder="Short description (optional)…" rows={2}
              className={`${inputCls(false)} resize-none`} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Category *" error={errors.category}>
              <select value={form.category} onChange={(e) => set("category", e.target.value)} className={inputCls(errors.category)}>
                {allCats.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Display Order">
              <input type="number" value={form.displayOrder} onChange={(e) => set("displayOrder", e.target.value)}
                placeholder="0" min={0} className={inputCls(false)} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Price (฿) *" error={errors.price}>
              <input type="number" value={form.price} onChange={(e) => set("price", e.target.value)}
                placeholder="0" min={0} step={0.01} className={inputCls(errors.price)} />
            </Field>
            <Field label="Cost (฿)">
              <input type="number" value={form.cost} onChange={(e) => set("cost", e.target.value)}
                placeholder="0 (for profit calc)" min={0} className={inputCls(false)} />
            </Field>
          </div>

          <Field label="Cooking Time (min)">
            <input type="number" value={form.cookingTime} onChange={(e) => set("cookingTime", e.target.value)}
              placeholder="e.g. 15" min={1} className={inputCls(false)} />
          </Field>

          <ImageField value={form.image} onChange={(v) => set("image", v)} />

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-2xl p-3">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2">Availability</p>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-gray-700">{form.available ? "Selling" : "Sold Out"}</span>
                <button onClick={() => set("available", !form.available)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${form.available ? "bg-primary" : "bg-gray-300"}`}>
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.available ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>
            </div>
            <div className="bg-gray-50 rounded-2xl p-3">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2">Popular</p>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-gray-700">{form.popular ? "Yes" : "No"}</span>
                <button onClick={() => set("popular", !form.popular)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${form.popular ? "bg-amber-400" : "bg-gray-300"}`}>
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.popular ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 px-5 py-4 flex gap-3 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-black hover:bg-gray-200">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-3 rounded-xl bg-primary text-white font-black hover:bg-primary-dark disabled:opacity-50 flex items-center justify-center gap-2">
            {saving && <Loader2 size={16} className="animate-spin" />}
            {isEdit ? "Save Changes" : "Add Menu"}
          </button>
        </div>
      </div>
      <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
    </>
  );
}

/* ═══════════════════════ Menu Card (grid) ═══════════════════════ */
export const MenuCard = memo(function MenuCard({ menu, selected, onSelect, onEdit, onDuplicate, onDelete, onToggleAvail, onPreview }) {
  const isAvail = menu.available !== false;
  return (
    <div className={`bg-white rounded-2xl border overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5
      ${selected ? "border-primary ring-2 ring-primary/20" : isAvail ? "border-gray-100" : "border-gray-100 opacity-75"}`}>
      {/* image */}
      <div className="relative">
        <div className="h-44 bg-gray-50 overflow-hidden">
          {menu.image
            ? <img src={menu.image} alt={menu.name} className="w-full h-full object-cover" loading="lazy" />
            : <div className="w-full h-full flex items-center justify-center"><UtensilsCrossed size={32} className="text-gray-200" /></div>
          }
        </div>
        {/* overlays */}
        <div className="absolute top-2 left-2 flex gap-1.5 flex-wrap">
          {menu.popular && (
            <span className="flex items-center gap-1 bg-amber-400 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
              <Star size={10} /> Popular
            </span>
          )}
          {!isAvail && (
            <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">Sold Out</span>
          )}
        </div>
        {/* select checkbox */}
        <button onClick={(e) => { e.stopPropagation(); onSelect(menu.id); }}
          className="absolute top-2 right-2 text-white drop-shadow focus-visible:outline-none">
          {selected ? <CheckSquare size={20} className="text-primary drop-shadow" /> : <Square size={20} className="text-white/80 hover:text-white" />}
        </button>
      </div>

      {/* info */}
      <div className="p-3 space-y-1">
        <p className="font-black text-gray-900 truncate text-sm">{menu.name}</p>
        <p className="text-[10px] font-bold text-gray-400 truncate">{menu.category}</p>
        <div className="flex items-center justify-between mt-1">
          <p className="text-base font-black text-primary">฿{fmtMoney(menu.price)}</p>
          <AvailabilitySwitch available={isAvail} onChange={() => onToggleAvail(menu)} />
        </div>
        {menu.cookingTime && (
          <p className="text-[10px] text-gray-400 flex items-center gap-1"><Clock size={10} />{menu.cookingTime} min</p>
        )}
        <p className="text-[10px] text-gray-300">Updated {fmtDate(menu.updatedAt || menu.createdAt)}</p>
      </div>

      {/* quick actions */}
      <div className="flex items-center border-t border-gray-50 px-1 py-1">
        <button onClick={() => onPreview(menu)} title="Preview" className="flex-1 flex items-center justify-center p-2 rounded-lg text-gray-400 hover:bg-gray-50 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Eye size={15} /></button>
        <button onClick={() => onEdit(menu)} title="Edit" className="flex-1 flex items-center justify-center p-2 rounded-lg text-gray-400 hover:bg-gray-50 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Pencil size={15} /></button>
        <button onClick={() => onDuplicate(menu)} title="Duplicate" className="flex-1 flex items-center justify-center p-2 rounded-lg text-gray-400 hover:bg-gray-50 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Copy size={15} /></button>
        <button onClick={() => onDelete(menu)} title="Delete" className="flex-1 flex items-center justify-center p-2 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"><Trash2 size={15} /></button>
      </div>
    </div>
  );
});

/* ═══════════════════════ Menu Row (list view) ═══════════════════════ */
export const MenuRow = memo(function MenuRow({ menu, selected, onSelect, onEdit, onDuplicate, onDelete, onToggleAvail, onPreview }) {
  const isAvail = menu.available !== false;
  return (
    <div className={`bg-white rounded-2xl border flex items-center gap-4 px-4 py-3 transition-all hover:shadow-sm
      ${selected ? "border-primary ring-2 ring-primary/20" : "border-gray-100"}`}>
      <button onClick={() => onSelect(menu.id)} className="text-gray-400 hover:text-primary flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">
        {selected ? <CheckSquare size={18} className="text-primary" /> : <Square size={18} />}
      </button>

      {/* image */}
      <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-50 flex-shrink-0 flex items-center justify-center">
        {menu.image
          ? <img src={menu.image} alt={menu.name} className="w-full h-full object-cover" loading="lazy" />
          : <UtensilsCrossed size={20} className="text-gray-200" />
        }
      </div>

      {/* info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-black text-gray-900 text-sm truncate">{menu.name}</p>
          {menu.popular && <span className="flex items-center gap-0.5 text-[10px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full"><Star size={9} />Popular</span>}
        </div>
        <p className="text-[10px] font-bold text-gray-400">{menu.category}</p>
      </div>

      <p className="font-black text-primary text-base flex-shrink-0">฿{fmtMoney(menu.price)}</p>
      <AvailabilitySwitch available={isAvail} onChange={() => onToggleAvail(menu)} />

      {/* actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={() => onPreview(menu)} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700" title="Preview"><Eye size={15} /></button>
        <button onClick={() => onEdit(menu)} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700" title="Edit"><Pencil size={15} /></button>
        <button onClick={() => onDuplicate(menu)} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700" title="Duplicate"><Copy size={15} /></button>
        <button onClick={() => onDelete(menu)} className="p-2 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500" title="Delete"><Trash2 size={15} /></button>
      </div>
    </div>
  );
});

/* ═══════════════════════ Empty / Offline / Error states ═══════════════════════ */
function PageState({ type, onAdd }) {
  const cfg = {
    empty:   { icon: UtensilsCrossed, title: "No menu items yet",       sub: "Add your first menu item to get started." },
    search:  { icon: UtensilsCrossed, title: "No items match",          sub: "Try a different search or filter."         },
    offline: { icon: WifiOff,         title: "You're offline",          sub: "Reconnect to manage your menu."           },
    error:   { icon: AlertTriangle,   title: "Something went wrong",    sub: "Refresh the page and try again."          },
  }[type] || { icon: UtensilsCrossed, title: "Nothing here", sub: "" };
  const Icon = cfg.icon;
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center bg-white rounded-2xl border border-gray-100">
      <Icon size={40} className="mb-3 text-gray-200" />
      <p className="font-bold text-gray-400 text-sm">{cfg.title}</p>
      {cfg.sub && <p className="text-xs text-gray-300 mt-1">{cfg.sub}</p>}
      {type === "empty" && onAdd && (
        <button onClick={onAdd} className="mt-5 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-black hover:bg-primary-dark">
          <Plus size={16} /> Add First Item
        </button>
      )}
    </div>
  );
}

/* ═══════════════════════ Main Menu page ═══════════════════════ */
export function Menu() {
  const [menus, setMenus]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [errored, setErrored]   = useState(false);
  const [online, setOnline]     = useState(navigator.onLine);

  // ui state
  const [search, setSearch]         = useState("");
  const [catFilter, setCatFilter]   = useState("all");
  const [sortBy, setSortBy]         = useState("displayOrder");
  const [viewMode, setViewMode]     = useState(() => localStorage.getItem("menu_view") || "grid");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // selection
  const [selected, setSelected] = useState(new Set());

  // drawers / dialogs
  const [drawerMenu, setDrawerMenu] = useState(null);      // null=closed, "new"=add, menu object=edit
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [previewMenu, setPreviewMenu]   = useState(null);

  // online
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  // realtime Firestore
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "menus"),
      (snap) => { setMenus(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoading(false); setErrored(false); },
      () => setErrored(true),
    );
    return unsub;
  }, []);

  // derived categories (from actual data)
  const categories = useMemo(() => {
    const set = new Set(menus.map((m) => m.category).filter(Boolean));
    DEFAULT_CATEGORIES.forEach((c) => set.add(c));
    return [...set];
  }, [menus]);

  // category item counts
  const catCounts = useMemo(() => {
    const counts = {};
    menus.forEach((m) => { counts[m.category] = (counts[m.category] || 0) + 1; });
    return counts;
  }, [menus]);

  // filtered + sorted list
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = menus
      .filter((m) => catFilter === "all" || m.category === catFilter)
      .filter((m) => !q || (m.name || "").toLowerCase().includes(q) || (m.description || "").toLowerCase().includes(q));

    list = [...list].sort((a, b) => {
      if (sortBy === "name_asc")   return (a.name || "").localeCompare(b.name || "");
      if (sortBy === "name_desc")  return (b.name || "").localeCompare(a.name || "");
      if (sortBy === "price_asc")  return Number(a.price || 0) - Number(b.price || 0);
      if (sortBy === "price_desc") return Number(b.price || 0) - Number(a.price || 0);
      if (sortBy === "newest")     return (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0);
      if (sortBy === "oldest")     return (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0);
      return Number(a.displayOrder || 999) - Number(b.displayOrder || 999);
    });

    return list;
  }, [menus, search, catFilter, sortBy]);

  const visible = filtered.slice(0, visibleCount);

  /* ── actions ── */
  const saveMenu = useCallback(async (form, id) => {
    const payload = {
      name:         form.name.trim(),
      description:  form.description.trim(),
      category:     form.category,
      price:        Number(form.price),
      cost:         Number(form.cost) || 0,
      image:        form.image.trim(),
      available:    form.available,
      popular:      form.popular,
      cookingTime:  form.cookingTime ? Number(form.cookingTime) : null,
      displayOrder: form.displayOrder !== "" ? Number(form.displayOrder) : 999,
      storeId:      STORE_ID,
      updatedAt:    serverTimestamp(),
    };
    if (id) {
      await updateDoc(doc(db, "menus", id), payload);
    } else {
      await addDoc(collection(db, "menus"), { ...payload, createdAt: serverTimestamp() });
    }
  }, []);

  const duplicateMenu = useCallback(async (menu) => {
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = menu;
    await addDoc(collection(db, "menus"), {
      ...rest,
      name: `${menu.name} (Copy)`,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      displayOrder: Number(menu.displayOrder || 999) + 1,
    });
  }, []);

  const deleteMenu = useCallback(async (id) => {
    await deleteDoc(doc(db, "menus", id));
    setDeleteTarget(null);
    setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
  }, []);

  const toggleAvail = useCallback(async (menu) => {
    await updateDoc(doc(db, "menus", menu.id), { available: menu.available === false, updatedAt: serverTimestamp() });
  }, []);

  // selection
  const toggleSelect = useCallback((id) => {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);
  const selectAll  = () => setSelected(new Set(filtered.map((m) => m.id)));
  const clearSel   = () => setSelected(new Set());

  const selectedMenus = useMemo(() => menus.filter((m) => selected.has(m.id)), [menus, selected]);

  const bulkOpen = async () => {
    const batch = writeBatch(db);
    selected.forEach((id) => batch.update(doc(db, "menus", id), { available: true, updatedAt: serverTimestamp() }));
    await batch.commit(); clearSel();
  };
  const bulkClose = async () => {
    const batch = writeBatch(db);
    selected.forEach((id) => batch.update(doc(db, "menus", id), { available: false, updatedAt: serverTimestamp() }));
    await batch.commit(); clearSel();
  };
  const bulkDelete = async () => {
    if (!window.confirm(`Delete ${selected.size} item(s)? This cannot be undone.`)) return;
    const batch = writeBatch(db);
    selected.forEach((id) => batch.delete(doc(db, "menus", id)));
    await batch.commit(); clearSel();
  };

  if (errored) return <div className="p-6"><PageState type="error" /></div>;
  if (!online) return <div className="p-6"><PageState type="offline" /></div>;

  const hasFilter = search || catFilter !== "all";
  const isEmpty   = !loading && filtered.length === 0;

  return (
    <div className="p-5 lg:p-6 space-y-4 max-w-[1400px] mx-auto">
      {/* drawers / dialogs */}
      {drawerMenu !== null && (
        <MenuDrawer
          menu={drawerMenu === "new" ? null : drawerMenu}
          categories={categories}
          onClose={() => setDrawerMenu(null)}
          onSave={saveMenu}
        />
      )}
      <DeleteDialog item={deleteTarget} onConfirm={deleteMenu} onCancel={() => setDeleteTarget(null)} />
      {previewMenu && <PreviewModal menu={previewMenu} onClose={() => setPreviewMenu(null)} />}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-black text-gray-900">Menu Management</h1>
        <button onClick={() => setDrawerMenu("new")}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-black hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <Plus size={16} /> Add Menu Item
        </button>
      </div>

      {/* Summary strip */}
      <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3 flex items-center gap-5 overflow-x-auto">
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-lg font-black text-gray-900">{menus.length}</span>
          <span className="text-[11px] font-bold text-gray-400 uppercase">Total Items</span>
        </div>
        <div className="w-px h-5 bg-gray-100 flex-shrink-0" />
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-lg font-black text-green-600">{menus.filter((m) => m.available !== false).length}</span>
          <span className="text-[11px] font-bold text-gray-400 uppercase">Selling</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-lg font-black text-red-500">{menus.filter((m) => m.available === false).length}</span>
          <span className="text-[11px] font-bold text-gray-400 uppercase">Sold Out</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-lg font-black text-amber-500">{menus.filter((m) => m.popular).length}</span>
          <span className="text-[11px] font-bold text-gray-400 uppercase">Popular</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[11px] font-bold text-gray-400 uppercase">{categories.filter((c) => DEFAULT_CATEGORIES.includes(c) || catCounts[c]).length} Categories</span>
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setVisibleCount(PAGE_SIZE); }}
            placeholder="Search menu name…"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
        </div>

        {/* Category filter */}
        <div className="relative">
          <SlidersHorizontal size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
          <select value={catFilter} onChange={(e) => { setCatFilter(e.target.value); setVisibleCount(PAGE_SIZE); }}
            className="appearance-none pl-8 pr-8 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-600 outline-none focus:border-primary">
            <option value="all">All Categories ({menus.length})</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c} ({catCounts[c] || 0})</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
        </div>

        {/* Sort */}
        <div className="relative">
          <ArrowDownUp size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
            className="appearance-none pl-8 pr-8 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-600 outline-none focus:border-primary">
            {SORT_OPTIONS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-0.5 bg-gray-100 rounded-xl p-1">
          <button onClick={() => { setViewMode("grid"); localStorage.setItem("menu_view", "grid"); }}
            className={`p-2 rounded-lg transition-colors ${viewMode === "grid" ? "bg-white shadow-sm text-gray-800" : "text-gray-400 hover:text-gray-600"}`}
            title="Grid view"><Grid3x3 size={16} /></button>
          <button onClick={() => { setViewMode("list"); localStorage.setItem("menu_view", "list"); }}
            className={`p-2 rounded-lg transition-colors ${viewMode === "list" ? "bg-white shadow-sm text-gray-800" : "text-gray-400 hover:text-gray-600"}`}
            title="List view"><LayoutList size={16} /></button>
        </div>
      </div>

      {/* Select controls */}
      {!loading && filtered.length > 0 && (
        <div className="flex items-center gap-3 text-xs font-bold text-gray-500">
          <button onClick={selectAll} className="flex items-center gap-1.5 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded px-1">
            <CheckSquare size={14} /> Select All
          </button>
          {selected.size > 0 && (
            <button onClick={clearSel} className="flex items-center gap-1.5 hover:text-gray-800">
              <Square size={14} /> Clear ({selected.size})
            </button>
          )}
        </div>
      )}

      {/* Grid / List */}
      {loading ? (
        viewMode === "grid"
          ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">{Array.from({ length: 8 }).map((_, i) => <MenuSkeleton key={i} grid />)}</div>
          : <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <MenuSkeleton key={i} grid={false} />)}</div>
      ) : isEmpty ? (
        <PageState type={hasFilter ? "search" : "empty"} onAdd={() => setDrawerMenu("new")} />
      ) : viewMode === "grid" ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {visible.map((menu) => (
              <MenuCard
                key={menu.id}
                menu={menu}
                selected={selected.has(menu.id)}
                onSelect={toggleSelect}
                onEdit={setDrawerMenu}
                onDuplicate={duplicateMenu}
                onDelete={setDeleteTarget}
                onToggleAvail={toggleAvail}
                onPreview={setPreviewMenu}
              />
            ))}
          </div>
          {visibleCount < filtered.length && (
            <div className="flex justify-center pt-2">
              <button onClick={() => setVisibleCount((c) => c + PAGE_SIZE)} className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50">
                Load more ({filtered.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="space-y-2">
            {visible.map((menu) => (
              <MenuRow
                key={menu.id}
                menu={menu}
                selected={selected.has(menu.id)}
                onSelect={toggleSelect}
                onEdit={setDrawerMenu}
                onDuplicate={duplicateMenu}
                onDelete={setDeleteTarget}
                onToggleAvail={toggleAvail}
                onPreview={setPreviewMenu}
              />
            ))}
          </div>
          {visibleCount < filtered.length && (
            <div className="flex justify-center pt-2">
              <button onClick={() => setVisibleCount((c) => c + PAGE_SIZE)} className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50">
                Load more ({filtered.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </>
      )}

      {/* Floating bulk action bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 flex-wrap bg-gray-900 text-white rounded-2xl px-4 py-3 shadow-2xl max-w-[95vw]">
          <p className="text-sm font-bold whitespace-nowrap">{selected.size} selected</p>
          <button onClick={bulkOpen} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-sm font-bold hover:bg-green-700">
            <CheckCheck size={14} /> Open Selected
          </button>
          <button onClick={bulkClose} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-sm font-bold hover:bg-white/20">
            <XCircle size={14} /> Close Selected
          </button>
          <button onClick={bulkDelete} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500 text-sm font-bold hover:bg-red-600">
            <Trash2 size={14} /> Delete Selected
          </button>
          <button onClick={clearSel} className="px-2 py-1.5 text-white/60 hover:text-white"><X size={16} /></button>
        </div>
      )}
    </div>
  );
}
