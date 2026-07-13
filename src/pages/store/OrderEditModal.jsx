import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { X, Plus, Minus, Trash2, Search, Save, Loader2, Pencil } from "lucide-react";
import { db } from "../../firebase";
import { usePreferences } from "../../context/PreferencesContext";
import { fmtMoney } from "../../store/orderStatus";
import { recalcOrder, orderTotal } from "../../store/orderTotals";
import { EDIT_REASONS, REFUND_METHODS, blankItemFromMenu, saveOrderEdit } from "../../store/orderEdit";

const OPTION_FIELDS = [
  { key: "top_chicken", labelKey: "soe.optTopping" },
  { key: "spicy", labelKey: "soe.optSpicy" },
  { key: "Sauce", labelKey: "soe.optSauce" },
  { key: "sauce", labelKey: "soe.optExtraSauce" },
  { key: "powder", labelKey: "soe.optPowder" },
  { key: "tableCheese", labelKey: "soe.optCheese" },
];

// PromptPay/Transfer/Cash refund-method labels, keyed by REFUND_METHODS value.
const REFUND_METHOD_KEY = { cash: "soe.refundCash", transfer: "soe.refundTransfer", promptpay: "soe.refundPromptpay" };

// Store-facing order editor: add/remove items, change qty, options and notes.
// On save it recalculates totals, versions the order and routes the difference to
// additional payment (higher) or refund (lower). Reuses shared utils only.
export default function OrderEditModal({ order, editedBy, onClose }) {
  const { t } = usePreferences();
  const [items, setItems] = useState(() =>
    (order.items || []).map((it) => ({ ...it, qty: Number(it.qty || 1) }))
  );
  const [menus, setMenus] = useState([]);
  const [search, setSearch] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [expanded, setExpanded] = useState(null); // index whose options are open
  const [reason, setReason] = useState("");
  const [reasonNote, setReasonNote] = useState("");
  const [refundMethod, setRefundMethod] = useState("cash");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Single-store project — subscribe to the whole menus collection (same source
    // the Store Menu page and Customer Home read), filter availability client-side.
    const unsub = onSnapshot(collection(db, "menus"), (snap) =>
      setMenus(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, []);

  const totals = useMemo(() => recalcOrder(items, order), [items, order]);
  const oldTotal = orderTotal(order);
  const diff = totals.grandTotal - oldTotal;

  const setQty = (i, delta) =>
    setItems((prev) => prev.map((it, j) => (j === i ? { ...it, qty: Math.max(1, Number(it.qty || 1) + delta) } : it)));
  const setField = (i, key, val) =>
    setItems((prev) => prev.map((it, j) => (j === i ? { ...it, [key]: val } : it)));
  const removeItem = (i) => setItems((prev) => prev.filter((_, j) => j !== i));
  const addMenu = (menu) => {
    setItems((prev) => [...prev, blankItemFromMenu(menu)]);
    setShowPicker(false);
    setSearch("");
  };

  const filteredMenus = useMemo(() => {
    const q = search.trim().toLowerCase();
    const avail = menus.filter((m) => m.available !== false);
    return q ? avail.filter((m) => (m.name || "").toLowerCase().includes(q)) : avail;
  }, [menus, search]);

  const canSave = items.length > 0 && !!reason && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await saveOrderEdit(order, { items, reason, reasonNote, refundMethod, editedBy });
      onClose();
    } catch {
      setError(t("soe.saveFailed"));
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <span className="flex items-center gap-2 text-base font-black text-gray-900">
            <Pencil size={18} className="text-primary" /> {t("soe.title", { no: order.orderNo || "" })}
          </span>
          <button onClick={onClose} aria-label={t("soe.close")} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100"><X size={18} /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {items.map((it, i) => (
            <div key={`${it.id ?? "x"}-${i}`} className="rounded-2xl border border-gray-100 p-3">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-900 truncate">{it.name}</p>
                  <p className="text-xs text-gray-400 font-medium">฿{fmtMoney(it.price)} × {it.qty} = ฿{fmtMoney(Number(it.price || 0) * Number(it.qty || 1))}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => setQty(i, -1)} aria-label={t("soe.decrease")} className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200"><Minus size={14} /></button>
                  <span className="w-6 text-center text-sm font-black text-gray-900">{it.qty}</span>
                  <button onClick={() => setQty(i, 1)} aria-label={t("soe.increase")} className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200"><Plus size={14} /></button>
                  <button onClick={() => removeItem(i)} aria-label={t("soe.remove")} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50"><Trash2 size={14} /></button>
                </div>
              </div>
              <button
                onClick={() => setExpanded(expanded === i ? null : i)}
                className="mt-2 text-xs font-bold text-primary hover:text-primary-dark"
              >
                {expanded === i ? t("soe.hideOptions") : t("soe.showOptions")}
              </button>
              {expanded === i && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {OPTION_FIELDS.map(({ key, labelKey }) => (
                    <input
                      key={key}
                      value={typeof it[key] === "object" ? it[key]?.name || "" : it[key] || ""}
                      onChange={(e) => setField(i, key, e.target.value)}
                      placeholder={t(labelKey)}
                      className="px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-xs font-medium text-gray-700 outline-none focus:border-primary"
                    />
                  ))}
                  <input
                    value={it.note || ""}
                    onChange={(e) => setField(i, "note", e.target.value)}
                    placeholder={t("soe.note")}
                    className="col-span-2 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-xs font-medium text-gray-700 outline-none focus:border-primary"
                  />
                </div>
              )}
            </div>
          ))}

          {/* Add menu */}
          {!showPicker ? (
            <button
              onClick={() => setShowPicker(true)}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl border-2 border-dashed border-gray-200 text-gray-500 text-sm font-bold hover:border-primary hover:text-primary"
            >
              <Plus size={16} /> {t("soe.addMenuItem")}
            </button>
          ) : (
            <div className="rounded-2xl border border-gray-100 p-3 space-y-2">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 border border-gray-200">
                <Search size={15} className="text-gray-400" />
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("soe.searchMenu")}
                  className="flex-1 bg-transparent text-sm outline-none"
                />
                <button onClick={() => { setShowPicker(false); setSearch(""); }} aria-label={t("soe.closeSearch")} className="text-gray-400"><X size={15} /></button>
              </div>
              <div className="max-h-52 overflow-y-auto divide-y divide-gray-50">
                {filteredMenus.length === 0 ? (
                  <p className="text-xs text-gray-400 font-medium py-4 text-center">{t("soe.noMenuFound")}</p>
                ) : filteredMenus.map((m) => (
                  <button key={m.id} onClick={() => addMenu(m)} className="w-full flex items-center justify-between gap-3 py-2.5 text-left hover:bg-gray-50 px-1">
                    <span className="text-sm font-bold text-gray-800 truncate">{m.name}</span>
                    <span className="text-sm font-black text-primary flex-shrink-0">฿{fmtMoney(m.price)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Recalc + reason + save */}
        <div className="border-t border-gray-100 p-5 space-y-3 flex-shrink-0">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-gray-500 font-medium"><span>{t("soe.subtotal")}</span><span>฿{fmtMoney(totals.subtotal)}</span></div>
            <div className="flex justify-between text-gray-500 font-medium"><span>{t("soe.delivery")}</span><span>฿{fmtMoney(totals.deliveryFee)}</span></div>
            {totals.discount > 0 && <div className="flex justify-between text-gray-500 font-medium"><span>{t("soe.discount")}</span><span>-฿{fmtMoney(totals.discount)}</span></div>}
            {totals.serviceCharge > 0 && <div className="flex justify-between text-gray-500 font-medium"><span>{t("soe.service")}</span><span>฿{fmtMoney(totals.serviceCharge)}</span></div>}
            <div className="flex justify-between text-base font-black text-gray-900 pt-1 border-t border-gray-100"><span>{t("soe.newTotal")}</span><span className="text-primary">฿{fmtMoney(totals.grandTotal)}</span></div>
            <div className="flex justify-between text-xs font-bold pt-0.5">
              <span className="text-gray-400">{t("soe.was", { amount: fmtMoney(oldTotal) })}</span>
              {diff > 0 && <span className="text-amber-600">{t("soe.customerPays", { amount: fmtMoney(diff) })}</span>}
              {diff < 0 && <span className="text-blue-600">{t("soe.refund", { amount: fmtMoney(-diff) })}</span>}
              {diff === 0 && <span className="text-gray-400">{t("soe.noChange")}</span>}
            </div>
          </div>

          {/* Refund method (only when total dropped) */}
          {diff < 0 && (
            <div className="flex gap-2">
              {REFUND_METHODS.map((m) => (
                <button
                  key={m}
                  onClick={() => setRefundMethod(m)}
                  className={`flex-1 py-2 rounded-xl text-xs font-black border ${refundMethod === m ? "bg-primary text-white border-primary" : "bg-white text-gray-500 border-gray-200"}`}
                >
                  {t(REFUND_METHOD_KEY[m] || m)}
                </button>
              ))}
            </div>
          )}

          {/* Reason (required) */}
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-700 outline-none focus:border-primary"
          >
            <option value="">{t("soe.selectReason")}</option>
            {EDIT_REASONS.map((r) => (
              <option key={r} value={r}>{t(`oe.reason.${r}`)}</option>
            ))}
          </select>
          {reason === "other" && (
            <input
              value={reasonNote}
              onChange={(e) => setReasonNote(e.target.value)}
              placeholder={t("soe.reasonDetail")}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm font-medium text-gray-700 outline-none focus:border-primary"
            />
          )}

          {error && <p className="text-xs font-bold text-red-500">{error}</p>}

          <button
            onClick={handleSave}
            disabled={!canSave}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-primary text-white text-sm font-black hover:bg-primary-dark disabled:opacity-40"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? t("soe.saving") : t("soe.saveChanges")}
          </button>
        </div>
      </div>
    </div>
  );
}
