import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { severityLabels } from '../../lib/labels';
import { timeAgo } from '../../lib/utils';
import type { ReportSummary } from '../../types';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

const colors: Record<string, string> = { LOW: '#4b8da3', MEDIUM: '#e6a528', HIGH: '#ef7138', CRITICAL: '#e6384f' };
const effectiveSeverity = (r: ReportSummary) => r.effective_severity || r.operator_severity || r.reporter_severity || 'MEDIUM';
function iconFor(report: ReportSummary, selected: boolean) { const sev = effectiveSeverity(report); return L.divIcon({ className: '', html: `<div class="incident-pin${selected ? ' selected' : ''}" style="--pin:${colors[sev]}"><span></span></div>`, iconSize: [28,28], iconAnchor: [14,25], popupAnchor: [0,-23] }); }
function MapFocus({ selected }: { selected?: ReportSummary }) { const map = useMap(); useEffect(() => { if (selected) map.flyTo([Number(selected.incident_lat), Number(selected.incident_lng)], Math.max(map.getZoom(), 14), { duration: .8 }); }, [selected, map]); return null; }
export function IncidentMap({ reports, selectedId, onSelect, isDark }: { reports: ReportSummary[]; selectedId: number | null; onSelect: (r: ReportSummary) => void; isDark: boolean }) {
  const selected = reports.find((r) => r.id === selectedId);
  const validReports = useMemo(() => reports.filter((r) => Number.isFinite(Number(r.incident_lat)) && Number.isFinite(Number(r.incident_lng))), [reports]);
  const tile = isDark ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  return <MapContainer center={[15.87,100.99]} zoom={6} zoomControl className="absolute inset-0 h-full w-full"><TileLayer attribution="&copy; OpenStreetMap &copy; CARTO" url={tile} maxZoom={19} /><MapFocus selected={selected} />{validReports.map((report) => { const sev = effectiveSeverity(report); return <Marker key={report.id} position={[Number(report.incident_lat), Number(report.incident_lng)]} icon={iconFor(report, report.id === selectedId)} eventHandlers={{ click: () => onSelect(report) }}><Popup closeButton={false} maxWidth={250}><div className="w-[230px] overflow-hidden rounded-2xl bg-white">{report.cover_image && <img src={`/uploads/${report.cover_image}`} className="h-28 w-full object-cover" alt="ภาพเหตุการณ์" />}<div className="p-3"><div className="flex items-center gap-2"><strong className="text-[11px]">{report.report_no}</strong><Badge tone={sev}>{severityLabels[sev]}</Badge></div><p className="mb-0 mt-2 text-[11px] font-semibold">{report.location_name || 'ไม่ระบุสถานที่'}</p><span className="text-[9px] text-muted">{timeAgo(report.submitted_at)}</span><Button size="sm" className="mt-2 w-full" onClick={() => onSelect(report)}>ดูรายละเอียด</Button></div></div></Popup></Marker>; })}</MapContainer>;
}
