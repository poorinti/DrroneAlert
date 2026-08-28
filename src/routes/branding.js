const express = require('express');
const pool = require('../config/database');

const router = express.Router();
const defaults = { app_title: 'D DRONE', organization_name: 'ศูนย์ควบคุมและเฝ้าระวังอากาศยาน' };

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('app_title','organization_name')");
    const branding = { ...defaults };
    for (const row of rows) branding[row.setting_key] = row.setting_value || defaults[row.setting_key] || '';
    res.json(branding);
  } catch (_) {
    res.json(defaults);
  }
});

module.exports = router;
