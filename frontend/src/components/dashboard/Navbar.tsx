import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Bell, Check, FileDown, Layers3, LoaderCircle, LocateFixed, LogOut, MoreHorizontal, Plus, RefreshCw, Search, Settings, UserRound } from 'lucide-react';
import { brandingAssetUrl } from '../../lib/branding';
import { mapStyles, type MapStyleId } from '../../lib/mapStyles';
import { severityLabels } from '../../lib/labels';
import { timeAgo } from '../../lib/utils';
import type { MapCoordinate } from '../map/IncidentMap';
import type { ReportSummary, Settings as AppSettings, User } from '../../types';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

function IconTip({ label, children }: { label: string; children: React.ReactNode }) {
  return <Tooltip.Provider delayDuration={250}><Tooltip.Root><Tooltip.Trigger asChild>{children}</Tooltip.Trigger><Tooltip.Portal><Tooltip.Content sideOffset={8} className="z-[4000] rounded-lg bg-slate-900 px-2.5 py-1.5 text-[10px] text-white shadow-xl">{label}</Tooltip.Content></Tooltip.Portal></Tooltip.Root></Tooltip.Provider>;
}

const severityOf = (report: ReportSummary) => report.effective_severity || report.operator_severity || report.reporter_severity || 'MEDIUM';

