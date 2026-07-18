import { useEffect, useRef, useState } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import {
  User, Camera, Trash2, Pencil, Check, X, Loader2, LogOut,
  IdCard, Bike, Landmark, CheckCircle2, AlertCircle,
} from "lucide-react";
import { db, auth } from "./firebase";
import { useAuth } from "./AuthContext.jsx";
import { usePreferences } from "./context/PreferencesContext";
import { uploadImage } from "./services/cloudinary";
import { logError } from "./errorCenter";
import { Card } from "./components/ui/Card";
import { Button } from "./components/ui/Button";
import { Loading } from "./components/ui/Loading";
import { ConfirmDialog } from "./components/ui/ConfirmDialog";

// Every editable text field lives on users/{uid}. Photo (photoURL) is handled separately
// because it saves instantly on upload/remove. `name` = full name (used across the app),
// `riderName` = display name — both kept for backward compatibility.
const FIELDS = [
  "name", "nickname", "phone", "email", "dob", "gender", "address", "nationalId",
  "emergencyContact", "emergencyPhone",
  "vehicleType", "vehicleBrand", "vehicleModel", "vehicleColor", "licensePlate", "province",
  "bankName", "accountName", "accountNumber", "promptPayNumber",
  "riderName", "riderCode", "bio",
];
const EMPTY = Object.fromEntries(FIELDS.map((k) => [k, ""]));
const pick = (d) => Object.fromEntries(FIELDS.map((k) => [k, d?.[k] ?? ""]));

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const onlyDigits = (s) => String(s || "").replace(/\D/g, "");
const isPhone = (s) => { const d = onlyDigits(s); return d.length >= 9 && d.length <= 10; };

// Required = name + phone ; formats validated when the optional field is filled in.
function validate(form, t) {
  const e = {};
  if (!form.name.trim()) e.name = t("ro.pf.err.required");
  if (!form.phone.trim()) e.phone = t("ro.pf.err.required");
  else if (!isPhone(form.phone)) e.phone = t("ro.pf.err.phone");
  if (form.email.trim() && !emailRe.test(form.email.trim())) e.email = t("ro.pf.err.email");
  if (form.emergencyPhone.trim() && !isPhone(form.emergencyPhone)) e.emergencyPhone = t("ro.pf.err.phone");
  if (form.nationalId.trim() && onlyDigits(form.nationalId).length !== 13) e.nationalId = t("ro.pf.err.nationalId");
  return e;
}

// A single field: input/select/textarea while editing, read-only row otherwise.
const Field = ({ label, value, onChange, editing, error, type = "text", as = "input", options, ...rest }) => {
  const base = `w-full rounded-2xl border bg-gray-50 px-4 py-3 font-medium outline-none transition focus:ring-2 focus:ring-primary/20 ${error ? "border-secondary focus:border-secondary" : "border-gray-200 focus:border-primary"}`;
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</label>
      {editing ? (
        as === "textarea" ? (
          <textarea value={value} onChange={(ev) => onChange(ev.target.value)} rows={3} className={base} {...rest} />
        ) : as === "select" ? (
          <select value={value} onChange={(ev) => onChange(ev.target.value)} className={base}>
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : (
          <input type={type} value={value} onChange={(ev) => onChange(ev.target.value)} className={base} {...rest} />
        )
      ) : (
        <p className="px-1 py-2 font-bold text-gray-900 break-words min-h-[1.5rem]">
          {(as === "select" && options ? options.find((o) => o.value === value)?.label : value) || "-"}
        </p>
      )}
      {error && <p className="text-xs font-bold text-secondary flex items-center gap-1"><AlertCircle size={12} /> {error}</p>}
    </div>
  );
};

const Section = ({ icon: Icon, title, children }) => (
  <Card className="p-5 sm:p-6">
    <p className="flex items-center gap-2 text-sm font-black text-gray-800 mb-4"><Icon size={16} className="text-primary" /> {title}</p>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
  </Card>
);

