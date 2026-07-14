# CLAUDE.md — กฎหลักของโปรเจกต์ (Project Master Rules)

> ไฟล์นี้คือ **แหล่งอ้างอิงหลัก (Single Source of Truth)** สำหรับการทำงานทุก Session
> อ่านไฟล์นี้ให้ครบก่อนเริ่มงานเสมอ และไม่ต้องให้ผู้ใช้พิมพ์กฎซ้ำอีก

---

## 0. ภาพรวมโปรเจกต์ (Project Overview)

**LK Fried Chicken** — ระบบสั่งอาหารออนไลน์ระดับ Production
ประกอบด้วยระบบย่อย 4 บทบาท: **Customer / Store / Rider / Admin**

### Tech Stack (ตามจริงในโค้ด)
| ชั้น | เทคโนโลยี |
|------|-----------|
| Frontend | React 19 + Vite + **JavaScript (JSX)** + Tailwind CSS |
| Routing | react-router-dom v7 |
| Animation / UI | framer-motion, lucide-react |
| Maps | Leaflet + react-leaflet (OSRM / Nominatim) |
| Backend | Firebase (Authentication, Cloud Functions) |
| Database | Cloud Firestore |
| Storage | Firebase Storage |
| Notifications | LINE Official Account (Cloud Functions) |
| Payments | PromptPay QR |
| Hosting / Deploy | Vercel (frontend) + Firebase (rules, functions) |
| Version Control | GitHub |

> ⚠️ **หมายเหตุสำคัญ — ไม่ใช่ TypeScript:** แม้ผู้ใช้ระบุ Stack เป็น "TypeScript"
> แต่โค้ดจริงในปัจจุบันเป็น **JavaScript (.js / .jsx)** ทั้งหมด
> ไม่มี `tsconfig.json` และไม่มี dependency `typescript`
> ดังนั้นขั้นตอน "ตรวจ TypeScript" ให้ใช้ **ESLint** เป็นตัวตรวจ static หลักแทน
> หากในอนาคตต้องการย้ายไป TypeScript จริง ให้ถามผู้ใช้ก่อนเสมอ

---

## 1. ขั้นตอนเริ่มต้นทุก Session (Session Startup Checklist)

ทุกครั้งที่เริ่มทำงานหรือเปิด Session ใหม่ ให้ดำเนินการตามลำดับนี้ **โดยอัตโนมัติ**:

1. อ่าน `CLAUDE.md` ทั้งหมดก่อนทำงาน
2. อ่าน `TODO.md`
3. อ่าน `CHANGELOG.md`
4. ตรวจสอบสถานะ Git — `git status`
5. ตรวจสอบ Branch ปัจจุบัน — `git branch --show-current`
6. วิเคราะห์โครงสร้างโปรเจกต์ (ดูหัวข้อ §5)
7. ตรวจสอบ Error ของ ESLint (และ TypeScript หากมีในอนาคต) — `npm run lint`
8. ตรวจสอบว่าโปรเจกต์ Build ได้ — `npm run build`
9. สรุปงานค้างและแผนการทำงานให้ผู้ใช้ทราบ
10. เริ่มทำ **เฉพาะงานที่ผู้ใช้สั่ง** เท่านั้น

> ขั้นตอน 7–8 ใช้เวลาพอสมควร หากผู้ใช้ต้องการงานด่วนเฉพาะจุด ให้แจ้งและทำตามที่สั่งก่อนได้
> แต่ต้องรัน lint + build ให้ผ่านก่อน commit/push เสมอ (ดู §3)

---

## 2. กฎระหว่างทำงาน (Working Rules)

