import { useCallback, useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";

// Realtime CRUD for users/{uid}/addresses. One live listener (no duplication),
// ordered newest-first server-side (single-field index only — no composite needed),
// then default-first client-side. Enforces exactly one default address.
export function useAddresses(uid) {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(() => Boolean(uid));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!uid) {
      // reset ก่อนเลิก subscribe เมื่อไม่มี uid — setState ที่ตั้งใจใน effect
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAddresses([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const col = collection(db, "users", uid, "addresses");
    const unsub = onSnapshot(
      query(col, orderBy("createdAt", "desc")),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        // default address always surfaces first; newest-first among the rest.
        list.sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0));
        setAddresses(list);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Failed to load addresses:", err);
        setError("Unable to load your addresses right now.");
        setLoading(false);
      }
    );
    return () => unsub();
  }, [uid]);

  // Clear isDefault on every address except `exceptId` (one batched write).
  const unsetOtherDefaults = useCallback(
    async (exceptId) => {
      const col = collection(db, "users", uid, "addresses");
      const snap = await getDocs(col);
      const batch = writeBatch(db);
      let touched = false;
      snap.docs.forEach((d) => {
        if (d.id !== exceptId && d.data().isDefault) {
          batch.update(d.ref, { isDefault: false, updatedAt: serverTimestamp() });
          touched = true;
        }
      });
      if (touched) await batch.commit();
    },
    [uid]
  );

  const addAddress = useCallback(
    async (data) => {
      if (!uid) return null;
      // first address is always default; otherwise honour the form's choice.
      const makeDefault = data.isDefault || addresses.length === 0;
      if (makeDefault) await unsetOtherDefaults(null);
      const refDoc = await addDoc(collection(db, "users", uid, "addresses"), {
        ...data,
        isDefault: makeDefault,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return refDoc.id;
    },
    [uid, addresses.length, unsetOtherDefaults]
  );

  const updateAddress = useCallback(
    async (id, data) => {
      if (!uid) return;
      const ref = doc(db, "users", uid, "addresses", id);

      if (data.isDefault) {
        await unsetOtherDefaults(id);
        await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
        return;
      }

      // Turning default OFF: never leave zero defaults. If this was the only
      // default, promote the newest other address (or keep this one default if
      // it's the only address).
      const wasDefault = addresses.find((a) => a.id === id)?.isDefault;
      const otherDefaultExists = addresses.some((a) => a.id !== id && a.isDefault);
      if (wasDefault && !otherDefaultExists) {
        const promote = addresses.find((a) => a.id !== id); // sorted default-first, newest-first
        if (promote) {
          const batch = writeBatch(db);
          batch.update(ref, { ...data, isDefault: false, updatedAt: serverTimestamp() });
          batch.update(doc(db, "users", uid, "addresses", promote.id), {
            isDefault: true,
            updatedAt: serverTimestamp(),
          });
          await batch.commit();
        } else {
          // only address — must stay default
          await updateDoc(ref, { ...data, isDefault: true, updatedAt: serverTimestamp() });
        }
        return;
      }

      await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
    },
    [uid, addresses, unsetOtherDefaults]
  );

  const setDefault = useCallback(
    async (id) => {
      if (!uid) return;
      await unsetOtherDefaults(id);
      await updateDoc(doc(db, "users", uid, "addresses", id), {
        isDefault: true,
        updatedAt: serverTimestamp(),
      });
    },
    [uid, unsetOtherDefaults]
  );

  const removeAddress = useCallback(
    async (id) => {
      if (!uid) return;
      const removed = addresses.find((a) => a.id === id);
      await deleteDoc(doc(db, "users", uid, "addresses", id));
      // if the default was removed, promote the newest remaining address.
      if (removed?.isDefault) {
        const remaining = addresses.filter((a) => a.id !== id);
        if (remaining.length) {
          await updateDoc(doc(db, "users", uid, "addresses", remaining[0].id), {
            isDefault: true,
            updatedAt: serverTimestamp(),
          });
        }
      }
    },
    [uid, addresses]
  );

  const defaultAddress = addresses.find((a) => a.isDefault) || null;

  return {
    addresses,
    defaultAddress,
    loading,
    error,
    addAddress,
    updateAddress,
    removeAddress,
    setDefault,
  };
}
