import { useEffect, useRef, useState } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import {
  User, Camera, Trash2, Pencil, Check, X, Loader2, LogOut,
  IdCard, Bike, Landmark, Lock, CheckCircle2, AlertCircle,
} from "lucide-react";
import { db, auth } from "./firebase";
import { useAuth } from "./AuthContext.jsx";
import { usePreferences } from "./context/PreferencesContext";
import { uploadImage } from "./services/cloudinary";
import { cropToSquare } from "./services/cropImage";
import { logError } from "./errorCenter";
import { Card } from "./components/ui/Card";
import { Button } from "./components/ui/Button";
import { Skeleton } from "./components/ui/Skeleton";
import { ConfirmDialog } from "./components/ui/ConfirmDialog";

// Editable fields (form) and how each maps onto the users/{uid} document. `name` is kept in
// sync from first+last for backward compatibility (dashboard / My Account / hub read it).
// email, riderCode and uid are NEVER written from here.
const FIELDS = [
  "firstName", "lastName", "phone", "vehicleType", "vehiclePlate",
  "bankName", "bankAccountName", "bankAccountNumber", "nationalId", "address",
];
const TO_DOC = {
  firstName: "firstName", lastName: "lastName", phone: "phone", vehicleType: "vehicleType",
  vehiclePlate: "licensePlate", bankName: "bankName", bankAccountName: "accountName",
  bankAccountNumber: "accountNumber", nationalId: "nationalId", address: "address",
};
const EMPTY = Object.fromEntries(FIELDS.map((k) => [k, ""]));

// Split a legacy full `name` into first/last only when explicit fields are absent.
const fromDoc = (d = {}) => ({
  firstName: d.firstName ?? (d.name ? String(d.name).trim().split(/\s+/)[0] : "") ?? "",
  lastName: d.lastName ?? (d.name ? String(d.name).trim().split(/\s+/).slice(1).join(" ") : "") ?? "",
  phone: d.phone ?? "",
  vehicleType: d.vehicleType ?? "",
  vehiclePlate: d.licensePlate ?? "",
  bankName: d.bankName ?? "",
  bankAccountName: d.accountName ?? "",
  bankAccountNumber: d.accountNumber ?? "",
  nationalId: d.nationalId ?? "",
  address: d.address ?? "",
});

const digits = (s) => String(s || "").replace(/\D/g, "");
const isPhone = (s) => { const d = digits(s); return d.length >= 9 && d.length <= 10; };

// Required = first, last, phone ; formats validated when the optional field is filled in.
function validate(form, t) {
  const e = {};
  if (!form.firstName.trim()) e.firstName = t("ro.pf.err.required");
  if (!form.lastName.trim()) e.lastName = t("ro.pf.err.required");
  if (!form.phone.trim()) e.phone = t("ro.pf.err.required");
  else if (!isPhone(form.phone)) e.phone = t("ro.pf.err.phone");
  if (form.nationalId.trim() && digits(form.nationalId).length !== 13) e.nationalId = t("ro.pf.err.nationalId");
  if (form.bankAccountNumber.trim()) {
    const d = digits(form.bankAccountNumber).length;
    if (d < 10 || d > 15) e.bankAccountNumber = t("ro.pf.err.bankAccount");
  }
  return e;
}

const inputCls = (error) =>
  `w-full rounded-2xl border bg-gray-50 px-4 py-3 font-medium outline-none transition focus:ring-2 focus:ring-primary/20 ${
    error ? "border-secondary focus:border-secondary" : "border-gray-200 focus:border-primary"
  }`;

