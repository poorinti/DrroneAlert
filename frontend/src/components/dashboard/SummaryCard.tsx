import { Activity, AlertTriangle, CalendarDays, Radio } from 'lucide-react';
import type { Stats } from '../../types';
import { Card } from '../ui/card';

export function SummaryCard({ stats }: { stats: Stats }) {
  const items = [
    { label: 'ทั้งหมด', value: stats.total, icon: Radio },
    { label: 'วันนี้', value: stats.today, icon: CalendarDays },
    { label: 'กำลังตรวจ', value: stats.active, icon: Activity },
    { label: 'วิกฤต', value: stats.critical, icon: AlertTriangle, critical: true },
  ];

  return <Card className="dashboard-panel-surface px-3 py-2.5">
    <div className="flex items-center justify-between gap-2">
      <strong className="text-[11px]">สรุปสถานการณ์</strong>
      <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[8px] font-extrabold tracking-[.12em] text-blue-700">LIVE</span>
    </div>
    <div className="mt-2 grid grid-cols-4 gap-1.5">
      {items.map(({ label, value, icon: Icon, critical }) => <div key={label} className="dashboard-panel-soft min-w-0 rounded-xl border border-slate-100/80 px-2 py-1.5">
        <div className="flex items-center gap-1">
          <Icon size={10} className={critical ? 'shrink-0 text-red-500' : 'shrink-0 text-slate-500'} />
          <strong className={critical ? 'text-[15px] leading-none text-red-500' : 'text-[15px] leading-none'}>{value || 0}</strong>
        </div>
        <span className="mt-1 block truncate text-[8.5px] font-semibold text-slate-600">{label}</span>
      </div>)}
    </div>
  </Card>;
}
