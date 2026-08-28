const express = require('express');
const axios = require('axios');

const router = express.Router();

router.get('/config', (req, res) => {
  const liffId = process.env.LINE_LIFF_ID || '';
  const channelId = process.env.LINE_CHANNEL_ID || '';
  res.json({ enabled: Boolean(liffId && channelId), liffId: liffId || null });
});

router.post('/verify', async (req, res, next) => {
  try {
    const idToken = String(req.body.idToken || '').trim();
    const channelId = process.env.LINE_CHANNEL_ID || '';
    if (!channelId) return res.status(503).json({ error: 'LINE LIFF ยังไม่ได้ตั้งค่า' });
    if (!idToken) return res.status(400).json({ error: 'missing LINE ID token' });

    const form = new URLSearchParams();
    form.set('id_token', idToken);
    form.set('client_id', channelId);

    const response = await axios.post('https://api.line.me/oauth2/v2.1/verify', form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10000
    });

    const profile = response.data || {};
    if (!profile.sub) return res.status(401).json({ error: 'ไม่สามารถยืนยันบัญชี LINE ได้' });

    req.session.lineReporter = {
      lineUserId: profile.sub,
      displayName: profile.name || null,
      pictureUrl: profile.picture || null,
      email: profile.email || null,
      verifiedAt: Date.now()
    };

    res.json({
      verified: true,
      profile: {
        displayName: profile.name || null,
        pictureUrl: profile.picture || null,
        email: profile.email || null
      }
    });
  } catch (error) {
    if (error.response?.status >= 400 && error.response?.status < 500) {
      return res.status(401).json({ error: 'LINE session ไม่ถูกต้องหรือหมดอายุ' });
    }
    next(error);
  }
});

router.post('/clear', (req, res) => {
  delete req.session.lineReporter;
  res.json({ ok: true });
});

module.exports = router;
