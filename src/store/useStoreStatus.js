import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { STORE_ID } from "../config";
import { computeStatus } from "./storeStatus";

// Subscribes to stores/{STORE_ID} and returns the live open/closed status, re-evaluated
// every minute so "closing_soon" / "closed" flips on time without a reload.
// which: "store" | "delivery"
export function useStoreStatus(which = "store") {
  const [store, setStore] = useState(null);
  // Date.now (bare reference) as the lazy initializer — React calls it, so it isn't an
  // impure call in the render body.
  const [nowTs, setNowTs] = useState(Date.now);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "stores", STORE_ID), (snap) => {
      setStore(snap.exists() ? snap.data() : null);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  return { store, ...computeStatus(store, new Date(nowTs), which) };
}
