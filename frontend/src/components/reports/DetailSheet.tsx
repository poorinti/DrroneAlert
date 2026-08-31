import { AnimatePresence, motion } from 'framer-motion';
import { Camera, ExternalLink, MapPin, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { coordinates } from '../../lib/coordinates';
import { actionLabels, objectLabels, reporterLabels, severityLabels, sourceLabels, statusLabels } from '../../lib/labels';
import { formatDate } from '../../lib/utils';
import type { DetailResponse, Role } from '../../types';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog';
import { Select } from '../ui/select';

const severityOptions = Object.entries(severityLabels).map(([value, label]) => ({ value, label }));
const statusOptions = Object.entries(statusLabels).map(([value, label]) => ({ value, label }));

function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  return <div className="detail-row grid min-w-0 max-w-full grid-cols-[116px_minmax(0,1fr)] gap-3 py-1.5 text-[11px]"><span className="text-muted">{label}</span><span className="detail-wrap min-w-0 max-w-full">{value || '-'}</span></div>;
}
function Timeline({ title, body, meta }: { title: string; body?: string; meta: string }) {
  return <div className="timeline-item relative min-w-0 max-w-full overflow-hidden pb-4 pl-5 text-[10px]"><i className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-primary bg-white"/><strong className="detail-wrap block min-w-0 max-w-full">{title}</strong>{body && <p className="detail-wrap my-0.5 min-w-0 max-w-full text-slate-600">{body}</p>}<span className="detail-wrap block min-w-0 max-w-full text-[8px] text-muted">{meta}</span></div>;
}

