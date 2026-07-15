# TODO — LK Fried Chicken

> งานค้างและแผนการทำงาน อัปเดตทุกครั้งหลังจบงาน (ดูกฎใน `CLAUDE.md`)

## 🔴 กำลังทำ (In Progress)
- _(ยังไม่มี)_

## 🟡 รอทำ (Backlog)
- **Phase 5.x ทั้งชั้นเป็น dead code — ไม่ถูก mount ที่ไหนเลย** (พบตอนทำ R-02, ยังไม่แตะ):
  `store/autoDispatch.js`, `store/orderAssignment.js`, `tracking/adminFleetMap.js`,
  `tracking/customerTracking.js`, `tracking/storeLiveMap.js` ไม่มี component ไหน import
  → ฟีเจอร์จ่ายงานอัตโนมัติ / แผนที่ fleet ของแอดมิน / แผนที่ไรเดอร์ของร้าน **ยังไม่ได้เปิดใช้จริง**
  และ `users/{uid}.currentLocation` ที่โมดูลพวกนี้อ่าน **ไม่มีใครเขียนเลย** (`startTracking`/
  `useRiderLocation` ไม่ถูกเรียก) → ถ้าจะเปิดใช้ต้องต่อ broadcast ฝั่งไรเดอร์ด้วย
  ไม่งั้น `findAvailableRiders` จะกรองไรเดอร์ออกหมดเสมอ (auto-dispatch หาไรเดอร์ไม่เจอตลอด)
  — ควรตัดสินใจว่าจะ "เปิดใช้" หรือ "ลบทิ้ง" (ถามผู้ใช้ก่อน)
- **GPS ยิง OSRM ทุก 5 วินาที ต่อ 1 ออเดอร์** (`useDeliveryBroadcast`) — public OSRM มี rate limit
  และกินแบตมือถือ ควรพิจารณาลดความถี่/throttle เมื่อไรเดอร์ไม่ขยับ (คงพฤติกรรมเดิมไว้ใน R-02
  เพราะไม่อยากเปลี่ยน behavior โดยไม่ได้ทดสอบจริง)
- **ตำแหน่งหยุดกระจายเมื่อไรเดอร์ออกจากหน้า Dashboard** (ไปหน้า Profile/Earnings/Settings) —
  R-02 แก้เคสสลับ "แท็บ" แล้ว แต่การออกจาก "หน้า" ยัง unmount อยู่ ถ้าต้องการติดตามต่อเนื่องจริง
  ต้องยกไปที่ระดับ layout/app (งานใหญ่กว่า — ควรทำเป็น task แยก)

## 🟢 เสร็จแล้ว (Done)
- 2026-07-16 **R-02 Current Order** — แก้แผนที่ติดตามฝั่งลูกค้าค้างเมื่อไรเดอร์สลับแท็บ: การกระจาย
  GPS (`useRiderGpsBroadcast`) ฝังอยู่ใน `RiderOrderCard` ซึ่ง render เฉพาะแท็บที่เลือก พอไรเดอร์
  สลับไปแท็บ Available (พฤติกรรมปกติมาก) การ์ด unmount → หยุดส่งพิกัด → หน้า `/shop/orders/:id`
  ของลูกค้าค้างที่ตำแหน่งเดิม + ETA ค้าง → ย้ายไปที่ระดับ Dashboard (`useDeliveryBroadcast`)
  ที่ไม่ unmount ตามแท็บ + รวม logic ตำแหน่งไว้ที่ `riderLocationService` (SSOT) ใช้
  `mapsService.getCurrentLocation` แทน `navigator.geolocation` ที่เขียนซ้ำ + แก้ unhandled
  rejection ทุก 5 วิ + แก้ `markNear` เขียนพลาดแล้วขึ้นว่า "แจ้งแล้ว".
  build ผ่าน, ESLint คงที่ 64/61, ทดสอบ 24 เคสผ่าน (+ R-01 25 เคสไม่ regress)
- 2026-07-16 **R-01 Incoming Orders** — แก้ race condition ตอนรับงาน: `acceptDelivery` เดิมเรียก
  `assignRider` (updateDoc ตรง ๆ จาก snapshot ในเครื่อง) ไรเดอร์ 2 คนกดพร้อมกันเขียนทับกันเงียบ ๆ
  ทั้งคู่คิดว่าได้งาน → เปลี่ยนมาใช้ `riderAcceptReject.acceptOrder` (transaction, SSOT ที่มีอยู่แล้ว
  แต่ไม่เคยถูก import) + ต่อ Reject (`rejectOrder`/`hasRejected`) + แจ้ง error ทุกกรณีแทนกดแล้วเงียบ
  + กัน onSnapshot error ค้างหน้า Loading + query รวม alias ไทย + กันกดซ้ำ.
  build ผ่าน, ESLint คงที่ 64/61 (0 error ใหม่), ทดสอบ 25 เคสผ่านหมด (รวมเคส race 2 ไรเดอร์)
- 2026-07-15 ยกเครื่องระบบอัปโหลดรูปทั้งแอปให้ผ่าน `services/cloudinary.js` ตัวเดียว (HEIC/HEIF,
  บีบอัด+แปลงฝั่ง client, progress, timeout+retry, ไม่ค้าง) และย้ายทุกจุดที่ยังใช้ Firebase Storage
  (เมนู/โปรไฟล์ลูกค้า/เอกสารสมัคร/แชท) มา Cloudinary. ไม่แตะ checkout/order. build ผ่าน, 0 error ใหม่.
  รอผู้ใช้ทดสอบจริง (Android/iPhone gallery+camera, สลิป, รูปทั่วไป)
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
- **R-01: ยังไม่ได้ QA ด้วยตาบนเว็บจริง** — `/rider` อยู่หลัง login และ session นี้ไม่มีบัญชีไรเดอร์
  ให้ทดสอบ ผู้ใช้ควรเช็คเอง: ปุ่ม Reject, แถบ error ตอนโดนตัดหน้า (already_taken), แถบ error
  ตอน feed พัง, ปุ่ม Accept ตอนกำลังกด (Accepting...) ทั้ง Mobile/Tablet/Desktop
- **R-01 (โครงสร้าง):** `RiderOrderCard` ตอนนี้เป็น English UI ปนกับ `STATUS_LABEL` ภาษาไทย
  ทั้งหน้ายังไม่ผ่าน i18n เหมือนฝั่ง Store — ควรทำ i18n ของ Rider ทั้งชุดเป็นงานแยก
- **หมายเหตุขัดกับ CLAUDE.md §5:** `RiderProfile.jsx` ที่ root ถูก route จริงใน `main.jsx`
  (ไม่ใช่ legacy ตามที่เอกสารระบุ) ส่วน `Rider.jsx` ที่ root คือ legacy จริง (ไม่ถูก mount) —
  ควรแก้เอกสารตอนทำ R-11 Rider Profile

## 📌 หมายเหตุ / ประเด็นค้างพิจารณา
- โปรเจกต์ปัจจุบันเป็น **JavaScript (JSX)** ไม่ใช่ TypeScript ตามที่ระบุใน stack —
  หากต้องการย้ายไป TypeScript ให้วางแผนและถามผู้ใช้ก่อน
