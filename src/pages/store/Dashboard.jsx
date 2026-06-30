import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { collection, doc, onSnapshot, updateDoc, writeBatch } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import {
  TrendingUp, ShoppingBag, UtensilsCrossed, CheckCircle, Bike,
  Clock, Users, Timer, CheckCheck, X, Phone, Bell, AlertCircle,
  ArrowRight, Package,
} from "lucide-react";
import { db } from "../../firebase";
import { normalizeStatus, STATUS_LABEL } from "../../store/orderStatus";

/* ─── helpers ─── */
const isToday = (ts) => {
  if (!ts) return false;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
};
const fmtTime   = (ts) => { if (!ts) return "—"; const d = ts.toDate ? ts.toDate() : new Date(ts); return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }); };
const fmtMoney  = (n) => Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 0 });
const optionLabel = (v) => { if (!v) return ""; if (typeof v === "object") return v.name || ""; return v; };

/* ─── status styling ─── */
const BADGE = {
  pending: "bg-red-100 text-red-600", accepted: "bg-yellow-100 text-yellow-700",
  cooking: "bg-orange-100 text-orange-600", ready_for_delivery: "bg-blue-100 text-blue-600",
  picked_up: "bg-indigo-100 text-indigo-600", delivering: "bg-purple-100 text-purple-600",
  completed: "bg-green-100 text-green-700", cancelled: "bg-gray-100 text-gray-500",
};
const STATUS_DOT = {
  pending: "bg-red-500", accepted: "bg-yellow-500", cooking: "bg-orange-500",
  ready_for_delivery: "bg-blue-500", picked_up: "bg-indigo-500", delivering: "bg-purple-500",
  completed: "bg-green-500", cancelled: "bg-gray-400",
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

/* ─── Stat Card ─── */
function StatCard({ icon: Icon, iconBg, iconColor, label, value, accent, pulse, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`bg-white rounded-2xl p-4 border text-left transition-all hover:shadow-md active:scale-[0.98] w-full
        ${accent ? "border-red-200 bg-red-50/40 shadow-sm" : "border-gray-100"} relative overflow-hidden`}
    >
      {pulse && (
        <span className="absolute top-3 right-3 flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
        </span>
      )}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
        <Icon size={20} className={iconColor} />
      </div>
      <p className="text-2xl md:text-3xl font-black text-gray-900 mt-3 tabular-nums leading-none">{value}</p>
      <p className="text-[11px] font-bold text-gray-400 mt-1 uppercase tracking-wide leading-tight">{label}</p>
    </button>
  );
}

/* ─── Order Card ─── */
function OrderCard({ order, onAccept, onReject }) {
  const status    = normalizeStatus(order.status);
  const itemCount = (order.items || []).reduce((s, i) => s + (i.qty || 1), 0);
  const isPending = status === "pending";

  return (
    <div className={`bg-white rounded-2xl border transition-all ${isPending ? "border-red-200 shadow-sm" : "border-gray-100"}`}>
      <div className="p-4 flex items-start gap-3">
        <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${STATUS_DOT[status] || "bg-gray-400"} ${isPending ? "animate-pulse" : ""}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-black text-gray-900 truncate">{order.orderNo || order.id?.slice(0, 10)}</p>
            <p className="text-sm font-black text-gray-900 whitespace-nowrap">฿{fmtMoney(order.grandTotal ?? order.subtotal)}</p>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <p className="text-xs font-medium text-gray-500 truncate">{order.customerName || "—"}</p>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${BADGE[status] || "bg-gray-100 text-gray-500"}`}>
              {STATUS_LABEL[status] || status}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-400 font-medium">
            <span>{itemCount} item{itemCount !== 1 ? "s" : ""}</span>
            <span>·</span>
            <span>{fmtTime(order.createdAt)}</span>
            {order.phone && (
              <><span>·</span>
              <a href={`tel:${order.phone}`} className="flex items-center gap-1 text-primary hover:underline">
                <Phone size={10} /> {order.phone}
              </a></>
            )}
          </div>
        </div>
      </div>
      {isPending && (
        <div className="flex gap-2 px-4 pb-4 pt-1">
          <button onClick={() => onReject(order.id)} className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-sm font-black text-gray-600 hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-colors">Reject</button>
          <button onClick={() => onAccept(order.id)} className="flex-[2] py-3 rounded-xl bg-primary text-white text-sm font-black hover:bg-primary-dark transition-colors">✓ Accept</button>
        </div>
      )}
    </div>
  );
}

/* ─── Activity Item ─── */
function ActivityItem({ item }) {
  const status = normalizeStatus(item.order.status);
  const style  = ACTIVITY_ICON[status] || ACTIVITY_ICON.cancelled;
  const Icon   = style.icon;
  return (
    <div className="flex items-center gap-2.5 py-2.5 border-b border-gray-50 last:border-0">
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${style.bg}`}>
        <Icon size={14} className={style.color} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-black text-gray-800 truncate">{item.order.orderNo || item.order.id?.slice(0, 10)}</p>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${style.bg} ${style.color}`}>{STATUS_LABEL[status] || status}</span>
        </div>
        <p className="text-[10px] text-gray-300 mt-0.5">{item.time.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</p>
      </div>
      <p className="text-xs font-bold text-gray-500 whitespace-nowrap flex-shrink-0">฿{fmtMoney(item.order.grandTotal ?? item.order.subtotal)}</p>
    </div>
  );
}

