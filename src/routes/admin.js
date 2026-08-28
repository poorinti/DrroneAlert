const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const pool = require('../config/database');
const { requireAuth, requireRole } = require('../middleware/auth');
const { createRateLimit } = require('../middleware/rateLimit');
const { parsePeriod, loadExportData, buildPdf, buildExcel } = require('../services/export-report');

const router = express.Router();
router.use(requireAuth);

const uploadRoot = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads');
const brandingDir = path.join(uploadRoot, 'branding');
const allowedLogoTypes = new Map([
  ['image/png', '.png'], ['image/jpeg', '.jpg'], ['image/webp', '.webp'], ['image/gif', '.gif']
]);
let settingsTableReady;
let reportReadsTableReady;

function ensureSettingsTable() {
  if (!settingsTableReady) {
    settingsTableReady = pool.query(`CREATE TABLE IF NOT EXISTS app_settings (
      setting_key VARCHAR(100) PRIMARY KEY,
      setting_value TEXT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`).catch((error) => { settingsTableReady = null; throw error; });
  }
  return settingsTableReady;
}

function ensureReportReadsTable() {
  if (!reportReadsTableReady) {
    reportReadsTableReady = pool.query(`CREATE TABLE IF NOT EXISTS report_reads (
      report_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      read_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (report_id, user_id),
      CONSTRAINT fk_report_reads_report FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
      CONSTRAINT fk_report_reads_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`).catch((error) => { reportReadsTableReady = null; throw error; });
  }
  return reportReadsTableReady;
}

const brandingUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => { fs.mkdirSync(brandingDir, { recursive: true }); cb(null, brandingDir); },
    filename: (req, file, cb) => cb(null, `logo-${crypto.randomUUID()}${allowedLogoTypes.get(file.mimetype) || ''}`)
  }),
  limits: { files: 2, fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => allowedLogoTypes.has(file.mimetype) ? cb(null, true) : cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'logo'))
});

router.get('/settings', async (req, res, next) => {
  try {
    await ensureSettingsTable();
    const [rows] = await pool.query("SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('app_title','organization_name','app_logo_path','secondary_logo_path')");
    const settings = { app_title: 'D DRONE', organization_name: 'ศูนย์ควบคุมและเฝ้าระวังอากาศยาน', app_logo_path: '', secondary_logo_path: '' };
    for (const row of rows) settings[row.setting_key] = row.setting_value || '';
    res.json(settings);
  } catch (error) { next(error); }
});

