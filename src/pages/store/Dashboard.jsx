import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import {
  TrendingUp, ShoppingBag, UtensilsCrossed, CheckCircle, Bike,
  Clock, Users, Timer, CheckCheck, X, Phone, Bell, AlertCircle,
  ArrowRight, Package, BarChart2, Star, Zap, Calendar, ChefHat,
} from "lucide-react";
import { db } from "../../firebase";
import { STORE_ID } from "../../config";
import { byNewest, fmtMoney, fmtTime, normalizeStatus, STATUS_LABEL, toDate } from "../../store/orderStatus";
import { updateOrderStatus, cancelOrder } from "../../store/orderEngine";

/* ─── helpers ─── */
const isToday    = (ts) => { const d = toDate(ts); if (!d) return false; const n = new Date(); return d.getFullYear()===n.getFullYear()&&d.getMonth()===n.getMonth()&&d.getDate()===n.getDate(); };
const isThisWeek = (ts) => {
  const d = toDate(ts); if (!d) return false;
  const now = new Date();
  const start = new Date(now); start.setDate(now.getDate() - now.getDay()); start.setHours(0,0,0,0);
  return d >= start;
};
const isThisMonth = (ts) => {
  const d = toDate(ts); if (!d) return false;
  const now = new Date();
  return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear();
};
const fmtMoneyK   = (n) => n >= 10000 ? `฿${(n/1000).toFixed(0)}K` : n >= 1000 ? `฿${(n/1000).toFixed(1)}K` : `฿${fmtMoney(n)}`;
const revenueOf   = (list) => list.filter(o => normalizeStatus(o.status)==="completed").reduce((s,o)=>s+Number(o.grandTotal??o.subtotal??0),0);

/* ─── status styling ─── */
const BADGE = {
  pending:"bg-red-100 text-red-600", accepted:"bg-yellow-100 text-yellow-700",
  cooking:"bg-orange-100 text-orange-600", ready_for_delivery:"bg-blue-100 text-blue-600",
  picked_up:"bg-indigo-100 text-indigo-600", delivering:"bg-purple-100 text-purple-600",
  completed:"bg-green-100 text-green-700", cancelled:"bg-gray-100 text-gray-500",
};
const STATUS_DOT = {
  pending:"bg-red-500", accepted:"bg-yellow-500", cooking:"bg-orange-500",
  ready_for_delivery:"bg-blue-500", picked_up:"bg-indigo-500", delivering:"bg-purple-500",
  completed:"bg-green-500", cancelled:"bg-gray-400",
};
const ACTIVITY_ICON = {
  pending:            { bg:"bg-red-50",    color:"text-red-500",    icon:ShoppingBag      },
  accepted:           { bg:"bg-yellow-50", color:"text-yellow-600", icon:CheckCircle      },
  cooking:            { bg:"bg-orange-50", color:"text-orange-500", icon:UtensilsCrossed  },
  ready_for_delivery: { bg:"bg-blue-50",   color:"text-blue-500",   icon:Package          },
  delivering:         { bg:"bg-purple-50", color:"text-purple-500", icon:Bike             },
  completed:          { bg:"bg-green-50",  color:"text-green-600",  icon:CheckCircle      },
  cancelled:          { bg:"bg-gray-50",   color:"text-gray-400",   icon:X               },
};

/* ─── StatCard ─── */
function StatCard({ icon:Icon, iconBg, iconColor, label, value, accent, pulse, onClick }) {
  return (
    <button onClick={onClick} className={`bg-white rounded-2xl p-4 border text-left transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.97] active:shadow-none w-full relative overflow-hidden ${accent?"border-red-200 bg-red-50/40 shadow-sm":"border-gray-100 hover:border-gray-200"}`}>
      {pulse && (
        <span className="absolute top-3 right-3 flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
        </span>
      )}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}><Icon size={20} className={iconColor} /></div>
      <p className="text-2xl md:text-3xl font-black text-gray-900 mt-3 tabular-nums leading-none">{value}</p>
      <p className="text-[11px] font-bold text-gray-400 mt-1 uppercase tracking-wide leading-tight">{label}</p>
    </button>
  );
}

