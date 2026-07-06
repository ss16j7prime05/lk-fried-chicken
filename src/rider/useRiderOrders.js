import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";

// Shared subscription to the orders assigned to a rider (orders where riderId == uid).
// Every rider page ran this identical query separately; consolidated here so the shape
// is defined once. No orderBy (where + orderBy would need a composite index the project
// doesn't have) — callers keep their own client-side sort/derivation. `loading` starts
// true only when a uid is present and flips false after the first snapshot, matching the
// previous per-page useEffect exactly.
export function useRiderOrders(uid) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(() => Boolean(uid));

  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, "orders"), where("riderId", "==", uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setOrders(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, [uid]);

  return { orders, loading };
}
