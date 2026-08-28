# DroneAlert — SYSTEM PLAN

ระบบแจ้งเหตุพบโดรนหรืออากาศยานผ่าน LINE Official Account / LIFF และ Web Form พร้อม Dashboard แผนที่แบบ Real-time

> เป้าหมายหลัก: ทำระบบให้เรียบง่าย ใช้งานจริงง่าย ดูแลง่าย และ Deploy ผ่าน Docker Compose ได้โดยไม่ใช้เทคโนโลยีเกินความจำเป็น

---

## 1) Tech Stack ที่ใช้จริงในเวอร์ชันปัจจุบัน

- Backend: Node.js + Express.js
- Dashboard เจ้าหน้าที่: React + TypeScript + Vite + Tailwind CSS + Radix UI + Framer Motion
- แบบฟอร์มผู้แจ้ง: HTML + Bootstrap 5 + Vanilla JavaScript
- Database: MySQL 8
- Database Admin: phpMyAdmin
- Real-time: Socket.IO
- Map Dashboard: React Leaflet + OpenStreetMap
- Map แบบฟอร์มผู้แจ้ง: Leaflet + OpenStreetMap
- LINE Integration: LINE LIFF SDK (เตรียมไว้ ยังไม่เปิดใช้จริงจนกว่าจะใส่ credentials)
- Upload Storage: Local Docker Volume `/uploads`
- Login: Session + Secure Cookie
- Reverse Proxy / HTTPS: Caddy
- Deployment: Docker Compose

### สิ่งที่ยังไม่ใช้ในเวอร์ชันปัจจุบัน

- ไม่ใช้ Bot / LINE Messaging workflow
- ไม่ใช้ Next.js, Vue หรือ Redux
- ไม่ใช้ Redis
- ไม่ใช้ PostgreSQL / PostGIS
- ไม่ใช้ MinIO / S3 ในช่วงแรก
- ไม่ใช้ Microservices
- ไม่ใช้ Kubernetes

---

## 2) แนวคิดระบบ

ผู้แจ้งสามารถเข้าระบบได้ 2 ทาง

### A. ผ่าน LINE Official Account

LINE OA → กดเมนู “แจ้งพบโดรน” → เปิด LIFF → ดึงข้อมูลโปรไฟล์ LINE เท่าที่ได้รับสิทธิ์ → กรอกแบบฟอร์ม → ปักหมุด → แนบรูป → ส่งรายงาน

### B. ผ่าน Web Browser

เปิด `/report` โดยตรง → กรอกชื่อผู้แจ้งเอง → กรอกข้อมูลเหตุ → ปักหมุด → แนบรูป → ส่งรายงาน

ทั้ง 2 ช่องทางใช้ Backend, MySQL และ Dashboard ชุดเดียวกัน

---

## 3) Flow แบบฟอร์มแจ้งเหตุ

อ้างอิง flow จากแบบ “ข้อมูลพื้นฐาน → รายละเอียด → หลักฐาน”

### STEP 1 — ข้อมูลพื้นฐาน

#### ผู้รายงาน

ถ้าเข้า LIFF:

- LINE User ID
- Display Name
- Profile Picture
- Source = `LINE_LIFF`
- แสดง badge “ยืนยันผ่าน LINE”

ถ้าเข้าเว็บปกติ:

- ชื่อผู้แจ้ง — Required
- เบอร์โทร — Optional
- Email — Optional
- หน่วยงาน — Optional
- Source = `WEB`

รองรับการเลือกประเภทผู้แจ้ง:

- ไม่ระบุตัวตน
- บุคคลทั่วไป
- ระบุแบบทางการ / หน่วยงาน

> ถ้าเลือก “ไม่ระบุตัวตน” ระบบยังบันทึก technical source ที่จำเป็นต่อความปลอดภัยตามนโยบาย แต่ Dashboard ไม่แสดงตัวตนแก่ Operator โดยไม่จำเป็น

#### วัน / เวลา ตรวจพบ

- ค่าเริ่มต้นเป็นเวลาปัจจุบัน
- ผู้ใช้แก้วัน/เวลาได้
- เก็บ `occurred_at`
- เก็บเวลาส่งจริง `submitted_at` แยกกัน

