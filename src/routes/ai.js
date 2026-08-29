const axios = require('axios');
const express = require('express');
const { createRateLimit } = require('../middleware/rateLimit');
const { resolveGeminiApiKey } = require('../services/secret-settings');

const router = express.Router();
const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
const ALLOWED_MODELS = new Set(['gemini-3.5-flash-lite', 'gemini-3.5-flash']);
const LEGACY_MODEL_ALIASES = new Map([
  ['gemini-2.5-flash-lite', 'gemini-3.5-flash-lite'],
  ['gemini-2.5-flash', 'gemini-3.5-flash-lite']
]);
const smartFillLimit = createRateLimit({
  windowMs: 10 * 60 * 1000,
  max: Math.max(1, Number(process.env.AI_SMART_FILL_MAX_PER_10MIN || 12)),
  message: 'ใช้ AI Smart Fill ถี่เกินไป กรุณารอสักครู่แล้วลองใหม่'
});

const smartFillSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    reporterType: { type: 'string', enum: ['ANONYMOUS', 'PUBLIC', 'OFFICIAL'], description: 'ประเภทผู้รายงาน เฉพาะเมื่อข้อความระบุชัดเจน' },
    reporterName: { type: 'string', description: 'ชื่อผู้รายงาน เฉพาะที่ระบุในข้อความ' },
    organization: { type: 'string', description: 'ชื่อหน่วยงาน เฉพาะที่ระบุในข้อความ' },
    phone: { type: 'string', description: 'เบอร์โทรศัพท์ เฉพาะที่ระบุในข้อความ' },
    email: { type: 'string', description: 'อีเมล เฉพาะที่ระบุในข้อความ' },
    occurredAt: { type: 'string', description: 'วันเวลาแบบ YYYY-MM-DDTHH:mm เมื่อสามารถระบุได้โดยไม่เดา' },
    locationName: { type: 'string', description: 'ชื่อสถานที่หรือจุดสังเกตที่พบเหตุ' },
    incidentLat: { type: 'number', minimum: -90, maximum: 90, description: 'ละติจูด เฉพาะเมื่อผู้ใช้ให้พิกัดตัวเลขอย่างชัดเจน ห้าม geocode หรือเดา' },
    incidentLng: { type: 'number', minimum: -180, maximum: 180, description: 'ลองจิจูด เฉพาะเมื่อผู้ใช้ให้พิกัดตัวเลขอย่างชัดเจน ห้าม geocode หรือเดา' },
    objectType: { type: 'string', enum: ['DRONE', 'AIRCRAFT', 'UNKNOWN'] },
    direction: { type: 'string', description: 'ทิศทางการบิน' },
    speedEstimate: { type: 'string', description: 'ความเร็วโดยประมาณพร้อมหน่วยหรือคำบรรยาย' },
    altitudeEstimate: { type: 'string', description: 'ความสูงโดยประมาณพร้อมหน่วย' },
    distanceEstimate: { type: 'string', description: 'ระยะห่างจากผู้พบพร้อมหน่วย' },
    objectCount: { type: 'integer', minimum: 1, maximum: 999 },
    reporterSeverity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], description: 'ระดับเร่งด่วนจากข้อความหรือความเสี่ยงที่ชัดเจนเท่านั้น' },
    appearanceNotes: { type: 'string', description: 'สี รูปร่าง ไฟ เสียง หรือลักษณะภายนอกที่สังเกตเห็น' },
    description: { type: 'string', description: 'รายละเอียดเหตุการณ์อื่นที่ผู้ใช้ระบุ โดยไม่แต่งข้อมูลเพิ่ม' }
  }
};

async function geminiConfig() {
  const apiKey = await resolveGeminiApiKey();
  const requestedModel = String(process.env.GEMINI_MODEL || DEFAULT_MODEL).trim();
  const migratedModel = LEGACY_MODEL_ALIASES.get(requestedModel) || requestedModel;
  const model = ALLOWED_MODELS.has(migratedModel) ? migratedModel : DEFAULT_MODEL;
  return { apiKey, model };
}

function bangkokNowText() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).format(new Date());
}

function cleanText(value, maxLength = 1000) {
  if (typeof value !== 'string') return undefined;
  const text = value.trim().replace(/\s+/g, ' ');
  return text ? text.slice(0, maxLength) : undefined;
}

