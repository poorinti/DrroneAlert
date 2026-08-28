const state = { reports: [], markers: new Map(), selectedId: null, user: null, settings: { app_title: 'D DRONE', app_logo_path: '' } };
let map;

const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
const fmtDate = (v) => v ? new Intl.DateTimeFormat('th-TH', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(v)) : '-';
const severity = (r) => r.effective_severity || r.operator_severity || r.reporter_severity || 'MEDIUM';
const sevColor = (s) => ({ CRITICAL: '#e6384f', HIGH: '#ef7138', MEDIUM: '#e6a528', LOW: '#4b8da3' }[s] || '#62728a');
const sourceLabel = (v) => v === 'LINE_LIFF' ? 'LINE' : 'WEB';

async function api(url, options = {}) {
  const res = await fetch(url, options);
  if (res.status === 401) { location.href = '/login/'; throw new Error('unauthorized'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด');
  return data;
}

async function init() {
  const me = await fetch('/api/auth/me').then((r) => r.json()).catch(() => ({}));
  if (!me.user) return location.href = '/login/';
  state.user = me.user;
  $('userInitial').textContent = String(me.user.username || 'U').slice(0, 1).toUpperCase();
  $('userBadge').innerHTML = `<strong>${esc(me.user.username)}</strong><small>${esc(me.user.role.replace('_', ' '))}</small>`;
  if (me.user.role === 'SUPER_ADMIN') $('settingsBtn').classList.remove('d-none');
  $('authLoading').remove();
  $('app').classList.remove('d-none');

  map = L.map('map', { zoomControl: true, preferCanvas: true }).setView([15.87, 100.99], 6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
  bindEvents();
  await Promise.all([loadSettings(), refreshAll()]);
  connectRealtime();
  setTimeout(() => map.invalidateSize(), 150);
}

function bindEvents() {
  $('logoutBtn').onclick = async () => { await fetch('/api/auth/logout', { method: 'POST' }); location.href = '/login/'; };
  $('changePasswordBtn').onclick = openPasswordModal;
  $('closePasswordModal').onclick = closePasswordModal;
  $('passwordModal').onclick = (e) => { if (e.target === $('passwordModal')) closePasswordModal(); };
  $('savePasswordBtn').onclick = changePassword;
  $('refreshBtn').onclick = refreshAll;
  $('closeDrawer').onclick = closeDrawer;
  $('severityFilter').onchange = loadReports;
  $('statusFilter').onchange = loadReports;
  $('clearFilters').onclick = () => { $('severityFilter').value = ''; $('statusFilter').value = ''; loadReports(); };
  let timer;
  $('searchInput').oninput = () => { clearTimeout(timer); timer = setTimeout(loadReports, 300); };
  $('settingsBtn').onclick = openSettingsModal;
  $('closeSettingsModal').onclick = closeSettingsModal;
  $('settingsModal').onclick = (e) => { if (e.target === $('settingsModal')) closeSettingsModal(); };
  $('settingsForm').onsubmit = saveSettings;
  $('appLogoInput').onchange = previewLogo;
  $('closeLightbox').onclick = closeLightbox;
  $('imageLightbox').onclick = (e) => { if (e.target === $('imageLightbox')) closeLightbox(); };
  document.onkeydown = (e) => { if (e.key === 'Escape') { closeLightbox(); closeSettingsModal(); closePasswordModal(); } };
}

async function refreshAll() { await Promise.all([loadReports(), loadStats()]); }
async function loadStats() {
  const s = await api('/api/admin/stats');
  $('statTotal').textContent = s.total || 0; $('statToday').textContent = s.today || 0; $('statActive').textContent = s.active || 0; $('statCritical').textContent = s.critical || 0;
}
async function loadReports() {
  const p = new URLSearchParams();
  if ($('severityFilter').value) p.set('severity', $('severityFilter').value);
  if ($('statusFilter').value) p.set('status', $('statusFilter').value);
  if ($('searchInput').value.trim()) p.set('search', $('searchInput').value.trim());
  state.reports = await api(`/api/admin/reports?${p}`);
  renderReports(); renderMarkers();
}

function renderReports() {
  $('reportCount').textContent = `${state.reports.length} รายการ`;
  $('reportList').innerHTML = state.reports.length ? state.reports.map((r) => {
    const thumb = r.cover_image ? `<img src="/uploads/${esc(r.cover_image)}" alt="">` : '<i class="bi bi-camera"></i>';
    return `<article class="report-item ${Number(r.id) === state.selectedId ? 'active' : ''}" data-id="${r.id}" tabindex="0"><div class="report-thumb">${thumb}</div><div class="report-body"><div class="report-item-top"><span class="sev-pill sev-${severity(r)}">${severity(r)}</span><span class="report-no">${esc(r.report_no)}</span></div><div class="report-location">${esc(r.location_name || 'ไม่ระบุชื่อสถานที่')}</div><div class="report-meta"><span class="source-pill">${sourceLabel(r.source)}</span><span>${esc(r.status)}</span><span class="report-time">${fmtDate(r.submitted_at)}</span></div></div></article>`;
  }).join('') : '<div class="empty-detail">ยังไม่มีรายงานที่ตรงกับตัวกรอง</div>';
  document.querySelectorAll('.report-item').forEach((el) => {
    el.onclick = () => selectReport(Number(el.dataset.id), true);
    el.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') selectReport(Number(el.dataset.id), true); };
  });
}

function markerIcon(r) {
  const selected = Number(r.id) === state.selectedId ? ' selected' : '';
  return L.divIcon({ className: '', html: `<div class="incident-marker${selected}" style="background:${sevColor(severity(r))}"></div>`, iconSize: [24, 24], iconAnchor: [12, 22], popupAnchor: [0, -20] });
}
function renderMarkers() {
  const visible = new Set(state.reports.map((r) => Number(r.id)));
  for (const [id, marker] of state.markers) if (!visible.has(id)) { map.removeLayer(marker); state.markers.delete(id); }
  for (const r of state.reports) {
    const id = Number(r.id), lat = Number(r.incident_lat), lng = Number(r.incident_lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const popupImage = r.cover_image ? `<img src="/uploads/${esc(r.cover_image)}" alt="ภาพเหตุการณ์">` : '';
    const popupHtml = `<div class="incident-popup">${popupImage}<div class="popup-body"><div class="popup-head"><strong>${esc(r.report_no)}</strong><span class="sev-pill sev-${severity(r)}">${severity(r)}</span></div><div class="popup-location">${esc(r.location_name || 'ไม่ระบุชื่อสถานที่')}</div><div class="popup-time">${fmtDate(r.submitted_at)}</div><button class="popup-link" onclick="window.openIncident(${id})">ดูรายละเอียด <i class="bi bi-arrow-right"></i></button></div></div>`;
    let marker = state.markers.get(id);
    if (!marker) { marker = L.marker([lat, lng], { icon: markerIcon(r) }).addTo(map); marker.on('click', () => selectReport(id, false)); state.markers.set(id, marker); }
    else { marker.setLatLng([lat, lng]); marker.setIcon(markerIcon(r)); }
    marker.bindPopup(popupHtml, { maxWidth: 250, closeButton: false, offset: [0, -2] });
  }
}

window.openIncident = (id) => selectReport(Number(id), false);
async function selectReport(id, fly) {
  state.selectedId = id; renderReports(); renderMarkers();
  const r = state.reports.find((x) => Number(x.id) === id);
  const marker = state.markers.get(id);
  if (r && fly) map.flyTo([Number(r.incident_lat), Number(r.incident_lng)], Math.max(map.getZoom(), 14), { duration: 0.8 });
  if (marker) setTimeout(() => marker.openPopup(), fly ? 650 : 0);
  $('app').classList.add('drawer-open'); $('detailDrawer').setAttribute('aria-hidden', 'false');
  $('detailContent').innerHTML = '<div class="empty-detail">กำลังโหลด...</div>';
  try { renderDetail(await api(`/api/admin/reports/${id}`)); } catch (e) { $('detailContent').innerHTML = `<div class="empty-detail">${esc(e.message)}</div>`; }
}
function closeDrawer() {
  $('app').classList.remove('drawer-open'); $('detailDrawer').setAttribute('aria-hidden', 'true'); state.selectedId = null;
  map.closePopup(); renderReports(); renderMarkers();
}

function renderDetail({ report: r, images, notes, history }) {
  const sev = r.operator_severity || r.reporter_severity;
  const canEdit = ['SUPER_ADMIN', 'OPERATOR'].includes(state.user.role);
  const hero = images.length ? `<div class="hero-gallery"><img src="/uploads/${esc(images[0].file_path)}" alt="ภาพเหตุการณ์" data-lightbox><span class="image-count"><i class="bi bi-images"></i> ${images.length} ภาพ</span></div>` : '<div class="hero-gallery"><div class="hero-placeholder"><i class="bi bi-camera"></i></div></div>';
  $('detailContent').innerHTML = `${hero}<div class="detail-inner"><div class="detail-head"><span class="sev-pill sev-${sev}">${sev}</span><h2>${esc(r.report_no)}</h2><div class="detail-sub"><span class="status-pill">${esc(r.status)}</span><span>${fmtDate(r.submitted_at)}</span></div></div>
  <section class="detail-section"><h3>ข้อมูลเหตุการณ์</h3>${kv('ประเภทวัตถุ', objectLabel(r.object_type))}${kv('สถานที่', r.location_name || '-')}${kv('เวลาที่พบ', fmtDate(r.occurred_at))}${kv('พิกัด', `${r.incident_lat}, ${r.incident_lng}`)}${kv('ทิศทาง', r.direction || '-')}${kv('ความเร็ว', r.speed_estimate || '-')}${kv('ความสูง', r.altitude_estimate || '-')}${kv('ระยะห่าง', r.distance_estimate || '-')}${kv('จำนวน', r.object_count || '-')}<div class="description-box">${esc(r.description || r.appearance_notes || 'ไม่มีรายละเอียดเพิ่มเติม')}</div></section>
  <section class="detail-section"><h3>ผู้รายงานและช่องทาง</h3>${kv('ช่องทาง', sourceLabel(r.source))}${kv('ประเภทผู้รายงาน', r.reporter_type || '-')}${kv('ชื่อ', r.line_display_name || r.reporter_name || 'ไม่ระบุตัวตน')}${kv('หน่วยงาน', r.organization || '-')}${r.phone ? kv('โทรศัพท์', r.phone) : ''}</section>
  ${images.length > 1 ? `<section class="detail-section"><h3>ภาพทั้งหมด</h3><div class="detail-thumbs">${images.map((i) => `<img src="/uploads/${esc(i.file_path)}" alt="ภาพเหตุการณ์" data-lightbox>`).join('')}</div></section>` : ''}
  ${canEdit ? `<section class="detail-section"><h3>Operator Controls</h3><div class="action-row"><select id="detailStatus">${options(['NEW', 'ACKNOWLEDGED', 'INVESTIGATING', 'VERIFIED', 'FALSE_ALARM', 'RESOLVED', 'CLOSED'], r.status)}</select><select id="detailSeverity">${options(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], r.operator_severity || '')}</select></div><button id="saveStateBtn" class="primary-btn">บันทึกสถานะ / ระดับ</button><div class="note-box"><textarea id="noteInput" rows="3" placeholder="เพิ่มบันทึกสำหรับเจ้าหน้าที่..."></textarea><button id="addNoteBtn" class="primary-btn">เพิ่มบันทึก</button></div></section>` : ''}
  <section class="detail-section"><h3>บันทึกเจ้าหน้าที่</h3><div class="history-list">${notes.length ? notes.map((n) => timelineItem(n.username, n.note, fmtDate(n.created_at))).join('') : '<small>ยังไม่มีบันทึก</small>'}</div></section>
  <section class="detail-section"><h3>Timeline</h3><div class="history-list">${history.length ? history.map((h) => timelineItem(actionLabel(h.action), `${h.old_value || ''} ${h.old_value || h.new_value ? '→' : ''} ${h.new_value || ''}`, `${h.username || 'System'} · ${fmtDate(h.created_at)}`)).join('') : '<small>ยังไม่มีประวัติ</small>'}</div></section></div>`;
  document.querySelectorAll('[data-lightbox]').forEach((img) => { img.onclick = () => openLightbox(img.src); });
  if (canEdit) { $('saveStateBtn').onclick = () => saveState(r.id); $('addNoteBtn').onclick = () => addNote(r.id); }
}
function kv(a, b) { return `<div class="kv"><span>${esc(a)}</span><span>${esc(b)}</span></div>`; }
function options(vals, current) { return '<option value="">-- ไม่เปลี่ยน --</option>' + vals.map((x) => `<option ${x === current ? 'selected' : ''}>${x}</option>`).join(''); }
function timelineItem(title, body, time) { return `<div class="history-item"><strong>${esc(title)}</strong><div>${esc(body || '')}</div><span>${esc(time || '')}</span></div>`; }
function objectLabel(v) { return ({ DRONE: 'Drone', AIRCRAFT: 'Aircraft', UNKNOWN: 'Unknown' }[v] || v || '-'); }
function actionLabel(v) { return ({ REPORT_CREATED: 'สร้างรายงาน', STATUS_CHANGED: 'เปลี่ยนสถานะ', SEVERITY_CHANGED: 'เปลี่ยนระดับ', NOTE_ADDED: 'เพิ่มบันทึก' }[v] || v); }

async function saveState(id) {
  const body = {}; if ($('detailStatus').value) body.status = $('detailStatus').value; if ($('detailSeverity').value) body.operatorSeverity = $('detailSeverity').value;
  if (!Object.keys(body).length) return toast('ยังไม่มีข้อมูลที่เปลี่ยน');
  await api(`/api/admin/reports/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); toast('บันทึกเรียบร้อย'); await refreshAll(); await selectReport(id, false);
}
async function addNote(id) {
  const note = $('noteInput').value.trim(); if (!note) return;
  await api(`/api/admin/reports/${id}/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note }) }); toast('เพิ่มบันทึกแล้ว'); await selectReport(id, false);
}
function connectRealtime() {
  const socket = io();
  socket.on('report:new', async () => { toast('มีรายงานใหม่เข้ามา'); await refreshAll(); });
  socket.on('report:updated', async (e) => { await refreshAll(); if (state.selectedId === Number(e.id)) await selectReport(Number(e.id), false); });
}

