# CHANGELOG — LK Fried Chicken

> บันทึกการเปลี่ยนแปลงสำคัญ เรียงจากใหม่ไปเก่า (รูปแบบอิง [Keep a Changelog])
> อัปเดตทุกครั้งหลังจบงาน (ดูกฎใน `CLAUDE.md`)

## [Unreleased]

### Changed (Rider UI dedup + headless visual verification)
- **Refactor duplication → reusable components**: `StatCard` (Profile+Earnings) และ `SectionTitle`
  (Earnings+Settings+Notifications) ย้ายไป `src/rider/riderUi.jsx` ตัวเดียว ; `vehicleLabel`
  (Profile+Settings) ย้ายไป `rider/riderFormat.js` — ตัดโค้ดซ้ำ byte-for-byte ออกหมด, มาร์กอัป
  spacing/typography เป็น SSOT
- **ตรวจด้วยตาแบบ headless จริง** (Chromium ผ่าน playwright-core, dev tool ชั่วคราว ไม่ commit):
  ทุกหน้าไรเดอร์ × 3 breakpoint (390 / 768 / 1280) → **horizontal overflow = 0 ทั้ง 20 เคส**,
  ไม่มี console error ของแอป, ตรวจ light + dark + ภาษาไทย: การ์ด/ปุ่ม/badge/skeleton/empty/error
  + ตาราง Earnings (scroll ในกล่องตัวเอง) + Settings toggle/segmented + dark mode ครบ ไม่มี defect

### Changed (Rider UI/UX polish — design system, a11y, responsiveness; no backend/schema/API/feature changes)
- **Design system (additive, backward-compatible — shared primitives, ทุก role ได้ประโยชน์)**:
  `Button` เพิ่ม `focus-visible` ring (คีย์บอร์ด a11y), state `loading` (spinner), variant `danger`
  ; `Badge` เพิ่มสี `red`/`gray` ; `Skeleton` เพิ่ม `RiderCardSkeleton`/`RiderCardGridSkeleton`
  (ของเดิมไม่ถูกแตะ)
- **RiderLayout**: sidebar **ย่อได้** (icon rail ↔ เต็ม) บน tablet/desktop จำค่าใน localStorage,
  main padding ขยับตาม (ไม่ทับ/ไม่ล้น) ; bottom nav มือถือ touch target ≥ 48px, `focus-visible`,
  `aria-current`/`aria-label`, safe-area ; floating notification bell คงเดิม
- **Order History**: ออกแบบการ์ดใหม่ตามลำดับความสำคัญ — **รายได้เป็นพระเอก** → สถานะ → ร้าน →
  ลูกค้า/ระยะทาง/วิธีชำระ/วันที่ (Order ID, Date, Restaurant, Customer, Distance, Income, Status,
  Payment ครบ, จัดเรียงตรงกริดเดียว) + skeleton ตอนโหลด
- **Skeleton loading** แทน spinner เปล่าในหน้า list: Jobs / History / Earnings / Profile
  (Notifications มี skeleton อยู่แล้ว) — ลด layout shift, perceived performance ดีขึ้น
- **Profile**: เพิ่มแถวทะเบียนรถ + ปุ่ม Logout (จัดกลุ่มชัดขึ้น เข้าถึง logout บนมือถือได้)
- **Accessibility**: focus-visible rings ทั่ว nav/tabs/ปุ่ม, aria labels, touch target ที่ nav ≥ 48px
- **หมายเหตุขอบเขต**: หน้า Map เต็มจอ, chat typing/read-receipt/location/retry, countdown timer
  ในการ์ด Jobs — **ไม่ได้ทำเพราะต้องเพิ่ม feature/แก้ backend/schema** ซึ่งผู้ใช้สั่งห้ามในงานนี้
- build ผ่าน, ESLint 0 error ใหม่ — Rider ทุกหน้ายังใช้ i18n `ro.*` (EN/TH) + dark mode ครบ

### Fixed (R-06 Order History — feed failed silently, page spun forever)
- **บั๊กหลัก: `useRiderOrders` ไม่มี error handler ใน `onSnapshot`** — hook นี้เป็นแหล่งข้อมูล
  ของหน้า Order History (และ Earnings / Notifications / Profile) ถ้า feed พัง (สิทธิ์ / index /
  ออฟไลน์) `loading` ค้าง `true` ตลอดกาล → หน้า Order History **หมุน Loading ค้างเงียบ ๆ**
  ไม่มีการแจ้งเตือน (คลาสเดียวกับ "พังเงียบ / ค้างหน้า Loading" ที่ R-01/R-05 แก้ให้ feed อื่นแล้ว)
  → เพิ่ม error callback: `logError` + set `error` + หยุด `loading` และคืน `{ orders, loading, error }`
- **หน้า Order History แสดงแถบ error จริง** — เดิมไม่มี error state เลย ตอนนี้โชว์แถบแดง
  (ใช้ pattern/มาร์กอัปเดียวกับแถบ error ของ Rider Dashboard — ไม่ได้ redesign) แทนการหมุนค้าง
  หรือขึ้น "ยังไม่มีงาน" ทั้งที่โหลดไม่สำเร็จ ; หน้าอื่นที่ใช้ hook เดียวกันหยุดหมุนค้างตามไปด้วย
