import { useEffect, useState } from "react";
import { db, storage } from "./firebase";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Link } from "react-router-dom";

const CATEGORIES = [
  "ข้าวหน้าไก่ทอด",
  "อาหารทานเล่น",
  "เครื่องดื่ม",
  "เซ็ตรวม",
];

const emptyForm = {
  name: "",
  price: "",
  image: "",
  category: CATEGORIES[0],
  available: true,
};

const input = {
  width: "100%",
  padding: "10px",
  marginBottom: "10px",
  borderRadius: "10px",
  border: "1px solid #444",
  background: "#2a2a2a",
  color: "#fff",
  boxSizing: "border-box",
};

function StoreMenu() {
  const [menus, setMenus] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "menus"), (snapshot) => {
      setMenus(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, []);

  const set = (k) => (e) =>
    setForm((p) => ({
      ...p,
      [k]: k === "available" ? e.target.value === "true" : e.target.value,
    }));

  const handleImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const storageRef = ref(storage, `menus/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setForm((p) => ({ ...p, image: url }));
    } catch (err) {
      console.error(err);
      alert("อัปโหลดรูปไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditId(null);
  };

  const save = async () => {
    if (!form.name.trim() || !form.price) {
      alert("กรุณากรอกชื่อและราคา");
      return;
    }
    const payload = {
      name: form.name.trim(),
      price: Number(form.price) || 0,
      image: form.image.trim(),
      category: form.category,
      available: form.available,
    };
    if (editId) {
      await updateDoc(doc(db, "menus", editId), payload);
    } else {
      await addDoc(collection(db, "menus"), payload);
    }
    resetForm();
  };

  const startEdit = (m) => {
    setEditId(m.id);
    setForm({
      name: m.name || "",
      price: m.price || "",
      image: m.image || "",
      category: m.category || CATEGORIES[0],
      available: m.available !== false,
    });
  };

  const remove = async (id) => {
    if (!window.confirm("ลบเมนูนี้ใช่ไหม?")) return;
    await deleteDoc(doc(db, "menus", id));
  };

  const toggleAvailable = async (m) => {
    await updateDoc(doc(db, "menus", m.id), { available: m.available === false });
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
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "22px" }}>🍽️ จัดการเมนู</h1>
        <Link to="/store/dashboard">
          <button
            style={{
              padding: "8px 14px",
              borderRadius: "20px",
              border: "none",
              background: "#ff8c00",
              color: "#fff",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            📊 Dashboard
          </button>
        </Link>
      </div>

      {/* ฟอร์มเพิ่ม/แก้ไข */}
      <div
        style={{
          background: "#1e1e1e",
          borderRadius: "16px",
          padding: "16px",
          marginBottom: "20px",
          maxWidth: "420px",
        }}
      >
        <h3 style={{ marginTop: 0 }}>{editId ? "แก้ไขเมนู" : "เพิ่มเมนู"}</h3>
        <input placeholder="ชื่อเมนู" value={form.name} onChange={set("name")} style={input} />
        <input type="number" placeholder="ราคา" value={form.price} onChange={set("price")} style={input} />
        <input placeholder="ลิงก์รูป (หรืออัปโหลดด้านล่าง)" value={form.image} onChange={set("image")} style={input} />
        <input type="file" accept="image/*" onChange={handleImage} style={{ marginBottom: "10px" }} />
        {uploading && <div style={{ color: "#ffb74d" }}>กำลังอัปโหลด...</div>}
        {form.image && (
          <img src={form.image} alt="preview" style={{ width: "100px", borderRadius: "10px", marginBottom: "10px" }} />
        )}
        <select value={form.category} onChange={set("category")} style={input}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select value={String(form.available)} onChange={set("available")} style={input}>
          <option value="true">เปิดขาย</option>
          <option value="false">ปิดการขาย (สินค้าหมด)</option>
        </select>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={save} style={btn("#22c55e")}>
            {editId ? "บันทึก" : "เพิ่มเมนู"}
          </button>
          {editId && (
            <button onClick={resetForm} style={btn("#777")}>ยกเลิก</button>
          )}
        </div>
      </div>

      {/* รายการเมนู */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: "14px",
        }}
      >
        {menus.map((m) => (
          <div
            key={m.id}
            style={{
              background: "#1e1e1e",
              borderRadius: "16px",
              padding: "12px",
              opacity: m.available === false ? 0.6 : 1,
            }}
          >
            {m.image && (
              <img
                src={m.image}
                alt={m.name}
                style={{ width: "100%", height: "140px", objectFit: "cover", borderRadius: "10px" }}
              />
            )}
            <div style={{ fontWeight: "bold", marginTop: "6px" }}>{m.name}</div>
            <div style={{ color: "#ff8c00" }}>฿{m.price}</div>
            <div style={{ fontSize: "12px", color: "#999" }}>{m.category}</div>
            <div style={{ fontSize: "13px", color: m.available === false ? "#e53935" : "#22c55e" }}>
              {m.available === false ? "สินค้าหมด" : "เปิดขาย"}
            </div>
            <div style={{ display: "flex", gap: "6px", marginTop: "8px", flexWrap: "wrap" }}>
              <button onClick={() => startEdit(m)} style={btn("#5c6bc0")}>แก้ไข</button>
              <button onClick={() => toggleAvailable(m)} style={btn("#ff8c00")}>
                {m.available === false ? "เปิดขาย" : "ปิดการขาย"}
              </button>
              <button onClick={() => remove(m.id)} style={btn("#e53935")}>ลบ</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const btn = (bg) => ({
  flex: 1,
  minWidth: "60px",
  padding: "8px",
  borderRadius: "8px",
  border: "none",
  background: bg,
  color: "#fff",
  fontWeight: "bold",
  cursor: "pointer",
  fontSize: "13px",
});

export default StoreMenu;
