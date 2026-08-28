(() => {
  const MAX_FILES = 5;
  const MAX_BYTES = 50 * 1024 * 1024;
  const form = document.getElementById('reportForm');
  const steps = [...document.querySelectorAll('.form-step')];
  const stepButtons = [...document.querySelectorAll('.step-item')];
  const fileInput = document.getElementById('images');
  const previewGrid = document.getElementById('previewGrid');
  const fileCount = document.getElementById('fileCount');
  const fileSize = document.getElementById('fileSize');
  const alertBox = document.getElementById('formAlert');
  const submitBtn = document.getElementById('submitBtn');
  const reviewSummary = document.getElementById('reviewSummary');
  let currentStep = 1;
  let selectedFiles = [];
  let map;
  let incidentMarker;
  let accuracyCircle;

  const $ = (selector) => document.querySelector(selector);
  const formValue = (name) => form.elements[name]?.value?.trim?.() ?? form.elements[name]?.value ?? '';

  async function initLineIdentity() {
    if (!window.liff) return;
    const config = await fetch('/api/line/config').then((r) => r.json()).catch(() => ({ enabled: false }));
    if (!config.enabled || !config.liffId) return;

    await liff.init({ liffId: config.liffId });
    if (!liff.isLoggedIn()) return;

    const idToken = liff.getIDToken();
    if (!idToken) return;

    const response = await fetch('/api/line/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.verified) return;

    const profile = data.profile || {};
    const nameInput = document.getElementById('reporterName');
    const emailInput = document.getElementById('reporterEmail');
    if (profile.displayName) {
      nameInput.value = profile.displayName;
      nameInput.readOnly = true;
    }
    if (profile.email && !emailInput.value) emailInput.value = profile.email;

    const box = document.getElementById('lineIdentity');
    const avatar = profile.pictureUrl
      ? `<img src="${escapeHtml(profile.pictureUrl)}" alt="LINE profile">`
      : '<span class="line-avatar-fallback">L</span>';
    box.innerHTML = `${avatar}<div><strong>ยืนยันตัวตนผ่าน LINE แล้ว</strong><small>${escapeHtml(profile.displayName || 'LINE User')}</small></div><span class="verified-badge">Verified</span>`;
    box.classList.remove('d-none');
  }

  const defaultFavicon = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%230878ff%22/%3E%3Cpath d=%22M18 32h28M32 18v28%22 stroke=%22white%22 stroke-width=%226%22 stroke-linecap=%22round%22/%3E%3C/svg%3E';
  function setFavicon(href) {
    let link = document.querySelector('link[rel="icon"]');
    if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
    link.href = href || defaultFavicon;
  }

  async function initBranding() {
    const branding = await fetch('/api/branding').then((r) => r.json()).catch(() => ({}));
    const title = branding.app_title || 'D DRONE';
    const organization = branding.organization_name || 'ศูนย์ควบคุมและเฝ้าระวังอากาศยาน';
    document.getElementById('reportBrandTitle').textContent = title;
    document.getElementById('reportOrganization').textContent = organization;
    document.title = `${title} · แจ้งเหตุ`;
    setFavicon(branding.app_logo_url);
    const logo = document.getElementById('reportBrandLogo');
    const fallback = document.getElementById('reportBrandFallback');
    if (branding.app_logo_url) {
      logo.src = branding.app_logo_url;
      logo.classList.remove('d-none');
      fallback.classList.add('d-none');
    } else {
      logo.removeAttribute('src');
      logo.classList.add('d-none');
      fallback.classList.remove('d-none');
    }
  }

  function setNow() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('occurredAt').value = now.toISOString().slice(0, 16);
  }

  function showStep(step) {
    currentStep = Math.max(1, Math.min(3, step));
    steps.forEach((el) => el.classList.toggle('active', Number(el.dataset.step) === currentStep));
    stepButtons.forEach((el, index) => {
      const n = index + 1;
      el.classList.toggle('active', n === currentStep);
      el.classList.toggle('done', n < currentStep);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (currentStep === 3) buildReview();
  }

  function setReporterTypeUI() {
    const type = formValue('reporterType');
    document.querySelectorAll('.choice-card').forEach((card) => {
      card.classList.toggle('selected', card.querySelector('input').checked);
    });
    const identity = document.getElementById('identityFields');
    identity.classList.toggle('d-none', type === 'ANONYMOUS');
    document.querySelectorAll('.official-only').forEach((el) => el.classList.toggle('d-none', type !== 'OFFICIAL'));
  }

  function setObjectTypeUI() {
    document.querySelectorAll('.object-card').forEach((card) => {
      card.classList.toggle('selected', card.querySelector('input').checked);
    });
  }

  function validateStep(step) {
    clearAlert();
    if (step === 1) {
      const reporterType = formValue('reporterType');
      if (reporterType === 'PUBLIC' && !formValue('reporterName')) return fail('กรุณาระบุชื่อผู้รายงาน หรือเลือกไม่ระบุตัวตน');
      if (reporterType === 'OFFICIAL' && !formValue('organization')) return fail('กรุณาระบุชื่อหน่วยงาน');
      if (!formValue('occurredAt')) return fail('กรุณาระบุวันและเวลาที่ตรวจพบ');
      if (!formValue('incidentLat') || !formValue('incidentLng')) return fail('กรุณาปักตำแหน่งที่พบเหตุบนแผนที่');
    }
    return true;
  }

  function fail(message) {
    window.alert(message);
    return false;
  }

  function initMap() {
    map = L.map('reportMap', { zoomControl: true }).setView([13.7563, 100.5018], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    map.on('click', (event) => setIncidentPoint(event.latlng.lat, event.latlng.lng, true));
  }

  function setIncidentPoint(lat, lng, center = false) {
    if (!incidentMarker) {
      incidentMarker = L.marker([lat, lng], { draggable: true }).addTo(map);
      incidentMarker.on('dragend', (event) => {
        const point = event.target.getLatLng();
        setIncidentPoint(point.lat, point.lng, false);
      });
    } else {
      incidentMarker.setLatLng([lat, lng]);
    }
    document.getElementById('incidentLat').value = Number(lat).toFixed(7);
    document.getElementById('incidentLng').value = Number(lng).toFixed(7);
    document.getElementById('coordinateText').textContent = `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`;
    if (center) map.flyTo([lat, lng], Math.max(map.getZoom(), 16), { duration: .7 });
  }

  function locateMe() {
    const btn = document.getElementById('locateBtn');
    if (!navigator.geolocation) return fail('อุปกรณ์นี้ไม่รองรับ GPS');
    btn.disabled = true;
    btn.textContent = 'กำลังหาตำแหน่ง...';
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        document.getElementById('reporterLat').value = latitude.toFixed(7);
        document.getElementById('reporterLng').value = longitude.toFixed(7);
        document.getElementById('gpsAccuracyM').value = Math.round(accuracy);
        setIncidentPoint(latitude, longitude, true);
        if (accuracyCircle) accuracyCircle.remove();
        accuracyCircle = L.circle([latitude, longitude], {
          radius: Math.max(accuracy, 5),
          weight: 1,
          fillOpacity: .08
        }).addTo(map);
        btn.disabled = false;
        btn.textContent = '⌖ ใช้ตำแหน่งของฉัน';
      },
      (error) => {
        btn.disabled = false;
        btn.textContent = '⌖ ใช้ตำแหน่งของฉัน';
        fail(error.code === 1 ? 'กรุณาอนุญาตการเข้าถึงตำแหน่ง หรือแตะเลือกตำแหน่งบนแผนที่เอง' : 'ไม่สามารถอ่านตำแหน่งได้ กรุณาปักหมุดบนแผนที่เอง');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 }
    );
  }

  function handleFiles(event) {
    const incoming = [...event.target.files];
    const merged = [...selectedFiles];
    for (const file of incoming) {
      if (!file.type.startsWith('image/')) continue;
      if (merged.length >= MAX_FILES) break;
      const duplicate = merged.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified);
      if (!duplicate) merged.push(file);
    }
    const total = merged.reduce((sum, file) => sum + file.size, 0);
    if (total > MAX_BYTES) {
      fileInput.value = '';
      return fail('ขนาดรูปภาพรวมต้องไม่เกิน 50 MB');
    }
    selectedFiles = merged.slice(0, MAX_FILES);
    renderFiles();
    fileInput.value = '';
  }

  function renderFiles() {
    previewGrid.innerHTML = '';
    selectedFiles.forEach((file, index) => {
      const item = document.createElement('div');
      item.className = 'preview-item';
      const img = document.createElement('img');
      img.alt = file.name;
      img.src = URL.createObjectURL(file);
      img.onload = () => URL.revokeObjectURL(img.src);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.innerHTML = '×';
      remove.setAttribute('aria-label', `ลบ ${file.name}`);
      remove.addEventListener('click', () => {
        selectedFiles.splice(index, 1);
        renderFiles();
        buildReview();
      });
      item.append(img, remove);
      previewGrid.appendChild(item);
    });
    const bytes = selectedFiles.reduce((sum, file) => sum + file.size, 0);
    fileCount.textContent = `${selectedFiles.length} รูป`;
    fileSize.textContent = `${(bytes / 1024 / 1024).toFixed(1)} MB / 50 MB`;
  }

  function labelReporter(type) {
    return { ANONYMOUS: 'ไม่ระบุตัวตน', PUBLIC: 'บุคคลทั่วไป', OFFICIAL: 'หน่วยงาน' }[type] || type;
  }
  function labelObject(type) {
    return { DRONE: 'โดรน', AIRCRAFT: 'อากาศยาน', UNKNOWN: 'ไม่สามารถระบุ' }[type] || type;
  }
  function labelSeverity(value) {
    return { LOW: 'ต่ำ', MEDIUM: 'ปานกลาง', HIGH: 'สูง', CRITICAL: 'ฉุกเฉิน' }[value] || value;
  }

  function buildReview() {
    const reporterType = formValue('reporterType');
    const coordinates = formValue('incidentLat') && formValue('incidentLng')
      ? `${Number(formValue('incidentLat')).toFixed(6)}, ${Number(formValue('incidentLng')).toFixed(6)}`
      : '-';
    const items = [
      ['ผู้รายงาน', reporterType === 'ANONYMOUS' ? 'ไม่ระบุตัวตน' : (formValue('reporterName') || labelReporter(reporterType))],
      ['ประเภทผู้รายงาน', labelReporter(reporterType)],
      ['วัน / เวลา', formValue('occurredAt') ? new Date(formValue('occurredAt')).toLocaleString('th-TH') : '-'],
      ['ตำแหน่ง', coordinates],
      ['สถานที่', formValue('locationName') || '-'],
      ['ประเภทที่พบ', labelObject(formValue('objectType'))],
      ['ระดับที่ผู้แจ้งประเมิน', labelSeverity(formValue('reporterSeverity'))],
      ['หลักฐาน', `${selectedFiles.length} รูป`]
    ];
    reviewSummary.innerHTML = items.map(([label, value]) => `<div class="review-row"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></div>`).join('');
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  function clearAlert() {
    alertBox.className = 'alert d-none mt-3';
    alertBox.textContent = '';
  }

  function showAlert(message, type = 'danger') {
    alertBox.className = `alert alert-${type} mt-3`;
    alertBox.textContent = message;
  }

  async function submitReport(event) {
    event.preventDefault();
    clearAlert();
    if (!validateStep(1)) return;

    const payload = new FormData(form);
    payload.delete('images');
    selectedFiles.forEach((file) => payload.append('images', file, file.name));

    submitBtn.disabled = true;
    submitBtn.textContent = 'กำลังส่งรายงาน...';

    try {
      const response = await fetch('/api/reports', { method: 'POST', body: payload });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'ส่งรายงานไม่สำเร็จ');

      form.classList.add('d-none');
      document.getElementById('stepper').classList.add('d-none');
      document.querySelector('.intro-card').classList.add('d-none');
      document.getElementById('successReportNo').textContent = data.reportNo;
      document.getElementById('successPanel').classList.remove('d-none');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      showAlert(error.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'ส่งรายงานเหตุ';
    }
  }

  document.querySelectorAll('[data-next]').forEach((btn) => btn.addEventListener('click', () => {
    if (validateStep(currentStep)) showStep(currentStep + 1);
  }));
  document.querySelectorAll('[data-prev]').forEach((btn) => btn.addEventListener('click', () => showStep(currentStep - 1)));
  stepButtons.forEach((btn) => btn.addEventListener('click', () => {
    const target = Number(btn.dataset.stepTarget);
    if (target < currentStep || validateStep(currentStep)) showStep(target);
  }));
  document.querySelectorAll('input[name="reporterType"]').forEach((el) => el.addEventListener('change', setReporterTypeUI));
  document.querySelectorAll('input[name="objectType"]').forEach((el) => el.addEventListener('change', setObjectTypeUI));
  document.getElementById('locateBtn').addEventListener('click', locateMe);
  fileInput.addEventListener('change', handleFiles);
  form.addEventListener('submit', submitReport);
  form.addEventListener('input', () => currentStep === 3 && buildReview());
  document.getElementById('newReportBtn').addEventListener('click', () => window.location.reload());

  setNow();
  setReporterTypeUI();
  setObjectTypeUI();
  initMap();
  initBranding();
  initLineIdentity().catch((error) => console.warn('LINE LIFF init skipped:', error.message));
})();