- build ผ่าน, ESLint คงที่ (0 error ใหม่) — Rider UI ที่ QA ผ่านแล้วไม่ถูกแตะ (เพิ่มเฉพาะ data path
  + แถบ error) ; keys `ro.history.loadErrTitle/Desc` ครบทั้ง EN/TH

### Fixed / Added (R-05 Chat & Call — chat was write-only, unnotified, and world-readable)
- **บั๊กหลัก: แชทส่งได้อย่างเดียว ลูกค้าไม่มีทางเห็น** — `<Chat>` ถูก render แค่บนการ์ดไรเดอร์
  กับ `Rider.jsx`/`TrackOrder.jsx` ซึ่ง **เป็น legacy และไม่ถูก route ใน `main.jsx`** ส่วนหน้าที่
  ลูกค้าใช้จริง (`pages/customer/OrderDetail.jsx` ที่ `/shop/orders/:orderId`) **ไม่มีแชทเลย**
  → ไรเดอร์พิมพ์ข้อความลงไปโดยที่ลูกค้าไม่มีวันเห็นและตอบกลับไม่ได้
  **วิธีแก้**: ต่อ `<Chat>` **ตัวเดิม** เข้าหน้าลูกค้า (อ่าน/เขียน `chats` เส้นเดียวกัน ไม่ได้ทำ UI
  แชทชุดที่สอง) แสดงเมื่อมีไรเดอร์รับงานแล้ว (`order.riderId`) ให้ตรงกับฝั่งไรเดอร์
- **ไม่มีแจ้งเตือนข้อความใหม่เลย** — ต้องเปิดหน้าแชทค้างไว้ถึงจะรู้ → เพิ่ม
  `NOTIF_TYPE.NEW_MESSAGE` + `notifyChatMessage(order, sender)` เป็น **emitter ใน
  notificationUtils (SSOT เดียวกับ notifyCustomer/notifyRider)** ไม่ได้สร้างช่องทางแจ้งเตือนใหม่;
  ไรเดอร์ส่ง → เด้งหาลูกค้า (ลิงก์ไปหน้าออเดอร์), ลูกค้าส่ง → เด้งหาไรเดอร์ (ลิงก์ไป `/rider`);
  เพิ่มไอคอน `new_message` ใน NotificationBell (มี fallback อยู่แล้วแต่ให้ตรงความหมาย)
- **ป้องกัน broadcast หลุด (เจอจากเทสต์ตัวเอง)**: `notifyCustomer("")` จะได้ `userId:""` ซึ่งตาม
  `firestore.rules` `isMine()` แปลว่า **"ส่งถึงลูกค้าทุกคน"** → ถ้าออเดอร์ไม่มีเบอร์
  ข้อความแจ้งเตือนแชท (พร้อมเลขออเดอร์) จะไปโผล่ที่ลูกค้าทุกคน → `notifyChatMessage`
  จะไม่ส่งเลยถ้าไม่มีปลายทางเจาะจง
- **`onSnapshot` ของแชทไม่มี error callback** → ถ้า query พัง (ไม่มี composite index หรือไม่มีสิทธิ์)
  แชทจะ **"ว่างเปล่าเงียบ ๆ" ตลอดไป** เหมือนอีกฝ่ายไม่ตอบ → เพิ่ม error handler + log ผ่าน
  ErrorCenter SSOT และ **แยก "โหลดไม่ได้" ออกจาก "ยังไม่มีข้อความ"** ให้ชัดบน UI
  (`console.error` เดิมใน sendMessage ก็เปลี่ยนมาใช้ ErrorCenter)
- **`firestore.indexes.json` ไม่เคยมีในโปรเจกต์** ทั้งที่ query แชท
  (`where(orderId==) + orderBy(createdAt)`) ต้องใช้ **composite index** — และเป็น
  **query เดียวในทั้งแอปที่ต้องใช้** (ตรวจแล้วทุก query) → เพิ่มไฟล์ index + ผูกใน `firebase.json`
- **ช่องโหว่ความปลอดภัย (CLAUDE.md §8): `chats` เดิมให้ "ใครก็ตามที่ล็อกอิน role ไหนก็ได้"
  อ่านแชทของ *ทุกออเดอร์*** และ create ได้โดยไม่ตรวจว่า `sender` ตรงกับ role จริง (ไรเดอร์
  ปลอมเป็น `sender:"customer"` ได้) → เขียน rules ใหม่ให้ผูกกับ **ออเดอร์ของข้อความนั้น**
  โดยใช้เกณฑ์เดียวกับ `/orders` (ลูกค้า = เบอร์ตรง, ไรเดอร์ = ถืองานนั้นอยู่, ร้าน/แอดมิน = ดูแลได้)
  และบังคับ `request.resource.data.sender == role()`
