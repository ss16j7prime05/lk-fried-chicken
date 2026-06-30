import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { collection, doc, onSnapshot, updateDoc, writeBatch } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import {
  TrendingUp,
  ShoppingBag,
  UtensilsCrossed,
  CheckCircle,
  Bike,
  Clock,
  Users,
  Timer,
  CheckCheck,
  X,
  Phone,
  MapPin,
  Bell,
  AlertCircle,
  ArrowRight,
  Package,
} from "lucide-react";
import { db } from "../../firebase";
import { STORE_ID } from "../../config";
import { normalizeStatus, STATUS_LABEL } from "../../store/orderStatus";

/* ─── sound ─── */
const playNewOrderSound = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const play = (freq, start, dur) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.35, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur);
    };
    play(880,  0,    0.12);
    play(1100, 0.15, 0.12);
    play(880,  0.30, 0.12);
    play(1320, 0.45, 0.25);
  } catch { /* browser blocked autoplay */ }
};

/* ─── helpers ─── */
const isToday = (ts) => {
  if (!ts) return false;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() &&
         d.getMonth()    === n.getMonth()    &&
         d.getDate()     === n.getDate();
};

const fmtTime = (ts) => {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
};

const fmtMoney = (n) =>
  Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 0 });

const optionLabel = (v) => {
  if (!v) return "";
  if (typeof v === "object") return v.name || "";
  return v;
};

/* ─── status styling ─── */
const BADGE = {
  pending:            "bg-red-100 text-red-600",
  accepted:           "bg-yellow-100 text-yellow-700",
  cooking:            "bg-orange-100 text-orange-600",
  ready_for_delivery: "bg-blue-100 text-blue-600",
  picked_up:          "bg-indigo-100 text-indigo-600",
  delivering:         "bg-purple-100 text-purple-600",
  completed:          "bg-green-100 text-green-700",
  cancelled:          "bg-gray-100 text-gray-500",
};

const STATUS_DOT = {
  pending:            "bg-red-500",
  accepted:           "bg-yellow-500",
  cooking:            "bg-orange-500",
  ready_for_delivery: "bg-blue-500",
  picked_up:          "bg-indigo-500",
  delivering:         "bg-purple-500",
  completed:          "bg-green-500",
  cancelled:          "bg-gray-400",
};

const ACTIVITY_ICON = {
  pending:            { bg: "bg-red-50",    color: "text-red-500",    icon: ShoppingBag  },
  accepted:           { bg: "bg-yellow-50", color: "text-yellow-600", icon: CheckCircle  },
  cooking:            { bg: "bg-orange-50", color: "text-orange-500", icon: UtensilsCrossed },
  ready_for_delivery: { bg: "bg-blue-50",   color: "text-blue-500",   icon: Package      },
  delivering:         { bg: "bg-purple-50", color: "text-purple-500", icon: Bike         },
  completed:          { bg: "bg-green-50",  color: "text-green-600",  icon: CheckCircle  },
  cancelled:          { bg: "bg-gray-50",   color: "text-gray-400",   icon: X            },
};

