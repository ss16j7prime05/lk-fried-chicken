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
  CreditCard,
  Bell,
  AlertCircle,
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
  } catch {
    // browser blocked autoplay — user will see the popup regardless
  }
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

const ACTIVITY_ICON = {
  pending:            { bg: "bg-red-50",    color: "text-red-500",    icon: ShoppingBag },
  accepted:           { bg: "bg-yellow-50", color: "text-yellow-600", icon: CheckCircle },
  cooking:            { bg: "bg-orange-50", color: "text-orange-500", icon: UtensilsCrossed },
  ready_for_delivery: { bg: "bg-blue-50",   color: "text-blue-500",   icon: Timer },
  delivering:         { bg: "bg-purple-50", color: "text-purple-500", icon: Bike },
  completed:          { bg: "bg-green-50",  color: "text-green-600",  icon: CheckCheck },
  cancelled:          { bg: "bg-gray-50",   color: "text-gray-400",   icon: X },
};

/* ─── New Order Popup ─── */
function NewOrderPopup({ order, onAccept, onReject, queueLength }) {
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const itemCount = (order.items || []).reduce((s, i) => s + (i.qty || 1), 0);

  const handleAccept = async () => {
    setAccepting(true);
    await onAccept(order.id);
  };
  const handleReject = async () => {
    setRejecting(true);
    await onReject(order.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-[fadeInUp_0.2s_ease]">
        {/* Alert banner */}
        <div className="bg-red-500 px-5 py-3 flex items-center gap-3">
          <div className="flex h-3 w-3 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-red-200 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
          </div>
          <p className="text-white font-black text-sm flex-1">NEW ORDER RECEIVED</p>
          {queueLength > 1 && (
            <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              +{queueLength - 1} more
            </span>
          )}
        </div>

        {/* Order header */}
        <div className="px-5 pt-4 pb-2 flex items-start justify-between">
          <div>
            <p className="text-lg font-black text-gray-900">{order.orderNo || order.id?.slice(0, 12)}</p>
            <p className="text-xs text-gray-400 font-medium mt-0.5">{fmtTime(order.createdAt)}</p>
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
            <Users size={14} className="text-gray-400 flex-shrink-0" />
            <span className="font-bold">{order.customerName || "—"}</span>
          </div>
          {order.phone && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Phone size={14} className="text-gray-400 flex-shrink-0" />
              <span>{order.phone}</span>
            </div>
          )}
          {(order.deliveryAddress || order.address) && (
            <div className="flex items-start gap-2 text-sm text-gray-500">
              <MapPin size={14} className="text-gray-400 flex-shrink-0 mt-0.5" />
              <span className="line-clamp-2">{order.deliveryAddress || order.address}</span>
            </div>
          )}
        </div>

        {/* Items */}
        <div className="px-5 py-3 border-t border-gray-50 space-y-2 max-h-44 overflow-y-auto">
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
                  {options && (
                    <p className="text-xs text-gray-400 truncate">{options}</p>
                  )}
                  {item.note && (
                    <p className="text-xs text-primary truncate">Note: {item.note}</p>
                  )}
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
          <p className="text-xl font-black text-gray-900">
            ฿{fmtMoney(order.grandTotal ?? order.subtotal)}
          </p>
        </div>

        {/* Actions */}
        <div className="px-5 py-4 flex gap-3 border-t border-gray-100">
          <button
            onClick={handleReject}
            disabled={rejecting || accepting}
            className="flex-1 py-3 rounded-2xl border-2 border-gray-200 text-sm font-black text-gray-600 hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-colors disabled:opacity-50"
          >
            {rejecting ? "Rejecting…" : "✕ Reject"}
          </button>
          <button
            onClick={handleAccept}
            disabled={accepting || rejecting}
            className="flex-2 flex-[2] py-3 rounded-2xl bg-primary text-white text-sm font-black hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            {accepting ? "Accepting…" : "✓ Accept Order"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Stat Card ─── */
function StatCard({ icon: Icon, iconBg, iconColor, label, value, accent, pulse }) {
  return (
    <div className={`bg-white rounded-2xl p-4 shadow-soft border ${accent ? "border-red-200" : "border-gray-100"} relative overflow-hidden`}>
      {pulse && (
        <span className="absolute top-3 right-3 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
        </span>
      )}
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconBg}`}>
        <Icon size={18} className={iconColor} />
      </div>
      <p className="text-2xl font-black text-gray-900 mt-3 tabular-nums">{value}</p>
      <p className="text-xs font-bold text-gray-400 mt-0.5 uppercase tracking-wide">{label}</p>
    </div>
  );
}

/* ─── Order Row ─── */
function OrderRow({ order, onAccept, onReject }) {
  const status = normalizeStatus(order.status);
  const itemCount = (order.items || []).reduce((s, i) => s + (i.qty || 1), 0);
  const isPending = status === "pending";

  return (
    <tr className={`transition-colors ${isPending ? "bg-red-50/50 hover:bg-red-50" : "hover:bg-gray-50"}`}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {isPending && (
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
          )}
          <span className="text-sm font-bold text-gray-900 whitespace-nowrap">
            {order.orderNo || order.id?.slice(0, 8)}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 max-w-[120px]">
        <p className="truncate font-medium">{order.customerName || "—"}</p>
        <p className="text-xs text-gray-400">{order.phone || ""}</p>
      </td>
      <td className="px-4 py-3">
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${BADGE[status] || "bg-gray-100 text-gray-500"}`}>
          {STATUS_LABEL[status] || status}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-400 whitespace-nowrap hidden md:table-cell">
        {itemCount} item{itemCount !== 1 ? "s" : ""}
      </td>
      <td className="px-4 py-3 text-sm font-bold text-gray-900 whitespace-nowrap text-right">
        ฿{fmtMoney(order.grandTotal ?? order.subtotal)}
      </td>
      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap hidden lg:table-cell text-right">
        {fmtTime(order.createdAt)}
      </td>
      {isPending && (
        <td className="px-4 py-3">
          <div className="flex gap-1.5">
            <button
              onClick={() => onAccept(order.id)}
              className="text-xs font-bold px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors whitespace-nowrap"
            >
              Accept
            </button>
            <button
              onClick={() => onReject(order.id)}
              className="text-xs font-bold px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              Reject
            </button>
          </div>
        </td>
      )}
      {!isPending && <td className="px-4 py-3" />}
    </tr>
  );
}

