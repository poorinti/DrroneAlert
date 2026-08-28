import { motion } from 'framer-motion';
import { Camera, MapPin } from 'lucide-react';
import { severityLabels, sourceLabels, statusLabels } from '../../lib/labels';
import { timeAgo } from '../../lib/utils';
import type { ReportSummary } from '../../types';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';

const effectiveSeverity = (report: ReportSummary) => report.effective_severity || report.operator_severity || report.reporter_severity || 'MEDIUM';

export function ReportList({ reports, selectedId, loading, historyMode, onSelect }: { reports: ReportSummary[]; selectedId: number | null; loading: boolean; historyMode: boolean; onSelect: (report: ReportSummary) => void }) {
  return <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
    <div className="flex items-center justify-between border-b border-slate-200/70 px-3.5 py-2.5">
      <div><strong className="block text-[11px]">{historyMode ? 'เหตุการณ์ย้อนหลัง' : 'รายการเหตุปัจจุบัน'}</strong><span className="text-[8px] text-muted">{historyMode ? 'เหตุที่ดำเนินการแล้วหรือไม่ใช่เหตุจริง' : 'เรียงตามเวลาที่ได้รับรายงาน'}</span></div>
      <span className="rounded-full bg-slate-100 px-2 py-1 text-[8px] text-muted">{reports.length} รายการ</span>
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto p-2 scrollbar-thin">
      {loading ? <div className="space-y-2">{[1, 2, 3].map((n) => <div key={n} className="h-[76px] animate-pulse rounded-2xl bg-slate-100" />)}</div> : reports.length ? reports.map((report) => {
        const severity = effectiveSeverity(report);
        const unread = Boolean(report.is_unread);
        return <motion.button key={report.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -1 }} onClick={() => onSelect(report)} className={`mb-1 grid w-full grid-cols-[52px_minmax(0,1fr)] gap-2.5 rounded-2xl border p-2 text-left transition ${selectedId === report.id ? 'border-blue-300 bg-blue-50/90 shadow-lg shadow-blue-100' : unread ? 'border-blue-100 bg-blue-50/60 hover:shadow-md' : 'border-transparent hover:bg-white hover:shadow-md'}`}>
          <div className="grid h-[52px] w-[52px] place-items-center overflow-hidden rounded-[14px] bg-slate-100 text-slate-400">{report.cover_image ? <img className="h-full w-full object-cover" src={`/uploads/${report.cover_image}`} alt="ภาพเหตุการณ์" /> : <Camera size={17} />}</div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">{unread && <i className="h-2 w-2 shrink-0 rounded-full bg-primary"/>}<span className={`truncate text-[10px] ${unread ? 'font-extrabold' : 'font-bold'}`}>{report.report_no}</span><Badge tone={severity}>{severityLabels[severity]}</Badge></div>
            <div className={`mt-1 flex min-w-0 items-center gap-1 text-[10px] ${unread ? 'font-bold' : 'font-semibold'}`}><MapPin size={10} className="shrink-0 text-slate-400"/><span className="truncate">{report.location_name || 'ไม่ระบุสถานที่'}</span></div>
            <div className="mt-1 flex items-center gap-1.5 text-[8px] text-muted"><Badge>{statusLabels[report.status] || report.status}</Badge><span>{sourceLabels[report.source] || report.source}</span><span className="ml-auto whitespace-nowrap">{timeAgo(report.submitted_at)}</span></div>
          </div>
        </motion.button>;
      }) : <div className="grid h-40 place-items-center px-6 text-center text-xs text-muted">ไม่พบรายงานที่ตรงกับตัวกรอง</div>}
    </div>
  </Card>;
}