/* ─── New Order Popup ─── */
function NewOrderPopup({ order, onAccept, onReject, queueLength }) {
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const itemCount = (order.items || []).reduce((s, i) => s + (i.qty || 1), 0);

  const handleAccept = async () => { setAccepting(true); await onAccept(order.id); };
  const handleReject = async () => { setRejecting(true); await onReject(order.id); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-[fadeInUp_0.2s_ease]">
        {/* Alert banner */}
        <div className="bg-red-500 px-5 py-3.5 flex items-center gap-3">
          <div className="relative flex h-3 w-3 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-200 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
          </div>
          <p className="text-white font-black flex-1">NEW ORDER RECEIVED</p>
          {queueLength > 1 && (
            <span className="bg-white/20 text-white text-xs font-bold px-2.5 py-1 rounded-full">
              +{queueLength - 1} more
            </span>
          )}
        </div>

        {/* Order header */}
        <div className="px-5 pt-5 pb-2 flex items-start justify-between">
          <div>
            <p className="text-xl font-black text-gray-900">{order.orderNo || order.id?.slice(0, 12)}</p>
            <p className="text-sm text-gray-400 font-medium mt-0.5">{fmtTime(order.createdAt)}</p>
          </div>
          <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${
            order.paymentMethod === "promptpay" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
          }`}>
            {order.paymentMethod === "promptpay" ? "PromptPay" : "Cash"}
          </span>
        </div>

        {/* Customer info */}
        <div className="px-5 py-3 space-y-2 border-t border-gray-50">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <Users size={15} className="text-gray-400 flex-shrink-0" />
            <span className="font-bold">{order.customerName || "—"}</span>
          </div>
          {order.phone && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Phone size={15} className="text-gray-400 flex-shrink-0" />
              <span>{order.phone}</span>
            </div>
          )}
          {(order.deliveryAddress || order.address) && (
            <div className="flex items-start gap-2 text-sm text-gray-500">
              <MapPin size={15} className="text-gray-400 flex-shrink-0 mt-0.5" />
              <span className="line-clamp-2">{order.deliveryAddress || order.address}</span>
            </div>
          )}
        </div>

        {/* Items */}
        <div className="px-5 py-3 border-t border-gray-50 space-y-2 max-h-48 overflow-y-auto">
          {(order.items || []).map((item, i) => {
            const options = [
              optionLabel(item.top_chicken),
              optionLabel(item.spicy),
              optionLabel(item.sauce),
              optionLabel(item.powder),
            ].filter(Boolean).join(" · ");
            return (
              <div key={i} className="flex justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">
                    {item.qty || 1}× {item.name}
                  </p>
                  {options && <p className="text-xs text-gray-400 truncate">{options}</p>}
                  {item.note && <p className="text-xs text-primary truncate">Note: {item.note}</p>}
                </div>
                <p className="text-sm font-bold text-gray-700 whitespace-nowrap">
                  ฿{fmtMoney((item.price || 0) * (item.qty || 1))}
                </p>
              </div>
            );
          })}
        </div>

        {/* Total */}
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
            <ShoppingBag size={13} />
            {itemCount} item{itemCount !== 1 ? "s" : ""}
          </div>
          <p className="text-2xl font-black text-gray-900">
            ฿{fmtMoney(order.grandTotal ?? order.subtotal)}
          </p>
        </div>

        {/* Actions */}
        <div className="px-5 py-5 flex gap-3 border-t border-gray-100">
          <button
            onClick={handleReject}
            disabled={rejecting || accepting}
            className="flex-1 py-4 rounded-2xl border-2 border-gray-200 font-black text-gray-600 hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-colors disabled:opacity-50"
          >
            {rejecting ? "Rejecting…" : "✕ Reject"}
          </button>
          <button
            onClick={handleAccept}
            disabled={accepting || rejecting}
            className="flex-[2] py-4 rounded-2xl bg-primary text-white font-black hover:bg-primary-dark transition-colors disabled:opacity-50 text-lg"
          >
            {accepting ? "Accepting…" : "✓ Accept Order"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Stat Card ─── */
function StatCard({ icon: Icon, iconBg, iconColor, label, value, accent, pulse, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`bg-white rounded-2xl p-5 border text-left transition-all hover:shadow-md active:scale-[0.98] w-full
        ${accent ? "border-red-200 bg-red-50/30" : "border-gray-100"} relative overflow-hidden`}
    >
      {pulse && (
        <span className="absolute top-3.5 right-3.5 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
        </span>
      )}
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${iconBg}`}>
        <Icon size={22} className={iconColor} />
      </div>
      <p className="text-3xl font-black text-gray-900 mt-4 tabular-nums leading-none">{value}</p>
      <p className="text-xs font-bold text-gray-400 mt-1.5 uppercase tracking-wide leading-tight">{label}</p>
    </button>
  );
}

