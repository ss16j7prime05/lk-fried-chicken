import { useEffect, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { logError } from "../errorCenter";

// How many of the rider's most-recent orders to keep live. This hook feeds the AGGREGATE
// rider pages (Work Summary rates + income, My Account / Settings tier) — none of which need
// the whole lifetime: the performance rates, the tier thresholds (bronze/silver/gold at
// 50/200 completed) and the period buckets are all satisfied by a bounded recent window. A
// generous cap keeps every realistic account identical while making the read bounded.
export const RIDER_ORDERS_LIMIT = 500;

// Shared subscription to the orders assigned to a rider (orders where riderId == uid), newest
// first and capped at RIDER_ORDERS_LIMIT. This used to subscribe to the rider's ENTIRE lifetime
// history with no orderBy/limit — an unbounded read that grows forever and is re-read on every
// page visit. It is now ordered by createdAt (present on every order) and limited, so a veteran
// rider with 100k+ deliveries reads a bounded page instead of the whole collection.
//
// The composite index orders(riderId ASC, createdAt DESC) backs this query. If it isn't deployed
// yet the ordered query errors with `failed-precondition`; we fall back to the un-ordered riderId
// query so the pages keep working (values are still computed correctly — just less bandwidth-
// optimal), mirroring the resilience pattern in useRiderIncome.
//
// The snapshot error handler is required (R-06): without it a failed feed (permissions, missing
// index, offline) left `loading` stuck true forever. On error we stop loading and expose `error`
// so callers can surface it.
export function useRiderOrders(uid) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(() => Boolean(uid));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!uid) return undefined;
    const boundedQ = query(
      collection(db, "orders"),
      where("riderId", "==", uid),
      orderBy("createdAt", "desc"),
      limit(RIDER_ORDERS_LIMIT)
    );
    const fallbackQ = query(collection(db, "orders"), where("riderId", "==", uid));

    let active = null;
    const stop = () => { if (active) { active(); active = null; } };
    const onNext = (snapshot) => {
      setOrders(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      setError(null);
      setLoading(false);
    };
    const subscribe = (q, isFallback) => {
      active = onSnapshot(q, onNext, (err) => {
        // Missing/still-building composite index -> use the un-indexed query instead.
        if (!isFallback && err?.code === "failed-precondition") {
          logError(err, "useRiderOrders.index-fallback");
          stop();
          subscribe(fallbackQ, true);
          return;
        }
        logError(err, "useRiderOrders");
        setError(err);
        setLoading(false);
      });
    };
    subscribe(boundedQ, false);
    return () => stop();
  }, [uid]);

  return { orders, loading, error };
}
