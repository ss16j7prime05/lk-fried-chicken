# TODO — LK Fried Chicken

> งานค้างและแผนการทำงาน อัปเดตทุกครั้งหลังจบงาน (ดูกฎใน `CLAUDE.md`)

## 🔴 กำลังทำ (In Progress)
- _(ยังไม่มี)_

## 🟡 รอทำ (Backlog)
- _(ยังไม่มี — เพิ่มรายการเมื่อพบงาน)_

## 🟢 เสร็จแล้ว (Done)
- 2026-07-15 Task 4b: แก้ Bank/PromptPay ขึ้น error dialog ไม่สร้างออเดอร์ — หุ้ม `uploadSlip`
  ด้วย try/catch ใน `handleConfirmOrder` ถ้าอัปสลิปล้มเหลวให้สร้างออเดอร์เป็น WAITING_PAYMENT
  แทนการ abort (ลูกค้าอัปสลิปใหม่ที่ Order Detail) → ออเดอร์ถูกสร้างเสมอ. commit `e37214b`,
  verified live (`Checkout-DiO9cp20.js`)
- 2026-07-15 Task 4: แก้ Bank/PromptPay checkout ค้าง "กำลังสั่งซื้อ" ไม่สร้างออเดอร์ — สาเหตุคือ
  Vercel serve bundle เก่า (ยังอัปสลิปไป Firebase Storage `slips/` ที่ไม่มี bucket) ทั้งที่โค้ด
  Cloudinary บน main ถูกต้องแล้ว → push commit `4bf0fd8` re-deploy + เพิ่ม AbortController
  timeout 45s ใน `uploadSlip()`. Verified: production bundle ใหม่ไม่มี `slips/`, Cloudinary 200,
  addDoc สร้างสำเร็จ
- 2026-07-14 แก้ Store Settings save regression: `updateDoc`→`setDoc(merge)` (5 จุด) + แก้ storage path
  โลโก้/แบนเนอร์เป็น 2 ส่วนให้ผ่าน Storage rules — build ผ่าน, 0 new ESLint
- 2026-07-14 สร้าง `CLAUDE.md`, `TODO.md`, `CHANGELOG.md` เป็นกฎหลักและระบบติดตามงานของโปรเจกต์
- 2026-07-14 i18n Store: แปล Orders, Menu, Order Edit modal (+ Kitchen cards ที่ใช้ร่วม) เป็นภาษาไทยครบ
  โดยใช้ระบบ i18n เดิม (translations.js + usePreferences) — build ผ่าน, 0 new ESLint errors

## 📝 ตรวจสอบเพิ่มเติมภายหลัง (Follow-up)
- QA ด้วยตาบนเว็บจริง (Vercel) ทั้ง 4 บทบาท ทุก breakpoint — สภาพแวดล้อมนี้ทำ visual QA ไม่ได้
  (ตรวจได้แค่ build + lint + ความครบของ key EN/TH)

## 📌 หมายเหตุ / ประเด็นค้างพิจารณา
- โปรเจกต์ปัจจุบันเป็น **JavaScript (JSX)** ไม่ใช่ TypeScript ตามที่ระบุใน stack —
  หากต้องการย้ายไป TypeScript ให้วางแผนและถามผู้ใช้ก่อน
