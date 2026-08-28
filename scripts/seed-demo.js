require('dotenv').config();

const fs = require('fs');
const path = require('path');
const pool = require('../src/config/database');

const uploadRoot = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
const demoDir = path.join(uploadRoot, 'demo');
const baseDate = new Date();

const incidents = [
  ['ANONYMOUS','WEB','DRONE','LOW','NEW','ลานจอดรถอาคารผู้โดยสาร สนามบินดอนเมือง',13.9130,100.6068,'ทิศเหนือ → ใต้','ช้า','80 ม.','150 ม.',1,'โดรนสีขาวขนาดเล็ก บินผ่านแนวรั้วสนามบิน'],
  ['PUBLIC','WEB','DRONE','MEDIUM','ACKNOWLEDGED','สวนลุมพินี กรุงเทพมหานคร',13.7307,100.5418,'ตะวันออก → ตะวันตก','30 กม./ชม.','60 ม.','100 ม.',1,'พบโดรนสีดำพร้อมไฟสีเขียว บินเหนือพื้นที่ออกกำลังกาย'],
  ['OFFICIAL','LINE_LIFF','DRONE','HIGH','INVESTIGATING','สะพานพระราม 8 กรุงเทพมหานคร',13.7661,100.4955,'เหนือ → ใต้','เร็ว','120 ม.','300 ม.',2,'โดรนสองลำบินวนเหนือแม่น้ำ มีไฟกระพริบสีแดง'],
  ['PUBLIC','LINE_LIFF','AIRCRAFT','MEDIUM','VERIFIED','ชายหาดพัทยากลาง จังหวัดชลบุรี',12.9297,100.8825,'ตะวันตก → ตะวันออก','ไม่ทราบ','250 ม.','800 ม.',1,'วัตถุคล้ายอากาศยานขนาดเล็กบินตามแนวชายหาด'],
  ['ANONYMOUS','WEB','UNKNOWN','CRITICAL','NEW','คลังเชื้อเพลิง อำเภอศรีราชา จังหวัดชลบุรี',13.1636,100.9230,'ตะวันออก → ตะวันตก','เร็ว','150 ม.','250 ม.',3,'พบวัตถุบินสามลำเข้าใกล้เขตหวงห้าม'],
  ['OFFICIAL','WEB','DRONE','HIGH','INVESTIGATING','ศูนย์ราชการแจ้งวัฒนะ กรุงเทพมหานคร',13.8823,100.5648,'ตะวันตก → ตะวันออก','20 กม./ชม.','70 ม.','80 ม.',1,'โดรนสีเทาบินต่ำใกล้อาคารราชการ'],
  ['PUBLIC','LINE_LIFF','DRONE','LOW','RESOLVED','ตลาดน้ำอัมพวา จังหวัดสมุทรสงคราม',13.4245,99.9567,'ใต้ → เหนือ','ช้า','40 ม.','60 ม.',1,'โดรนถ่ายภาพเหนือคลองโดยไม่พบพฤติกรรมผิดปกติ'],
  ['PUBLIC','WEB','UNKNOWN','MEDIUM','FALSE_ALARM','วัดพระแก้ว กรุงเทพมหานคร',13.7517,100.4927,'ไม่ทราบ','ไม่ทราบ','ไม่ทราบ','200 ม.',1,'ผู้แจ้งเห็นแสงบนท้องฟ้า ภายหลังคาดว่าเป็นว่าว'],
  ['OFFICIAL','LINE_LIFF','DRONE','CRITICAL','ACKNOWLEDGED','ท่าเรือแหลมฉบัง จังหวัดชลบุรี',13.0838,100.8835,'เหนือ → ใต้','เร็ว','180 ม.','400 ม.',2,'โดรนสองลำบินอยู่เหนือพื้นที่ท่าเรือ'],
  ['ANONYMOUS','WEB','DRONE','MEDIUM','CLOSED','อุทยานประวัติศาสตร์อยุธยา',14.3563,100.5689,'ตะวันออก → ตะวันตก','ช้า','50 ม.','120 ม.',1,'โดรนถ่ายภาพเหนือโบราณสถาน'],
  ['PUBLIC','LINE_LIFF','AIRCRAFT','HIGH','VERIFIED','สนามกีฬาสมโภชเชียงใหม่ 700 ปี',18.8248,98.9640,'เหนือ → ใต้','เร็ว','300 ม.','1 กม.',1,'อากาศยานขนาดเล็กบินผ่านแนวสนามกีฬา'],
  ['OFFICIAL','WEB','DRONE','LOW','RESOLVED','มหาวิทยาลัยขอนแก่น จังหวัดขอนแก่น',16.4725,102.8234,'ตะวันตก → ตะวันออก','ช้า','55 ม.','100 ม.',1,'โดรนของฝ่ายสื่อสารได้รับอนุญาตแล้ว'],
  ['PUBLIC','WEB','UNKNOWN','MEDIUM','NEW','สถานีรถไฟหัวหิน จังหวัดประจวบคีรีขันธ์',12.5684,99.9577,'ใต้ → เหนือ','ไม่ทราบ','90 ม.','300 ม.',1,'วัตถุสีขาวลอยนิ่งเหนือสถานีรถไฟ'],
  ['ANONYMOUS','LINE_LIFF','DRONE','HIGH','INVESTIGATING','สนามบินเชียงราย',19.9523,99.8829,'ตะวันออก → ตะวันตก','เร็ว','110 ม.','500 ม.',1,'โดรนสีดำบินอยู่ใกล้แนวร่อนลง'],
  ['OFFICIAL','WEB','DRONE','CRITICAL','ACKNOWLEDGED','โรงไฟฟ้าบางปะกง จังหวัดฉะเชิงเทรา',13.5272,100.9901,'เหนือ → ใต้','เร็ว','140 ม.','250 ม.',2,'พบโดรนไม่ทราบฝ่ายเข้าใกล้รั้วโรงไฟฟ้า'],
  ['PUBLIC','LINE_LIFF','DRONE','MEDIUM','VERIFIED','สวนสาธารณะหนองประจักษ์ จังหวัดอุดรธานี',17.4134,102.7972,'ตะวันตก → ตะวันออก','ช้า','45 ม.','90 ม.',1,'โดรนถ่ายภาพกิจกรรมบริเวณสวนสาธารณะ'],
  ['PUBLIC','WEB','AIRCRAFT','LOW','CLOSED','อ่าวมาหยา จังหวัดกระบี่',7.6788,98.7649,'ใต้ → เหนือ','ปานกลาง','350 ม.','1.5 กม.',1,'อากาศยานขนาดเล็กบินผ่านนอกเขตชายฝั่ง'],
  ['ANONYMOUS','WEB','UNKNOWN','HIGH','NEW','แนวชายแดนแม่สาย จังหวัดเชียงราย',20.4327,99.8808,'ไม่ทราบ','เร็ว','200 ม.','700 ม.',2,'วัตถุบินสองลำเคลื่อนที่ข้ามแนวภูเขา'],
  ['OFFICIAL','LINE_LIFF','DRONE','MEDIUM','RESOLVED','เขื่อนภูมิพล จังหวัดตาก',17.2461,98.9708,'เหนือ → ใต้','ช้า','100 ม.','200 ม.',1,'โดรนสำรวจเขื่อนของหน่วยงานคู่สัญญา ตรวจสอบแล้ว'],
  ['PUBLIC','WEB','DRONE','HIGH','INVESTIGATING','สนามบินสุวรรณภูมิ จังหวัดสมุทรปราการ',13.6900,100.7501,'ตะวันออก → ตะวันตก','เร็ว','130 ม.','600 ม.',1,'พบโดรนสีเข้มใกล้แนวรันเวย์ฝั่งตะวันออก']
];

