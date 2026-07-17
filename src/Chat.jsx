import { useEffect, useRef, useState } from "react";
import { db } from "./firebase";
import {
  collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp,
  doc, setDoc,
} from "firebase/firestore";
import { uploadImage } from "./services/cloudinary";
import { usePreferences } from "./context/PreferencesContext";
import { notifyChatMessage } from "./notifications/notificationUtils";
import { normalizeStatus } from "./store/orderStatus";
import { telHref } from "./telUtils";
import { logError } from "./errorCenter";
import { Camera, MessageCircle, Send, X, Phone, CheckCheck } from "lucide-react";

const ms = (ts) => ts?.toMillis?.() ?? (ts ? new Date(ts).getTime() : 0);
const TYPING_IDLE_MS = 3000;   // stop "typing" after this idle
const TYPING_FRESH_MS = 6000;  // treat the other side's typing flag as stale after this

const MessageBubble = ({ message, mine, senderLabel, onImage }) => (
  <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "self-end bg-primary text-white" : "self-start bg-gray-100 text-gray-800"}`}>
    <p className={`text-[11px] font-bold ${mine ? "text-white/70" : "text-gray-400"}`}>{senderLabel}</p>
    {message.image && (
      <button type="button" onClick={() => onImage(message.image)} className="block mt-1">
        <img src={message.image} alt="" className="max-w-[180px] rounded-xl block" />
      </button>
    )}
    {message.message && <p className="mt-0.5 break-words">{message.message}</p>}
    <p className={`text-[10px] mt-0.5 ${mine ? "text-white/60" : "text-gray-400"}`}>
      {message.createdAt ? (message.createdAt.toDate ? message.createdAt.toDate() : new Date(message.createdAt)).toLocaleString("th-TH") : ""}
    </p>
  </div>
);

// Real-time customer ↔ rider chat bound to orderId. Messages persist in `chats`; read
// positions + typing flags persist in an additive `chatMeta/{orderId}` doc (one doc, so
// writes stay cheap). Chat + call are disabled once the order is completed/cancelled.
function Chat({ orderId, sender, order }) {
  const { t } = usePreferences();
  const [messages, setMessages] = useState([]);
  const [meta, setMeta] = useState(null);
  const [text, setText] = useState("");
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [fullImage, setFullImage] = useState(null);
  const bottomRef = useRef(null);
  const typingTimer = useRef(null);
  const typingOn = useRef(false);

  const other = sender === "rider" ? "customer" : "rider";
  const active = !["completed", "cancelled"].includes(normalizeStatus(order?.status));
  const callHref = telHref(sender === "rider" ? order?.phone : order?.riderPhone);
  const metaRef = orderId ? doc(db, "chatMeta", orderId) : null;

  // messages
  useEffect(() => {
    if (!orderId) return;
    const q = query(collection(db, "chats"), where("orderId", "==", orderId), orderBy("createdAt", "asc"));
    return onSnapshot(q,
      (snap) => { setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoadError(null); },
      (err) => { logError(err, "Chat.subscribe"); setLoadError(t("ro.chat.loadErr")); }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  // read positions + typing flags
  useEffect(() => {
    if (!metaRef) return undefined;
    return onSnapshot(metaRef, (snap) => setMeta(snap.exists() ? snap.data() : null), (err) => logError(err, "Chat.meta"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  // Mark the conversation read (my side) whenever new messages arrive from the other party.
  useEffect(() => {
    if (!metaRef || messages.length === 0) return;
    const hasIncoming = messages.some((m) => m.sender !== sender);
    if (!hasIncoming) return;
    setDoc(metaRef, { [`${sender}LastRead`]: serverTimestamp() }, { merge: true }).catch((e) => logError(e, "Chat.markRead"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, orderId]);

  const setTyping = (on) => {
    if (!metaRef || typingOn.current === on) return;
    typingOn.current = on;
    setDoc(metaRef, { [`${sender}Typing`]: on, typingAt: serverTimestamp() }, { merge: true }).catch(() => {});
  };
  const onType = (v) => {
    setText(v);
    if (!active) return;
    setTyping(true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setTyping(false), TYPING_IDLE_MS);
  };
  // clear my "typing" flag + timer when the chat unmounts
  useEffect(() => () => { clearTimeout(typingTimer.current); setTyping(false); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []);

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };
  const clearAttachment = () => { setFile(null); setPreview(null); };

  const sendMessage = async () => {
    if (!active || (!text.trim() && !file)) return;
    setSending(true);
    setSendError(null);
    try {
      let imageUrl = "";
      if (file) imageUrl = await uploadImage(file);
      await addDoc(collection(db, "chats"), { orderId, sender, message: text.trim(), image: imageUrl, createdAt: serverTimestamp() });
      setText("");
      clearAttachment();
      clearTimeout(typingTimer.current);
      setTyping(false);
      notifyChatMessage(order, sender);
    } catch (err) {
      logError(err, "Chat.send");
      setSendError(t("ro.chat.sendErr"));
    } finally {
      setSending(false);
    }
  };

  // read receipt on my last message: the other side's lastRead reached it
  const myMsgs = messages.filter((m) => m.sender === sender);
  const lastMine = myMsgs[myMsgs.length - 1];
  const otherLastRead = ms(meta?.[`${other}LastRead`]);
  const lastMineRead = lastMine && otherLastRead >= ms(lastMine.createdAt);
  // typing freshness: tick a clock only while the other side's typing flag is set, so
  // the "typing…" hint clears if their idle-write never lands (no Date.now() in render).
  const rawOtherTyping = Boolean(meta?.[`${other}Typing`]);
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    if (!rawOtherTyping) return undefined;
    const id = setInterval(() => setNowTick(Date.now()), 2000);
    return () => clearInterval(id);
  }, [rawOtherTyping]);
  const otherTyping = rawOtherTyping && nowTick - ms(meta?.typingAt) < TYPING_FRESH_MS;
  const senderLabel = (s) => (s === "rider" ? t("ro.chat.senderRider") : t("ro.chat.senderCustomer"));

  return (
    <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3 mt-3">
      <div className="flex items-center justify-between mb-2">
        <p className="flex items-center gap-1.5 text-sm font-black text-gray-800">
          <MessageCircle size={15} className="text-primary" /> {t("ro.chat.title")}
        </p>
        {active && callHref && (
          <a href={callHref} aria-label={t("ro.chat.call")} className="flex items-center gap-1 text-xs font-bold text-primary hover:underline">
            <Phone size={14} /> {t("ro.chat.call")}
          </a>
        )}
      </div>

      <div className="max-h-60 overflow-y-auto flex flex-col gap-2 mb-2.5">
        {loadError ? (
          <p className="text-xs font-bold text-secondary">{loadError}</p>
        ) : (
          messages.length === 0 && <p className="text-xs text-gray-400 font-medium">{t("ro.chat.empty")}</p>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} mine={m.sender === sender} senderLabel={senderLabel(m.sender)} onImage={setFullImage} />
        ))}
        {lastMine && lastMineRead && (
          <p className="self-end flex items-center gap-1 text-[10px] font-bold text-primary pr-1"><CheckCheck size={12} /> {t("ro.chat.read")}</p>
        )}
        {otherTyping && <p className="self-start text-[11px] font-medium text-gray-400 italic pl-1">{t("ro.chat.typing")}</p>}
        <div ref={bottomRef} />
      </div>

      {preview && (
        <div className="relative inline-block mb-2">
          <img src={preview} alt="" className="max-w-[120px] rounded-xl" />
          <button type="button" onClick={clearAttachment} aria-label={t("common.close")} className="absolute -top-2 -right-2 w-6 h-6 flex items-center justify-center bg-gray-800 text-white rounded-full">
            <X size={13} />
          </button>
        </div>
      )}

      {sendError && <p className="text-xs font-bold text-secondary mb-2">{sendError}</p>}

      {!active ? (
        <p className="text-xs font-medium text-gray-400 text-center py-2">{t("ro.chat.ended")}</p>
      ) : (
        <div className="flex items-center gap-2">
          <label className="shrink-0 w-11 h-11 flex items-center justify-center rounded-full bg-white border border-gray-100 text-gray-500 hover:text-primary hover:border-primary cursor-pointer transition-colors" aria-label={t("ro.chat.attach")}>
            <Camera size={18} />
            <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
          </label>
          <input
            type="text"
            value={text}
            placeholder={t("ro.chat.placeholder")}
            aria-label={t("ro.chat.placeholder")}
            onChange={(e) => onType(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            className="flex-1 min-w-0 h-11 px-4 rounded-full bg-white border border-gray-100 text-sm text-gray-800 outline-none focus:border-primary transition-colors"
          />
          <button type="button" onClick={sendMessage} disabled={sending} aria-label={t("ro.chat.send")}
            className={`shrink-0 w-11 h-11 flex items-center justify-center rounded-full bg-primary text-white transition-all ${sending ? "opacity-50 cursor-not-allowed" : "hover:bg-primary-dark"}`}>
            <Send size={16} />
          </button>
        </div>
      )}

      {/* fullscreen image viewer */}
      {fullImage && (
        <div className="fixed inset-0 z-[80] bg-black/85 flex items-center justify-center p-4" onClick={() => setFullImage(null)}>
          <img src={fullImage} alt="" className="max-w-full max-h-full rounded-xl" />
          <button type="button" onClick={() => setFullImage(null)} aria-label={t("common.close")} className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/20 text-white">
            <X size={22} />
          </button>
        </div>
      )}
    </div>
  );
}

export default Chat;
