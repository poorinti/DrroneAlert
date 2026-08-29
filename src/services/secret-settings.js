const crypto = require('crypto');
const pool = require('../config/database');

const PREFIX = 'enc:v1';
const KEY_SETTING = 'gemini_api_key_enc';

function secretCandidates() {
  return [...new Set([
    String(process.env.SETTINGS_ENCRYPTION_KEY || '').trim(),
    String(process.env.SESSION_SECRET || '').trim()
  ].filter(Boolean))];
}

function encryptionKey(secret) {
  if (!secret) throw new Error('SETTINGS_ENCRYPTION_KEY or SESSION_SECRET is required');
  return crypto.createHash('sha256').update(`D-DRONE:secret-settings:v1:${secret}`).digest();
}

function encryptSecret(value) {
  const secret = secretCandidates()[0];
  if (!secret) throw new Error('SETTINGS_ENCRYPTION_KEY or SESSION_SECRET is required');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join(':');
}

function decryptStoredSecret(payload) {
  const text = String(payload || '');
  const match = text.match(/^enc:v1:([^:]+):([^:]+):([^:]+)$/);
  if (!match) return '';
  const [, ivText, tagText, cipherText] = match;

  for (const secret of secretCandidates()) {
    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(secret), Buffer.from(ivText, 'base64url'));
      decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
      return Buffer.concat([decipher.update(Buffer.from(cipherText, 'base64url')), decipher.final()]).toString('utf8');
    } catch (_) {
      // Try the next server-side encryption secret. This supports safe key rotation.
    }
  }
  return '';
}

async function saveGeminiApiKey(apiKey) {
  const clean = String(apiKey || '').trim();
  if (clean.length < 20 || clean.length > 512) throw new Error('Gemini API key format is invalid');
  const encrypted = encryptSecret(clean);
  await pool.execute(
    `INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [KEY_SETTING, encrypted]
  );
}

async function readDashboardGeminiApiKey() {
  try {
    const [rows] = await pool.execute('SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1', [KEY_SETTING]);
    if (!rows[0]?.setting_value) return '';
    return decryptStoredSecret(rows[0].setting_value).trim();
  } catch (error) {
    console.error('Gemini secret setting read failed:', error.message);
    return '';
  }
}

async function geminiKeyStatus() {
  try {
    const [rows] = await pool.execute('SELECT setting_value, updated_at FROM app_settings WHERE setting_key = ? LIMIT 1', [KEY_SETTING]);
    if (rows[0]?.setting_value && decryptStoredSecret(rows[0].setting_value).trim()) {
      return { configured: true, updatedAt: rows[0].updated_at || null, source: 'dashboard' };
    }
  } catch (_) {
    // Fallback to environment status below.
  }
  const envConfigured = Boolean(String(process.env.GEMINI_API_KEY || '').trim());
  return { configured: envConfigured, updatedAt: null, source: envConfigured ? 'environment' : 'none' };
}

async function resolveGeminiApiKey() {
  const dashboardKey = await readDashboardGeminiApiKey();
  if (dashboardKey) return dashboardKey;
  return String(process.env.GEMINI_API_KEY || '').trim();
}

module.exports = { saveGeminiApiKey, geminiKeyStatus, resolveGeminiApiKey };