function svg(label, sky, accent) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><defs><linearGradient id="s" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${sky}"/><stop offset="1" stop-color="#14243a"/></linearGradient></defs><rect width="1200" height="800" fill="url(#s)"/><circle cx="980" cy="140" r="74" fill="#fff" opacity=".18"/><path d="M0 610 Q260 450 500 590 T1200 540 V800 H0Z" fill="#0a1421" opacity=".72"/><g transform="translate(600 330)" fill="${accent}"><rect x="-175" y="-16" width="350" height="32" rx="16"/><rect x="-16" y="-175" width="32" height="350" rx="16"/><circle r="46" fill="#f8fafc"/><circle r="18" fill="${accent}"/></g><text x="55" y="82" fill="white" font-family="Arial,sans-serif" font-size="38" font-weight="700">DEMO / TEST</text><text x="55" y="135" fill="white" opacity=".82" font-family="Arial,sans-serif" font-size="26">${label}</text></svg>`;
}

function prepareImages() {
  fs.mkdirSync(demoDir, { recursive: true });
  const images = [
    ['drone-blue.svg', 'ภาพสังเกตการณ์โดรน', '#3698ff', '#7dd3fc'],
    ['drone-red.svg', 'ภาพสังเกตการณ์พื้นที่สำคัญ', '#a61f36', '#fb7185'],
    ['aircraft.svg', 'ภาพสังเกตการณ์อากาศยาน', '#38638d', '#fbbf24']
  ];
  for (const [name, label, sky, accent] of images) fs.writeFileSync(path.join(demoDir, name), svg(label, sky, accent));
}

