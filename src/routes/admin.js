const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const pool = require('../config/database');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const uploadRoot = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads');
const brandingDir = path.join(uploadRoot, 'branding');
const allowedLogoTypes = new Map([
  ['image/png', '.png'], ['image/jpeg', '.jpg'], ['image/webp', '.webp'], ['image/gif', '.gif']
]);
let settingsTableReady;

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

const brandingUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => { fs.mkdirSync(brandingDir, { recursive: true }); cb(null, brandingDir); },
    filename: (req, file, cb) => cb(null, `logo-${crypto.randomUUID()}${allowedLogoTypes.get(file.mimetype) || ''}`)
  }),
  limits: { files: 1, fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => allowedLogoTypes.has(file.mimetype) ? cb(null, true) : cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'logo'))
});

router.get('/settings', async (req, res, next) => {
  try {
    await ensureSettingsTable();
    const [rows] = await pool.query("SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('app_title','app_logo_path')");
    const settings = { app_title: 'D DRONE', app_logo_path: '' };
    for (const row of rows) settings[row.setting_key] = row.setting_value || '';
    res.json(settings);
  } catch (error) { next(error); }
});

router.post('/settings', requireRole('SUPER_ADMIN'), brandingUpload.single('logo'), async (req, res, next) => {
  try {
    await ensureSettingsTable();
    const appTitle = String(req.body.appTitle || '').trim();
    if (!appTitle || appTitle.length > 100) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: 'กรุณาระบุชื่อโครงการไม่เกิน 100 ตัวอักษร' });
    }
    const relativeLogoPath = req.file ? path.relative(uploadRoot, req.file.path).split(path.sep).join('/') : null;
    await pool.execute(`INSERT INTO app_settings (setting_key, setting_value) VALUES ('app_title', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`, [appTitle]);
    if (relativeLogoPath) await pool.execute(`INSERT INTO app_settings (setting_key, setting_value) VALUES ('app_logo_path', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`, [relativeLogoPath]);
    await pool.execute(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address, user_agent) VALUES (?, 'BRANDING_UPDATED', 'APP_SETTINGS', 'branding', ?, ?)`, [req.session.user.id, req.ip, req.get('user-agent') || null]);
    const [rows] = await pool.query("SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('app_title','app_logo_path')");
    const settings = { app_title: 'D DRONE', app_logo_path: '' };
    for (const row of rows) settings[row.setting_key] = row.setting_value || '';
    res.json(settings);
  } catch (error) {
    if (req.file) fs.unlink(req.file.path, () => {});
    next(error);
  }
});

router.get('/reports', async (req, res, next) => {
  try {
    const status = req.query.status || null;
    const severity = req.query.severity || null;
    const search = String(req.query.search || '').trim();

    const where = [];
    const params = [];
    if (status) { where.push('r.status = ?'); params.push(status); }
    if (severity) { where.push('COALESCE(r.operator_severity, r.reporter_severity) = ?'); params.push(severity); }
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
              (SELECT COUNT(*) FROM report_images ri2 WHERE ri2.report_id = r.id) AS image_count
       FROM reports r
       LEFT JOIN reporters rp ON rp.id = r.reporter_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY r.submitted_at DESC
       LIMIT 500`,
      params
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

router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (req.file) fs.unlink(req.file.path, () => {});
    if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'โลโก้ต้องมีขนาดไม่เกิน 2 MB' });
    return res.status(400).json({ error: 'รองรับโลโก้เฉพาะ PNG, JPG, WEBP หรือ GIF' });
  }
  next(error);
});

module.exports = router;
