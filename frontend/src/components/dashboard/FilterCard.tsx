import * as Popover from '@radix-ui/react-popover';
import { CalendarDays, ChevronLeft, ChevronRight, Filter, SlidersHorizontal, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { severityLabels, statusLabels } from '../../lib/labels';
import { Card } from '../ui/card';
import { Select } from '../ui/select';

type Props = {
  severity: string; status: string; date: string; month: string; rangeFrom: string; rangeTo: string; historyMode: boolean;
  onSeverity: (value: string) => void; onStatus: (value: string) => void; onDate: (value: string) => void; onMonth: (value: string) => void;
  onRange: (from: string, to: string) => void; onMode: (history: boolean) => void; onClear: () => void;
};

function localISO(date: Date) { const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, '0'); const day = String(date.getDate()).padStart(2, '0'); return `${year}-${month}-${day}`; }
function thaiDay(value: string) { return value ? new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`)) : ''; }
function thaiMonth(value: string) { return value ? new Intl.DateTimeFormat('th-TH', { month: 'long', year: 'numeric' }).format(new Date(`${value}-01T12:00:00`)) : ''; }

export function FilterCard({ severity, status, date, month, rangeFrom, rangeTo, historyMode, onSeverity, onStatus, onDate, onMonth, onRange, onMode, onClear }: Props) {
  const [periodOpen, setPeriodOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const severityOptions = [{ value: 'ALL', label: 'ทุกระดับ' }, ...Object.entries(severityLabels).map(([value, label]) => ({ value, label }))];
  const statuses = historyMode ? ['FALSE_ALARM', 'RESOLVED', 'CLOSED'] : ['NEW', 'ACKNOWLEDGED', 'INVESTIGATING', 'VERIFIED'];
  const statusOptions = [{ value: 'ALL', label: 'ทุกสถานะ' }, ...statuses.map((value) => ({ value, label: statusLabels[value] }))];
  const hasExtraFilters = Boolean(severity || status);
  const hasPeriod = Boolean(date || month || rangeFrom || rangeTo);
  const periodLabel = useMemo(() => {
    if (date) return thaiDay(date);
    if (rangeFrom || rangeTo) return rangeFrom && rangeTo ? `${thaiDay(rangeFrom)} - ${thaiDay(rangeTo)}` : rangeFrom ? `ตั้งแต่ ${thaiDay(rangeFrom)}` : `ถึง ${thaiDay(rangeTo)}`;
    if (month) return thaiMonth(month);
    return historyMode ? 'ทุกช่วงเวลา' : 'เวลาปัจจุบัน';
  }, [date, month, rangeFrom, rangeTo, historyMode]);
  function shiftDay(delta: number) { const base = date || rangeTo || rangeFrom || localISO(new Date()); const next = new Date(`${base}T12:00:00`); next.setDate(next.getDate() + delta); onDate(localISO(next)); }

  return <Card className="dashboard-panel-surface px-2.5 py-2.5">
    <div className="dashboard-panel-soft grid grid-cols-2 rounded-[12px] p-0.5"><button type="button" onClick={() => onMode(false)} className={`rounded-[10px] px-2 py-1.5 text-[9px] font-bold transition ${!historyMode ? 'dashboard-panel-control text-primary shadow-sm' : 'text-muted'}`}>ปัจจุบัน</button><button type="button" onClick={() => onMode(true)} className={`rounded-[10px] px-2 py-1.5 text-[9px] font-bold transition ${historyMode ? 'dashboard-panel-control text-primary shadow-sm' : 'text-muted'}`}>ย้อนหลัง</button></div>
    <div className="mt-2 grid grid-cols-[30px_minmax(0,1fr)_30px_34px] items-center gap-1.5">
      <button type="button" aria-label="วันก่อนหน้า" title="วันก่อนหน้า" disabled={!historyMode} onClick={() => shiftDay(-1)} className="dashboard-panel-control grid h-8 w-8 place-items-center rounded-[10px] border border-slate-200/80 text-slate-600 transition hover:brightness-[.98] disabled:opacity-30"><ChevronLeft size={14}/></button>
      <Popover.Root open={periodOpen} onOpenChange={(open) => { setPeriodOpen(open); if (open) setFiltersOpen(false); }}><Popover.Trigger asChild><button type="button" className={`flex h-8 min-w-0 items-center justify-center gap-1.5 rounded-[10px] border px-2 text-[9px] font-semibold transition ${hasPeriod ? 'border-blue-200 bg-blue-50 text-primary' : 'dashboard-panel-control border-slate-200/80 text-slate-600'}`} title="เลือกวัน เดือน หรือช่วงเวลา"><CalendarDays size={12} className="shrink-0"/><span className="truncate">{periodLabel}</span></button></Popover.Trigger><Popover.Portal><Popover.Content side="bottom" align="start" sideOffset={8} collisionPadding={12} className="filter-popover z-[1600] w-[min(326px,calc(100vw-24px))] rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl">
        <div className="flex items-center justify-between"><strong className="text-[10px]">เลือกช่วงเวลา</strong><Popover.Close className="grid h-6 w-6 place-items-center rounded-lg text-muted hover:bg-slate-100"><X size={12}/></Popover.Close></div>
        <label className="filter-date-field mt-2"><span>วันที่เดียว</span><input type="date" value={date} onChange={(event) => { onDate(event.target.value); if (event.target.value) setPeriodOpen(false); }}/></label>
        <div className="mt-2 grid grid-cols-2 gap-2"><label className="filter-date-field"><span>ตั้งแต่</span><input type="date" value={rangeFrom} onChange={(event) => onRange(event.target.value, rangeTo)}/></label><label className="filter-date-field"><span>ถึง</span><input type="date" value={rangeTo} onChange={(event) => onRange(rangeFrom, event.target.value)}/></label></div>
        <label className="filter-date-field mt-2"><span>เดือน</span><input type="month" value={month} onChange={(event) => { onMonth(event.target.value); if (event.target.value) setPeriodOpen(false); }}/></label>
        <button type="button" onClick={() => { onDate(''); onMonth(''); onRange('', ''); setPeriodOpen(false); }} className="mt-2 w-full rounded-xl bg-slate-100 px-3 py-2 text-[9px] font-semibold text-slate-600 hover:bg-slate-200">ทุกช่วงเวลา</button><Popover.Arrow className="fill-white"/>
      </Popover.Content></Popover.Portal></Popover.Root>
      <button type="button" aria-label="วันถัดไป" title="วันถัดไป" disabled={!historyMode} onClick={() => shiftDay(1)} className="dashboard-panel-control grid h-8 w-8 place-items-center rounded-[10px] border border-slate-200/80 text-slate-600 transition hover:brightness-[.98] disabled:opacity-30"><ChevronRight size={14}/></button>
      <Popover.Root open={filtersOpen} onOpenChange={(open) => { setFiltersOpen(open); if (open) setPeriodOpen(false); }}><Popover.Trigger asChild><button type="button" aria-label="ตัวกรองเพิ่มเติม" title="ตัวกรองเพิ่มเติม" className={`relative grid h-8 w-[34px] place-items-center rounded-[10px] border transition ${hasExtraFilters ? 'border-blue-200 bg-blue-50 text-primary' : 'dashboard-panel-control border-slate-200/80 text-slate-600'}`}><SlidersHorizontal size={13}/>{hasExtraFilters && <i className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-primary"/>}</button></Popover.Trigger><Popover.Portal><Popover.Content side="bottom" align="end" sideOffset={8} collisionPadding={12} className="filter-popover z-[1600] w-[min(326px,calc(100vw-24px))] rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl">
        <div className="flex items-center justify-between"><strong className="flex items-center gap-1.5 text-[10px]"><Filter size={12}/>ตัวกรอง</strong><Popover.Close className="grid h-6 w-6 place-items-center rounded-lg text-muted hover:bg-slate-100"><X size={12}/></Popover.Close></div>
        <div className="mt-2 grid grid-cols-2 gap-2"><Select value={severity || 'ALL'} onValueChange={(value) => onSeverity(value === 'ALL' ? '' : value)} placeholder="ทุกระดับ" options={severityOptions}/><Select value={status || 'ALL'} onValueChange={(value) => onStatus(value === 'ALL' ? '' : value)} placeholder="ทุกสถานะ" options={statusOptions}/></div>
        <button type="button" onClick={() => { onClear(); setFiltersOpen(false); }} className="mt-2 w-full rounded-xl bg-slate-100 px-3 py-2 text-[9px] font-semibold text-slate-600 hover:bg-slate-200">ล้างตัวกรองทั้งหมด</button><Popover.Arrow className="fill-white"/>
      </Popover.Content></Popover.Portal></Popover.Root>
    </div>
  </Card>;
}