#### ตำแหน่งที่พบ

รองรับ 2 แบบ

1. ใช้ตำแหน่งปัจจุบันของโทรศัพท์
2. กำหนดเองบนแผนที่

ฟังก์ชัน Map:

- ปุ่ม “ใช้ตำแหน่งของฉัน”
- แตะบนแผนที่เพื่อวางหมุด
- ลากหมุดเพื่อแก้ตำแหน่ง
- Zoom in / out
- Center to current location
- แสดง Latitude / Longitude
- แสดง GPS accuracy ถ้ามี

แยกพิกัดเป็น 2 ชุด:

- `reporter_lat`, `reporter_lng` = จุดที่คนแจ้งยืนอยู่
- `incident_lat`, `incident_lng` = จุดที่ผู้แจ้งระบุว่าเห็นโดรน

Dashboard ใช้ `incident_lat/lng` เป็นหมุดหลัก

#### สถานที่ตรวจพบ

ช่องข้อความสั้น ๆ เช่น

- หน้าสนามกีฬา
- ด้านทิศเหนือของสนามบิน
- เหนือหมู่บ้าน A
- ใกล้อาคาร B

เก็บใน `location_name`

---

### STEP 2 — รายละเอียด

#### ประเภทสิ่งที่พบ

- โดรน
- อากาศยาน
- ไม่สามารถระบุได้

ค่าฐานข้อมูล:

- `DRONE`
- `AIRCRAFT`
- `UNKNOWN`

#### รายละเอียดการบิน

ช่องกรอกแบบง่าย ไม่บังคับทุกช่อง:

- ทิศทางการบิน
- ความเร็วโดยประมาณ
- ความสูงโดยประมาณ
- ระยะห่างจากผู้พบเห็น
- จำนวนลำ
- สี / รูปร่าง / ลักษณะเด่น
- หมายเหตุอื่น ๆ

#### ระดับความเร่งด่วน

ผู้แจ้งเลือก:

- LOW
- MEDIUM
- HIGH
- CRITICAL

เก็บเป็น `reporter_severity`

Operator ใน Dashboard สามารถกำหนด `operator_severity` แยกต่างหาก เพื่อไม่ให้ระดับที่ผู้แจ้งเลือกกลายเป็นการยืนยันภัยโดยอัตโนมัติ

---

### STEP 3 — หลักฐาน

รองรับ:

- ถ่ายภาพจากกล้อง
- เลือกจาก Gallery
- Upload หลายภาพ
- Preview ก่อนส่ง
- ลบภาพก่อนส่ง

MVP กำหนด:

- สูงสุด 5 ภาพต่อรายงาน
- ขนาดรวมสูงสุด 50 MB ต่อรายงาน
- MIME: JPG / JPEG / PNG / WEBP
- Backend ตรวจ file type และ file size
- เปลี่ยนชื่อไฟล์เป็น UUID

ภาพเก็บใน Docker Volume:

```text
/uploads/reports/YYYY/MM/<uuid>.jpg
```

MySQL เก็บ path และ metadata เท่านั้น

---

### STEP 4 — ตรวจสอบก่อนส่ง

หน้า Summary แสดง:

- ผู้แจ้ง
- Source LINE / WEB
- วันเวลา
- Map + Marker
- ชื่อสถานที่
- ประเภทสิ่งที่พบ
- Severity
- รายละเอียด
- รูปทั้งหมด

ปุ่ม:

- “ย้อนกลับแก้ไข”
- “ส่งรายงาน”

หลังส่งสำเร็จ:

```text
รับรายงานเรียบร้อย
เลขที่ DRN-20260828-000123
```

---

## 4) LINE LIFF

### Flow

```text
LINE Official Account
        ↓
Rich Menu
        ↓
แจ้งพบโดรน / อากาศยาน
        ↓
LIFF /report
        ↓
DroneAlert Form
```

### ข้อมูลจาก LINE

เมื่อได้รับ permission ที่เหมาะสม สามารถใช้:

- LINE User ID
- Display Name
- Profile Picture
- Status Message (ถ้ามี)

Backend ต้อง verify token กับ LINE ก่อนเชื่อ identity

ห้ามเชื่อ `line_user_id` ที่ frontend ส่งมาเองโดยไม่ตรวจสอบ