// One field: input/select/textarea while editing, read-only row otherwise. `readOnly`
// forces the read row even in edit mode (email / riderCode).
const Field = ({ id, label, value, onChange, onBlur, editing, error, type = "text", as = "input", options, readOnly, lock, ...rest }) => {
  const showInput = editing && !readOnly;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="flex items-center gap-1 text-xs font-bold text-gray-500 uppercase tracking-wider">
        {lock && <Lock size={11} className="text-gray-400" />} {label}
      </label>
      {showInput ? (
        as === "textarea" ? (
          <textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} rows={3} className={inputCls(error)} aria-invalid={Boolean(error)} {...rest} />
        ) : as === "select" ? (
          <select id={id} value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} className={inputCls(error)} aria-invalid={Boolean(error)}>
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : (
          <input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} className={inputCls(error)} aria-invalid={Boolean(error)} {...rest} />
        )
      ) : (
        <p className={`px-1 py-2 font-bold break-words min-h-[1.5rem] ${readOnly ? "text-gray-400" : "text-gray-900"}`}>
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

const ProfileSkeleton = () => (
  <div className="max-w-3xl mx-auto space-y-6">
    <div className="flex items-center justify-between"><Skeleton className="h-8 w-40" /><Skeleton className="h-10 w-24" /></div>
    <Card className="p-6 flex flex-col items-center gap-3"><Skeleton className="w-28 h-28 rounded-full" /><Skeleton className="h-5 w-40" /><Skeleton className="h-4 w-24" /></Card>
    {[0, 1, 2].map((i) => (
      <Card key={i} className="p-6"><Skeleton className="h-5 w-40 mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{[0, 1, 2, 3].map((j) => <Skeleton key={j} className="h-12 w-full" />)}</div>
      </Card>
    ))}
  </div>
);

export default function RiderProfile() {
  const { profile, logout } = useAuth();
  const { t } = usePreferences();
  const uid = auth.currentUser?.uid;

  const [form, setForm] = useState(EMPTY);
  const [original, setOriginal] = useState(EMPTY);
  const [readonlyInfo, setReadonlyInfo] = useState({ email: "", riderCode: "" });
  const [savedPhoto, setSavedPhoto] = useState("");
  const [staged, setStaged] = useState(null); // { file, preview } — new cropped photo awaiting Save
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [editing, setEditing] = useState(false);
  const [touched, setTouched] = useState({});
  const [loading, setLoading] = useState(() => Boolean(uid));
  const [saving, setSaving] = useState(false);
  const [uploadPct, setUploadPct] = useState(null); // null = not uploading
  const [preparing, setPreparing] = useState(false); // cropping
  const [toast, setToast] = useState(null); // { ok, msg }
  const [discardOpen, setDiscardOpen] = useState(false);
  const editingRef = useRef(false);
  const fileRef = useRef(null);
  const stagedRef = useRef(null);

  useEffect(() => { editingRef.current = editing; }, [editing]);
  useEffect(() => { stagedRef.current = staged; }, [staged]);
  // Revoke the last preview object-URL on unmount (avoid a leak).
  useEffect(() => () => { if (stagedRef.current?.preview) URL.revokeObjectURL(stagedRef.current.preview); }, []);

  // Real-time load from Firestore (the only source). Don't clobber in-progress edits.
  useEffect(() => {
    if (!uid) return undefined;
    const unsub = onSnapshot(
      doc(db, "users", uid),
      (snap) => {
        const d = snap.exists() ? snap.data() : {};
        setReadonlyInfo({ email: d.email || "", riderCode: d.riderCode || uid.slice(0, 8).toUpperCase() });
        if (!editingRef.current) {
          const next = fromDoc(d);
          setForm(next);
          setOriginal(next);
          setSavedPhoto(d.photoURL || d.avatarUrl || d.profilePhoto || "");
        }
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

  const errors = validate(form, t);
  const isValid = Object.keys(errors).length === 0;
  const fieldsDirty = JSON.stringify(form) !== JSON.stringify(original);
  const photoDirty = Boolean(staged) || photoRemoved;
  const dirty = editing && (fieldsDirty || photoDirty);

  // Warn on refresh/close with unsaved edits.
  useEffect(() => {
    if (!dirty) return undefined;
    const h = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const setField = (k, v) => { setForm((p) => ({ ...p, [k]: v })); setTouched((p) => (p[k] ? p : { ...p, [k]: true })); };
  const blur = (k) => () => setTouched((p) => (p[k] ? p : { ...p, [k]: true }));
  const err = (k) => (touched[k] ? errors[k] : undefined);

  const clearStaged = () => {
    if (staged?.preview) URL.revokeObjectURL(staged.preview);
    setStaged(null);
  };
  const startEdit = () => { setTouched({}); setEditing(true); };
  const exitEdit = () => { setForm(original); setTouched({}); clearStaged(); setPhotoRemoved(false); setEditing(false); };
  const cancelEdit = () => { if (dirty) setDiscardOpen(true); else exitEdit(); };

  // Pick a photo → crop to square → stage a preview (uploaded only on Save).
  const onPickPhoto = async (ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name)) {
      setToast({ ok: false, msg: t("ro.pf.photoErr") }); return;
    }
    setPreparing(true);
    try {
      let next;
      try { next = await cropToSquare(file); }
      catch { next = { file, preview: URL.createObjectURL(file) }; } // HEIC/decoding fallback: upload original
      clearStaged();
      setPhotoRemoved(false);
      setStaged(next);
    } catch (e) {
      logError(e, "RiderProfile.crop");
      setToast({ ok: false, msg: t("ro.pf.photoErr") });
    } finally {
      setPreparing(false);
    }
  };
  const stageRemove = () => { clearStaged(); setPhotoRemoved(true); };

  const save = async () => {
    setTouched(Object.fromEntries(FIELDS.map((k) => [k, true])));
    if (!isValid) { setToast({ ok: false, msg: t("ro.pf.err.fixErrors") }); return; }
    if (!uid || !dirty) return;
    setSaving(true);
    try {
      const patch = {};
      // only changed fields
      for (const k of FIELDS) if (form[k] !== original[k]) patch[TO_DOC[k]] = form[k];
      if (form.firstName !== original.firstName || form.lastName !== original.lastName) {
        patch.name = `${form.firstName} ${form.lastName}`.trim();
      }
      // photo: upload the staged crop (with progress) or clear it
      if (staged) {
        setUploadPct(0);
        patch.photoURL = await uploadImage(staged.file, { folder: "rider-avatars", onProgress: setUploadPct });
      } else if (photoRemoved) {
        patch.photoURL = "";
      }
      if (Object.keys(patch).length > 0) {
        await updateDoc(doc(db, "users", uid), patch); // merge; never touches email/riderCode/uid/status
      }
      if (staged) setSavedPhoto(patch.photoURL);
      else if (photoRemoved) setSavedPhoto("");
      setOriginal(form);
      clearStaged();
      setPhotoRemoved(false);
      setEditing(false);
      setToast({ ok: true, msg: t("ro.pf.saved") });
    } catch (e) {
      logError(e, "RiderProfile.save");
      setToast({ ok: false, msg: t("ro.pf.saveErr") });
    } finally {
      setSaving(false);
      setUploadPct(null);
    }
  };

  if (loading) return <ProfileSkeleton />;

  const displayName = `${form.firstName} ${form.lastName}`.trim() || profile?.name || "-";
  const avatarUrl = staged?.preview || (photoRemoved ? "" : savedPhoto);
  const busy = saving || uploadPct !== null;
  const vehicleOptions = [
    { value: "", label: "-" },
    { value: "motorcycle", label: t("ro.vehicle.motorcycle") },
    { value: "car", label: t("ro.vehicle.car") },
    { value: "bicycle", label: t("ro.vehicle.bicycle") },
  ];
  const f = (k) => ({ id: k, value: form[k], onChange: (v) => setField(k, v), onBlur: blur(k), editing, error: err(k) });

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-4">
      {/* header + actions */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-black text-gray-900">{t("ro.pf.title")}</h1>
        {editing ? (
          <div className="flex gap-2">
            <Button variant="outline" className="!px-4" onClick={cancelEdit} disabled={busy}>
              <X size={16} /> {t("ro.pf.cancel")}
            </Button>
            <Button className="!px-4" onClick={save} loading={busy} disabled={busy || !dirty || !isValid}>
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
          {avatarUrl ? (
            <img src={avatarUrl} alt={t("ro.pf.title")} className="w-28 h-28 rounded-full object-cover ring-4 ring-primary-light" />
          ) : (
            <div className="w-28 h-28 rounded-full bg-primary-light text-primary flex items-center justify-center text-4xl font-black">
              {(displayName.charAt(0) || "R").toUpperCase()}
            </div>
          )}
          {(preparing || uploadPct !== null) && (
            <div className="absolute inset-0 rounded-full bg-black/50 flex flex-col items-center justify-center text-white">
              <Loader2 size={26} className="animate-spin" />
              {uploadPct !== null && <span className="text-xs font-black mt-1">{uploadPct}%</span>}
            </div>
          )}
        </div>
        <p className="text-lg font-black text-gray-900 mt-3">{displayName}</p>
        <p className="text-xs font-bold text-gray-400">{readonlyInfo.riderCode}</p>

        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickPhoto} />
        {editing && (
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            <Button variant="outline" className="!px-4 !py-2 text-sm" onClick={() => fileRef.current?.click()} disabled={busy || preparing}>
              <Camera size={15} /> {avatarUrl ? t("ro.pf.replace") : t("ro.pf.upload")}
            </Button>
            {avatarUrl && (
              <Button variant="outline" className="!px-4 !py-2 text-sm text-secondary border-secondary/30 hover:border-secondary" onClick={stageRemove} disabled={busy || preparing}>
                <Trash2 size={15} /> {t("ro.pf.remove")}
              </Button>
            )}
          </div>
        )}
        {editing && staged && <p className="text-[11px] font-bold text-primary mt-2">{t("ro.pf.previewHint")}</p>}
      </Card>

      {/* personal */}
      <Section icon={User} title={t("ro.pf.section.personal")}>
        <Field label={t("ro.pf.firstName")} {...f("firstName")} />
        <Field label={t("ro.pf.lastName")} {...f("lastName")} />
        <Field label={t("ro.pf.phone")} type="tel" inputMode="tel" {...f("phone")} />
        <Field id="email" label={t("ro.pf.email")} value={readonlyInfo.email} editing={editing} readOnly lock />
        <Field label={t("ro.pf.nationalId")} inputMode="numeric" maxLength={13} {...f("nationalId")} />
        <Field label={t("ro.pf.address")} as="textarea" {...f("address")} />
      </Section>

      {/* vehicle */}
      <Section icon={Bike} title={t("ro.pf.section.vehicle")}>
        <Field label={t("ro.pf.vehicleType")} as="select" options={vehicleOptions} {...f("vehicleType")} />
        <Field label={t("ro.pf.licensePlate")} {...f("vehiclePlate")} />
      </Section>

      {/* banking */}
      <Section icon={Landmark} title={t("ro.pf.section.banking")}>
        <Field label={t("ro.pf.bankName")} {...f("bankName")} />
        <Field label={t("ro.pf.accountName")} {...f("bankAccountName")} />
        <Field label={t("ro.pf.accountNumber")} inputMode="numeric" {...f("bankAccountNumber")} />
      </Section>

      {/* rider (read-only identity) */}
      <Section icon={IdCard} title={t("ro.pf.section.rider")}>
        <Field id="riderCode" label={t("ro.pf.riderCode")} value={readonlyInfo.riderCode} editing={editing} readOnly lock />
      </Section>

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
