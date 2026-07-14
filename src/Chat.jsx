import { useEffect, useRef, useState } from "react";
import { db } from "./firebase";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { uploadImage } from "./services/cloudinary";
import { Camera, MessageCircle, Send, X } from "lucide-react";

const formatTime = (createdAt) => {
  if (!createdAt) return "";
  const d = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
  return d.toLocaleString("th-TH");
};

const SENDER_LABEL = { rider: "ไรเดอร์", customer: "ลูกค้า" };

// ข้อความแชท 1 ฟอง: ของตัวเองชิดขวาสีส้ม ของอีกฝั่งชิดซ้ายสีเทา
const MessageBubble = ({ message, mine }) => (
  <div
    className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
      mine ? "self-end bg-primary text-white" : "self-start bg-gray-100 text-gray-800"
    }`}
  >
    <p className={`text-[11px] font-bold ${mine ? "text-white/70" : "text-gray-400"}`}>
      {SENDER_LABEL[message.sender] || message.sender}
    </p>
    {message.image && (
      <img
        src={message.image}
        alt="แนบรูป"
        className="max-w-[180px] rounded-xl mt-1 block"
      />
    )}
    {message.message && <p className="mt-0.5 break-words">{message.message}</p>}
    <p className={`text-[10px] mt-0.5 ${mine ? "text-white/60" : "text-gray-400"}`}>
      {formatTime(message.createdAt)}
    </p>
  </div>
);

// แชทแบบ Realtime ระหว่างลูกค้า ↔ ไรเดอร์ ผูกกับ orderId
function Chat({ orderId, sender }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!orderId) return;
    const q = query(
      collection(db, "chats"),
      where("orderId", "==", orderId),
      orderBy("createdAt", "asc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, [orderId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // เคลียร์ object URL ของรูปพรีวิวเมื่อเปลี่ยนรูป/unmount กัน memory leak
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const clearAttachment = () => {
    setFile(null);
    setPreview(null);
  };

  const sendMessage = async () => {
    if (!text.trim() && !file) return;
    setSending(true);
    setSendError(null);
    try {
      let imageUrl = "";
      if (file) {
        // Shared Cloudinary uploader (HEIC/compress/retry) — same single upload
        // path as the rest of the app; returns the CDN secure_url.
        imageUrl = await uploadImage(file);
      }
      await addDoc(collection(db, "chats"), {
        orderId,
        sender,
        message: text.trim(),
        image: imageUrl,
        createdAt: serverTimestamp(),
      });
      setText("");
      clearAttachment();
    } catch (err) {
      console.error(err);
      setSendError("ส่งข้อความไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3 mt-3">
      <p className="flex items-center gap-1.5 text-sm font-black text-gray-800 mb-2">
        <MessageCircle size={15} className="text-primary" />
        แชท
      </p>

      {/* message list */}
      <div className="max-h-60 overflow-y-auto flex flex-col gap-2 mb-2.5">
        {messages.length === 0 && (
          <p className="text-xs text-gray-400 font-medium">ยังไม่มีข้อความ</p>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} mine={m.sender === sender} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* attachment preview */}
      {preview && (
        <div className="relative inline-block mb-2">
          <img src={preview} alt="พรีวิว" className="max-w-[120px] rounded-xl" />
          <button
            type="button"
            onClick={clearAttachment}
            aria-label="ลบรูปที่แนบ"
            className="absolute -top-2 -right-2 w-6 h-6 flex items-center justify-center bg-gray-800 text-white rounded-full"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {sendError && (
        <p className="text-xs font-bold text-secondary mb-2">{sendError}</p>
      )}

      {/* composer */}
      <div className="flex items-center gap-2">
        <label
          className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-white border border-gray-100 text-gray-500 hover:text-primary hover:border-primary cursor-pointer transition-colors"
          aria-label="แนบรูป"
        >
          <Camera size={18} />
          <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
        </label>
        <input
          type="text"
          value={text}
          placeholder="พิมพ์ข้อความ..."
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          className="flex-1 min-w-0 h-10 px-4 rounded-full bg-white border border-gray-100 text-sm text-gray-800 outline-none focus:border-primary transition-colors"
        />
        <button
          type="button"
          onClick={sendMessage}
          disabled={sending}
          aria-label="ส่งข้อความ"
          className={`shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-primary text-white transition-all ${
            sending ? "opacity-50 cursor-not-allowed" : "hover:bg-primary-dark"
          }`}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}

export default Chat;