- **ปุ่มโทร**: `tel:${order.phone}` เมื่อไม่มีเบอร์ = เปิดสมุดโทรศัพท์ด้วย `tel:undefined` →
  เพิ่ม `src/telUtils.js` (SSOT) ที่ตัดช่องว่าง/ขีด (เบอร์ที่มีเว้นวรรคโทรไม่ออก) และคืน `""`
  เมื่อไม่มีเบอร์ → ปุ่มขึ้น "No Phone Number" + disabled (ตรงกับฝั่งลูกค้าที่เช็ค `riderPhone` อยู่แล้ว)

### Verified (R-05)
- `npm run build` ผ่าน; ESLint คงที่ **64 problems / 61 errors** เท่า baseline (0 error ใหม่)
- **35 เคสผ่านหมด** (รัน `telUtils` + `notificationUtils` ตัวจริง): `telHref` ครบทุกรูปแบบเบอร์
  (ขีด/เว้นวรรค/วงเล็บ/+66/ว่าง/undefined) และยืนยันว่าของเดิมได้ `tel:undefined` จริง;
  `notifyChatMessage` ส่งถูกฝั่ง-ถูก userId-ถูก actionUrl ทั้งสองทิศทาง, ไม่ยิงเมื่อยังไม่มีไรเดอร์,
  **ไม่ broadcast เมื่อไม่มีเบอร์**, และไม่ throw ทุกกรณี (การแจ้งเตือนต้องไม่ทำให้ส่งข้อความพัง)
- **ตรวจในเบราว์เซอร์จริง**: `telUtils`/`notificationUtils`/`Chat.jsx` โหลดจาก bundle จริงได้,
  guard ทุกตัวคืน `null` ไม่ throw, และหน้า customer OrderDetail import + render `<Chat>` จริง
- R-01 (25) + R-02 (24) + R-03 (27) + R-04 (31) รันซ้ำไม่ regress — **รวม 142 เคส**
- ⚠️ **`firestore.rules` ชุดใหม่ยังไม่ได้ทดสอบและยังไม่ได้ deploy** — เครื่องนี้ไม่มี
  firebase-tools และไม่มี Java จึง **รัน emulator ไม่ได้เลย** และไม่มีสิทธิ์ deploy
  → ผู้ใช้ต้องรัน `firebase deploy --only firestore:rules,firestore:indexes` เอง และแนะนำให้ลอง
  ใน **Rules Playground** ก่อน; **จนกว่าจะ deploy ช่องโหว่ยังเปิดอยู่** (โค้ดเว็บใหม่ทำงานได้
  ทั้งกับ rules เก่าและใหม่ จึง deploy Vercel ไปก่อนได้อย่างปลอดภัย)
- ⚠️ **ข้อสมมติที่ต้องยืนยันตอน deploy**: read rule เรียก `get()` อ่านออเดอร์ต่อข้อความ ซึ่งพึ่งพา
  การที่ Firestore **cache การอ่านเอกสาร path เดิมภายใน request เดียว** (query แชทกรองด้วย
  `orderId` ค่าเดียว จึงเป็น path เดียวกันทุก doc → ควรนับเป็น 1 access call) ถ้าจริงตามนี้จะไม่ชน
  ลิมิต 10 calls/query — **ถ้า deploy แล้วแชทที่มีข้อความเยอะโหลดไม่ขึ้น ให้แจ้ง** จะเปลี่ยนไปเก็บ
  `customerPhone`/`riderId` ลงบนตัวข้อความแทน (ต้องวางแผน migration ของข้อความเก่า)
- ⚠️ **ยังไม่ได้ QA ด้วยตา** — ทั้ง `/rider` และ `/shop/orders/:id` อยู่หลัง login และไม่มีบัญชีทดสอบ
  จึงยังไม่ได้เห็นแชทสองฝั่งคุยกันจริง

### Fixed (R-04 Order Status Flow — non-atomic transitions let status be overwritten/regress)
- **บั๊กหลัก: การเปลี่ยนสถานะไม่ atomic** — `orderEngine.updateOrderStatus` (ตัวเขียนสถานะ
  ตัวเดียวของทั้งระบบ ใช้จาก **16 จุด ทั้ง 4 บทบาท**) ตรวจ `order.status` จาก **snapshot ที่ค้าง
  อยู่ในเครื่องผู้เรียก** แล้ว `updateDoc` ทับลงไปตรง ๆ = read-modify-write ที่ไม่มีการกันชน
  ผลที่เกิดจริงได้ (พิสูจน์ด้วย control test):
  - **ร้านกดยกเลิกตอนไรเดอร์กด "ส่งสำเร็จ"** → การเขียนของไรเดอร์ทับทับลงไป **ออเดอร์ที่ถูกยกเลิก
    ถูกชุบชีวิตเป็น `completed`** (ร้านเห็นว่ายกเลิก ลูกค้าถูกนับว่าส่งสำเร็จ)
  - **สถานะเดินถอยหลัง** → หน้าจอร้านค้างอยู่ที่ `cooking` ทั้งที่ server ไปถึง
    `ready_for_delivery` แล้ว กดปุ่ม = ดึงกลับเป็น `cooking` **งานหายจากพูลของไรเดอร์**
    ทั้งที่อาหารเสร็จแล้ว (กราฟไม่อนุญาต แต่ตรวจกับข้อมูลค้างจึงผ่าน)
