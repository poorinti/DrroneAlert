import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Tooltip from '@radix-ui/react-tooltip';
import { LogOut, RefreshCw, Search, Settings, UserRound } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import type { Settings as AppSettings, User } from '../../types';

function IconTip({ label, children }: { label: string; children: React.ReactNode }) { return <Tooltip.Provider delayDuration={250}><Tooltip.Root><Tooltip.Trigger asChild>{children}</Tooltip.Trigger><Tooltip.Portal><Tooltip.Content sideOffset={8} className="z-[4000] rounded-lg bg-slate-900 px-2.5 py-1.5 text-[10px] text-white shadow-xl">{label}</Tooltip.Content></Tooltip.Portal></Tooltip.Root></Tooltip.Provider>; }
export function Navbar({ user, settings, search, onSearch, onRefresh, onSettings, onPassword, onLogout }: { user: User; settings: AppSettings; search: string; onSearch: (v: string) => void; onRefresh: () => void; onSettings: () => void; onPassword: () => void; onLogout: () => void }) {
  return <header className="glass fixed left-4 right-4 top-3 z-[900] flex h-[66px] items-center gap-4 rounded-[21px] px-3 md:gap-6">
    <div className="flex min-w-fit items-center gap-3"><div className="grid h-11 w-11 place-items-center overflow-hidden rounded-[14px] bg-gradient-to-br from-blue-400 to-blue-600 text-sm font-bold text-white shadow-lg shadow-blue-200">{settings.app_logo_path ? <img className="h-full w-full object-cover" src={`/uploads/${settings.app_logo_path}`} alt="โลโก้" /> : 'DD'}</div><div className="hidden sm:block"><strong className="block text-sm tracking-wide">{settings.app_title || 'D DRONE'}</strong><span className="block text-[8px] tracking-[.18em] text-muted">ศูนย์บัญชาการ</span></div></div>
    <div className="hidden items-center gap-2 text-[10px] font-bold text-emerald-700 md:flex"><span className="live-dot" />ระบบออนไลน์</div>
    <label className="relative ml-auto w-full max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} /><Input value={search} onChange={(e) => onSearch(e.target.value)} className="border-0 bg-slate-100/80 pl-9" placeholder="ค้นหาเลขรายงานหรือสถานที่" aria-label="ค้นหา" /></label>
    <div className="flex items-center gap-1.5">
      <IconTip label="โหลดข้อมูลใหม่"><Button variant="secondary" size="icon" onClick={onRefresh}><RefreshCw size={16} /></Button></IconTip>
      {user.role === 'SUPER_ADMIN' && <IconTip label="ตั้งค่าระบบ"><Button variant="secondary" size="icon" onClick={onSettings}><Settings size={16} /></Button></IconTip>}
      <DropdownMenu.Root><DropdownMenu.Trigger asChild><Button variant="secondary" className="px-2 md:px-3"><span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-50 text-xs font-bold text-blue-600">{user.username[0]?.toUpperCase()}</span><span className="hidden text-left text-[10px] leading-tight md:block">{user.username}<small className="block font-normal text-muted">{user.role === 'SUPER_ADMIN' ? 'ผู้ดูแลระบบ' : user.role === 'OPERATOR' ? 'เจ้าหน้าที่' : 'ผู้ชม'}</small></span></Button></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content align="end" sideOffset={8} className="z-[3000] min-w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl"><DropdownMenu.Item onSelect={onPassword} className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs outline-none hover:bg-slate-50"><UserRound size={14} />เปลี่ยนรหัสผ่าน</DropdownMenu.Item><DropdownMenu.Item onSelect={onLogout} className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs text-red-600 outline-none hover:bg-red-50"><LogOut size={14} />ออกจากระบบ</DropdownMenu.Item></DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root>
    </div>
  </header>;
}
