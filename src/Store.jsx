import { useEffect, useState } from "react";
import { db } from "./firebase";
import {
  collection,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
} from "firebase/firestore";
import { Link } from "react-router-dom";

const TABS = [
  "ออเดอร์ใหม่",
  "ร้านรับออเดอร์",
  "กำลังทำ",
  "กำลังจัดส่ง",
  "เสร็จสิ้น",
  "ยกเลิก",
];

// ปุ่มเปลี่ยนสถานะของร้าน
const STATUS_ACTIONS = {
  "ออเดอร์ใหม่": [{ label: "รับออเดอร์", to: "ร้านรับออเดอร์", color: "#22c55e" }],
  "ร้านรับออเดอร์": [{ label: "เริ่มทำอาหาร", to: "กำลังทำ", color: "#ff8c00" }],
  "กำลังทำ": [{ label: "ส่งให้ไรเดอร์", to: "กำลังจัดส่ง", color: "#4fc3f7" }],
  "กำลังจัดส่ง": [{ label: "เสร็จสิ้น", to: "เสร็จสิ้น", color: "#22c55e" }],
};

const CANCEL_REASONS = ["สินค้าไม่พอ", "ร้านปิด", "ลูกค้ายกเลิก", "อื่นๆ"];

const optionLabel = (value) => {
  if (!value) return "";
  if (typeof value === "object") return value.name || "";
  return value;
};

const optionsTotal = (item) =>
  (item.Sauce?.price || 0) +
  (item.sauce?.price || 0) +
  (item.powder?.price || 0) +
  (item.tableCheese?.price || 0);

const formatDate = (createdAt) => {
  if (!createdAt) return "";
  const d = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
  return d.toLocaleString("th-TH");
};

