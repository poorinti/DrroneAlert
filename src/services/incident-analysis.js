const EARTH_RADIUS_M = 6371000;

function radians(value) {
  return value * Math.PI / 180;
}

function distanceMeters(a, b) {
  const lat1 = radians(Number(a.incident_lat));
  const lat2 = radians(Number(b.incident_lat));
  const dLat = lat2 - lat1;
  const dLng = radians(Number(b.incident_lng) - Number(a.incident_lng));
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function minutesApart(a, b) {
  return Math.abs(new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()) / 60000;
}

function normalizeDirection(value) {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return '';
  const aliases = [
    ['NORTH EAST', 'NE'], ['NORTHEAST', 'NE'], ['ตะวันออกเฉียงเหนือ', 'NE'],
    ['SOUTH EAST', 'SE'], ['SOUTHEAST', 'SE'], ['ตะวันออกเฉียงใต้', 'SE'],
    ['SOUTH WEST', 'SW'], ['SOUTHWEST', 'SW'], ['ตะวันตกเฉียงใต้', 'SW'],
    ['NORTH WEST', 'NW'], ['NORTHWEST', 'NW'], ['ตะวันตกเฉียงเหนือ', 'NW'],
    ['NORTH', 'N'], ['เหนือ', 'N'], ['EAST', 'E'], ['ตะวันออก', 'E'],
    ['SOUTH', 'S'], ['ใต้', 'S'], ['WEST', 'W'], ['ตะวันตก', 'W']
  ];
  for (const [label, code] of aliases) if (raw.includes(label.toUpperCase())) return code;
  const compass = raw.match(/\b(N|NE|E|SE|S|SW|W|NW)\b/);
  return compass ? compass[1] : raw.replace(/\s+/g, ' ').slice(0, 24);
}

function tokenize(value) {
  return new Set(String(value || '')
    .toLocaleLowerCase('th-TH')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2));
}

function textSimilarity(a, b) {
  const left = tokenize(a);
  const right = tokenize(b);
  if (!left.size || !right.size) return 0;
  let common = 0;
  for (const token of left) if (right.has(token)) common += 1;
  return common / Math.max(left.size, right.size);
}

function reportText(report) {
  return [report.appearance_notes, report.description, report.location_name].filter(Boolean).join(' ');
}

function correlationScore(a, b) {
  const reasons = [];
  let score = 0;
  const timeMinutes = minutesApart(a, b);
  const distanceM = distanceMeters(a, b);

  if (timeMinutes <= 5) { score += 30; reasons.push('เวลาใกล้กันมาก'); }
  else if (timeMinutes <= 15) { score += 24; reasons.push('เวลาใกล้กัน'); }
  else if (timeMinutes <= 30) { score += 15; reasons.push('อยู่ในช่วงเวลาเดียวกัน'); }
  else if (timeMinutes <= 60) { score += 6; }

  if (distanceM <= 300) { score += 25; reasons.push('ตำแหน่งใกล้กันมาก'); }
  else if (distanceM <= 1000) { score += 20; reasons.push('ตำแหน่งใกล้กัน'); }
  else if (distanceM <= 3000) { score += 12; reasons.push('อยู่ในพื้นที่ใกล้เคียง'); }
  else if (distanceM <= 8000) { score += 5; }

  const directionA = normalizeDirection(a.direction);
  const directionB = normalizeDirection(b.direction);
  if (directionA && directionB && directionA === directionB) {
    score += 18;
    reasons.push(`ทิศทางตรงกัน (${directionA})`);
  }

  if (a.object_type && b.object_type && a.object_type === b.object_type) {
    score += 10;
    reasons.push('ประเภทวัตถุตรงกัน');
  }

  const similarity = textSimilarity(reportText(a), reportText(b));
  if (similarity >= 0.5) { score += 17; reasons.push('ลักษณะ/รายละเอียดคล้ายกันมาก'); }
  else if (similarity >= 0.25) { score += 10; reasons.push('ลักษณะ/รายละเอียดคล้ายกัน'); }
  else if (similarity >= 0.1) { score += 4; }

  if (a.object_count && b.object_count && Number(a.object_count) === Number(b.object_count)) {
    score += 5;
    reasons.push('จำนวนวัตถุตรงกัน');
  }

  return {
    score: Math.min(100, score),
    timeMinutes: Math.round(timeMinutes),
    distanceM: Math.round(distanceM),
    reasons
  };
}

function buildCorrelations(reports, decisions = new Map()) {
  const candidates = [];
  for (let i = 0; i < reports.length; i += 1) {
    for (let j = i + 1; j < reports.length; j += 1) {
      const a = reports[i];
      const b = reports[j];
      if (minutesApart(a, b) > 60) continue;
      const result = correlationScore(a, b);
      if (result.distanceM > 10000 || result.score < 55) continue;
      const firstId = Math.min(Number(a.id), Number(b.id));
      const secondId = Math.max(Number(a.id), Number(b.id));
      const decision = decisions.get(`${firstId}:${secondId}`) || null;
      candidates.push({
        id: `${firstId}:${secondId}`,
        reportA: a,
        reportB: b,
        ...result,
        decision
      });
    }
  }
  return candidates.sort((a, b) => b.score - a.score || a.distanceM - b.distanceM).slice(0, 30);
}

function buildHotZones(reports, windowMinutes = 30, radiusM = 1000, minReports = 3) {
  const cutoff = Date.now() - windowMinutes * 60000;
  const recent = reports.filter((report) => {
    const time = new Date(report.occurred_at || report.submitted_at).getTime();
    return Number.isFinite(time) && time >= cutoff;
  });
  const visited = new Set();
  const zones = [];

  for (const seed of recent) {
    if (visited.has(seed.id)) continue;
    const queue = [seed];
    const members = [];
    visited.add(seed.id);
    while (queue.length) {
      const current = queue.shift();
      members.push(current);
      for (const candidate of recent) {
        if (visited.has(candidate.id)) continue;
        if (distanceMeters(current, candidate) <= radiusM) {
          visited.add(candidate.id);
          queue.push(candidate);
        }
      }
    }
    if (members.length < minReports) continue;
    const lat = members.reduce((sum, item) => sum + Number(item.incident_lat), 0) / members.length;
    const lng = members.reduce((sum, item) => sum + Number(item.incident_lng), 0) / members.length;
    const maxDistance = Math.max(...members.map((item) => distanceMeters({ incident_lat: lat, incident_lng: lng }, item)), radiusM * 0.45);
    zones.push({
      id: `zone-${members.map((item) => item.id).sort((a, b) => a - b).join('-')}`,
      lat,
      lng,
      radiusM: Math.min(Math.max(Math.round(maxDistance + 200), 500), 3000),
      reportCount: members.length,
      criticalCount: members.filter((item) => (item.effective_severity || item.operator_severity || item.reporter_severity) === 'CRITICAL').length,
      reportIds: members.map((item) => Number(item.id)),
      reportNos: members.map((item) => item.report_no),
      latestAt: members.map((item) => new Date(item.occurred_at || item.submitted_at).getTime()).sort((a, b) => b - a)[0]
    });
  }
  return zones.sort((a, b) => b.reportCount - a.reportCount || b.latestAt - a.latestAt);
}

module.exports = { buildCorrelations, buildHotZones };
