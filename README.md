# DroneAlert

ระบบแจ้งเหตุพบโดรนหรืออากาศยานผ่าน LINE LIFF / Web Form และ Dashboard แผนที่แบบ Real-time

## Stack

- Node.js + Express
- MySQL 8
- phpMyAdmin
- Socket.IO
- Leaflet + OpenStreetMap
- Bootstrap + Vanilla JavaScript
- LINE LIFF
- Caddy
- Docker Compose

## เริ่มต้นแบบ Local

1. Copy `.env.example` เป็น `.env`
2. เปลี่ยน password / secret ใน `.env`
3. รัน `docker compose up -d --build`
4. สร้างบัญชี admin ครั้งแรก:
   `docker compose exec app npm run create-admin -- admin <รหัสผ่านที่ต้องการ>`

## URLs

- `http://localhost/report/` แบบฟอร์มแจ้งเหตุ
- `http://localhost/login/` Login เจ้าหน้าที่
- `http://localhost/dashboard/` Dashboard
- `http://localhost/api/health` Health check
- phpMyAdmin: `http://127.0.0.1:8082` จากเครื่อง Server เท่านั้นในค่าเริ่มต้น

## Production

- ตั้งค่า `SITE_ADDRESS=drone.example.com` ใน `.env` แล้วชี้ DNS มาที่ Server
- ใช้ HTTPS ผ่าน Caddy
- เปลี่ยน `SESSION_SECRET`, DB password และรหัส admin ทุกค่า
- ไม่เปิด phpMyAdmin สู่ Internet โดยตรง
- รูปหลักฐานอยู่ใน Docker volume และเข้าดูผ่าน session ของเจ้าหน้าที่

อ่านรายละเอียดทั้งหมดที่ `SYSTEM_PLAN.md`
