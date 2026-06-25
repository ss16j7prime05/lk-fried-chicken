import { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      // ต้องตั้ง loading=true ทันทีที่ auth state เปลี่ยน (ไม่ใช่แค่ตอน mount ครั้งแรก)
      // ไม่งั้นช่วงที่กำลังอ่าน Firestore role ใหม่ ProtectedRoute จะเห็น loading=false + user เก่า (null)
      // ค้างอยู่ชั่วขณะ แล้วเด้งกลับ /login ทั้งที่ login สำเร็จแล้ว (race condition)
      setLoading(true);
      setUser(u);
      if (u) {
        try {
          const snap = await getDoc(doc(db, "users", u.uid));
          if (snap.exists()) {
            setRole(snap.data().role || null);
            setProfile(snap.data());
          } else {
            setRole(null);
            setProfile(null);
          }
        } catch {
          setRole(null);
          setProfile(null);
        }
      } else {
        setRole(null);
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const logout = async () => {
    await signOut(auth);
    navigate("/login", { replace: true });
  };

  return (
    <AuthContext.Provider value={{ user, role, profile, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