function Store() {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("ออเดอร์ใหม่");
  const [editId, setEditId] = useState(null);
  const [draftItems, setDraftItems] = useState([]);
  const [draftNote, setDraftNote] = useState("");
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState(CANCEL_REASONS[0]);
  const [cancelOther, setCancelOther] = useState("");
  const [cookTarget, setCookTarget] = useState(null);
  const [cookMinutes, setCookMinutes] = useState(15);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "orders"), (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })).reverse();
      setOrders(data);
    });
    return () => unsubscribe();
  }, []);

  const matchTab = (order, tab) => {
    if (tab === "ออเดอร์ใหม่") {
      return order.status === "ออเดอร์ใหม่" || order.status === "pending";
    }
    if (tab === "กำลังจัดส่ง") {
      return order.status === "กำลังจัดส่ง" || order.status === "ส่งให้ไรเดอร์";
    }
    return order.status === tab;
  };

  const filteredOrders = orders.filter((order) => matchTab(order, filter));

  const setStatus = async (id, to) => {
    // เริ่มทำอาหาร -> ถามเวลาโดยประมาณก่อน
    if (to === "กำลังทำ") {
      setCookTarget(id);
      return;
    }
    await updateDoc(doc(db, "orders", id), { status: to });
  };

  const confirmCook = async () => {
    if (!cookTarget) return;
    const finish = new Date(Date.now() + cookMinutes * 60000);
    await updateDoc(doc(db, "orders", cookTarget), {
      status: "กำลังทำ",
      estimatedMinutes: cookMinutes,
      estimatedFinishTime: finish,
    });
    setCookTarget(null);
    setCookMinutes(15);
  };

  const actionsFor = (status) => {
    let normalized = status === "pending" ? "ออเดอร์ใหม่" : status;
    if (normalized === "ส่งให้ไรเดอร์") normalized = "กำลังจัดส่ง";
    return STATUS_ACTIONS[normalized] || [];
  };

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    const reason =
      cancelReason === "อื่นๆ" ? cancelOther.trim() || "อื่นๆ" : cancelReason;
    await updateDoc(doc(db, "orders", cancelTarget), {
      status: "ยกเลิก",
      cancelReason: reason,
    });
    setCancelTarget(null);
    setCancelReason(CANCEL_REASONS[0]);
    setCancelOther("");
  };

  const deleteOrder = async (id) => {
    if (!window.confirm("ลบออเดอร์นี้ใช่ไหม?")) return;
    await deleteDoc(doc(db, "orders", id));
  };

  // ----- แก้ไขออเดอร์ -----
  const startEdit = (order) => {
    setEditId(order.id);
    setDraftItems(
      (order.items || []).map((it) => ({
        ...it,
        name: it.name,
        qty: it.qty || 1,
        price: it.price || 0,
      }))
    );
    setDraftNote(order.note || "");
  };

  const cancelEdit = () => {
    setEditId(null);
    setDraftItems([]);
    setDraftNote("");
  };

  const updateDraftItem = (index, field, value) => {
    setDraftItems((prev) =>
      prev.map((it, i) =>
        i === index
          ? {
              ...it,
              [field]:
                field === "qty" || field === "price" ? Number(value) || 0 : value,
            }
          : it
      )
    );
  };

  const saveEdit = async (order) => {
    const subtotal = draftItems.reduce(
      (s, it) => s + ((it.price || 0) + optionsTotal(it)) * (it.qty || 1),
      0
    );
    const fee = order.deliveryFee || 0;
    await updateDoc(doc(db, "orders", order.id), {
      items: draftItems,
      note: draftNote,
      subtotal,
      grandTotal: subtotal + fee,
    });
    cancelEdit();
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#121212",
        color: "#fff",
        padding: "16px",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "16px",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "22px" }}>🏪 ระบบร้านค้า</h1>
        <Link to="/">
          <button
            style={{
              padding: "8px 16px",
              borderRadius: "20px",
              border: "none",
              background: "#ff8c00",
              color: "#fff",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            🍗 หน้าแรก
          </button>
        </Link>
      </div>

      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "20px",
          overflowX: "auto",
          paddingBottom: "6px",
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            style={{
              flexShrink: 0,
              padding: "10px 16px",
              borderRadius: "20px",
              border: "none",
              cursor: "pointer",
              fontWeight: "bold",
              whiteSpace: "nowrap",
              background: filter === tab ? "#ff8c00" : "#2a2a2a",
              color: "#fff",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {filteredOrders.length === 0 && (
        <p style={{ color: "#888" }}>ยังไม่มีออเดอร์ในสถานะนี้</p>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: "16px",
        }}
      >
        {filteredOrders.map((order) => {
          const editing = editId === order.id;
          return (
            <div
              key={order.id}
              style={{
                background: "#1e1e1e",
                borderRadius: "16px",
                padding: "16px",
                boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
              }}
            >
              <div style={{ fontSize: "12px", color: "#888" }}>
                {order.orderNo}
              </div>
              <div style={{ fontSize: "12px", color: "#999", marginBottom: "6px" }}>
                🕒 {formatDate(order.createdAt)}
              </div>

              {/* ลูกค้า */}
              <h3 style={{ margin: "4px 0" }}>👤 {order.customerName}</h3>
              <p style={{ margin: "4px 0" }}>📞 {order.phone}</p>
              {order.orderType === "delivery" && (
                <>
                  <p style={{ margin: "4px 0" }}>
                    🏠 {order.deliveryAddress || order.address || "-"}
                  </p>
                  {order.gpsLocation && (
                    <p style={{ margin: "4px 0" }}>
                      📍{" "}
                      <a
                        href={`https://www.google.com/maps?q=${order.gpsLocation}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "#4fc3f7" }}
                      >
                        เปิดแผนที่
                      </a>
                    </p>
                  )}
                  <p style={{ margin: "4px 0" }}>
                    🛵 ค่าส่ง: {order.deliveryFee || 0} บาท
                  </p>
                </>
              )}
              <p style={{ margin: "4px 0" }}>💳 {order.paymentMethod}</p>

              {order.riderName && (
                <p style={{ margin: "4px 0", color: "#4fc3f7" }}>
                  🛵 ไรเดอร์: {order.riderName} ({order.riderPhone})
                </p>
              )}

              {order.deliveryProofUrl && (
                <div style={{ margin: "6px 0" }}>
                  <div style={{ fontSize: "13px", color: "#22c55e" }}>📸 หลักฐานการส่ง</div>
                  <img
                    src={order.deliveryProofUrl}
                    alt="proof"
                    style={{ width: "120px", borderRadius: "10px", marginTop: "4px" }}
                  />
                </div>
              )}

              {order.status === "ยกเลิก" && (
                <p style={{ margin: "4px 0", color: "#e53935" }}>
                  ❌ ยกเลิก: {order.cancelReason || "-"}
                </p>
              )}

              {/* รายการ / แก้ไข */}
              <div style={{ marginTop: "10px" }}>
                {editing ? (
                  <>
                    {draftItems.map((item, index) => (
                      <div
                        key={index}
                        style={{
                          borderTop: "1px dashed #444",
                          paddingTop: "8px",
                          marginTop: "8px",
                        }}
                      >
                        <input
                          value={item.name}
                          onChange={(e) =>
                            updateDraftItem(index, "name", e.target.value)
                          }
                          style={inputStyle}
                        />
                        <div style={{ display: "flex", gap: "8px" }}>
                          <input
                            type="number"
                            value={item.qty}
                            onChange={(e) =>
                              updateDraftItem(index, "qty", e.target.value)
                            }
                            style={{ ...inputStyle, width: "70px" }}
                          />
                          <input
                            type="number"
                            value={item.price}
                            onChange={(e) =>
                              updateDraftItem(index, "price", e.target.value)
                            }
                            style={{ ...inputStyle, width: "90px" }}
                          />
                        </div>
                      </div>
                    ))}
                    <textarea
                      value={draftNote}
                      onChange={(e) => setDraftNote(e.target.value)}
                      placeholder="หมายเหตุ"
                      style={{ ...inputStyle, minHeight: "50px" }}
                    />
                    <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
                      <button
                        onClick={() => saveEdit(order)}
                        style={btn("#22c55e")}
                      >
                        บันทึก
                      </button>
                      <button onClick={cancelEdit} style={btn("#777")}>
                        ยกเลิกแก้ไข
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    {order.items?.map((item, index) => (
                      <div
                        key={index}
                        style={{
                          display: "flex",
                          gap: "10px",
                          borderTop: "1px dashed #444",
                          paddingTop: "8px",
                          marginTop: "8px",
                        }}
                      >
                        {item.image && (
                          <img
                            src={item.image}
                            alt={item.name}
                            style={{
                              width: "48px",
                              height: "48px",
                              objectFit: "cover",
                              borderRadius: "8px",
                            }}
                          />
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: "bold" }}>🍗 {item.name}</div>
                          {optionLabel(item.top_chicken) && (
                            <div style={{ fontSize: "12px" }}>
                              🍖 {optionLabel(item.top_chicken)}
                            </div>
                          )}
                          {optionLabel(item.spicy) && (
                            <div style={{ fontSize: "12px" }}>
                              🌶️ {optionLabel(item.spicy)}
                            </div>
                          )}
                          {optionLabel(item.sauce) && (
                            <div style={{ fontSize: "12px" }}>
                              🥫 {optionLabel(item.sauce)}
                            </div>
                          )}
                          {optionLabel(item.powder) && (
                            <div style={{ fontSize: "12px" }}>
                              🧂 {optionLabel(item.powder)}
                            </div>
                          )}
                          <div style={{ fontSize: "12px", color: "#bbb" }}>
                            จำนวน {item.qty || 1} × {item.price} บาท
                          </div>
                        </div>
                      </div>
                    ))}
                    {order.note && (
                      <p style={{ fontSize: "13px", color: "#bbb" }}>
                        📄 {order.note}
                      </p>
                    )}
                  </>
                )}
              </div>

              <h3 style={{ color: "#ff8c00", margin: "12px 0" }}>
                💰 รวมทั้งหมด {order.grandTotal} บาท
              </h3>

              {/* ปุ่มควบคุม */}
              {!editing && order.status !== "ยกเลิก" && (
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {actionsFor(order.status).map((action) => (
                    <button
                      key={action.label}
                      onClick={() => setStatus(order.id, action.to)}
                      style={btn(action.color)}
                    >
                      {action.label}
                    </button>
                  ))}
                  {order.status !== "เสร็จสิ้น" && (
                    <>
                      <button onClick={() => startEdit(order)} style={btn("#5c6bc0")}>
                        ✏️ แก้ไข
                      </button>
                      <button onClick={() => setCancelTarget(order.id)} style={btn("#e53935")}>
                        ❌ ยกเลิกออเดอร์
                      </button>
                    </>
                  )}
                  <button onClick={() => deleteOrder(order.id)} style={btn("#777")}>
                    🗑️ ลบ
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal เวลาทำอาหาร */}
      {cookTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 4000,
            padding: "16px",
          }}
        >
          <div
            style={{
              background: "#1e1e1e",
              borderRadius: "16px",
              padding: "20px",
              width: "100%",
              maxWidth: "360px",
            }}
          >
            <h3 style={{ marginTop: 0 }}>เวลาทำอาหารโดยประมาณ (นาที)</h3>
            <select
              value={cookMinutes}
              onChange={(e) => setCookMinutes(Number(e.target.value))}
              style={inputStyle}
            >
              {[10, 15, 20, 30, 45, 60].map((m) => (
                <option key={m} value={m}>{m} นาที</option>
              ))}
            </select>
            <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
              <button onClick={confirmCook} style={btn("#ff8c00")}>
                เริ่มทำอาหาร
              </button>
              <button onClick={() => setCookTarget(null)} style={btn("#777")}>
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal ยกเลิกออเดอร์ */}
      {cancelTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 4000,
            padding: "16px",
          }}
        >
          <div
            style={{
              background: "#1e1e1e",
              borderRadius: "16px",
              padding: "20px",
              width: "100%",
              maxWidth: "360px",
            }}
          >
            <h3 style={{ marginTop: 0 }}>เหตุผลการยกเลิก</h3>
            <select
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              style={inputStyle}
            >
              {CANCEL_REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            {cancelReason === "อื่นๆ" && (
              <input
                placeholder="ระบุเหตุผล"
                value={cancelOther}
                onChange={(e) => setCancelOther(e.target.value)}
                style={inputStyle}
              />
            )}
            <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
              <button onClick={confirmCancel} style={btn("#e53935")}>
                ยืนยันยกเลิก
              </button>
              <button onClick={() => setCancelTarget(null)} style={btn("#777")}>
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "8px",
  marginTop: "6px",
  borderRadius: "8px",
  border: "1px solid #444",
  background: "#2a2a2a",
  color: "#fff",
  boxSizing: "border-box",
};

const btn = (bg) => ({
  flex: 1,
  minWidth: "110px",
  padding: "10px",
  borderRadius: "10px",
  border: "none",
  background: bg,
  color: "#fff",
  fontWeight: "bold",
  cursor: "pointer",
});

export default Store;
