import L from 'leaflet';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Circle, MapContainer, Marker, Pane, Polyline, Popup, TileLayer, Tooltip, ZoomControl, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Copy, ExternalLink } from 'lucide-react';
import { coordinates } from '../../lib/coordinates';
import { mapStyles, type MapStyleId } from '../../lib/mapStyles';
import { severityLabels } from '../../lib/labels';
import { timeAgo } from '../../lib/utils';
import type { CorrelationCandidate, HotZone, ReportSummary } from '../../types';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { MapAnnotationTools } from './MapAnnotationTools';

export type MapCoordinate = { lat: number; lng: number };
export type InspectionLocation = MapCoordinate & { label?: string; fly?: boolean; token: number };

const colors: Record<string, string> = { LOW: '#4b8da3', MEDIUM: '#e6a528', HIGH: '#ef7138', CRITICAL: '#e6384f' };
const effectiveSeverity = (report: ReportSummary) => report.effective_severity || report.operator_severity || report.reporter_severity || 'MEDIUM';

function iconFor(report: ReportSummary, selected: boolean) {
  const severity = effectiveSeverity(report);
  return L.divIcon({ className: '', html: `<div class="incident-pin${selected ? ' selected' : ''}" style="--pin:${colors[severity]}"><span></span></div>`, iconSize: [28, 28], iconAnchor: [14, 25], popupAnchor: [0, -23] });
}

const inspectionIcon = L.divIcon({
  className: 'gps-inspection-icon',
  html: '<div class="gps-inspection-marker"><span></span></div>',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
  popupAnchor: [0, -14],
});

function MapFocus({ selected }: { selected?: ReportSummary }) {
  const map = useMap();
  useEffect(() => {
    if (selected) map.flyTo([Number(selected.incident_lat), Number(selected.incident_lng)], Math.max(map.getZoom(), 14), { duration: .8 });
  }, [selected, map]);
  return null;
}

function MapInspector({ disabled, onCoordinate, onInspect }: { disabled: boolean; onCoordinate: (coordinate: MapCoordinate) => void; onInspect: (coordinate: MapCoordinate) => void }) {
  const map = useMap();
  const pending = useRef<MapCoordinate | null>(null);
  const frame = useRef<number | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    map.doubleClickZoom.disable();
    return () => {
      map.doubleClickZoom.enable();
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [map]);

  useEffect(() => {
    const container = map.getContainer();
    const cancelLongPress = () => {
      if (longPressTimer.current !== null) window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
      touchStart.current = null;
    };
    const coordinateFromTouch = (touch: Touch) => {
      const rect = container.getBoundingClientRect();
      return map.containerPointToLatLng(L.point(touch.clientX - rect.left, touch.clientY - rect.top));
    };
    const handleTouchStart = (event: TouchEvent) => {
      if (disabled || event.touches.length !== 1) return cancelLongPress();
      const touch = event.touches[0];
      touchStart.current = { x: touch.clientX, y: touch.clientY };
      const latlng = coordinateFromTouch(touch);
      const coordinate = { lat: latlng.lat, lng: latlng.lng };
      if (longPressTimer.current !== null) window.clearTimeout(longPressTimer.current);
      longPressTimer.current = window.setTimeout(() => {
        longPressTimer.current = null;
        touchStart.current = null;
        onCoordinate(coordinate);
        onInspect(coordinate);
      }, 650);
    };
    const handleTouchMove = (event: TouchEvent) => {
      if (!touchStart.current || event.touches.length !== 1) return cancelLongPress();
      const touch = event.touches[0];
      const dx = touch.clientX - touchStart.current.x;
      const dy = touch.clientY - touchStart.current.y;
      if (Math.hypot(dx, dy) > 12) cancelLongPress();
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: true });
    container.addEventListener('touchend', cancelLongPress, { passive: true });
    container.addEventListener('touchcancel', cancelLongPress, { passive: true });
    return () => {
      cancelLongPress();
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', cancelLongPress);
      container.removeEventListener('touchcancel', cancelLongPress);
    };
  }, [disabled, map, onCoordinate, onInspect]);

  useMapEvents({
    mousemove(event) {
      pending.current = { lat: event.latlng.lat, lng: event.latlng.lng };
      if (frame.current !== null) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        if (!pending.current) return;
        onCoordinate(pending.current);
      });
    },
    dblclick(event) {
      if (disabled) return;
      L.DomEvent.preventDefault(event.originalEvent);
      L.DomEvent.stopPropagation(event.originalEvent);
      const coordinate = { lat: event.latlng.lat, lng: event.latlng.lng };
      onCoordinate(coordinate);
      onInspect(coordinate);
    },
  });
  return null;
}

