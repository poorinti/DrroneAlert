const express = require('express');
const path = require('path');
const pool = require('../config/database');

const router = express.Router();
const defaults = {
  app_title: 'D DRONE',
  organization_name: 'ศูนย์ควบคุมและเฝ้าระวังอากาศยาน',
  app_logo_path: '',
  secondary_logo_path: ''
};

function publicBrandingUrl(value) {
  if (!value) return '';
  const normalized = String(value).replaceAll('\\', '/');
  if (!normalized.startsWith('branding/')) return '';
  return `/branding-assets/${encodeURIComponent(path.posix.basename(normalized))}`;
}

function looksLikeMojibake(value) {
  return /(?:à¸|à¹|Ã|Â|â€|ï¿½)/.test(String(value || ''));
}

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('app_title','organization_name','app_logo_path','secondary_logo_path')");
    const branding = { ...defaults };
    let repairOrganization = false;
    for (const row of rows) {
      if (row.setting_key === 'organization_name' && looksLikeMojibake(row.setting_value)) {
        branding.organization_name = defaults.organization_name;
        repairOrganization = true;
        continue;
      }
      branding[row.setting_key] = row.setting_value || defaults[row.setting_key] || '';
    }
    if (repairOrganization) {
      await pool.execute("UPDATE app_settings SET setting_value = ? WHERE setting_key = 'organization_name'", [defaults.organization_name]);
    }
    res.json({
      app_title: branding.app_title,
      organization_name: branding.organization_name,
      app_logo_url: publicBrandingUrl(branding.app_logo_path),
      secondary_logo_url: publicBrandingUrl(branding.secondary_logo_path)
    });
  } catch (_) {
    res.json({
      app_title: defaults.app_title,
      organization_name: defaults.organization_name,
      app_logo_url: '',
      secondary_logo_url: ''
    });
  }
});

module.exports = router;