- **วิธีแก้**: `updateOrderStatus` ทำงานใน **transaction** — re-read เอกสารแล้วตรวจกับ
  **สถานะสดจาก server** ก่อนเขียนเสมอ (ทุกบทบาทได้ประโยชน์ทันทีโดยไม่ต้องแก้ call site)
  `force:true` ยังข้ามกราฟได้เหมือนเดิม (admin / bulk ของร้านใช้อยู่) แต่เขียนแบบ atomic
- **กดแล้วเงียบ**: เดิม transition ไม่ผ่าน = `console.warn` แล้ว `return` เฉย ๆ ไรเดอร์กด
  "Start Delivering"/"Delivered" แล้วไม่มีอะไรเกิดขึ้นและไม่รู้สาเหตุ → คืน `{ok, reason}`
  แล้วแสดงบนแถบ error เดิมจาก R-01 (`invalid_transition` / `terminal` / `not_found`) + กันกดซ้ำ
- **ไม่มีผู้เรียกคนไหน try/catch เลยแม้แต่จุดเดียว** (ตรวจครบทั้ง 16 จุด) → error จาก
  `updateDoc` กลายเป็น **unhandled rejection** ทุกครั้ง; ตอนนี้ engine จับเองและลง ErrorCenter SSOT
- **ไรเดอร์ใช้ `orderStateMachine.transition`** — SSOT ที่คอมเมนต์ตัวเองว่า "The ONE guarded
  transition" มี `{ok,reason}` + ตรวจ terminal ครบ **แต่ไม่เคยถูกเรียกจากที่ไหนเลย (dead code)**
  เหมือนกรณี `riderAcceptReject` ใน R-01 → ต่อสายให้ใช้จริง ไม่ได้เขียน logic ใหม่
- **แก้ `transition()` ไม่ให้รายงานผลเท็จ**: เดิม `await updateOrderStatus(...)` แล้ว
  `return {ok:true}` เสมอ — พอ engine เปลี่ยนมาคืน `{ok:false}` แทนการ throw มันจะรายงานว่า
  "สำเร็จ" ทั้งที่ถูกปฏิเสธ → ส่งต่อผลลัพธ์จาก engine ตรง ๆ (มีเทสต์คุมเคสนี้โดยเฉพาะ)
- **ผลพลอยได้ที่เป็นการแก้บั๊กจริง**: ผู้เรียกที่ส่งมาแค่ `{ id }` (`StoreLayout`/`Kitchen` ตอน
  `orders.find(...) || { id }` หาไม่เจอ) เดิม `status` เป็น `undefined` → ตรวจกราฟไม่ผ่าน →
  **ปุ่มไม่ทำงานเลย**; และถึงเขียนได้ `notifyCustomer(order.phone = undefined)` ก็แปลว่า
  **ลูกค้าไม่ได้รับแจ้ง** → ตอนนี้ transaction อ่านสถานะ+เบอร์จาก server มาเติมให้ ทำงานถูกต้อง
- **แจ้งเตือนยิงเฉพาะเมื่อ commit สำเร็จจริง** (เดิมยิงหลัง `await` โดยไม่รู้ว่าถูกปฏิเสธไหม)

### Verified (R-04)
- `npm run build` ผ่าน; ESLint คงที่ **64 problems / 61 errors** เท่า baseline (0 error ใหม่)
- **31 เคสผ่านหมด** (รัน `orderEngine` + `orderStateMachine` ตัวจริง บน in-memory Firestore ที่
  จำลอง optimistic concurrency จริง): flow ไรเดอร์ครบ (picked_up→delivering→completed),
  **เคส race ร้านยกเลิกชนไรเดอร์กดส่งสำเร็จ** (ไรเดอร์ถูกปฏิเสธ ออเดอร์ยังเป็น cancelled
  และ**ไม่มีแจ้งเตือน "จัดส่งสำเร็จ" หลุดออกไป**), กันสถานะถอยหลัง, ข้ามขั้นไม่ได้,
  same→same idempotent (กดซ้ำปลอดภัย), `force` ยังข้ามกราฟได้, แจ้งเตือนเฉพาะตอน commit,
  เคส `{id}` ล้วน, `transition()` ไม่ปั้น `{ok:true}`, และ**ไม่ throw** ทุกกรณี
- **Control test พิสูจน์บั๊กเดิมจริง 3/3**: cancelled→completed ถูกชุบชีวิต, ready_for_delivery→
  cooking เดินถอยหลัง, `{id}` ล้วนแล้วปุ่มไม่ทำงาน — รันกับโค้ดเดิมแบบ verbatim
- **ตรวจในเบราว์เซอร์จริง**: import `orderEngine`/`orderStateMachine` จาก bundle จริง →
  กราฟถูก (picked_up→delivering ✓, ข้ามขั้น ✗, cancelled→completed ✗, same→same ✓,
  สถานะไทย `ส่งให้ไรเดอร์`→picked_up ✓), `isTerminal`/`nextStates` ถูก และ `transition()`
  คืนเหตุผลมีโครงสร้าง (`invalid`/`terminal`/`invalid_transition`) โดยไม่ต้องยิง network