/* ─── Dashboard ─── */
export function Dashboard() {
  const navigate = useNavigate();
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState([]);

  /* activity feed: skip existing orders on mount, only track changes after init */
  const initialized = useRef(false);

  const pushActivity = useCallback((order) => {
    setActivities((prev) =>
      [{ id: `${order.id}-${Date.now()}`, order, time: new Date() }, ...prev].slice(0, 40)
    );
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "orders"), (snap) => {
      setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);

      snap.docChanges().forEach((change) => {
        const order = { id: change.doc.id, ...change.doc.data() };
        if (change.type === "added") {
          if (!initialized.current) return; // skip existing orders on mount
          pushActivity(order);
        }
        if (change.type === "modified") pushActivity(order);
      });
      initialized.current = true;
    });
    return unsub;
  }, [pushActivity]);

  /* ─── stats ─── */
  const todayOrders = useMemo(() => orders.filter((o) => isToday(o.createdAt)), [orders]);

  const stats = useMemo(() => {
    const by = (s) => todayOrders.filter((o) => normalizeStatus(o.status) === s).length;
    const revenue = todayOrders.filter((o) => normalizeStatus(o.status) === "completed")
      .reduce((s, o) => s + Number(o.grandTotal ?? o.subtotal ?? 0), 0);
    const withEst = todayOrders.filter((o) => o.estimatedMinutes != null);
    const avgPrep = withEst.length > 0
      ? Math.round(withEst.reduce((s, o) => s + Number(o.estimatedMinutes), 0) / withEst.length) : null;
    const waiting = orders.filter((o) => !["completed", "cancelled"].includes(normalizeStatus(o.status))).length;
    return {
      revenue, pending: by("pending"), preparing: by("accepted") + by("cooking"),
      ready: by("ready_for_delivery"), delivering: by("picked_up") + by("delivering"),
      completed: by("completed"), avgPrep, waiting,
    };
  }, [todayOrders, orders]);

  const recentOrders = useMemo(() =>
    [...orders].sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)).slice(0, 15),
    [orders]
  );

  /* ─── order actions (for OrderCard inline buttons) ─── */
  const acceptOrder = async (orderId) => updateDoc(doc(db, "orders", orderId), { status: "accepted" });
  const rejectOrder = async (orderId) => updateDoc(doc(db, "orders", orderId), { status: "cancelled" });

  const acceptAll = async () => {
    const pending = orders.filter((o) => normalizeStatus(o.status) === "pending");
    if (!pending.length) return;
    const batch = writeBatch(db);
    pending.forEach((o) => batch.update(doc(db, "orders", o.id), { status: "accepted" }));
    await batch.commit();
  };

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
    <div className="p-3 md:p-4 lg:p-5 space-y-4 max-w-[1600px] mx-auto">

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
          <p className="text-sm text-gray-400 font-medium mt-0.5">{stats.waiting} in progress · Live updates</p>
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

      {/* ── Revenue hero ── */}
      <div className="bg-gradient-to-br from-primary to-primary-dark rounded-2xl p-4 md:p-5 text-white shadow-lg">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold text-white/70 uppercase tracking-wider">Today's Revenue</p>
            <p className="text-3xl md:text-4xl font-black mt-1 tabular-nums">฿{fmtMoney(stats.revenue)}</p>
            <p className="text-xs text-white/50 mt-1 font-medium">{stats.completed} completed · {todayOrders.length} total</p>
          </div>
          <div className="flex items-center gap-4 flex-shrink-0">
            <div className="text-center">
              <p className="text-2xl font-black tabular-nums">{stats.pending}</p>
              <p className="text-[10px] text-white/60 font-bold uppercase tracking-wide">New</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black tabular-nums">{stats.preparing}</p>
              <p className="text-[10px] text-white/60 font-bold uppercase tracking-wide">Prep</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black tabular-nums">{stats.delivering}</p>
              <p className="text-[10px] text-white/60 font-bold uppercase tracking-wide">Ride</p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center">
              <TrendingUp size={22} className="text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        <StatCard icon={ShoppingBag} iconBg="bg-red-50" iconColor="text-red-500" label="New Orders" value={stats.pending} accent={stats.pending > 0} pulse={stats.pending > 0} onClick={() => navigate("/store/v2/orders")} />
        <StatCard icon={UtensilsCrossed} iconBg="bg-orange-50" iconColor="text-orange-500" label="Preparing" value={stats.preparing} onClick={() => navigate("/store/v2/orders")} />
        <StatCard icon={Clock} iconBg="bg-blue-50" iconColor="text-blue-500" label="Ready" value={stats.ready} onClick={() => navigate("/store/v2/orders")} />
        <StatCard icon={Bike} iconBg="bg-purple-50" iconColor="text-purple-500" label="Delivering" value={stats.delivering} onClick={() => navigate("/store/v2/orders")} />
        <StatCard icon={CheckCircle} iconBg="bg-green-50" iconColor="text-green-600" label="Completed" value={stats.completed} onClick={() => navigate("/store/v2/orders")} />
        <StatCard icon={Users} iconBg="bg-indigo-50" iconColor="text-indigo-500" label="Waiting" value={stats.waiting} onClick={() => navigate("/store/v2/orders")} />
      </div>

      {/* Avg prep time */}
      {stats.avgPrep != null && (
        <div className="flex items-center gap-4 bg-amber-50 border border-amber-100 rounded-2xl px-5 py-4">
          <Timer size={20} className="text-amber-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-black text-amber-800">Average Prep Time Today</p>
            <p className="text-xs text-amber-600 font-medium mt-0.5">{stats.avgPrep} minutes per order</p>
          </div>
        </div>
      )}

      {/* ── Recent orders + Activity ── */}
      <div className="flex gap-5 items-start">
        {/* Recent orders */}
        <div className="flex-1 min-w-0 bg-white rounded-2xl border border-gray-100">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black text-gray-700 uppercase tracking-wider">Recent Orders</h2>
              {stats.pending > 0 && (
                <span className="bg-red-500 text-white text-xs font-black px-2.5 py-0.5 rounded-full">{stats.pending} new</span>
              )}
            </div>
            <button onClick={() => navigate("/store/v2/orders")} className="flex items-center gap-1 text-xs font-bold text-primary hover:underline">
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
                <OrderCard key={order.id} order={order} onAccept={acceptOrder} onReject={rejectOrder} />
              ))}
            </div>
          )}
        </div>

        {/* Activity feed — lg+ only */}
        <div className="w-72 xl:w-80 flex-shrink-0 bg-white rounded-2xl border border-gray-100 hidden lg:flex flex-col">
          <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Bell size={15} className="text-gray-400" />
              <h2 className="text-sm font-black text-gray-700 uppercase tracking-wider">Activity</h2>
            </div>
            {activities.length > 0 && (
              <button onClick={() => setActivities([])} className="text-[10px] font-bold text-gray-400 hover:text-gray-600">Clear</button>
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
              activities.map((item) => <ActivityItem key={item.id} item={item} />)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
