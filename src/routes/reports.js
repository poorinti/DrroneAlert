const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const pool = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { createRateLimit } = require('../middleware/rateLimit');

const router = express.Router();
const reportSubmitLimit = createRateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: 'ส่งรายงานถี่เกินไป กรุณารอสักครู่แล้วลองใหม่'
});

const uploadRoot = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads');
const maxUploadBytes = Number(process.env.MAX_UPLOAD_MB || 50) * 1024 * 1024;

function uploadDirectory() {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const dir = path.join(uploadRoot, 'reports', year, month);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDirectory()),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase().replace(/[^.a-z0-9]/g, '');
    cb(null, `${crypto.randomUUID()}${ext || '.jpg'}`);
  }
});

const upload = multer({
  storage,
  limits: {
    files: 5,
    fileSize: maxUploadBytes
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'images'));
    }
    cb(null, true);
  }
});

function cleanUploadedFiles(files = []) {
  for (const file of files) {
    try {
      fs.unlinkSync(file.path);
    } catch (_) {
      // Best effort cleanup only.
    }
  }
}

function normalizeOptional(value) {
  if (value === undefined || value === null || value === '') return null;
  return value;
}

function compactLocalDate(date = new Date()) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, report_no, object_type, reporter_severity, operator_severity,
              status, location_name, incident_lat, incident_lng,
              occurred_at, submitted_at
       FROM reports
       ORDER BY submitted_at DESC
       LIMIT 500`
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const [reports] = await pool.execute(
      `SELECT r.*, p.reporter_type, p.name AS reporter_name, p.phone, p.email,
              p.organization, p.line_display_name, p.line_picture_url
       FROM reports r
       LEFT JOIN reporters p ON p.id = r.reporter_id
       WHERE r.id = ?
       LIMIT 1`,
      [req.params.id]
    );

    if (!reports.length) return res.status(404).json({ error: 'report not found' });

    const [images] = await pool.execute(
      'SELECT id, file_path, mime_type, file_size, sort_order, created_at FROM report_images WHERE report_id = ? ORDER BY sort_order ASC, id ASC',
      [req.params.id]
    );

    res.json({ ...reports[0], images });
  } catch (error) {
    next(error);
  }
});

router.post('/', reportSubmitLimit, upload.array('images', 5), async (req, res, next) => {
  const files = req.files || [];
  const totalUploadBytes = files.reduce((sum, file) => sum + Number(file.size || 0), 0);

  if (totalUploadBytes > maxUploadBytes) {
    cleanUploadedFiles(files);
    return res.status(413).json({ error: `หลักฐานรวมต้องไม่เกิน ${process.env.MAX_UPLOAD_MB || 50} MB` });
  }

  const incidentLat = Number(req.body.incidentLat);
  const incidentLng = Number(req.body.incidentLng);

  if (!Number.isFinite(incidentLat) || !Number.isFinite(incidentLng) || incidentLat < -90 || incidentLat > 90 || incidentLng < -180 || incidentLng > 180) {
    cleanUploadedFiles(files);
    return res.status(400).json({ error: 'กรุณาปักตำแหน่งที่พบเหตุบนแผนที่ให้ถูกต้อง' });
  }

  const reporterType = ['ANONYMOUS', 'PUBLIC', 'OFFICIAL'].includes(req.body.reporterType)
    ? req.body.reporterType
    : 'PUBLIC';
  const objectType = ['DRONE', 'AIRCRAFT', 'UNKNOWN'].includes(req.body.objectType)
    ? req.body.objectType
    : 'UNKNOWN';
  const reporterSeverity = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(req.body.reporterSeverity)
    ? req.body.reporterSeverity
    : 'MEDIUM';
  const sessionLineIdentity = req.session?.lineReporter;
  const lineIdentity = sessionLineIdentity && (Date.now() - Number(sessionLineIdentity.verifiedAt || 0) < 8 * 60 * 60 * 1000)
    ? sessionLineIdentity
    : null;
  const source = lineIdentity ? 'LINE_LIFF' : 'WEB';

  if (reporterType === 'PUBLIC' && !lineIdentity && !String(req.body.reporterName || '').trim()) {
    cleanUploadedFiles(files);
    return res.status(400).json({ error: 'กรุณาระบุชื่อผู้รายงาน หรือเลือกไม่ระบุตัวตน' });
  }

  if (reporterType === 'OFFICIAL' && !String(req.body.organization || '').trim()) {
    cleanUploadedFiles(files);
    return res.status(400).json({ error: 'กรุณาระบุหน่วยงาน' });
  }

  const occurredAtRaw = normalizeOptional(req.body.occurredAt);
  const occurredAtText = String(occurredAtRaw || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/.test(occurredAtText)) {
    cleanUploadedFiles(files);
    return res.status(400).json({ error: 'กรุณาระบุวันและเวลาที่ตรวจพบให้ถูกต้อง' });
  }
  const occurredAt = occurredAtText.replace('T', ' ').slice(0, 19);

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    let reporterId = null;
    if (reporterType === 'ANONYMOUS') {
      const [anonymousResult] = await conn.execute(
        'INSERT INTO reporters (source, reporter_type) VALUES (?, \'ANONYMOUS\')',
        [source]
      );
      reporterId = anonymousResult.insertId;
    } else {
      if (lineIdentity) {
        const [reporterResult] = await conn.execute(
          `INSERT INTO reporters (
            source, reporter_type, line_user_id, line_display_name, line_picture_url,
            name, phone, email, organization
          ) VALUES ('LINE_LIFF', ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            id = LAST_INSERT_ID(id),
            reporter_type = VALUES(reporter_type),
            line_display_name = VALUES(line_display_name),
            line_picture_url = VALUES(line_picture_url),
            name = VALUES(name),
            phone = VALUES(phone),
            email = VALUES(email),
            organization = VALUES(organization),
            updated_at = CURRENT_TIMESTAMP`,
          [
            reporterType,
            lineIdentity.lineUserId,
            lineIdentity.displayName,
            lineIdentity.pictureUrl,
            lineIdentity.displayName || normalizeOptional(req.body.reporterName),
            normalizeOptional(req.body.phone),
            lineIdentity.email || normalizeOptional(req.body.email),
            reporterType === 'OFFICIAL' ? normalizeOptional(req.body.organization) : null
          ]
        );
        reporterId = reporterResult.insertId;
      } else {
        const [reporterResult] = await conn.execute(
          `INSERT INTO reporters (source, reporter_type, name, phone, email, organization)
           VALUES ('WEB', ?, ?, ?, ?, ?)`,
          [
            reporterType,
            normalizeOptional(req.body.reporterName),
            normalizeOptional(req.body.phone),
            normalizeOptional(req.body.email),
            reporterType === 'OFFICIAL' ? normalizeOptional(req.body.organization) : null
          ]
        );
        reporterId = reporterResult.insertId;
      }
    }

    const tempReportNo = `DRN-${Date.now()}-${crypto.randomInt(1000, 9999)}`;

    const [result] = await conn.execute(
      `INSERT INTO reports (
        report_no, reporter_id, source, object_type, reporter_severity, status,
        location_name, incident_lat, incident_lng, reporter_lat, reporter_lng,
        gps_accuracy_m, direction, speed_estimate, altitude_estimate,
        distance_estimate, object_count, appearance_notes, description,
        occurred_at, submitted_at
      ) VALUES (?, ?, ?, ?, ?, 'NEW', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        tempReportNo,
        reporterId,
        source,
        objectType,
        reporterSeverity,
        normalizeOptional(req.body.locationName),
        incidentLat,
        incidentLng,
        normalizeOptional(req.body.reporterLat),
        normalizeOptional(req.body.reporterLng),
        normalizeOptional(req.body.gpsAccuracyM),
        normalizeOptional(req.body.direction),
        normalizeOptional(req.body.speedEstimate),
        normalizeOptional(req.body.altitudeEstimate),
        normalizeOptional(req.body.distanceEstimate),
        normalizeOptional(req.body.objectCount),
        normalizeOptional(req.body.appearanceNotes),
        normalizeOptional(req.body.description),
        occurredAt
      ]
    );

    const reportNo = `DRN-${compactLocalDate()}-${String(result.insertId).padStart(6, '0')}`;
    await conn.execute('UPDATE reports SET report_no = ? WHERE id = ?', [reportNo, result.insertId]);

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const relativePath = path.relative(uploadRoot, file.path).split(path.sep).join('/');
      await conn.execute(
        `INSERT INTO report_images (report_id, file_path, mime_type, file_size, sort_order)
         VALUES (?, ?, ?, ?, ?)`,
        [result.insertId, relativePath, file.mimetype, file.size, index]
      );
    }

    await conn.execute(
      `INSERT INTO report_history (report_id, user_id, action, old_value, new_value)
       VALUES (?, NULL, 'REPORT_CREATED', NULL, ?)`,
      [result.insertId, JSON.stringify({ source, reporterType, objectType, reporterSeverity })]
    );

    await conn.commit();

    const report = {
      id: result.insertId,
      reportNo,
      source,
      status: 'NEW',
      incidentLat,
      incidentLng,
      reporterSeverity,
      objectType,
      locationName: normalizeOptional(req.body.locationName),
      occurredAt,
      imageCount: files.length
    };

    req.app.get('io').to('dashboard').emit('report:new', report);
    res.status(201).json(report);
  } catch (error) {
    if (conn) await conn.rollback();
    cleanUploadedFiles(files);
    next(error);
  } finally {
    if (conn) conn.release();
  }
});

router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    cleanUploadedFiles(req.files || []);
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: `ไฟล์ภาพมีขนาดใหญ่เกิน ${process.env.MAX_UPLOAD_MB || 50} MB` });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'แนบรูปได้ไม่เกิน 5 รูป' });
    }
    return res.status(400).json({ error: 'รองรับเฉพาะไฟล์รูปภาพ' });
  }
  next(error);
});

module.exports = router;
