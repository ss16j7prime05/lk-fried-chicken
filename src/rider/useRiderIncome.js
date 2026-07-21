import { useEffect, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { logError } from "../errorCenter";

// How far back income pages read, and a hard cap on documents. Income UI only shows the
// current day/week/month + the last few periods, so a bounded window is plenty and avoids
// pulling the rider's entire lifetime history on every visit.
export const INCOME_WINDOW_DAYS = 120;
export const INCOME_LIMIT = 400;

// Shared bounded subscription to the rider's recent completed orders — one listener, date-
// ranged + limited (the composite index riderId+deliveredAt lives in firestore.indexes.json).
// If that index isn't deployed yet the bounded query errors with `failed-precondition`; we
// fall back to the un-indexed riderId query so income pages keep working (values are still
// computed by the SSOT summarizeIncome, so they stay correct — just less bandwidth-optimal).
export function useRiderIncome(uid) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(() => Boolean(uid));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!uid) return undefined;
    const since = new Date();
    since.setDate(since.getDate() - INCOME_WINDOW_DAYS);
    const boundedQ = query(
      collection(db, "orders"),
      where("riderId", "==", uid),
      where("deliveredAt", ">=", since),
      orderBy("deliveredAt", "desc"),
      limit(INCOME_LIMIT)
    );
    const fallbackQ = query(collection(db, "orders"), where("riderId", "==", uid));

    let active = null;
    const stop = () => { if (active) { active(); active = null; } };
    const onNext = (snap) => {
      setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setError(null);
      setLoading(false);
    };
    const subscribe = (q, isFallback) => {
      active = onSnapshot(q, onNext, (err) => {
        // Missing/still-building composite index -> use the un-indexed query instead.
        if (!isFallback && err?.code === "failed-precondition") {
          logError(err, "useRiderIncome.index-fallback");
          stop();
          subscribe(fallbackQ, true);
          return;
        }
        logError(err, "useRiderIncome");
        setError(err);
        setLoading(false);
      });
    };
    subscribe(boundedQ, false);
    return () => stop();
  }, [uid]);

  return { orders, loading, error };
}
