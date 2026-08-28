import L from 'leaflet';
import { ArrowRight, CircleDot, Crosshair, Eraser, MessageSquare, MousePointer2, MoveRight, Pencil, Pentagon, Square, Trash2, Type, Undo2 } from 'lucide-react';
import { Fragment, useEffect, useRef, useState } from 'react';
import { Circle, Marker, Pane, Polygon, Polyline, Rectangle, useMap, useMapEvents } from 'react-leaflet';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';

type Position = [number, number];
type Tool = 'select' | 'point' | 'pen' | 'line' | 'arrow' | 'polygon' | 'rectangle' | 'circle' | 'text' | 'callout' | 'target' | 'erase';
type ShapeKind = 'pen' | 'line' | 'arrow' | 'polygon' | 'rectangle' | 'circle';
type Annotation = {
  id: string;
  kind: Tool;
  position?: Position;
  positions?: Position[];
  radius?: number;
  text?: string;
};
type Draft = { kind: ShapeKind; start: Position; points: Position[]; radius?: number };
type EditorState = { mode: 'create' | 'edit'; kind: 'text' | 'callout'; position?: Position; id?: string; text: string };

const labelIcon = (text: string, callout = false, selected = false) => L.divIcon({
  className: 'map-annotation-icon',
  html: `<div class="map-annotation-label${callout ? ' map-callout-label' : ''}${selected ? ' is-selected' : ''}">${escapeHtml(text)}</div>`,
  iconSize: undefined,
  iconAnchor: callout ? [12, 42] : [0, 17],
});
const pointIcon = (selected: boolean) => L.divIcon({ className: 'map-annotation-icon', html: `<div class="map-annotation-point${selected ? ' is-selected' : ''}">●</div>`, iconSize: [24, 24], iconAnchor: [12, 12] });
const targetIcon = (selected: boolean) => L.divIcon({ className: 'map-annotation-icon', html: `<div class="map-annotation-target${selected ? ' is-selected' : ''}">◎</div>`, iconSize: [36, 36], iconAnchor: [18, 18] });
const arrowIcon = (bearing: number, selected: boolean) => L.divIcon({ className: 'map-annotation-icon', html: `<div class="map-arrow-head${selected ? ' is-selected' : ''}" style="transform:rotate(${bearing}deg)">➜</div>`, iconSize: [24, 24], iconAnchor: [12, 12] });

function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character] || character)); }
function position(latlng: L.LatLng): Position { return [latlng.lat, latlng.lng]; }
function bearing(from: Position, to: Position) { return Math.atan2(to[1] - from[1], to[0] - from[0]) * 180 / Math.PI + 90; }
function annotationId() { return `annotation-${Date.now()}-${Math.random().toString(16).slice(2)}`; }

const tools: Array<{ id: Tool; label: string; icon: typeof MousePointer2; hint: string }> = [
  { id: 'select', label: 'เลือก', icon: MousePointer2, hint: 'เลือกหรือย้ายป้ายข้อความ' },
  { id: 'point', label: 'หมุด', icon: CircleDot, hint: 'วางหมุดชี้จุด' },
  { id: 'pen', label: 'ดินสอ', icon: Pencil, hint: 'ลากเพื่อวาดเส้นอิสระ' },
  { id: 'line', label: 'เส้น', icon: MoveRight, hint: 'ลากเพื่อวาดเส้น' },
  { id: 'arrow', label: 'ลูกศร', icon: ArrowRight, hint: 'ลากเพื่อระบุทิศทาง' },
  { id: 'polygon', label: 'พื้นที่', icon: Pentagon, hint: 'คลิกจุด แล้วดับเบิลคลิกเพื่อจบ' },
  { id: 'rectangle', label: 'สี่เหลี่ยม', icon: Square, hint: 'ลากเพื่อวาดสี่เหลี่ยม' },
  { id: 'circle', label: 'วงกลม', icon: CircleDot, hint: 'ลากจากจุดศูนย์กลาง' },
  { id: 'text', label: 'ข้อความ', icon: Type, hint: 'คลิกและพิมพ์ข้อความ' },
  { id: 'callout', label: 'Callout', icon: MessageSquare, hint: 'ปักโน้ตชี้ตำแหน่ง' },
  { id: 'target', label: 'Target', icon: Crosshair, hint: 'วางสัญลักษณ์เน้นจุด' },
  { id: 'erase', label: 'ยางลบ', icon: Eraser, hint: 'คลิกสิ่งที่ต้องการลบ' },
];

