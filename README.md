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
- ใช้ธีมสว่างแบบเดียวเพื่อคงความอ่านง่ายและความสม่ำเสมอของหน้าปฏิบัติการ
- กระดิ่งแจ้งเตือนข่าวใหม่แบบรายผู้ใช้ และแสดงจุดสีน้ำเงินสำหรับเหตุที่ยังไม่อ่าน
- หน้าเริ่มต้นแสดงเฉพาะเหตุที่กำลังดำเนินการ (`NEW`, `ACKNOWLEDGED`, `INVESTIGATING`, `VERIFIED`)
- ปุ่ม “ดำเนินการเสร็จสิ้น” เปลี่ยนเหตุเป็น `RESOLVED` และย้ายออกจากแผนที่/รายการปัจจุบันไปยังเมนู “เหตุการณ์ย้อนหลัง”
- เลือก Current/History ได้จากตัวกรองฝั่งซ้ายแบบย่อ มีปุ่มเลื่อนวันก่อนหน้า/ถัดไป และ popover สำหรับวันเดียว ช่วงวันที่ หรือเดือน (`date`, `from/to`, `month`)
- เลือกรูปแบบแผนที่ได้ 6 แบบจากเมนู Layers บน Navbar: OpenStreetMap, Carto Light, Carto Voyager, Esri Street, Esri Satellite และ OpenTopoMap
- แผนที่มีเครื่องมือ Annotation แบบชั่วคราวในเบราว์เซอร์: หมุด, เส้นอิสระ, เส้น, ลูกศร, พื้นที่, สี่เหลี่ยม, วงกลม, ข้อความ, Callout และ Target พร้อมเลือก/ย้ายป้ายข้อความ, ยางลบ, Undo และยืนยันก่อนล้างทั้งหมด
- ปุ่มออกรายงานบน Navbar สร้าง PDF ภาษาไทยแบบทางการหรือ Excel จริงจาก MySQL รองรับรายวัน รายเดือน และช่วงวันที่ พร้อมสรุปยอด รายละเอียดเหตุ หมายเหตุ Timeline และรายการรูปภาพ

## เริ่มใช้งานในเครื่อง

1. คัดลอก `.env.example` เป็น `.env` และตั้งค่า secret/password ให้เหมาะสม
2. สร้างและเปิดบริการ

   ```bash
   docker compose up -d --build
   ```

3. สร้างบัญชีผู้ดูแลและกำหนดรหัสผ่านที่ต้องการเอง

   ```bash
   docker compose exec app npm run create-admin -- admin <your-password>
   ```

4. สร้างข้อมูล DEMO/TEST ประมาณ 20 เหตุการณ์ โดยไม่ลบข้อมูลเดิม

   ```bash
   docker compose exec app npm run seed-demo
   ```

   สคริปต์จะไม่เพิ่มข้อมูลซ้ำ หากพบรายงาน `DEMO-` ครบชุดอยู่แล้ว แต่จะรีเฟรชเฉพาะวัน/เวลาของข้อมูล DEMO ให้กระจายหลายวันและหลายเดือนสำหรับทดสอบตัวกรอง โดยไม่ลบหรือแตะข้อมูลจริง

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
