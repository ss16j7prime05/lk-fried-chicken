import { useEffect, useState } from "react";
import { computeStatus } from "./storeStatus";
import { useStore } from "./useStore";

// Live open/closed status, re-evaluated every minute so "closing_soon" / "closed"
// flips on time without a reload. Reads the store doc from the single shared
// useStore() subscription (one source of truth — no duplicate listener).
// which: "store" | "delivery"
export function useStoreStatus(which = "store") {
  const store = useStore();
  // Date.now (bare reference) as the lazy initializer — React calls it, so it isn't an
  // impure call in the render body.
  const [nowTs, setNowTs] = useState(Date.now);

  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  return { store, ...computeStatus(store, new Date(nowTs), which) };
}
