const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { createRateLimit } = require('../middleware/rateLimit');

const router = express.Router();
const loginLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'ลองเข้าสู่ระบบหลายครั้งเกินไป กรุณารอประมาณ 15 นาที'
});

router.post('/login', loginLimit, async (req, res, next) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');

    if (!username || !password) {
      return res.status(400).json({ error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });
    }

    const [rows] = await pool.execute(
      `SELECT id, username, email, password_hash, role, is_active
       FROM users
       WHERE username = ? OR email = ?
       LIMIT 1`,
      [username, username]
    );

    const user = rows[0];
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }

    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.user = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      };
      req.session.save(async (saveErr) => {
        if (saveErr) return next(saveErr);
        try {
          await pool.execute('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);
          await pool.execute(
            `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address, user_agent)
             VALUES (?, 'LOGIN', 'USER', ?, ?, ?)`,
            [user.id, String(user.id), req.ip, req.get('user-agent') || null]
          );
        } catch (_) {}
        res.json({ ok: true, user: req.session.user });
      });
    });
  } catch (error) {
    next(error);
  }
});

router.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    const currentPassword = String(req.body.currentPassword || '');
    const newPassword = String(req.body.newPassword || '');
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'กรุณากรอกรหัสผ่านปัจจุบันและรหัสผ่านใหม่' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร' });
    }

    const [rows] = await pool.execute('SELECT password_hash FROM users WHERE id = ? AND is_active = TRUE LIMIT 1', [req.session.user.id]);
    if (!rows[0]) return res.status(401).json({ error: 'ไม่พบบัญชีผู้ใช้' });

    const ok = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!ok) return res.status(400).json({ error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });

    const hash = await bcrypt.hash(newPassword, 12);
    await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.session.user.id]);
    await pool.execute(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address, user_agent)
       VALUES (?, 'PASSWORD_CHANGED', 'USER', ?, ?, ?)`,
      [req.session.user.id, String(req.session.user.id), req.ip, req.get('user-agent') || null]
    );
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/me', (req, res) => {
  res.json({ user: req.session?.user || null });
});

module.exports = router;
