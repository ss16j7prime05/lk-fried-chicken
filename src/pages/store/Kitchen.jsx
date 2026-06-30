import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import {
  ArrowLeft,
  BellOff,
  Bell,
  ChefHat,
  Maximize,
  Minimize,
  Volume2,
  VolumeX,
} from "lucide-react";
import { db } from "../../firebase";
import { KITCHEN_STATUSES, KitchenView } from "./Orders.jsx";
import { normalizeStatus } from "../../store/orderStatus";

/* kitchen-specific chime — lower pitched, distinct from order alert */
const playKitchenAlert = (volume = 0.5) => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
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
  const [volume, setVolume] = useState(() => Number(localStorage.getItem("kitchen_volume") ?? 0.6));
  const knownIds = useRef(new Set());
  const initialized = useRef(false);

  /* fullscreen */
  const [fullscreen, setFullscreen] = useState(() => localStorage.getItem("kitchen_fullscreen") === "1");
  const containerRef = useRef(null);

  /* enter/exit fullscreen based on state */
  useEffect(() => {
    if (fullscreen) {
      containerRef.current?.requestFullscreen?.().catch(() => {});
    } else {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    }
  }, [fullscreen]);

  /* sync fullscreen state when user presses Esc */
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

  /* Firestore listener */
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "orders"), (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setOrders(docs);
      setLoading(false);

      snap.docChanges().forEach((change) => {
        if (change.type !== "added") return;
        const order = { id: change.doc.id, ...change.doc.data() };
        if (!initialized.current) { knownIds.current.add(order.id); return; }
        if (knownIds.current.has(order.id)) return;
        knownIds.current.add(order.id);
        const st = normalizeStatus(order.status);
        if (KITCHEN_STATUSES.includes(st) && !muted) {
          playKitchenAlert(volume);
        }
      });
      initialized.current = true;
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muted, volume]);

  const onAdvance = useCallback((id, to) => updateDoc(doc(db, "orders", id), { status: to }), []);

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

  return (
    <div ref={containerRef} className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 bg-white border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-3">
          {!fullscreen && (
            <Link to="/store/v2/orders" className="p-2.5 rounded-xl bg-white border border-gray-200 text-gray-500 hover:bg-gray-100" aria-label="Back to orders">
              <ArrowLeft size={18} />
            </Link>
          )}
          <ChefHat size={20} className="text-primary" />
          <h1 className="text-lg font-black text-gray-900">Kitchen Screen</h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Volume slider */}
          {!muted && (
            <div className="hidden sm:flex items-center gap-2">
              <Volume2 size={15} className="text-gray-400" />
              <input type="range" min={0} max={1} step={0.05} value={volume} onChange={handleVolume}
                className="w-20 accent-primary" aria-label="Kitchen sound volume" />
            </div>
          )}

          {/* Mute */}
          <button onClick={handleMute}
            className="p-2.5 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={muted ? "Unmute kitchen sound" : "Mute kitchen sound"}>
            {muted ? <VolumeX size={17} /> : <Bell size={17} />}
          </button>

          {/* Fullscreen */}
          <button onClick={toggleFullscreen}
            className="p-2.5 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}>
            {fullscreen ? <Minimize size={17} /> : <Maximize size={17} />}
          </button>

          {muted && (
            <span className="flex items-center gap-1.5 text-xs font-bold text-orange-500 bg-orange-50 px-3 py-1.5 rounded-full">
              <BellOff size={12} /> Sound muted
            </span>
          )}
        </div>
      </div>

      {/* Kitchen grid */}
      <div className="flex-1 overflow-y-auto p-5 lg:p-6">
        {loading ? (
          <div className="flex items-center justify-center py-24 text-gray-300 font-bold">Loading kitchen orders…</div>
        ) : (
          <KitchenView orders={orders} onAdvance={onAdvance} />
        )}
      </div>
    </div>
  );
}