/* ─── Order Card (tablet-friendly, replaces table rows) ─── */
function OrderCard({ order, onAccept, onReject }) {
  const status = normalizeStatus(order.status);
  const itemCount = (order.items || []).reduce((s, i) => s + (i.qty || 1), 0);
  const isPending = status === "pending";

  return (
    <div className={`bg-white rounded-2xl border transition-all ${isPending ? "border-red-200 shadow-sm" : "border-gray-100"}`}>
      <div className="p-4 flex items-start gap-3">
        {/* Status dot */}
        <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${STATUS_DOT[status] || "bg-gray-400"} ${isPending ? "animate-pulse" : ""}`} />

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-black text-gray-900 truncate">
              {order.orderNo || order.id?.slice(0, 10)}
            </p>
            <p className="text-sm font-black text-gray-900 whitespace-nowrap">
              ฿{fmtMoney(order.grandTotal ?? order.subtotal)}
            </p>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <p className="text-xs font-medium text-gray-500 truncate">
              {order.customerName || "—"}
            </p>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${BADGE[status] || "bg-gray-100 text-gray-500"}`}>
              {STATUS_LABEL[status] || status}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-400 font-medium">
            <span>{itemCount} item{itemCount !== 1 ? "s" : ""}</span>
            <span>·</span>
            <span>{fmtTime(order.createdAt)}</span>
            {order.phone && (
              <>
                <span>·</span>
                <a href={`tel:${order.phone}`} className="flex items-center gap-1 text-primary hover:underline">
                  <Phone size={10} /> {order.phone}
                </a>
              </>
            )}
          </div>
        </div>
      </div>

      {isPending && (
        <div className="flex gap-2 px-4 pb-4 pt-1">
          <button
            onClick={() => onReject(order.id)}
            className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-sm font-black text-gray-600 hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-colors"
          >
            Reject
          </button>
          <button
            onClick={() => onAccept(order.id)}
            className="flex-[2] py-3 rounded-xl bg-primary text-white text-sm font-black hover:bg-primary-dark transition-colors"
          >
            ✓ Accept
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Activity Item ─── */
function ActivityItem({ item }) {
  const status = normalizeStatus(item.order.status);
  const style = ACTIVITY_ICON[status] || ACTIVITY_ICON.cancelled;
  const Icon = style.icon;
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${style.bg}`}>
        <Icon size={16} className={style.color} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-gray-800 truncate">
          {item.order.orderNo || item.order.id?.slice(0, 10)}
        </p>
        <p className="text-xs text-gray-400 font-medium mt-0.5">
          {STATUS_LABEL[status] || status}
        </p>
        <p className="text-[10px] text-gray-300 mt-0.5">
          {item.time.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </p>
      </div>
      <p className="text-xs font-bold text-gray-500 whitespace-nowrap">
        ฿{fmtMoney(item.order.grandTotal ?? item.order.subtotal)}
      </p>
    </div>
  );
}

/* ─── Dashboard ─── */
export function Dashboard() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const [popupQueue, setPopupQueue] = useState([]);
  const knownIds    = useRef(new Set());
  const initialized = useRef(false);

  const [activities, setActivities] = useState([]);

  const pushActivity = useCallback((order) => {
    setActivities((prev) =>
      [{ id: `${order.id}-${Date.now()}`, order, time: new Date() }, ...prev].slice(0, 40)
    );
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "orders"), (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setOrders(docs);
      setLoading(false);

      snap.docChanges().forEach((change) => {
        const order = { id: change.doc.id, ...change.doc.data() };

        if (change.type === "added") {
          if (!initialized.current) { knownIds.current.add(order.id); return; }
          if (knownIds.current.has(order.id)) return;
          knownIds.current.add(order.id);
          if (normalizeStatus(order.status) === "pending") {
            setPopupQueue((prev) => [...prev, order]);
            playNewOrderSound();
            pushActivity(order);
          }
        }
        if (change.type === "modified") {
          pushActivity(order);
        }
      });

      initialized.current = true;
    });
    return unsub;
  }, [pushActivity]);

  /* ─── stats ─── */
  const todayOrders = useMemo(() => orders.filter((o) => isToday(o.createdAt)), [orders]);

  const stats = useMemo(() => {
    const by = (s) => todayOrders.filter((o) => normalizeStatus(o.status) === s).length;
    const revenue = todayOrders
      .filter((o) => normalizeStatus(o.status) === "completed")
      .reduce((s, o) => s + Number(o.grandTotal ?? o.subtotal ?? 0), 0);

    const withEstimate = todayOrders.filter((o) => o.estimatedMinutes != null);
    const avgPrep = withEstimate.length > 0
      ? Math.round(withEstimate.reduce((s, o) => s + Number(o.estimatedMinutes), 0) / withEstimate.length)
      : null;

    const waiting = orders.filter((o) => {
      const s = normalizeStatus(o.status);
      return !["completed", "cancelled"].includes(s);
    }).length;

    return {
      revenue,
      pending:    by("pending"),
      preparing:  by("accepted") + by("cooking"),
      ready:      by("ready_for_delivery"),
      delivering: by("picked_up") + by("delivering"),
      completed:  by("completed"),
      avgPrep,
      waiting,
    };
  }, [todayOrders, orders]);

  const recentOrders = useMemo(() =>
    [...orders]
      .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
      .slice(0, 15),
    [orders]
  );

  /* ─── actions ─── */
  const acceptOrder = async (orderId) => {
    await updateDoc(doc(db, "orders", orderId), { status: "accepted" });
    setPopupQueue((prev) => prev.filter((o) => o.id !== orderId));
  };

  const rejectOrder = async (orderId) => {
    await updateDoc(doc(db, "orders", orderId), { status: "cancelled" });
    setPopupQueue((prev) => prev.filter((o) => o.id !== orderId));
  };

  const acceptAll = async () => {
    const pending = orders.filter((o) => normalizeStatus(o.status) === "pending");
    if (!pending.length) return;
    const batch = writeBatch(db);
    pending.forEach((o) => batch.update(doc(db, "orders", o.id), { status: "accepted" }));
    await batch.commit();
    setPopupQueue([]);
  };

  const currentPopup = popupQueue[0] || null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {currentPopup && (
        <NewOrderPopup
          order={currentPopup}
          onAccept={acceptOrder}
          onReject={rejectOrder}
          queueLength={popupQueue.length}
        />
      )}

      <div className="p-4 md:p-5 lg:p-6 space-y-5 max-w-[1600px] mx-auto">

        {/* ── Page header ── */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-xl md:text-2xl font-black text-gray-900">Dashboard</h1>
              {stats.pending > 0 && (
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                </span>
              )}
            </div>
            <p className="text-sm text-gray-400 font-medium mt-0.5">
              {stats.waiting} in progress · Live updates
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {stats.pending > 0 && (
              <button
                onClick={acceptAll}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white font-black rounded-xl hover:bg-primary-dark transition-colors shadow-sm text-sm"
              >
                <CheckCheck size={16} />
                Accept All ({stats.pending})
              </button>
            )}
            <button
              onClick={() => navigate("/store/v2/orders")}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-sm font-bold text-gray-600 rounded-xl hover:bg-gray-50 transition-colors"
            >
              All Orders <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* ── Revenue hero card ── */}
        <div className="bg-gradient-to-br from-primary to-primary-dark rounded-2xl p-5 md:p-6 text-white shadow-lg">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-bold text-white/70 uppercase tracking-wide">Today's Revenue</p>
              <p className="text-4xl md:text-5xl font-black mt-2 tabular-nums">
                ฿{fmtMoney(stats.revenue)}
              </p>
              <p className="text-sm text-white/60 mt-2 font-medium">
                {stats.completed} completed · {todayOrders.length} total orders today
              </p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <TrendingUp size={26} className="text-white" />
            </div>
          </div>

          {/* Mini stats row inside revenue card */}
          <div className="mt-5 pt-4 border-t border-white/20 grid grid-cols-3 gap-4">
            <div>
              <p className="text-2xl font-black tabular-nums">{stats.pending}</p>
              <p className="text-xs text-white/60 font-bold uppercase tracking-wide mt-0.5">New</p>
            </div>
            <div>
              <p className="text-2xl font-black tabular-nums">{stats.preparing}</p>
              <p className="text-xs text-white/60 font-bold uppercase tracking-wide mt-0.5">Preparing</p>
            </div>
            <div>
              <p className="text-2xl font-black tabular-nums">{stats.delivering}</p>
              <p className="text-xs text-white/60 font-bold uppercase tracking-wide mt-0.5">Delivering</p>
            </div>
          </div>
        </div>

        {/* ── KPI cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
          <StatCard
            icon={ShoppingBag}
            iconBg="bg-red-50"
            iconColor="text-red-500"
            label="New Orders"
            value={stats.pending}
            accent={stats.pending > 0}
            pulse={stats.pending > 0}
            onClick={() => navigate("/store/v2/orders")}
          />
          <StatCard
            icon={UtensilsCrossed}
            iconBg="bg-orange-50"
            iconColor="text-orange-500"
            label="Preparing"
            value={stats.preparing}
            onClick={() => navigate("/store/v2/orders")}
          />
          <StatCard
            icon={Clock}
            iconBg="bg-blue-50"
            iconColor="text-blue-500"
            label="Ready"
            value={stats.ready}
            onClick={() => navigate("/store/v2/orders")}
          />
          <StatCard
            icon={Bike}
            iconBg="bg-purple-50"
            iconColor="text-purple-500"
            label="Delivering"
            value={stats.delivering}
            onClick={() => navigate("/store/v2/orders")}
          />
          <StatCard
            icon={CheckCircle}
            iconBg="bg-green-50"
            iconColor="text-green-600"
            label="Completed"
            value={stats.completed}
            onClick={() => navigate("/store/v2/orders")}
          />
          <StatCard
            icon={Users}
            iconBg="bg-indigo-50"
            iconColor="text-indigo-500"
            label="Waiting"
            value={stats.waiting}
            onClick={() => navigate("/store/v2/orders")}
          />
        </div>

        {/* Avg prep time banner */}
        {stats.avgPrep != null && (
          <div className="flex items-center gap-4 bg-amber-50 border border-amber-100 rounded-2xl px-5 py-4">
            <Timer size={20} className="text-amber-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-black text-amber-800">
                Average Prep Time Today
              </p>
              <p className="text-xs text-amber-600 font-medium mt-0.5">
                {stats.avgPrep} minutes per order
              </p>
            </div>
          </div>
        )}

        {/* ── Main content: recent orders + activity ── */}
        <div className="flex gap-5 items-start">

          {/* Recent orders */}
          <div className="flex-1 min-w-0 bg-white rounded-2xl border border-gray-100">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-gray-700 uppercase tracking-wider">Recent Orders</h2>
                {stats.pending > 0 && (
                  <span className="bg-red-500 text-white text-xs font-black px-2.5 py-0.5 rounded-full">
                    {stats.pending} new
                  </span>
                )}
              </div>
              <button
                onClick={() => navigate("/store/v2/orders")}
                className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
              >
                View all <ArrowRight size={12} />
              </button>
            </div>

            {recentOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-300">
                <ShoppingBag size={40} className="mb-3" />
                <p className="text-sm font-medium">No orders yet today</p>
              </div>
            ) : (
              <div className="p-3 space-y-2">
                {recentOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onAccept={acceptOrder}
                    onReject={rejectOrder}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Activity feed — visible on lg+ */}
          <div className="w-72 xl:w-80 flex-shrink-0 bg-white rounded-2xl border border-gray-100 hidden lg:flex flex-col">
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Bell size={15} className="text-gray-400" />
                <h2 className="text-sm font-black text-gray-700 uppercase tracking-wider">Activity</h2>
              </div>
              {activities.length > 0 && (
                <button
                  onClick={() => setActivities([])}
                  className="text-[10px] font-bold text-gray-400 hover:text-gray-600"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto max-h-[600px] px-4">
              {activities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-300">
                  <AlertCircle size={28} className="mb-2" />
                  <p className="text-xs font-medium">No activity yet</p>
                  <p className="text-[10px] text-gray-200 mt-1">Updates appear here in real-time</p>
                </div>
              ) : (
                activities.map((item) => (
                  <ActivityItem key={item.id} item={item} />
                ))
              )}
            </div>
          </div>

        </div>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
      `}</style>
    </>
  );
}
