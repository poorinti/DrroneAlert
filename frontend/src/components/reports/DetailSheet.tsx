import { AnimatePresence, motion } from 'framer-motion';
import { Camera, MapPin, X } from 'lucide-react';
import { useEffect, useState } from 'react';
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
  return <div className="grid grid-cols-[116px_minmax(0,1fr)] gap-3 py-1.5 text-[11px]"><span className="text-muted">{label}</span><span>{value || '-'}</span></div>;
}
function Timeline({ title, body, meta }: { title: string; body?: string; meta: string }) {
  return <div className="timeline-item relative pb-4 pl-5 text-[10px]"><i className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-primary bg-white"/><strong>{title}</strong>{body && <p className="my-0.5 text-slate-600">{body}</p>}<span className="text-[8px] text-muted">{meta}</span></div>;
}

export function DetailSheet({ open, data, loading, role, onClose, onSave, onNote, onComplete }: {
  open: boolean;
  data: DetailResponse | null;
  loading: boolean;
  role: Role;
  onClose: () => void;
  onSave: (s: string, v: string) => Promise<void>;
  onNote: (n: string) => Promise<void>;
  onComplete: () => Promise<void>;
}) {
  const [status, setStatus] = useState('');
  const [severity, setSeverity] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);

  useEffect(() => {
    setStatus(data?.report.status || '');
    setSeverity(data?.report.operator_severity || data?.report.reporter_severity || '');
    setNote('');
    setCompleteOpen(false);
  }, [data]);

  const report = data?.report;
  const canEdit = ['SUPER_ADMIN', 'OPERATOR'].includes(role);
  const images = data?.images || [];

  async function save() {
    setSaving(true);
    try { await onSave(status, severity); } finally { setSaving(false); }
  }
  async function addNote() {
    if (!note.trim()) return;
    setSaving(true);
    try { await onNote(note); setNote(''); } finally { setSaving(false); }
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
      {open && <motion.aside initial={{ x: '105%', opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: '105%', opacity: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 34 }} className="fixed bottom-3 right-3 top-[88px] z-[1200] w-[min(450px,calc(100vw-24px))] overflow-hidden rounded-[26px] border border-white/80 bg-white/95 shadow-2xl backdrop-blur-2xl">
        <button onClick={onClose} className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full bg-white/90 text-slate-600 shadow-lg" aria-label="ปิดรายละเอียด"><X size={17}/></button>
        <div className="h-full overflow-y-auto">
          {loading || !report ? <div className="grid h-full place-items-center text-xs text-muted">กำลังโหลดรายละเอียด...</div> : <>
            <div className="h-60 bg-slate-100">{images[0] ? <img className="h-full w-full object-cover" src={`/uploads/${images[0].file_path}`} alt="ภาพเหตุการณ์"/> : <div className="grid h-full place-items-center text-slate-300"><Camera size={42}/></div>}</div>
            <div className="p-5">
              <Badge tone={report.operator_severity || report.reporter_severity}>{severityLabels[report.operator_severity || report.reporter_severity]}</Badge>
              <h2 className="mt-2 text-xl font-bold">{report.report_no}</h2>
              <div className="mt-1 flex gap-2"><Badge tone="blue">{statusLabels[report.status]}</Badge><span className="text-[10px] text-muted">{formatDate(report.submitted_at)}</span></div>

              <section className="detail-section">
                <h3>ข้อมูลสำคัญ</h3>
                <Row label="สิ่งที่พบ" value={objectLabels[report.object_type]}/>
                <Row label="สถานที่" value={<span className="inline-flex gap-1"><MapPin size={12} className="text-primary"/>{report.location_name}</span>}/>
                <Row label="เวลาที่พบ" value={formatDate(report.occurred_at)}/>
                <Row label="พิกัด" value={`${report.incident_lat}, ${report.incident_lng}`}/>
                <p className="mt-3 rounded-2xl bg-slate-50 p-3 text-[11px] leading-relaxed">{report.description || report.appearance_notes || 'ไม่มีรายละเอียดเพิ่มเติม'}</p>
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
                <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} className="mt-3 w-full rounded-xl border border-slate-200 p-3 text-xs" placeholder="เพิ่มหมายเหตุสำหรับเจ้าหน้าที่"/>
                <Button disabled={saving || !note.trim()} onClick={addNote} variant="secondary" className="mt-1 w-full">เพิ่มหมายเหตุ</Button>
                {!['RESOLVED', 'CLOSED', 'FALSE_ALARM'].includes(report.status) && <Button disabled={saving} onClick={() => setCompleteOpen(true)} variant="danger" className="mt-3 w-full">ดำเนินการเสร็จสิ้น</Button>}
              </section>}

              <section className="detail-section"><h3>หมายเหตุเจ้าหน้าที่</h3><div className="timeline-list">{data.notes.length ? data.notes.map((item) => <Timeline key={item.id} title={item.username} body={item.note} meta={formatDate(item.created_at)}/>) : <span className="text-[10px] text-muted">ยังไม่มีหมายเหตุ</span>}</div></section>
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
