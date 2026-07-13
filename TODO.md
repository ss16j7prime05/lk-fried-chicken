# TODO — LK Fried Chicken

> งานค้างและแผนการทำงาน อัปเดตทุกครั้งหลังจบงาน (ดูกฎใน `CLAUDE.md`)

## 🔴 กำลังทำ (In Progress)
- _(ยังไม่มี)_

## 🟡 รอทำ (Backlog)
- _(ยังไม่มี — เพิ่มรายการเมื่อพบงาน)_

## 🟢 เสร็จแล้ว (Done)
- 2026-07-14 สร้าง `CLAUDE.md`, `TODO.md`, `CHANGELOG.md` เป็นกฎหลักและระบบติดตามงานของโปรเจกต์
- 2026-07-14 i18n Store: แปล Orders, Menu, Order Edit modal (+ Kitchen cards ที่ใช้ร่วม) เป็นภาษาไทยครบ
  โดยใช้ระบบ i18n เดิม (translations.js + usePreferences) — build ผ่าน, 0 new ESLint errors

## 📝 ตรวจสอบเพิ่มเติมภายหลัง (Follow-up)
- QA ด้วยตาบนเว็บจริง (Vercel) ทั้ง 4 บทบาท ทุก breakpoint — สภาพแวดล้อมนี้ทำ visual QA ไม่ได้
  (ตรวจได้แค่ build + lint + ความครบของ key EN/TH)

## 📌 หมายเหตุ / ประเด็นค้างพิจารณา
- โปรเจกต์ปัจจุบันเป็น **JavaScript (JSX)** ไม่ใช่ TypeScript ตามที่ระบุใน stack —
  หากต้องการย้ายไป TypeScript ให้วางแผนและถามผู้ใช้ก่อน