* ❌ ห้ามแก้ไขไฟล์ที่ไม่เกี่ยวข้องกับงานที่สั่ง
* ❌ ห้ามลบโค้ดโดยไม่มีเหตุผลชัดเจน
* ❌ ห้ามสร้างโค้ดซ้ำ — หากพบของเดิมให้ **Refactor / reuse** แทน
* ✅ เขียนโค้ดระดับ **Production Ready** เสมอ
* ✅ เน้น **Performance, Security, Maintainability, Scalability**
* ✅ หากข้อมูลไม่เพียงพอ **ให้ถามผู้ใช้ก่อน — ห้ามคาดเดา**
* ✅ หากพบ **Bug ให้แก้ Bug ก่อน** เพิ่ม Feature ใหม่
* ✅ ทุกหน้าต้องรองรับ **Mobile, Tablet, Desktop** (Responsive) และพร้อมใช้งานจริง
* ✅ เขียนโค้ดให้กลมกลืนกับสไตล์เดิม (naming, comment density, idiom) ของไฟล์รอบข้าง

---

## 3. กฎก่อน/หลัง Commit & Push (Git Workflow)

**กฎเด็ดขาด (Hard Rules):**
* ❌ **ห้าม Commit หาก Build ไม่ผ่าน**
* ❌ **ห้าม Push หากมี TypeScript หรือ ESLint Error** (ปัจจุบันเป็น JS → ยึด ESLint เป็นหลัก)
* ✅ **ทุก Commit ต้องมีข้อความที่สื่อความหมาย** (meaningful commit message)

**ก่อน Commit ต้องผ่านทั้งหมดนี้:**
1. `npm run build` สำเร็จ ไม่มี Error
2. `npm run lint` ผ่าน (แก้ ESLint errors ให้หมด) — และ TypeScript หากมีในอนาคต
3. Code Review ตนเอง — ตรรกะถูกต้อง ไม่มีโค้ดซ้ำ ไม่มีของหลุด

**ก่อน Push:**
* ยืนยันว่า Build สำเร็จและไม่มี Error
* ยืนยันว่าไม่มี ESLint / TypeScript Error เหลืออยู่
* อยู่บน branch ที่ถูกต้อง (ห้าม push ตรงเข้า `main` โดยไม่จำเป็น — ถ้าเป็นงานใหญ่ให้แตก branch)

**หลัง Push (ดูรายละเอียดใน §9 Deployment):**
* ตรวจสอบว่า GitHub รับ commit เรียบร้อย
* ตรวจสอบว่า Vercel Deployment สำเร็จ (และ Firebase deploy หากแก้ rules/functions)
* เปิดเว็บจริงเพื่อตรวจ Regression ก่อนถือว่างานเสร็จ

**หลังจบงานทุกครั้ง:**
* อัปเดต `TODO.md` (ปิดงานเสร็จ / เพิ่มงานค้างใหม่)
* อัปเดต `CHANGELOG.md` (บันทึกสิ่งที่เปลี่ยน พร้อมวันที่)

> รูปแบบ commit message: ใช้ conventional-style ตามของเดิม เช่น
> `feat(store): ...`, `fix(rider): ...`, `i18n(store): ...`, `chore: ...`

---

## 4. คำสั่งที่ใช้บ่อย (Common Commands)

```bash
npm run dev        # รัน dev server (Vite)
npm run build      # build production -> dist/
npm run preview    # preview production build
npm run lint       # ESLint ทั้งโปรเจกต์

# Firebase (จาก root)
firebase deploy --only firestore:rules      # deploy Firestore rules
firebase deploy --only storage              # deploy Storage rules
firebase deploy --only functions            # deploy Cloud Functions
```

> Deploy frontend: อัตโนมัติผ่าน Vercel เมื่อ push เข้า GitHub
> Firebase project (default): `food-order-system-61f13`

---

## 5. โครงสร้างโปรเจกต์ (Project Structure)

