import { useEffect, useState } from 'react';
import { CalendarDays, FileDown, FileSpreadsheet, FileText, LoaderCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog';

type Period = 'daily' | 'monthly' | 'range';
type Format = 'pdf' | 'excel';
type Props = { open: boolean; date: string; month: string; rangeFrom: string; rangeTo: string; onOpenChange: (open: boolean) => void; onError: (message: string) => void };
function localToday() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; }

export function ExportDialog({ open, date: dashboardDate, month: dashboardMonth, rangeFrom: dashboardFrom, rangeTo: dashboardTo, onOpenChange, onError }: Props) {
  const [format, setFormat] = useState<Format>('pdf'); const [period, setPeriod] = useState<Period>('daily'); const [date, setDate] = useState(localToday()); const [month, setMonth] = useState(localToday().slice(0, 7)); const [from, setFrom] = useState(localToday()); const [to, setTo] = useState(localToday()); const [loading, setLoading] = useState(false);
  useEffect(() => { if (!open) return; if (dashboardFrom && dashboardTo) { setPeriod('range'); setFrom(dashboardFrom); setTo(dashboardTo); } else if (dashboardMonth) { setPeriod('monthly'); setMonth(dashboardMonth); } else { setPeriod('daily'); setDate(dashboardDate || localToday()); } }, [open, dashboardDate, dashboardMonth, dashboardFrom, dashboardTo]);
  async function download() {
    const params = new URLSearchParams();
    if (period === 'daily') { if (!date) return onError('กรุณาเลือกวันที่'); params.set('date', date); }
    if (period === 'monthly') { if (!month) return onError('กรุณาเลือกเดือน'); params.set('month', month); }
    if (period === 'range') { if (!from || !to || from > to) return onError('กรุณาเลือกช่วงวันที่ให้ถูกต้อง'); params.set('from', from); params.set('to', to); }
    setLoading(true);
    try { const response = await fetch(`/api/admin/export/${format}?${params}`); if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || 'สร้างรายงานไม่สำเร็จ'); } const blob = await response.blob(); const disposition = response.headers.get('content-disposition') || ''; const filename = disposition.match(/filename="([^"]+)"/)?.[1] || `Incident-Report.${format === 'pdf' ? 'pdf' : 'xlsx'}`; const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); onOpenChange(false); }
    catch (error) { onError(error instanceof Error ? error.message : 'สร้างรายงานไม่สำเร็จ'); } finally { setLoading(false); }
  }
  const choice = (active: boolean) => `flex h-14 flex-1 items-center justify-center gap-2 rounded-xl border text-xs font-bold transition ${active ? 'border-blue-300 bg-blue-50 text-primary shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`;
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[calc(100vh-24px)] overflow-y-auto sm:w-[480px]"><DialogTitle>ออกรายงาน</DialogTitle><DialogDescription>สร้างรายงานจากข้อมูลทั้งหมดในฐานข้อมูลตามช่วงเวลาที่เลือก</DialogDescription>
    <div className="mt-5"><span className="export-label">รูปแบบไฟล์</span><div className="mt-2 flex gap-2"><button type="button" className={choice(format === 'pdf')} onClick={() => setFormat('pdf')}><FileText size={17}/>PDF</button><button type="button" className={choice(format === 'excel')} onClick={() => setFormat('excel')}><FileSpreadsheet size={17}/>Excel</button></div></div>
    <div className="mt-4"><span className="export-label">ช่วงข้อมูล</span><div className="mt-2 grid grid-cols-3 rounded-xl bg-slate-100 p-1">{([['daily','รายวัน'],['monthly','รายเดือน'],['range','ช่วงวันที่']] as const).map(([value,label]) => <button key={value} type="button" onClick={() => setPeriod(value)} className={`rounded-[9px] px-2 py-2 text-[10px] font-bold ${period === value ? 'bg-white text-primary shadow-sm' : 'text-muted'}`}>{label}</button>)}</div></div>
    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-3"><span className="mb-2 flex items-center gap-1.5 text-[10px] font-bold text-slate-600"><CalendarDays size={13}/>เลือกช่วงเวลารายงาน</span>{period === 'daily' && <label className="export-date"><span>วันที่</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)}/></label>}{period === 'monthly' && <label className="export-date"><span>เดือน</span><input type="month" value={month} onChange={(event) => setMonth(event.target.value)}/></label>}{period === 'range' && <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-end"><label className="export-date"><span>วันที่เริ่มต้น</span><input type="date" value={from} onChange={(event) => setFrom(event.target.value)}/></label><span className="hidden pb-2 text-muted sm:block">→</span><label className="export-date"><span>วันที่สิ้นสุด</span><input type="date" value={to} onChange={(event) => setTo(event.target.value)}/></label></div>}</div>
    <div className="mt-5 flex justify-end gap-2"><Button variant="secondary" disabled={loading} onClick={() => onOpenChange(false)}>ยกเลิก</Button><Button disabled={loading} onClick={download}>{loading ? <LoaderCircle size={15} className="animate-spin"/> : <FileDown size={15}/>} {loading ? 'กำลังสร้างรายงาน...' : 'สร้างรายงาน'}</Button></div>
  </DialogContent></Dialog>;
}
