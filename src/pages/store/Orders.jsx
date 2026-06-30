import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { collection, doc, onSnapshot, updateDoc, writeBatch } from "firebase/firestore";
import {
  Search,
  X,
  Phone,
  MapPin,
  Copy,
  Printer,
  Navigation,
  CheckCheck,
  Bike,
  UtensilsCrossed,
  Package,
  Clock,
  CreditCard,
  CheckSquare,
  Square,
  ChefHat,
  Bell,
  BellOff,
  Eye,
  Download,
  User,
  Truck,
  Inbox,
  SearchX,
  WifiOff,
  AlertTriangle,
  MessageCircle,
  SlidersHorizontal,
  ArrowDownUp,
  CheckCircle2,
  XCircle,
  MoreVertical,
  TrendingUp,
  Timer,
  Star,
  Repeat,
  Route as RouteIcon,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Keyboard,
  Layers,
  Wifi,
  ScrollText,
  BarChart3,
  Pencil,
} from "lucide-react";
import { db } from "../../firebase";
import { normalizeStatus } from "../../store/orderStatus";
import { PAYMENT_STATUS } from "../../payment/paymentUtils";
import { PROMPTPAY_ID, PROMPTPAY_ACCOUNT_NAME } from "../../config";

/* ═══════════════════════ constants ═══════════════════════ */
export const TABS = [
  { key: "pending",            label: "New"        },
  { key: "accepted",           label: "Accepted"   },
  { key: "cooking",            label: "Preparing"  },
  { key: "ready_for_delivery", label: "Ready"      },
  { key: "picked_up",          label: "Picked Up"  },
  { key: "delivering",         label: "Delivering" },
  { key: "completed",          label: "Completed"  },
  { key: "cancelled",          label: "Cancelled"  },
];

export const STATUS_LABEL_EN = {
  pending: "New", accepted: "Accepted", cooking: "Preparing",
  ready_for_delivery: "Ready", picked_up: "Picked Up", delivering: "Delivering",
  completed: "Completed", cancelled: "Cancelled",
};

const STATUS_DOT = {
  pending: "bg-red-500", accepted: "bg-yellow-500", cooking: "bg-orange-500",
  ready_for_delivery: "bg-blue-500", picked_up: "bg-indigo-500", delivering: "bg-purple-500",
  completed: "bg-green-500", cancelled: "bg-gray-400",
};

const STATUS_BADGE = {
  pending: "bg-red-100 text-red-600", accepted: "bg-yellow-100 text-yellow-700",
  cooking: "bg-orange-100 text-orange-600", ready_for_delivery: "bg-blue-100 text-blue-600",
  picked_up: "bg-indigo-100 text-indigo-600", delivering: "bg-purple-100 text-purple-600",
  completed: "bg-green-100 text-green-700", cancelled: "bg-gray-100 text-gray-500",
};

const NEXT_ACTION = {
  accepted:           { to: "cooking",            label: "Start Preparing"  },
  cooking:            { to: "ready_for_delivery",  label: "Mark Ready"       },
  ready_for_delivery: { to: "picked_up",           label: "Rider Picked Up"  },
  picked_up:          { to: "delivering",          label: "Start Delivering" },
  delivering:         { to: "completed",           label: "Mark Completed"   },
};

const TIMELINE_STEPS = [
  { key: "pending",            label: "Order Created", ts: (o) => o.createdAt,  who: "Customer", icon: Inbox,        color: "blue"   },
  { key: "accepted",           label: "Accepted",      ts: (o) => o.acceptedAt, who: "Store",    icon: CheckCircle2, color: "green"  },
  { key: "cooking",            label: "Preparing",     ts: () => null,          who: "Store",    icon: ChefHat,      color: "orange" },
  { key: "ready_for_delivery", label: "Ready",         ts: () => null,          who: "Store",    icon: Package,      color: "blue"   },
  { key: "picked_up",          label: "Picked Up",     ts: (o) => o.pickedUpAt, who: "Rider",    icon: Bike,         color: "indigo" },
  { key: "delivering",         label: "Delivering",    ts: () => null,          who: "Rider",    icon: Truck,        color: "purple" },
  { key: "completed",          label: "Completed",     ts: (o) => o.deliveredAt, who: "Rider",   icon: CheckCheck,   color: "green"  },
];
const STATUS_ORDER = TIMELINE_STEPS.map((s) => s.key);

const TIMELINE_DOT_COLOR = {
  green: "bg-green-500", blue: "bg-blue-500", orange: "bg-orange-500",
  indigo: "bg-indigo-500", purple: "bg-purple-500", gray: "bg-gray-300",
};

/* ═══════════════════════ helpers ═══════════════════════ */
export const optionLabel = (v) => (!v ? "" : typeof v === "object" ? v.name || "" : v);
const fmtMoney = (n) => Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 0 });
const fmtDateTime = (ts) => {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};
const fmtTime = (ts) => {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
};
export const toDate = (ts) => (ts ? (ts.toDate ? ts.toDate() : new Date(ts)) : null);
const isSameDay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const isToday = (ts) => isSameDay(toDate(ts), new Date());
const isYesterday = (ts) => {
  const y = new Date(); y.setDate(y.getDate() - 1);
  return isSameDay(toDate(ts), y);
};
const itemCount = (order) => (order.items || []).reduce((s, i) => s + (i.qty || 1), 0);
export const elapsedMinutes = (createdAt, now) => {
  const d = toDate(createdAt);
  if (!d) return 0;
  return Math.max(0, (now - d.getTime()) / 60000);
};

/* priority system: 0-5 green / 5-10 yellow / 10-15 orange / 15+ red(blink) */
export const getPriority = (mins) => {
  if (mins >= 15) return { key: "critical", border: "border-red-300", bg: "bg-red-50", text: "text-red-600", dot: "bg-red-500", blink: true  };
  if (mins >= 10) return { key: "high",     border: "border-orange-300", bg: "bg-orange-50", text: "text-orange-600", dot: "bg-orange-500", blink: false };
  if (mins >= 5)  return { key: "medium",   border: "border-yellow-300", bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-500", blink: false };
  return              { key: "low",      border: "border-green-300",  bg: "bg-green-50",  text: "text-green-600",  dot: "bg-green-500",  blink: false };
};

const googleMapsUrl = (order) => {
  const lat = order.deliveryLocation?.lat ?? order.lat ?? order.latitude;
  const lng = order.deliveryLocation?.lng ?? order.lng ?? order.longitude;
  const address = order.deliveryLocation?.address || order.deliveryAddress || order.address;
  if (lat != null && lng != null) return `https://www.google.com/maps?q=${lat},${lng}`;
  if (address) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  return null;
};

const copyText = (text) => { if (text) navigator.clipboard?.writeText(text); };

/* ═══════════════════════ sound + browser notifications ═══════════════════════ */
const playBeep = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const play = (freq, start, dur) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.35, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
      osc.start(ctx.currentTime + start); osc.stop(ctx.currentTime + start + dur);
    };
    play(880, 0, 0.12); play(1100, 0.15, 0.12); play(880, 0.3, 0.12); play(1320, 0.45, 0.25);
  } catch { /* autoplay blocked — visual cues still work */ }
};

const notifyBrowser = (order) => {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification("New order received", {
      body: `${order.orderNo || order.id} · ${order.customerName || "Customer"} · ฿${fmtMoney(order.grandTotal ?? order.subtotal)}`,
    });
  } catch { /* ignore */ }
};

/* ═══════════════════════ print system ═══════════════════════ */
const PRINT_WIDTHS = { "58mm": "58mm", "80mm": "80mm", a4: "210mm" };

const buildReceiptHtml = (order, size = "80mm") => {
  const items = (order.items || []).map((it) => {
    const opts = [optionLabel(it.top_chicken), optionLabel(it.spicy), optionLabel(it.sauce), optionLabel(it.powder)].filter(Boolean).join(", ");
    return `
      <tr>
        <td style="padding:4px 0;">${it.qty || 1}× ${it.name}${opts ? `<div style="font-size:11px;color:#666">${opts}</div>` : ""}${it.note ? `<div style="font-size:11px;color:#999">Note: ${it.note}</div>` : ""}</td>
        <td style="padding:4px 0;text-align:right;white-space:nowrap;">฿${fmtMoney((it.price || 0) * (it.qty || 1))}</td>
      </tr>`;
  }).join("");
  const width = PRINT_WIDTHS[size] || "80mm";
  return `
    <html>
      <head>
        <title>Receipt ${order.orderNo || order.id}</title>
        <style>
          @page { size: ${size === "a4" ? "A4" : `${width} auto`}; margin: ${size === "a4" ? "16mm" : "2mm"}; }
          body { font-family: monospace; width: ${size === "a4" ? "auto" : width}; margin: 0 auto; padding: 10px; color: #111; }
          h2 { margin: 0 0 4px; text-align:center; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          .total-row td { border-top: 1px dashed #999; padding-top: 8px; font-weight: bold; font-size: 14px; }
          .muted { color: #666; font-size: 11px; }
          .center { text-align: center; }
        </style>
      </head>
      <body>
        <h2>LK Fried Chicken</h2>
        <p class="muted center">Order ${order.orderNo || order.id}<br/>${fmtDateTime(order.createdAt)}</p>
        <hr/>
        <p>${order.customerName || "—"}<br/>${order.phone || ""}<br/>${order.deliveryAddress || order.address || ""}</p>
        <hr/>
        <table>${items}<tr class="total-row"><td>Total</td><td style="text-align:right">฿${fmtMoney(order.grandTotal ?? order.subtotal)}</td></tr></table>
        <p class="muted center">Payment: ${order.paymentMethod === "promptpay" ? "PromptPay" : "Cash on Delivery"}</p>
        <p class="muted center">Order ID: ${order.id}</p>
      </body>
    </html>`;
};