```
src/
  main.jsx                   Entry point + Router (routes ทั้งหมด, lazy-loaded)
  App.jsx                    หน้า Customer สั่งอาหาร (menu, cart, checkout)
  AuthContext.jsx            Firebase Auth state + โปรไฟล์ users/{uid}
  ProtectedRoute.jsx         Route guard ตาม role + approval-status
  firebase.js                Firebase app init (config hardcode ในไฟล์นี้)
  config.js / appConfig.js   ค่าคงที่ทั้งแอป (STORE_ID, PROMPTPAY_ID ฯลฯ)
  featureFlags.js            Feature flags
  permissions.js             ตารางสิทธิ์ตาม role
  analytics.js / errorCenter.js / healthDashboard.js / orderNoUtils.js  utilities ระดับแอป

  admin/                     Admin Control Center v2 (stats, approvals, payments, reports)
  store/                     Store Dashboard v2 (realtime orders, OrderCard, status pipeline)
  rider/                     Rider Dashboard v2 (accept/deliver flow, GPS)
  register/                  RegisterCustomer/Store/Rider (flow สมัครปัจจุบัน)
  signup/                    หน้า signup store/rider (legacy)
  login/                     Login แบบรวม (role tabs) + หน้า login ราย role + lineAuth
  pages/                     หน้า customer/ และ store/ เพิ่มเติม
  location/                  LocationPicker, DeliveryMap, MapButton, routeEngine, distance
  tracking/                  LiveMap, Rider/Customer/StoreMarker, ETABox, TrackingPanel
  payment/                   PromptPayQR, PaymentStatusBadge, paymentUtils
  notifications/             ระบบแจ้งเตือนในแอป
  components/
    customer/                Cart, FoodCard, MenuDetail, Address ฯลฯ
    store/                   ส่วนประกอบฝั่งร้าน (BannerCropper ฯลฯ)
    order/                   OrderTimeline, AuditLog, event labels
    notifications/           NotificationBell
    ui/                      Design system: Button, Card, Modal, Input, Badge, ...
  context/ hooks/ layouts/ i18n/ constants/   state, hooks, layout, แปลภาษา, ค่าคงที่

functions/
  index.js                   Cloud Functions entry (re-export)
  firebaseAdmin.js           Admin SDK bootstrap
  orderNotification.js       Firestore triggers -> LINE (8 order events)
  lineWebhook.js             Webhook endpoint (verify LINE signature)
  services/lineNotificationService.js   LINE push + retry + logging + verify

firestore.rules  storage.rules  vercel.json  firebase.json / .firebaserc
```

> รายละเอียดเพิ่มเติมของแต่ละโมดูลอยู่ใน `README.md`

### สิ่งที่ต้องรู้ก่อนแก้ (Architecture ที่มองไม่เห็นจากไฟล์เดียว)

* **Legacy vs v2 — มีโค้ด 2 ชุดต่อบทบาท:** ไฟล์ระดับ root
  (`Store.jsx`, `StoreDashboard.jsx`, `StoreMenu.jsx`, `Rider.jsx`, `RiderProfile.jsx`,
  `Admin.jsx`, `AdminDashboard.jsx`) คือ **ของเดิม (legacy)** ส่วนโฟลเดอร์
  `store/`, `rider/`, `admin/` คือ **v2 ที่ใช้งานจริง**
  → ก่อนแก้ให้เช็ก `main.jsx` ว่า route ชี้ไปชุดไหน อย่าแก้ไฟล์ที่ไม่ได้ถูก mount
* **Key ของ users คือ Firebase Auth UID เสมอ:** ทุก doc คือ `users/{auth.uid}`
  (ห้าม hardcode id เช่น `admin_0001`) และ login อ่าน `users/{auth.currentUser.uid}`
  ตรง ๆ ไม่ query ด้วย email
* **Approval flow:** Customer = `status:"active"` อัตโนมัติ; Store/Rider = `status:"pending"`
  จนแอดมินอนุมัติ; Admin สร้างมือใน Console เท่านั้น (ไม่มีหน้า self-register)
* **Cloud Functions ใช้ env vars แยกจาก frontend:** `LINE_CHANNEL_ACCESS_TOKEN`,
  `LINE_CHANNEL_SECRET`, `STORE_LINE_USER_ID`, `TRACK_BASE_URL`, `STORE_DASHBOARD_URL`
  (ตั้งก่อน `firebase deploy --only functions`) — ต่างจาก frontend ที่ config hardcode
* **ESLint 2 ชุด (`eslint.config.js`):** `src/**` = browser globals, `functions/**` = node globals
  → โค้ด functions ใช้ `process`/`Buffer` ได้ ส่วน `src/` ใช้ไม่ได้

---

