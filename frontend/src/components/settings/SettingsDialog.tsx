import { Check, Image, Palette, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import { brandingAssetUrl } from '../../lib/branding';
import type { Settings, SurfaceMode } from '../../types';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';

const surfaceOptions: Array<{ value: SurfaceMode; label: string; detail: string }> = [
  { value: 'glass', label: 'กระจกใส', detail: 'เห็นแผนที่ด้านหลังแบบเดิม' },
  { value: 'white', label: 'ขาวชัด', detail: 'อ่านง่ายที่สุดแบบปัจจุบัน' },
  { value: 'custom', label: 'กำหนดสีเอง', detail: 'เลือกโทนจากวงล้อสี' },
];

function SurfacePicker({ label, mode, color, onMode, onColor }: {
  label: string;
  mode: SurfaceMode;
  color: string;
  onMode: (value: SurfaceMode) => void;
  onColor: (value: string) => void;
}) {
  return <section className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
    <div className="flex items-center justify-between gap-3">
      <div>
        <strong className="block text-[11px] text-slate-900">{label}</strong>
        <span className="text-[9px] font-medium text-slate-500">แยกสีจากส่วนอื่นของ Dashboard</span>
      </div>
      <Palette size={17} className="text-blue-500" />
    </div>
    <div className="mt-2.5 grid grid-cols-3 gap-2">
      {surfaceOptions.map((option) => <button key={option.value} type="button" onClick={() => onMode(option.value)} className={`relative rounded-xl border p-2 text-left transition ${mode === option.value ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
        <span className="mb-2 block h-7 overflow-hidden rounded-lg border border-slate-200" style={option.value === 'glass' ? { background: 'linear-gradient(135deg,#9cc9e8 0 50%,#b9d8a8 50% 100%)' } : option.value === 'white' ? { background: '#ffffff' } : { background: color }}>
          {option.value === 'glass' && <span className="block h-full w-full bg-white/55 backdrop-blur-sm" />}
        </span>
        <strong className="block text-[9px] text-slate-800">{option.label}</strong>
        <span className="mt-0.5 block text-[7.5px] leading-snug text-slate-500">{option.detail}</span>
        {mode === option.value && <span className="absolute right-1.5 top-1.5 grid h-4 w-4 place-items-center rounded-full bg-blue-600 text-white"><Check size={10}/></span>}
      </button>)}
    </div>
    {mode === 'custom' && <label className="mt-2.5 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
      <span><strong className="block text-[9px] text-slate-800">วงล้อสี</strong><small className="block text-[8px] text-slate-500">ระบบจะปรับสีให้อ่านข้อความได้ชัด</small></span>
      <span className="flex items-center gap-2"><code className="text-[9px] font-bold uppercase text-slate-600">{color}</code><input type="color" value={color} onChange={(event) => onColor(event.target.value)} className="h-9 w-11 cursor-pointer rounded-lg border border-slate-200 bg-white p-1" aria-label={`เลือกสี ${label}`} /></span>
    </label>}
  </section>;
}

type SurfacePreview = Partial<Pick<Settings, 'navbar_surface_mode' | 'navbar_surface_color' | 'panel_surface_mode' | 'panel_surface_color'>>;

export function SettingsDialog({ open, settings, onOpenChange, onPreview, onSave }: { open: boolean; settings: Settings; onOpenChange: (open: boolean) => void; onPreview: (patch: SurfacePreview) => void; onSave: (form: FormData) => Promise<void> }) {
  const [title, setTitle] = useState(settings.app_title);
  const [organization, setOrganization] = useState(settings.organization_name);
  const [primary, setPrimary] = useState<File | null>(null);
  const [secondary, setSecondary] = useState<File | null>(null);
  const [primaryPreview, setPrimaryPreview] = useState('');
  const [secondaryPreview, setSecondaryPreview] = useState('');
  const [navbarMode, setNavbarMode] = useState<SurfaceMode>(settings.navbar_surface_mode || 'white');
  const [navbarColor, setNavbarColor] = useState(settings.navbar_surface_color || '#dbeafe');
  const [panelMode, setPanelMode] = useState<SurfaceMode>(settings.panel_surface_mode || 'white');
  const [panelColor, setPanelColor] = useState(settings.panel_surface_color || '#ffffff');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(settings.app_title || 'D DRONE');
    setOrganization(settings.organization_name || '');
    setPrimary(null);
    setSecondary(null);
    setPrimaryPreview(brandingAssetUrl(settings.app_logo_path));
    setSecondaryPreview(brandingAssetUrl(settings.secondary_logo_path));
    setNavbarMode(settings.navbar_surface_mode || 'white');
    setNavbarColor(settings.navbar_surface_color || '#dbeafe');
    setPanelMode(settings.panel_surface_mode || 'white');
    setPanelColor(settings.panel_surface_color || '#ffffff');
    setError('');
  }, [settings, open]);

  const choose = (file: File | null, kind: 'primary' | 'secondary') => {
    if (kind === 'primary') {
      setPrimary(file);
      if (file) setPrimaryPreview(URL.createObjectURL(file));
    } else {
      setSecondary(file);
      if (file) setSecondaryPreview(URL.createObjectURL(file));
    }
  };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return setError('กรุณาระบุชื่อโครงการ');
    const form = new FormData();
    form.set('appTitle', title.trim());
    form.set('organizationName', organization.trim());
    form.set('navbarSurfaceMode', navbarMode);
    form.set('navbarSurfaceColor', navbarColor);
    form.set('panelSurfaceMode', panelMode);
    form.set('panelSurfaceColor', panelColor);
    if (primary) form.set('logo', primary);
    if (secondary) form.set('secondaryLogo', secondary);
    setSaving(true);
    setError('');
    try {
      await onSave(form);
      onOpenChange(false);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }

  const logoPicker = (label: string, preview: string, kind: 'primary' | 'secondary') => <label className="mt-4 block text-[11px] font-semibold">{label}<span className="ml-1 font-normal text-muted">PNG, JPG, WEBP หรือ GIF ไม่เกิน 2 MB</span><span className="mt-1.5 flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3"><span className="grid h-14 w-14 place-items-center overflow-hidden rounded-2xl bg-blue-500 text-white">{preview ? <img className="h-full w-full object-cover" src={preview} alt={label}/> : <Image size={20}/>}</span><span className="text-xs font-medium text-slate-600"><Upload className="mb-1" size={15}/>เลือกไฟล์ {label}</span><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={(event) => choose(event.target.files?.[0] || null, kind)}/></span></label>;

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[min(88vh,820px)] overflow-y-auto"><DialogTitle>ตั้งค่าระบบ</DialogTitle><DialogDescription>กำหนด Branding และหน้าตา Dashboard โดย Navbar กับแผงข้อมูลเลือกสีแยกกันได้</DialogDescription><form onSubmit={submit} className="mt-5">
    <label className="text-[11px] font-semibold">ชื่อโครงการ<Input className="mt-1.5" value={title} maxLength={100} onChange={(event) => setTitle(event.target.value)}/></label>
    <label className="mt-3 block text-[11px] font-semibold">ชื่อหน่วยงาน / คำอธิบาย<Input className="mt-1.5" value={organization} maxLength={160} onChange={(event) => setOrganization(event.target.value)}/></label>
    {logoPicker('โลโก้ระบบ', primaryPreview, 'primary')}
    {logoPicker('โลโก้หน่วยงาน', secondaryPreview, 'secondary')}
    <div className="my-4 h-px bg-slate-200" />
    <strong className="text-[11px] text-slate-900">สี Dashboard</strong>
    <p className="mt-1 text-[9px] text-slate-500">เลือกแบบกระจกใสเดิม, ขาวชัด หรือเลือกโทนสีเองจากวงล้อสี</p>
    <SurfacePicker label="Navbar ด้านบน" mode={navbarMode} color={navbarColor} onMode={(value) => { setNavbarMode(value); onPreview({ navbar_surface_mode: value }); }} onColor={(value) => { setNavbarColor(value); onPreview({ navbar_surface_color: value }); }} />
    <SurfacePicker label="แผงข้อมูลด้านล่าง" mode={panelMode} color={panelColor} onMode={(value) => { setPanelMode(value); onPreview({ panel_surface_mode: value }); }} onColor={(value) => { setPanelColor(value); onPreview({ panel_surface_color: value }); }} />
    {error && <p className="mt-3 rounded-xl bg-red-50 p-2.5 text-[10px] text-red-600">{error}</p>}
    <Button disabled={saving} className="mt-4 w-full" type="submit">{saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}</Button>
  </form></DialogContent></Dialog>;
}
