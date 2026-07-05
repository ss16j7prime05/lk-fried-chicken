import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { collection, doc, onSnapshot, query, updateDoc, where, writeBatch } from "firebase/firestore";
import {
  ArrowLeft,
  BellOff,
  Bell,
  ChefHat,
  Maximize,
  Minimize,
  Volume2,
  VolumeX,
  CheckCheck,
  RefreshCw,
} from "lucide-react";
import { db } from "../../firebase";
import { STORE_ID } from "../../config";
import { KITCHEN_STATUSES, KitchenView, printKitchenTicket } from "./Orders.jsx";
import { normalizeStatus } from "../../store/orderStatus";
import { getAlarmAudioCtx } from "../../store/alarmSounds";

/* distinct 3-tone chime for kitchen — different from the order alarm */
const playKitchenChime = (volume = 0.5) => {
  try {
    const ctx = getAlarmAudioCtx();
    if (ctx.state === "suspended") { ctx.resume(); return; }
    const play = (freq, start, dur) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.setValueAtTime(volume * 0.6, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
      osc.start(ctx.currentTime + start); osc.stop(ctx.currentTime + start + dur);
    };
    play(440, 0, 0.18); play(550, 0.22, 0.18); play(660, 0.44, 0.3);
  } catch { /* autoplay blocked */ }
};