export function Navbar({ user, settings, search, searchLoading, liveCoordinate, unread, mapStyle, onSearch, onSearchSubmit, onRefresh, onSettings, onPassword, onLogout, onExport, onMapStyle, onNotification, onReadAll, onMobilePanel }: {
  user: User;
  settings: AppSettings;
  search: string;
  searchLoading: boolean;
  liveCoordinate: MapCoordinate | null;
  unread: ReportSummary[];
  mapStyle: MapStyleId;
  onSearch: (value: string) => void;
  onSearchSubmit: () => void | Promise<void>;
  onRefresh: () => void;
  onSettings: () => void;
  onPassword: () => void;
  onLogout: () => void;
  onExport: () => void;
  onMapStyle: (value: MapStyleId) => void;
  onNotification: (report: ReportSummary) => void;
  onReadAll: () => void;
  onMobilePanel: () => void;
}) {
  const primaryLogo = brandingAssetUrl(settings.app_logo_path);
  const secondaryLogo = brandingAssetUrl(settings.secondary_logo_path);
  const coordinateText = liveCoordinate ? `${liveCoordinate.lat.toFixed(6)}, ${liveCoordinate.lng.toFixed(6)}` : '--, --';

  return <><header className="glass dashboard-navbar-surface fixed left-3 right-3 top-3 z-[900] flex h-[66px] items-center gap-2 rounded-[21px] px-2.5 sm:left-4 sm:right-4 sm:gap-3 sm:px-3 lg:gap-4">
    <div className="flex min-w-fit items-center gap-2">
      <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-[13px] bg-gradient-to-br from-blue-400 to-blue-600 text-xs font-bold text-white">{primaryLogo ? <img className="h-full w-full object-cover" src={primaryLogo} alt="โลโก้ระบบ" /> : 'DD'}</div>
      <div className="navbar-secondary-logo hidden h-10 w-10 place-items-center overflow-hidden rounded-[13px] border border-slate-200 bg-white text-xs font-bold text-slate-500 sm:grid">{secondaryLogo ? <img className="h-full w-full object-cover" src={secondaryLogo} alt="โลโก้หน่วยงาน" /> : 'หน่วย'}</div>
      <div className="hidden max-w-[180px] lg:block">
        <strong className="block truncate text-sm tracking-wide">{settings.app_title || 'D DRONE'}</strong>
        <span className="block truncate text-[8px] font-semibold tracking-[.04em] text-slate-600">{settings.organization_name || 'ศูนย์ควบคุมและเฝ้าระวังอากาศยาน'}</span>
      </div>
      <div className="navbar-mobile-title min-w-0">
        <strong className="block max-w-[150px] truncate text-[12px] font-extrabold text-slate-900">{settings.app_title || 'D DRONE'}</strong>
        <span className="mt-0.5 flex items-center gap-1.5 text-[9px] font-bold text-emerald-700"><span className="live-dot"/>ออนไลน์</span>
      </div>
    </div>

    <div className="navbar-status-strip hidden min-w-0 items-center gap-2 lg:flex">
      <span className="flex shrink-0 items-center gap-1.5 text-[9px] font-bold text-emerald-700"><span className="live-dot"/>ออนไลน์</span>
      <span className="h-4 w-px bg-slate-200"/>
      <span className="flex min-w-0 items-center gap-1.5 text-[9px] font-semibold text-slate-600" title="พิกัดใต้เมาส์บนแผนที่"><LocateFixed size={12} className="shrink-0 text-blue-500"/><span className="truncate tabular-nums">{coordinateText}</span></span>
    </div>

    <label className="relative ml-auto hidden min-w-0 flex-1 md:block md:max-w-sm xl:max-w-md">
      {searchLoading ? <LoaderCircle className="absolute left-3 top-1/2 -translate-y-1/2 animate-spin text-blue-500" size={15}/> : <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15}/>}
      <Input value={search} onChange={(event) => onSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void onSearchSubmit(); } }} className="border-0 bg-slate-100/80 pl-9" placeholder="ค้นหาเลขรายงาน สถานที่ หรือพิกัด" aria-label="ค้นหาเลขรายงาน สถานที่ หรือพิกัด" />
    </label>

    <div className="navbar-desktop-actions ml-auto flex items-center gap-1 sm:gap-1.5 md:ml-0">
      <IconTip label="ลงข้อมูลเหตุ"><Button asChild size="icon" className="shrink-0 bg-blue-600 text-white hover:bg-blue-700"><a href="/report/" aria-label="ลงข้อมูลเหตุ"><Plus size={17}/></a></Button></IconTip>

      <DropdownMenu.Root>
        <IconTip label="รูปแบบแผนที่"><DropdownMenu.Trigger asChild><Button variant="secondary" size="icon"><Layers3 size={16}/></Button></DropdownMenu.Trigger></IconTip>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="end" sideOffset={9} className="z-[3000] w-[220px] rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
            <div className="px-2 pb-1 pt-1.5"><strong className="text-[10px]">รูปแบบแผนที่</strong><p className="mt-0.5 text-[8px] text-muted">เลือกพื้นหลังโดยไม่กระทบหมุดและภาพวาด</p></div>
            {mapStyles.map((style) => <DropdownMenu.Item key={style.id} onSelect={() => onMapStyle(style.id)} className={`flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 outline-none transition hover:bg-blue-50 ${style.id === mapStyle ? 'bg-blue-50 text-primary' : ''}`}>
              <span className={`map-style-swatch ${style.id}`} />
              <span className="min-w-0 flex-1"><strong className="block truncate text-[10px]">{style.label}</strong><small className="block truncate text-[8px] font-normal text-muted">{style.detail}</small></span>
              {style.id === mapStyle && <Check size={13} className="shrink-0 text-primary"/>}
            </DropdownMenu.Item>)}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <IconTip label="ออกรายงาน"><Button variant="secondary" size="icon" onClick={onExport} aria-label="ออกรายงาน"><FileDown size={16}/></Button></IconTip>

      <DropdownMenu.Root>
        <IconTip label="การแจ้งเตือน"><DropdownMenu.Trigger asChild><Button variant="secondary" size="icon" className="relative" aria-label="การแจ้งเตือน"><Bell size={16}/>{unread.length > 0 && <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[8px] font-bold text-white">{unread.length > 9 ? '9+' : unread.length}</span>}</Button></DropdownMenu.Trigger></IconTip>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="end" sideOffset={9} className="z-[3000] w-[min(330px,calc(100vw-24px))] rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
            <div className="flex items-center justify-between px-2 py-2"><strong className="text-xs">แจ้งเตือนเหตุใหม่</strong>{unread.length > 0 && <button onClick={onReadAll} className="text-[10px] text-primary">อ่านทั้งหมดแล้ว</button>}</div>
            {unread.length ? unread.slice(0, 6).map((report) => {
              const severity = severityOf(report);
              return <DropdownMenu.Item key={report.id} onSelect={() => onNotification(report)} className="flex cursor-pointer gap-2 rounded-xl p-2 outline-none hover:bg-blue-50">
                <i className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                <div className="min-w-0 flex-1"><div className="flex items-center gap-1"><strong className="truncate text-[10px]">{report.report_no}</strong><Badge tone={severity}>{severityLabels[severity]}</Badge></div><p className="mt-1 truncate text-[10px] text-slate-600">{report.location_name || 'ไม่ระบุสถานที่'}</p><span className="text-[8px] text-muted">{timeAgo(report.submitted_at)}</span></div>
              </DropdownMenu.Item>;
            }) : <p className="p-5 text-center text-[10px] text-muted">ไม่มีเหตุที่ยังไม่ได้อ่าน</p>}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <IconTip label="โหลดข้อมูลใหม่"><Button variant="secondary" size="icon" className="hidden sm:inline-flex" onClick={onRefresh}><RefreshCw size={16}/></Button></IconTip>
      {user.role === 'SUPER_ADMIN' && <IconTip label="ตั้งค่าระบบ"><Button variant="secondary" size="icon" onClick={onSettings}><Settings size={16}/></Button></IconTip>}

      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild><Button variant="secondary" className="px-1.5 sm:px-2 md:px-3"><span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-50 text-xs font-bold text-blue-600">{user.username[0]?.toUpperCase()}</span><span className="hidden text-left text-[10px] leading-tight md:block">{user.username}<small className="block font-normal text-muted">{user.role === 'SUPER_ADMIN' ? 'ผู้ดูแลระบบ' : user.role === 'OPERATOR' ? 'เจ้าหน้าที่' : 'ผู้ชม'}</small></span></Button></DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="end" sideOffset={8} className="z-[3000] min-w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl">
            <DropdownMenu.Item onSelect={onPassword} className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs outline-none hover:bg-slate-50"><UserRound size={14}/>เปลี่ยนรหัสผ่าน</DropdownMenu.Item>
            <DropdownMenu.Item onSelect={onLogout} className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs text-red-600 outline-none hover:bg-red-50"><LogOut size={14}/>ออกจากระบบ</DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>

    <div className="navbar-mobile-actions ml-auto items-center gap-1.5">
      <Button asChild size="icon" className="h-10 w-10 shrink-0 rounded-xl bg-blue-600 text-white shadow-sm hover:bg-blue-700"><a href="/report/" aria-label="ลงข้อมูลเหตุ"><Plus size={18}/></a></Button>

      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button variant="secondary" size="icon" className="relative h-10 w-10 rounded-xl bg-white/90" aria-label="การแจ้งเตือน">
            <Bell size={18}/>
            {unread.length > 0 && <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[8px] font-bold text-white">{unread.length > 9 ? '9+' : unread.length}</span>}
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="end" sideOffset={8} className="z-[3000] w-[min(288px,calc(100vw-24px))] rounded-[18px] border border-white/80 bg-white/95 p-2 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between px-2 py-1.5"><strong className="text-[11px] text-slate-900">แจ้งเตือนล่าสุด</strong>{unread.length > 0 && <button onClick={onReadAll} className="text-[9px] font-semibold text-primary">อ่านทั้งหมด</button>}</div>
            {unread.length ? unread.slice(0, 5).map((report) => {
              const severity = severityOf(report);
              return <DropdownMenu.Item key={report.id} onSelect={() => onNotification(report)} className="flex cursor-pointer gap-2 rounded-[13px] px-2 py-2 outline-none transition hover:bg-blue-50 focus:bg-blue-50">
                <i className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                <div className="min-w-0 flex-1"><div className="flex items-center gap-1"><strong className="truncate text-[10px] text-slate-900">{report.report_no}</strong><Badge tone={severity}>{severityLabels[severity]}</Badge></div><p className="mt-0.5 truncate text-[9px] text-slate-600">{report.location_name || 'ไม่ระบุสถานที่'}</p><span className="text-[8px] text-muted">{timeAgo(report.submitted_at)}</span></div>
              </DropdownMenu.Item>;
            }) : <p className="px-3 py-5 text-center text-[10px] text-muted">ไม่มีการแจ้งเตือนใหม่</p>}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <Button variant="secondary" size="icon" className="h-10 w-10 rounded-xl bg-white/90" onClick={onMobilePanel} aria-label="เปิดข้อมูลและเมนู"><MoreHorizontal size={20}/></Button>
    </div>
  </header>
  {liveCoordinate && <div className="mobile-gps-pill fixed right-3 top-[84px] z-[880] flex items-center gap-1.5 rounded-full border border-white/80 bg-white/90 px-2.5 py-1.5 text-[9px] font-semibold text-slate-600 shadow-lg backdrop-blur-md lg:hidden" title="พิกัดที่กำลังตรวจสอบ"><LocateFixed size={12} className="shrink-0 text-blue-500"/><span className="tabular-nums">{coordinateText}</span></div>}
  </>;
}