- ตรวจครบทั้ง 16 call site ว่าไม่มีใครใช้ค่า return แบบ truthiness (จุดเดียวที่ `return` คือ
  `acceptOrderWithETA` ซึ่งผู้เรียกทิ้งค่าไป) → เปลี่ยนจาก `undefined` เป็น `{ok,reason}` ปลอดภัย
- R-01 (25) + R-02 (24) + R-03 (27) รันซ้ำไม่ regress — **รวม 107 เคส**
- ⚠️ **ยังไม่ได้ QA ด้วยตาบนเว็บจริง** — `/rider` และ `/store` อยู่หลัง login และไม่มีบัญชีทดสอบ
  จึงไม่ได้กดปุ่มจริง โดยเฉพาะ**ฝั่ง Store ที่ได้รับผลจากการแก้ engine ด้วย** (แม้เทสต์จะยืนยันว่า
  `force`/bulk/notification ยังทำงานเหมือนเดิม) — ควรทดสอบ flow ของร้านให้ครบก่อนถือว่าปิดงาน

### Fixed / Added (R-03 Navigation — real turn-by-turn + permission / GPS / offline handling)
- **นำทางจริง (turn-by-turn)**: ลิงก์เดิม `maps/dir/?api=1&destination=..&travelmode=driving`
  เปิด Google Maps มาที่**หน้าพรีวิวเส้นทาง** ไรเดอร์ต้องกด "เริ่ม" เองอีกที → เพิ่ม
  **`dir_action=navigate`** ตาม Google Maps URLs API → กดครั้งเดียวเข้าโหมดนำทางมีเสียงทันที
  (ยังไม่ส่ง `origin` โดยตั้งใจ — ให้ Google Maps ใช้ตำแหน่งจริงของเครื่อง แม่นกว่าและไม่ต้อง
  ขอสิทธิ์ GPS ในแอปเรา; ลิงก์ https นี้เปิด "แอป" Google Maps บนมือถือได้อยู่แล้ว ไม่ต้องแยก scheme)
- **บั๊ก: ออเดอร์ที่มีแต่ที่อยู่ (ไม่มีพิกัด) กดนำทางแล้วได้หน้า "ค้นหา" ไม่ใช่ "นำทาง"** — logic เดิม
  ตกไปที่ branch `address` ซึ่ง hardcode เป็น `maps/search/?api=1&query=...` ทั้งที่อยู่ใน
  mode `navigate` → ตอนนี้สร้างเป็น `maps/dir/` + `dir_action=navigate` จากที่อยู่ (encode แล้ว)
- **ย้ายการสร้าง URL ไปที่ `location/mapsService.js` (SSOT)**: `buildNavigationUrl` /
  `buildViewUrl` / `hasCoords` — `MapButton.jsx` เหลือหน้าที่แสดงผลอย่างเดียว ไม่ประกอบ URL เอง
  → **view mode ไม่เปลี่ยนพฤติกรรมแม้แต่นิดเดียว** (Store Settings / Admin Orders / Customer
  Checkout+HelpCenter+OrderDetail / Store.jsx legacy ใช้ mode="view" ทั้งหมด)
- **จงใจคง semantics ของ `hasCoords` ไว้เหมือนเดิม** (`!Number.isNaN`) แทนที่จะเปลี่ยนไปใช้
  `Number.isFinite` เพราะบางเอกสารเก็บ lat/lng เป็น **string** — ถ้าเปลี่ยนจะทำให้ปุ่มแผนที่ของ
  ร้าน/ลูกค้าที่ข้อมูลเป็น string พังทันที
- **จัดการ "สิทธิ์ถูกปฏิเสธ / GPS ปิด / ออฟไลน์"** (เดิมพังเงียบสนิท): `useDeliveryBroadcast`
  อ่าน GPS ไม่ได้ก็แค่ log — ลูกค้าไม่เห็นไรเดอร์บนแผนที่เลย แต่**ไรเดอร์ไม่รู้ตัว** → เพิ่ม
  - `classifyGeoError` แปลง error code ตามสเปก (1=denied, 2=GPS ปิด, 3=timeout)
  - `getGeolocationPermission` / `useGeolocationStatus` อ่านสิทธิ์แบบไม่เด้ง prompt +
    ฟัง `change` เพื่ออัปเดตทันทีเมื่อผู้ใช้สลับสิทธิ์ (มี fallback เป็น `unknown` เพราะ
    **Safari/iOS ไม่มี Permissions API** — ห้าม assume denied ไม่งั้น iPhone จะขึ้นเตือนผิด ๆ)
  - `useDeliveryBroadcast` คืน `geoError` (ความจริงจากการอ่าน GPS จริง ซึ่งเป็นแหล่งเดียว
    ที่เชื่อได้บน iOS) และเคลียร์เองเมื่ออ่านได้
  - แถบเตือนบน Rider Dashboard เรียงตามความจริงมากสุด: ออฟไลน์ → error จริงจาก GPS → สิทธิ์
    จาก Permissions API พร้อมปุ่ม **Retry** ที่เด้งขอสิทธิ์จริง และบอกวิธีแก้ (เปิด GPS / อนุญาตสิทธิ์)
