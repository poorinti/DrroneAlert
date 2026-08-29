# D DRONE

ระบบรับแจ้งเหตุโดรนและอากาศยานสำหรับทดสอบและใช้งานภายใน โดยรับรายงานจาก Web Form/LINE LIFF และให้เจ้าหน้าที่ติดตามเหตุผ่านแผนที่แบบเรียลไทม์

## สถาปัตยกรรมปัจจุบัน

- Dashboard เจ้าหน้าที่: React + TypeScript + Vite + Tailwind + Radix UI + Framer Motion + React Leaflet + Socket.IO Client
- แบบฟอร์มผู้แจ้ง: HTML + Bootstrap 5 + Vanilla JavaScript + Leaflet
- Backend: Node.js + Express + MySQL 8 + Express Session + Socket.IO
- Deployment: Docker Compose + Caddy + phpMyAdmin + Docker Volume สำหรับ `/uploads`
- LINE: เตรียม LIFF แล้ว แต่ยังไม่รวมการตั้งค่า LINE จริงในโปรเจกต์นี้
- AI Smart Fill: ใช้ Gemini API เพื่ออ่านข้อความธรรมชาติแล้วแยกลงช่องแบบฟอร์ม โดย API key เก็บเฉพาะ Backend

## AI Smart Fill (Gemini Free Tier)

หน้า `/report/` มีช่อง AI Smart Fill สำหรับพิมพ์/วางข้อมูลรวม ๆ แล้วให้ Gemini แยกเป็น field ของแบบฟอร์มเดิม ผู้ใช้ยังต้องตรวจ/แก้และกดส่งเอง AI ไม่บันทึกรายงานโดยอัตโนมัติ และจะไม่เดาพิกัด GPS จากชื่อสถานที่

ตั้งค่า Gemini API key จาก Dashboard ด้วยบัญชี Super Admin ที่ `ตั้งค่าระบบ → Gemini API Key` ได้โดยตรง ระบบไม่ส่งค่าเดิมกลับไปยัง Browser และ key ใหม่จะถูกเข้ารหัสก่อนเก็บ หากต้องเปลี่ยน key ให้วางค่าใหม่แล้วบันทึกทับได้ทันที

ค่าระบบที่ยังตั้งผ่าน `.env` ได้คือ:

```env
GEMINI_MODEL=gemini-3.5-flash-lite
AI_SMART_FILL_MAX_PER_10MIN=12
```

`GEMINI_API_KEY` ใน `.env` ยังรองรับเป็น fallback สำหรับผู้ดูแล server แต่ไม่จำเป็นสำหรับการติดตั้งปกติ

> Free Tier ของ Gemini อาจนำเนื้อหาที่ส่งไปใช้เพื่อปรับปรุงผลิตภัณฑ์ของ Google จึงไม่ควรส่งข้อมูลลับ/ข้อมูลชั้นความลับผ่าน AI Smart Fill

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

## ติดตั้งบน Ubuntu แบบคำสั่งเดียว (พอร์ต 7400)

หลังจาก clone repository ลง Ubuntu แล้ว ให้เข้าโฟลเดอร์โปรเจกต์และรันเพียงคำสั่งเดียว:

```bash
bash scripts/ubuntu-run.sh
```

สคริปต์จะทำให้อัตโนมัติ: ตรวจ/ติดตั้ง Docker และ Docker Compose, สร้าง `.env`, สุ่ม Session/Database/Settings encryption secrets, เปิด UFW TCP 7400 เมื่อ UFW ทำงานอยู่, build/start Docker stack, รอ health check และสร้างบัญชี Super Admin พร้อมรหัสแบบสุ่ม จากนั้นจะแสดง URL, IP เครื่อง Ubuntu และรหัสผู้ดูแลบนหน้าจอ

### Gemini AI Smart Fill

