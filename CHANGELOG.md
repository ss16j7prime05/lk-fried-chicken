# CHANGELOG — LK Fried Chicken

> บันทึกการเปลี่ยนแปลงสำคัญ เรียงจากใหม่ไปเก่า (รูปแบบอิง [Keep a Changelog])
> อัปเดตทุกครั้งหลังจบงาน (ดูกฎใน `CLAUDE.md`)

## [Unreleased]

### Changed (Image upload system — unified & hardened, all surfaces)
- **`src/services/cloudinary.js` เป็นทางเดียวของการอัปโหลดรูปทั้งแอป** — เขียนใหม่ให้:
  รับ JPG/JPEG/PNG/WEBP/GIF และ **HEIC/HEIF** (ตรวจจาก MIME หรือนามสกุล เผื่อมือถือส่ง MIME ว่าง);
  แปลง HEIC + ย่อรูปใหญ่เป็น JPEG ฝั่ง client ด้วย canvas (เคารพ EXIF orientation รูป iPhone
  ไม่ตะแคง) โดยรูปที่เล็กและเป็นฟอร์แมตเว็บอยู่แล้วจะไม่ถูกแตะ (คงคุณภาพ); อัปผ่าน XHR จึงมี
  **progress จริง** (onProgress); **timeout ต่อครั้ง + retry อัตโนมัติ** เมื่อเน็ตสะดุด/5xx
  (เหมาะกับเน็ตมือถือช้า); การันตี promise จบเสมอ (ไม่ค้าง); คืน `secure_url` พร้อม Error message
  ที่ชัด (มี `.kind`)
- **ย้ายทุกจุดอัปโหลดที่ยังใช้ Firebase Storage (bucket ไม่มีจริง → 404) มาที่ Cloudinary**:
  รูปเมนู (`pages/store/Menu.jsx`), รูปโปรไฟล์ลูกค้า (`pages/customer/Profile.jsx`),
  เอกสารสมัครร้าน/ไรเดอร์ (`register/uploadApplicationFile.js`), รูปในแชท (`Chat.jsx` ที่ rider
  order card ใช้) — จุดเหล่านี้เดิม **พังเงียบ** เพราะ Storage; ตอนนี้ทำงานผ่าน pipeline เดียวกัน
- **เพิ่มแถบ % ความคืบหน้า**: โลโก้/ปก/QR (Store Settings), รูปเมนู, รูปโปรไฟล์ลูกค้า
- `uploadSlip` ตัดโค้ด timeout ซ้ำซ้อนออก เหลือ delegate ไป `uploadImage` (ได้ HEIC/บีบอัด/retry
  ฟรี) — **ไม่แตะ logic ของ checkout / การสร้างออเดอร์**
- Legacy ที่ไม่ได้ route (`App.jsx`, `Rider.jsx`, `StoreMenu.jsx`, `TrackOrder.jsx`) ปล่อยไว้
  ตามเดิม (dead code)
- verify: `npm run build` ผ่าน, ESLint 0 error ใหม่ (คงที่ 64/61) — รอผู้ใช้ทดสอบจริงบนอุปกรณ์

### Fixed (Task 4b — Bank/PromptPay reached error dialog, no order created)
- **สาเหตุ**: ไล่ flow จริงแบบ end-to-end (คอมโพเนนต์จริง ทั้ง dev + prod build ที่ minify,
  ทั้ง delivery/pickup) พบว่า `generateOrderNo`, `uploadSlip` (Cloudinary), และ `addDoc`
  ทำงานสำเร็จหมดกับ input ปกติ → จุดเดียวที่ throw ได้ "ก่อน" `addDoc` คือ `uploadSlip`
  เมื่อ Cloudinary ปฏิเสธรูปสลิปบางแบบ (ฟอร์แมตไม่รองรับ / เน็ตค้างชั่วคราว) การ throw นั้น
  ทำให้ทั้งออเดอร์ล้มทั้งยวง (ไม่มีอะไรไปถึง Firestore) เฉพาะวิธีที่แนบสลิป — เงินสดไม่กระทบ
- **วิธีแก้**: หุ้ม `uploadSlip` ด้วย try/catch ของตัวเองใน `handleConfirmOrder` — ถ้าอัปสลิป
  ล้มเหลว จะ log แล้วปล่อยให้ `slipImage=""` → logic เดิมสร้างออเดอร์เป็น `WAITING_PAYMENT`
  (หน้าต่างชำระ 10 นาที) และลูกค้าอัปสลิปใหม่ได้ที่หน้า Order Detail → **ออเดอร์ถูกสร้างเสมอ**
  ไม่ว่าอัปสลิปจะสำเร็จหรือไม่ ร้านเห็นออเดอร์ทันที (เงินสด/flow เดิมไม่เปลี่ยน)
- **ยืนยัน**: รัน `<Checkout/>` จริงในเบราว์เซอร์ (พร้อมเพย์ + อัปสลิปจริง) → สร้างออเดอร์สำเร็จ
  ทั้ง dev และ prod build; ทดสอบ payload ของ fallback (WAITING_PAYMENT) บน Firestore จริง =
  สร้างสำเร็จ; live chunk บน Vercel (`Checkout-DiO9cp20.js`) = hash ตรงกับ build ที่ทดสอบ

### Fixed (Task 4 — Bank/PromptPay checkout hung forever, no order created)
- **สาเหตุที่แท้จริง = deploy ค้าง ไม่ใช่บั๊กในโค้ด**: การแก้ให้อัปสลิปไป Cloudinary
  (commit `5aec774`) ถูกต้องและ build ผ่าน แต่ **Vercel ยัง serve bundle เก่า** ที่ยังอัปสลิป
  ไป `slips/` บน Firebase Storage (ไม่มี bucket → 404/ค้าง) `addDoc(orders)` จึงไม่ถูกเรียก
  เฉพาะวิธีที่แนบสลิป (โอน/พร้อมเพย์) — เงินสดไม่แนบสลิปเลยสร้างออเดอร์ได้ตลอด
- **วิธีแก้**: push commit ใหม่เพื่อ trigger Vercel ให้ deploy โค้ดล่าสุด + เพิ่มความทนทาน —
  `uploadSlip()` หุ้ม Cloudinary upload ด้วย `AbortController` timeout 45 วินาที เพื่อว่าถ้า
  เครือข่ายค้างในอนาคต การอัปโหลดจะถูก abort แล้ว throw เข้า catch → ขึ้น error dialog แทนที่จะ
  ค้างหน้า "กำลังสั่งซื้อ..." โดยไม่มีออเดอร์
- **ยืนยัน**: production ตอนนี้ serve `paymentUtils` ตัวใหม่ (ไม่มี `slips/`/`uploadBytes` แล้ว,
  มี `AbortController` + Cloudinary), ทดสอบ Cloudinary upload จริง = HTTP 200, และ
  `addDoc(orders)` payload แบบสลิปจริงบน Firestore production = สร้างสำเร็จ 155 ms

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
