import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import { byNewest } from "../../store/orderStatus";

const DEFAULT_ERROR = "Unable to load your orders right now. Please try again later.";

// Shared customer orders subscription used by Orders / Notifications / Profile / Reviews.
// Query shape is unchanged: orders where phone == <phone>, sorted newest-first client-side
// (no orderBy — avoids a composite index the project doesn't have). errorMessage keeps each
// page's exact copy; sort=false preserves Profile's original unsorted array.
export function useCustomerOrders(phone, { retryToken = 0, errorMessage = DEFAULT_ERROR, sort = true } = {}) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!phone) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const ordersQuery = query(collection(db, "orders"), where("phone", "==", phone));
    const unsubscribe = onSnapshot(
      ordersQuery,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (sort) data.sort(byNewest());
        setOrders(data);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error("Failed to load orders:", err);
        setError(errorMessage);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [phone, retryToken, errorMessage, sort]);

  return { orders, loading, error };
}