async function loadSettings() { try { applySettings(await api('/api/admin/settings')); } catch (e) { console.warn('settings unavailable', e); } }
function applySettings(settings) {
  state.settings = { ...state.settings, ...settings };
  const title = state.settings.app_title || 'D DRONE'; $('brandTitle').textContent = title; document.title = `${title} · Live Command`;
  $('brandMark').innerHTML = state.settings.app_logo_path ? `<img src="/uploads/${esc(state.settings.app_logo_path)}" alt="${esc(title)} logo">` : '<i class="bi bi-shield-check"></i>';
}
function openSettingsModal() {
  $('appTitleInput').value = state.settings.app_title || 'D DRONE'; $('appLogoInput').value = ''; $('settingsError').classList.add('d-none'); setLogoPreview(state.settings.app_logo_path ? `/uploads/${state.settings.app_logo_path}` : '');
  $('settingsModal').classList.add('open'); $('settingsModal').setAttribute('aria-hidden', 'false');
}
function closeSettingsModal() { $('settingsModal').classList.remove('open'); $('settingsModal').setAttribute('aria-hidden', 'true'); }
function previewLogo() { const file = $('appLogoInput').files[0]; if (file) setLogoPreview(URL.createObjectURL(file)); }
function setLogoPreview(src) { $('logoPreview').classList.toggle('d-none', !src); $('logoPreviewFallback').classList.toggle('d-none', Boolean(src)); if (src) $('logoPreview').src = src; }
async function saveSettings(e) {
  e.preventDefault(); const err = $('settingsError'); err.classList.add('d-none'); const btn = $('saveSettingsBtn'); btn.disabled = true; btn.textContent = 'กำลังบันทึก...';
  try { const settings = await api('/api/admin/settings', { method: 'POST', body: new FormData($('settingsForm')) }); applySettings(settings); closeSettingsModal(); toast('บันทึก Branding แล้ว'); }
  catch (error) { err.textContent = error.message; err.classList.remove('d-none'); }
  finally { btn.disabled = false; btn.textContent = 'บันทึกการตั้งค่า'; }
}