- **`hooks/useOnlineStatus.js` (SSOT ใหม่)** สำหรับสถานะเน็ต — ออฟไลน์แล้ว: ปุ่มนำทางขึ้น
  "ออฟไลน์ — นำทางไม่ได้" (Google Maps เปิดไม่ขึ้นอยู่ดี) และ **หยุดอ่าน GPS/เขียนพิกัด**
  (ประหยัดแบต + ไม่กองคิวเขียนไว้ยิงรัวตอนเน็ตกลับมา)

### Verified (R-03)
- `npm run build` ผ่าน; ESLint คงที่ **64 problems / 61 errors** เท่า baseline (0 error ใหม่)
- **27 เคสผ่านหมด** (รัน `mapsService.js` ตัวจริง) — เคสสำคัญสุด: เทียบ `buildViewUrl` กับ
  **โค้ด MapButton เดิมแบบ verbatim** บน 10 ชุด input → **URL เหมือนกันทุกตัว** = 4 บทบาทที่ใช้
  mode="view" ไม่ได้รับผลกระทบ; และพิสูจน์บั๊กเดิมจริง (navigate+address = `/maps/search/`)
- **ทดสอบในเบราว์เซอร์จริง**: import `mapsService` + เรียก `MapButton` ตรง ๆ แล้วตรวจ element ที่คืนมา
  → navigate = `<a>` ลิงก์ turn-by-turn, address-only = `/maps/dir/` (ไม่ใช่ `/maps/search/`),
  ออฟไลน์ = `<button disabled>` พร้อมเหตุผล, ไม่มีปลายทาง = "ไม่มีตำแหน่ง", view mode เหมือนเดิม;
  `getGeolocationPermission()` ในเบราว์เซอร์จริงคืน `"denied"` (เครื่องนี้บล็อกตำแหน่งอยู่จริง)
  = เส้นทาง permission-denied ถูกรันจริง ไม่ใช่แค่ mock
- **URL ที่สร้างใช้ได้จริง**: Google ตอบ HTTP 200 ทั้งแบบพิกัดและแบบที่อยู่
- R-01 (25) + R-02 (24) รันซ้ำแล้วไม่ regress — รวม 76 เคส
- ⚠️ **ยังไม่ได้ QA ด้วยตาบนเว็บจริง** — `/rider` อยู่หลัง login และไม่มีบัญชีไรเดอร์ จึง**ไม่ได้เห็น
  แถบเตือนจริงบนหน้า Dashboard** และไม่ได้กดปุ่มนำทางบนมือถือจริง (ตรวจได้ถึงระดับ component +
  URL + สิทธิ์จริงในเบราว์เซอร์)

### Fixed (R-02 Current Order — customer tracking froze when the rider switched tabs)
- **บั๊กหลัก: แผนที่ติดตามของลูกค้าค้างทันทีที่ไรเดอร์สลับแท็บ** — `useRiderGpsBroadcast` (ยิงพิกัด
  ทุก 5 วิ ลง `orders/{id}.riderLocation`) ฝังอยู่ใน `RiderOrderCard` แต่ Dashboard render
  **เฉพาะการ์ดของแท็บที่เลือกอยู่** พอไรเดอร์สลับจาก Active ไป Available เพื่อหางานใบถัดไป
  (พฤติกรรมปกติที่สุด) การ์ดถูก unmount → effect cleanup → **หยุดกระจายพิกัดทันที** →
  หน้า `/shop/orders/:orderId` ของลูกค้าค้างที่ตำแหน่งเดิม, ETA/ระยะทางที่เหลือค้างตาม
  ลูกค้าเห็นเหมือนไรเดอร์จอดนิ่ง ทั้งที่กำลังวิ่งอยู่ (กลับมาแท็บ Active ถึงจะเริ่มส่งใหม่)
- **วิธีแก้**: ย้ายการกระจายพิกัดขึ้นไปที่ `RiderOrdersDashboard` (`useDeliveryBroadcast`)
  ซึ่งอยู่ตลอดไม่ว่าจะเลือกแท็บไหน โดยผูกกับ `activeOrders` (งานสถานะ `delivering` ของไรเดอร์คนนี้)
  — **เงื่อนไขเดิมครบเหมือนเดิม**: ต้องออนไลน์ + สถานะ delivering + เป็นงานของตัวเอง
- **รวม logic ตำแหน่งไว้ที่ SSOT เดียว**: ย้ายเข้า `rider/riderLocationService.js` (โมดูลที่เป็น
  SSOT ของตำแหน่งไรเดอร์อยู่แล้ว) และเลิกเรียก `navigator.geolocation.getCurrentPosition` เอง
  หันไปใช้ `mapsService.getCurrentLocation()` ซึ่งเป็น wrapper SSOT ที่มี**ตัวเลือกเหมือนกันเป๊ะ**
  (`enableHighAccuracy:true, timeout:8000, maximumAge:4000`) → ไม่มี geolocation ซ้ำอีกชุด
  และ `getDestination` (fallback schema จุดส่ง) ย้ายมาที่นี่ให้การ์ด+Dashboard ใช้ตัวเดียวกัน