router.post('/settings', requireRole('SUPER_ADMIN'), brandingUpload.fields([{ name: 'logo', maxCount: 1 }, { name: 'secondaryLogo', maxCount: 1 }]), async (req, res, next) => {
  try {
    await ensureSettingsTable();
    const appTitle = String(req.body.appTitle || '').trim();
    const organizationName = String(req.body.organizationName || '').trim();
    if (!appTitle || appTitle.length > 100 || organizationName.length > 160) {
      for (const files of Object.values(req.files || {})) for (const file of files) fs.unlink(file.path, () => {});
      return res.status(400).json({ error: 'กรุณาระบุชื่อโครงการไม่เกิน 100 ตัวอักษร และชื่อหน่วยงานไม่เกิน 160 ตัวอักษร' });
    }
    const primaryFile = req.files?.logo?.[0];
    const secondaryFile = req.files?.secondaryLogo?.[0];
    const relativeLogoPath = primaryFile ? path.relative(uploadRoot, primaryFile.path).split(path.sep).join('/') : null;
    const relativeSecondaryLogoPath = secondaryFile ? path.relative(uploadRoot, secondaryFile.path).split(path.sep).join('/') : null;
    await pool.execute(`INSERT INTO app_settings (setting_key, setting_value) VALUES ('app_title', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`, [appTitle]);
    await pool.execute(`INSERT INTO app_settings (setting_key, setting_value) VALUES ('organization_name', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`, [organizationName]);
    if (relativeLogoPath) await pool.execute(`INSERT INTO app_settings (setting_key, setting_value) VALUES ('app_logo_path', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`, [relativeLogoPath]);
    if (relativeSecondaryLogoPath) await pool.execute(`INSERT INTO app_settings (setting_key, setting_value) VALUES ('secondary_logo_path', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`, [relativeSecondaryLogoPath]);
    await pool.execute(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address, user_agent) VALUES (?, 'BRANDING_UPDATED', 'APP_SETTINGS', 'branding', ?, ?)`, [req.session.user.id, req.ip, req.get('user-agent') || null]);
    const [rows] = await pool.query("SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('app_title','organization_name','app_logo_path','secondary_logo_path')");
    const settings = { app_title: 'D DRONE', organization_name: 'ศูนย์ควบคุมและเฝ้าระวังอากาศยาน', app_logo_path: '', secondary_logo_path: '' };
    for (const row of rows) settings[row.setting_key] = row.setting_value || '';
    res.json(settings);
  } catch (error) {
    for (const files of Object.values(req.files || {})) for (const file of files) fs.unlink(file.path, () => {});
    next(error);
  }
});

router.get('/reports', async (req, res, next) => {
  try {
    await ensureReportReadsTable();
    const status = req.query.status || null;
    const severity = req.query.severity || null;
    const search = String(req.query.search || '').trim();
    const scope = req.query.scope === 'history' ? 'history' : 'active';
    const date = String(req.query.date || '').trim();
    const month = String(req.query.month || '').trim();
    const from = String(req.query.from || '').trim();
    const to = String(req.query.to || '').trim();
    const isValidDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

    if (date && !isValidDate(date)) return res.status(400).json({ error: 'รูปแบบวันที่ไม่ถูกต้อง' });
    if (from && !isValidDate(from)) return res.status(400).json({ error: 'รูปแบบวันเริ่มต้นไม่ถูกต้อง' });
    if (to && !isValidDate(to)) return res.status(400).json({ error: 'รูปแบบวันสิ้นสุดไม่ถูกต้อง' });
    if (from && to && from > to) return res.status(400).json({ error: 'ช่วงวันที่ไม่ถูกต้อง' });
    if (month && (!/^\d{4}-\d{2}$/.test(month) || Number(month.slice(5)) < 1 || Number(month.slice(5)) > 12)) return res.status(400).json({ error: 'รูปแบบเดือนไม่ถูกต้อง' });

    const where = [];
    const params = [];
    if (scope === 'active') where.push("r.status IN ('NEW','ACKNOWLEDGED','INVESTIGATING','VERIFIED')");
    else where.push("r.status IN ('FALSE_ALARM','RESOLVED','CLOSED')");
    if (status) { where.push('r.status = ?'); params.push(status); }
    if (severity) { where.push('COALESCE(r.operator_severity, r.reporter_severity) = ?'); params.push(severity); }
    if (date) {
      where.push('DATE(r.occurred_at) = ?');
      params.push(date);
    } else if (from || to) {
      if (from) { where.push('DATE(r.occurred_at) >= ?'); params.push(from); }
      if (to) { where.push('DATE(r.occurred_at) <= ?'); params.push(to); }
    } else if (month) {
      where.push("DATE_FORMAT(r.occurred_at, '%Y-%m') = ?");
      params.push(month);
    }
    if (search) {
      where.push('(r.report_no LIKE ? OR r.location_name LIKE ? OR r.description LIKE ?)');
      const q = `%${search}%`;
      params.push(q, q, q);
    }

    const [rows] = await pool.execute(
      `SELECT r.id, r.report_no, r.source, r.object_type, r.reporter_severity, r.operator_severity,
              COALESCE(r.operator_severity, r.reporter_severity) AS effective_severity,
              r.status, r.location_name, r.incident_lat, r.incident_lng,
              r.direction, r.speed_estimate, r.altitude_estimate, r.distance_estimate,
              r.object_count, r.appearance_notes, r.description, r.occurred_at,
              r.submitted_at, rp.reporter_type, rp.line_display_name, rp.name AS reporter_name,
              rp.organization,
              (SELECT file_path FROM report_images ri WHERE ri.report_id = r.id ORDER BY ri.sort_order, ri.id LIMIT 1) AS cover_image,
              (SELECT COUNT(*) FROM report_images ri2 WHERE ri2.report_id = r.id) AS image_count,
              CASE WHEN rr.report_id IS NULL THEN TRUE ELSE FALSE END AS is_unread
       FROM reports r
       LEFT JOIN reporters rp ON rp.id = r.reporter_id
       LEFT JOIN report_reads rr ON rr.report_id = r.id AND rr.user_id = ?
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY r.submitted_at DESC
       LIMIT 500`,
      [req.session.user.id, ...params]
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

router.get('/reports/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT r.*, rp.reporter_type, rp.line_display_name, rp.line_picture_url,
              rp.name AS reporter_name, rp.phone, rp.email AS reporter_email, rp.organization
       FROM reports r
       LEFT JOIN reporters rp ON rp.id = r.reporter_id
       WHERE r.id = ? LIMIT 1`, [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'ไม่พบรายงาน' });

    const [images] = await pool.execute(
      'SELECT id, file_path, mime_type, file_size, sort_order, created_at FROM report_images WHERE report_id = ? ORDER BY sort_order, id',
      [req.params.id]
    );
    const [notes] = await pool.execute(
      `SELECT n.id, n.note, n.created_at, u.username
       FROM report_notes n JOIN users u ON u.id = n.user_id
       WHERE n.report_id = ? ORDER BY n.created_at DESC`, [req.params.id]
    );
    const [history] = await pool.execute(
      `SELECT h.id, h.action, h.old_value, h.new_value, h.created_at, u.username
       FROM report_history h LEFT JOIN users u ON u.id = h.user_id
       WHERE h.report_id = ? ORDER BY h.created_at DESC`, [req.params.id]
    );

    res.json({ report: rows[0], images, notes, history });
  } catch (error) {
    next(error);
  }
});

