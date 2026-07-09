import { useCallback, useMemo, useState } from "react";

/*
  Shared notification "model" used by Store (and reusable by Customer/Rider).

  There is no `notifications` collection in Firestore — firestore.rules never granted
  per-notification writes, so notifications are DERIVED from real order documents and
  the read/deleted state lives per-device in localStorage. This hook owns that state
  once so no page re-implements the read-map / delete-map / sort logic.

  items: array of derived notifications, each { id, time, ... }. `time` may be a Date,
         a millisecond number, or a Firestore Timestamp.
  storageKey: role-scoped prefix, e.g. "lkfc_store_notifications".
*/
const loadMap = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const persist = (key, map) => {
  try {
    localStorage.setItem(key, JSON.stringify(map));
  } catch {
    // ignore blocked / full localStorage
  }
  return map;
};

const timeMs = (t) => {
  if (!t) return 0;
  if (t instanceof Date) return t.getTime();
  if (typeof t === "number") return t;
  if (typeof t.toDate === "function") return t.toDate().getTime();
  return 0;
};

export function useNotificationInbox(items, storageKey) {
  const READ_KEY = `${storageKey}_read`;
  const DEL_KEY = `${storageKey}_deleted`;

  const [readMap, setReadMap] = useState(() => loadMap(READ_KEY));
  const [deletedMap, setDeletedMap] = useState(() => loadMap(DEL_KEY));

  // Non-deleted notifications, tagged with read state, newest first.
  const notifications = useMemo(
    () =>
      items
        .filter((n) => !deletedMap[n.id])
        .map((n) => ({ ...n, read: Boolean(readMap[n.id]) }))
        .sort((a, b) => timeMs(b.time) - timeMs(a.time)),
    [items, readMap, deletedMap]
  );

  const unreadCount = useMemo(
    () => notifications.reduce((c, n) => (n.read ? c : c + 1), 0),
    [notifications]
  );

  const markRead = useCallback(
    (id) => setReadMap((prev) => (prev[id] ? prev : persist(READ_KEY, { ...prev, [id]: true }))),
    [READ_KEY]
  );

  const markAllRead = useCallback(
    () =>
      setReadMap((prev) => {
        const next = { ...prev };
        notifications.forEach((n) => { next[n.id] = true; });
        return persist(READ_KEY, next);
      }),
    [READ_KEY, notifications]
  );

  const remove = useCallback(
    (id) => setDeletedMap((prev) => persist(DEL_KEY, { ...prev, [id]: true })),
    [DEL_KEY]
  );

  const clearAll = useCallback(
    () =>
      setDeletedMap((prev) => {
        const next = { ...prev };
        notifications.forEach((n) => { next[n.id] = true; });
        return persist(DEL_KEY, next);
      }),
    [DEL_KEY, notifications]
  );

  return { notifications, unreadCount, markRead, markAllRead, remove, clearAll };
}