### หมายเหตุสำคัญ

MVP นี้ **ไม่มี Chat Bot**

ไม่มี:

- Quick Reply bot flow
- Conversation State
- LINE message webhook สำหรับรับรายงาน
- Bot ถามทีละขั้น

LINE ใช้เพียงเป็นช่องทางเข้า LIFF และระบุตัวตนผู้แจ้ง

---

## 5) Dashboard

### Login

หน้า `/login`

- Username
- Password
- Remember me

ใช้ Session + Secure HTTP-only Cookie

### Role

#### SUPER_ADMIN

- จัดการ User
- ดูทุกข้อมูล
- ดู Audit Log
- Settings

#### OPERATOR

- ดูรายงาน
- เปลี่ยนสถานะ
- ปรับ severity
- เพิ่ม note

#### VIEWER

- ดู Dashboard / Map อย่างเดียว

---

## 6) Dashboard Layout

แนวคิด Map-first

```text
┌──────────────────────────────────────────────────────────────┐
│ DroneAlert       LIVE ●        Search        User / Logout   │
├───────────────┬────────────────────────────┬─────────────────┤
│ LEFT SIDEBAR  │                            │ DETAIL DRAWER   │
│               │                            │                 │
│ Overview      │                            │ ภาพเหตุ         │
│ Live Map      │            MAP             │ Report No.      │
│ Reports       │                            │ Reporter        │
│ Analytics     │        ●   ●    ●          │ Severity        │
│ Users         │             ●              │ Status          │
│ Audit         │                            │ รายละเอียด      │
│ Settings      │                            │ Timeline        │
└───────────────┴────────────────────────────┴─────────────────┘
```

### Left Sidebar

- Overview
- Live Map
- Reports
- Analytics
- Users
- Audit Log
- Settings

### Center Map

Leaflet + OpenStreetMap

Marker แยกตาม Severity

- LOW
- MEDIUM
- HIGH
- CRITICAL

รองรับ:

- Marker
- Popup
- Zoom
- Fly/Pan to report
- Marker cluster ในอนาคต

### Marker Popup

เมื่อคลิกหมุด แสดงแบบย่อ:

- Thumbnail
- Report Number
- Severity
- เวลา
- ประเภท
- ผู้แจ้ง
- ปุ่ม “ดูรายละเอียด”

### Right Detail Drawer

เมื่อกด marker หรือรายการเหตุ:

- ภาพขนาดใหญ่
- Image carousel
- Zoom image
- Report Number
- Status
- Severity
- ผู้แจ้ง
- Source LINE / WEB
- วันเวลา
- พิกัด
- ชื่อสถานที่
- รายละเอียด
- Operator note
- Timeline

เมื่อคลิกรายการด้านซ้าย Map ต้อง zoom/pan ไปยังจุดนั้น

---

## 7) Real-time

ใช้ Socket.IO

Flow:

```text
Reporter
   ↓
POST /api/reports
   ↓
Node.js / Express
   ↓
Save MySQL
   ↓
Socket.IO emit "report:new"
   ↓
Dashboard
   ↓
Marker + List + Notification ปรากฏทันที
```

Event MVP:

- `report:new`
- `report:updated`
- `report:status`
- `report:severity`

Dashboard ไม่ต้อง Refresh หน้า

---

## 8) Status Workflow

```text
NEW
 ↓
ACKNOWLEDGED
 ↓
INVESTIGATING
 ├─ VERIFIED
 │    ↓
 │  RESOLVED
 │    ↓
 │  CLOSED
 │
 └─ FALSE_ALARM
      ↓
    CLOSED
```

ทุกการเปลี่ยนสถานะต้องเก็บ history

---

## 9) MySQL Schema

### `users`

```text
id
username
email
password_hash
role
is_active
last_login_at
created_at
updated_at
```

### `reporters`

```text
id
source                 LINE_LIFF | WEB
reporter_type          ANONYMOUS | PUBLIC | OFFICIAL
line_user_id           nullable
line_display_name      nullable
line_picture_url       nullable
name                   nullable
phone                  nullable
email                  nullable
organization           nullable
created_at
updated_at
```

### `reports`

