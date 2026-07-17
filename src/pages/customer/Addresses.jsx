import { useState } from "react";
import { Plus, MapPinHouse } from "lucide-react";
import { useAuth } from "../../AuthContext";
import { usePreferences } from "../../context/PreferencesContext";
import { useAddresses } from "../../hooks/useAddresses";
import { useStoreStatus } from "../../store/useStoreStatus";
import { distanceFromStore } from "../../location/distance";
import { STORE_LOCATION } from "../../constants/address";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { EmptyState } from "../../components/ui/EmptyState";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { AddressForm } from "../../components/customer/address/AddressForm";
import { AddressCard, AddressCardSkeleton } from "../../components/customer/address/AddressCard";

// Customer address manager — full CRUD over users/{uid}/addresses with GPS,
// automatic distance-from-store calculation, and single-default enforcement.
export const Addresses = () => {
  const { user } = useAuth();
  const { t } = usePreferences();
  const { addresses, loading, error, addAddress, updateAddress, removeAddress, setDefault } =
    useAddresses(user?.uid);
  // Live store doc for the dynamic delivery service area (serviceArea polygon / radius).
  const { store } = useStoreStatus("delivery");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null); // address being edited, or null for new
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const openNew = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (addr) => { setEditing(addr); setFormOpen(true); };
  const closeForm = () => { if (!saving) { setFormOpen(false); setEditing(null); } };

  const handleSave = async (data) => {
    if (!user?.uid) return;
    setSaving(true);
    try {
      // GPS is validated in the form, so lat/lng are present here — recompute the
      // road distance from the store and persist it for later fee calculation.
      let distanceKm = data.distanceKm;
      if (data.lat != null && data.lng != null) {
        const km = await distanceFromStore(STORE_LOCATION.lat, STORE_LOCATION.lng, data.lat, data.lng);
        distanceKm = km != null ? Number(km.toFixed(2)) : null;
      }
      const payload = { ...data, distanceKm };
      if (editing) await updateAddress(editing.id, payload);
      else await addAddress(payload);
      setFormOpen(false);
      setEditing(null);
    } catch (err) {
      console.error("Failed to save address:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (addr) => {
    setBusyId(addr.id);
    try { await setDefault(addr.id); } finally { setBusyId(null); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try { await removeAddress(deleteTarget.id); } finally {
      setBusyId(null);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-8 space-y-6">
      {/* header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900">{t("addr.title")}</h1>
          <p className="text-sm text-gray-400 font-medium mt-0.5">{t("addr.subtitle")}</p>
        </div>
        <Button onClick={openNew} className="shrink-0">
          <Plus size={18} /> {t("addr.add")}
        </Button>
      </div>

      {error && (
        <div className="rounded-2xl bg-secondary/5 border border-secondary/20 p-4 text-sm font-bold text-secondary">
          {error}
        </div>
      )}

      {/* loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <AddressCardSkeleton />
          <AddressCardSkeleton />
        </div>
      )}

      {/* empty state */}
      {!loading && addresses.length === 0 && !error && (
        <div className="rounded-3xl bg-white border border-gray-50 shadow-soft">
          <EmptyState
            icon="🏠"
            title={t("addr.emptyTitle")}
            description={t("addr.emptyDesc")}
          />
          <div className="flex justify-center pb-10 -mt-6">
            <Button onClick={openNew}>
              <Plus size={18} /> {t("addr.addFirst")}
            </Button>
          </div>
        </div>
      )}

      {/* list */}
      {!loading && addresses.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {addresses.map((addr) => (
            <AddressCard
              key={addr.id}
              address={addr}
              store={store}
              busy={busyId === addr.id}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
              onSetDefault={handleSetDefault}
            />
          ))}
        </div>
      )}

      {/* helper footer */}
      {!loading && addresses.length > 0 && (
        <p className="flex items-center justify-center gap-1.5 text-xs text-gray-400 font-medium pt-2">
          <MapPinHouse size={14} /> Distances are measured by road from {STORE_LOCATION.name}.
        </p>
      )}

      {/* add/edit modal */}
      <Modal open={formOpen} onClose={closeForm} className="max-w-2xl">
        <AddressForm
          key={editing?.id || "new"}
          initial={editing}
          others={addresses.filter((a) => a.id !== editing?.id)}
          lockDefault={!!editing && editing.isDefault && addresses.length === 1}
          onSubmit={handleSave}
          onCancel={closeForm}
          submitting={saving}
        />
      </Modal>

      {/* delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        title={t("addr.delete")}
        message={`${deleteTarget ? (deleteTarget.receiverName || "") : ""} — ${t("addr.deleteConfirm")}`}
        confirmText={t("addr.delete")}
        cancelText={t("addr.cancel")}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