- **Unhandled promise rejection ทุก 5 วินาที**: เดิม `await updateDoc(...)` อยู่ใน async callback
  ของ `getCurrentPosition` โดย**ไม่มี try/catch** เขียนพลาด (สิทธิ์/ออฟไลน์) = rejection ลอยทุกรอบ
  → ตอนนี้ครอบ try/catch + log ผ่าน ErrorCenter SSOT และออเดอร์ใบหนึ่งพังไม่ทำให้ใบอื่นไม่อัปเดต
- **อ่าน GPS รอบเดียวต่อรอบ**: เดิมการ์ดแต่ละใบอ่านพิกัดแยกกัน (multi-drop = อ่าน N ครั้ง/5 วิ)
  ตอนนี้อ่านครั้งเดียวแล้วเขียนให้ทุกออเดอร์ที่กำลังส่ง
- **`markNear` ("I'm Near")**: เดิมไม่มี try/catch — เขียนพลาดจะเป็น rejection ลอย และ optimistic
  state ขึ้นว่า "Customer Notified" ทั้งที่ลูกค้าไม่เคยได้รับแจ้ง → ตอนนี้ตั้งสถานะเฉพาะเมื่อเขียน
  สำเร็จ + กันกดซ้ำ (ระหว่างส่งขึ้น "Notifying...")
- **ไม่เปลี่ยน schema / ไม่เปลี่ยนรูปร่างฟิลด์**: `orders/{id}.riderLocation` เขียนฟิลด์เดิมทุกตัว
  (lat/lng/heading/speed/updatedAt/estimatedArrival/remainingDistance) หน้าลูกค้าอ่านได้เหมือนเดิม

### Verified (R-02)
- `npm run build` ผ่าน; ESLint คงที่ **64 problems / 61 errors** เท่า baseline (0 error ใหม่)
- **ทดสอบโค้ดจริง 24 เคสผ่านหมด** (รัน `riderLocationService.js` ตัวจริง): `getDestination`
  ครบทุก schema (ใหม่/legacy/เก่าสุด/ของว่าง), `updateOrderLocation` เขียนรูปร่างถูก + ETA จาก
  OSRM + **fallback เป็นเส้นตรงเมื่อ OSRM ล่ม (ไม่ปั้น ETA ปลอม)** + ไม่ทับฟิลด์อื่นของออเดอร์
- **เคสสำคัญที่กันไว้: interval รีเซ็ตไม่รู้จบ** — การเขียน `riderLocation` ทุก 5 วิ ทำให้ order
  snapshot เด้ง → array ถูกสร้างใหม่ทุกครั้ง ถ้า effect ผูกกับ array identity ตรง ๆ interval จะถูก
  clear/set ใหม่ทุกรอบ → ผูกกับ `broadcastSignature` (id+จุดส่ง) แทน และทดสอบว่า snapshot ใหม่
  ที่เนื้อหาเดิม = signature เดิม (ไม่ restart) ส่วนจุดส่งเปลี่ยน/มีงานเพิ่ม/งานจบ = signature ใหม่
- R-01 (25 เคส) รันซ้ำแล้วไม่ regress
- ⚠️ **ยังไม่ได้ QA ด้วยตาบนเว็บจริง** — `/rider` อยู่หลัง login และ session นี้ไม่มีบัญชีไรเดอร์
  จึง**ไม่ได้ทดสอบการสลับแท็บจริงในเบราว์เซอร์** (ตรวจได้แค่ Vite compile ผ่าน, ไม่มี console error,
  ตัวเลือก geolocation ตรงกับของเดิมเป๊ะ, และ hook ถูกเรียกก่อน early return จึงไม่ผิดกฎ hooks)

### Fixed (R-01 Incoming Orders — double-accept race + silent failures)
- **บั๊กหลัก: ไรเดอร์ 2 คนรับงานใบเดียวกันได้พร้อมกัน** — `acceptDelivery` ใน
  `rider/RiderOrdersDashboard.jsx` เรียก `assignRider()` ของ orderEngine ซึ่ง **เขียน `updateDoc`
  ตรง ๆ โดยเช็คสถานะจาก snapshot ที่ค้างอยู่ในเครื่องไรเดอร์** พูลงานว่างแสดงออเดอร์ใบเดียวกัน
  ให้ไรเดอร์ทุกคน ทั้งคู่จึงเห็น "ready" แล้วเขียนทับกัน — คนกดทีหลังชนะ คนแรกโดนแย่งงานเงียบ ๆ
  ทั้งที่ UI บอกว่ารับงานสำเร็จ (ร้านเห็นชื่อไรเดอร์คนสุดท้าย แต่ไรเดอร์ 2 คนวิ่งไปรับของ)