## 6. ระบบหลัก 4 บทบาท (Core Systems)

| บทบาท | หน้าที่หลัก |
|-------|-------------|
| **Customer** | เลือกเมนู, ตะกร้า, เลือกที่อยู่/แผนที่, ชำระเงิน PromptPay, ติดตามออเดอร์ |
| **Store** | รับ/จัดการออเดอร์แบบ realtime, จัดการเมนู, ตั้งค่าร้าน |
| **Rider** | รับงาน, ส่งอาหาร, ติดตาม GPS |
| **Admin** | อนุมัติร้าน/ไรเดอร์, ดูสถิติ, การเงิน, รายงาน |

การเข้าถึงถูกควบคุมด้วย role + approval-status (ดู `AuthContext.jsx`, `ProtectedRoute`, `firestore.rules`)

---

## 6.1 กฎ Firestore (Database Rules)

* ❌ **ห้ามเปลี่ยน Schema โดยไม่ตรวจผลกระทบทุกระบบ**
* ✅ หากแก้ Collection / field ใด ต้องตรวจผลกระทบให้ครบทั้ง 4 บทบาท:
  **Customer / Store / Rider / Admin** (อ่าน/เขียนที่ไหนบ้าง, query ใดพัง, UI ใดต้องปรับ)
* ✅ แก้ Schema ต้องดูควบคู่กับ `firestore.rules` และ Cloud Functions ที่ trigger บน collection นั้น
* ✅ การเปลี่ยนที่ breaking ต่อข้อมูลเดิม ต้องวางแผน migration และถามผู้ใช้ก่อน

> Collection/field ที่ใช้ร่วมกันหลายบทบาท (เช่น `orders`, `users`, `stores`, `riders`)
> ให้ระวังเป็นพิเศษ — grep หา usage ทั่วทั้ง `src/` และ `functions/` ก่อนแก้

---

## 7. การจัดการ Context

* หากบทสนทนายาว หรือ Context เริ่มมากเกินไป ให้ **แนะนำผู้ใช้ใช้ `/compact`**
* งานที่ทำค้างไว้ให้บันทึกใน `TODO.md` ก่อน เพื่อไม่ให้ข้อมูลหายเมื่อ compact

---

## 8. ความปลอดภัย (Security Notes)

* ห้าม hardcode secret/credential ใหม่ลงในโค้ด — ใช้ env / config เดิม
* แก้ `firestore.rules` และ `storage.rules` ต้องระวัง ไม่เปิดสิทธิ์เกินจำเป็น
* ตรวจ signature ของ LINE webhook ให้ทำงานถูกต้องเสมอ
* ข้อมูลส่วนบุคคล/การเงินของผู้ใช้ ต้องไม่หลุดออกนอกช่องทางที่กำหนด

---

## 9. Deployment & Regression Check

หลัง Push ทุกครั้ง ต้องทำครบตามนี้ก่อนถือว่า **"งานเสร็จ"**:

1. ✅ **ตรวจ GitHub** — commit ขึ้นครบ, branch ถูกต้อง, ไม่มี CI ที่ fail (ถ้ามี)
2. ✅ **ตรวจ Vercel Deployment** — build บน Vercel สำเร็จ (status = Ready) ไม่มี build error
3. ✅ **ตรวจ Firebase deploy** (เฉพาะเมื่อแก้ `firestore.rules` / `storage.rules` / `functions/`)
4. ✅ **เปิดเว็บจริงเพื่อตรวจ Regression** — ทดสอบ flow ที่กระทบ ให้ครอบคลุมบทบาทที่เกี่ยวข้อง
   (Customer / Store / Rider / Admin) และทุก breakpoint (Mobile / Tablet / Desktop)

> ❌ ห้ามถือว่างานเสร็จหากยังไม่ได้เปิดเว็บจริงตรวจ regression
> การรัน build ผ่านอย่างเดียว **ไม่นับ** ว่าตรวจ regression แล้ว

---

_อัปเดตไฟล์นี้เมื่อกฎหรือสถาปัตยกรรมหลักเปลี่ยน — ให้ CLAUDE.md ทันสมัยเสมอ_