router.post('/reports/:id/read', async (req, res, next) => {
  try {
    await ensureReportReadsTable();
    await pool.execute('INSERT INTO report_reads (report_id, user_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE read_at = read_at', [req.params.id, req.session.user.id]);
    res.json({ ok: true });
  } catch (error) { next(error); }
});

router.post('/reports/read-all', async (req, res, next) => {
  try {
    await ensureReportReadsTable();
    await pool.execute(`INSERT IGNORE INTO report_reads (report_id, user_id)
      SELECT id, ? FROM reports WHERE status IN ('NEW','ACKNOWLEDGED','INVESTIGATING','VERIFIED')`, [req.session.user.id]);
    res.json({ ok: true });
  } catch (error) { next(error); }
});

router.get('/notifications', async (req, res, next) => {
  try {
    await ensureReportReadsTable();
    const [rows] = await pool.execute(`SELECT r.id, r.report_no, r.location_name, r.submitted_at,
      COALESCE(r.operator_severity, r.reporter_severity) AS effective_severity
      FROM reports r LEFT JOIN report_reads rr ON rr.report_id = r.id AND rr.user_id = ?
      WHERE rr.report_id IS NULL AND r.status IN ('NEW','ACKNOWLEDGED','INVESTIGATING','VERIFIED')
      ORDER BY r.submitted_at DESC LIMIT 20`, [req.session.user.id]);
    res.json({ unread_count: rows.length, reports: rows });
  } catch (error) { next(error); }
});

router.patch('/reports/:id', requireRole('SUPER_ADMIN', 'OPERATOR'), async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const allowedStatuses = ['NEW','ACKNOWLEDGED','INVESTIGATING','VERIFIED','FALSE_ALARM','RESOLVED','CLOSED'];
    const allowedSeverities = ['LOW','MEDIUM','HIGH','CRITICAL'];
    const status = req.body.status || null;
    const operatorSeverity = req.body.operatorSeverity || null;

    if (status && !allowedStatuses.includes(status)) return res.status(400).json({ error: 'invalid status' });
    if (operatorSeverity && !allowedSeverities.includes(operatorSeverity)) return res.status(400).json({ error: 'invalid severity' });
    if (!status && !operatorSeverity) return res.status(400).json({ error: 'nothing to update' });

    await conn.beginTransaction();
    const [rows] = await conn.execute('SELECT status, operator_severity FROM reports WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!rows[0]) { await conn.rollback(); return res.status(404).json({ error: 'ไม่พบรายงาน' }); }
    const old = rows[0];

    let changed = false;
    if (status && status !== old.status) {
      await conn.execute('UPDATE reports SET status = ? WHERE id = ?', [status, req.params.id]);
      await conn.execute(
        `INSERT INTO report_history (report_id, user_id, action, old_value, new_value)
         VALUES (?, ?, 'STATUS_CHANGED', ?, ?)`,
        [req.params.id, req.session.user.id, old.status, status]
      );
      changed = true;
    }
    if (operatorSeverity && operatorSeverity !== old.operator_severity) {
      await conn.execute('UPDATE reports SET operator_severity = ? WHERE id = ?', [operatorSeverity, req.params.id]);
      await conn.execute(
        `INSERT INTO report_history (report_id, user_id, action, old_value, new_value)
         VALUES (?, ?, 'SEVERITY_CHANGED', ?, ?)`,
        [req.params.id, req.session.user.id, old.operator_severity, operatorSeverity]
      );
      changed = true;
    }
    await conn.commit();

    const event = { id: Number(req.params.id), status, operatorSeverity, changed };
    if (changed) req.app.get('io').to('dashboard').emit('report:updated', event);
    res.json({ ok: true, ...event });
  } catch (error) {
    await conn.rollback();
    next(error);
  } finally {
    conn.release();
  }
});

