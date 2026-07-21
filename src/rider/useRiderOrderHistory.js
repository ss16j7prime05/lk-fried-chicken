import { useCallback, useEffect, useRef, useState } from "react";
import { collection, getDocs, limit, orderBy, query, startAfter, where } from "firebase/firestore";
import { db } from "../firebase";
import { logError } from "../errorCenter";

// Rows loaded per page / "Load More" tap. Small pages keep the first paint fast and the read
// bounded no matter how large the rider's history is.
export const HISTORY_PAGE_SIZE = 20;

// Server-side paginated read of a rider's delivery history (orders where riderId == uid),
// newest first. Replaces the old "subscribe to the whole lifetime, slice on the client"
// approach (useRiderOrders): each page is a bounded getDocs (orderBy createdAt desc + limit),
// and "Load More" fetches the next page with startAfter(lastDoc). The full collection is never
// read, and a per-id guard means no document is ever appended twice.
//
// Ordering is by createdAt (set on every order at creation, so no doc is dropped and cancelled
// orders — which have no deliveredAt — stay in the list) and is backed by the composite index
// orders(riderId ASC, createdAt DESC). If that index isn't deployed yet the ordered query throws
// `failed-precondition`; we fall back to a single un-paginated read (client-sorted by the page)
// so history still renders — the same resilience pattern useRiderIncome uses.
//
// getDocs (not onSnapshot) is deliberate: history is not a realtime surface, so a one-shot read
// per page avoids a permanent listener and still uses Firestore's offline cache transparently.
export function useRiderOrderHistory(uid) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(() => Boolean(uid));
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);

  const cursorRef = useRef(null);   // last DocumentSnapshot of the loaded page (startAfter cursor)
  const idsRef = useRef(new Set()); // ids already loaded — guards against duplicate rows
  const reqRef = useRef(0);         // request token — ignores responses from a superseded uid

  // Fetch one page. mode "init" = first page (reset cursor + dedup set); "more" = next page.
  // All state writes happen inside the async callbacks (never synchronously in an effect).
  const fetchPage = useCallback(async (mode) => {
    if (!uid) return;
    if (mode === "init") { cursorRef.current = null; idsRef.current = new Set(); }
    const token = reqRef.current;
    const clauses = [where("riderId", "==", uid), orderBy("createdAt", "desc")];
    if (mode === "more" && cursorRef.current) clauses.push(startAfter(cursorRef.current));
    clauses.push(limit(HISTORY_PAGE_SIZE));

    try {
      const snap = await getDocs(query(collection(db, "orders"), ...clauses));
      if (token !== reqRef.current) return; // uid changed mid-flight — drop stale result
      const page = [];
      snap.docs.forEach((d) => {
        if (idsRef.current.has(d.id)) return;
        idsRef.current.add(d.id);
        page.push({ id: d.id, ...d.data() });
      });
      if (snap.docs.length) cursorRef.current = snap.docs[snap.docs.length - 1];
      setOrders((prev) => (mode === "init" ? page : [...prev, ...page]));
      setHasMore(snap.size === HISTORY_PAGE_SIZE);
      setError(null);
    } catch (err) {
      if (token !== reqRef.current) return;
      // Missing composite index -> one-shot un-paginated fallback so history still renders.
      if (mode === "init" && err?.code === "failed-precondition") {
        try {
          logError(err, "useRiderOrderHistory.index-fallback");
          const snap = await getDocs(query(collection(db, "orders"), where("riderId", "==", uid)));
          if (token !== reqRef.current) return;
          snap.docs.forEach((d) => idsRef.current.add(d.id));
          setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
          setHasMore(false);
          setError(null);
          return;
        } catch (e2) {
          if (token !== reqRef.current) return;
          logError(e2, "useRiderOrderHistory.fallback");
          setError(e2);
          return;
        }
      }
      logError(err, "useRiderOrderHistory");
      setError(err);
    }
  }, [uid]);

  // Load the first page whenever the rider changes. reqRef bumps so any in-flight page from a
  // previous uid is ignored on arrival. setState is confined to fetchPage's async callbacks.
  useEffect(() => {
    reqRef.current += 1;
    if (!uid) return undefined;
    fetchPage("init").finally(() => setLoading(false));
    return undefined;
  }, [uid, fetchPage]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    setLoadingMore(true);
    fetchPage("more").finally(() => setLoadingMore(false));
  }, [fetchPage, hasMore, loading, loadingMore]);

  return { orders, loading, loadingMore, error, hasMore, loadMore };
}
