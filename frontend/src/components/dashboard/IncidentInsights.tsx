import { Check, Flame, Link2, Radar, X } from 'lucide-react';
import type { CorrelationCandidate, HotZone, Role } from '../../types';

function distanceLabel(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} กม.` : `${meters} ม.`;
}

export function IncidentInsights({
  hotZones,
  correlations,
  windowMinutes,
  role,
  onWindowChange,
  onSelectReport,
  onDecision,
}: {
  hotZones: HotZone[];
  correlations: CorrelationCandidate[];
  windowMinutes: 15 | 30 | 60;
  role: Role;
  onWindowChange: (value: 15 | 30 | 60) => void;
  onSelectReport: (id: number) => void;
  onDecision: (candidate: CorrelationCandidate, decision: 'CONFIRMED' | 'DISMISSED') => void;
}) {
  const visibleCorrelations = correlations.filter((item) => item.decision !== 'DISMISSED').slice(0, 6);
  return <section className="pointer-events-auto fixed right-3 top-[88px] z-[810] hidden w-[330px] max-h-[calc(100vh-104px)] overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 shadow-xl backdrop-blur md:block">
    <div className="border-b border-slate-100 px-3.5 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2"><Radar size={16} className="text-blue-600"/><strong className="text-[12px] text-slate-950">วิเคราะห์เหตุอัตโนมัติ</strong></div>
        <div className="flex rounded-lg bg-slate-100 p-0.5">{([15, 30, 60] as const).map((value) => <button key={value} type="button" onClick={() => onWindowChange(value)} className={`rounded-md px-2 py-1 text-[9px] font-bold ${windowMinutes === value ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>{value}น.</button>)}</div>
      </div>
      <p className="mb-0 mt-1 text-[9px] font-medium text-slate-500">คำนวณจากเวลา ระยะทาง ทิศทาง และข้อมูลรายงาน — ไม่ใช้ AI</p>
    </div>

    <div className="max-h-[calc(100vh-175px)] overflow-y-auto p-3">
      <div className="mb-2 flex items-center gap-2"><Flame size={14} className="text-orange-500"/><strong className="text-[10px] text-slate-800">Hot Zone</strong><span className="ml-auto rounded-full bg-orange-50 px-2 py-0.5 text-[9px] font-bold text-orange-700">{hotZones.length}</span></div>
      {hotZones.length ? <div className="space-y-2">{hotZones.slice(0, 5).map((zone) => <button key={zone.id} type="button" onClick={() => onSelectReport(zone.reportIds[0])} className="w-full rounded-xl border border-orange-100 bg-orange-50/60 p-2.5 text-left transition hover:bg-orange-50">
        <div className="flex items-center justify-between"><strong className="text-[10px] text-slate-900">{zone.reportCount} รายงานในพื้นที่เดียวกัน</strong>{zone.criticalCount > 0 && <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[8px] font-bold text-red-700">Critical {zone.criticalCount}</span>}</div>
        <div className="mt-1 truncate text-[8.5px] font-medium text-slate-500">{zone.reportNos.join(' · ')}</div>
      </button>)}</div> : <div className="rounded-xl bg-slate-50 px-3 py-2 text-[9px] font-medium text-slate-500">ยังไม่พบพื้นที่ที่มีรายงานหนาแน่นใน {windowMinutes} นาทีล่าสุด</div>}

      <div className="mb-2 mt-4 flex items-center gap-2"><Link2 size={14} className="text-blue-600"/><strong className="text-[10px] text-slate-800">เหตุที่อาจเกี่ยวข้องกัน</strong><span className="ml-auto rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-bold text-blue-700">{visibleCorrelations.length}</span></div>
      {visibleCorrelations.length ? <div className="space-y-2">{visibleCorrelations.map((candidate) => <div key={candidate.id} className={`rounded-xl border p-2.5 ${candidate.decision === 'CONFIRMED' ? 'border-emerald-200 bg-emerald-50/60' : 'border-blue-100 bg-blue-50/50'}`}>
        <div className="flex items-center justify-between gap-2"><div className="min-w-0 text-[9px] font-extrabold text-slate-900"><button type="button" className="hover:underline" onClick={() => onSelectReport(candidate.reportA.id)}>{candidate.reportA.report_no}</button><span className="mx-1 text-slate-400">↔</span><button type="button" className="hover:underline" onClick={() => onSelectReport(candidate.reportB.id)}>{candidate.reportB.report_no}</button></div><span className="shrink-0 rounded-full bg-blue-600 px-2 py-0.5 text-[9px] font-extrabold text-white">{candidate.score}%</span></div>
        <div className="mt-1 text-[8.5px] font-semibold text-slate-500">ห่าง {distanceLabel(candidate.distanceM)} · เวลา {candidate.timeMinutes} นาที</div>
        <div className="mt-1.5 flex flex-wrap gap-1">{candidate.reasons.slice(0, 3).map((reason) => <span key={reason} className="rounded-md bg-white/90 px-1.5 py-0.5 text-[8px] font-semibold text-slate-600">{reason}</span>)}</div>
        {candidate.decision === 'CONFIRMED' ? <div className="mt-2 flex items-center gap-1 text-[8.5px] font-bold text-emerald-700"><Check size={12}/>เจ้าหน้าที่ยืนยันว่าเกี่ยวข้องกัน</div> : role !== 'VIEWER' && <div className="mt-2 grid grid-cols-2 gap-1.5"><button type="button" onClick={() => onDecision(candidate, 'CONFIRMED')} className="flex items-center justify-center gap-1 rounded-lg bg-emerald-600 px-2 py-1.5 text-[8.5px] font-bold text-white"><Check size={11}/>ยืนยัน</button><button type="button" onClick={() => onDecision(candidate, 'DISMISSED')} className="flex items-center justify-center gap-1 rounded-lg bg-white px-2 py-1.5 text-[8.5px] font-bold text-slate-600 ring-1 ring-slate-200"><X size={11}/>ไม่เกี่ยวข้อง</button></div>}
      </div>)}</div> : <div className="rounded-xl bg-slate-50 px-3 py-2 text-[9px] font-medium text-slate-500">ยังไม่พบคู่เหตุที่มีคะแนนสัมพันธ์ถึงเกณฑ์</div>}
    </div>
  </section>;
}
