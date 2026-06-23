import { useEffect, useRef, useState } from "react";
import { db, storage } from "./firebase";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const formatTime = (createdAt) => {
  if (!createdAt) return "";
  const d = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
  return d.toLocaleString("th-TH");
};

// แชทแบบ Realtime ระหว่างลูกค้า ↔ ไรเดอร์ ผูกกับ orderId
function Chat({ orderId, sender }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
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

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const sendMessage = async () => {
    if (!text.trim() && !file) return;
    setSending(true);
    try {
      let imageUrl = "";
      if (file) {
        const storageRef = ref(
          storage,
          `chats/${orderId}/${Date.now()}_${file.name}`
        );
        await uploadBytes(storageRef, file);
        imageUrl = await getDownloadURL(storageRef);
      }
      await addDoc(collection(db, "chats"), {
        orderId,
        sender,
        message: text.trim(),
        image: imageUrl,
        createdAt: serverTimestamp(),
      });
      setText("");
      setFile(null);
      setPreview(null);
    } catch (err) {
      console.error(err);
      alert("ส่งข้อความไม่สำเร็จ");
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      style={{
        background: "#161616",
        borderRadius: "16px",
        padding: "12px",
        marginTop: "12px",
      }}
    >
      <div style={{ fontWeight: "bold", marginBottom: "8px" }}>💬 แชท</div>

      <div
        style={{
          maxHeight: "240px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          marginBottom: "10px",
        }}
      >
        {messages.length === 0 && (
          <div style={{ color: "#777", fontSize: "13px" }}>
            ยังไม่มีข้อความ
          </div>
        )}
        {messages.map((m) => {
          const mine = m.sender === sender;
          return (
            <div
              key={m.id}
              style={{
                alignSelf: mine ? "flex-end" : "flex-start",
                maxWidth: "80%",
                background: mine ? "#ff8c00" : "#2a2a2a",
                color: mine ? "#000" : "#fff",
                borderRadius: "14px",
                padding: "8px 12px",
              }}
            >
              <div style={{ fontSize: "11px", opacity: 0.7 }}>{m.sender}</div>
              {m.image && (
                <img
                  src={m.image}
                  alt="แนบรูป"
                  style={{
                    maxWidth: "180px",
                    borderRadius: "10px",
                    marginTop: "4px",
                    display: "block",
                  }}
                />
              )}
              {m.message && <div>{m.message}</div>}
              <div style={{ fontSize: "10px", opacity: 0.6, marginTop: "2px" }}>
                {formatTime(m.createdAt)}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {preview && (
        <div style={{ marginBottom: "8px" }}>
          <img
            src={preview}
            alt="พรีวิว"
            style={{ maxWidth: "120px", borderRadius: "10px" }}
          />
        </div>
      )}

      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <label
          style={{
            cursor: "pointer",
            fontSize: "22px",
            flexShrink: 0,
          }}
        >
          📷
          <input
            type="file"
            accept="image/*"
            onChange={handleFile}
            style={{ display: "none" }}
          />
        </label>
        <input
          type="text"
          value={text}
          placeholder="พิมพ์ข้อความ..."
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          style={{
            flex: 1,
            padding: "10px",
            borderRadius: "20px",
            border: "none",
            background: "#2a2a2a",
            color: "#fff",
          }}
        />
        <button
          onClick={sendMessage}
          disabled={sending}
          style={{
            padding: "10px 16px",
            borderRadius: "20px",
            border: "none",
            background: "#ff8c00",
            color: "#fff",
            fontWeight: "bold",
            cursor: sending ? "not-allowed" : "pointer",
          }}
        >
          ส่ง
        </button>
      </div>
    </div>
  );
}

export default Chat;
