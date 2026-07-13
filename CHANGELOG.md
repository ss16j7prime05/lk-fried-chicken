# CHANGELOG — LK Fried Chicken

> บันทึกการเปลี่ยนแปลงสำคัญ เรียงจากใหม่ไปเก่า (รูปแบบอิง [Keep a Changelog])
> อัปเดตทุกครั้งหลังจบงาน (ดูกฎใน `CLAUDE.md`)

## [Unreleased]

### Fixed (Store Settings — save regression)
- **Firestore save / Store status / Business Hours / Notif / E-Payment**: เปลี่ยนจาก `updateDoc`
  เป็น `setDoc(..., { merge: true })` บน `stores/{STORE_ID}` — `updateDoc` โยน error เมื่อเอกสารร้าน
  ยังไม่ถูกสร้าง ทำให้ทุกการบันทึกล้มเหลว (ตอนนี้ create-or-merge เหมือน StoresPanel/StoreDashboard)
- **Image upload (โลโก้/แบนเนอร์)**: แก้ path ที่อัปโหลดจาก `stores/{id}/{file}` (3 ส่วน ซึ่งโดน
  Storage rules ปฏิเสธ) เป็น `stores/{id}_{kind}_{ts}_{name}` (2 ส่วน folder/file) ให้ตรงกับ rule
  `/{folder}/{file}` แบบเดียวกับการอัปโหลดรูปเมนู — ไม่ต้องแก้/deploy rules
- ผลลัพธ์: ทุกส่วนของ Settings บันทึกได้ครบ (Profile / Images / Contact / Social / Location / Tax /
  E-Payment / Business Hours / Open-Close)

### Added
- `CLAUDE.md` — กฎหลักและ Single Source of Truth ของโปรเจกต์
- `TODO.md` — ระบบติดตามงานค้าง
- `CHANGELOG.md` — บันทึกการเปลี่ยนแปลง
- i18n keys ใหม่: `sm.*` (Menu), `so.*` (Orders + Kitchen cards), `soe.*` (Order Edit modal) ครบทั้ง EN/TH

### Changed (i18n — Store)
- **Orders page** (`src/pages/store/Orders.jsx`): แปลข้อความ hardcoded English ทั้งหมดเป็น i18n
  รวมถึง KitchenView/KitchenCard ที่ Kitchen page ใช้ร่วม (`so.*`)
- **Menu page** (`src/pages/store/Menu.jsx`): แปลทั้งหน้าเป็น i18n (`sm.*`)
- **Order Edit modal** (`src/pages/store/OrderEditModal.jsx`): แปลทั้ง modal (`soe.*`, reuse `oe.reason.*`)
- คงข้อความอังกฤษไว้เฉพาะเอกสารสำหรับพิมพ์ (ใบเสร็จ/ใบครัว thermal) และ CSV export ตามเจตนาเดิม

### Notes
- Build ผ่าน, ESLint = 0 new errors (baseline 64 problems เท่าเดิมก่อน/หลังแก้)
- QA อัตโนมัติ: ตรวจแล้วทุก key ที่ใช้ (325 keys) มีครบทั้ง EN และ TH — ไม่มี fallback เป็นอังกฤษเมื่อเลือกภาษาไทย

---

## ประวัติก่อนหน้า (จาก Git history)
- `f57dbed` Production update
- `bced975` i18n(store): translate all remaining hardcoded English in Settings
- `6f9a9e2` fix(store): single Social section under Basic Info; consolidate settings persistence
- `ca141e6` fix(store,rider): upload UX, theme selector, remove facilities, mobile responsive
- `7af247f` feat(notifications): Phase 6.0D LINE Rich Menu helper (SSOT)

[Keep a Changelog]: https://keepachangelog.com/