function timeFor(index) {
  const date = new Date(baseDate);
  date.setHours(date.getHours() - index * 7 - 1);
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

async function main() {
  const [existing] = await pool.query("SELECT COUNT(*) AS count FROM reports WHERE report_no LIKE 'DEMO-%'");
  if (Number(existing[0].count) > 0) {
    console.log(`Demo data already exists (${existing[0].count} reports). No changes made.`);
    await pool.end();
    return;
  }
  prepareImages();
  const [[admin]] = await pool.query("SELECT id FROM users WHERE role IN ('SUPER_ADMIN','OPERATOR') AND is_active = TRUE ORDER BY id LIMIT 1");
  if (!admin) throw new Error('Create an admin or operator before running seed-demo.');
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (let index = 0; index < incidents.length; index += 1) {
      const [reporterType, source, objectType, reporterSeverity, status, location, lat, lng, direction, speed, altitude, distance, count, description] = incidents[index];
      let reporterId;
      if (reporterType === 'ANONYMOUS') {
        const [result] = await conn.execute("INSERT INTO reporters (source, reporter_type) VALUES (?, 'ANONYMOUS')", [source]);
        reporterId = result.insertId;
      } else if (source === 'LINE_LIFF') {
        const [result] = await conn.execute(`INSERT INTO reporters (source, reporter_type, line_user_id, line_display_name, name, phone, organization) VALUES ('LINE_LIFF', ?, ?, ?, ?, ?, ?)`, [reporterType, `DEMO-LINE-${index + 1}`, `ผู้แจ้งเดโม ${index + 1}`, `ผู้แจ้งเดโม ${index + 1}`, `08${String(10000000 + index).slice(-8)}`, reporterType === 'OFFICIAL' ? `ศูนย์ปฏิบัติการเดโม ${index + 1}` : null]);
        reporterId = result.insertId;
      } else {
        const [result] = await conn.execute(`INSERT INTO reporters (source, reporter_type, name, phone, organization) VALUES ('WEB', ?, ?, ?, ?)`, [reporterType, `ผู้แจ้งเดโม ${index + 1}`, `09${String(10000000 + index).slice(-8)}`, reporterType === 'OFFICIAL' ? `หน่วยงานทดสอบ ${index + 1}` : null]);
        reporterId = result.insertId;
      }
      const occurred = timeFor(index + 1);
      const submitted = timeFor(index);
      const reportNo = `DEMO-${String(index + 1).padStart(3, '0')}`;
      const [reportResult] = await conn.execute(`INSERT INTO reports (report_no, reporter_id, source, object_type, reporter_severity, operator_severity, status, location_name, incident_lat, incident_lng, reporter_lat, reporter_lng, gps_accuracy_m, direction, speed_estimate, altitude_estimate, distance_estimate, object_count, appearance_notes, description, occurred_at, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [reportNo, reporterId, source, objectType, reporterSeverity, index % 3 === 0 ? reporterSeverity : null, status, `[DEMO] ${location}`, lat, lng, lat + 0.002, lng + 0.002, 12 + index, direction, speed, altitude, distance, count, 'ข้อมูลเดโมสำหรับทดสอบระบบ ไม่ใช่เหตุการณ์จริง', `${description} (ข้อมูล DEMO/TEST)`, occurred, submitted]);
      const reportId = reportResult.insertId;
      await conn.execute("INSERT INTO report_history (report_id, user_id, action, new_value, created_at) VALUES (?, NULL, 'REPORT_CREATED', ?, ?)", [reportId, 'DEMO/TEST', submitted]);
      if (status !== 'NEW') await conn.execute("INSERT INTO report_history (report_id, user_id, action, old_value, new_value, created_at) VALUES (?, ?, 'STATUS_CHANGED', 'NEW', ?, ?)", [reportId, admin.id, status, submitted]);
      if (index % 3 === 1) await conn.execute("INSERT INTO report_reads (report_id, user_id, read_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE read_at = VALUES(read_at)", [reportId, admin.id, submitted]);
      if (index % 4 === 0) await conn.execute("INSERT INTO report_notes (report_id, user_id, note, created_at) VALUES (?, ?, ?, ?)", [reportId, admin.id, 'หมายเหตุเดโม: ตรวจรับข้อมูลเพื่อทดสอบการแสดงผลใน Dashboard', submitted]);
      if (index % 3 === 0) {
        const filePath = index % 2 === 0 ? 'demo/drone-blue.svg' : 'demo/drone-red.svg';
        await conn.execute("INSERT INTO report_images (report_id, file_path, mime_type, file_size, sort_order) VALUES (?, ?, 'image/svg+xml', ?, 0)", [reportId, filePath, fs.statSync(path.join(uploadRoot, filePath)).size]);
        if (index % 5 === 0) await conn.execute("INSERT INTO report_images (report_id, file_path, mime_type, file_size, sort_order) VALUES (?, 'demo/aircraft.svg', 'image/svg+xml', ?, 1)", [reportId, fs.statSync(path.join(uploadRoot, 'demo/aircraft.svg')).size]);
      }
    }
    await conn.commit();
    console.log(`Created ${incidents.length} clearly marked DEMO/TEST incidents.`);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