```text
id
report_no
reporter_id
source
object_type            DRONE | AIRCRAFT | UNKNOWN
reporter_severity      LOW | MEDIUM | HIGH | CRITICAL
operator_severity      nullable
status
location_name
incident_lat
incident_lng
reporter_lat           nullable
reporter_lng           nullable
gps_accuracy_m         nullable
direction              nullable
speed_estimate         nullable
altitude_estimate      nullable
distance_estimate      nullable
object_count           nullable
appearance_notes       nullable
description            nullable
occurred_at
submitted_at
created_at
updated_at
```

### `report_images`

```text
id
report_id
file_path
mime_type
file_size
sort_order
created_at
```

### `report_notes`

```text
id
report_id
user_id
note
created_at
```

### `report_history`

```text
id
report_id
user_id
action
old_value
new_value
created_at
```

### `audit_logs`

```text
id
user_id
action
entity_type
entity_id
ip_address
user_agent
created_at
```

---

## 10) API MVP — ของที่ใช้จริงปัจจุบัน

### Public / Reporter

```text
GET  /api/line/config
POST /api/line/verify
POST /api/line/clear
POST /api/reports            # multipart form + images ใน request เดียว
```

### Admin Auth

```text
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
POST /api/auth/change-password
```

### Dashboard (ต้อง Login)

```text
GET    /api/admin/reports
GET    /api/admin/reports/:id
PATCH  /api/admin/reports/:id
POST   /api/admin/reports/:id/notes
GET    /api/admin/stats
```

### Endpoint ที่ยังไม่จำเป็นใน MVP ปัจจุบัน

```text
GET/POST/PATCH /api/admin/users
GET            /api/admin/audit
GET            /api/reports/:reportNo/receipt
```

> ตาราง `users` และ `audit_logs` มีแล้ว แต่หน้า User Management / Audit Viewer สามารถทำหลังระบบรับแจ้งหลักนิ่งแล้ว

---

## 11) Project Structure

```text
DroneAlert/
├─ src/
│  ├─ server.js
│  ├─ config/
│  │  └─ database.js
│  ├─ routes/
│  │  ├─ auth.js
│  │  ├─ reports.js
│  │  ├─ users.js
│  │  └─ line.js
│  ├─ controllers/
│  ├─ middleware/
│  ├─ services/
│  │  ├─ lineService.js
│  │  └─ realtimeService.js
│  └─ utils/
│
├─ public/
│  ├─ report/
│  │  ├─ index.html
│  │  ├─ report.js
│  │  └─ report.css
│  ├─ dashboard/
│  │  ├─ index.html
│  │  ├─ dashboard.js
│  │  └─ dashboard.css
│  └─ login/
│
├─ uploads/
├─ database/
│  ├─ schema.sql
│  └─ seed.sql
├─ docs/
│  └─ SYSTEM_PLAN.md
├─ Dockerfile
├─ docker-compose.yml
├─ Caddyfile
├─ package.json
├─ .env.example
└─ README.md
```

> ในช่วงแรกสามารถเก็บ `SYSTEM_PLAN.md` ไว้ root ก่อน แล้วค่อยย้ายเข้า `docs/` เมื่อเริ่มโครงจริง

---

## 12) Docker Compose

MVP มีเพียง 4 services

```text
app
mysql
phpmyadmin
caddy
```

### app

Node.js + Express + Socket.IO

Port ภายใน 3000

### mysql

MySQL 8

ข้อมูลเก็บใน named volume

### phpmyadmin

ใช้ตรวจ / backup / import / export ฐานข้อมูล

ไม่ควร expose สู่ Internet โดยไม่มีการจำกัด IP / VPN / authentication เพิ่ม

### caddy

รับ HTTPS และ reverse proxy เข้า Node.js

---

## 13) URL ที่คาดหวัง

```text
https://drone.example.com/report
https://drone.example.com/login
https://drone.example.com/dashboard
```

phpMyAdmin ควรแยก internal URL หรือจำกัด network

---

## 14) Security MVP

ต้องมี:

- HTTPS
- Verify LINE token ที่ Backend
- Password hash ด้วย bcrypt
- HTTP-only + Secure Cookie
- Session expiration
- Login rate limit
- Upload MIME validation
- Upload size limit
- SQL parameterized query
- Role-based access
- Audit Log
- ปิด directory listing ของ uploads
- Random UUID filenames
- Database backup

