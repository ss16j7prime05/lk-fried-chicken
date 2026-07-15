# TODO — LK Fried Chicken

> งานค้างและแผนการทำงาน อัปเดตทุกครั้งหลังจบงาน (ดูกฎใน `CLAUDE.md`)

## 🔴 กำลังทำ (In Progress)
- _(ยังไม่มี)_

## 🟡 รอทำ (Backlog)
- **`cancelOrder` ยังไม่ atomic และไม่ตรวจสถานะปลายทางเลย** (พบตอนทำ R-04, ยังไม่แตะเพราะเป็น
  ฝั่ง Store/Admin ไม่ใช่ R-04 rider) — `orderEngine.cancelOrder` เขียน `status:"cancelled"`
  ทับได้ทุกกรณี **รวมถึงออเดอร์ที่ completed ไปแล้ว** → ร้านกดยกเลิกช้ากว่าไรเดอร์กดส่งสำเร็จ
  = ออเดอร์ที่ส่งไปแล้วกลายเป็นยกเลิก (ขาฝั่งไรเดอร์กันได้แล้วใน R-04 แต่ขาฝั่งร้านยังเปิดอยู่)
  → ควรทำเป็น transaction + เช็ค `isTerminal` แบบเดียวกับ `updateOrderStatus`
- **บั๊ก Admin: ปุ่มยกเลิกไม่ทำงาน** (พบตอนทำ R-04) — `admin/OrdersPanel.jsx:155` เรียก
  `cancelOrder(o.id)` โดยส่ง **string** แต่ signature คือ `cancelOrder(order, opts)` ที่อ่าน
  `order?.id` → ได้ `undefined` → `return` ทันที **กดแล้วไม่เกิดอะไรเลย** (ต้องส่ง `o` ทั้งก้อน)
- **`assignRider` ยังไม่ atomic** — ผู้เรียกเหลือแค่ `store/orderAssignment.js` ซึ่งเป็น dead code
  (ดูรายการ Phase 5.x ข้างล่าง) ขาไรเดอร์ย้ายไปใช้ `acceptOrder` (transaction) แล้วใน R-01
- **`completeOrder` กลายเป็น dead code** หลัง R-04 (ไรเดอร์เป็นผู้เรียกรายเดียวและย้ายไปใช้
  `transition` แล้ว) — ยังคง export ไว้เพราะเป็น public API ของ engine และตอนนี้ atomic ตามไปด้วย
  ควรตัดสินใจว่าจะลบหรือให้ที่อื่นใช้
- **`orderStatusSync.js` เป็น dead code** — ไม่มีใคร import (พบตอนทำ R-04)
- **ย้าย Store Menu/Orders มาใช้ `hooks/useOnlineStatus.js`** (พบตอนทำ R-03) — ทั้งสองไฟล์เขียน
  listener `online`/`offline` เองแบบ inline เหมือนกันเป๊ะ (`pages/store/Menu.jsx` ~บรรทัด 1047,
  `pages/store/Orders.jsx` ~บรรทัด 1683) R-03 สร้าง hook SSOT ไว้แล้วแต่**ไม่ได้แตะไฟล์ Store**
  เพราะอยู่นอกขอบเขต → ควรย้ายทีหลังให้เหลือชุดเดียว
- **บั๊ก Store: `<EmptyState type="offline" />` ไม่มีผล** (พบตอนทำ R-03) — `EmptyState` รับแค่
  `title`/`description`/`icon` ไม่มี prop `type` → ตอนเน็ตหลุด `pages/store/Orders.jsx:1891`
  จะโชว์ค่า default "No Data / Nothing to display 📦" แทนข้อความออฟไลน์ (`Menu.jsx:1223` ใช้
  `PageState type="offline"` ต้องเช็คด้วยว่ารองรับจริงไหม) — งานของโมดูล Store
- **Google Maps JS SDK loader ยังเป็น dead code** (`mapsService.loadGoogleMaps`/`useGoogleMaps`
  ไม่ถูกเรียกจากที่ไหน) — แอปวาดแผนที่ด้วย Leaflet ส่วนการ "นำทาง" ใช้ deep link ของ Google Maps
  ซึ่งถูกต้องแล้วและไม่ต้องใช้ API key → ถ้าไม่มีแผนใช้ ควรลบทิ้ง (ต้องถามผู้ใช้ก่อน)
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
- 2026-07-16 **R-04 Order Status Flow** — ทำให้การเปลี่ยนสถานะเป็น **atomic** จริง:
  `orderEngine.updateOrderStatus` เดิมตรวจสถานะจาก snapshot ในเครื่องแล้ว `updateDoc` ทับตรง ๆ
  (read-modify-write ไม่มีกันชน) → ร้านกดยกเลิกตอนไรเดอร์กด "ส่งสำเร็จ" = **ออเดอร์ที่ถูกยกเลิก
  ถูกชุบชีวิตเป็น completed**; หน้าจอค้าง 1 step แล้วกดปุ่ม = **สถานะเดินถอยหลัง**
  (ready_for_delivery → cooking) ตอนนี้ re-read ใน transaction แล้วตรวจกับสถานะสดก่อนเขียนเสมอ
  + คืน `{ok, reason}` (เดิม error = unhandled rejection เพราะ**ไม่มีผู้เรียกคนไหน try/catch เลย**)
  + ไรเดอร์เปลี่ยนมาใช้ `orderStateMachine.transition` (SSOT "ด่านเดียว" ที่เขียนไว้แล้วแต่
  **ไม่เคยถูกเรียก**) + แจ้ง error + กันกดซ้ำ. build ผ่าน, ESLint คงที่ 64/61,
  ทดสอบ 31 เคสผ่าน + control reproduce บั๊กเดิมได้ 3/3 + R-01/02/03 ไม่ regress (รวม 107 เคส)
- 2026-07-16 **R-03 Navigation (Google Maps)** — นำทางจริงแบบ turn-by-turn (`dir_action=navigate`
  แทนที่จะเปิดแค่หน้าพรีวิวเส้นทาง) + แก้บั๊กออเดอร์ที่มีแต่ที่อยู่ไม่มีพิกัด เดิมเปิด Google Maps
  **search** แทน**นำทาง** + ย้ายการสร้าง URL ไป `mapsService` (SSOT) + เพิ่ม `useOnlineStatus`
  (SSOT) และ `useGeolocationStatus`/`classifyGeoError` → แจ้งไรเดอร์เมื่อ ออฟไลน์ / สิทธิ์ตำแหน่ง
  ถูกบล็อก / GPS ปิด / หา GPS ไม่เจอ พร้อมปุ่ม Retry (เดิมพังเงียบสนิท ลูกค้าไม่เห็นไรเดอร์
  แต่ไรเดอร์ไม่รู้ตัว). build ผ่าน, ESLint คงที่ 64/61, ทดสอบ 27 เคสผ่าน
  (+ ยืนยัน view-mode URL ของ Store/Admin/Customer ไม่เปลี่ยนแม้แต่ตัวเดียว) + R-01/R-02 ไม่ regress
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
