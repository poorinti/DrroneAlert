# D DRONE

ระบบรับแจ้งเหตุโดรนและอากาศยานสำหรับทดสอบและใช้งานภายใน โดยรับรายงานจาก Web Form/LINE LIFF และให้เจ้าหน้าที่ติดตามเหตุผ่านแผนที่แบบเรียลไทม์

## สถาปัตยกรรมปัจจุบัน

- Dashboard เจ้าหน้าที่: React + TypeScript + Vite + Tailwind + Radix UI + Framer Motion + React Leaflet + Socket.IO Client
- แบบฟอร์มผู้แจ้ง: HTML + Bootstrap 5 + Vanilla JavaScript + Leaflet
- Backend: Node.js + Express + MySQL 8 + Express Session + Socket.IO
- Deployment: Docker Compose + Caddy + phpMyAdmin + Docker Volume สำหรับ `/uploads`
- LINE: เตรียม LIFF แล้ว แต่ยังไม่รวมการตั้งค่า LINE จริงในโปรเจกต์นี้

## ความสามารถของ Dashboard

- แสดงโลโก้หลักและโลโก้รองได้ พร้อมให้ Super Admin เปลี่ยนจากหน้า Settings
- สลับ Light/Dark mode โดยจดจำโหมดไว้ในเบราว์เซอร์เครื่องนั้น
- กระดิ่งแจ้งเตือนข่าวใหม่แบบรายผู้ใช้ และแสดงจุดสีน้ำเงินสำหรับเหตุที่ยังไม่อ่าน
- หน้าเริ่มต้นแสดงเฉพาะเหตุที่กำลังดำเนินการ (`NEW`, `ACKNOWLEDGED`, `INVESTIGATING`, `VERIFIED`)
- ปุ่ม “ดำเนินการเสร็จสิ้น” เปลี่ยนเหตุเป็น `RESOLVED` และย้ายออกจากแผนที่/รายการปัจจุบันไปยังเมนู “เหตุการณ์ย้อนหลัง”

## เริ่มใช้งานในเครื่อง

1. คัดลอก `.env.example` เป็น `.env` และตั้งค่า secret/password ให้เหมาะสม
2. สร้างและเปิดบริการ

   ```bash
   docker compose up -d --build
   ```

3. สร้างบัญชีผู้ดูแล (ค่าเดโมปัจจุบันคือ `admin / admin1234`)

   ```bash
   docker compose exec app npm run create-admin -- admin admin1234
   ```

4. สร้างข้อมูล DEMO/TEST ประมาณ 20 เหตุการณ์ โดยไม่ลบข้อมูลเดิม

   ```bash
   docker compose exec app npm run seed-demo
   ```

   สคริปต์จะไม่เพิ่มข้อมูลซ้ำ หากพบรายงานที่ขึ้นต้นด้วย `DEMO-` อยู่แล้ว และสร้างข้อมูลสถานะอ่าน/ยังไม่อ่านสำหรับทดสอบบนฐานข้อมูลใหม่

## URLs

- [แบบฟอร์มแจ้งเหตุ](http://localhost/report/)
- [เข้าสู่ระบบเจ้าหน้าที่](http://localhost/login/)
- [Dashboard ศูนย์บัญชาการ](http://localhost/dashboard/)
- [Health check](http://localhost/api/health)
- phpMyAdmin: `http://127.0.0.1:8082` (เข้าถึงได้จากเครื่อง Server เท่านั้นตามค่าเริ่มต้น)

## คำสั่งตรวจสอบ

```bash
npm run check
npm run build:frontend
docker compose config --quiet
docker compose up -d --build
```

## ขอบเขตที่ยังรอ LINE จริง

ต้องกำหนด `LINE_LIFF_ID` และ `LINE_CHANNEL_ID` ใน `.env` แล้วทดสอบจาก LINE บนอุปกรณ์จริงภายหลัง ระบบข้อมูลเดโมอาจมี `LINE_LIFF` เพื่อใช้ทดสอบหน้าจอเท่านั้น ไม่ได้เชื่อมบัญชี LINE จริง
