import { doc, runTransaction } from "firebase/firestore";

// เลขออเดอร์อัตโนมัติแบบรันต่อวัน เช่น LK2506240001
// Single source of truth shared by the legacy customer storefront (App.jsx) and the
// new Checkout page — do not duplicate this logic elsewhere.
export const generateOrderNo = async (database) => {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const dayKey = `${yy}${mm}${dd}`;
  const counterRef = doc(database, "counters", dayKey);
  try {
    const seq = await runTransaction(database, async (tx) => {
      const snap = await tx.get(counterRef);
      const current = snap.exists() ? snap.data().count || 0 : 0;
      const next = current + 1;
      tx.set(counterRef, { count: next }, { merge: true });
      return next;
    });
    return `LK${dayKey}${String(seq).padStart(4, "0")}`;
  } catch (err) {
    console.error(err);
    return `LK${dayKey}${String(Date.now()).slice(-4)}`;
  }
};
