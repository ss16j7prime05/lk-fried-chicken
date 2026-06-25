import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// initializeApp ต้องถูกเรียกก่อนไฟล์อื่นเรียก getFirestore() เสมอ
// import โมดูลนี้เป็นอันดับแรกในทุกไฟล์ที่ต้องใช้ Firestore Admin SDK
if (!getApps().length) {
  initializeApp();
}

export const db = getFirestore();
