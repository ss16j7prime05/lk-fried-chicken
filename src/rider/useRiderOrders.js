import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { logError } from "../errorCenter";

// Shared subscription to the orders assigned to a rider (orders where riderId == uid).
// Every rider page ran this identical query separately; consolidated here so the shape
// is defined once. No orderBy (where + orderBy would need a composite index the project
// doesn't have) — callers keep their own client-side sort/derivation. `loading` starts
// true only when a uid is present and flips false after the first snapshot.
//
// The snapshot error handler is required (R-06): without it a failed feed (permissions,
// missing index, offline) left `loading` stuck true forever, so Order History — and the
// other pages built on this hook (Earnings / Notifications / Profile) — spun on the
// loading spinner silently. On error we now stop loading and expose `error` so callers
// can surface it (same "don't fail silently" fix R-01/R-05 applied to the other feeds).
export function useRiderOrders(uid) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(() => Boolean(uid));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, "orders"), where("riderId", "==", uid));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setOrders(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        setError(null);
        setLoading(false);
      },
      (err) => {
        logError(err, "useRiderOrders");
        setError(err);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [uid]);

  return { orders, loading, error };
}
