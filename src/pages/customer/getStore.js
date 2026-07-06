import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { STORE_ID } from "../../config";

// Shared one-shot read of the store document (stores/{STORE_ID}). Returns
// { lat, lng, storeName } when the doc exists and has coordinates, otherwise null.
// Callers keep their own name fallback / shape, so per-page behavior is unchanged.
export async function getStore() {
  const snap = await getDoc(doc(db, "stores", STORE_ID));
  if (!snap.exists()) return null;
  const data = snap.data();
  if (data.lat == null || data.lng == null) return null;
  return { lat: data.lat, lng: data.lng, storeName: data.storeName };
}
