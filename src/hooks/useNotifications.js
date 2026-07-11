import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../AuthContext";
import {
  NOTIF_COLLECTION, ROLE, badgeCount,
  markRead as fbMarkRead, markAllRead as fbMarkAllRead,
  deleteNotification as fbDelete, deleteAll as fbDeleteAll,
} from "../notifications/notificationUtils";

const ms = (t) => t?.toMillis?.() ?? t?.getTime?.() ?? (typeof t === "number" ? t : 0);

// SSOT realtime subscription to the `notifications` collection for the current
// viewer. Query uses equality-only filters (role + userId) so it needs no
// composite index and stays within firestore.rules read scope. Newest-first sort
// is done client-side — same approach as useCustomerOrders.
//
// onNew(docs): optional callback fired with freshly-added notifications AFTER the
// first snapshot (used by the bell to play a sound — reuses the existing alarm system).
export function useNotifications({ onNew } = {}) {
  const { user, role, profile } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const firstLoad = useRef(true);
  const onNewRef = useRef(onNew);
  useEffect(() => { onNewRef.current = onNew; });

  // Recipient key for the equality filter (see notificationUtils recipient model).
  const userKey = role === ROLE.CUSTOMER ? (profile?.phone || "")
    : role === ROLE.RIDER ? (user?.uid || "")
    : ""; // store / admin -> role-broadcast

  useEffect(() => {
    // no role yet, or customer/rider not yet targetable (missing phone/uid)
    if (!role || ((role === ROLE.CUSTOMER || role === ROLE.RIDER) && !userKey)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNotifications([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    firstLoad.current = true;
    const q = query(
      collection(db, NOTIF_COLLECTION),
      where("role", "==", role),
      where("userId", "==", userKey),
    );
    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => ms(b.createdAt) - ms(a.createdAt));
      setNotifications(rows);
      setLoading(false);
      if (!firstLoad.current) {
        const added = snap.docChanges().filter((c) => c.type === "added")
          .map((c) => ({ id: c.doc.id, ...c.doc.data() }));
        if (added.length) onNewRef.current?.(added);
      }
      firstLoad.current = false;
    }, (err) => { console.error("useNotifications:", err); setLoading(false); });
    return () => unsub();
  }, [role, userKey]);

  const unreadCount = useMemo(() => badgeCount(notifications), [notifications]);

  const markRead = useCallback((id) => fbMarkRead(id).catch(() => {}), []);
  const markAllRead = useCallback(
    () => fbMarkAllRead(notifications.filter((n) => !n.read).map((n) => n.id)).catch(() => {}),
    [notifications],
  );
  const remove = useCallback((id) => fbDelete(id).catch(() => {}), []);
  const clearAll = useCallback(
    () => fbDeleteAll(notifications.map((n) => n.id)).catch(() => {}),
    [notifications],
  );

  return { notifications, unreadCount, loading, markRead, markAllRead, remove, clearAll };
}
