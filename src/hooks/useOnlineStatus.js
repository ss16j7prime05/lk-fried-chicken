import { useEffect, useState } from "react";

// Shared online/offline status (SSOT) — one place for the navigator.onLine listener.
// Store Menu/Orders each hand-roll this same effect inline; new code should use this hook
// instead of adding another copy (migrating those two is tracked separately in TODO.md).
//
// ความหมายของค่า: navigator.onLine = "เครื่องต่อเน็ตอยู่ไหม" ไม่ได้แปลว่าอินเทอร์เน็ตใช้ได้จริง
// (ต่อ WiFi ที่เน็ตล่มก็ยัง true) — ใช้เพื่อ "กันเคสที่รู้แน่ว่าออฟไลน์" เท่านั้น
export function useOnlineStatus() {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  );

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return online;
}