หลังติดตั้ง **ไม่ต้องแก้ `.env` เพื่อใส่ Gemini API key** ให้เข้า Dashboard ด้วย Super Admin → `ตั้งค่าระบบ` → `Gemini API Key` → วาง key → บันทึก ระบบจะเก็บ key แบบเข้ารหัสและหน้าเว็บจะไม่สามารถอ่าน key เดิมกลับมาได้ ถ้า key หมดหรือเปลี่ยน key ให้ลูกค้าวาง key ใหม่ในช่องเดิมแล้วบันทึกเพื่อแทนค่าของเดิมได้ทันที

`.env` ยังรองรับ `GEMINI_API_KEY` เป็น fallback สำหรับผู้ดูแล server เดิม แต่ key ที่บันทึกจาก Dashboard จะถูกใช้ก่อนค่าใน `.env`

ระบบ publish เฉพาะ Web entry point ที่ `0.0.0.0:7400` ส่วน MySQL และ application port 3000 ไม่เปิดออกสู่ host โดยตรง และ phpMyAdmin ยังคง bind เฉพาะ `127.0.0.1:8082`

เมื่ออัปเดตโค้ดภายหลัง ใช้:

```bash
git pull
bash scripts/ubuntu-run.sh
```

ค่าหลักสำหรับการ deploy อยู่ใน `.env`:

```env
PUBLIC_BIND=0.0.0.0
PUBLIC_PORT=7400
SESSION_COOKIE_SECURE=false
```

`SESSION_COOKIE_SECURE=false` ใช้สำหรับการเข้าผ่าน `http://IP:7400` โดยตรง ถ้าภายหลังมี HTTPS/reverse proxy ที่ส่ง HTTPS มาถึง Caddy ให้เปลี่ยนเป็น `true`

### MikroTik Port Forward

Forward TCP จาก WAN port `7400` ไปยัง `UBUNTU_LAN_IP:7400` ตัวอย่างเช่น Ubuntu มี IP `192.168.88.20` ให้ตั้ง dst-nat เป็น `TCP 7400 -> 192.168.88.20:7400`

> การ forward แบบนี้เป็น HTTP และข้อมูล login จะไม่ถูกเข้ารหัสบนอินเทอร์เน็ต ถ้าใช้งานนอกเครือข่ายจริงเป็นระยะยาว ควรวาง HTTPS/VPN ด้านหน้า

## เริ่มใช้งานแบบ Manual / Development

1. คัดลอก `.env.example` เป็น `.env`
2. สร้างและเปิดบริการด้วย `docker compose up -d --build`
3. สร้างผู้ดูแลด้วย `docker compose exec app npm run create-admin -- admin <your-password>`
4. ถ้าต้องการข้อมูล DEMO/TEST ใช้ `docker compose exec app npm run seed-demo` โดยสคริปต์จะไม่ลบข้อมูลจริง

## URLs บน Ubuntu

- แบบฟอร์มแจ้งเหตุ: `http://UBUNTU_LAN_IP:7400/report/`
- เข้าสู่ระบบเจ้าหน้าที่: `http://UBUNTU_LAN_IP:7400/login/`
- Dashboard: `http://UBUNTU_LAN_IP:7400/dashboard/`
- Health check: `http://UBUNTU_LAN_IP:7400/api/health`
- phpMyAdmin: `http://127.0.0.1:8082` (เฉพาะเครื่อง Server)

## คำสั่งตรวจสอบ

```bash
npm run check
npm run build:frontend
docker compose config --quiet
docker compose up -d --build
```

## ขอบเขตที่ยังรอ LINE จริง

ต้องกำหนด `LINE_LIFF_ID` และ `LINE_CHANNEL_ID` ใน `.env` แล้วทดสอบจาก LINE บนอุปกรณ์จริงภายหลัง ระบบข้อมูลเดโมอาจมี `LINE_LIFF` เพื่อใช้ทดสอบหน้าจอเท่านั้น ไม่ได้เชื่อมบัญชี LINE จริง