function InspectionMarker({ inspection, onNotify }: { inspection: InspectionLocation; onNotify: (message: string) => void }) {
  const map = useMap();
  const markerRef = useRef<L.Marker | null>(null);
  const [mgrsPrecision, setMgrsPrecision] = useState(5);
  const latLngCoordinate = coordinates.latLngText(inspection.lat, inspection.lng);
  const mgrsCoordinate = coordinates.toMgrs(inspection.lat, inspection.lng, mgrsPrecision);
  const coordinatePair = coordinates.pairText(inspection.lat, inspection.lng, { precision: mgrsPrecision });
  const googleUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${inspection.lat},${inspection.lng}`)}`;

  useEffect(() => {
    if (inspection.fly) map.flyTo([inspection.lat, inspection.lng], Math.max(map.getZoom(), 16), { duration: .75 });
    const timer = window.setTimeout(() => markerRef.current?.openPopup(), inspection.fly ? 620 : 40);
    return () => window.clearTimeout(timer);
  }, [inspection.token, inspection.lat, inspection.lng, inspection.fly, map]);

  async function copyText(value: string, label: string) {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value);
      else throw new Error('clipboard unavailable');
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
    onNotify(`คัดลอก${label}แล้ว`);
  }

  return <Pane name="gps-inspection" style={{ zIndex: 710 }}>
    <Marker ref={markerRef} position={[inspection.lat, inspection.lng]} icon={inspectionIcon} pane="gps-inspection">
      <Popup minWidth={280} maxWidth={330} closeButton>
        <div className="gps-popup">
          <strong>พิกัดตำแหน่ง</strong>
          {inspection.label && <p className="gps-popup-label">{inspection.label}</p>}
          <dl><div><dt>Latitude</dt><dd>{inspection.lat.toFixed(6)}</dd></div><div><dt>Longitude</dt><dd>{inspection.lng.toFixed(6)}</dd></div><div><dt>MGRS</dt><dd>{mgrsCoordinate || '-'}</dd></div></dl>
          <label className="gps-popup-precision">ความละเอียด MGRS<select value={mgrsPrecision} onChange={(event) => setMgrsPrecision(Number(event.target.value))}>{coordinates.precisionOptions.map((option) => <option key={option.precision} value={option.precision}>{option.label}</option>)}</select></label>
          <code>{coordinatePair}</code>
          <div className="gps-popup-copy-grid">
            <button type="button" onClick={() => copyText(latLngCoordinate, ' GPS')}><Copy size={12}/>GPS</button>
            <button type="button" disabled={!mgrsCoordinate} onClick={() => mgrsCoordinate && copyText(mgrsCoordinate, ' MGRS')}><Copy size={12}/>MGRS</button>
            <button type="button" onClick={() => copyText(coordinatePair, 'พิกัดทั้งคู่')}><Copy size={12}/>ทั้งคู่</button>
          </div>
          <div className="gps-popup-actions"><a href={googleUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={13}/>Google Maps</a></div>
        </div>
      </Popup>
    </Marker>
  </Pane>;
}