const printReceipt = (order, size = "80mm") => {
  const win = window.open("", "_blank", "width=420,height=640");
  if (!win) return;
  win.document.write(buildReceiptHtml(order, size));
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 250);
};

/* ═══════════════════════ CSV export ═══════════════════════ */
const exportOrdersCsv = (orderList) => {
  const header = ["Order No", "Customer", "Phone", "Status", "Payment", "Type", "Total", "Created"];
  const rows = orderList.map((o) => [
    o.orderNo || o.id, o.customerName || "", o.phone || "",
    STATUS_LABEL_EN[normalizeStatus(o.status)] || o.status,
    o.paymentMethod || "", o.orderType || "", o.grandTotal ?? o.subtotal ?? 0,
    fmtDateTime(o.createdAt),
  ]);
  const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `orders-${Date.now()}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/* ═══════════════════════ small shared widgets ═══════════════════════ */
function BigTimer({ createdAt, size = "sm" }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!createdAt) return null;
  const mins = elapsedMinutes(createdAt, now);
  const totalSec = Math.floor(mins * 60);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const p = getPriority(mins);
  const sizeCls = size === "lg" ? "text-3xl gap-2" : size === "md" ? "text-lg gap-1.5" : "text-xs gap-1";
  const iconSize = size === "lg" ? 24 : size === "md" ? 16 : 12;
  return (
    <span className={`inline-flex items-center font-black tabular-nums ${p.text} ${p.blink ? "animate-pulse" : ""} ${sizeCls}`}>
      <Clock size={iconSize} />
      {m}:{String(s).padStart(2, "0")}
    </span>
  );
}

function OverflowMenu({ order, onOpen }) {
  const [open, setOpen] = useState(false);
  const mapsUrl = googleMapsUrl(order);
  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button onClick={() => setOpen((v) => !v)} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700">
        <MoreVertical size={16} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 w-48 bg-white rounded-xl border border-gray-100 shadow-lg z-20 py-1.5 text-sm">
            {mapsUrl && (
              <a href={mapsUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-50 font-bold">
                <Navigation size={14} /> Google Maps
              </a>
            )}
            <button onClick={() => { copyText(order.deliveryAddress || order.address); setOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-50 font-bold">
              <Copy size={14} /> Copy Address
            </button>
            <button onClick={() => { printReceipt(order); setOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-50 font-bold">
              <Printer size={14} /> Print Receipt
            </button>
            <button onClick={() => { onOpen(order); setOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-50 font-bold">
              <Eye size={14} /> View Detail
            </button>
            <button disabled className="w-full flex items-center gap-2 px-3 py-2 text-gray-300 font-bold cursor-not-allowed">
              <MessageCircle size={14} /> Chat (soon)
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════ Order Card (scan-friendly, 3 display sizes) ═══════════════════════ */
export const OrderCard = memo(function OrderCard({ order, status, selected, selectable, onSelect, onAcceptETA, onReject, onAdvance, onOpen, now, displaySize = "medium" }) {
  const next = NEXT_ACTION[status];
  const mins = elapsedMinutes(order.createdAt, now);
  const p = getPriority(mins);
  const isDone = status === "completed" || status === "cancelled";

  // ── Compact (list row) ──
  if (displaySize === "compact") {
    return (
      <div
        role="button" tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onOpen(order)}
        onClick={() => onOpen(order)}
        className={`flex items-center gap-3 bg-white rounded-xl border px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
          ${status === "pending" ? "border-red-100" : !isDone ? p.border : "border-gray-100"}`}
      >
        {selectable && (
          <button onClick={(e) => { e.stopPropagation(); onSelect(order.id); }} className="text-gray-400 hover:text-primary flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">
            {selected ? <CheckSquare size={16} className="text-primary" /> : <Square size={16} />}
          </button>
        )}
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[status]} ${status === "pending" ? "animate-pulse" : ""}`} />
        <span className="font-black text-gray-900 text-sm w-20 flex-shrink-0 truncate">{order.orderNo || order.id?.slice(0, 8)}</span>
        <span className="text-sm font-bold text-gray-600 flex-1 truncate">{order.customerName || "—"}</span>
        <span className="text-[10px] text-gray-400 flex-shrink-0">{order.orderType === "pickup" ? "Pickup" : "Del."}</span>
        {!isDone ? <BigTimer createdAt={order.createdAt} size="sm" /> : <span className="text-[10px] text-gray-300">{fmtTime(order.createdAt)}</span>}
        <span className="font-black text-gray-900 text-sm flex-shrink-0">฿{fmtMoney(order.grandTotal ?? order.subtotal)}</span>
        <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {status === "pending" && <button onClick={() => onAcceptETA(order)} className="px-2.5 py-1.5 rounded-lg bg-primary text-white text-[10px] font-black hover:bg-primary-dark">Accept</button>}
          {next && <button onClick={() => onAdvance(order.id, next.to)} className="px-2.5 py-1.5 rounded-lg bg-gray-800 text-white text-[10px] font-black hover:bg-gray-700">{next.label}</button>}
        </div>
      </div>
    );
  }

  // ── Large / Medium full card ──
  const isLarge = displaySize === "large";

  return (
    <div
      role="button" tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onOpen(order)}
      onClick={() => onOpen(order)}
      className={`bg-white rounded-2xl border shadow-soft transition-all cursor-pointer hover:shadow-md hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
        ${status === "pending" ? "border-red-200" : !isDone ? p.border : "border-gray-100"}`}
    >
      {/* top strip: order# + timer */}
      <div className={`flex items-center justify-between px-4 ${isLarge ? "pt-5" : "pt-4"}`}>
        <div className="flex items-center gap-2 min-w-0">
          {selectable && (
            <button onClick={(e) => { e.stopPropagation(); onSelect(order.id); }} className="text-gray-400 hover:text-primary flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">
              {selected ? <CheckSquare size={18} className="text-primary" /> : <Square size={18} />}
            </button>
          )}
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[status]} ${status === "pending" ? "animate-pulse" : ""}`} />
          <p className={`font-black text-gray-900 truncate ${isLarge ? "text-xl" : "text-lg"}`}>{order.orderNo || order.id?.slice(0, 10)}</p>
        </div>
        {!isDone ? <BigTimer createdAt={order.createdAt} size={isLarge ? "lg" : "md"} /> : <span className="text-[10px] font-bold text-gray-300">{fmtTime(order.createdAt)}</span>}
      </div>

      {/* customer */}
      <div className="px-4 mt-2">
        <p className={`font-bold text-gray-800 truncate ${isLarge ? "text-base" : "text-sm"}`}>{order.customerName || "—"}</p>
        <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5"><Phone size={11} />{order.phone || "—"}</p>
      </div>

      {/* badges */}
      <div className="flex items-center gap-1.5 px-4 mt-3 flex-wrap">
        <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md bg-gray-50 text-gray-600">
          {order.orderType === "pickup" ? <Package size={11} /> : <Bike size={11} />}
          {order.orderType === "pickup" ? "Pickup" : "Delivery"}
        </span>
        <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${order.paymentMethod === "promptpay" ? "bg-blue-50 text-blue-600" : "bg-gray-50 text-gray-500"}`}>
          {order.paymentMethod === "promptpay" ? "PromptPay" : "Cash"}
        </span>
        <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-gray-50 text-gray-500">{itemCount(order)} item{itemCount(order) !== 1 ? "s" : ""}</span>
        {order.estimatedMinutes && !isDone && (
          <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-amber-50 text-amber-600">{order.estimatedMinutes}m ETA</span>
        )}
      </div>

      {/* total */}
      <div className="flex items-center justify-between px-4 mt-3">
        <p className="text-xs text-gray-400 font-bold uppercase tracking-wide">Total</p>
        <p className={`font-black text-gray-900 ${isLarge ? "text-2xl" : "text-xl"}`}>฿{fmtMoney(order.grandTotal ?? order.subtotal)}</p>
      </div>

      {/* actions */}
      <div className="flex items-center gap-2 px-4 py-3.5 mt-2 border-t border-gray-50" onClick={(e) => e.stopPropagation()}>
        {status === "pending" && (
          <>
            <button onClick={() => onReject(order.id)} className="px-3.5 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-xs font-black hover:bg-red-50 hover:text-red-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400">Reject</button>
            <button onClick={() => onAcceptETA(order)} className="flex-1 py-2.5 rounded-xl bg-primary text-white text-xs font-black hover:bg-primary-dark transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Accept</button>
          </>
        )}
        {next && (
          <button onClick={() => onAdvance(order.id, next.to)} className="flex-1 py-2.5 rounded-xl bg-gray-900 text-white text-xs font-black hover:bg-gray-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-700">{next.label}</button>
        )}
        {isDone && <span className="flex-1 text-xs font-bold text-gray-300 text-center">{STATUS_LABEL_EN[status]}</span>}
        {order.phone && (
          <a href={`tel:${order.phone}`} onClick={(e) => e.stopPropagation()} className="p-2.5 rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-700 flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl" aria-label="Call Customer">
            <Phone size={15} />
          </a>
        )}
        <OverflowMenu order={order} onOpen={onOpen} />
      </div>
    </div>
  );
});

/* ═══════════════════════ Card skeleton (loading) ═══════════════════════ */
function CardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-5 w-24 bg-gray-100 rounded-md" />
        <div className="h-4 w-14 bg-gray-100 rounded-md" />
      </div>
      <div className="h-4 w-32 bg-gray-100 rounded-md mt-4" />
      <div className="h-3 w-20 bg-gray-100 rounded-md mt-2" />
      <div className="flex gap-1.5 mt-4">
        <div className="h-5 w-16 bg-gray-100 rounded-md" />
        <div className="h-5 w-16 bg-gray-100 rounded-md" />
      </div>
      <div className="h-6 w-20 bg-gray-100 rounded-md mt-4 ml-auto" />
      <div className="h-9 w-full bg-gray-100 rounded-xl mt-4" />
    </div>
  );
}

