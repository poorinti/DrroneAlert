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
  const aiSmartText = document.getElementById('aiSmartText');
  const aiSmartBtn = document.getElementById('aiSmartBtn');
  const aiSmartStatus = document.getElementById('aiSmartStatus');
  const aiSmartResult = document.getElementById('aiSmartResult');
  const aiSmartModel = document.getElementById('aiSmartModel');
  const aiMicBtn = document.getElementById('aiMicBtn');
  const searchPlaceBtn = document.getElementById('searchPlaceBtn');
  const placeSearchStatus = document.getElementById('placeSearchStatus');
  const placeSearchResults = document.getElementById('placeSearchResults');
  const mgrsInput = document.getElementById('mgrsInput');
  const mgrsPrecision = document.getElementById('mgrsPrecision');
  const applyMgrsBtn = document.getElementById('applyMgrsBtn');
  const mgrsStatus = document.getElementById('mgrsStatus');
  const coordinateCopyActions = document.getElementById('coordinateCopyActions');
  const copyGpsBtn = document.getElementById('copyGpsBtn');
  const copyMgrsBtn = document.getElementById('copyMgrsBtn');
  const copyBothBtn = document.getElementById('copyBothBtn');
  let currentStep = 1;
  let selectedFiles = [];
  let map;
  let incidentMarker;
  let accuracyCircle;

  const $ = (selector) => document.querySelector(selector);
  const formValue = (name) => form.elements[name]?.value?.trim?.() ?? form.elements[name]?.value ?? '';
  const coordinates = window.DroneCoordinates;

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
    document.getElementById('aiSmartCard')?.classList.toggle('d-none', currentStep !== 1);
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

  const aiFieldLabels = {
    reporterType: 'ประเภทผู้รายงาน', reporterName: 'ชื่อผู้รายงาน', organization: 'หน่วยงาน', phone: 'เบอร์โทร', email: 'อีเมล',
    occurredAt: 'วัน/เวลา', locationName: 'ชื่อสถานที่', incidentLat: 'พิกัด', incidentLng: 'พิกัด', objectType: 'ประเภทที่พบ',
    direction: 'ทิศทาง', speedEstimate: 'ความเร็ว', altitudeEstimate: 'ความสูง', distanceEstimate: 'ระยะห่าง', objectCount: 'จำนวน',
    reporterSeverity: 'ความเร่งด่วน', appearanceNotes: 'ลักษณะที่พบ', description: 'รายละเอียดเพิ่มเติม'
  };

  function markAiFilled(control) {
    const target = control.type === 'radio' ? control.closest('.choice-card, .object-card') : control;
    if (!target) return;
    target.classList.add('ai-filled');
    if (!control.dataset.aiHighlightBound) {
      const clear = () => target.classList.remove('ai-filled');
      control.addEventListener('input', clear);
      control.addEventListener('change', clear);
      control.dataset.aiHighlightBound = '1';
    }
  }

  function setSmartField(name, value) {
    if (value === undefined || value === null || value === '') return false;
    const controls = [...form.querySelectorAll(`[name="${name}"]`)];
    if (!controls.length) return false;

    if (controls[0].type === 'radio') {
      const chosen = controls.find((control) => control.value === String(value));
      if (!chosen) return false;
      chosen.checked = true;
      chosen.dispatchEvent(new Event('change', { bubbles: true }));
      markAiFilled(chosen);
      return true;
    }

    const control = controls[0];
    if (control.readOnly || control.disabled) return false;
    control.value = String(value);
    control.dispatchEvent(new Event('input', { bubbles: true }));
    control.dispatchEvent(new Event('change', { bubbles: true }));
    markAiFilled(control);
    return true;
  }

  function applySmartFields(fields = {}) {
    const applied = [];
    const coordinateKeys = new Set(['incidentLat', 'incidentLng']);
    Object.entries(fields).forEach(([name, value]) => {
      if (coordinateKeys.has(name)) return;
      if (setSmartField(name, value)) applied.push(name);
    });

    const lat = Number(fields.incidentLat);
    const lng = Number(fields.incidentLng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      setIncidentPoint(lat, lng, true);
      applied.push('incidentLat', 'incidentLng');
    }

    setReporterTypeUI();
    setObjectTypeUI();
    if (currentStep === 3) buildReview();
    return [...new Set(applied)];
  }

  async function initAiSmartFill() {
    try {
      const response = await fetch('/api/ai/config');
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.enabled) {
        aiSmartBtn.disabled = false;
        aiSmartModel.textContent = 'AI Key Active';
        aiSmartStatus.className = 'ai-smart-status';
        aiSmartStatus.textContent = '';
      } else {
        aiSmartBtn.disabled = true;
        aiSmartModel.textContent = 'AI Key Inactive';
        aiSmartStatus.className = 'ai-smart-status error';
        aiSmartStatus.textContent = '';
      }
    } catch (_) {
      aiSmartBtn.disabled = true;
      aiSmartModel.textContent = 'AI Key Inactive';
      aiSmartStatus.className = 'ai-smart-status error';
      aiSmartStatus.textContent = '';
    }
  }

  function initAiSpeechRecognition() {
    if (!aiMicBtn) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      aiMicBtn.disabled = true;
      aiMicBtn.title = 'เบราว์เซอร์นี้ยังไม่รองรับการถอดเสียงจากไมโครโฟน';
      aiMicBtn.querySelector('.ai-mic-label').textContent = 'ไม่รองรับไมก์';
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'th-TH';
    recognition.continuous = true;
    recognition.interimResults = true;
    let listening = false;
    let committedText = '';

    const stopListening = () => {
      if (!listening) return;
      recognition.stop();
    };

    recognition.addEventListener('start', () => {
      listening = true;
      committedText = aiSmartText.value.trim();
      aiMicBtn.classList.add('listening');
      aiMicBtn.setAttribute('aria-pressed', 'true');
      aiMicBtn.querySelector('.ai-mic-label').textContent = 'กำลังฟัง...';
      aiSmartStatus.className = 'ai-smart-status ready';
      aiSmartStatus.textContent = 'กำลังฟังเสียง พูดรายละเอียดเหตุการณ์ได้เลย';
    });

    recognition.addEventListener('result', (event) => {
      let finalText = '';
      let interimText = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index][0]?.transcript?.trim() || '';
        if (event.results[index].isFinal) finalText += `${transcript} `;
        else interimText += `${transcript} `;
      }
      if (finalText.trim()) committedText = [committedText, finalText.trim()].filter(Boolean).join(' ').trim();
      aiSmartText.value = [committedText, interimText.trim()].filter(Boolean).join(' ').trim();
      aiSmartText.dispatchEvent(new Event('input', { bubbles: true }));
    });

    recognition.addEventListener('end', () => {
      listening = false;
      aiMicBtn.classList.remove('listening');
      aiMicBtn.setAttribute('aria-pressed', 'false');
      aiMicBtn.querySelector('.ai-mic-label').textContent = 'พูด';
      aiSmartStatus.className = 'ai-smart-status';
      aiSmartStatus.textContent = aiSmartText.value.trim() ? 'ถอดเสียงแล้ว ตรวจข้อความก่อนให้ AI แยกข้อมูลได้เลย' : '';
    });

    recognition.addEventListener('error', (event) => {
      const messages = {
        'not-allowed': 'กรุณาอนุญาตการใช้ไมโครโฟนในเบราว์เซอร์',
        'audio-capture': 'ไม่พบไมโครโฟนที่ใช้งานได้',
        'no-speech': 'ยังไม่ได้ยินเสียง กรุณาลองพูดอีกครั้ง'
      };
      aiSmartStatus.className = 'ai-smart-status error';
      aiSmartStatus.textContent = messages[event.error] || 'ไม่สามารถถอดเสียงได้ กรุณาลองใหม่';
    });

    aiMicBtn.addEventListener('click', () => {
      if (listening) return stopListening();
      if (!window.isSecureContext) {
        aiSmartStatus.className = 'ai-smart-status error';
        aiSmartStatus.textContent = 'ไมโครโฟนต้องใช้งานผ่าน HTTPS';
        return;
      }
      try { recognition.start(); }
      catch (_) { /* recognition may already be starting */ }
    });
  }

  async function runAiSmartFill() {
    const text = aiSmartText.value.trim();
    if (text.length < 3) return fail('กรุณาพิมพ์รายละเอียดที่ต้องการให้ AI แยกข้อมูล');

    aiSmartBtn.disabled = true;
    aiSmartBtn.textContent = 'กำลังแยกข้อมูล...';
    aiSmartStatus.className = 'ai-smart-status';
    aiSmartStatus.textContent = 'Gemini กำลังอ่านและจัดข้อมูลลงช่อง...';
    aiSmartResult.classList.add('d-none');
    aiSmartResult.textContent = '';

    try {
      const response = await fetch('/api/ai/smart-fill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'AI Smart Fill ไม่สำเร็จ');

      const fields = data.fields || {};
      const applied = applySmartFields(fields);
      let approximatePinned = false;
      if (fields.locationName && (fields.incidentLat === undefined || fields.incidentLng === undefined)) {
        approximatePinned = await searchAndPinPlace(fields.locationName);
      }
      const labels = [...new Set(applied.map((key) => aiFieldLabels[key]).filter(Boolean))];
      const messages = [];
      if (labels.length) messages.push(`เติมให้แล้ว ${labels.length} ช่อง: ${labels.join(', ')}`);
      if (approximatePinned) messages.push('ปักตำแหน่งประมาณการจากชื่อสถานที่ให้แล้ว กรุณาตรวจหมุดก่อนส่ง');
      if (Array.isArray(data.warnings)) messages.push(...data.warnings.filter((warning) => !approximatePinned || !String(warning).includes('ปักหมุด')));
      if (!messages.length) messages.push('AI ยังไม่พบข้อมูลที่มั่นใจพอ กรุณาเพิ่มรายละเอียดแล้วลองใหม่');

      aiSmartStatus.className = 'ai-smart-status ready';
      aiSmartStatus.textContent = labels.length ? 'แยกข้อมูลเรียบร้อย ตรวจแก้แต่ละช่องก่อนส่งได้เลย' : 'ยังไม่มีช่องที่เติมอัตโนมัติ';
      aiSmartResult.textContent = messages.join(' · ');
      aiSmartResult.classList.remove('d-none');
    } catch (error) {
      aiSmartStatus.className = 'ai-smart-status error';
      aiSmartStatus.textContent = error.message || 'AI Smart Fill ไม่สำเร็จ';
      aiSmartResult.textContent = 'ข้อมูลเดิมในฟอร์มยังอยู่ครบ สามารถกรอกเองหรือลอง AI ใหม่ได้';
      aiSmartResult.classList.remove('d-none');
    } finally {
      aiSmartBtn.disabled = false;
      aiSmartBtn.textContent = '✦ แยกข้อมูลและกรอกให้';
    }
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

  function renderPlaceResults(results) {
    placeSearchResults.innerHTML = '';
    results.forEach((result, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'place-search-option';
      button.textContent = `${index + 1}. ${result.display_name}`;
      button.addEventListener('click', () => {
        setIncidentPoint(result.lat, result.lng, true);
        placeSearchStatus.className = 'place-search-status';
        placeSearchStatus.textContent = `ตำแหน่งประมาณการ: ${result.display_name} · ตรวจหมุดก่อนส่งรายงาน`;
      });
      placeSearchResults.appendChild(button);
    });
    placeSearchResults.classList.toggle('d-none', !results.length);
  }

  async function searchAndPinPlace(queryText) {
    const query = String(queryText || '').trim();
    if (query.length < 2) {
      placeSearchStatus.className = 'place-search-status';
      placeSearchStatus.textContent = 'พิมพ์ชื่อสถานที่ก่อนค้นหา';
      placeSearchStatus.classList.remove('d-none');
      return false;
    }

    searchPlaceBtn.disabled = true;
    searchPlaceBtn.textContent = 'กำลังค้นหา...';
    placeSearchStatus.className = 'place-search-status';
    placeSearchStatus.textContent = `กำลังค้นหา “${query}”...`;
    placeSearchStatus.classList.remove('d-none');
    placeSearchResults.classList.add('d-none');
    placeSearchResults.innerHTML = '';

    try {
      const response = await fetch(`/api/reports/geocode?q=${encodeURIComponent(query)}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'ค้นหาสถานที่ไม่สำเร็จ');
      const results = Array.isArray(data.results) ? data.results : [];
      if (!results.length) throw new Error('ไม่พบสถานที่ที่ค้นหา');
      renderPlaceResults(results);
      setIncidentPoint(results[0].lat, results[0].lng, true);
      placeSearchStatus.className = 'place-search-status';
      placeSearchStatus.textContent = `ปักตำแหน่งประมาณการจาก “${query}” ให้แล้ว · ถ้าไม่ตรงให้เลือกผลลัพธ์อื่นหรือลากหมุดแก้`;
      return true;
    } catch (error) {
      placeSearchStatus.className = 'place-search-status text-danger';
      placeSearchStatus.textContent = error.message || 'ค้นหาสถานที่ไม่สำเร็จ';
      return false;
    } finally {
      searchPlaceBtn.disabled = false;
      searchPlaceBtn.textContent = '⌕ ค้นหาสถานที่';
    }
  }

  function initMap() {
    map = L.map('reportMap', { zoomControl: true }).setView([13.7563, 100.5018], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    map.on('click', (event) => setIncidentPoint(event.latlng.lat, event.latlng.lng, true));
  }

  function setMgrsStatus(message = '', type = 'info') {
    if (!mgrsStatus) return;
    mgrsStatus.textContent = message;
    mgrsStatus.className = message ? `place-search-status mgrs-status ${type}` : 'place-search-status d-none';
  }

  async function copyCoordinateText(value, label) {
    if (!value || value === '-') return;
    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) await navigator.clipboard.writeText(value);
      else {
        const field = document.createElement('textarea');
        field.value = value;
        field.setAttribute('readonly', '');
        field.style.position = 'fixed';
        field.style.opacity = '0';
        document.body.appendChild(field);
        field.select();
        const copied = document.execCommand('copy');
        field.remove();
        if (!copied) throw new Error('copy failed');
      }
      setMgrsStatus(`คัดลอก${label}แล้ว`, 'success');
    } catch {
      setMgrsStatus(`คัดลอก${label}ไม่สำเร็จ`, 'error');
    }
  }

  function currentCoordinateTexts() {
    const lat = Number(document.getElementById('incidentLat').value);
    const lng = Number(document.getElementById('incidentLng').value);
    const point = coordinates.finiteCoordinate(lat, lng);
    if (!point) return null;
    const precision = Number(mgrsPrecision?.value || 5);
    const gps = coordinates.latLngText(point.lat, point.lng);
    const mgrs = coordinates.toMgrs(point.lat, point.lng, precision);
    return { gps, mgrs, both: mgrs ? `${gps} · MGRS ${mgrs}` : gps };
  }

  function refreshCoordinateDisplay() {
    const texts = currentCoordinateTexts();
    if (!texts) {
      document.getElementById('coordinateText').textContent = 'ยังไม่ได้ปักตำแหน่ง';
      if (coordinateCopyActions) coordinateCopyActions.hidden = true;
      return;
    }
    document.getElementById('coordinateText').textContent = texts.both;
    if (mgrsInput && document.activeElement !== mgrsInput) mgrsInput.value = texts.mgrs || '';
    if (coordinateCopyActions) coordinateCopyActions.hidden = false;
    if (copyMgrsBtn) copyMgrsBtn.disabled = !texts.mgrs;
  }

  function applyMgrsCoordinate() {
    const raw = mgrsInput?.value || '';
    const validation = coordinates.validateMgrs(raw);
    if (!validation.valid) {
      setMgrsStatus(validation.error || 'รูปแบบ MGRS ไม่ถูกต้อง', 'error');
      mgrsInput?.focus();
      return;
    }
    const parsed = coordinates.fromMgrs(raw);
    if (!parsed) {
      setMgrsStatus('ไม่สามารถแปลงพิกัด MGRS นี้ได้', 'error');
      return;
    }
    if (mgrsInput) mgrsInput.value = parsed.mgrs || raw.toUpperCase();
    setIncidentPoint(parsed.lat, parsed.lng, true);
    setMgrsStatus('แปลง MGRS และปักหมุดบนแผนที่แล้ว', 'success');
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
    refreshCoordinateDisplay();
    if (center) map.flyTo([lat, lng], Math.max(map.getZoom(), 16), { duration: .7 });
  }

  function locateMe() {
    const btn = document.getElementById('locateBtn');
    if (!window.isSecureContext) return fail('GPS ของมือถือใช้งานผ่าน HTTP ไม่ได้ กรุณาแตะปักหมุดบนแผนที่เอง หรือเปิดระบบผ่าน HTTPS');
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
    const coordinatePair = formValue('incidentLat') && formValue('incidentLng')
      ? coordinates.pairText(formValue('incidentLat'), formValue('incidentLng'), { precision: Number(mgrsPrecision?.value || 5) })
      : '-';
    const items = [
      ['ผู้รายงาน', reporterType === 'ANONYMOUS' ? 'ไม่ระบุตัวตน' : (formValue('reporterName') || labelReporter(reporterType))],
      ['ประเภทผู้รายงาน', labelReporter(reporterType)],
      ['วัน / เวลา', formValue('occurredAt') ? new Date(formValue('occurredAt')).toLocaleString('th-TH') : '-'],
      ['พิกัด GPS / MGRS', coordinatePair],
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

  async function copyReportNumber() {
    const reportNo = document.getElementById('successReportNo').textContent.trim();
    const copyButton = document.getElementById('copyReportNoBtn');
    if (!reportNo || reportNo === '-') return;

    const originalText = '⧉ คัดลอกเลขที่';
    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(reportNo);
      } else {
        const copyField = document.createElement('textarea');
        copyField.value = reportNo;
        copyField.setAttribute('readonly', '');
        copyField.style.position = 'fixed';
        copyField.style.opacity = '0';
        document.body.appendChild(copyField);
        copyField.select();
        copyField.setSelectionRange(0, copyField.value.length);
        const copied = document.execCommand('copy');
        copyField.remove();
        if (!copied) throw new Error('Copy command failed');
      }

      copyButton.textContent = '✓ คัดลอกแล้ว';
      copyButton.classList.add('copied');
    } catch {
      copyButton.textContent = 'คัดลอกไม่สำเร็จ';
    }

    window.setTimeout(() => {
      copyButton.textContent = originalText;
      copyButton.classList.remove('copied');
    }, 1800);
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
      document.getElementById('aiSmartCard')?.classList.add('d-none');
      aiSmartText.value = '';
      aiSmartResult.textContent = '';
      aiSmartResult.classList.add('d-none');
      document.getElementById('successReportNo').textContent = data.reportNo;
      document.getElementById('checkStatusBtn').href = `/report/status/?reportNo=${encodeURIComponent(data.reportNo)}`;
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
  searchPlaceBtn.addEventListener('click', () => searchAndPinPlace(formValue('locationName')));
  applyMgrsBtn?.addEventListener('click', applyMgrsCoordinate);
  mgrsInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      applyMgrsCoordinate();
    }
  });
  mgrsPrecision?.addEventListener('change', () => {
    refreshCoordinateDisplay();
    if (currentStep === 3) buildReview();
  });
  copyGpsBtn?.addEventListener('click', () => {
    const texts = currentCoordinateTexts();
    if (texts) copyCoordinateText(texts.gps, ' GPS');
  });
  copyMgrsBtn?.addEventListener('click', () => {
    const texts = currentCoordinateTexts();
    if (texts?.mgrs) copyCoordinateText(texts.mgrs, ' MGRS');
  });
  copyBothBtn?.addEventListener('click', () => {
    const texts = currentCoordinateTexts();
    if (texts) copyCoordinateText(texts.both, 'พิกัดทั้งคู่');
  });
  aiSmartBtn.addEventListener('click', runAiSmartFill);
  fileInput.addEventListener('change', handleFiles);
  form.addEventListener('submit', submitReport);
  form.addEventListener('input', () => currentStep === 3 && buildReview());
  document.getElementById('copyReportNoBtn').addEventListener('click', copyReportNumber);
  document.getElementById('newReportBtn').addEventListener('click', () => window.location.reload());

  setNow();
  setReporterTypeUI();
  setObjectTypeUI();
  initMap();
  initBranding();
  initAiSmartFill();
  initAiSpeechRecognition();
  initLineIdentity().catch((error) => console.warn('LINE LIFF init skipped:', error.message));
})();