export function IncidentMap({ reports, hotZones, correlations, selectedId, onSelect, mapStyle, inspection, onInspect, onCoordinateChange, onNotify }: {
  reports: ReportSummary[];
  hotZones: HotZone[];
  correlations: CorrelationCandidate[];
  selectedId: number | null;
  onSelect: (report: ReportSummary) => void;
  mapStyle: MapStyleId;
  inspection: InspectionLocation | null;
  onInspect: (coordinate: MapCoordinate) => void;
  onCoordinateChange: (coordinate: MapCoordinate) => void;
  onNotify: (message: string) => void;
}) {
  const selected = reports.find((report) => report.id === selectedId);
  const validReports = useMemo(() => reports.filter((report) => Number.isFinite(Number(report.incident_lat)) && Number.isFinite(Number(report.incident_lng))), [reports]);
  const activeStyle = mapStyles.find((style) => style.id === mapStyle) || mapStyles[0];
  const [drawingActive, setDrawingActive] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 680px)').matches);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 680px)');
    const sync = () => {
      setIsMobile(media.matches);
      if (media.matches) setDrawingActive(false);
    };
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  return <div className="absolute inset-0">
    <MapContainer center={[15.87, 100.99]} zoom={6} zoomControl={false} className="absolute inset-0 h-full w-full" doubleClickZoom={false}>
      <ZoomControl position="bottomright" />
      <TileLayer key={activeStyle.id} attribution={activeStyle.attribution} url={activeStyle.url} maxZoom={19} maxNativeZoom={activeStyle.maxNativeZoom} />
      <MapFocus selected={selected} />
      <MapInspector disabled={drawingActive} onCoordinate={onCoordinateChange} onInspect={onInspect}/>
      <Pane name="hot-zones" style={{ zIndex: 360 }}>
        {hotZones.map((zone) => <Circle key={zone.id} center={[zone.lat, zone.lng]} radius={zone.radiusM} pathOptions={{ color: zone.criticalCount > 0 ? '#dc2626' : '#f97316', fillColor: zone.criticalCount > 0 ? '#ef4444' : '#fb923c', fillOpacity: .12, weight: 2, dashArray: '6 5' }}><Tooltip sticky><strong>Hot Zone · {zone.reportCount} รายงาน</strong><br/>{zone.criticalCount > 0 ? `Critical ${zone.criticalCount} · ` : ''}{zone.reportNos.slice(0, 4).join(' · ')}</Tooltip></Circle>)}
      </Pane>
      <Pane name="correlations" style={{ zIndex: 370 }}>
        {correlations.filter((item) => item.decision === 'CONFIRMED').map((item) => <Polyline key={item.id} positions={[[Number(item.reportA.incident_lat), Number(item.reportA.incident_lng)], [Number(item.reportB.incident_lat), Number(item.reportB.incident_lng)]]} pathOptions={{ color: '#2563eb', weight: 3, opacity: .7, dashArray: '8 6' }}><Tooltip>ยืนยันความเกี่ยวข้อง · {item.score}%</Tooltip></Polyline>)}
      </Pane>
      {validReports.map((report) => {
        const severity = effectiveSeverity(report);
        const reportCoordinate = coordinates.pairText(report.incident_lat, report.incident_lng);
        return <Marker key={report.id} position={[Number(report.incident_lat), Number(report.incident_lng)]} icon={iconFor(report, report.id === selectedId)} eventHandlers={{ click: () => onSelect(report) }}>
          <Tooltip direction="top" offset={[0, -20]} opacity={.96}><strong>{report.report_no}</strong><br/><span className="tabular-nums">{reportCoordinate}</span></Tooltip>
          <Popup closeButton={false} maxWidth={290}>
            <div className="w-[270px] overflow-hidden rounded-2xl bg-white">
              {report.cover_image && <img src={`/uploads/${report.cover_image}`} className="h-28 w-full object-cover" alt="ภาพเหตุการณ์" />}
              <div className="p-3">
                <div className="flex items-center gap-2"><strong className="text-[11px]">{report.report_no}</strong><Badge tone={severity}>{severityLabels[severity]}</Badge></div>
                <p className="mb-0 mt-2 text-[11px] font-semibold">{report.location_name || 'ไม่ระบุสถานที่'}</p>
                <p className="mb-0 mt-1 break-words font-mono text-[9px] font-semibold text-blue-700">{reportCoordinate}</p>
                <span className="text-[9px] text-muted">{timeAgo(report.submitted_at)}</span>
                <Button size="sm" className="mt-2 w-full" onClick={() => onSelect(report)}>ดูรายละเอียด</Button>
              </div>
            </div>
          </Popup>
        </Marker>;
      })}
      {inspection && <InspectionMarker inspection={inspection} onNotify={onNotify}/>}
      {!isMobile && <MapAnnotationTools onNotify={onNotify} onDrawingActiveChange={setDrawingActive}/>}
    </MapContainer>
  </div>;
}
