import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { STORE_ID } from "../config";

// The single source of truth for store information across the whole app: one
// real-time subscription to stores/{STORE_ID} — the exact document the Store
// Settings screen writes. Every customer surface reads store fields (name, phone,
// logo, cover, address, gps, hours, social, paymentSettings, …) from here so the
// UI always reflects the latest saved settings, live and after refresh/login.
// Returns the raw doc data, or null until it loads / if the doc is missing.
export function useStore() {
  const [store, setStore] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "stores", STORE_ID), (snap) => {
      setStore(snap.exists() ? snap.data() : null);
    });
    return unsub;
  }, []);

  return store;
}