/* ═══════════════════════ Kitchen view (shared, rendered at /store/v2/kitchen) ═══════════════════════ */
export const KITCHEN_STATUSES = ["accepted", "cooking", "ready_for_delivery"];

export const KitchenCard = memo(function KitchenCard({ order, status, onAdvance }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const mins = elapsedMinutes(order.createdAt, now);
  const p = getPriority(mins);
  const totalSec = Math.floor(mins * 60);
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;

  let actionLabel = null, actionTo = null;
  if (status === "accepted") { actionLabel = "Preparing"; actionTo = "cooking"; }
  else if (status === "cooking") { actionLabel = "Ready"; actionTo = "ready_for_delivery"; }
  else if (status === "ready_for_delivery" && order.orderType === "pickup") { actionLabel = "Completed"; actionTo = "completed"; }

  const countdown = status === "cooking" && order.estimatedFinishTime
    ? Math.max(0, Math.round((toDate(order.estimatedFinishTime).getTime() - now) / 60000))
    : null;

  return (
    <div className={`rounded-3xl border-2 ${p.border} ${p.bg} p-5 md:p-6 flex flex-col gap-4 shadow-soft`}>
      {/* Header: order number + elapsed timer */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xl md:text-2xl font-black text-gray-900">{order.orderNo || order.id?.slice(0, 10)}</p>
          <p className="text-sm font-bold text-gray-500 mt-0.5">
            {order.orderType === "pickup" ? "Pickup" : "Delivery"} · {order.paymentMethod === "promptpay" ? "PromptPay" : "Cash"}
          </p>
        </div>
        {/* Large elapsed timer */}
        <div className={`flex flex-col items-end ${p.text}`}>
          <span className={`flex items-center gap-1.5 text-3xl md:text-4xl font-black tabular-nums leading-none ${p.blink ? "animate-pulse" : ""}`}>
            <Clock size={28} className="flex-shrink-0 mt-1" />
            {mm}:{String(ss).padStart(2, "0")}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider mt-1 opacity-70">elapsed</span>
        </div>
      </div>

      {/* Customer */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xl md:text-2xl font-black text-gray-800 truncate">{order.customerName || "—"}</p>
        {countdown != null && (
          <span className="text-sm font-black text-amber-600 bg-amber-50 px-3 py-1 rounded-full flex-shrink-0">
            ~{countdown} min left
          </span>
        )}
      </div>

      {/* Items list */}
      <div className="bg-white/70 rounded-2xl p-4 space-y-3 flex-1">
        {(order.items || []).map((item, i) => {
          const opts = [optionLabel(item.top_chicken), optionLabel(item.spicy), optionLabel(item.sauce), optionLabel(item.powder)].filter(Boolean).join(" · ");
          return (
            <div key={i}>
              <p className="text-lg md:text-xl font-black text-gray-900">{item.qty || 1}× {item.name}</p>
              {opts && <p className="text-sm font-bold text-gray-500 mt-0.5">{opts}</p>}
              {item.note && <p className="text-sm font-black text-primary mt-0.5">⚠ Note: {item.note}</p>}
            </div>
          );
        })}
      </div>

      {actionLabel ? (
        <button
          onClick={() => onAdvance(order.id, actionTo)}
          className="w-full py-6 rounded-2xl bg-gray-900 text-white text-xl md:text-2xl font-black hover:bg-gray-700 active:scale-[0.98] transition-all"
        >
          {actionLabel} →
        </button>
      ) : (
        <div className="w-full py-6 rounded-2xl bg-white/70 text-gray-400 text-lg font-black text-center">
          Waiting for Rider
        </div>
      )}
    </div>
  );
});

export function KitchenView({ orders, onAdvance }) {
  const cards = useMemo(() =>
    orders
      .map((o) => ({ ...o, _status: normalizeStatus(o.status) }))
      .filter((o) => KITCHEN_STATUSES.includes(o._status))
      .sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0)),
    [orders]
  );

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-300 bg-white rounded-3xl border border-gray-100">
        <ChefHat size={48} className="mb-3" />
        <p className="text-lg font-bold">No active kitchen orders</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
      {cards.map((order) => (
        <KitchenCard key={order.id} order={order} status={order._status} onAdvance={onAdvance} />
      ))}
    </div>
  );
}

