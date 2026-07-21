import { useEffect, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { STORE_ID } from "../config";
import { logError } from "../errorCenter";

// How many of the store's most-recent orders to keep live. The store notification feed is built
// from recent order events, so a bounded recent window is all it needs; a generous cap keeps
// every realistic store identical while making the read bounded (no whole-collection read).
export const STORE_ORDERS_LIMIT = 500;

// Shared realtime subscription to this store's orders (orders where storeId == STORE_ID), newest
// first and capped at STORE_ORDERS_LIMIT. This used to subscribe to the store's ENTIRE order
// history with no orderBy/limit — an unbounded read that grows forever — and had no error
// callback, so a failed feed (permissions/offline/missing index) left `loading` stuck true
// forever (infinite spinner).
//
// Backed by the composite index orders(storeId ASC, createdAt DESC). If that index isn't deployed
// yet the ordered query errors with `failed-precondition`; we fall back to the un-ordered storeId
// query so the page keeps working (mirrors the resilience pattern in the rider hooks). createdAt
// is set on every order at creation, so ordering by it is safe. Callers keep their own
// client-side sort/derivation, so the returned shape is unchanged.
export function useStoreOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const boundedQ = query(
      collection(db, "orders"),
      where("storeId", "==", STORE_ID),
      orderBy("createdAt", "desc"),
      limit(STORE_ORDERS_LIMIT)
    );
    const fallbackQ = query(collection(db, "orders"), where("storeId", "==", STORE_ID));

    let active = null;
    const stop = () => { if (active) { active(); active = null; } };
    const onNext = (snapshot) => {
      setOrders(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    };
    const subscribe = (q, isFallback) => {
      active = onSnapshot(q, onNext, (err) => {
        // Missing/still-building composite index -> use the un-indexed query instead.
        if (!isFallback && err?.code === "failed-precondition") {
          logError(err, "useStoreOrders.index-fallback");
          stop();
          subscribe(fallbackQ, true);
          return;
        }
        // Any other error: stop the spinner instead of hanging on "loading" forever.
        logError(err, "useStoreOrders");
        setLoading(false);
      });
    };
    subscribe(boundedQ, false);
    return () => stop();
  }, []);

  return { orders, loading };
}