function openPasswordModal() { $('currentPassword').value = ''; $('newPassword').value = ''; $('confirmPassword').value = ''; $('passwordError').classList.add('d-none'); $('passwordModal').classList.add('open'); $('passwordModal').setAttribute('aria-hidden', 'false'); setTimeout(() => $('currentPassword').focus(), 50); }
function closePasswordModal() { $('passwordModal').classList.remove('open'); $('passwordModal').setAttribute('aria-hidden', 'true'); }
async function changePassword() {
  const currentPassword = $('currentPassword').value, newPassword = $('newPassword').value, confirmPassword = $('confirmPassword').value, err = $('passwordError'); err.classList.add('d-none');
  if (newPassword.length < 8) { err.textContent = 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร'; err.classList.remove('d-none'); return; }
  if (newPassword !== confirmPassword) { err.textContent = 'ยืนยันรหัสผ่านใหม่ไม่ตรงกัน'; err.classList.remove('d-none'); return; }
  const btn = $('savePasswordBtn'); btn.disabled = true; btn.textContent = 'กำลังบันทึก...';
  try { await api('/api/auth/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword, newPassword }) }); closePasswordModal(); toast('เปลี่ยนรหัสผ่านเรียบร้อย'); }
  catch (e) { err.textContent = e.message; err.classList.remove('d-none'); }
  finally { btn.disabled = false; btn.textContent = 'บันทึกรหัสผ่านใหม่'; }
}
function openLightbox(src) { $('lightboxImage').src = src; $('imageLightbox').classList.add('open'); $('imageLightbox').setAttribute('aria-hidden', 'false'); }
function closeLightbox() { $('imageLightbox').classList.remove('open'); $('imageLightbox').setAttribute('aria-hidden', 'true'); }
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2600); }

init().catch((e) => { console.error(e); if ($('authLoading')) $('authLoading').textContent = 'ไม่สามารถโหลด Dashboard ได้'; });