function AnnotationCanvas({ tool, annotations, setAnnotations, selectedId, setSelectedId, onCreateText, onEditText }: {
  tool: Tool;
  annotations: Annotation[];
  setAnnotations: React.Dispatch<React.SetStateAction<Annotation[]>>;
  selectedId: string | null;
  setSelectedId: (value: string | null) => void;
  onCreateText: (kind: 'text' | 'callout', point: Position) => void;
  onEditText: (item: Annotation) => void;
}) {
  const map = useMap();
  const draftRef = useRef<Draft | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const setCurrentDraft = (next: Draft | null) => { draftRef.current = next; setDraft(next); };
  const remove = (id: string) => { setAnnotations((items) => items.filter((item) => item.id !== id)); if (selectedId === id) setSelectedId(null); };
  const select = (id: string) => { if (tool === 'erase') remove(id); else setSelectedId(id); };

  const completeDraft = (value: Draft) => {
    if ((value.kind === 'pen' && value.points.length < 2) || ((value.kind === 'line' || value.kind === 'arrow') && value.points.length < 2) || (value.kind === 'polygon' && value.points.length < 3)) return setCurrentDraft(null);
    const id = annotationId();
    setAnnotations((items) => [...items, { id, kind: value.kind, positions: value.points, position: value.start, radius: value.radius }]);
    setSelectedId(id);
    setCurrentDraft(null);
    map.dragging.enable();
  };

  useEffect(() => () => { map.dragging.enable(); }, [map]);

  useMapEvents({
    click(event) {
      if (tool === 'point' || tool === 'target') {
        const id = annotationId();
        setAnnotations((items) => [...items, { id, kind: tool, position: position(event.latlng) }]);
        setSelectedId(id);
      }
      if (tool === 'text' || tool === 'callout') onCreateText(tool, position(event.latlng));
      if (tool === 'polygon') {
        const current = draftRef.current;
        if (current?.kind === 'polygon') setCurrentDraft({ ...current, points: [...current.points, position(event.latlng)] });
        else setCurrentDraft({ kind: 'polygon', start: position(event.latlng), points: [position(event.latlng)] });
      }
    },
    dblclick(event) {
      if (tool !== 'polygon' || !draftRef.current || draftRef.current.kind !== 'polygon') return;
      L.DomEvent.preventDefault(event.originalEvent);
      L.DomEvent.stopPropagation(event.originalEvent);
      completeDraft(draftRef.current);
    },
    mousedown(event) {
      const kind = tool as ShapeKind;
      if (!['pen', 'line', 'arrow', 'rectangle', 'circle'].includes(kind)) return;
      map.dragging.disable();
      setCurrentDraft({ kind, start: position(event.latlng), points: [position(event.latlng)] });
    },
    mousemove(event) {
      const current = draftRef.current;
      if (!current) return;
      const next = position(event.latlng);
      if (current.kind === 'pen') setCurrentDraft({ ...current, points: [...current.points, next] });
      else if (current.kind === 'circle') setCurrentDraft({ ...current, radius: map.distance(L.latLng(current.start), event.latlng) });
      else setCurrentDraft({ ...current, points: [current.start, next] });
    },
    mouseup() { if (draftRef.current && draftRef.current.kind !== 'polygon') completeDraft(draftRef.current); },
  });

  const preview = draft && draft.kind === 'circle'
    ? <Circle center={draft.start} radius={draft.radius || 0} pathOptions={{ color: '#1687e8', dashArray: '7 7', fillOpacity: .08 }} />
    : draft && draft.kind === 'rectangle' && draft.points[1]
      ? <Rectangle bounds={[draft.start, draft.points[1]]} pathOptions={{ color: '#1687e8', dashArray: '7 7', fillOpacity: .08 }} />
      : draft ? <Polyline positions={draft.points} pathOptions={{ color: '#1687e8', dashArray: '7 7', weight: 3 }} /> : null;

  return <>
    <Pane name="annotation-shapes" style={{ zIndex: 650 }}><>{annotations.map((item) => {
      const common = { eventHandlers: { click: () => select(item.id) } };
      const selected = item.id === selectedId;
      const shapeStyle = { color: selected ? '#f47a32' : '#1687e8', weight: selected ? 4 : 3, fillColor: '#1687e8', fillOpacity: item.kind === 'polygon' || item.kind === 'rectangle' || item.kind === 'circle' ? .12 : 0 };
      if (item.kind === 'pen' || item.kind === 'line') return <Polyline key={item.id} positions={item.positions || []} pathOptions={shapeStyle} {...common} />;
      if (item.kind === 'arrow') {
        const points = item.positions || [];
        return <Fragment key={item.id}><Polyline positions={points} pathOptions={shapeStyle} {...common}/>{points.length > 1 && <Marker position={points.at(-1)!} icon={arrowIcon(bearing(points[points.length - 2], points.at(-1)!), selected)} eventHandlers={{ click: () => select(item.id) }} pane="annotation-shapes" />}</Fragment>;
      }
      if (item.kind === 'polygon') return <Polygon key={item.id} positions={item.positions || []} pathOptions={shapeStyle} {...common} />;
      if (item.kind === 'rectangle' && item.positions?.[1]) return <Rectangle key={item.id} bounds={[item.positions[0], item.positions[1]]} pathOptions={shapeStyle} {...common} />;
      if (item.kind === 'circle' && item.position) return <Circle key={item.id} center={item.position} radius={item.radius || 0} pathOptions={shapeStyle} {...common} />;
      return null;
    })}</></Pane>
    <Pane name="annotation-labels" style={{ zIndex: 680 }}><>{annotations.filter((item) => ['point', 'target', 'text', 'callout'].includes(item.kind) && item.position).map((item) => {
      const selected = item.id === selectedId;
      const icon = item.kind === 'point' ? pointIcon(selected) : item.kind === 'target' ? targetIcon(selected) : labelIcon(item.text || '', item.kind === 'callout', selected);
      return <Marker key={item.id} position={item.position!} icon={icon} draggable={item.kind === 'text' || item.kind === 'callout'} pane="annotation-labels" eventHandlers={{
        click: () => select(item.id),
        dblclick: (event) => {
          if (item.kind !== 'text' && item.kind !== 'callout') return;
          L.DomEvent.preventDefault(event.originalEvent);
          L.DomEvent.stopPropagation(event.originalEvent);
          onEditText(item);
        },
        dragend: (event) => {
          const next = (event.target as L.Marker).getLatLng();
          setAnnotations((items) => items.map((value) => value.id === item.id ? { ...value, position: position(next) } : value));
        }
      }} />;
    })}</></Pane>
    {preview}
  </>;
}

