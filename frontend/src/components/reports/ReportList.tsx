import { motion } from 'framer-motion';
import { Camera, CheckCircle2, Clock3, Eye, Globe2, MapPin, MessageCircleMore, SearchCheck, ShieldCheck } from 'lucide-react';
import { severityLabels, sourceLabels, statusLabels } from '../../lib/labels';
import { timeAgo } from '../../lib/utils';
import type { ReportSummary } from '../../types';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';

const effectiveSeverity = (report: ReportSummary) => report.effective_severity || report.operator_severity || report.reporter_severity || 'MEDIUM';

const statusMeta: Record<string, { className: string; icon: typeof Eye }> = {
  NEW: { className: 'border-blue-200 bg-blue-50 text-blue-700', icon: Eye },
  ACKNOWLEDGED: { className: 'border-emerald-200 bg-emerald-50 text-emerald-700', icon: CheckCircle2 },
  INVESTIGATING: { className: 'border-amber-200 bg-amber-50 text-amber-800', icon: SearchCheck },
  VERIFIED: { className: 'border-violet-200 bg-violet-50 text-violet-700', icon: ShieldCheck },
  FALSE_ALARM: { className: 'border-slate-200 bg-slate-100 text-slate-700', icon: CheckCircle2 },
  RESOLVED: { className: 'border-emerald-200 bg-emerald-50 text-emerald-700', icon: CheckCircle2 },
  CLOSED: { className: 'border-slate-300 bg-slate-100 text-slate-700', icon: CheckCircle2 },
};

export function ReportList({ reports, selectedId, loading, historyMode, onSelect }: { reports: ReportSummary[]; selectedId: number | null; loading: boolean; historyMode: boolean; onSelect: (report: ReportSummary) => void }) {
  return <Card className="dashboard-panel-surface flex min-h-0 flex-1 flex-col overflow-hidden">
    <div className="dashboard-panel-section report-list-header flex items-center justify-between border-b border-slate-200 px-3.5 py-2.5">
      <div className="report-list-heading min-w-0"><strong className="block text-[12px] text-slate-900">{historyMode ? 'เหตุการณ์ย้อนหลัง' : 'รายการเหตุปัจจุบัน'}</strong><span className="report-list-description text-[9px] font-medium text-slate-500">{historyMode ? 'เหตุที่ดำเนินการแล้วหรือไม่ใช่เหตุจริง' : 'เรียงตามเวลาที่ได้รับรายงาน'}</span></div>
      <span className="report-list-count rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[9px] font-extrabold text-red-600 shadow-sm">{reports.length} รายการ</span>
    </div>
    <div className="dashboard-report-scroll min-h-0 flex-1 overflow-y-auto p-2 scrollbar-thin">
      {loading ? <div className="space-y-2">{[1, 2, 3].map((n) => <div key={n} className="h-[82px] animate-pulse rounded-2xl bg-slate-100" />)}</div> : reports.length ? reports.map((report) => {
        const severity = effectiveSeverity(report);
        const unread = Boolean(report.is_unread);
        const status = statusMeta[report.status] || statusMeta.NEW;
        const StatusIcon = status.icon;
        const SourceIcon = report.source === 'LINE_LIFF' ? MessageCircleMore : Globe2;
        const sourceClass = report.source === 'LINE_LIFF' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-cyan-200 bg-cyan-50 text-cyan-700';
        return <motion.button key={report.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -1 }} onClick={() => onSelect(report)} className={`dashboard-report-row report-list-card mb-1.5 grid w-full grid-cols-[54px_minmax(0,1fr)] gap-2.5 rounded-2xl border p-2.5 text-left shadow-sm transition ${selectedId === report.id ? 'border-blue-400 shadow-md shadow-blue-100/80 ring-1 ring-blue-200' : unread ? 'border-blue-300 hover:border-blue-400 hover:shadow-md' : 'border-slate-200/80 hover:border-slate-300 hover:shadow-md'}`}>
          <div className="grid h-[54px] w-[54px] place-items-center overflow-hidden rounded-[14px] border border-slate-200 bg-slate-100 text-slate-500">{report.cover_image ? <img className="h-full w-full object-cover" src={`/uploads/${report.cover_image}`} alt="ภาพเหตุการณ์" /> : <Camera size={18} />}</div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">{unread && <i className="h-2 w-2 shrink-0 rounded-full bg-blue-600 shadow-[0_0_0_3px_rgba(37,99,235,.12)]"/>}<span className={`truncate text-[11px] text-slate-950 ${unread ? 'font-extrabold' : 'font-bold'}`}>{report.report_no}</span><Badge tone={severity}>{severityLabels[severity]}</Badge></div>
            <div className={`report-list-location mt-1 flex min-w-0 items-center gap-1.5 text-[11px] text-slate-800 ${unread ? 'font-bold' : 'font-semibold'}`}><MapPin size={12} className="shrink-0 text-rose-500"/><span>{report.location_name || 'ไม่ระบุสถานที่'}</span></div>
            <div className="report-list-meta mt-1.5 flex min-w-0 items-center gap-1.5">
              <span className={`inline-flex min-w-0 items-center gap-1 rounded-lg border px-1.5 py-1 text-[9.5px] font-bold ${status.className}`}><StatusIcon size={10} className="shrink-0"/><span className="truncate">{statusLabels[report.status] || report.status}</span></span>
              <span className={`inline-flex items-center gap-1 rounded-lg border px-1.5 py-1 text-[9.5px] font-bold ${sourceClass}`}><SourceIcon size={10} className="shrink-0"/>{sourceLabels[report.source] || report.source}</span>
              <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 px-1.5 py-1 text-[9.5px] font-bold text-slate-700"><Clock3 size={10}/>{timeAgo(report.submitted_at)}</span>
            </div>
          </div>
        </motion.button>;
      }) : <div className="grid h-40 place-items-center px-6 text-center text-xs text-muted">ไม่พบรายงานที่ตรงกับตัวกรอง</div>}
    </div>
  </Card>;
}