export function Kitchen() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  /* sound */
  const [muted, setMuted] = useState(() => localStorage.getItem("kitchen_muted") === "1");
  const [volume, setVolume] = useState(() => {
    const v = localStorage.getItem("kitchen_volume");
    return v !== null ? Number(v) : 0.6;
  });

  /* print size — mirrors Settings page */
  const printSize = localStorage.getItem("store_print_size") || "80mm";

  /* fullscreen */
  const [fullscreen, setFullscreen] = useState(() => localStorage.getItem("kitchen_fullscreen") === "1");
  const containerRef = useRef(null);
  const scrollRef = useRef(null);

  /* auto-scroll */
  const [autoScroll, setAutoScroll] = useState(() => localStorage.getItem("kitchen_autoscroll") === "1");

  /* track previous statuses to detect status transitions into KITCHEN_STATUSES */
  const prevStatusesRef = useRef({});
  const initializedRef = useRef(false);

  /* enter/exit fullscreen */
  useEffect(() => {
    if (fullscreen) {
      containerRef.current?.requestFullscreen?.().catch(() => {});
    } else {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    }
  }, [fullscreen]);

  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) setFullscreen(false);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const toggleFullscreen = () => {
    const next = !fullscreen;
    setFullscreen(next);
    localStorage.setItem("kitchen_fullscreen", next ? "1" : "0");
  };

  const toggleAutoScroll = () => {
    const next = !autoScroll;
    setAutoScroll(next);
    localStorage.setItem("kitchen_autoscroll", next ? "1" : "0");
  };

  /* Firestore listener — fires sound whenever any order ENTERS a kitchen status (added OR modified) */
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "orders"), where("storeId", "==", STORE_ID)), (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setOrders(docs);
      setLoading(false);

      let newKitchenOrder = false;

      snap.docChanges().forEach((change) => {
        if (change.type === "removed") return;
        const order = { id: change.doc.id, ...change.doc.data() };
        const newStatus = normalizeStatus(order.status);
        const prevStatus = prevStatusesRef.current[order.id];

        // Sound fires when status transitions INTO a kitchen status from outside kitchen statuses
        const isNowKitchen  = KITCHEN_STATUSES.includes(newStatus);
        const wasKitchen    = prevStatus && KITCHEN_STATUSES.includes(prevStatus);

        if (!initializedRef.current) {
          // Record initial statuses silently
          prevStatusesRef.current[order.id] = newStatus;
        } else if (isNowKitchen && !wasKitchen) {
          // Transitioned into kitchen — play sound + optional auto-print
          newKitchenOrder = true;
          prevStatusesRef.current[order.id] = newStatus;
          if (localStorage.getItem("store_auto_print") === "1") {
            printKitchenTicket(order, localStorage.getItem("store_print_size") || "80mm");
          }
        } else {
          prevStatusesRef.current[order.id] = newStatus;
        }
      });

      if (!initializedRef.current) {
        initializedRef.current = true;
      } else if (newKitchenOrder && !muted) {
        playKitchenChime(volume);
        if (autoScroll) {
          const el = scrollRef.current;
          if (el) el.scrollTo({ top: 0, behavior: "smooth" });
        }
      }
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muted, volume, autoScroll]);

  const onAdvance = useCallback((id, to) => updateDoc(doc(db, "orders", id), { status: to }), []);

  const onPrint = useCallback((order, size) => printKitchenTicket(order, size || printSize), [printSize]);

  /* Batch complete — mark all ready_for_delivery as picked_up (delivery) or completed (pickup) */
  const batchComplete = useCallback(async () => {
    const readyOrders = orders.filter(o => normalizeStatus(o.status) === "ready_for_delivery");
    if (!readyOrders.length) return;
    const batch = writeBatch(db);
    readyOrders.forEach(o => {
      const next = o.orderType === "pickup" ? "completed" : "picked_up";
      batch.update(doc(db, "orders", o.id), { status: next });
    });
    await batch.commit();
  }, [orders]);

  /* Live stats */
  const preparingCount = orders.filter(o => {
    const s = normalizeStatus(o.status);
    return s === "accepted" || s === "cooking";
  }).length;
  const readyCount = orders.filter(o => normalizeStatus(o.status) === "ready_for_delivery").length;

  const handleMute = () => {
    const next = !muted;
    setMuted(next);
    localStorage.setItem("kitchen_muted", next ? "1" : "0");
  };

  const handleVolume = (e) => {
    const v = Number(e.target.value);
    setVolume(v);
    localStorage.setItem("kitchen_volume", String(v));
  };

  /* Dark theme — gray-950 bg, gray-900 header */
  return (
    <div
      ref={containerRef}
      className={`flex flex-col bg-gray-950 text-white ${fullscreen ? "h-screen overflow-hidden" : "min-h-screen"}`}
    >
      {/* Sticky header */}
      <div className="sticky top-0 z-20 flex-shrink-0 flex items-center justify-between gap-3 px-4 md:px-6 py-3 md:py-4 bg-gray-900 border-b border-gray-800">

        {/* Left: back + logo + stats */}
        <div className="flex items-center gap-3">
          {!fullscreen && (
            <Link
              to="/store/orders"
              className="p-2.5 rounded-xl bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Back to orders"
            >
              <ArrowLeft size={18} />
            </Link>
          )}
          <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
            <ChefHat size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-base font-black text-white leading-tight">Kitchen Display</h1>
            <div className="flex items-center gap-2 mt-0.5">
              {preparingCount > 0 && (
                <span className="text-[11px] font-bold text-orange-400">
                  {preparingCount} Preparing
                </span>
              )}
              {preparingCount > 0 && readyCount > 0 && (
                <span className="text-gray-600 text-[11px]">·</span>
              )}
              {readyCount > 0 && (
                <span className="text-[11px] font-bold text-blue-400">
                  {readyCount} Ready
                </span>
              )}
              {preparingCount === 0 && readyCount === 0 && (
                <span className="text-[11px] font-bold text-gray-500">All clear</span>
              )}
            </div>
          </div>
        </div>

        {/* Right: controls */}
        <div className="flex items-center gap-2">

          {/* Batch complete */}
          {readyCount > 0 && (
            <button
              onClick={batchComplete}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-black transition-colors"
              aria-label={`Complete all ${readyCount} ready orders`}
            >
              <CheckCheck size={16} />
              <span className="hidden sm:inline">Complete All ({readyCount})</span>
              <span className="sm:hidden">{readyCount}</span>
            </button>
          )}

          {/* Auto-scroll toggle */}
          <button
            onClick={toggleAutoScroll}
            className={`p-2.5 rounded-xl border text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
              ${autoScroll
                ? "border-primary/40 bg-primary/20 text-primary"
                : "border-gray-700 bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
            aria-label={autoScroll ? "Disable auto-scroll" : "Enable auto-scroll"}
            title={autoScroll ? "Auto-scroll ON" : "Auto-scroll OFF"}
          >
            <RefreshCw size={16} />
          </button>

          {/* Volume slider */}
          {!muted && (
            <div className="hidden md:flex items-center gap-2">
              <Volume2 size={14} className="text-gray-500 flex-shrink-0" />
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={handleVolume}
                className="w-20 accent-primary"
                aria-label="Kitchen sound volume"
              />
            </div>
          )}

          {/* Mute */}
          <button
            onClick={handleMute}
            className={`p-2.5 rounded-xl border text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
              ${muted ? "border-orange-400/40 bg-orange-400/20 text-orange-400" : "border-gray-700 bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted ? <VolumeX size={18} /> : <Bell size={18} />}
          </button>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl border border-gray-700 bg-gray-800 text-gray-400 hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>

          {muted && (
            <span className="hidden sm:flex items-center gap-1 text-xs font-bold text-orange-400 bg-orange-400/10 border border-orange-400/20 px-2.5 py-1.5 rounded-xl">
              <BellOff size={12} /> Muted
            </span>
          )}
        </div>
      </div>

      {/* Scrollable kitchen grid */}
      <div
        ref={scrollRef}
        className={`${fullscreen ? "flex-1 overflow-y-auto" : ""} p-4 md:p-5 lg:p-6`}
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-600">
            <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
            <p className="font-bold">Loading kitchen orders…</p>
          </div>
        ) : (
          <KitchenView orders={orders} onAdvance={onAdvance} onPrint={onPrint} printSize={printSize} />
        )}
      </div>
    </div>
  );
}