/* ═══════════════════════ Rider info block ═══════════════════════ */
function RiderInfo({ order }) {
  if (!order.riderId) {
    return (
      <div className="bg-gray-50 rounded-2xl p-4 flex items-center gap-3 text-gray-400">
        <Bike size={18} />
        <p className="text-sm font-bold">Waiting for Rider</p>
      </div>
    );
  }
  const status = normalizeStatus(order.status);
  return (
    <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
          <User size={20} className="text-indigo-500" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-black text-gray-900 truncate">{order.riderName || "Rider"}</p>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_BADGE[status]}`}>{STATUS_LABEL_EN[status]}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-gray-500"><Phone size={12} />{order.riderPhone || "—"}</div>
        <div className="flex items-center gap-1.5 text-gray-500"><Truck size={12} />{order.riderVehicle || "—"}</div>
        <div className="flex items-center gap-1.5 text-gray-500 col-span-2"><Clock size={12} />Picked up: {fmtTime(order.pickedUpAt)}</div>
      </div>
      <div className="flex gap-2">
        {order.riderPhone && (
          <a href={`tel:${order.riderPhone}`} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-100">
            <Phone size={13} /> Call Rider
          </a>
        )}
        <button onClick={() => copyText(order.riderPhone)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-100">
          <Copy size={13} /> Copy Phone
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════ Customer info block ═══════════════════════ */
function CustomerInfo({ order, allOrders }) {
  const stats = useMemo(() => {
    if (!order.phone) return null;
    const history = allOrders.filter((o) => o.phone === order.phone && normalizeStatus(o.status) !== "cancelled");
    const count = history.length;
    const total = history.reduce((s, o) => s + Number(o.grandTotal ?? o.subtotal ?? 0), 0);
    const sorted = [...history].sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
    const avgSpend = count > 0 ? Math.round(total / count) : 0;
    // find favorite menu
    const itemFreq = {};
    history.forEach((o) => (o.items || []).forEach((i) => { const n = i.name || ""; itemFreq[n] = (itemFreq[n] || 0) + (i.qty || 1); }));
    const favorite = Object.entries(itemFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    return { count, total, avgSpend, favorite, last: sorted[0]?.createdAt };
  }, [order.phone, allOrders]);

  if (!stats) {
    return <div className="bg-gray-50 rounded-2xl p-4 text-xs text-gray-400 font-bold">Customer history unavailable</div>;
  }

  const tier = stats.count >= 5 ? { label: "VIP", cls: "bg-amber-100 text-amber-700", icon: Star }
    : stats.count >= 2 ? { label: "Returning", cls: "bg-blue-100 text-blue-600", icon: Repeat }
    : { label: "New Customer", cls: "bg-green-100 text-green-700", icon: User };
  const Icon = tier.icon;

  return (
    <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
      <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${tier.cls}`}>
        <Icon size={12} /> {tier.label}
      </span>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase">Orders</p>
          <p className="text-lg font-black text-gray-900">{stats.count}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase">Total Spent</p>
          <p className="text-lg font-black text-gray-900">฿{fmtMoney(stats.total)}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase">Avg Order</p>
          <p className="text-sm font-black text-gray-800">฿{fmtMoney(stats.avgSpend)}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase">Last Order</p>
          <p className="text-xs font-black text-gray-800">{fmtDateTime(stats.last)}</p>
        </div>
      </div>
      {stats.favorite && (
        <div className="border-t border-gray-100 pt-2">
          <p className="text-[10px] font-bold text-gray-400 uppercase">Favorite Menu</p>
          <p className="text-sm font-black text-gray-800 truncate">{stats.favorite}</p>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════ Delivery info block ═══════════════════════ */
function DeliveryInfo({ order }) {
  const mapsUrl = googleMapsUrl(order);
  const distance = order.distanceKm ?? order.distance ?? order.deliveryDistance;
  const lat = order.deliveryLocation?.lat ?? order.lat ?? order.latitude;
  const lng = order.deliveryLocation?.lng ?? order.lng ?? order.longitude;

  return (
    <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-gray-400 font-bold uppercase text-[10px]">Distance</p>
          <p className="font-black text-gray-800 mt-0.5">{distance != null ? `${Number(distance).toFixed(1)} km` : "—"}</p>
        </div>
        <div>
          <p className="text-gray-400 font-bold uppercase text-[10px]">Delivery Fee</p>
          <p className="font-black text-gray-800 mt-0.5">฿{fmtMoney(order.deliveryFee)}</p>
        </div>
        <div>
          <p className="text-gray-400 font-bold uppercase text-[10px]">Est. Delivery</p>
          <p className="font-black text-gray-800 mt-0.5">{order.estimatedMinutes ? `${order.estimatedMinutes} min` : "—"}</p>
        </div>
        <div>
          <p className="text-gray-400 font-bold uppercase text-[10px]">GPS</p>
          <p className="font-black text-gray-800 mt-0.5 truncate">{lat != null && lng != null ? `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}` : "—"}</p>
        </div>
      </div>
      {mapsUrl && (
        <div className="flex gap-2">
          <a href={mapsUrl} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-100">
            <MapPin size={13} /> Google Map
          </a>
          <a href={mapsUrl} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-100">
            <RouteIcon size={13} /> Navigate
          </a>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════ Payment Center ═══════════════════════ */
function PaymentCenter({ order, onVerifyPayment }) {
  const isPromptPay = order.paymentMethod === "promptpay";
  const status = order.payment?.status;
  const badgeCls =
    status === PAYMENT_STATUS.APPROVED ? "bg-green-100 text-green-700" :
    status === PAYMENT_STATUS.REJECTED ? "bg-red-100 text-red-600" :
    status === PAYMENT_STATUS.PENDING_VERIFICATION ? "bg-yellow-100 text-yellow-700" :
    "bg-gray-100 text-gray-500";
  const badgeLabel =
    status === PAYMENT_STATUS.APPROVED ? "Paid" :
    status === PAYMENT_STATUS.REJECTED ? "Rejected" :
    status === PAYMENT_STATUS.PENDING_VERIFICATION ? "Pending" :
    "Cash";

  if (!isPromptPay) {
    return (
      <div className="bg-gray-50 rounded-2xl p-4 flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-bold text-gray-700"><CreditCard size={15} className="text-gray-400" />Cash on Delivery</span>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${badgeCls}`}>{badgeLabel}</span>
      </div>
    );
  }

  const qrUrl = `https://promptpay.io/${PROMPTPAY_ID}/${Number(order.grandTotal ?? order.subtotal ?? 0).toFixed(2)}.png`;

  return (
    <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-bold text-gray-700"><CreditCard size={15} className="text-gray-400" />PromptPay</span>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${badgeCls}`}>{badgeLabel}</span>
      </div>

      {!order.payment?.slipUrl && (
        <div className="text-center">
          <img src={qrUrl} alt="PromptPay QR" className="w-36 mx-auto rounded-xl bg-white p-2 border border-gray-100" />
          <p className="text-xs text-gray-400 mt-1">{PROMPTPAY_ACCOUNT_NAME}</p>
        </div>
      )}

      {order.payment?.slipUrl && (
        <div>
          <p className="text-xs font-bold text-gray-400 mb-1">Payment Slip</p>
          <a href={order.payment.slipUrl} target="_blank" rel="noreferrer">
            <img src={order.payment.slipUrl} alt="Payment slip" className="w-28 rounded-xl border border-gray-100" />
          </a>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
        <div>Payment Time<br/><span className="font-bold text-gray-700">{fmtDateTime(order.paymentTime)}</span></div>
        <div>Transaction ID<br/><span className="font-bold text-gray-700 break-all">{order.payment?.transactionId || order.id}</span></div>
      </div>

      {order.payment?.slipUrl && status === PAYMENT_STATUS.PENDING_VERIFICATION && (
        <div className="flex gap-2">
          <button onClick={() => onVerifyPayment(order.id, true)} className="flex-1 py-2 rounded-xl bg-primary text-white text-xs font-black">Approve Payment</button>
          <button onClick={() => onVerifyPayment(order.id, false)} className="flex-1 py-2 rounded-xl bg-gray-100 text-gray-600 text-xs font-black">Reject Payment</button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════ Print panel (preview + size persisted) ═══════════════════════ */
function PrintPanel({ order }) {
  const [size, setSize] = useState(() => localStorage.getItem("store_print_size") || "80mm");
  const [showPreview, setShowPreview] = useState(() => localStorage.getItem("store_print_preview") === "1");
  const [autoPrint, setAutoPrint] = useState(() => localStorage.getItem("store_auto_print") === "1");

  const handleSize = (s) => { setSize(s); localStorage.setItem("store_print_size", s); };
  const handleAutoPrint = () => { const v = !autoPrint; setAutoPrint(v); localStorage.setItem("store_auto_print", v ? "1" : "0"); };
  return (
    <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-black text-gray-400 uppercase tracking-wider">Print Receipt</p>
        <select value={size} onChange={(e) => handleSize(e.target.value)} className="text-xs font-bold border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-primary">
          <option value="58mm">58mm</option>
          <option value="80mm">80mm</option>
          <option value="a4">A4 Invoice</option>
        </select>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold text-gray-500">Auto Print on Accept</span>
        <button onClick={handleAutoPrint} className={`relative w-9 h-5 rounded-full transition-colors ${autoPrint ? "bg-primary" : "bg-gray-300"}`}>
          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${autoPrint ? "translate-x-4" : "translate-x-0.5"}`} />
        </button>
      </div>
      <div className="flex gap-2">
        <button onClick={() => { const v = !showPreview; setShowPreview(v); localStorage.setItem("store_print_preview", v ? "1" : "0"); }}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-100">
          <Eye size={13} /> Preview
        </button>
        <button onClick={() => printReceipt(order, size)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-700">
          <Printer size={13} /> Print
        </button>
      </div>
      {showPreview && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" onClick={() => setShowPreview(false)}>
          <div className="bg-white rounded-2xl overflow-hidden max-w-sm w-full max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-black">Receipt Preview ({size})</p>
              <button onClick={() => setShowPreview(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <iframe title="receipt-preview" srcDoc={buildReceiptHtml(order, size)} className="flex-1 w-full" style={{ minHeight: "400px" }} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════ Order Detail Drawer (collapsible sections) ═══════════════════════ */
function OrderDetailDrawer({ order, allOrders, onClose, onAdvance, onAccept, onReject, onVerifyPayment, onUpdateETA }) {
  if (!order) return null;
  const status = normalizeStatus(order.status);
  const statusIdx = STATUS_ORDER.indexOf(status);
  const isCancelled = status === "cancelled";
  const next = NEXT_ACTION[status];
  const isActive = ["accepted", "cooking", "ready_for_delivery"].includes(status);

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full md:max-w-xl lg:max-w-2xl bg-white shadow-2xl flex flex-col animate-[slideIn_0.2s_ease]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <p className="text-lg font-black text-gray-900">{order.orderNo || order.id}</p>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full inline-block mt-1 ${isCancelled ? STATUS_BADGE.cancelled : STATUS_BADGE[status] || "bg-gray-100 text-gray-500"}`}>
              {STATUS_LABEL_EN[status] || status}
            </span>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Customer */}
          <Section title="Customer">
            <div className="bg-gray-50 rounded-2xl p-4 space-y-2 mb-2">
              <p className="text-sm font-black text-gray-900">{order.customerName || "—"}</p>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 flex items-center gap-2"><Phone size={14} />{order.phone || "—"}</span>
                {order.phone && <a href={`tel:${order.phone}`} className="text-xs font-bold text-primary hover:underline">Call</a>}
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                {order.orderType === "pickup" ? <Package size={13} /> : <Bike size={13} />}
                {order.orderType === "pickup" ? "Pickup" : "Delivery"}
              </div>
              {(order.deliveryAddress || order.address) && (
                <div className="flex items-start justify-between gap-2 pt-1 border-t border-gray-100 mt-2">
                  <span className="text-xs text-gray-500 flex items-start gap-2"><MapPin size={13} className="mt-0.5 flex-shrink-0" />{order.deliveryAddress || order.address}</span>
                  <button onClick={() => copyText(order.deliveryAddress || order.address)} className="text-gray-400 hover:text-gray-700 flex-shrink-0"><Copy size={14} /></button>
                </div>
              )}
            </div>
            <CustomerInfo order={order} allOrders={allOrders} />
          </Section>

          {/* Notes */}
          {order.note && (
            <Section title="Notes" defaultOpen>
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
                <p className="text-sm font-bold text-amber-800">{order.note}</p>
              </div>
            </Section>
          )}

          {/* Cooking */}
          {isActive && (
            <Section title="Cooking">
              <CookingSection order={order} onUpdateETA={onUpdateETA} />
            </Section>
          )}

          {/* Rider */}
          <Section title="Rider" defaultOpen={!!order.riderId}>
            <RiderInfo order={order} />
          </Section>

          {/* Delivery */}
          {order.orderType !== "pickup" && (
            <Section title="Delivery">
              <DeliveryInfo order={order} />
            </Section>
          )}

          {/* Items */}
          <Section title="Items">
            <div className="space-y-3">
              {(order.items || []).map((item, i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-14 h-14 rounded-xl bg-gray-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                    {item.image ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" /> : <UtensilsCrossed size={20} className="text-gray-300" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-gray-900 truncate">{item.qty || 1}× {item.name}</p>
                      <p className="text-sm font-bold text-gray-700 whitespace-nowrap">฿{fmtMoney((item.price || 0) * (item.qty || 1))}</p>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {optionLabel(item.top_chicken) && <span className="text-[10px] font-bold bg-orange-50 text-orange-600 px-2 py-0.5 rounded-md">{optionLabel(item.top_chicken)}</span>}
                      {optionLabel(item.spicy) && <span className="text-[10px] font-bold bg-red-50 text-red-600 px-2 py-0.5 rounded-md">{optionLabel(item.spicy)}</span>}
                      {optionLabel(item.sauce) && <span className="text-[10px] font-bold bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-md">{optionLabel(item.sauce)}</span>}
                      {optionLabel(item.powder) && <span className="text-[10px] font-bold bg-purple-50 text-purple-600 px-2 py-0.5 rounded-md">{optionLabel(item.powder)}</span>}
                    </div>
                    {item.note && <p className="text-xs text-gray-400 mt-1">Note: {item.note}</p>}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between pt-3 mt-3 border-t border-gray-100">
              <p className="text-sm font-black text-gray-900">Total</p>
              <p className="text-lg font-black text-primary">฿{fmtMoney(order.grandTotal ?? order.subtotal)}</p>
            </div>
          </Section>

          {/* Payment */}
          <Section title="Payment">
            <PaymentCenter order={order} onVerifyPayment={onVerifyPayment} />
          </Section>

          {/* Print */}
          <Section title="Print" defaultOpen={false}>
            <PrintPanel order={order} />
          </Section>

          {/* Timeline */}
          <Section title="Timeline">
            <div className="space-y-0">
              {TIMELINE_STEPS.map((step, i) => {
                const reached = !isCancelled && statusIdx >= i;
                const isCurrent = !isCancelled && statusIdx === i;
                const ts = step.ts(order);
                const Icon = step.icon;
                return (
                  <div key={step.key} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${reached ? TIMELINE_DOT_COLOR[step.color] : "bg-gray-100"} ${isCurrent ? "ring-4 ring-primary-light" : ""}`}>
                        <Icon size={13} className={reached ? "text-white" : "text-gray-300"} />
                      </span>
                      {i < TIMELINE_STEPS.length - 1 && <span className={`w-0.5 flex-1 ${reached ? "bg-gray-300" : "bg-gray-100"}`} style={{ minHeight: "20px" }} />}
                    </div>
                    <div className="pb-4">
                      <p className={`text-sm font-bold ${reached ? "text-gray-900" : "text-gray-300"}`}>{step.label}</p>
                      <p className="text-[10px] text-gray-400">{step.who}{ts ? ` · ${fmtDateTime(ts)}` : ""}</p>
                    </div>
                  </div>
                );
              })}
              {isCancelled && (
                <div className="flex gap-3">
                  <span className="w-7 h-7 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0"><XCircle size={13} className="text-white" /></span>
                  <p className="text-sm font-bold text-gray-700">Order Cancelled</p>
                </div>
              )}
            </div>
          </Section>
        </div>

        {/* Footer actions */}
        <div className="border-t border-gray-100 p-4 space-y-2 flex-shrink-0">
          {!isCancelled && status === "pending" && (
            <div className="flex gap-2">
              <button onClick={() => { onReject(order.id); onClose(); }} className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 text-sm font-black hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400">Reject Order</button>
              <button onClick={() => onAccept(order)} className="flex-1 py-3 rounded-xl bg-primary text-white text-sm font-black hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Accept Order</button>
            </div>
          )}
          {!isCancelled && next && (
            <button onClick={() => { onAdvance(order.id, next.to); onClose(); }} className="w-full py-3 rounded-xl bg-gray-900 text-white text-sm font-black hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-700">{next.label}</button>
          )}
        </div>
      </div>
      <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
    </>
  );
}

/* ═══════════════════════ ETA Accept Modal ═══════════════════════ */
const ETA_PRESETS = [5, 10, 15, 20, 25, 30, 45, 60];

function AcceptWithETAModal({ order, onConfirm, onCancel }) {
  const [minutes, setMinutes] = useState(15);
  const [custom, setCustom] = useState(false);
  const [customVal, setCustomVal] = useState("");
  const finalMins = custom ? Math.max(1, Number(customVal) || 0) : minutes;
  const eta = finalMins > 0
    ? new Date(Date.now() + finalMins * 60000).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-base font-black text-gray-900">Accept Order</p>
          <p className="text-xs text-gray-400 mt-0.5">{order.orderNo || order.id} · {order.customerName || "Customer"}</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-3">Estimated Cooking Time</p>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {ETA_PRESETS.map((p) => (
              <button key={p} onClick={() => { setMinutes(p); setCustom(false); }}
                className={`py-3 rounded-xl text-sm font-black transition-colors ${!custom && minutes === p ? "bg-primary text-white" : "bg-gray-50 text-gray-600 hover:bg-gray-100"}`}>
                {p}m
              </button>
            ))}
          </div>
          <button onClick={() => setCustom((c) => !c)}
            className={`w-full py-2.5 rounded-xl text-sm font-bold mb-3 transition-colors ${custom ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-600 hover:bg-gray-100"}`}>
            Custom
          </button>
          {custom && (
            <div className="flex items-center gap-2 mb-3">
              <input autoFocus type="number" value={customVal} onChange={(e) => setCustomVal(e.target.value)}
                placeholder="Minutes…" min={1} max={240}
                className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
              <span className="text-sm font-bold text-gray-400">min</span>
            </div>
          )}
          {eta && <p className="text-xs text-center text-amber-600 font-bold mb-1">ETA: {eta}</p>}
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onCancel} className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-black hover:bg-gray-200">Cancel</button>
          <button onClick={() => onConfirm(order.id, finalMins)} disabled={finalMins < 1}
            className="flex-1 py-3 rounded-xl bg-primary text-white font-black hover:bg-primary-dark disabled:opacity-40">
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════ Order Queue Bar (drag-and-drop priority) ═══════════════════════ */
function OrderQueueBar({ orders, priorityOrder, onReorder, now, onOpen }) {
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  const active = useMemo(() => {
    const list = orders.filter((o) => {
      const s = normalizeStatus(o.status);
      return s === "pending" || s === "accepted" || s === "cooking";
    });
    return list.sort((a, b) => {
      const ai = priorityOrder.indexOf(a.id);
      const bi = priorityOrder.indexOf(b.id);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return elapsedMinutes(b.createdAt, now) - elapsedMinutes(a.createdAt, now);
    });
  }, [orders, priorityOrder, now]);

  const handleDrop = (targetId) => {
    if (!draggingId || draggingId === targetId) { setDraggingId(null); setDragOverId(null); return; }
    const ids = active.map((o) => o.id);
    const from = ids.indexOf(draggingId);
    const to = ids.indexOf(targetId);
    const next = [...ids];
    next.splice(from, 1);
    next.splice(to, 0, draggingId);
    onReorder(next);
    setDraggingId(null); setDragOverId(null);
  };

  if (active.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-3">
      <div className="flex items-center gap-2 mb-2">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Order Queue</p>
        <span className="text-[10px] bg-gray-100 text-gray-500 font-bold px-2 py-0.5 rounded-full">{active.length} active</span>
        <p className="text-[10px] text-gray-300 ml-auto hidden sm:block">Drag to reprioritize</p>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {active.map((order, i) => {
          const s = normalizeStatus(order.status);
          const mins = elapsedMinutes(order.createdAt, now);
          const p = getPriority(mins);
          return (
            <div key={order.id} draggable
              onDragStart={() => setDraggingId(order.id)}
              onDragOver={(e) => { e.preventDefault(); setDragOverId(order.id); }}
              onDrop={() => handleDrop(order.id)}
              onDragEnd={() => { setDraggingId(null); setDragOverId(null); }}
              onClick={() => onOpen(order)}
              className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border cursor-grab active:cursor-grabbing select-none transition-all
                ${draggingId === order.id ? "opacity-40 scale-95" : ""}
                ${dragOverId === order.id && draggingId !== order.id ? "border-primary bg-primary-light scale-105" : `${p.border} bg-gray-50 hover:bg-white`}`}>
              <GripVertical size={12} className="text-gray-300 flex-shrink-0" />
              <span className="text-[10px] font-black text-gray-300">#{i + 1}</span>
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[s]} ${s === "pending" ? "animate-pulse" : ""}`} />
              <span className="text-xs font-black text-gray-800 whitespace-nowrap">{order.orderNo || order.id?.slice(0, 8)}</span>
              <span className={`text-xs font-black ${p.text} ${p.blink ? "animate-pulse" : ""}`}>{Math.floor(mins)}m</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════ Sync Status indicator ═══════════════════════ */
function SyncStatus({ online, loading, lastSync }) {
  const [tick, setTick] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 10000);
    return () => clearInterval(id);
  }, []);

  if (!online) return <span className="flex items-center gap-1.5 text-xs font-bold text-red-400"><span className="w-1.5 h-1.5 rounded-full bg-red-400" />Offline</span>;
  if (loading) return <span className="flex items-center gap-1.5 text-xs font-bold text-yellow-500"><span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />Connecting…</span>;
  const secAgo = lastSync ? Math.round((tick - lastSync) / 1000) : null;
  const label = secAgo == null ? "Synced" : secAgo < 60 ? `${secAgo}s ago` : `${Math.floor(secAgo / 60)}m ago`;
  return <span className="flex items-center gap-1.5 text-xs font-bold text-gray-400"><Wifi size={12} className="text-green-400" />{label}</span>;
}

/* ═══════════════════════ Keyboard shortcut help ═══════════════════════ */
function ShortcutHelpModal({ onClose }) {
  const shortcuts = [
    { key: "A", desc: "Accept focused order" },
    { key: "R", desc: "Reject focused order" },
    { key: "P", desc: "Mark Preparing" },
    { key: "F", desc: "Mark Ready" },
    { key: "D", desc: "Delivering / Pick Up" },
    { key: "C", desc: "Complete order" },
    { key: "ESC", desc: "Close drawer / panel" },
    { key: "?", desc: "Toggle this help" },
  ];
  return (
    <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <span className="flex items-center gap-2 text-base font-black text-gray-900"><Keyboard size={18} /> Keyboard Shortcuts</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-2">
          {shortcuts.map(({ key, desc }) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{desc}</span>
              <kbd className="px-2.5 py-1 rounded-lg bg-gray-100 text-xs font-black text-gray-700 font-mono">{key}</kbd>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-gray-300 text-center pb-4">Shortcuts work when no input is focused and a drawer is open</p>
      </div>
    </div>
  );
}

/* ═══════════════════════ Shift Summary bar ═══════════════════════ */
function ShiftSummary({ orders, shiftStart }) {
  const stats = useMemo(() => {
    const today = orders.filter((o) => isToday(o.createdAt));
    const completed = today.filter((o) => normalizeStatus(o.status) === "completed");
    const cancelled = today.filter((o) => normalizeStatus(o.status) === "cancelled");
    const revenue = completed.reduce((s, o) => s + Number(o.grandTotal ?? o.subtotal ?? 0), 0);
    const cookTimes = [], delivTimes = [];
    completed.forEach((o) => {
      const acc = toDate(o.acceptedAt);
      const pick = toDate(o.pickedUpAt);
      const del = toDate(o.deliveredAt);
      if (acc && pick) cookTimes.push((pick - acc) / 60000);
      if (pick && del) delivTimes.push((del - pick) / 60000);
    });
    const avg = (arr) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
    const shiftMins = shiftStart ? Math.floor((Date.now() - shiftStart) / 60000) : null;
    return {
      total: today.length,
      completed: completed.length,
      cancelled: cancelled.length,
      revenue,
      avgCook: avg(cookTimes),
      avgDel: avg(delivTimes),
      shiftDur: shiftMins != null ? `${Math.floor(shiftMins / 60)}h ${shiftMins % 60}m` : "—",
    };
  }, [orders, shiftStart]);

  const cols = [
    { label: "Today", value: stats.total },
    { label: "Revenue", value: `฿${fmtMoney(stats.revenue)}` },
    { label: "Done", value: stats.completed },
    { label: "Cancelled", value: stats.cancelled },
    { label: "Avg Cook", value: stats.avgCook != null ? `${stats.avgCook}m` : "—" },
    { label: "Avg Del", value: stats.avgDel != null ? `${stats.avgDel}m` : "—" },
    { label: "Shift", value: stats.shiftDur },
  ];

  return (
    <div className="bg-gray-900 rounded-2xl px-4 py-3 flex items-center gap-5 overflow-x-auto">
      <BarChart3 size={15} className="text-gray-500 flex-shrink-0" />
      {cols.map(({ label, value }) => (
        <div key={label} className="flex-shrink-0 text-center">
          <p className="text-sm font-black text-white">{value}</p>
          <p className="text-[10px] font-bold text-gray-500 uppercase">{label}</p>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════ Collapsible drawer section ═══════════════════════ */
function Section({ title, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full mb-2 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg px-1">
        <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider">{title}</h3>
        {open ? <ChevronUp size={14} className="text-gray-300" /> : <ChevronDown size={14} className="text-gray-300" />}
      </button>
      {open && children}
    </div>
  );
}

/* ═══════════════════════ Cooking section in drawer ═══════════════════════ */
function CookingSection({ order, onUpdateETA }) {
  const [editing, setEditing] = useState(false);
  const [minutes, setMinutes] = useState(order.estimatedMinutes || 15);

  const save = () => {
    const finishTime = new Date(Date.now() + minutes * 60000);
    onUpdateETA(order.id, minutes, finishTime);
    setEditing(false);
  };

  return (
    <div className="bg-gray-50 rounded-2xl p-4 space-y-2">
      {!editing ? (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase">Estimated Time</p>
            <p className="font-black text-gray-800 mt-0.5">{order.estimatedMinutes ? `${order.estimatedMinutes} min` : "Not set"}</p>
            {order.estimatedFinishTime && (
              <p className="text-xs font-bold text-amber-600 mt-0.5">ETA: {fmtTime(order.estimatedFinishTime)}</p>
            )}
          </div>
          <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md px-1">
            <Pencil size={12} /> Edit
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-4 gap-1">
            {ETA_PRESETS.map((p) => (
              <button key={p} onClick={() => setMinutes(p)}
                className={`py-2 rounded-lg text-xs font-black transition-colors ${minutes === p ? "bg-primary text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                {p}m
              </button>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <button onClick={() => setEditing(false)} className="flex-1 py-2 rounded-xl bg-gray-100 text-gray-600 text-xs font-black">Cancel</button>
            <button onClick={save} className="flex-1 py-2 rounded-xl bg-primary text-white text-xs font-black">Save</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════ Empty states ═══════════════════════ */
function EmptyState({ type }) {
  const cfg = {
    "no-orders": { icon: Inbox, title: "No orders in this status", sub: "New orders will appear here in real-time." },
    "no-results": { icon: SearchX, title: "No matching orders", sub: "Try adjusting your search or filters." },
    offline: { icon: WifiOff, title: "You're offline", sub: "Reconnect to see live order updates." },
    error: { icon: AlertTriangle, title: "Something went wrong", sub: "Please refresh the page and try again." },
  }[type] || { icon: Inbox, title: "Nothing here", sub: "" };
  const Icon = cfg.icon;
  return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-300 bg-white rounded-2xl border border-gray-100">
      <Icon size={40} className="mb-3" />
      <p className="text-sm font-bold text-gray-400">{cfg.title}</p>
      {cfg.sub && <p className="text-xs text-gray-300 mt-1">{cfg.sub}</p>}
    </div>
  );
}

/* ═══════════════════════ Floating new-order notifications (top-right stack) ═══════════════════════ */
function FloatingNotifications({ queue, onAccept, onView, onDismiss }) {
  if (!queue.length) return null;
  return (
    <div className="fixed top-4 right-4 z-[70] w-80 space-y-2">
      {queue.map((order, i) => (
        <div key={order.id} className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 animate-[slideDown_0.25s_ease]" style={{ zIndex: 100 - i }}>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-black text-red-500"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />New Order</span>
            <BigTimer createdAt={order.createdAt} size="sm" />
          </div>
          <p className="text-base font-black text-gray-900 mt-2">{order.orderNo || order.id}</p>
          <p className="text-sm font-bold text-gray-600">{order.customerName || "Customer"}</p>
          <p className="text-lg font-black text-primary mt-1">฿{fmtMoney(order.grandTotal ?? order.subtotal)}</p>
          <div className="flex gap-2 mt-3">
            <button onClick={() => onDismiss(order.id)} className="px-3 py-2 rounded-xl bg-gray-100 text-gray-500 text-xs font-black hover:bg-gray-200">Dismiss</button>
            <button onClick={() => onView(order)} className="flex-1 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 text-xs font-black hover:bg-gray-50">View</button>
            <button onClick={() => onAccept(order.id)} className="flex-1 py-2 rounded-xl bg-primary text-white text-xs font-black hover:bg-primary-dark">Accept</button>
          </div>
        </div>
      ))}
      <style>{`@keyframes slideDown { from { transform: translateY(-12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
    </div>
  );
}

/* ═══════════════════════ Sticky summary header ═══════════════════════ */
function SummaryHeader({ orders }) {
  const stats = useMemo(() => {
    const counts = { pending: 0, cooking: 0, ready_for_delivery: 0, delivering: 0, completed: 0 };
    let revenue = 0;
    const prepTimes = [];
    orders.forEach((o) => {
      const s = normalizeStatus(o.status);
      if (s === "pending") counts.pending++;
      if (s === "cooking") counts.cooking++;
      if (s === "ready_for_delivery") counts.ready_for_delivery++;
      if (s === "delivering") counts.delivering++;
      if (s === "completed") {
        counts.completed++;
        if (isToday(o.createdAt)) revenue += Number(o.grandTotal ?? o.subtotal ?? 0);
      }
      const accepted = toDate(o.acceptedAt);
      const ready = toDate(o.pickedUpAt) || toDate(o.deliveredAt);
      if (accepted && ready) prepTimes.push((ready.getTime() - accepted.getTime()) / 60000);
    });
    const avgPrep = prepTimes.length ? Math.round(prepTimes.reduce((a, b) => a + b, 0) / prepTimes.length) : null;
    return { ...counts, revenue, avgPrep };
  }, [orders]);

  const items = [
    { label: "Pending", value: stats.pending, icon: Inbox, cls: "text-red-500" },
    { label: "Preparing", value: stats.cooking, icon: ChefHat, cls: "text-orange-500" },
    { label: "Ready", value: stats.ready_for_delivery, icon: Package, cls: "text-blue-500" },
    { label: "Delivering", value: stats.delivering, icon: Bike, cls: "text-purple-500" },
    { label: "Completed", value: stats.completed, icon: CheckCheck, cls: "text-green-500" },
  ];

  return (
    <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border border-gray-100 rounded-2xl px-4 py-3 flex items-center gap-5 overflow-x-auto shadow-soft">
      {items.map(({ label, value, icon: Icon, cls }) => (
        <div key={label} className="flex items-center gap-2 flex-shrink-0">
          <Icon size={16} className={cls} />
          <span className="text-lg font-black text-gray-900">{value}</span>
          <span className="text-[11px] font-bold text-gray-400 uppercase">{label}</span>
        </div>
      ))}
      <div className="w-px h-6 bg-gray-100 flex-shrink-0" />
      <div className="flex items-center gap-2 flex-shrink-0">
        <TrendingUp size={16} className="text-primary" />
        <span className="text-lg font-black text-gray-900">฿{fmtMoney(stats.revenue)}</span>
        <span className="text-[11px] font-bold text-gray-400 uppercase">Today</span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Timer size={16} className="text-gray-400" />
        <span className="text-lg font-black text-gray-900">{stats.avgPrep != null ? `${stats.avgPrep}m` : "—"}</span>
        <span className="text-[11px] font-bold text-gray-400 uppercase">Avg Prep</span>
      </div>
    </div>
  );
}

/* ═══════════════════════ Notification center (right sidebar) ═══════════════════════ */
function NotificationCenter({ open, onClose, history, onClear, muted, onToggleMute }) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full sm:max-w-sm bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <p className="text-base font-black text-gray-900">Notification Center</p>
          <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100">
          <button onClick={onToggleMute} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 text-xs font-bold text-gray-600 hover:bg-gray-100">
            {muted ? <BellOff size={13} /> : <Bell size={13} />} {muted ? "Unmute" : "Mute"}
          </button>
          <button onClick={onClear} className="px-3 py-1.5 rounded-lg bg-gray-50 text-xs font-bold text-gray-600 hover:bg-gray-100 ml-auto">Clear All</button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {history.length === 0 ? (
            <p className="text-sm text-gray-300 text-center py-12">No notifications yet</p>
          ) : history.map((n) => (
            <div key={n.key} className="px-5 py-3 border-b border-gray-50 flex items-start gap-3">
              <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${STATUS_DOT[n.status] || "bg-gray-300"}`} />
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-700">{n.text}</p>
                <p className="text-[10px] text-gray-300">{n.time.toLocaleTimeString("en-GB")}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════ Main Page ═══════════════════════ */
const PAGE_SIZE = 50;
const SORT_OPTIONS = [
  { key: "waiting_desc", label: "Longest Waiting" },
  { key: "newest", label: "Newest" },
  { key: "oldest", label: "Oldest" },
  { key: "price_desc", label: "Highest Price" },
];

export function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [activeTab, setActiveTab] = useState("pending");
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [minWaiting, setMinWaiting] = useState("");
  const [sortBy, setSortBy] = useState("waiting_desc");
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [activeOrder, setActiveOrder] = useState(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // ETA accept modal
  const [etaOrder, setEtaOrder] = useState(null);

  // Card display size: "large" | "medium" | "compact"
  const [cardSize, setCardSize] = useState(() => localStorage.getItem("store_card_size") || "medium");

  // Order queue priority (local only, affects kitchen display order)
  const [priorityOrder, setPriorityOrder] = useState([]);

  // Keyboard shortcut help
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Auto scroll to new order
  const [autoScroll, setAutoScroll] = useState(() => localStorage.getItem("store_auto_scroll") !== "0");
  const listRef = useRef(null);

  // Shift start (tracks session start)
  const [shiftStart] = useState(() => Date.now());

  // Last Firestore sync timestamp
  const [lastSync, setLastSync] = useState(null);

  // notifications
  const [muted, setMuted] = useState(() => localStorage.getItem("store_notif_muted") === "1");
  const [notifHistory, setNotifHistory] = useState([]);
  const [showNotif, setShowNotif] = useState(false);
  const [popupQueue, setPopupQueue] = useState([]);
  const knownIds = useRef(new Set());
  const initialized = useRef(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => { window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); };
  }, []);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("store_notif_muted", muted ? "1" : "0");
  }, [muted]);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "orders"),
      (snap) => {
        setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
        setErrored(false);
        setLastSync(Date.now());

        snap.docChanges().forEach((change) => {
          if (change.type !== "added") return;
          const order = { id: change.doc.id, ...change.doc.data() };
          if (!initialized.current) { knownIds.current.add(order.id); return; }
          if (knownIds.current.has(order.id)) return;
          knownIds.current.add(order.id);
          if (normalizeStatus(order.status) === "pending") {
            if (!muted) playBeep();
            notifyBrowser(order);
            setPopupQueue((prev) => [order, ...prev]);
            setNotifHistory((prev) => [{ key: `${order.id}-${Date.now()}`, status: "pending", time: new Date(), text: `New order ${order.orderNo || order.id}` }, ...prev].slice(0, 50));
          }
        });
        initialized.current = true;
      },
      () => setErrored(true)
    );
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muted]);

  // repeat sound every 10s while any pending order is unaccepted
  useEffect(() => {
    if (muted) return;
    const hasPending = orders.some((o) => normalizeStatus(o.status) === "pending");
    if (!hasPending) return;
    const id = setInterval(() => playBeep(), 10000);
    return () => clearInterval(id);
  }, [orders, muted]);

  // drop popups for orders that are no longer pending
  useEffect(() => {
    setPopupQueue((prev) => prev.filter((p) => {
      const live = orders.find((o) => o.id === p.id);
      return live && normalizeStatus(live.status) === "pending";
    }));
  }, [orders]);

  // auto scroll to order list when new order arrives
  useEffect(() => {
    if (autoScroll && listRef.current && initialized.current) {
      listRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popupQueue.length]);

  // keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "?") { setShowShortcuts((s) => !s); return; }
      if (e.key === "Escape") {
        setActiveOrder(null); setShowShortcuts(false); setShowNotif(false); setEtaOrder(null);
        return;
      }
      if (!activeOrder) return;
      const st = normalizeStatus(activeOrder.status);
      if ((e.key === "a" || e.key === "A") && st === "pending") { setEtaOrder(activeOrder); return; }
      if ((e.key === "r" || e.key === "R") && st === "pending") {
        updateDoc(doc(db, "orders", activeOrder.id), { status: "cancelled" });
        setActiveOrder(null); return;
      }
      if ((e.key === "p" || e.key === "P") && st === "accepted") {
        updateDoc(doc(db, "orders", activeOrder.id), { status: "cooking" }); return;
      }
      if ((e.key === "f" || e.key === "F") && st === "cooking") {
        updateDoc(doc(db, "orders", activeOrder.id), { status: "ready_for_delivery" }); return;
      }
      if ((e.key === "d" || e.key === "D") && (st === "ready_for_delivery" || st === "picked_up")) {
        const nx = NEXT_ACTION[st];
        if (nx) updateDoc(doc(db, "orders", activeOrder.id), { status: nx.to });
        return;
      }
      if ((e.key === "c" || e.key === "C") && st === "delivering") {
        updateDoc(doc(db, "orders", activeOrder.id), { status: "completed" }); return;
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [activeOrder]);

  const tabCounts = useMemo(() => {
    const counts = {};
    orders.forEach((o) => { const s = normalizeStatus(o.status); counts[s] = (counts[s] || 0) + 1; });
    return counts;
  }, [orders]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = orders
      .map((o) => ({ ...o, _status: normalizeStatus(o.status) }))
      .filter((o) => o._status === activeTab)
      .filter((o) => paymentFilter === "all" || o.paymentMethod === paymentFilter)
      .filter((o) => typeFilter === "all" || o.orderType === typeFilter)
      .filter((o) => {
        if (dateFilter === "today") return isToday(o.createdAt);
        if (dateFilter === "yesterday") return isYesterday(o.createdAt);
        if (dateFilter === "range" && (dateFrom || dateTo)) {
          const d = toDate(o.createdAt);
          if (!d) return false;
          if (dateFrom && d < new Date(dateFrom)) return false;
          if (dateTo && d > new Date(new Date(dateTo).setHours(23, 59, 59, 999))) return false;
          return true;
        }
        return true;
      })
      .filter((o) => {
        const amt = Number(o.grandTotal ?? o.subtotal ?? 0);
        if (minAmount && amt < Number(minAmount)) return false;
        if (maxAmount && amt > Number(maxAmount)) return false;
        return true;
      })
      .filter((o) => !minWaiting || elapsedMinutes(o.createdAt, now) >= Number(minWaiting))
      .filter((o) => {
        if (!q) return true;
        const itemNames = (o.items || []).map((i) => i.name || "").join(" ").toLowerCase();
        const address = (o.deliveryAddress || o.address || "").toLowerCase();
        const note = (o.note || "").toLowerCase();
        return (
          (o.orderNo || "").toLowerCase().includes(q) ||
          (o.customerName || "").toLowerCase().includes(q) ||
          (o.phone || "").toLowerCase().includes(q) ||
          itemNames.includes(q) ||
          address.includes(q) ||
          note.includes(q)
        );
      });

    list = list.sort((a, b) => {
      // completed/cancelled always sink to the bottom regardless of chosen sort
      const aDone = a._status === "completed" || a._status === "cancelled";
      const bDone = b._status === "completed" || b._status === "cancelled";
      if (aDone !== bDone) return aDone ? 1 : -1;

      if (sortBy === "oldest") return (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0);
      if (sortBy === "price_desc") return Number(b.grandTotal ?? b.subtotal ?? 0) - Number(a.grandTotal ?? a.subtotal ?? 0);
      if (sortBy === "newest") return (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0);
      return elapsedMinutes(b.createdAt, now) - elapsedMinutes(a.createdAt, now);
    });

    return list;
  }, [orders, activeTab, search, paymentFilter, typeFilter, dateFilter, dateFrom, dateTo, minAmount, maxAmount, minWaiting, sortBy, now]);

  const visible = filtered.slice(0, visibleCount);

  /* ─── actions ─── */
  const acceptOrderWithETA = useCallback((id, estimatedMinutes) => {
    const finishTime = estimatedMinutes > 0 ? new Date(Date.now() + estimatedMinutes * 60000) : null;
    return updateDoc(doc(db, "orders", id), {
      status: "accepted",
      acceptedAt: new Date(),
      ...(estimatedMinutes > 0 ? { estimatedMinutes, estimatedFinishTime: finishTime } : {}),
    });
  }, []);
  const acceptOrder = useCallback((id) => acceptOrderWithETA(id, 0), [acceptOrderWithETA]);
  const rejectOrder = useCallback((id) => updateDoc(doc(db, "orders", id), { status: "cancelled" }), []);
  const advanceOrder = useCallback((id, to) => updateDoc(doc(db, "orders", id), { status: to }), []);
  const updateETA = useCallback((id, mins, finishTime) =>
    updateDoc(doc(db, "orders", id), { estimatedMinutes: mins, estimatedFinishTime: finishTime }), []);
  const verifyPayment = useCallback((id, approved) =>
    updateDoc(doc(db, "orders", id), { "payment.status": approved ? PAYMENT_STATUS.APPROVED : PAYMENT_STATUS.REJECTED }), []);

  const toggleSelect = useCallback((id) => {
    setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }, []);
  const selectAll = () => setSelected(new Set(filtered.map((o) => o.id)));
  const clearSelection = () => setSelected(new Set());

  const selectedOrders = useMemo(() => orders.filter((o) => selected.has(o.id)), [orders, selected]);

  const bulkAccept = async () => {
    if (!selected.size) return;
    const batch = writeBatch(db);
    selected.forEach((id) => batch.update(doc(db, "orders", id), { status: "accepted" }));
    await batch.commit();
    setSelected(new Set());
  };
  const bulkReject = async () => {
    if (!selected.size) return;
    const batch = writeBatch(db);
    selected.forEach((id) => batch.update(doc(db, "orders", id), { status: "cancelled" }));
    await batch.commit();
    setSelected(new Set());
  };
  const bulkChangeStatus = async (to) => {
    if (!selected.size || !to) return;
    const batch = writeBatch(db);
    selected.forEach((id) => batch.update(doc(db, "orders", id), { status: to }));
    await batch.commit();
    setSelected(new Set());
  };
  const bulkPrint = () => selectedOrders.forEach((o) => printReceipt(o));
  const bulkExport = () => exportOrdersCsv(selectedOrders.length ? selectedOrders : filtered);

  const dismissPopup = (id) => setPopupQueue((prev) => prev.filter((p) => p.id !== id));
  const viewFromPopup = (order) => { setActiveOrder(order); dismissPopup(order.id); };

  if (errored) return <div className="p-6"><EmptyState type="error" /></div>;
  if (!online) return <div className="p-6"><EmptyState type="offline" /></div>;

  const handleEtaConfirm = (id, mins) => {
    acceptOrderWithETA(id, mins);
    setEtaOrder(null);
    if (activeOrder?.id === id) setActiveOrder(null);
    if (localStorage.getItem("store_auto_print") === "1") {
      const order = orders.find((o) => o.id === id);
      if (order) printReceipt(order, localStorage.getItem("store_print_size") || "80mm");
    }
  };

  const handleAcceptETA = (order) => setEtaOrder(order);

  return (
    <div className="p-5 lg:p-6 space-y-4 max-w-[1400px] mx-auto">
      {etaOrder && (
        <AcceptWithETAModal order={etaOrder} onConfirm={handleEtaConfirm} onCancel={() => setEtaOrder(null)} />
      )}
      {showShortcuts && <ShortcutHelpModal onClose={() => setShowShortcuts(false)} />}

      <FloatingNotifications queue={popupQueue} onAccept={(id) => { acceptOrderWithETA(id, 0); dismissPopup(id); }} onView={viewFromPopup} onDismiss={dismissPopup} />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-black text-gray-900">Order Management</h1>
          <SyncStatus online={online} loading={loading} lastSync={lastSync} />
        </div>
        <div className="flex items-center gap-2">
          {/* Card size toggle */}
          <div className="flex items-center gap-0.5 bg-gray-100 rounded-xl p-1">
            {(["compact", "medium", "large"] ).map((sz) => (
              <button key={sz} onClick={() => { setCardSize(sz); localStorage.setItem("store_card_size", sz); }}
                title={sz.charAt(0).toUpperCase() + sz.slice(1)}
                className={`p-1.5 rounded-lg transition-colors ${cardSize === sz ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600"}`}>
                <Layers size={15} />
              </button>
            ))}
          </div>
          {/* Auto scroll toggle */}
          <button onClick={() => { const v = !autoScroll; setAutoScroll(v); localStorage.setItem("store_auto_scroll", v ? "1" : "0"); }}
            title={autoScroll ? "Auto-scroll ON" : "Auto-scroll OFF"}
            className={`p-2.5 rounded-xl border text-sm font-bold transition-colors ${autoScroll ? "border-primary bg-primary-light text-primary" : "border-gray-200 text-gray-400 hover:bg-gray-50"}`}>
            <ScrollText size={16} />
          </button>
          <button onClick={() => setShowShortcuts(true)} title="Keyboard shortcuts (?)" className="p-2.5 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50">
            <Keyboard size={16} />
          </button>
          <button onClick={() => setMuted((m) => !m)} title={muted ? "Unmute" : "Mute"} className="p-2.5 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            {muted ? <BellOff size={17} /> : <Bell size={17} />}
          </button>
          <button onClick={() => setShowNotif(true)} className="p-2.5 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <Bell size={17} />
            {notifHistory.length > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">{notifHistory.length > 9 ? "9+" : notifHistory.length}</span>}
          </button>
          <Link to="/store/v2/kitchen" className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-black hover:bg-gray-700">
            <ChefHat size={16} /> Kitchen
          </Link>
        </div>
      </div>

      {/* Sticky summary */}
      <SummaryHeader orders={orders} />

      {/* Order Queue (drag & drop priority) */}
      <OrderQueueBar orders={orders} priorityOrder={priorityOrder} onReorder={setPriorityOrder} now={now} onOpen={setActiveOrder} />

      {/* Search + filter toggle */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order, name, phone, item…"
            className="w-full pl-10 pr-3 py-3 rounded-xl border border-gray-200 bg-white text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-600 p-0.5">
              <X size={15} />
            </button>
          )}
        </div>
        <button onClick={() => setShowFilters((v) => !v)} className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-sm font-bold ${showFilters ? "bg-primary-light border-primary text-primary" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
          <SlidersHorizontal size={15} /> Filters
        </button>
        <div className="relative">
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="appearance-none pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-600 outline-none focus:border-primary">
            {SORT_OPTIONS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <ArrowDownUp size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
        </div>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase">Payment</label>
            <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className="w-full mt-1 px-2.5 py-2 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 outline-none">
              <option value="all">All</option><option value="cash">Cash</option><option value="promptpay">PromptPay</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase">Delivery</label>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-full mt-1 px-2.5 py-2 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 outline-none">
              <option value="all">All</option><option value="delivery">Delivery</option><option value="pickup">Pickup</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase">Date</label>
            <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-full mt-1 px-2.5 py-2 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 outline-none">
              <option value="all">All</option><option value="today">Today</option><option value="yesterday">Yesterday</option><option value="range">Custom Date</option>
            </select>
          </div>
          {dateFilter === "range" && (
            <>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">From</label>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full mt-1 px-2.5 py-2 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">To</label>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full mt-1 px-2.5 py-2 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 outline-none" />
              </div>
            </>
          )}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase">Min Price</label>
            <input type="number" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} placeholder="0" className="w-full mt-1 px-2.5 py-2 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 outline-none" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase">Max Price</label>
            <input type="number" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} placeholder="9999" className="w-full mt-1 px-2.5 py-2 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 outline-none" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase">Min Waiting (min)</label>
            <input type="number" value={minWaiting} onChange={(e) => setMinWaiting(e.target.value)} placeholder="0" className="w-full mt-1 px-2.5 py-2 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 outline-none" />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setSelected(new Set()); setVisibleCount(PAGE_SIZE); }}
            className={`flex-shrink-0 flex items-center gap-2 px-4 py-3 md:py-3.5 rounded-xl text-sm font-black whitespace-nowrap transition-colors min-h-[48px]
              ${activeTab === tab.key ? "bg-gray-900 text-white" : "bg-white text-gray-500 border border-gray-100 hover:bg-gray-50"}`}
          >
            {tab.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-md font-bold ${activeTab === tab.key ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>
              {tabCounts[tab.key] || 0}
            </span>
          </button>
        ))}
      </div>

      {/* Select all / clear */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-3">
          <button onClick={selectAll} className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-800">
            <CheckSquare size={14} /> Select All
          </button>
          {selected.size > 0 && (
            <button onClick={clearSelection} className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-800">
              <Square size={14} /> Clear Selection
            </button>
          )}
        </div>
      )}

      {/* Order grid */}
      <div ref={listRef} />
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState type={search || paymentFilter !== "all" || typeFilter !== "all" || dateFilter !== "all" ? "no-results" : "no-orders"} />
      ) : (
        <>
          <div className={cardSize === "compact" ? "flex flex-col gap-2" : "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"}>
            {visible.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                status={order._status}
                selectable
                selected={selected.has(order.id)}
                onSelect={toggleSelect}
                onAcceptETA={handleAcceptETA}
                onReject={rejectOrder}
                onAdvance={advanceOrder}
                onOpen={setActiveOrder}
                now={now}
                displaySize={cardSize}
              />
            ))}
          </div>
          {visibleCount < filtered.length && (
            <div className="flex justify-center pt-2">
              <button onClick={() => setVisibleCount((c) => c + PAGE_SIZE)} className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
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
          {activeTab === "pending" && (
            <>
              <button onClick={bulkReject} className="px-3 py-1.5 rounded-lg bg-white/10 text-sm font-bold hover:bg-white/20">Reject</button>
              <button onClick={bulkAccept} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-sm font-bold hover:bg-primary-dark"><CheckCheck size={14} /> Accept</button>
            </>
          )}
          <select onChange={(e) => bulkChangeStatus(e.target.value)} value="" className="px-3 py-1.5 rounded-lg bg-white/10 text-sm font-bold outline-none">
            <option value="" disabled>Change Status…</option>
            {TABS.map((t) => <option key={t.key} value={t.key} className="text-gray-900">{t.label}</option>)}
          </select>
          <button onClick={bulkPrint} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-sm font-bold hover:bg-white/20"><Printer size={14} /> Print</button>
          <button onClick={bulkExport} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-sm font-bold hover:bg-white/20"><Download size={14} /> Export</button>
          <button onClick={() => setSelected(new Set())} className="px-2 py-1.5 text-white/60 hover:text-white"><X size={16} /></button>
        </div>
      )}

      {/* Notification center sidebar */}
      <NotificationCenter
        open={showNotif}
        onClose={() => setShowNotif(false)}
        history={notifHistory}
        onClear={() => setNotifHistory([])}
        muted={muted}
        onToggleMute={() => setMuted((m) => !m)}
      />

      {/* Shift Summary */}
      <ShiftSummary orders={orders} shiftStart={shiftStart} />

      {/* Detail drawer */}
      {activeOrder && (
        <OrderDetailDrawer
          order={orders.find((o) => o.id === activeOrder.id) || activeOrder}
          allOrders={orders}
          onClose={() => setActiveOrder(null)}
          onAdvance={advanceOrder}
          onAccept={handleAcceptETA}
          onReject={rejectOrder}
          onVerifyPayment={verifyPayment}
          onUpdateETA={updateETA}
        />
      )}
    </div>
  );
}
