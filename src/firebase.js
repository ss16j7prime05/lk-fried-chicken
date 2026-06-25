import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  inMemoryPersistence,
} from "firebase/auth";

// Project เดียวกันทั้ง local และ Vercel (hardcoded ค่าเดียว ไม่มี env var ให้ค่าเพี้ยนได้ระหว่าง environment)
const firebaseConfig = {
  apiKey: "AIzaSyAZN_49Dr5kIh8cNYaC8_jItA4ypX89lbY",
  authDomain: "food-order-system-61f13.firebaseapp.com",
  projectId: "food-order-system-61f13",
  storageBucket: "food-order-system-61f13.firebasestorage.app",
  messagingSenderId: "933376622531",
  appId: "1:933376622531:web:6344947b9c623189c68776"
};

// กัน initializeApp ซ้ำถ้าไฟล์นี้ถูก import มากกว่าหนึ่งครั้งจาก bundle/HMR
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);

// บางเบราว์เซอร์มือถือ (Safari private mode, in-app browser อย่าง LINE) บล็อก IndexedDB
// ทำให้ login สำเร็จแต่ session ไม่ persist (auth.currentUser หลุดทันทีหลัง redirect)
// ตั้ง browserLocalPersistence ชัดเจน ถ้าตั้งไม่ได้ (storage ถูกบล็อก) ให้ fallback เป็น in-memory
// แทนปล่อยให้ throw แบบไม่มี handler ซึ่งทำให้ login ดูเหมือน "ไม่ผ่าน" บนมือถือ
setPersistence(auth, browserLocalPersistence).catch(() => {
  setPersistence(auth, inMemoryPersistence).catch(() => {});
});