router.post('/reports/:id/notes', requireRole('SUPER_ADMIN', 'OPERATOR'), async (req, res, next) => {
  try {
    const note = String(req.body.note || '').trim();
    if (!note) return res.status(400).json({ error: 'กรุณาระบุข้อความ' });
    const [result] = await pool.execute(
      'INSERT INTO report_notes (report_id, user_id, note) VALUES (?, ?, ?)',
      [req.params.id, req.session.user.id, note]
    );
    await pool.execute(
      `INSERT INTO report_history (report_id, user_id, action, new_value)
       VALUES (?, ?, 'NOTE_ADDED', ?)`,
      [req.params.id, req.session.user.id, note]
    );
    req.app.get('io').to('dashboard').emit('report:updated', { id: Number(req.params.id), noteAdded: true });
    res.status(201).json({ id: result.insertId, note });
  } catch (error) {
    next(error);
  }
});

const geocodeCache = new Map();
const geocodeRateLimit = createRateLimit({ windowMs: 60 * 1000, max: 30, message: 'ค้นหาสถานที่ถี่เกินไป กรุณารอสักครู่แล้วลองใหม่' });
router.get('/geocode', geocodeRateLimit, async (req, res, next) => {
  try {
    const query = String(req.query.q || '').trim();
    if (query.length < 2 || query.length > 160) return res.status(400).json({ error: 'กรุณาระบุสถานที่ที่ต้องการค้นหา' });
    const cacheKey = query.toLocaleLowerCase('th-TH');
    const cached = geocodeCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return res.json(cached.value);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let response;
    try {
      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.searchParams.set('q', query);
      url.searchParams.set('format', 'jsonv2');
      url.searchParams.set('limit', '1');
      url.searchParams.set('addressdetails', '1');
      url.searchParams.set('accept-language', 'th,en');
      response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': process.env.GEOCODER_USER_AGENT || 'DroneAlert/0.2 local-operations-dashboard'
        }
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) return res.status(502).json({ error: 'ไม่สามารถค้นหาสถานที่ได้ในขณะนี้' });
    const rows = await response.json();
    const item = Array.isArray(rows) ? rows[0] : null;
    if (!item) return res.status(404).json({ error: 'ไม่พบสถานที่ที่ค้นหา' });
    const lat = Number(item.lat);
    const lng = Number(item.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return res.status(502).json({ error: 'ผลการค้นหาสถานที่ไม่ถูกต้อง' });
    const value = { display_name: String(item.display_name || query), lat, lng };
    geocodeCache.set(cacheKey, { value, expiresAt: Date.now() + 5 * 60 * 1000 });
    if (geocodeCache.size > 100) geocodeCache.delete(geocodeCache.keys().next().value);
    res.json(value);
  } catch (error) {
    if (error?.name === 'AbortError') return res.status(504).json({ error: 'การค้นหาสถานที่ใช้เวลานานเกินไป กรุณาลองใหม่' });
    next(error);
  }
});

router.get('/stats', async (req, res, next) => {
  try {
    const [[totals]] = await pool.query(
      `SELECT
        COUNT(*) AS total,
        SUM(DATE(submitted_at) = CURDATE()) AS today,
        SUM(status IN ('NEW','ACKNOWLEDGED','INVESTIGATING')) AS active,
        SUM(COALESCE(operator_severity, reporter_severity) = 'CRITICAL') AS critical
       FROM reports`
    );
    res.json(totals);
  } catch (error) {
    next(error);
  }
});

router.get('/export/:format', async (req, res, next) => {
  try {
    const format = req.params.format;
    if (!['pdf', 'excel'].includes(format)) return res.status(404).json({ error: 'ไม่พบรูปแบบรายงาน' });
    const period = parsePeriod(req.query);
    const data = await loadExportData(period);
    const isPdf = format === 'pdf';
    const buffer = isPdf ? await buildPdf(data) : await buildExcel(data);
    const filename = isPdf ? `Incident-Report-${period.suffix}.pdf` : `Incident-Data-${period.suffix}.xlsx`;
    res.setHeader('Content-Type', isPdf ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
});

router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    for (const files of Object.values(req.files || {})) for (const file of files) fs.unlink(file.path, () => {});
    if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'โลโก้ต้องมีขนาดไม่เกิน 2 MB' });
    return res.status(400).json({ error: 'รองรับโลโก้เฉพาะ PNG, JPG, WEBP หรือ GIF' });
  }
  next(error);
});

module.exports = router;