export function DetailSheet({ open, data, loading, role, onClose, onSave, onNote, onPublicMessage, onComplete }: {
  open: boolean;
  data: DetailResponse | null;
  loading: boolean;
  role: Role;
  onClose: () => void;
  onSave: (s: string, v: string) => Promise<void>;
  onNote: (n: string) => Promise<void>;
  onPublicMessage: (message: string) => Promise<void>;
  onComplete: () => Promise<void>;
}) {
  const [status, setStatus] = useState('');
  const [severity, setSeverity] = useState('');
  const [note, setNote] = useState('');
  const [publicMessage, setPublicMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);

  useEffect(() => {
    setStatus(data?.report.status || '');
    setSeverity(data?.report.operator_severity || data?.report.reporter_severity || '');
    setNote('');
    setPublicMessage('');
    setCompleteOpen(false);
  }, [data]);

  const report = data?.report;
  const canEdit = ['SUPER_ADMIN', 'OPERATOR'].includes(role);
  const images = data?.images || [];
  const incidentLat = Number(report?.incident_lat);
  const incidentLng = Number(report?.incident_lng);
  const hasIncidentCoordinate = Number.isFinite(incidentLat) && Number.isFinite(incidentLng) && incidentLat >= -90 && incidentLat <= 90 && incidentLng >= -180 && incidentLng <= 180;
  const incidentCoordinate = hasIncidentCoordinate ? coordinates.latLngText(incidentLat, incidentLng) : '-';
  const incidentMgrs = hasIncidentCoordinate ? coordinates.toMgrs(incidentLat, incidentLng) : null;
  const incidentGoogleMapsUrl = hasIncidentCoordinate ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${incidentLat},${incidentLng}`)}` : '';

  async function save() {
    setSaving(true);
    try { await onSave(status, severity); } finally { setSaving(false); }
  }
  async function addNote() {
    if (!note.trim()) return;
    setSaving(true);
    try { await onNote(note); setNote(''); } finally { setSaving(false); }
  }
  async function sendPublicMessage() {
    if (!publicMessage.trim()) return;
    setSaving(true);
    try { await onPublicMessage(publicMessage); setPublicMessage(''); } finally { setSaving(false); }
  }
  async function complete() {
    setSaving(true);
    try {
      await onComplete();
      setCompleteOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return <>
    <AnimatePresence>
      {open && <motion.aside initial={{ x: '105%', opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: '105%', opacity: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 34 }} className="detail-sheet fixed bottom-3 right-3 top-[88px] z-[1200] w-[min(450px,calc(100vw-24px))] max-w-[calc(100vw-24px)] overflow-hidden rounded-[26px] border border-white/80 bg-white/95 shadow-2xl backdrop-blur-2xl">
        <button onClick={onClose} className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full bg-white/90 text-slate-600 shadow-lg" aria-label="ปิดรายละเอียด"><X size={17}/></button>
        <div className="detail-sheet-scroll h-full min-w-0 max-w-full overflow-x-hidden overflow-y-auto">
          {loading || !report ? <div className="grid h-full place-items-center text-xs text-muted">กำลังโหลดรายละเอียด...</div> : <>
            <div className="h-60 bg-slate-100">{images[0] ? <img className="h-full w-full object-cover" src={`/uploads/${images[0].file_path}`} alt="ภาพเหตุการณ์"/> : <div className="grid h-full place-items-center text-slate-300"><Camera size={42}/></div>}</div>
            <div className="detail-sheet-body min-w-0 max-w-full overflow-hidden p-5">
              <Badge tone={report.operator_severity || report.reporter_severity}>{severityLabels[report.operator_severity || report.reporter_severity]}</Badge>
              <h2 className="detail-wrap mt-2 max-w-full text-xl font-bold">{report.report_no}</h2>
              <div className="detail-header-meta mt-1 flex min-w-0 max-w-full flex-wrap gap-2"><Badge tone="blue">{statusLabels[report.status]}</Badge><span className="detail-wrap min-w-0 text-[10px] text-muted">{formatDate(report.submitted_at)}</span></div>

              <section className="detail-section">
                <h3>ข้อมูลสำคัญ</h3>
                <Row label="สิ่งที่พบ" value={objectLabels[report.object_type]}/>
                <Row label="สถานที่" value={<span className="detail-wrap inline-flex min-w-0 max-w-full items-start gap-1"><MapPin size={12} className="mt-0.5 shrink-0 text-primary"/><span className="detail-wrap min-w-0">{report.location_name}</span></span>}/>
                <Row label="เวลาที่พบ" value={formatDate(report.occurred_at)}/>
                <Row label="พิกัด GPS" value={hasIncidentCoordinate ? <a href={incidentGoogleMapsUrl} target="_blank" rel="noopener noreferrer" className="detail-gps-link inline-flex min-w-0 max-w-full flex-wrap items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 font-bold tabular-nums text-blue-700 transition hover:border-blue-300 hover:bg-blue-100" title={`GPS ${incidentCoordinate}${incidentMgrs ? ` · MGRS ${incidentMgrs}` : ''}`}><MapPin size={12} className="shrink-0"/><span className="detail-wrap min-w-0">{incidentCoordinate}</span><ExternalLink size={11} className="shrink-0"/></a> : '-'}/>
                <Row label="พิกัด MGRS" value={incidentMgrs ? <code className="detail-wrap rounded-lg bg-slate-100 px-2 py-1 font-bold text-slate-700">{incidentMgrs}</code> : '-'}/>
                <p className="detail-wrap mt-3 min-w-0 max-w-full rounded-2xl bg-slate-50 p-3 text-[11px] leading-relaxed">{report.description || report.appearance_notes || 'ไม่มีรายละเอียดเพิ่มเติม'}</p>
              </section>

              <section className="detail-section">
                <h3>ผู้รายงาน</h3>
                <Row label="ชื่อ" value={report.line_display_name || report.reporter_name || 'ไม่ระบุตัวตน'}/>
                <Row label="ประเภท" value={reporterLabels[report.reporter_type || '']}/>
                <Row label="แหล่งที่มา" value={sourceLabels[report.source]}/>
                <Row label="หน่วยงาน" value={report.organization}/>
              </section>

              {canEdit && <section className="detail-section">
                <h3>การจัดการเหตุ</h3>
                <div className="grid grid-cols-2 gap-2"><Select value={status} onValueChange={setStatus} placeholder="สถานะ" options={statusOptions}/><Select value={severity} onValueChange={setSeverity} placeholder="ระดับเหตุ" options={severityOptions}/></div>
                <Button disabled={saving} onClick={save} className="mt-2 w-full">บันทึกสถานะและระดับเหตุ</Button>
                <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} className="mt-3 w-full rounded-xl border border-slate-200 p-3 text-xs" placeholder="หมายเหตุภายในสำหรับเจ้าหน้าที่"/>
                <Button disabled={saving || !note.trim()} onClick={addNote} variant="secondary" className="mt-1 w-full">เพิ่มหมายเหตุภายใน</Button>
                <div className="mt-3 rounded-2xl border border-violet-200 bg-violet-50 p-3">
                  <strong className="block text-xs text-violet-800">ข้อความถึงผู้รายงาน</strong>
                  <p className="mt-1 text-[10px] leading-relaxed text-violet-600">ข้อความนี้จะแสดงในหน้าตรวจสอบสถานะ ผู้แจ้งจะมองเห็นได้</p>
                  <textarea value={publicMessage} onChange={(event) => setPublicMessage(event.target.value)} rows={3} maxLength={2000} className="mt-2 w-full rounded-xl border border-violet-200 bg-white p-3 text-xs" placeholder="เช่น เจ้าหน้าที่รับเรื่องแล้ว และกำลังประสานหน่วยตรวจสอบพื้นที่"/>
                  <Button disabled={saving || !publicMessage.trim()} onClick={sendPublicMessage} className="mt-1 w-full">ส่งข้อความถึงผู้รายงาน</Button>
                </div>
                {!['RESOLVED', 'CLOSED', 'FALSE_ALARM'].includes(report.status) && <Button disabled={saving} onClick={() => setCompleteOpen(true)} variant="danger" className="mt-3 w-full">ดำเนินการเสร็จสิ้น</Button>}
              </section>}

              <section className="detail-section"><h3>หมายเหตุภายในเจ้าหน้าที่</h3><div className="timeline-list">{data.notes.length ? data.notes.map((item) => <Timeline key={item.id} title={item.username} body={item.note} meta={formatDate(item.created_at)}/>) : <span className="text-[10px] text-muted">ยังไม่มีหมายเหตุภายใน</span>}</div></section>
              <section className="detail-section"><h3>ข้อความที่แจ้งผู้รายงาน</h3><div className="timeline-list">{data.publicMessages?.length ? data.publicMessages.map((item) => <Timeline key={item.id} title="แสดงในหน้าตรวจสอบสถานะ" body={item.message} meta={`${item.username} · ${formatDate(item.created_at)}`}/>) : <span className="text-[10px] text-muted">ยังไม่มีข้อความถึงผู้รายงาน</span>}</div></section>
              <section className="detail-section"><h3>ประวัติการดำเนินการ</h3><div className="timeline-list">{data.history.map((item) => <Timeline key={item.id} title={actionLabels[item.action] || item.action} body={[item.old_value, item.new_value].filter(Boolean).join(' → ')} meta={`${item.username || 'ระบบ'} · ${formatDate(item.created_at)}`}/>)}</div></section>
            </div>
          </>}
        </div>
      </motion.aside>}
    </AnimatePresence>

    <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
      <DialogContent className="sm:w-[420px]">
        <DialogTitle>ดำเนินการเหตุนี้เสร็จสิ้น?</DialogTitle>
        <DialogDescription>เหตุจะถูกเปลี่ยนเป็น “ดำเนินการเสร็จสิ้น” และย้ายไปยังเหตุการณ์ย้อนหลัง ข้อมูล รายละเอียด ภาพ และประวัติจะยังคงอยู่ครบถ้วน</DialogDescription>
        <div className="mt-5 flex justify-end gap-2"><Button variant="secondary" disabled={saving} onClick={() => setCompleteOpen(false)}>ยกเลิก</Button><Button variant="danger" disabled={saving} onClick={complete}>{saving ? 'กำลังบันทึก...' : 'ยืนยันเสร็จสิ้น'}</Button></div>
      </DialogContent>
    </Dialog>
  </>;
}