- **วิธีแก้ — ใช้ SSOT ที่มีอยู่แล้ว ไม่เขียนใหม่**: `rider/riderAcceptReject.js` (transaction,
  re-read ออเดอร์ใน transaction แล้วเคลมต่อเมื่อยังพร้อมส่ง+ยังไม่มีคนรับ) ถูกเขียนไว้ตั้งแต่
  Phase 5.3 เพื่อกันเคสนี้โดยเฉพาะ **แต่ไม่เคยถูก import จากที่ไหนเลย (dead code)** → ต่อสายให้
  dashboard เรียก `acceptOrder` แทน `assignRider` (ฝั่ง Store ที่จ่ายงานให้ไรเดอร์ผ่าน
  `store/orderAssignment.js` ยังใช้ `assignRider` ตามเดิม ไม่กระทบ)
- **กดแล้วเงียบ**: เดิม `assignRider` เจอสถานะไม่ผ่านก็ `return` เฉย ๆ ไรเดอร์ไม่รู้ว่าเกิดอะไรขึ้น
  → map `reason` ทุกแบบเป็นข้อความ (`already_taken` = "Another rider just took this delivery.")
  แสดงบนแถบ error ที่ปิดเองได้
- **ค้างหน้า Loading ตลอดกาล**: `onSnapshot` ทั้ง 3 ตัวไม่มี error callback — สิทธิ์/เน็ตพังแล้ว
  spinner หมุนไม่จบ → เพิ่ม error handler แยกราย feed (available/mine) + log ผ่าน ErrorCenter SSOT
  (ตำแหน่งร้าน fallback ได้อยู่แล้ว จึง log เงียบไม่กวนไรเดอร์)
- **ออเดอร์สถานะไทยไม่เคยถึงไรเดอร์**: query เดิม `where("status","==","ready_for_delivery")`
  แต่ `isReadyForDelivery()` และ `firestore.rules` ตั้งใจรองรับ alias `"ส่งให้ไรเดอร์"` /
  `"กำลังจัดส่ง"` ด้วย → ตัวกรอง alias ฝั่ง client เป็น dead code เพราะออเดอร์พวกนั้นไม่เคยถูกดึงมา
  → เพิ่ม `READY_QUERY_STATUSES` (SSOT ใน `riderStatus.js`) แล้วใช้ `where("status","in",...)`
  แบบเดียวกับ Kitchen (ไม่มี orderBy จึงไม่ต้องสร้าง composite index)
- **กดซ้ำ/กดหลายใบพร้อมกัน**: เพิ่ม `busyId` — ปุ่มที่กำลังยิงขึ้น "Accepting..." ใบอื่น disabled

### Added (R-01)
- **ปุ่ม Reject บนงานในพูล** — ต่อ `rejectOrder`/`hasRejected` ที่มีอยู่แล้วใน `riderAcceptReject.js`
  (เดิมเป็น dead code เช่นกัน): ปฏิเสธแล้วออเดอร์ยังพร้อมส่ง+ว่างสำหรับไรเดอร์คนอื่นตามเดิม
  แค่ซ่อนจากพูลของคนที่กดปฏิเสธ (ฟิลด์ `rejectedBy` แบบ additive — ไม่เพิ่ม collection ใหม่
  และ `firestore.rules` เดิมอนุญาต rider เขียนออเดอร์ที่ยังพร้อมส่งอยู่แล้ว)
- เรียงพูลงานว่างด้วย `byNewest()` ให้ลำดับคงที่เหมือนแท็บอื่น (เดิมไม่เรียง = ลำดับสุ่มตาม snapshot)

### Verified (R-01)
- `npm run build` ผ่าน; ESLint คงที่ **64 problems / 61 errors** เท่า baseline เดิม (0 error ใหม่,
  0 ปัญหาในไฟล์ `rider/`)
- **ทดสอบโค้ดจริง 25 เคสผ่านหมด** — รัน `riderAcceptReject.js` ตัวจริงผ่าน in-memory Firestore
  ที่จำลอง optimistic concurrency จริง (version check + retry เหมือน SDK): เคส race 2 ไรเดอร์
  (มีคนเดียวชนะ, คนแพ้ได้ `already_taken`, ข้อมูลผู้ชนะไม่ถูกเขียนทับ), guard ครบ
  (`not_ready`/`not_found`/`invalid`/`offered_to_other`/offer หมดอายุ/idempotent), reject ครบ
- **Control test ยืนยันว่าบั๊กมีจริง**: รัน race เดิมกับ path เก่า (`assignRider`) → reproduce ได้
  ไรเดอร์ A รับงานสำเร็จ ไม่มี error แล้วถูก B เขียนทับ = ทั้งคู่คิดว่าได้งาน
- ⚠️ **ยังไม่ได้ QA ด้วยตาบนเว็บจริง** — `/rider` อยู่หลัง login และ session นี้ไม่มีบัญชีไรเดอร์
  (ตรวจแล้วว่า route redirect ไป login ถูกต้อง, Vite compile ทุกไฟล์ที่แก้ผ่าน, ไม่มี console error,
  bundle ที่ build ออกมามี path ใหม่จริง และ icon ที่เพิ่มมีอยู่จริงใน lucide-react)

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
