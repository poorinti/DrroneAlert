import L from 'leaflet';
import { Eye, EyeOff, ShieldAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Circle, Pane, Popup, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import type { Role, WatchArea, WatchAreaPriority } from '../../types';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';

type Draft = { center: [number, number]; radiusM: number };

const priorityLabel: Record<WatchAreaPriority, string> = { NORMAL: 'ปกติ', IMPORTANT: 'สำคัญ', CRITICAL: 'วิกฤต' };
const priorityColor: Record<WatchAreaPriority, string> = { NORMAL: '#2563eb', IMPORTANT: '#f59e0b', CRITICAL: '#dc2626' };

function WatchAreaDrawer({ active, onDraft, onActiveChange }: { active: boolean; onDraft: (draft: Draft) => void; onActiveChange: (active: boolean) => void }) {
  const map = useMap();
  const startRef = useRef<L.LatLng | null>(null);
  const [preview, setPreview] = useState<Draft | null>(null);

  useEffect(() => () => { map.dragging.enable(); }, [map]);

  useMapEvents({
    mousedown(event) {
      if (!active) return;
      map.dragging.disable();
      startRef.current = event.latlng;
      setPreview({ center: [event.latlng.lat, event.latlng.lng], radiusM: 50 });
    },
    mousemove(event) {
      if (!active || !startRef.current) return;
      setPreview({ center: [startRef.current.lat, startRef.current.lng], radiusM: Math.max(50, Math.round(map.distance(startRef.current, event.latlng))) });
    },
    mouseup(event) {
      if (!active || !startRef.current) return;
      const radiusM = Math.max(50, Math.round(map.distance(startRef.current, event.latlng)));
      const draft = { center: [startRef.current.lat, startRef.current.lng] as [number, number], radiusM };
      startRef.current = null;
      setPreview(null);
      map.dragging.enable();
      onActiveChange(false);
      onDraft(draft);
    },
  });

  return preview ? <Circle center={preview.center} radius={preview.radiusM} pathOptions={{ color: '#7c3aed', fillColor: '#8b5cf6', fillOpacity: .12, weight: 2, dashArray: '6 5' }} /> : null;
}

export function WatchAreaLayer({ areas, role, onCreate, onUpdate, onNotify, onDrawingActiveChange }: {
  areas: WatchArea[];
  role: Role;
  onCreate: (input: { name: string; priority: WatchAreaPriority; centerLat: number; centerLng: number; radiusM: number }) => Promise<void>;
  onUpdate: (id: number, input: { name?: string; priority?: WatchAreaPriority; enabled?: boolean }) => Promise<void>;
  onNotify: (message: string) => void;
  onDrawingActiveChange?: (active: boolean) => void;
}) {
  const [drawing, setDrawing] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [name, setName] = useState('');
  const [priority, setPriority] = useState<WatchAreaPriority>('IMPORTANT');
  const [saving, setSaving] = useState(false);
  const canEdit = role !== 'VIEWER';

  useEffect(() => { onDrawingActiveChange?.(drawing || Boolean(draft)); }, [drawing, draft, onDrawingActiveChange]);

  async function save() {
    if (!draft) return;
    const value = name.trim();
    if (!value) return onNotify('กรุณาระบุชื่อพื้นที่เฝ้าระวัง');
    setSaving(true);
    try {
      await onCreate({ name: value, priority, centerLat: draft.center[0], centerLng: draft.center[1], radiusM: draft.radiusM });
      setDraft(null);
      setName('');
      setPriority('IMPORTANT');
    } finally {
      setSaving(false);
    }
  }

  return <>
    <Pane name="watch-areas" style={{ zIndex: 350 }}>
      {areas.map((area) => {
        const color = priorityColor[area.priority];
        const enabled = Boolean(area.enabled);
        return <Circle key={area.id} center={[Number(area.center_lat), Number(area.center_lng)]} radius={Number(area.radius_m)} pathOptions={{ color, fillColor: color, fillOpacity: enabled ? .09 : .025, opacity: enabled ? .9 : .35, weight: area.priority === 'CRITICAL' ? 3 : 2, dashArray: enabled ? undefined : '6 6' }}>
          <Tooltip sticky><strong>{area.name}</strong><br/>{priorityLabel[area.priority]} · {(Number(area.radius_m) / 1000).toFixed(Number(area.radius_m) >= 1000 ? 1 : 2)} กม. · {enabled ? 'เปิดเฝ้าระวัง' : 'ปิดชั่วคราว'}</Tooltip>
          <Popup minWidth={230}>
            <div className="p-3 font-sans">
              <div className="flex items-center gap-2"><ShieldAlert size={15} style={{ color }}/><strong className="text-[11px] text-slate-900">{area.name}</strong></div>
              <div className="mt-1 text-[9px] font-semibold text-slate-500">ระดับ {priorityLabel[area.priority]} · รัศมี {Math.round(Number(area.radius_m))} ม.</div>
              {canEdit && <button type="button" onClick={() => void onUpdate(area.id, { enabled: !enabled })} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[9px] font-bold text-slate-700">{enabled ? <EyeOff size={12}/> : <Eye size={12}/>} {enabled ? 'ปิดเฝ้าระวัง' : 'เปิดเฝ้าระวัง'}</button>}
            </div>
          </Popup>
        </Circle>;
      })}
    </Pane>

    <WatchAreaDrawer active={drawing} onDraft={(value) => { setDraft(value); setName(''); }} onActiveChange={setDrawing}/>

    {canEdit && <button type="button" className={`watch-area-toggle ${drawing ? 'is-active' : ''}`} onClick={() => setDrawing((value) => !value)} title="ลากบนแผนที่เพื่อสร้างเขตเฝ้าระวัง"><ShieldAlert size={17}/><span>{drawing ? 'ลากวงบนแผนที่' : 'เขตเฝ้าระวัง'}</span></button>}

    <Dialog open={Boolean(draft)} onOpenChange={(open) => { if (!open) setDraft(null); }}>
      <DialogContent className="sm:w-[430px]">
        <DialogTitle>สร้างเขตเฝ้าระวัง</DialogTitle>
        <DialogDescription>พื้นที่นี้จะถูกบันทึกถาวร และ Dashboard จะแจ้งเตือนเมื่อมีรายงานใหม่อยู่ภายในเขต</DialogDescription>
        <div className="mt-4 space-y-3">
          <label className="block text-[10px] font-bold text-slate-600">ชื่อพื้นที่<Input className="mt-1" value={name} onChange={(event) => setName(event.target.value)} placeholder="เช่น เขตสนามบิน / พื้นที่สำคัญ 1" autoFocus/></label>
          <label className="block text-[10px] font-bold text-slate-600">ระดับความสำคัญ<select className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-800" value={priority} onChange={(event) => setPriority(event.target.value as WatchAreaPriority)}><option value="NORMAL">ปกติ</option><option value="IMPORTANT">สำคัญ</option><option value="CRITICAL">วิกฤต</option></select></label>
          <div className="rounded-xl bg-slate-50 px-3 py-2 text-[10px] font-semibold text-slate-600">รัศมีประมาณ <strong>{draft ? Math.round(draft.radiusM).toLocaleString('th-TH') : 0} เมตร</strong></div>
        </div>
        <div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={() => setDraft(null)}>ยกเลิก</Button><Button onClick={() => void save()} disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึกพื้นที่'}</Button></div>
      </DialogContent>
    </Dialog>
  </>;
}
