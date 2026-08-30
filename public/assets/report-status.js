(() => {
  const form = document.getElementById('statusForm');
  const reportNoInput = document.getElementById('reportNo');
  const submitBtn = document.getElementById('statusSubmitBtn');
  const alertBox = document.getElementById('statusAlert');
  const result = document.getElementById('statusResult');
  const timeline = document.getElementById('statusTimeline');

  const statuses = {
    NEW: { label: 'รับรายงานแล้ว', detail: 'ข้อมูลอยู่ในระบบและรอเจ้าหน้าที่รับเรื่อง', tone: 'blue' },
    ACKNOWLEDGED: { label: 'เจ้าหน้าที่รับทราบแล้ว', detail: 'ศูนย์รับแจ้งได้รับเรื่องและเริ่มดำเนินการ', tone: 'amber' },
    INVESTIGATING: { label: 'กำลังตรวจสอบ', detail: 'เจ้าหน้าที่อยู่ระหว่างตรวจสอบข้อมูลและเหตุการณ์', tone: 'amber' },
    VERIFIED: { label: 'ยืนยันข้อมูลแล้ว', detail: 'ข้อมูลรายงานผ่านการตรวจสอบเบื้องต้นแล้ว', tone: 'green' },
    FALSE_ALARM: { label: 'ไม่พบเหตุจริง', detail: 'ตรวจสอบแล้วไม่พบเหตุหรือเป็นการแจ้งผิดพลาด', tone: 'slate' },
    RESOLVED: { label: 'ดำเนินการเรียบร้อย', detail: 'หน่วยงานดำเนินการกับรายงานนี้เรียบร้อยแล้ว', tone: 'green' },
    CLOSED: { label: 'ปิดรายงานแล้ว', detail: 'รายงานสิ้นสุดกระบวนการดำเนินงาน', tone: 'slate' }
  };

  const defaultStatus = { label: 'กำลังดำเนินการ', detail: 'กรุณาตรวจสอบอีกครั้งภายหลัง', tone: 'blue' };
  const thaiDate = new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Bangkok'
  });

  function formatDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '-' : thaiDate.format(date);
  }

  function showAlert(message, type = 'danger') {
    alertBox.textContent = message;
    alertBox.className = `alert alert-${type} mt-3 mb-0`;
  }

  function hideAlert() {
    alertBox.textContent = '';
    alertBox.className = 'alert d-none mt-3 mb-0';
  }

  function renderTimeline(updates) {
    timeline.replaceChildren();
    updates.forEach((update, index) => {
      const config = statuses[update.status] || defaultStatus;
      const item = document.createElement('article');
      item.className = `public-timeline-item${index === updates.length - 1 ? ' latest' : ''}`;

      const dot = document.createElement('span');
      dot.className = 'public-timeline-dot';
      dot.textContent = index === updates.length - 1 ? '✓' : String(index + 1);

      const body = document.createElement('div');
      body.className = 'public-timeline-body';
      const title = document.createElement('strong');
      title.textContent = update.type === 'REPORT_RECEIVED' ? 'ระบบได้รับรายงาน' : config.label;
      const description = document.createElement('p');
      description.textContent = update.type === 'REPORT_RECEIVED'
        ? 'บันทึกข้อมูลเข้าสู่ศูนย์รับแจ้งเรียบร้อยแล้ว'
        : config.detail;
      const time = document.createElement('time');
      time.dateTime = update.createdAt || '';
      time.textContent = formatDate(update.createdAt);

      body.append(title, description, time);
      item.append(dot, body);
      timeline.append(item);
    });
  }

  function renderResult(data) {
    const config = statuses[data.status] || defaultStatus;
    document.getElementById('resultReportNo').textContent = data.reportNo;
    document.getElementById('resultSubmittedAt').textContent = formatDate(data.submittedAt);
    document.getElementById('resultUpdatedAt').textContent = formatDate(data.lastUpdatedAt);
    document.getElementById('currentStatusLabel').textContent = config.label;
    document.getElementById('currentStatusDetail').textContent = config.detail;
    document.getElementById('currentStatus').className = `current-status tone-${config.tone}`;
    renderTimeline(Array.isArray(data.updates) && data.updates.length
      ? data.updates
      : [{ type: 'REPORT_RECEIVED', status: data.status, createdAt: data.submittedAt }]);
    result.classList.remove('d-none');
    result.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function checkStatus() {
    const reportNo = reportNoInput.value.trim().toUpperCase();
    reportNoInput.value = reportNo;
    hideAlert();
    result.classList.add('d-none');

    if (!/^DRN-\d{8}-\d{6}$/.test(reportNo)) {
      showAlert('กรุณากรอกเลขที่รายงานให้ถูกต้อง เช่น DRN-20260830-000001');
      reportNoInput.focus();
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'กำลังตรวจสอบ...';
    try {
      const response = await fetch('/api/reports/status-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportNo })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'ไม่สามารถตรวจสอบสถานะได้');
      renderResult(data);
      const url = new URL(window.location.href);
      url.searchParams.set('reportNo', data.reportNo);
      window.history.replaceState({}, '', url);
    } catch (error) {
      showAlert(error.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'ตรวจสอบสถานะ';
    }
  }

  async function initBranding() {
    const branding = await fetch('/api/branding').then((response) => response.json()).catch(() => ({}));
    const title = branding.app_title || 'D DRONE';
    document.getElementById('reportBrandTitle').textContent = title;
    document.getElementById('reportOrganization').textContent = branding.organization_name || 'ศูนย์ควบคุมและเฝ้าระวังอากาศยาน';
    document.title = `${title} · ตรวจสอบสถานะรายงาน`;
    if (branding.app_logo_url) {
      const logo = document.getElementById('reportBrandLogo');
      logo.src = branding.app_logo_url;
      logo.classList.remove('d-none');
      document.getElementById('reportBrandFallback').classList.add('d-none');
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    checkStatus();
  });
  reportNoInput.addEventListener('input', () => {
    reportNoInput.value = reportNoInput.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
  });
  document.getElementById('searchAnotherBtn').addEventListener('click', () => {
    result.classList.add('d-none');
    reportNoInput.select();
    reportNoInput.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  initBranding();
  const initialReportNo = new URLSearchParams(window.location.search).get('reportNo');
  if (initialReportNo) {
    reportNoInput.value = initialReportNo.toUpperCase();
    checkStatus();
  }
})();
