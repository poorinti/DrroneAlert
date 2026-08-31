const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const sharp = require('sharp');
const pool = require('../config/database');
const coordinates = require('../../public/assets/coordinates');

const uploadRoot = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads'));
const regularFont = process.env.PDF_THAI_FONT_REGULAR || '/usr/share/fonts/tlwg/Garuda.otf';
const boldFont = process.env.PDF_THAI_FONT_BOLD || '/usr/share/fonts/tlwg/Garuda-Bold.otf';
const thaiMonths = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

const labels = {
  object: { DRONE: 'โดรน', AIRCRAFT: 'อากาศยาน', UNKNOWN: 'ไม่สามารถระบุ' },
  severity: { LOW: 'ต่ำ', MEDIUM: 'ปานกลาง', HIGH: 'สูง', CRITICAL: 'วิกฤต' },
  status: { NEW: 'ใหม่', ACKNOWLEDGED: 'รับทราบแล้ว', INVESTIGATING: 'กำลังตรวจสอบ', VERIFIED: 'ยืนยันแล้ว', FALSE_ALARM: 'ไม่ใช่เหตุจริง', RESOLVED: 'ดำเนินการเสร็จสิ้น', CLOSED: 'ปิดเหตุ' },
  reporter: { ANONYMOUS: 'ไม่ระบุตัวตน', PUBLIC: 'บุคคลทั่วไป', OFFICIAL: 'หน่วยงาน' },
  source: { WEB: 'เว็บไซต์', LINE_LIFF: 'LINE' },
  action: { REPORT_CREATED: 'รับแจ้งเหตุ', STATUS_CHANGED: 'เปลี่ยนสถานะ', SEVERITY_CHANGED: 'ปรับระดับ', NOTE_ADDED: 'เพิ่มหมายเหตุ', PUBLIC_MESSAGE_ADDED: 'ส่งข้อความถึงผู้รายงาน' },
};

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

function parsePeriod(query) {
  const date = String(query.date || '').trim();
  const month = String(query.month || '').trim();
  const from = String(query.from || '').trim();
  const to = String(query.to || '').trim();
  const modes = [Boolean(date), Boolean(month), Boolean(from || to)].filter(Boolean).length;
  if (modes !== 1) throw Object.assign(new Error('กรุณาเลือกช่วงข้อมูลหนึ่งรูปแบบ'), { statusCode: 400 });
  if (date) {
    if (!validDate(date)) throw Object.assign(new Error('รูปแบบวันที่ไม่ถูกต้อง'), { statusCode: 400 });
    return { type: 'daily', date, suffix: date, label: `ประจำวัน ${formatThaiDateString(date)}`, sql: 'DATE(r.occurred_at) = ?', params: [date] };
  }
  if (month) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw Object.assign(new Error('รูปแบบเดือนไม่ถูกต้อง'), { statusCode: 400 });
    const [year, monthNumber] = month.split('-').map(Number);
    return { type: 'monthly', month, suffix: month, label: `ประจำเดือน ${thaiMonths[monthNumber - 1]} ${year + 543}`, sql: "DATE_FORMAT(r.occurred_at, '%Y-%m') = ?", params: [month] };
  }
  if (!from || !to || !validDate(from) || !validDate(to) || from > to) throw Object.assign(new Error('ช่วงวันที่ไม่ถูกต้อง'), { statusCode: 400 });
  return { type: 'range', from, to, suffix: `${from}_to_${to}`, label: `ช่วงวันที่ ${formatThaiDateString(from)} - ${formatThaiDateString(to)}`, sql: 'DATE(r.occurred_at) BETWEEN ? AND ?', params: [from, to] };
}

function formatThaiDateString(value) {
  const [year, month, day] = value.split('-').map(Number);
  return `${day} ${thaiMonths[month - 1]} ${year + 543}`;
}

function formatBuddhistNumericDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year + 543}`;
}

function formatDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value));
}

function formatTime(value) {
  if (!value) return '-';
  return `${new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value))} น.`;
}

function formatGeneratedAt(value = new Date()) {
  return new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'long', timeStyle: 'short' }).format(value);
}

function safeUploadPath(relativePath) {
  if (!relativePath) return null;
  const resolved = path.resolve(uploadRoot, String(relativePath).replaceAll('/', path.sep));
  if (resolved !== uploadRoot && !resolved.startsWith(`${uploadRoot}${path.sep}`)) return null;
  return fs.existsSync(resolved) ? resolved : null;
}

function groupRows(rows, key) {
  const grouped = new Map();
  for (const row of rows) {
    const id = Number(row[key]);
    if (!grouped.has(id)) grouped.set(id, []);
    grouped.get(id).push(row);
  }
  return grouped;
}

async function loadExportData(period) {
  const [settingsRows] = await pool.query("SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('app_title','organization_name','app_logo_path','secondary_logo_path')");
  const settings = { app_title: 'D DRONE', organization_name: 'ศูนย์ควบคุมและเฝ้าระวังอากาศยาน', app_logo_path: '', secondary_logo_path: '' };
  for (const row of settingsRows) settings[row.setting_key] = row.setting_value || '';

  const [reports] = await pool.execute(
    `SELECT r.*, rp.reporter_type, rp.line_display_name, rp.name AS reporter_name,
            rp.phone, rp.email AS reporter_email, rp.organization,
            (SELECT COUNT(*) FROM report_images ri WHERE ri.report_id = r.id) AS image_count,
            (SELECT COUNT(*) FROM report_notes rn WHERE rn.report_id = r.id) AS note_count,
            (SELECT MIN(read_at) FROM report_reads rr WHERE rr.report_id = r.id) AS first_read_at
     FROM reports r
     LEFT JOIN reporters rp ON rp.id = r.reporter_id
     WHERE ${period.sql}
     ORDER BY r.occurred_at ASC, r.id ASC`,
    period.params
  );
  if (!reports.length) throw Object.assign(new Error('ไม่พบเหตุการณ์ในช่วงเวลาที่เลือก'), { statusCode: 404 });

  const ids = reports.map((report) => Number(report.id));
  const placeholders = ids.map(() => '?').join(',');
  const [images] = await pool.execute(`SELECT id, report_id, file_path, mime_type, sort_order FROM report_images WHERE report_id IN (${placeholders}) ORDER BY report_id, sort_order, id`, ids);
  const [notes] = await pool.execute(`SELECT n.report_id, n.note, n.created_at, u.username FROM report_notes n JOIN users u ON u.id = n.user_id WHERE n.report_id IN (${placeholders}) ORDER BY n.report_id, n.created_at`, ids);
  const [history] = await pool.execute(`SELECT h.report_id, h.action, h.old_value, h.new_value, h.created_at, u.username FROM report_history h LEFT JOIN users u ON u.id = h.user_id WHERE h.report_id IN (${placeholders}) ORDER BY h.report_id, h.created_at`, ids);
  const imageGroups = groupRows(images, 'report_id');
  const noteGroups = groupRows(notes, 'report_id');
  const historyGroups = groupRows(history, 'report_id');
  return { settings, period, reports: reports.map((report) => ({ ...report, images: imageGroups.get(Number(report.id)) || [], notes: noteGroups.get(Number(report.id)) || [], history: historyGroups.get(Number(report.id)) || [] })) };
}

function countBy(reports, key, values) {
  return Object.fromEntries(values.map((value) => [value, reports.filter((report) => (report[key] || 'UNKNOWN') === value).length]));
}

function summaries(reports) {
  const imageCount = reports.reduce((total, report) => total + Number(report.image_count || 0), 0);
  const finished = new Set(['FALSE_ALARM','RESOLVED','CLOSED']);
  const locationCounts = new Map();
  for (const report of reports) {
    const location = String(report.location_name || '').trim();
    if (location) locationCounts.set(location, (locationCounts.get(location) || 0) + 1);
  }
  return {
    total: reports.length,
    active: reports.filter((report) => !finished.has(report.status)).length,
    finished: reports.filter((report) => finished.has(report.status)).length,
    reportsWithImages: reports.filter((report) => Number(report.image_count) > 0).length,
    imageCount,
    object: countBy(reports, 'object_type', ['DRONE','AIRCRAFT','UNKNOWN']),
    severity: Object.fromEntries(['LOW','MEDIUM','HIGH','CRITICAL'].map((value) => [value, reports.filter((report) => (report.operator_severity || report.reporter_severity) === value).length])),
    status: countBy(reports, 'status', ['NEW','ACKNOWLEDGED','INVESTIGATING','VERIFIED','FALSE_ALARM','RESOLVED','CLOSED']),
    reporter: countBy(reports, 'reporter_type', ['ANONYMOUS','PUBLIC','OFFICIAL']),
    source: countBy(reports, 'source', ['WEB','LINE_LIFF']),
    locations: [...locationCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'th')).slice(0, 5),
  };
}

async function normalizedImage(relativePath, width = 1200) {
  const filePath = safeUploadPath(relativePath);
  if (!filePath) return null;
  try { return await sharp(filePath).rotate().resize({ width, withoutEnlargement: true }).png().toBuffer(); }
  catch (error) { console.warn('export image skipped:', relativePath, error.message); return null; }
}

function reporterName(report) {
  if (report.reporter_type === 'ANONYMOUS') return 'ไม่ระบุตัวตน';
  return report.line_display_name || report.reporter_name || 'ไม่ระบุชื่อ';
}

function display(value, fallback = '-') { return value === null || value === undefined || value === '' ? fallback : String(value); }

function pdfText(value, fallback = '-') {
  return display(value, fallback)
    .replaceAll('↗', ' ตะวันออกเฉียงเหนือ ')
    .replaceAll('↘', ' ตะวันออกเฉียงใต้ ')
    .replaceAll('↙', ' ตะวันตกเฉียงใต้ ')
    .replaceAll('↖', ' ตะวันตกเฉียงเหนือ ')
    .replaceAll('↕', ' เหนือ-ใต้ ')
    .replaceAll('↔', ' ตะวันออก-ตะวันตก ')
    .replaceAll('→', ' ไปทาง ')
    .replaceAll('←', ' มาจาก ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function timelineText(item) {
  const action = labels.action[item.action] || item.action;
  if (item.action === 'STATUS_CHANGED') return `${action}เป็น ${labels.status[item.new_value] || display(item.new_value)}`;
  if (item.action === 'SEVERITY_CHANGED') return `${action}เป็น ${labels.severity[item.new_value] || display(item.new_value)}`;
  if (item.action === 'NOTE_ADDED') return action;
  return action;
}

async function buildPdf(data) {
  const summary = summaries(data.reports);
  const primaryLogo = await normalizedImage(data.settings.app_logo_path, 320);
  const secondaryLogo = await normalizedImage(data.settings.secondary_logo_path, 320);
  const systemName = data.settings.app_title || 'D DRONE';
  const doc = new PDFDocument({ size: 'A4', margins: { top: 56, bottom: 52, left: 46, right: 46 }, bufferPages: true, info: { Title: `${systemName} - ${data.period.label}`, Author: data.settings.organization_name || systemName } });
  doc.registerFont('Thai', regularFont);
  doc.registerFont('ThaiBold', boldFont);
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  const output = new Promise((resolve, reject) => { doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject); });
  const pageWidth = doc.page.width;
  const contentWidth = pageWidth - 92;
  const blue = '#1676d2';
  const graphite = '#263342';
  const muted = '#64748b';
  const pale = '#eef5fb';
  const line = '#dbe5ee';

  function newPage() { doc.addPage(); doc.y = 56; }
  function ensureSpace(height) { if (doc.y + height > doc.page.height - 58) { newPage(); return true; } return false; }
  function sectionTitle(text) { ensureSpace(30); doc.moveDown(.3).font('ThaiBold').fontSize(12).fillColor(graphite).text(text); doc.moveDown(.25); doc.strokeColor(line).moveTo(46, doc.y).lineTo(pageWidth - 46, doc.y).stroke(); doc.moveDown(.5); }
  function metric(x, y, width, value, label) { doc.roundedRect(x, y, width, 55, 10).fill(pale); doc.font('ThaiBold').fontSize(20).fillColor(blue).text(String(value), x + 12, y + 8, { width: width - 24 }); doc.font('Thai').fontSize(8.5).fillColor(muted).text(label, x + 12, y + 35, { width: width - 24 }); }
  function summaryList(title, values, labelMap, x, y, width) { doc.font('ThaiBold').fontSize(9.5).fillColor(graphite).text(title, x, y); let nextY = y + 18; for (const [key, value] of Object.entries(values)) { doc.font('Thai').fontSize(8.5).fillColor(muted).text(labelMap[key] || key, x, nextY, { width: width - 34 }); doc.font('ThaiBold').fillColor(graphite).text(String(value), x + width - 28, nextY, { width: 28, align: 'right' }); nextY += 14; } return nextY; }
  function field(label, value, x, y, width) { const safeValue = pdfText(value); doc.font('ThaiBold').fontSize(8).fillColor(muted).text(label, x, y, { width }); doc.font('Thai').fontSize(9.2); const used = doc.heightOfString(safeValue, { width }); doc.fillColor(graphite).text(safeValue, x, y + 12, { width }); return Math.max(27, used + 14); }

  if (primaryLogo) doc.image(primaryLogo, 46, 44, { fit: [65, 52], align: 'left', valign: 'center' });
  if (secondaryLogo) doc.image(secondaryLogo, pageWidth - 111, 44, { fit: [65, 52], align: 'right', valign: 'center' });
  doc.font('ThaiBold').fontSize(17).fillColor(blue).text(data.settings.app_title || 'D DRONE', 125, 48, { width: pageWidth - 250, align: 'center' });
  doc.font('Thai').fontSize(8.5).fillColor(muted).text(data.settings.organization_name, 125, 72, { width: pageWidth - 250, align: 'center' });
  doc.y = 122;
  doc.font('ThaiBold').fontSize(20).fillColor(graphite).text('รายงานสรุปการตรวจพบโดรนและอากาศยาน', { align: 'center' });
  doc.moveDown(.4).font('Thai').fontSize(11).fillColor(blue).text(data.period.label, { align: 'center' });
  doc.moveDown(.4).fontSize(8).fillColor(muted).text(`สร้างรายงานเมื่อ ${formatGeneratedAt()}`, { align: 'center' });
  const metricY = 215;
  const metricGap = 8;
  const metricWidth = (contentWidth - metricGap * 3) / 4;
  metric(46, metricY, metricWidth, summary.total, 'เหตุทั้งหมด');
  metric(46 + (metricWidth + metricGap), metricY, metricWidth, summary.active, 'กำลังดำเนินการ');
  metric(46 + (metricWidth + metricGap) * 2, metricY, metricWidth, summary.finished, 'เสร็จสิ้นแล้ว');
  metric(46 + (metricWidth + metricGap) * 3, metricY, metricWidth, summary.imageCount, 'รูปภาพทั้งหมด');
  doc.font('Thai').fontSize(8).fillColor(muted).text(`รายงานที่มีภาพประกอบ ${summary.reportsWithImages} เหตุ`, 46, metricY + 62, { width: contentWidth, align: 'right' });
  doc.y = 292;
  doc.font('ThaiBold').fontSize(12).fillColor(graphite).text('บทสรุปผู้บริหาร');
  doc.strokeColor(line).moveTo(46, 313).lineTo(pageWidth - 46, 313).stroke();
  const colGap = 24;
  const colWidth = (contentWidth - colGap) / 2;
  let leftY = summaryList('ประเภทวัตถุ', summary.object, labels.object, 46, 327, colWidth);
  leftY = summaryList('ระดับความรุนแรง', summary.severity, labels.severity, 46, leftY + 11, colWidth);
  leftY = summaryList('ประเภทผู้แจ้ง', summary.reporter, labels.reporter, 46, leftY + 11, colWidth);
  let rightY = summaryList('สถานะ', summary.status, labels.status, 46 + colWidth + colGap, 327, colWidth);
  rightY = summaryList('แหล่งข้อมูล', summary.source, labels.source, 46 + colWidth + colGap, rightY + 11, colWidth);
  doc.font('ThaiBold').fontSize(9.5).fillColor(graphite).text('พื้นที่ที่มีการแจ้งเหตุสูงสุด', 46 + colWidth + colGap, rightY + 11);
  let locationY = rightY + 29;
  if (summary.locations.length) for (const [index, item] of summary.locations.entries()) { doc.font('Thai').fontSize(8.3).fillColor(muted).text(`${index + 1}. ${item[0]}`, 46 + colWidth + colGap, locationY, { width: colWidth - 36, ellipsis: true }); doc.font('ThaiBold').fillColor(graphite).text(`${item[1]} ครั้ง`, pageWidth - 46 - 45, locationY, { width: 45, align: 'right' }); locationY += 14; }
  else doc.font('Thai').fontSize(8.3).fillColor(muted).text('ไม่มีข้อมูลสถานที่', 46 + colWidth + colGap, locationY);

  newPage();
  for (const [index, report] of data.reports.entries()) {
    ensureSpace(175);
    const headerY = doc.y;
    doc.roundedRect(46, headerY, contentWidth, 43, 9).fill(index % 2 ? '#f6f9fc' : pale);
    doc.font('ThaiBold').fontSize(9).fillColor(blue).text(`เหตุที่ ${String(index + 1).padStart(2, '0')}`, 58, headerY + 8);
    doc.font('ThaiBold').fontSize(13).fillColor(graphite).text(report.report_no, 58, headerY + 21);
    doc.font('Thai').fontSize(8.5).fillColor(muted).text(`${formatDate(report.occurred_at)}  ${formatTime(report.occurred_at)}`, pageWidth - 240, headerY + 15, { width: 182, align: 'right' });
    doc.y = headerY + 56;
    const half = (contentWidth - 18) / 2;
    let rowY = doc.y;
    const rows = [
      [['สถานที่', report.location_name], ['พิกัด GPS / MGRS', coordinates.pairText(report.incident_lat, report.incident_lng)]],
      [['ผู้แจ้ง', reporterName(report)], ['ประเภทผู้แจ้ง', labels.reporter[report.reporter_type] || display(report.reporter_type)]],
      [['หน่วยงาน', report.reporter_type === 'ANONYMOUS' ? '-' : report.organization], ['แหล่งข้อมูล', labels.source[report.source] || report.source]],
      [['สิ่งที่พบ', labels.object[report.object_type] || report.object_type], ['จำนวน', report.object_count ? `${report.object_count} ลำ` : '-']],
      [['ระดับจากผู้แจ้ง', labels.severity[report.reporter_severity] || report.reporter_severity], ['ระดับเจ้าหน้าที่', labels.severity[report.operator_severity] || '-']],
      [['สถานะ', labels.status[report.status] || report.status], ['ทิศทาง', report.direction]],
      [['ความเร็วโดยประมาณ', report.speed_estimate], ['ความสูงโดยประมาณ', report.altitude_estimate]],
      [['ระยะห่างโดยประมาณ', report.distance_estimate], ['ติดต่อ', report.reporter_type === 'ANONYMOUS' ? '-' : [report.phone, report.reporter_email].filter(Boolean).join(' / ')]],
    ];
    for (const pair of rows) {
      if (ensureSpace(34)) rowY = doc.y;
      const h1 = field(pair[0][0], pair[0][1], 46, rowY, half);
      const h2 = field(pair[1][0], pair[1][1], 46 + half + 18, rowY, half);
      rowY += Math.max(h1, h2) + 4;
      doc.y = rowY;
    }
    for (const [title, value] of [['ลักษณะที่พบ', report.appearance_notes], ['รายละเอียด', report.description]]) {
      if (!value) continue;
      ensureSpace(45);
      doc.font('ThaiBold').fontSize(8).fillColor(muted).text(title, 46, doc.y, { width: contentWidth });
      doc.moveDown(.2).font('Thai').fontSize(9).fillColor(graphite).text(pdfText(value), { width: contentWidth });
      doc.moveDown(.5);
    }
    if (report.notes.length) {
      sectionTitle('หมายเหตุเจ้าหน้าที่');
      for (const note of report.notes) { ensureSpace(34); doc.font('Thai').fontSize(8.8).fillColor(graphite).text(`• ${pdfText(note.note)}`, { width: contentWidth }); doc.font('Thai').fontSize(7.5).fillColor(muted).text(`${pdfText(note.username)} · ${formatDate(note.created_at)} ${formatTime(note.created_at)}`); doc.moveDown(.35); }
    }
    sectionTitle('ลำดับการดำเนินงาน');
    const timeline = [...report.history];
    if (report.first_read_at) timeline.push({ action: 'FIRST_READ', created_at: report.first_read_at, username: null });
    timeline.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    if (timeline.length) for (const item of timeline) {
      ensureSpace(20);
      const text = item.action === 'FIRST_READ' ? 'เจ้าหน้าที่เปิดอ่าน' : timelineText(item);
      const timelineY = doc.y;
      const timelineBody = `${pdfText(text)}${item.username ? ` · ${pdfText(item.username)}` : ''}`;
      doc.font('ThaiBold').fontSize(8).fillColor(blue).text(formatTime(item.created_at).replace(' น.', ''), 46, timelineY, { width: 48 });
      doc.font('Thai').fontSize(8).fillColor(graphite);
      const timelineHeight = doc.heightOfString(timelineBody, { width: contentWidth - 52 });
      doc.text(timelineBody, 98, timelineY, { width: contentWidth - 52 });
      doc.y = timelineY + Math.max(14, timelineHeight + 3);
    }
    else doc.font('Thai').fontSize(8.5).fillColor(muted).text('ไม่มีข้อมูล Timeline');
    if (report.images.length) {
      sectionTitle(`ภาพประกอบเหตุการณ์ (${report.images.length})`);
      const imageGap = 10;
      const imageWidth = (contentWidth - imageGap) / 2;
      for (let imageIndex = 0; imageIndex < report.images.length; imageIndex += 2) {
        ensureSpace(145);
        const imageY = doc.y;
        for (let column = 0; column < 2; column += 1) {
          const image = report.images[imageIndex + column];
          if (!image) continue;
          const x = 46 + column * (imageWidth + imageGap);
          doc.roundedRect(x, imageY, imageWidth, 128, 7).fill('#f1f5f9');
          const buffer = await normalizedImage(image.file_path);
          if (buffer) doc.image(buffer, x + 5, imageY + 5, { fit: [imageWidth - 10, 105], align: 'center', valign: 'center' });
          else doc.font('Thai').fontSize(8).fillColor(muted).text('ไม่สามารถแสดงรูปภาพนี้', x + 8, imageY + 48, { width: imageWidth - 16, align: 'center' });
          doc.font('Thai').fontSize(7).fillColor(muted).text(`ภาพที่ ${imageIndex + column + 1}`, x + 8, imageY + 112, { width: imageWidth - 16, align: 'center' });
        }
        doc.y = imageY + 139;
      }
    }
    doc.moveDown(.6);
  }

  const pages = doc.bufferedPageRange();
  for (let pageIndex = pages.start; pageIndex < pages.start + pages.count; pageIndex += 1) {
    doc.switchToPage(pageIndex);
    const originalBottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    if (pageIndex > 0) {
      doc.font('ThaiBold').fontSize(7.5).fillColor(muted).text(`${data.settings.app_title || 'D DRONE'}  |  รายงานเหตุการณ์`, 46, 26, { width: contentWidth });
      doc.strokeColor(line).moveTo(46, 40).lineTo(pageWidth - 46, 40).stroke();
    }
    doc.font('Thai').fontSize(7.5).fillColor(muted).text(`${data.settings.app_title || 'D DRONE'}  ·  รายงานเหตุการณ์`, 46, doc.page.height - 34, { width: contentWidth / 2, lineBreak: false });
    doc.text(`หน้า ${pageIndex + 1} / ${pages.count}`, pageWidth / 2, doc.page.height - 34, { width: contentWidth / 2, align: 'right', lineBreak: false });
    doc.page.margins.bottom = originalBottomMargin;
  }
  doc.end();
  return output;
}

function excelDate(value) { return value ? new Date(value) : null; }

async function buildExcel(data) {
  const rollup = summaries(data.reports);
  const excelPeriodLabel = data.period.type === 'range'
    ? `${formatBuddhistNumericDate(data.period.from)} - ${formatBuddhistNumericDate(data.period.to)}`
    : data.period.label;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = data.settings.app_title || 'D DRONE';
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.subject = data.period.label;
  const incidents = workbook.addWorksheet('เหตุการณ์', { views: [{ state: 'frozen', ySplit: 1, activeCell: 'A2' }], properties: { defaultRowHeight: 22 } });
  const columns = [
    ['ลำดับ', 8], ['เลขที่รายงาน', 23], ['วันที่เกิดเหตุ', 14], ['เวลาเกิดเหตุ', 12], ['วันที่รับแจ้ง', 14], ['เวลาแจ้ง', 12], ['แหล่งข้อมูล', 14], ['ประเภทผู้รายงาน', 18], ['ชื่อผู้รายงาน', 22], ['หน่วยงาน', 24], ['เบอร์โทร', 16], ['อีเมล', 24], ['ประเภทวัตถุ', 16], ['จำนวน', 10], ['ระดับผู้แจ้ง', 14], ['ระดับเจ้าหน้าที่', 16], ['สถานะ', 20], ['สถานที่', 28], ['Latitude', 14], ['Longitude', 14], ['MGRS', 22], ['ทิศทาง', 16], ['ความเร็วโดยประมาณ', 20], ['ความสูงโดยประมาณ', 20], ['ระยะห่างโดยประมาณ', 20], ['ลักษณะที่พบ', 34], ['รายละเอียด', 42], ['จำนวนรูปภาพ', 14], ['จำนวนหมายเหตุ', 14], ['ระดับที่ใช้สรุป', 16],
  ];
  incidents.columns = columns.map(([header, width]) => ({ header, width }));
  for (const [index, report] of data.reports.entries()) {
    incidents.addRow([
      index + 1, report.report_no, excelDate(report.occurred_at), excelDate(report.occurred_at), excelDate(report.submitted_at), excelDate(report.submitted_at), labels.source[report.source] || report.source, labels.reporter[report.reporter_type] || report.reporter_type, reporterName(report), report.reporter_type === 'ANONYMOUS' ? null : report.organization, report.reporter_type === 'ANONYMOUS' ? null : report.phone, report.reporter_type === 'ANONYMOUS' ? null : report.reporter_email, labels.object[report.object_type] || report.object_type, report.object_count || null, labels.severity[report.reporter_severity] || report.reporter_severity, labels.severity[report.operator_severity] || null, labels.status[report.status] || report.status, report.location_name, Number(report.incident_lat), Number(report.incident_lng), coordinates.toMgrs(report.incident_lat, report.incident_lng), report.direction, report.speed_estimate, report.altitude_estimate, report.distance_estimate, report.appearance_notes, report.description, Number(report.image_count || 0), Number(report.note_count || 0), labels.severity[report.operator_severity || report.reporter_severity] || null,
    ]);
  }
  incidents.autoFilter = `A1:AC${incidents.rowCount}`;
  incidents.getRow(1).height = 30;
  incidents.getRow(1).eachCell((cell) => { cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1676D2' } }; cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }; cell.border = { bottom: { style: 'thin', color: { argb: 'FFB8C8D8' } } }; });
  incidents.eachRow((row, rowNumber) => { if (rowNumber === 1) return; row.alignment = { vertical: 'top', wrapText: true }; if (rowNumber % 2 === 0) row.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F8FB' } }; }); });
  for (const column of ['C','E']) incidents.getColumn(column).numFmt = 'dd/mm/yyyy';
  for (const column of ['D','F']) incidents.getColumn(column).numFmt = 'hh:mm';
  for (const column of ['S','T']) incidents.getColumn(column).numFmt = '0.0000000';
  incidents.getColumn('N').numFmt = '0'; incidents.getColumn('AB').numFmt = '0'; incidents.getColumn('AC').numFmt = '0';
  incidents.getColumn('AD').hidden = true;
  incidents.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9, margins: { left: .25, right: .25, top: .5, bottom: .5, header: .2, footer: .2 } };

  const summary = workbook.addWorksheet('สรุป', { views: [{ showGridLines: false }] });
  summary.columns = [{ width: 30 }, { width: 25 }, { width: 5 }, { width: 30 }, { width: 16 }];
  summary.mergeCells('A1:E1'); summary.getCell('A1').value = `${data.settings.app_title || 'D DRONE'} · สรุปรายงานเหตุการณ์`;
  summary.getCell('A1').font = { size: 18, bold: true, color: { argb: 'FFFFFFFF' } }; summary.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1676D2' } }; summary.getCell('A1').alignment = { vertical: 'middle' }; summary.getRow(1).height = 38;
  summary.mergeCells('A2:E2'); summary.getCell('A2').value = data.settings.organization_name || ''; summary.getCell('A2').font = { size: 10, color: { argb: 'FF64748B' } }; summary.getCell('A2').alignment = { vertical: 'middle' };
  summary.getCell('A3').value = 'ช่วงข้อมูล'; summary.getCell('B3').value = excelPeriodLabel;
  summary.getCell('A4').value = 'เหตุทั้งหมด'; summary.getCell('B4').value = { formula: `COUNTA('เหตุการณ์'!B2:B${incidents.rowCount})`, result: rollup.total };
  summary.mergeCells('B3:C3'); summary.mergeCells('B4:C4');
  summary.getCell('B3').alignment = { vertical: 'middle', wrapText: true }; summary.getRow(3).height = 34;
  summary.getCell('D3').value = 'จำนวนรูปภาพ'; summary.getCell('E3').value = { formula: `SUM('เหตุการณ์'!AA2:AA${incidents.rowCount})`, result: rollup.imageCount };
  summary.getCell('D4').value = 'จำนวนหมายเหตุ'; summary.getCell('E4').value = { formula: `SUM('เหตุการณ์'!AB2:AB${incidents.rowCount})`, result: data.reports.reduce((sum, report) => sum + Number(report.note_count || 0), 0) };
  summary.getCell('D5').value = 'เหตุที่มีภาพ'; summary.getCell('E5').value = { formula: `COUNTIF('เหตุการณ์'!AA2:AA${incidents.rowCount},\">0\")`, result: rollup.reportsWithImages };
  const sections = [
    ['ประเภทวัตถุ', 'M', labels.object], ['ระดับความรุนแรง', 'P', labels.severity], ['สถานะ', 'Q', labels.status], ['ประเภทผู้รายงาน', 'H', labels.reporter], ['แหล่งข้อมูล', 'G', labels.source],
  ];
  let startRow = 7;
  for (const [title, column, labelMap] of sections) {
    summary.mergeCells(`A${startRow}:B${startRow}`); summary.getCell(`A${startRow}`).value = title; summary.getCell(`A${startRow}`).font = { bold: true, color: { argb: 'FF263342' } }; summary.getCell(`A${startRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF3FA' } };
    let row = startRow + 1;
    for (const [code, label] of Object.entries(labelMap)) {
      const formula = title === 'ระดับความรุนแรง'
        ? `COUNTIF('เหตุการณ์'!AC2:AC${incidents.rowCount},"${label}")`
        : `COUNTIF('เหตุการณ์'!${column}2:${column}${incidents.rowCount},"${label}")`;
      const result = title === 'ระดับความรุนแรง' ? rollup.severity[code] : title === 'ประเภทวัตถุ' ? rollup.object[code] : title === 'สถานะ' ? rollup.status[code] : title === 'ประเภทผู้รายงาน' ? rollup.reporter[code] : rollup.source[code];
      summary.getCell(`A${row}`).value = `${label} (${code})`;
      summary.getCell(`B${row}`).value = { formula, result: result || 0 };
      row += 1;
    }
    startRow = row + 1;
  }
  summary.eachRow((row, rowNumber) => { if (rowNumber > 1) { row.alignment = { vertical: 'middle' }; row.height = 23; } });
  for (const cell of ['A3','A4','D3','D4','D5']) { summary.getCell(cell).font = { bold: true, color: { argb: 'FF64748B' } }; }
  for (const cell of ['B4','E3','E4','E5']) { summary.getCell(cell).font = { bold: true, color: { argb: 'FF1676D2' }, size: 13 }; summary.getCell(cell).numFmt = '#,##0'; }

  const imageSheet = workbook.addWorksheet('รูปภาพ', { views: [{ state: 'frozen', ySplit: 1 }] });
  imageSheet.columns = [{ header: 'เลขที่รายงาน', width: 24 }, { header: 'ลำดับรูป', width: 12 }, { header: 'ชื่อไฟล์ / reference', width: 65 }];
  for (const report of data.reports) for (const [index, image] of report.images.entries()) imageSheet.addRow([report.report_no, index + 1, image.file_path]);
  imageSheet.autoFilter = `A1:C${Math.max(1, imageSheet.rowCount)}`;
  imageSheet.getRow(1).eachCell((cell) => { cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1676D2' } }; });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

module.exports = { parsePeriod, loadExportData, buildPdf, buildExcel };