export function MapAnnotationTools({ onNotify, onDrawingActiveChange }: { onNotify: (message: string) => void; onDrawingActiveChange?: (active: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const [tool, setTool] = useState<Tool>('select');
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [editorText, setEditorText] = useState('');
  const [clearOpen, setClearOpen] = useState(false);
  const toolbarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = toolbarRef.current;
    if (!element) return;
    L.DomEvent.disableClickPropagation(element);
    L.DomEvent.disableScrollPropagation(element);
  }, []);

  useEffect(() => {
    onDrawingActiveChange?.((open && tool !== 'select') || Boolean(editor) || clearOpen);
  }, [open, tool, editor, clearOpen, onDrawingActiveChange]);

  function openCreate(kind: 'text' | 'callout', point: Position) {
    setEditorText('');
    setEditor({ mode: 'create', kind, position: point, text: '' });
  }

  function openEdit(item: Annotation) {
    if ((item.kind !== 'text' && item.kind !== 'callout') || !item.position) return;
    setSelectedId(item.id);
    setEditorText(item.text || '');
    setEditor({ mode: 'edit', kind: item.kind, position: item.position, id: item.id, text: item.text || '' });
  }

  function saveEditor() {
    if (!editor) return;
    const text = editorText.trim();
    if (!text) return onNotify('กรุณาพิมพ์ข้อความ');
    if (editor.mode === 'create' && editor.position) {
      const id = annotationId();
      setAnnotations((items) => [...items, { id, kind: editor.kind, position: editor.position, text }]);
      setSelectedId(id);
      onNotify(editor.kind === 'text' ? 'เพิ่มข้อความแล้ว' : 'เพิ่ม Callout แล้ว');
    } else if (editor.id) {
      setAnnotations((items) => items.map((item) => item.id === editor.id ? { ...item, text } : item));
      onNotify('บันทึกข้อความแล้ว');
    }
    setEditor(null);
  }

  function clearAll() {
    setAnnotations([]);
    setSelectedId(null);
    setClearOpen(false);
    onNotify('ล้างภาพวาดแล้ว');
  }

  return <>
    <AnnotationCanvas tool={tool} annotations={annotations} setAnnotations={setAnnotations} selectedId={selectedId} setSelectedId={setSelectedId} onCreateText={openCreate} onEditText={openEdit} />
    <div ref={toolbarRef} className="map-annotation-toolbar" aria-label="เครื่องมือวาดแผนที่">
      {open && <div className="map-tool-row">{tools.map((item) => {
        const Icon = item.icon;
        return <button key={item.id} type="button" title={item.hint} aria-label={item.label} className={`map-tool-button ${tool === item.id ? 'is-active' : ''}`} onClick={() => setTool(item.id)}><Icon size={17}/><span>{item.label}</span></button>;
      })}<span className="map-tool-divider"/><button type="button" title="ย้อนกลับหนึ่งรายการ" aria-label="ย้อนกลับ" className="map-tool-button" onClick={() => { setAnnotations((items) => items.slice(0, -1)); setSelectedId(null); }} disabled={!annotations.length}><Undo2 size={17}/><span>Undo</span></button><button type="button" title="ล้างภาพวาด" aria-label="ล้างภาพวาด" className="map-tool-button danger" onClick={() => setClearOpen(true)} disabled={!annotations.length}><Trash2 size={17}/><span>ล้าง</span></button></div>}
      <button type="button" className={`map-pencil-toggle ${open ? 'is-open' : ''}`} title="เครื่องมือเขียนบนแผนที่" onClick={() => setOpen((value) => !value)}><Pencil size={19}/><span>{open ? 'ซ่อนเครื่องมือ' : 'วาดบนแผนที่'}</span></button>
    </div>

    <Dialog open={Boolean(editor)} onOpenChange={(next) => { if (!next) setEditor(null); }}>
      <DialogContent className="max-h-[calc(100dvh-24px)] overflow-y-auto sm:w-[430px]">
        <DialogTitle>{editor?.mode === 'edit' ? 'แก้ไขข้อความ' : editor?.kind === 'callout' ? 'เพิ่มคำอธิบายจุด' : 'เพิ่มข้อความบนแผนที่'}</DialogTitle>
        <DialogDescription>{editor?.kind === 'callout' ? 'ข้อความจะชี้ไปยังตำแหน่งที่เลือกบนแผนที่' : 'ข้อความจะถูกวางตรงตำแหน่งที่คลิกไว้'}</DialogDescription>
        <div className="mt-5">
          {editor?.kind === 'callout'
            ? <textarea autoFocus rows={4} value={editorText} onChange={(event) => setEditorText(event.target.value)} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') saveEditor(); }} placeholder="พิมพ์คำอธิบายจุด" className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"/>
            : <Input autoFocus value={editorText} onChange={(event) => setEditorText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') saveEditor(); }} placeholder="พิมพ์ข้อความ"/>}
        </div>
        <div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={() => setEditor(null)}>ยกเลิก</Button><Button onClick={saveEditor}>{editor?.mode === 'edit' ? 'บันทึก' : editor?.kind === 'callout' ? 'เพิ่ม Callout' : 'เพิ่มข้อความ'}</Button></div>
      </DialogContent>
    </Dialog>

    <Dialog open={clearOpen} onOpenChange={setClearOpen}>
      <DialogContent className="max-h-[calc(100dvh-24px)] overflow-y-auto sm:w-[410px]">
        <DialogTitle>ล้างภาพวาดทั้งหมด?</DialogTitle>
        <DialogDescription>ข้อความ เส้น ลูกศร พื้นที่ และสัญลักษณ์ทั้งหมดบนแผนที่จะถูกลบ การล้างนี้มีผลเฉพาะหน้าจอปัจจุบัน</DialogDescription>
        <div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={() => setClearOpen(false)}>ยกเลิก</Button><Button className="bg-red-600 hover:bg-red-700" onClick={clearAll}>ล้างทั้งหมด</Button></div>
      </DialogContent>
    </Dialog>
  </>;
}