---

## 15) UI Direction

### Reporter UI

Mobile-first

- ใช้มือเดียวได้
- ปุ่มใหญ่
- Progress 1 / 3, 2 / 3, 3 / 3
- Map กว้างพอให้แตะง่าย
- Upload preview ชัดเจน
- ลดช่องที่บังคับกรอก
- ให้ผู้ใช้ส่งรายงานได้เร็ว

หน้าหลัก:

```text
[ แจ้งเหตุพบโดรนหรืออากาศยาน ]

1 ข้อมูลพื้นฐาน
2 รายละเอียด
3 หลักฐาน

[ต่อไป]
```

### Dashboard UI

- สะอาด
- Map เป็นจุดเด่น
- Sidebar ซ้าย
- Detail Drawer ขวา
- Card ไม่เยอะเกินไป
- Notification เฉพาะเหตุใหม่/ระดับสูง
- รองรับจอ Desktop เป็นหลัก

### Workflow เหตุการณ์และการแจ้งเตือน (Implemented)

- Navbar รองรับโลโก้หลักและโลโก้รอง ซึ่ง Super Admin อัปโหลดแยกกันจาก Settings ได้
- Light/Dark mode เก็บค่าตามเบราว์เซอร์ด้วย `localStorage`
- `report_reads(report_id, user_id, read_at)` เก็บสถานะอ่านเป็นรายผู้ใช้ กระดิ่งจะแสดงเฉพาะเหตุที่ยังไม่อ่าน
- รายการหลักและหมุดแผนที่แสดงสถานะ `NEW`, `ACKNOWLEDGED`, `INVESTIGATING`, `VERIFIED`
- เมื่อเลือก “ดำเนินการเสร็จสิ้น” เหตุจะเป็น `RESOLVED` และย้ายไปที่เมนู “เหตุการณ์ย้อนหลัง” ซึ่งรวม `FALSE_ALARM`, `RESOLVED`, `CLOSED`

---

## 16) Build Order

### Phase 1 — Foundation

1. สร้าง Node.js project
2. Docker Compose
3. MySQL + phpMyAdmin
4. schema.sql
5. Express server
6. Session Login

### Phase 2 — Reporter

7. สร้าง `/report`
8. LINE LIFF detection/profile
9. Web identity form
10. GPS
11. Leaflet map
12. Tap / drag marker
13. Incident details
14. Image upload
15. Summary
16. Submit report

### Phase 3 — Dashboard

17. Dashboard shell
18. Live Map
19. Report list
20. Marker popup
21. Detail drawer
22. Image zoom/carousel
23. Status / severity
24. Notes / History

### Phase 4 — Realtime

25. Socket.IO
26. `report:new`
27. `report:updated`
28. Toast / marker update

### Phase 5 — Production

29. Caddy HTTPS
30. Security hardening
31. Backup
32. LINE OA Rich Menu
33. Deploy Server

---

## 17) MVP Definition of Done / สถานะปัจจุบัน

### ทำและทดสอบใน Local แล้ว

