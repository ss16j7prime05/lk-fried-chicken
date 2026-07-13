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
  App.jsx                    หน้า Customer สั่งอาหาร (menu, cart, checkout)
  main.jsx                   Entry point + Router
  AuthContext.jsx            Firebase Auth state + โปรไฟล์ users/{uid}
  firebase.js                Firebase app init
  config.js / appConfig.js   ค่าคงที่ทั้งแอป (STORE_ID, PromptPay ฯลฯ)
  featureFlags.js            Feature flags

  admin/                     Admin Control Center (stats, approvals, payments, reports, riders, stores)
  components/
    customer/                Cart, FoodCard, MenuDetail, Address ฯลฯ
    store/                   ส่วนประกอบฝั่งร้าน (BannerCropper ฯลฯ)
    order/                   OrderTimeline, AuditLog, event labels
    notifications/           NotificationBell
    ui/                       Design system: Button, Card, Modal, Input, Badge, ...
  context/                   CartContext, PreferencesContext
  hooks/                     useAddresses, useNotifications, useNotificationInbox
  layouts/                   CustomerLayout, StoreLayout
  location/                  LocationPicker, DeliveryMap, MapButton, routeEngine, distance
  login/                     Login แบบรวม + หน้า login ราย role + lineAuth
  i18n/translations.js       ข้อความหลายภาษา
  constants/                 ค่าคงที่ (address ฯลฯ)

functions/                   Cloud Functions (LINE OA notifications, webhook)
firestore.rules              Firestore security rules
storage.rules                Firebase Storage security rules
vercel.json                  ตั้งค่า deploy Vercel (SPA rewrites)
firebase.json / .firebaserc  ตั้งค่า Firebase
```

> รายละเอียดเพิ่มเติมของแต่ละโมดูลอยู่ใน `README.md`

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