function sanitizeFields(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;

  const textFields = [
    ['reporterName', 200], ['organization', 200], ['phone', 60], ['email', 254],
    ['locationName', 300], ['direction', 160], ['speedEstimate', 120],
    ['altitudeEstimate', 120], ['distanceEstimate', 120], ['appearanceNotes', 1200],
    ['description', 2000]
  ];
  for (const [key, maxLength] of textFields) {
    const value = cleanText(raw[key], maxLength);
    if (value) out[key] = value;
  }

  if (['ANONYMOUS', 'PUBLIC', 'OFFICIAL'].includes(raw.reporterType)) out.reporterType = raw.reporterType;
  if (['DRONE', 'AIRCRAFT', 'UNKNOWN'].includes(raw.objectType)) out.objectType = raw.objectType;
  if (['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(raw.reporterSeverity)) out.reporterSeverity = raw.reporterSeverity;

  const occurredAt = cleanText(raw.occurredAt, 16);
  if (occurredAt && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(occurredAt)) out.occurredAt = occurredAt;

  const objectCount = Number(raw.objectCount);
  if (Number.isInteger(objectCount) && objectCount >= 1 && objectCount <= 999) out.objectCount = objectCount;

  const lat = Number(raw.incidentLat);
  const lng = Number(raw.incidentLng);
  if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
    out.incidentLat = lat;
    out.incidentLng = lng;
  }

  return out;
}

function extractCandidateText(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts.map((part) => typeof part?.text === 'string' ? part.text : '').join('').trim();
}

router.get('/config', async (req, res, next) => {
  try {
    const { apiKey, model } = await geminiConfig();
    res.json({ enabled: Boolean(apiKey), provider: 'Gemini', model });
  } catch (error) {
    next(error);
  }
});

router.post('/smart-fill', smartFillLimit, async (req, res) => {
  const { apiKey, model } = await geminiConfig();
  if (!apiKey) {
    return res.status(503).json({ error: 'AI Smart Fill ยังไม่ได้ตั้งค่า GEMINI_API_KEY บนเซิร์ฟเวอร์' });
  }

  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (text.length < 3) return res.status(400).json({ error: 'กรุณาพิมพ์รายละเอียดที่ต้องการให้ AI แยกข้อมูล' });
  if (text.length > 4000) return res.status(413).json({ error: 'ข้อความยาวเกินไป กรุณาใช้ไม่เกิน 4,000 ตัวอักษร' });

  const systemInstruction = [
    'คุณเป็นตัวช่วยแยกข้อมูลสำหรับแบบฟอร์มแจ้งเหตุโดรน/อากาศยานในประเทศไทย',
    'หน้าที่ของคุณคือ extraction เท่านั้น ไม่ใช่การสนทนา และห้ามแต่งข้อเท็จจริงที่ไม่มีในข้อความ',
    'คืนเฉพาะ field ที่มีหลักฐานจากข้อความหรืออนุมานได้อย่างสมเหตุสมผลโดยไม่สร้างรายละเอียดใหม่',
    'ถ้าไม่แน่ใจให้ละ field นั้นออกไป',
    'อย่าเปลี่ยนชื่อสถานที่เป็นพิกัด GPS เอง และห้าม geocode เด็ดขาด',
    'incidentLat/incidentLng ใส่ได้เฉพาะเมื่อข้อความผู้ใช้มีพิกัดตัวเลขชัดเจน และต้องมีทั้งคู่',
    'occurredAt ใช้รูปแบบ YYYY-MM-DDTHH:mm เวลาไทย ถ้าผู้ใช้พูด วันนี้/เมื่อวาน/เมื่อกี้ ให้ใช้เวลาปัจจุบันที่ส่งมาช่วยตีความ',
    'reporterSeverity ให้ตั้งเฉพาะเมื่อมีคำบอกระดับความเร่งด่วนหรือมีความเสี่ยงชัดเจน มิฉะนั้นให้ละไว้',
    'รักษาคำบรรยายของผู้ใช้ให้ใกล้ต้นฉบับและไม่เพิ่มข้อมูลที่ผู้ใช้ไม่ได้ให้'
  ].join('\n');

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{
          role: 'user',
          parts: [{ text: `เวลาปัจจุบันในประเทศไทย: ${bangkokNowText()}\n\nข้อความสำหรับแยกข้อมูล:\n${text}` }]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1200,
          responseMimeType: 'application/json',
          responseJsonSchema: smartFillSchema
        }
      },
      {
        timeout: 20000,
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        }
      }
    );

    const candidateText = extractCandidateText(response.data);
    if (!candidateText) return res.status(502).json({ error: 'Gemini ไม่ได้ส่งข้อมูลที่สามารถใช้กรอกฟอร์มได้' });

    let parsed;
    try {
      parsed = JSON.parse(candidateText);
    } catch (_) {
      return res.status(502).json({ error: 'รูปแบบคำตอบจาก Gemini ไม่ถูกต้อง กรุณาลองใหม่' });
    }

    const fields = sanitizeFields(parsed);
    const warnings = [];
    if (fields.locationName && (fields.incidentLat === undefined || fields.incidentLng === undefined)) {
      warnings.push('พบชื่อสถานที่แล้ว แต่ยังต้องปักหมุดตำแหน่งจริงบนแผนที่');
    }
    if (!Object.keys(fields).length) warnings.push('AI ยังไม่พบข้อมูลที่มั่นใจพอสำหรับกรอกอัตโนมัติ');

    return res.json({ fields, warnings, provider: 'Gemini', model });
  } catch (error) {
    const status = error.response?.status;
    const apiMessage = error.response?.data?.error?.message || '';
    console.error('Gemini Smart Fill error:', status || error.code || error.message, apiMessage.slice(0, 300));

    if (status === 429) return res.status(429).json({ error: 'โควต้า Gemini Free Tier ชั่วคราวเต็ม กรุณารอสักครู่แล้วลองใหม่' });
    if (status === 400 || status === 401 || status === 403) return res.status(503).json({ error: 'Gemini API key หรือการตั้งค่าโมเดลไม่พร้อมใช้งาน กรุณาตรวจการตั้งค่าบนเซิร์ฟเวอร์' });
    if (error.code === 'ECONNABORTED') return res.status(504).json({ error: 'Gemini ตอบช้าเกินไป กรุณาลองใหม่' });
    return res.status(502).json({ error: 'เชื่อมต่อ Gemini ไม่สำเร็จ กรุณาลองใหม่ภายหลัง' });
  }
});

module.exports = router;