- [x] เปิดหน้าเดียวกันจาก Web ได้
- [x] Web ให้กรอกข้อมูลผู้แจ้งเองได้
- [x] เลือกไม่ระบุตัวตนได้โดยไม่บันทึก PII ของผู้แจ้ง
- [x] ระบุวัน/เวลาได้
- [x] ใช้ GPS จาก Browser ได้ในโค้ด
- [x] ปักหมุดและลากหมุดได้
- [x] กรอกชื่อสถานที่ได้
- [x] เลือก Drone / Aircraft / Unknown ได้
- [x] ใส่ทิศทาง/ความเร็ว/ความสูง/ระยะ/จำนวน/รายละเอียดได้
- [x] รองรับแนบภาพสูงสุด 5 ภาพ / 50MB รวม พร้อม validation ฝั่ง Client/Server
- [x] Submit ได้เลขรายงาน เช่น `DRN-20260828-000001`
- [x] ข้อมูลลง MySQL จริง
- [x] โครงเก็บรูปลง `/uploads` Docker Volume พร้อมป้องกันการเปิดดูโดยไม่ Login
- [x] Admin Login ได้
- [x] เปลี่ยนรหัสผ่านจาก Dashboard ได้ในโค้ด/UI
- [x] Dashboard แสดงรายงานจริง
- [x] Map แสดง Marker จริง
- [x] คลิกรายการแล้ว zoom ไป Marker
- [x] คลิก Marker แล้ว Popup ขึ้น
- [x] Detail Drawer แสดงข้อมูล / Notes / Timeline
- [x] Operator เปลี่ยน Status ได้
- [x] Operator เปลี่ยน Severity ได้
- [x] Socket.IO `report:updated` ทดสอบ Browser แบบไม่ Refresh แล้ว
- [x] `report:new` wired เข้าห้อง Dashboard เดียวกัน
- [x] มี Audit Log ขั้นพื้นฐานสำหรับ Login / เปลี่ยนรหัส
- [x] มี Login rate limit และ Public submit rate limit แบบ in-memory
- [x] Run ทั้งระบบด้วย `docker compose up -d --build`
- [x] MySQL / App / Caddy / phpMyAdmin ขึ้นผ่าน Docker
- [x] phpMyAdmin จำกัดเป็น localhost port 8082
- [x] Admin API และไฟล์หลักฐานตอบ 401 เมื่อไม่ได้ Login

### โค้ดพร้อม แต่ต้องมีค่า External ก่อนทดสอบจริง

- [ ] ตั้ง LINE LIFF ID / LINE Channel ID จริง
- [ ] เปิดหน้าแจ้งเหตุจาก LINE Official Account / LIFF บนมือถือจริง
- [ ] ทดสอบ LINE ID Token verification กับบัญชี LINE จริง
- [ ] ทดสอบ GPS permission บนมือถือจริงผ่าน HTTPS
- [ ] ทดสอบอัปโหลดภาพจากกล้องมือถือจริง end-to-end

### ก่อนขึ้น Production

- [ ] ตั้ง Domain / DNS
- [ ] ตั้ง `SITE_ADDRESS` ให้ Caddy ออก HTTPS certificate
- [ ] เปลี่ยน `SESSION_SECRET`, DB passwords และรหัส Admin
- [ ] ตั้ง LINE Rich Menu ให้ลิงก์เข้าหน้า LIFF
- [ ] ทำ Backup MySQL + uploads
- [ ] ทดสอบจากโทรศัพท์ภายนอกเครือข่าย Server

---

## 18) Architecture Summary

```text
LINE OA                    Web Browser
   │                            │
   ▼                            ▼
 LIFF /report  ────────────  /report
          │
          ▼
Node.js + Express
          │
          ├──────── MySQL 8
          │            │
          │       phpMyAdmin
          │
          ├──────── /uploads
          │
          └──────── Socket.IO
                       │
                       ▼
                   Dashboard
                   Leaflet Map
```

---

## 19) หลักการของโปรเจกต์นี้

1. ทำง่ายก่อน
2. ไม่เพิ่ม service ถ้ายังไม่จำเป็น
3. LINE ใช้ LIFF ก่อน ยังไม่มี Bot
4. ใช้ MySQL เพื่อดูแลง่ายผ่าน phpMyAdmin
5. ใช้ Local Upload ก่อน ถ้ารูปเยอะค่อยย้าย Object Storage
6. ใช้ Socket.IO เพราะเข้าใจง่ายและ realtime เพียงพอ
7. Dashboard ใช้ Leaflet เพราะเบาและตรงงาน
8. Docker Compose ต้องเป็นวิธี Deploy หลัก
9. แยก Reporter Location กับ Incident Location
10. ทุกอย่างต้องต่อยอดได้ แต่ไม่ออกแบบเกิน MVP

---

## 20) Future (ยังไม่ทำตอนนี้)

- LINE Chat Bot
- Quick Reply
- Push status ผ่าน LINE
- Marker clustering
- Heatmap
- Geofence
- Duplicate report detection
- Object Storage
- AI image classification
- Incident correlation
- Multi-organization permission

สิ่งเหล่านี้ให้เพิ่มภายหลังเมื่อ MVP ใช้งานจริงแล้วเท่านั้น