/* ─── Revenue period card ─── */
function RevCard({ label, icon:Icon, iconBg, iconColor, value, sub }) {
  return (
    <div className="flex-1 bg-white rounded-2xl border border-gray-100 p-4 md:p-5 min-w-0">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}><Icon size={15} className={iconColor} /></div>
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider leading-tight">{label}</span>
      </div>
      <p className="text-xl md:text-2xl lg:text-3xl font-black text-gray-900 tabular-nums leading-none">฿{fmtMoney(value)}</p>
      {sub && <p className="text-[11px] text-gray-400 font-medium mt-1.5">{sub}</p>}
    </div>
  );
}

/* ─── Hourly bar chart (pure SVG, no library) ─── */
function HourlyChart({ todayOrders }) {
  const [mode, setMode] = useState("revenue");
  const currentHour = new Date().getHours();

  const buckets = useMemo(() => {
    const arr = Array.from({length:24},(_,h)=>({h, revenue:0, count:0}));
    todayOrders.forEach(o => {
      const d = toDate(o.createdAt); if (!d) return;
      const h = d.getHours();
      arr[h].count += 1;
      if (normalizeStatus(o.status) === "completed")
        arr[h].revenue += Number(o.grandTotal??o.subtotal??0);
    });
    return arr;
  }, [todayOrders]);

  const values = buckets.map(b => mode==="revenue" ? b.revenue : b.count);
  const max    = Math.max(...values, 1);

  const BAR_W = 9, GAP = 2;
  const CW = 24*(BAR_W+GAP)-GAP, CH = 80, LH = 14;

  const fmtHour = (h) => h===0?"12a":h<12?`${h}a`:h===12?"12p":`${h-12}p`;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 md:p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-black text-gray-800">Hourly Activity</h3>
          <p className="text-[11px] text-gray-400 font-medium mt-0.5">Today by hour of day</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          <button onClick={()=>setMode("revenue")} className={`px-3 py-1 text-xs font-black rounded-lg transition-colors ${mode==="revenue"?"bg-white shadow-sm text-gray-900":"text-gray-400 hover:text-gray-600"}`}>Revenue</button>
          <button onClick={()=>setMode("orders")}  className={`px-3 py-1 text-xs font-black rounded-lg transition-colors ${mode==="orders" ?"bg-white shadow-sm text-gray-900":"text-gray-400 hover:text-gray-600"}`}>Orders</button>
        </div>
      </div>

      <div className="text-right mb-1">
        <span className="text-[10px] font-medium text-gray-300">max {mode==="revenue"?fmtMoneyK(max):`${max} orders`}</span>
      </div>

      <svg width="100%" viewBox={`0 0 ${CW} ${CH+LH}`} preserveAspectRatio="none" style={{height:100}}>
        {buckets.map((b,i) => {
          const val  = mode==="revenue" ? b.revenue : b.count;
          const barH = val===0 ? 2 : Math.max(3,(val/max)*CH);
          const x    = i*(BAR_W+GAP);
          const isCur = i===currentHour;
          return (
            <g key={i}>
              <rect x={x} y={val===0?CH-2:CH-barH} width={BAR_W} height={val===0?2:barH} rx={2}
                fill={isCur?"#ef4444":val>0?"#f97316":"#f3f4f6"}
                opacity={isCur?1:val>0?0.75:1}
              />
              {i%6===0 && (
                <text x={x+BAR_W/2} y={CH+LH} textAnchor="middle" fontSize={8} fill="#c0c0c0" fontFamily="monospace">
                  {fmtHour(i)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div className="flex items-center gap-4 mt-2 text-[10px] font-bold text-gray-300">
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded bg-[#f97316] opacity-75" />Orders</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded bg-red-500" />Now</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded bg-gray-200" />Empty</span>
      </div>
    </div>
  );
}

/* ─── Weekly bar chart (last 7 days) ─── */
function WeeklyChart({ orders }) {
  const buckets = useMemo(() => {
    const days = Array.from({length:7},(_,i) => {
      const d = new Date(); d.setDate(d.getDate()-(6-i)); d.setHours(0,0,0,0);
      return { date:d, revenue:0, count:0, label:d.toLocaleDateString("en-GB",{weekday:"short"}) };
    });
    orders.forEach(o => {
      const d = toDate(o.createdAt); if (!d) return;
      const idx = days.findIndex(b => { const nxt = new Date(b.date); nxt.setDate(nxt.getDate()+1); return d>=b.date&&d<nxt; });
      if (idx<0) return;
      days[idx].count += 1;
      if (normalizeStatus(o.status)==="completed")
        days[idx].revenue += Number(o.grandTotal??o.subtotal??0);
    });
    return days;
  }, [orders]);

  const max    = Math.max(...buckets.map(b=>b.revenue), 1);
  const BAR_W  = 28, GAP = 10;
  const CW     = 7*(BAR_W+GAP)-GAP, CH = 64, LH = 16;
  const TODAY  = 6;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 md:p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-black text-gray-800">Weekly Revenue</h3>
          <p className="text-[11px] text-gray-400 font-medium mt-0.5">Last 7 days · completed orders</p>
        </div>
        <span className="text-[10px] font-medium text-gray-300">max {fmtMoneyK(max)}</span>
      </div>
      <svg width="100%" viewBox={`0 0 ${CW} ${CH+LH+12}`} style={{height:96}}>
        {buckets.map((b,i) => {
          const barH = b.revenue===0 ? 2 : Math.max(3,(b.revenue/max)*CH);
          const x    = i*(BAR_W+GAP);
          const isTdy = i===TODAY;
          return (
            <g key={i}>
              <rect x={x} y={b.revenue===0?CH-2:CH-barH} width={BAR_W} height={b.revenue===0?2:barH} rx={4}
                fill={isTdy?"#f97316":"#e5e7eb"} opacity={isTdy?1:b.revenue>0?0.8:1}
              />
              {b.revenue>0 && (
                <text x={x+BAR_W/2} y={b.revenue===0?CH-4:CH-barH-4} textAnchor="middle" fontSize={7}
                  fill={isTdy?"#ea580c":"#9ca3af"} fontWeight={isTdy?"bold":"normal"}>
                  {fmtMoneyK(b.revenue)}
                </text>
              )}
              <text x={x+BAR_W/2} y={CH+LH} textAnchor="middle" fontSize={9}
                fill={isTdy?"#f97316":"#9ca3af"} fontWeight={isTdy?"bold":"normal"}>
                {b.label}
              </text>
              {b.count>0 && (
                <text x={x+BAR_W/2} y={CH+LH+11} textAnchor="middle" fontSize={7} fill="#c0c0c0">
                  {b.count}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ─── Insight row ─── */
function InsightRow({ icon:Icon, iconBg, iconColor, label, value, sub }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}><Icon size={16} className={iconColor} /></div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
        <p className="text-sm font-black text-gray-900 mt-0.5 truncate">{value}</p>
      </div>
      {sub && <span className="text-xs font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-lg flex-shrink-0 border border-gray-100">{sub}</span>}
    </div>
  );
}

/* ─── Order Card ─── */
function OrderCard({ order, onAccept, onReject }) {
  const status    = normalizeStatus(order.status);
  const itemCount = (order.items||[]).reduce((s,i)=>s+(i.qty||1),0);
  const isPending = status==="pending";
  return (
    <div className={`bg-white rounded-2xl border transition-all ${isPending?"border-red-200 shadow-sm":"border-gray-100"}`}>
      <div className="p-4 flex items-start gap-3">
        <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${STATUS_DOT[status]||"bg-gray-400"} ${isPending?"animate-pulse":""}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-black text-gray-900 truncate">{order.orderNo||order.id?.slice(0,10)}</p>
            <p className="text-sm font-black text-gray-900 whitespace-nowrap">฿{fmtMoney(order.grandTotal??order.subtotal)}</p>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <p className="text-xs font-medium text-gray-500 truncate">{order.customerName||"—"}</p>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${BADGE[status]||"bg-gray-100 text-gray-500"}`}>{STATUS_LABEL[status]||status}</span>
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-400 font-medium">
            <span>{itemCount} item{itemCount!==1?"s":""}</span>
            <span>·</span>
            <span>{fmtTime(order.createdAt)}</span>
            {order.phone && (<><span>·</span><a href={`tel:${order.phone}`} className="flex items-center gap-1 text-primary hover:underline"><Phone size={10}/>{order.phone}</a></>)}
          </div>
        </div>
      </div>
      {isPending && (
        <div className="flex gap-2 px-4 pb-4 pt-1">
          <button onClick={()=>onReject(order.id)} className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-sm font-black text-gray-600 hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-colors">Reject</button>
          <button onClick={()=>onAccept(order.id)} className="flex-[2] py-3 rounded-xl bg-primary text-white text-sm font-black hover:bg-primary-dark transition-colors">✓ Accept</button>
        </div>
      )}
    </div>
  );
}

/* ─── Activity item ─── */
function ActivityItem({ item }) {
  const status = normalizeStatus(item.order.status);
  const style  = ACTIVITY_ICON[status]||ACTIVITY_ICON.cancelled;
  const Icon   = style.icon;
  return (
    <div className="flex items-center gap-2.5 py-2.5 border-b border-gray-50 last:border-0">
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${style.bg}`}><Icon size={14} className={style.color}/></div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-black text-gray-800 truncate">{item.order.orderNo||item.order.id?.slice(0,10)}</p>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${style.bg} ${style.color}`}>{STATUS_LABEL[status]||status}</span>
        </div>
        <p className="text-[10px] text-gray-300 mt-0.5">{item.time.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}</p>
      </div>
      <p className="text-xs font-bold text-gray-500 whitespace-nowrap flex-shrink-0">฿{fmtMoney(item.order.grandTotal??item.order.subtotal)}</p>
    </div>
  );
}

/* ─── Dashboard ─── */
export function Dashboard() {
  const navigate = useNavigate();
  const [orders, setOrders]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [activities, setActivities] = useState([]);
  const [now, setNow]           = useState(Date.now());
  const initialized             = useRef(false);

  /* live clock for date display */
  useEffect(() => { const id = setInterval(()=>setNow(Date.now()),60000); return ()=>clearInterval(id); }, []);

  const pushActivity = useCallback((order) => {
    setActivities(prev=>[{id:`${order.id}-${Date.now()}`,order,time:new Date()},...prev].slice(0,40));
  },[]);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db,"orders"), where("storeId","==",STORE_ID)), snap => {
      setOrders(snap.docs.map(d=>({id:d.id,...d.data()})));
      setLoading(false);
      snap.docChanges().forEach(ch => {
        const order = {id:ch.doc.id,...ch.doc.data()};
        if (ch.type==="added" && !initialized.current) return;
        if (ch.type==="added"||ch.type==="modified") pushActivity(order);
      });
      initialized.current = true;
    });
    return unsub;
  }, [pushActivity]);

  /* ─── computed ─── */
  const todayOrders  = useMemo(()=>orders.filter(o=>isToday(o.createdAt)),    [orders]);
  const weekOrders   = useMemo(()=>orders.filter(o=>isThisWeek(o.createdAt)), [orders]);
  const monthOrders  = useMemo(()=>orders.filter(o=>isThisMonth(o.createdAt)),[orders]);

  const todayRev  = useMemo(()=>revenueOf(todayOrders), [todayOrders]);
  const weekRev   = useMemo(()=>revenueOf(weekOrders),  [weekOrders]);
  const monthRev  = useMemo(()=>revenueOf(monthOrders), [monthOrders]);

  const stats = useMemo(() => {
    const by = (s) => todayOrders.filter(o=>normalizeStatus(o.status)===s).length;
    const withEst  = todayOrders.filter(o=>o.estimatedMinutes!=null);
    const avgPrep  = withEst.length>0
      ? Math.round(withEst.reduce((s,o)=>s+Number(o.estimatedMinutes),0)/withEst.length) : null;
    const waiting  = orders.filter(o=>!["completed","cancelled"].includes(normalizeStatus(o.status))).length;
    return {
      pending:by("pending"), preparing:by("accepted")+by("cooking"),
      ready:by("ready_for_delivery"), delivering:by("picked_up")+by("delivering"),
      completed:by("completed"), avgPrep, waiting,
    };
  }, [todayOrders, orders]);

  /* peak hour */
  const peakHour = useMemo(() => {
    const b = Array(24).fill(0);
    todayOrders.forEach(o => { const d=toDate(o.createdAt); if(d) b[d.getHours()]++; });
    const mx = Math.max(...b); if(mx===0) return null;
    const h  = b.indexOf(mx);
    const lbl = h===0?"12:00 AM":h<12?`${h}:00 AM`:h===12?"12:00 PM":`${h-12}:00 PM`;
    return { label:lbl, count:mx };
  }, [todayOrders]);

  /* best seller */
  const bestSeller = useMemo(() => {
    const counts = {};
    todayOrders.forEach(o => (o.items||[]).forEach(it => {
      const nm = it.name||"?"; counts[nm]=(counts[nm]||0)+(it.qty||1);
    }));
    const entries = Object.entries(counts);
    if (!entries.length) return null;
    const [name,qty] = entries.reduce((best,cur)=>cur[1]>best[1]?cur:best,["",0]);
    return {name,qty};
  }, [todayOrders]);

  /* avg delivery time (order placed → completed, delivery orders only) */
  const avgDeliveryTime = useMemo(() => {
    const done = todayOrders.filter(o =>
      normalizeStatus(o.status)==="completed" && o.orderType!=="pickup" &&
      o.createdAt && o.completedAt
    );
    if (!done.length) return null;
    const sum = done.reduce((s,o) => {
      const ms = toDate(o.completedAt)?.getTime() - toDate(o.createdAt)?.getTime();
      return s + (ms>0 ? ms/60000 : 0);
    },0);
    return Math.round(sum/done.length);
  }, [todayOrders]);

  const pickupCount   = todayOrders.filter(o=>o.orderType==="pickup").length;
  const deliveryCount = todayOrders.filter(o=>o.orderType!=="pickup").length;

  const recentOrders = useMemo(() =>
    [...orders].sort(byNewest()).slice(0,15),
    [orders]
  );

  const findOrder = (id) => orders.find((o) => o.id === id) || { id };
  const acceptOrder = (id) => updateOrderStatus(findOrder(id), "accepted", { by: "store" });
  const rejectOrder = (id) => cancelOrder(findOrder(id), { by: "store" });
  const acceptAll   = async () => {
    const pending = orders.filter(o=>normalizeStatus(o.status)==="pending");
    if (!pending.length) return;
    await Promise.all(pending.map((o) => updateOrderStatus(o, "accepted", { by: "store" })));
  };

  const nowDate = new Date(now);

  if (loading) {
    return (
      <div className="p-3 md:p-4 lg:p-5 space-y-4 max-w-[1600px] mx-auto animate-pulse">
        {/* Header skeleton */}
        <div className="flex items-center gap-3">
          <div className="flex-1 space-y-2">
            <div className="h-7 w-32 bg-gray-200 rounded-xl" />
            <div className="h-4 w-48 bg-gray-100 rounded-lg" />
          </div>
          <div className="h-10 w-32 bg-gray-200 rounded-xl" />
        </div>
        {/* Hero skeleton */}
        <div className="h-24 bg-gradient-to-br from-gray-200 to-gray-300 rounded-2xl" />
        {/* Revenue cards skeleton */}
        <div className="flex gap-3">
          {[1,2,3].map(i => (
            <div key={i} className="flex-1 bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
              <div className="h-8 w-8 bg-gray-100 rounded-lg" />
              <div className="h-6 w-24 bg-gray-100 rounded-lg" />
              <div className="h-3 w-20 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
        {/* KPI grid skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({length:6}).map((_,i) => (
            <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100 space-y-3">
              <div className="w-10 h-10 bg-gray-100 rounded-xl" />
              <div className="h-8 w-12 bg-gray-100 rounded-lg" />
              <div className="h-3 w-16 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
        {/* Charts skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 h-48" />
          <div className="bg-white rounded-2xl border border-gray-100 p-5 h-48" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-4 lg:p-5 space-y-4 max-w-[1600px] mx-auto">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-xl md:text-2xl font-black text-gray-900">Dashboard</h1>
            {stats.pending>0 && (
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"/>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"/>
              </span>
            )}
          </div>
          <p className="text-sm text-gray-400 font-medium mt-0.5">
            {nowDate.toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"})} · {stats.waiting} in progress · Live
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {stats.pending>0 && (
            <button onClick={acceptAll} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white font-black rounded-xl hover:bg-primary-dark transition-colors shadow-sm text-sm">
              <CheckCheck size={16}/> Accept All ({stats.pending})
            </button>
          )}
          <button onClick={()=>navigate("/store/orders")} className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-sm font-bold text-gray-600 rounded-xl hover:bg-gray-50 transition-colors">
            All Orders <ArrowRight size={14}/>
          </button>
        </div>
      </div>

      {/* ── Today's revenue hero ── */}
      <div className="bg-gradient-to-br from-primary to-primary-dark rounded-2xl p-4 md:p-5 text-white shadow-lg">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold text-white/70 uppercase tracking-wider">Today's Revenue</p>
            <p className="text-3xl md:text-4xl font-black mt-1 tabular-nums">฿{fmtMoney(todayRev)}</p>
            <p className="text-xs text-white/50 mt-1 font-medium">{stats.completed} completed · {todayOrders.length} total orders</p>
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
              <TrendingUp size={22} className="text-white"/>
            </div>
          </div>
        </div>
      </div>

      {/* ── Revenue period cards (Today / Week / Month) ── */}
      <div className="flex gap-3 md:gap-4">
        <RevCard label="Today"      icon={Zap}       iconBg="bg-orange-50" iconColor="text-orange-500" value={todayRev}  sub={`${stats.completed} completed · ${todayOrders.length} orders`} />
        <RevCard label="This Week"  icon={Calendar}  iconBg="bg-blue-50"   iconColor="text-blue-500"   value={weekRev}   sub={`${weekOrders.filter(o=>normalizeStatus(o.status)==="completed").length} completed · ${weekOrders.length} orders`} />
        <RevCard label="This Month" icon={TrendingUp} iconBg="bg-green-50" iconColor="text-green-600"  value={monthRev}  sub={`${monthOrders.filter(o=>normalizeStatus(o.status)==="completed").length} completed · ${monthOrders.length} orders`} />
      </div>

      {/* ── KPI live status grid ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        <StatCard icon={ShoppingBag}     iconBg="bg-red-50"    iconColor="text-red-500"    label="New Orders"  value={stats.pending}    accent={stats.pending>0} pulse={stats.pending>0} onClick={()=>navigate("/store/orders")}/>
        <StatCard icon={UtensilsCrossed} iconBg="bg-orange-50" iconColor="text-orange-500" label="Preparing"   value={stats.preparing}  onClick={()=>navigate("/store/orders")}/>
        <StatCard icon={Clock}           iconBg="bg-blue-50"   iconColor="text-blue-500"   label="Ready"       value={stats.ready}      onClick={()=>navigate("/store/orders")}/>
        <StatCard icon={Bike}            iconBg="bg-purple-50" iconColor="text-purple-500" label="Delivering"  value={stats.delivering} onClick={()=>navigate("/store/orders")}/>
        <StatCard icon={CheckCircle}     iconBg="bg-green-50"  iconColor="text-green-600"  label="Completed"   value={stats.completed}  onClick={()=>navigate("/store/orders")}/>
        <StatCard icon={Users}           iconBg="bg-indigo-50" iconColor="text-indigo-500" label="In Progress" value={stats.waiting}    onClick={()=>navigate("/store/orders")}/>
      </div>

      {/* ── Charts + Insights panel ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <HourlyChart todayOrders={todayOrders}/>

        {/* Insights */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 md:p-5">
          <h3 className="text-sm font-black text-gray-800">Today's Insights</h3>
          <p className="text-[11px] text-gray-400 font-medium mt-0.5 mb-1">Performance analytics · live</p>

          {peakHour ? (
            <InsightRow icon={Zap}     iconBg="bg-yellow-50" iconColor="text-yellow-500" label="Peak Hour"    value={peakHour.label}   sub={`${peakHour.count} orders`}/>
          ) : null}
          {bestSeller ? (
            <InsightRow icon={Star}    iconBg="bg-orange-50" iconColor="text-orange-500" label="Best Seller"  value={bestSeller.name}  sub={`${bestSeller.qty}× sold`}/>
          ) : null}
          {stats.avgPrep != null ? (
            <InsightRow icon={ChefHat} iconBg="bg-amber-50"  iconColor="text-amber-500"  label="Avg Cook Time" value={`${stats.avgPrep} min`}/>
          ) : null}
          {avgDeliveryTime != null ? (
            <InsightRow icon={Bike}    iconBg="bg-purple-50" iconColor="text-purple-500" label="Avg Delivery Time" value={`~${avgDeliveryTime} min`} sub="order to door"/>
          ) : null}
          <InsightRow
            icon={Package} iconBg="bg-indigo-50" iconColor="text-indigo-500"
            label="Order Split"
            value={todayOrders.length===0 ? "No orders yet" : `${pickupCount} Pickup  ·  ${deliveryCount} Delivery`}
          />
          {todayOrders.length===0 && !peakHour && (
            <div className="flex flex-col items-center justify-center py-8 text-gray-200 mt-2">
              <BarChart2 size={32} className="mb-2"/>
              <p className="text-xs font-medium text-gray-300">Waiting for today's orders…</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Weekly trend chart ── */}
      <WeeklyChart orders={orders}/>

      {/* ── Recent orders + Live activity ── */}
      <div className="flex gap-5 items-start">
        <div className="flex-1 min-w-0 bg-white rounded-2xl border border-gray-100">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black text-gray-700 uppercase tracking-wider">Recent Orders</h2>
              {stats.pending>0 && <span className="bg-red-500 text-white text-xs font-black px-2.5 py-0.5 rounded-full">{stats.pending} new</span>}
            </div>
            <button onClick={()=>navigate("/store/orders")} className="flex items-center gap-1 text-xs font-bold text-primary hover:underline">
              View all <ArrowRight size={12}/>
            </button>
          </div>
          {recentOrders.length===0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-300">
              <ShoppingBag size={40} className="mb-3"/>
              <p className="text-sm font-medium">No orders yet</p>
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {recentOrders.map(o=><OrderCard key={o.id} order={o} onAccept={acceptOrder} onReject={rejectOrder}/>)}
            </div>
          )}
        </div>

        {/* Live activity feed — lg+ only */}
        <div className="w-72 xl:w-80 flex-shrink-0 bg-white rounded-2xl border border-gray-100 hidden lg:flex flex-col">
          <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Bell size={15} className="text-gray-400"/>
              <h2 className="text-sm font-black text-gray-700 uppercase tracking-wider">Live Activity</h2>
              {activities.length>0 && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"/>}
            </div>
            {activities.length>0 && (
              <button onClick={()=>setActivities([])} className="text-[10px] font-bold text-gray-400 hover:text-gray-600">Clear</button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto max-h-[600px] px-4">
            {activities.length===0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-300">
                <AlertCircle size={28} className="mb-2"/>
                <p className="text-xs font-medium">No activity yet</p>
                <p className="text-[10px] text-gray-200 mt-1">Updates appear here in real-time</p>
              </div>
            ) : (
              activities.map(item=><ActivityItem key={item.id} item={item}/>)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