/* ─── Activity Item ─── */
function ActivityItem({ item }) {
  const status = normalizeStatus(item.order.status);
  const style = ACTIVITY_ICON[status] || ACTIVITY_ICON.cancelled;
  const Icon = style.icon;
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${style.bg}`}>
        <Icon size={14} className={style.color} />
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

  // New order popup queue
  const [popupQueue, setPopupQueue] = useState([]);
  const knownIds    = useRef(new Set());
  const initialized = useRef(false);

  // Activity feed (session-local)
  const [activities, setActivities] = useState([]);

  const pushActivity = useCallback((order) => {
    setActivities((prev) =>
      [{ id: `${order.id}-${Date.now()}`, order, time: new Date() }, ...prev].slice(0, 30)
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
          if (!initialized.current) {
            knownIds.current.add(order.id);
            return;
          }
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
      .slice(0, 20),
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

  /* ─── popup (FIFO) ─── */
  const currentPopup = popupQueue[0] || null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* New order fullscreen popup */}
      {currentPopup && (
        <NewOrderPopup
          order={currentPopup}
          onAccept={acceptOrder}
          onReject={rejectOrder}
          queueLength={popupQueue.length}
        />
      )}

      <div className="p-5 lg:p-6 space-y-5 max-w-[1400px] mx-auto">

        {/* ── Page header ── */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-gray-900">Dashboard</h1>
              {stats.pending > 0 && (
                <span className="flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 font-medium mt-0.5">
              {stats.waiting} order{stats.waiting !== 1 ? "s" : ""} in progress · Live
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {stats.pending > 0 && (
              <button
                onClick={acceptAll}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-black rounded-xl hover:bg-primary-dark transition-colors shadow-sm"
              >
                <CheckCheck size={15} />
                Accept All ({stats.pending})
              </button>
            )}
            <button
              onClick={() => navigate("/store/v2/orders")}
              className="px-4 py-2 border border-gray-200 text-sm font-bold text-gray-600 rounded-xl hover:bg-gray-50 transition-colors"
            >
              View All Orders
            </button>
          </div>
        </div>

        {/* ── KPI cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
          {/* Revenue — spans 2 cols */}
          <div className="col-span-2 bg-gradient-to-br from-primary to-primary-dark rounded-2xl p-5 text-white shadow-lg">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold text-white/70 uppercase tracking-wide">Today's Revenue</p>
                <p className="text-3xl font-black mt-1 tabular-nums">฿{fmtMoney(stats.revenue)}</p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                <TrendingUp size={18} className="text-white" />
              </div>
            </div>
            <p className="text-xs text-white/60 mt-3 font-medium">
              {stats.completed} completed order{stats.completed !== 1 ? "s" : ""}
            </p>
          </div>

          <StatCard
            icon={ShoppingBag}
            iconBg="bg-red-50"
            iconColor="text-red-500"
            label="New Orders"
            value={stats.pending}
            accent={stats.pending > 0}
            pulse={stats.pending > 0}
          />
          <StatCard
            icon={UtensilsCrossed}
            iconBg="bg-orange-50"
            iconColor="text-orange-500"
            label="Preparing"
            value={stats.preparing}
          />
          <StatCard
            icon={Clock}
            iconBg="bg-blue-50"
            iconColor="text-blue-500"
            label="Ready"
            value={stats.ready}
          />
          <StatCard
            icon={Bike}
            iconBg="bg-purple-50"
            iconColor="text-purple-500"
            label="Delivering"
            value={stats.delivering}
          />
          <StatCard
            icon={CheckCircle}
            iconBg="bg-green-50"
            iconColor="text-green-600"
            label="Completed"
            value={stats.completed}
          />
          <StatCard
            icon={Users}
            iconBg="bg-indigo-50"
            iconColor="text-indigo-500"
            label="Customers Waiting"
            value={stats.waiting}
          />
        </div>

        {/* Avg prep time banner (only when data exists) */}
        {stats.avgPrep != null && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-2xl px-5 py-3">
            <Timer size={16} className="text-amber-500 flex-shrink-0" />
            <p className="text-sm font-bold text-amber-700">
              Average prep time today: <span className="text-amber-900">{stats.avgPrep} min</span>
            </p>
          </div>
        )}

        {/* ── Main content: orders table + notification center ── */}
        <div className="flex gap-5 items-start">

          {/* Recent orders */}
          <div className="flex-1 min-w-0 bg-white rounded-2xl border border-gray-100 shadow-soft">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-gray-700 uppercase tracking-wider">Recent Orders</h2>
                {stats.pending > 0 && (
                  <span className="bg-red-100 text-red-600 text-xs font-black px-2 py-0.5 rounded-full">
                    {stats.pending} new
                  </span>
                )}
              </div>
              <button
                onClick={() => navigate("/store/v2/orders")}
                className="text-xs font-bold text-primary hover:underline"
              >
                View all →
              </button>
            </div>
            <div className="overflow-x-auto">
              {recentOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-gray-300">
                  <ShoppingBag size={36} className="mb-3" />
                  <p className="text-sm font-medium">No orders yet</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      <th className="px-4 py-3 text-left">Order No.</th>
                      <th className="px-4 py-3 text-left">Customer</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left hidden md:table-cell">Items</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3 text-right hidden lg:table-cell">Time</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {recentOrders.map((order) => (
                      <OrderRow
                        key={order.id}
                        order={order}
                        onAccept={acceptOrder}
                        onReject={rejectOrder}
                      />
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Notification center */}
          <div className="w-72 flex-shrink-0 bg-white rounded-2xl border border-gray-100 shadow-soft hidden xl:flex flex-col">
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
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
            <div className="flex-1 overflow-y-auto max-h-[520px] px-4">
              {activities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-300">
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

      {/* CSS for popup animation */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
      `}</style>
    </>
  );
}
