import { useEffect, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import { byNewest } from "../../store/orderStatus";

const DEFAULT_ERROR = "Unable to load your orders right now. Please try again later.";

// How many of the customer's most-recent orders to keep live. Customer pages show an order list
// and order-derived stats; a single customer's lifetime order count is small, so a generous cap
// keeps every realistic customer identical while making the read bounded (no whole-collection read).
export const CUSTOMER_ORDERS_LIMIT = 500;

// Shared customer orders subscription used by Orders / Notifications / Profile / Reviews.
// The query is now bounded: orders where phone == <phone>, orderBy createdAt desc, limited —
// replacing the previous unbounded (whole lifetime) read. Backed by the composite index
// orders(phone ASC, createdAt DESC); if that index isn't deployed yet the ordered query errors
// with `failed-precondition` and we fall back to the un-ordered phone query so pages keep working.
// errorMessage keeps each page's exact copy; sort=false preserves Profile's original array
// (its stats are order-independent, so the createdAt-desc order has no visible effect).
export function useCustomerOrders(phone, { retryToken = 0, errorMessage = DEFAULT_ERROR, sort = true } = {}) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!phone) {
      // reset ก่อนเลิก subscribe เมื่อไม่มี phone — setState ที่ตั้งใจใน effect
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const boundedQuery = query(
      collection(db, "orders"),
      where("phone", "==", phone),
      orderBy("createdAt", "desc"),
      limit(CUSTOMER_ORDERS_LIMIT)
    );
    const fallbackQuery = query(collection(db, "orders"), where("phone", "==", phone));

    let active = null;
    const stop = () => { if (active) { active(); active = null; } };
    const onNext = (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (sort) data.sort(byNewest());
      setOrders(data);
      setError(null);
      setLoading(false);
    };
    const subscribe = (q, isFallback) => {
      active = onSnapshot(
        q,
        onNext,
        (err) => {
          // Missing/still-building composite index -> use the un-indexed query instead.
          if (!isFallback && err?.code === "failed-precondition") {
            console.error("useCustomerOrders index fallback:", err);
            stop();
            subscribe(fallbackQuery, true);
            return;
          }
          console.error("Failed to load orders:", err);
          setError(errorMessage);
          setLoading(false);
        }
      );
    };
    subscribe(boundedQuery, false);

    return () => stop();
  }, [phone, retryToken, errorMessage, sort]);

  return { orders, loading, error };
}
