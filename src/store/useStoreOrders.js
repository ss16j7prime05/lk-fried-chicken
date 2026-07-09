import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { STORE_ID } from "../config";

// Shared realtime subscription to every order belonging to this store
// (orders where storeId == STORE_ID). Same shape as useRiderOrders/useCustomerOrders
// so the notifications feed and any future page read the store's orders once, in one
// place. No orderBy (where + orderBy would need a composite index the project doesn't
// have) — callers keep their own client-side sort/derivation. `loading` flips false
// after the first snapshot.
export function useStoreOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "orders"), where("storeId", "==", STORE_ID));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setOrders(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return { orders, loading };
}