export default function RiderProfile() {
  const { profile, logout } = useAuth();
  const { t } = usePreferences();
  const uid = auth.currentUser?.uid;

  const [form, setForm] = useState(EMPTY);
  const [original, setOriginal] = useState(EMPTY);
  const [photo, setPhoto] = useState("");
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(() => Boolean(uid));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState(null); // { ok:boolean, msg:string }
  const [discardOpen, setDiscardOpen] = useState(false);
  const editingRef = useRef(false);
  const fileRef = useRef(null);

  useEffect(() => { editingRef.current = editing; }, [editing]);

  // Real-time load from Firestore (the ONLY source). Don't clobber in-progress edits: text
  // fields refresh only when not editing; the photo always syncs (it saves instantly).
  useEffect(() => {
    if (!uid) return undefined;
    const unsub = onSnapshot(
      doc(db, "users", uid),
      (snap) => {
        const d = snap.exists() ? snap.data() : {};
        setPhoto(d.photoURL || d.avatarUrl || d.profilePhoto || "");
        if (!editingRef.current) { setForm(pick(d)); setOriginal(pick(d)); }
        setLoading(false);
      },
      (err) => { logError(err, "RiderProfile.load"); setLoading(false); }
    );
    return () => unsub();
  }, [uid]);

  // Auto-dismiss toasts.
  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(id);
  }, [toast]);

  const dirty = editing && JSON.stringify(form) !== JSON.stringify(original);

  // Warn on refresh/close with unsaved edits (in-app nav uses the Cancel confirm dialog).
  useEffect(() => {
    if (!dirty) return undefined;
    const h = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const setField = (k, v) => {
    setForm((prev) => ({ ...prev, [k]: v }));
    setErrors((prev) => (prev[k] ? { ...prev, [k]: undefined } : prev));
  };

  const startEdit = () => { setErrors({}); setEditing(true); };
  const exitEdit = () => { setForm(original); setErrors({}); setEditing(false); };
  const cancelEdit = () => { if (dirty) setDiscardOpen(true); else exitEdit(); };

  const save = async () => {
    const e = validate(form, t);
    setErrors(e);
    if (Object.keys(e).length > 0) { setToast({ ok: false, msg: t("ro.pf.err.fixErrors") }); return; }
    if (!uid) return;
    setSaving(true);
    try {
      const patch = Object.fromEntries(FIELDS.map((k) => [k, form[k]]));
      await updateDoc(doc(db, "users", uid), patch); // never touches status/role/riderStatus
      setOriginal(form);
      setEditing(false);
      setToast({ ok: true, msg: t("ro.pf.saved") });
    } catch (err) {
      logError(err, "RiderProfile.save");
      setToast({ ok: false, msg: t("ro.pf.saveErr") });
    } finally {
      setSaving(false);
    }
  };

  const onPhotoFile = async (ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = ""; // allow re-picking the same file
    if (!file || !uid) return;
    if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name)) {
      setToast({ ok: false, msg: t("ro.pf.photoErr") }); return;
    }
    setUploading(true);
    setUploadPct(0);
    try {
      const url = await uploadImage(file, { folder: "rider-avatars", onProgress: setUploadPct });
      await updateDoc(doc(db, "users", uid), { photoURL: url });
      setPhoto(url);
      setToast({ ok: true, msg: t("ro.pf.photoSaved") });
    } catch (err) {
      logError(err, "RiderProfile.photo");
      setToast({ ok: false, msg: t("ro.pf.photoErr") });
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = async () => {
    if (!uid || uploading) return;
    setUploading(true);
    try {
      await updateDoc(doc(db, "users", uid), { photoURL: "" });
      setPhoto("");
      setToast({ ok: true, msg: t("ro.pf.photoRemoved") });
    } catch (err) {
      logError(err, "RiderProfile.photoRemove");
      setToast({ ok: false, msg: t("ro.pf.photoErr") });
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <Loading text={t("ro.loading.settings")} />;

  const displayName = form.name || profile?.name || profile?.riderName || "-";
  const genderOptions = [
    { value: "", label: "-" },
    { value: "male", label: t("ro.pf.gender.male") },
    { value: "female", label: t("ro.pf.gender.female") },
    { value: "other", label: t("ro.pf.gender.other") },
  ];
  const vehicleOptions = [
    { value: "", label: "-" },
    { value: "motorcycle", label: t("ro.vehicle.motorcycle") },
    { value: "car", label: t("ro.vehicle.car") },
    { value: "bicycle", label: t("ro.vehicle.bicycle") },
  ];
  const f = (k) => ({ value: form[k], onChange: (v) => setField(k, v), editing, error: errors[k] });

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-4">
      {/* header + actions */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-black text-gray-900">{t("ro.pf.title")}</h1>
        {editing ? (
          <div className="flex gap-2">
            <Button variant="outline" className="!px-4" onClick={cancelEdit} disabled={saving}>
              <X size={16} /> {t("ro.pf.cancel")}
            </Button>
            <Button className="!px-4" onClick={save} loading={saving}>
              <Check size={16} /> {t("ro.pf.save")}
            </Button>
          </div>
        ) : (
          <Button className="!px-4" onClick={startEdit}>
            <Pencil size={16} /> {t("ro.pf.edit")}
          </Button>
        )}
      </div>

      {/* photo */}
      <Card className="p-6 flex flex-col items-center text-center">
        <div className="relative">
          {photo ? (
            <img src={photo} alt="" className="w-28 h-28 rounded-full object-cover ring-4 ring-primary-light" />
          ) : (
            <div className="w-28 h-28 rounded-full bg-primary-light text-primary flex items-center justify-center text-4xl font-black">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 rounded-full bg-black/50 flex flex-col items-center justify-center text-white">
              <Loader2 size={26} className="animate-spin" />
              <span className="text-xs font-black mt-1">{uploadPct}%</span>
            </div>
          )}
        </div>
        <p className="text-lg font-black text-gray-900 mt-3">{displayName}</p>
        <p className="text-xs font-bold text-gray-400">{form.riderCode || uid?.slice(0, 8).toUpperCase()}</p>

        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhotoFile} />
        <div className="flex flex-wrap justify-center gap-2 mt-4">
          <Button variant="outline" className="!px-4 !py-2 text-sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Camera size={15} /> {photo ? t("ro.pf.replace") : t("ro.pf.upload")}
          </Button>
          {photo && (
            <Button variant="outline" className="!px-4 !py-2 text-sm text-secondary border-secondary/30 hover:border-secondary" onClick={removePhoto} disabled={uploading}>
              <Trash2 size={15} /> {t("ro.pf.remove")}
            </Button>
          )}
        </div>
      </Card>

      {/* personal */}
      <Section icon={User} title={t("ro.pf.section.personal")}>
        <Field label={t("ro.pf.fullName")} {...f("name")} />
        <Field label={t("ro.pf.nickname")} {...f("nickname")} />
        <Field label={t("ro.pf.phone")} type="tel" inputMode="tel" {...f("phone")} />
        <Field label={t("ro.pf.email")} type="email" inputMode="email" {...f("email")} />
        <Field label={t("ro.pf.dob")} type="date" {...f("dob")} />
        <Field label={t("ro.pf.gender")} as="select" options={genderOptions} {...f("gender")} />
        <Field label={t("ro.pf.nationalId")} inputMode="numeric" {...f("nationalId")} />
        <Field label={t("ro.pf.address")} as="textarea" {...f("address")} />
        <Field label={t("ro.pf.emergencyContact")} {...f("emergencyContact")} />
        <Field label={t("ro.pf.emergencyPhone")} type="tel" inputMode="tel" {...f("emergencyPhone")} />
      </Section>

      {/* vehicle */}
      <Section icon={Bike} title={t("ro.pf.section.vehicle")}>
        <Field label={t("ro.pf.vehicleType")} as="select" options={vehicleOptions} {...f("vehicleType")} />
        <Field label={t("ro.pf.vehicleBrand")} {...f("vehicleBrand")} />
        <Field label={t("ro.pf.vehicleModel")} {...f("vehicleModel")} />
        <Field label={t("ro.pf.vehicleColor")} {...f("vehicleColor")} />
        <Field label={t("ro.pf.licensePlate")} {...f("licensePlate")} />
        <Field label={t("ro.pf.province")} {...f("province")} />
      </Section>

      {/* banking */}
      <Section icon={Landmark} title={t("ro.pf.section.banking")}>
        <Field label={t("ro.pf.bankName")} {...f("bankName")} />
        <Field label={t("ro.pf.accountName")} {...f("accountName")} />
        <Field label={t("ro.pf.accountNumber")} inputMode="numeric" {...f("accountNumber")} />
        <Field label={t("ro.pf.promptPay")} inputMode="tel" {...f("promptPayNumber")} />
      </Section>

      {/* rider info */}
      <Section icon={IdCard} title={t("ro.pf.section.rider")}>
        <Field label={t("ro.pf.riderName")} {...f("riderName")} />
        <Field label={t("ro.pf.riderCode")} {...f("riderCode")} />
        <div className="sm:col-span-2">
          <Field label={t("ro.pf.bio")} as="textarea" {...f("bio")} />
        </div>
      </Section>

      {/* logout (kept — mobile bottom nav has none) */}
      <Button variant="outline" className="w-full text-secondary border-secondary/30 hover:border-secondary" onClick={logout}>
        <LogOut size={18} /> {t("ro.logout")}
      </Button>

      {/* toast */}
      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-[calc(80px+env(safe-area-inset-bottom))] md:bottom-6 z-[90] max-w-[90vw]">
          <div className={`flex items-center gap-2 px-4 py-3 rounded-2xl shadow-premium text-sm font-bold text-white ${toast.ok ? "bg-primary" : "bg-secondary"}`}>
            {toast.ok ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{toast.msg}</span>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={discardOpen}
        title={t("ro.pf.discard.title")}
        message={t("ro.pf.discard.msg")}
        confirmText={t("ro.pf.discard.confirm")}
        cancelText={t("ro.pf.cancel")}
        onConfirm={() => { setDiscardOpen(false); exitEdit(); }}
        onCancel={() => setDiscardOpen(false)}
      />
    </div>
  );
}
