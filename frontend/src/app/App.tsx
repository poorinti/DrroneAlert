import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, FileDown, Layers3, LoaderCircle, LogOut, RefreshCw, Search, Settings as SettingsIcon, UserRound, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { io } from 'socket.io-client';
import { FilterCard } from '../components/dashboard/FilterCard';
import { Navbar } from '../components/dashboard/Navbar';
import { SummaryCard } from '../components/dashboard/SummaryCard';
import { IncidentInsights } from '../components/dashboard/IncidentInsights';
import { IncidentMap, type InspectionLocation, type MapCoordinate } from '../components/map/IncidentMap';
import { DetailSheet } from '../components/reports/DetailSheet';
import { ExportDialog } from '../components/reports/ExportDialog';
import { ReportList } from '../components/reports/ReportList';
import { PasswordDialog } from '../components/settings/PasswordDialog';
import { SettingsDialog } from '../components/settings/SettingsDialog';
import { api, geocodePlace, getIncidentAnalysis, getMe, getNotifications, getReport, getReports, getSettings, getStats, markAllRead, markRead, saveCorrelationDecision } from '../lib/api';
import { brandingAssetUrl, updateFavicon } from '../lib/branding';
import { coordinates } from '../lib/coordinates';
import { isMapStyleId, mapStyles, type MapStyleId } from '../lib/mapStyles';
import type { CorrelationCandidate, DetailResponse, IncidentAnalysis, ReportSummary, Settings, Stats, User } from '../types';

const emptyStats: Stats = { total: 0, today: 0, active: 0, critical: 0 };
const defaultSettings: Settings = {
  app_title: 'D DRONE',
  organization_name: 'ศูนย์ควบคุมและเฝ้าระวังอากาศยาน',
  app_logo_path: '',
  secondary_logo_path: '',
  navbar_surface_mode: 'white',
  navbar_surface_color: '#dbeafe',
  panel_surface_mode: 'white',
  panel_surface_color: '#ffffff',
};

function tintHex(hex: string, amount: number) {
  const clean = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : 'ffffff';
  const rgb = [0, 2, 4].map((index) => Number.parseInt(clean.slice(index, index + 2), 16));
  const mixed = rgb.map((value) => Math.round(255 - ((255 - value) * amount)));
  return `${mixed[0]}, ${mixed[1]}, ${mixed[2]}`;
}

function surfaceValue(mode: Settings['navbar_surface_mode'], color: string, kind: 'navbar' | 'panel' | 'row' | 'soft' | 'control') {
  if (mode === 'glass') {
    if (kind === 'navbar') return 'rgba(255,255,255,.64)';
    if (kind === 'panel') return 'rgba(255,255,255,.48)';
    if (kind === 'row') return 'rgba(255,255,255,.56)';
    if (kind === 'soft') return 'rgba(248,250,252,.42)';
    return 'rgba(255,255,255,.58)';
  }
  if (mode === 'white') {
    if (kind === 'soft') return 'rgba(248,250,252,.90)';
    if (kind === 'control') return 'rgba(255,255,255,.96)';
    return kind === 'row' ? '#ffffff' : 'rgba(255,255,255,.98)';
  }
  const strength = kind === 'row' ? 0.34 : kind === 'soft' ? 0.24 : kind === 'control' ? 0.30 : 0.44;
  const alpha = kind === 'row' ? '.94' : kind === 'soft' ? '.88' : kind === 'control' ? '.92' : '.94';
  return `rgba(${tintHex(color, strength)},${alpha})`;
}

function borderValue(mode: Settings['navbar_surface_mode'], color: string) {
  if (mode === 'glass') return 'rgba(255,255,255,.90)';
  if (mode === 'white') return 'rgba(226,232,240,.92)';
  return `rgba(${tintHex(color, 0.48)},.88)`;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [stats, setStats] = useState(emptyStats);
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [analysisWindow, setAnalysisWindow] = useState<15 | 30 | 60>(30);
  const [analysis, setAnalysis] = useState<IncidentAnalysis>({ windowMinutes: 30, hotZones: [], correlations: [] });
  const [unread, setUnread] = useState<ReportSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [severity, setSeverity] = useState('');
  const [status, setStatus] = useState('');
  const [date, setDate] = useState('');
  const [month, setMonth] = useState('');
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');
  const [historyMode, setHistoryMode] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [liveCoordinate, setLiveCoordinate] = useState<MapCoordinate | null>(null);
  const [inspection, setInspection] = useState<InspectionLocation | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [fatal, setFatal] = useState('');
  const [mapStyle, setMapStyle] = useState<MapStyleId>(() => {
    const saved = localStorage.getItem('ddrone-map-style');
    return isMapStyleId(saved) ? saved : 'osm';
  });
  const [surfacePreview, setSurfacePreview] = useState<Partial<Pick<Settings, 'navbar_surface_mode' | 'navbar_surface_color' | 'panel_surface_mode' | 'panel_surface_color'>> | null>(null);

  const surfaceSettings = surfacePreview ? { ...settings, ...surfacePreview } : settings;
  const dashboardStyle = useMemo(() => ({
    '--navbar-surface-bg': surfaceValue(surfaceSettings.navbar_surface_mode, surfaceSettings.navbar_surface_color, 'navbar'),
    '--navbar-surface-border': borderValue(surfaceSettings.navbar_surface_mode, surfaceSettings.navbar_surface_color),
    '--panel-surface-bg': surfaceValue(surfaceSettings.panel_surface_mode, surfaceSettings.panel_surface_color, 'panel'),
    '--panel-surface-border': borderValue(surfaceSettings.panel_surface_mode, surfaceSettings.panel_surface_color),
    '--panel-row-bg': surfaceValue(surfaceSettings.panel_surface_mode, surfaceSettings.panel_surface_color, 'row'),
    '--panel-soft-bg': surfaceValue(surfaceSettings.panel_surface_mode, surfaceSettings.panel_surface_color, 'soft'),
    '--panel-control-bg': surfaceValue(surfaceSettings.panel_surface_mode, surfaceSettings.panel_surface_color, 'control'),
  }) as CSSProperties, [surfaceSettings.navbar_surface_mode, surfaceSettings.navbar_surface_color, surfaceSettings.panel_surface_mode, surfaceSettings.panel_surface_color]);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2800);
  }, []);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set('scope', historyMode ? 'history' : 'active');
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (severity) params.set('severity', severity);
    if (status) params.set('status', status);
    if (date) params.set('date', date);
    else if (rangeFrom || rangeTo) {
      if (rangeFrom) params.set('from', rangeFrom);
      if (rangeTo) params.set('to', rangeTo);
    } else if (month) params.set('month', month);
    return params;
  }, [historyMode, debouncedSearch, severity, status, date, month, rangeFrom, rangeTo]);

  const refresh = useCallback(async () => {
    try {
      const [rows, nextStats, notifications, nextAnalysis] = await Promise.all([getReports(query), getStats(), getNotifications(), getIncidentAnalysis(analysisWindow)]);
      setReports(rows);
      setStats(nextStats);
      setUnread(notifications.reports);
      setAnalysis(nextAnalysis);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'โหลดข้อมูลไม่สำเร็จ');
    }
  }, [query, analysisWindow, notify]);

  useEffect(() => {
    localStorage.setItem('ddrone-map-style', mapStyle);
  }, [mapStyle]);

  useEffect(() => {
    if (!mobilePanelOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMobilePanelOpen(false); };
    const closeOnWideScreen = () => { if (window.innerWidth > 680) setMobilePanelOpen(false); };
    window.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', closeOnWideScreen);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', closeOnWideScreen);
    };
  }, [mobilePanelOpen]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 280);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    (async () => {
      try {
        const me = await getMe();
        if (!me.user) {
          window.location.href = '/login/';
          return;
        }
        setUser(me.user);
        const [nextSettings, nextStats, rows, notifications, nextAnalysis] = await Promise.all([
          getSettings(),
          getStats(),
          getReports(new URLSearchParams('scope=active')),
          getNotifications(),
          getIncidentAnalysis(30),
        ]);
        setSettings(nextSettings);
        setStats(nextStats);
        setReports(rows);
        setUnread(notifications.reports);
        setAnalysis(nextAnalysis);
        document.title = `${nextSettings.app_title || 'D DRONE'} · ศูนย์บัญชาการ`;
        updateFavicon(brandingAssetUrl(nextSettings.app_logo_path));
      } catch (error) {
        setFatal(error instanceof Error ? error.message : 'เปิดศูนย์บัญชาการไม่สำเร็จ');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!loading) refresh();
  }, [query, loading, refresh]);

  useEffect(() => {
    if (!user) return;
    const syncSettings = async () => {
      try {
        const next = await getSettings();
        setSettings(next);
        document.title = `${next.app_title || 'D DRONE'} · ศูนย์บัญชาการ`;
        updateFavicon(brandingAssetUrl(next.app_logo_path));
      } catch {
        // api() handles expired sessions by redirecting to the login page.
      }
    };
    const handleFocus = () => { void syncSettings(); };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void syncSettings();
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const socket = io();
    socket.on('report:new', async () => {
      notify('มีรายงานเหตุใหม่');
      await refresh();
    });
    socket.on('report:updated', async (event) => {
      await refresh();
      if (selectedId === Number(event.id)) setDetail(await getReport(Number(event.id)));
    });
    socket.on('analysis:updated', async () => {
      await refresh();
    });
    return () => { socket.disconnect(); };
  }, [user, refresh, selectedId, notify]);

  async function selectReport(report: ReportSummary) {
    setSelectedId(report.id);
    setDetailLoading(true);
    try {
      const data = await getReport(report.id);
      setDetail(data);
      const shouldMarkRead = Boolean(report.is_unread) || unread.some((item) => item.id === report.id);
      if (shouldMarkRead) {
        await markRead(report.id);
        setUnread((items) => items.filter((item) => item.id !== report.id));
        setReports((items) => items.map((item) => item.id === report.id ? { ...item, is_unread: false } : item));
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : 'โหลดรายละเอียดไม่สำเร็จ');
    } finally {
      setDetailLoading(false);
    }
  }

  async function selectReportById(id: number) {
    const known = reports.find((report) => report.id === id)
      || analysis.correlations.flatMap((item) => [item.reportA, item.reportB]).find((report) => report.id === id);
    if (known) return selectReport(known);
    setSelectedId(id);
    setDetailLoading(true);
    try {
      setDetail(await getReport(id));
    } catch (error) {
      notify(error instanceof Error ? error.message : 'โหลดรายละเอียดไม่สำเร็จ');
    } finally {
      setDetailLoading(false);
    }
  }

  async function decideCorrelation(candidate: CorrelationCandidate, decision: 'CONFIRMED' | 'DISMISSED') {
    try {
      await saveCorrelationDecision(candidate.reportA.id, candidate.reportB.id, decision);
      setAnalysis(await getIncidentAnalysis(analysisWindow));
      notify(decision === 'CONFIRMED' ? 'ยืนยันว่าเหตุมีความเกี่ยวข้องกันแล้ว' : 'ทำเครื่องหมายว่าเหตุไม่เกี่ยวข้องกันแล้ว');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'บันทึกผลการพิจารณาไม่สำเร็จ');
    }
  }

  async function saveState(nextStatus: string, nextSeverity: string) {
    if (!selectedId || !detail) return;
    const body: Record<string, string> = {};
    if (nextStatus !== detail.report.status) body.status = nextStatus;
    if (nextSeverity !== (detail.report.operator_severity || detail.report.reporter_severity)) body.operatorSeverity = nextSeverity;
    if (!Object.keys(body).length) return notify('ยังไม่มีข้อมูลที่เปลี่ยนแปลง');
    await api(`/api/admin/reports/${selectedId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setDetail(await getReport(selectedId));
    await refresh();
    notify('บันทึกข้อมูลเหตุเรียบร้อย');
  }

  async function complete() {
    if (!selectedId) return;
    await api(`/api/admin/reports/${selectedId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'RESOLVED' }) });
    setSelectedId(null);
    setDetail(null);
    await refresh();
    notify('ย้ายเหตุไปยังเหตุการณ์ย้อนหลังแล้ว');
  }

  async function addNote(note: string) {
    if (!selectedId) return;
    await api(`/api/admin/reports/${selectedId}/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note }) });
    setDetail(await getReport(selectedId));
    notify('เพิ่มหมายเหตุเรียบร้อย');
  }

  async function addPublicMessage(message: string) {
    if (!selectedId) return;
    await api(`/api/admin/reports/${selectedId}/public-messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) });
    setDetail(await getReport(selectedId));
    notify('ส่งข้อความถึงผู้รายงานเรียบร้อย');
  }

  async function saveSettings(form: FormData) {
    const next = await api<Settings>('/api/admin/settings', { method: 'POST', body: form });
    setSettings(next);
    setSurfacePreview(null);
    document.title = `${next.app_title || 'D DRONE'} · ศูนย์บัญชาการ`;
    updateFavicon(brandingAssetUrl(next.app_logo_path));
    notify('บันทึกการตั้งค่าเรียบร้อย');
  }

  async function readAll() {
    await markAllRead();
    setUnread([]);
    setReports((items) => items.map((item) => ({ ...item, is_unread: false })));
    notify('ทำเครื่องหมายว่าอ่านทั้งหมดแล้ว');
  }

  const inspectMapCoordinate = useCallback((coordinate: MapCoordinate) => {
    setLiveCoordinate(coordinate);
    setInspection({ ...coordinate, fly: false, token: Date.now() });
  }, []);

  async function submitSmartSearch() {
    const queryText = search.trim();
    if (!queryText) return;

    let exactReport = reports.find((report) => report.report_no.toLocaleLowerCase() === queryText.toLocaleLowerCase());
    if (!exactReport && /^(DRN|DEMO)-/i.test(queryText)) {
      try {
        const reportQuery = new URLSearchParams(query);
        reportQuery.set('search', queryText);
        const matches = await getReports(reportQuery);
        exactReport = matches.find((report) => report.report_no.toLocaleLowerCase() === queryText.toLocaleLowerCase());
      } catch (error) {
        notify(error instanceof Error ? error.message : 'ค้นหารายงานไม่สำเร็จ');
        return;
      }
    }
    if (exactReport) {
      await selectReport(exactReport);
      return;
    }
    if (/^(DRN|DEMO)-/i.test(queryText)) {
      notify('ไม่พบเลขที่รายงานที่ค้นหาในช่วงข้อมูลปัจจุบัน');
      return;
    }

    const coordinateMatch = queryText.match(/^\s*(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);
    if (coordinateMatch) {
      const lat = Number(coordinateMatch[1]);
      const lng = Number(coordinateMatch[2]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        notify('พิกัดไม่ถูกต้อง กรุณาตรวจสอบ Latitude / Longitude');
        return;
      }
      const coordinate = { lat, lng };
      setLiveCoordinate(coordinate);
      setInspection({ ...coordinate, fly: true, token: Date.now() });
      return;
    }

    const mgrsValidation = coordinates.validateMgrs(queryText);
    if (mgrsValidation.valid) {
      const parsed = coordinates.fromMgrs(queryText);
      if (!parsed) {
        notify('ไม่สามารถแปลงพิกัด MGRS นี้ได้');
        return;
      }
      const coordinate = { lat: parsed.lat, lng: parsed.lng };
      setLiveCoordinate(coordinate);
      setInspection({ ...coordinate, label: `MGRS ${parsed.mgrs || queryText.toUpperCase()}`, fly: true, token: Date.now() });
      return;
    }
    if (/^\s*\d{1,2}[C-HJ-NP-X]/i.test(queryText)) {
      notify(mgrsValidation.error || 'รูปแบบ MGRS ไม่ถูกต้อง');
      return;
    }

    setSearchLoading(true);
    try {
      const result = await geocodePlace(queryText);
      const coordinate = { lat: Number(result.lat), lng: Number(result.lng) };
      setLiveCoordinate(coordinate);
      setInspection({ ...coordinate, label: result.display_name, fly: true, token: Date.now() });
    } catch (error) {
      notify(error instanceof Error ? error.message : 'ไม่สามารถค้นหาสถานที่ได้ในขณะนี้');
    } finally {
      setSearchLoading(false);
    }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login/';
  }

  function changeMode(nextHistory: boolean) {
    setHistoryMode(nextHistory);
    setSelectedId(null);
    setDetail(null);
    setStatus('');
    if (!nextHistory) {
      setDate('');
      setMonth('');
      setRangeFrom('');
      setRangeTo('');
    }
  }

  function changeDate(value: string) {
    setDate(value);
    if (value) {
      setMonth('');
      setRangeFrom('');
      setRangeTo('');
    }
  }

  function changeMonth(value: string) {
    setMonth(value);
    if (value) {
      setDate('');
      setRangeFrom('');
      setRangeTo('');
    }
  }

  function changeRange(from: string, to: string) {
    setRangeFrom(from);
    setRangeTo(to);
    if (from || to) {
      setDate('');
      setMonth('');
    }
  }

  function clearFilters() {
    setSeverity('');
    setStatus('');
    setDate('');
    setMonth('');
    setRangeFrom('');
    setRangeTo('');
  }

  if (loading) return <div className="grid h-screen place-items-center bg-slate-50 text-sm text-muted"><span className="flex items-center gap-3"><i className="loading-dot"/>กำลังเปิดศูนย์บัญชาการ...</span></div>;
  if (fatal || !user) return <div className="grid h-screen place-items-center bg-slate-50"><div className="text-center text-sm text-red-600"><AlertCircle className="mx-auto mb-2"/>{fatal || 'ไม่พบบัญชีผู้ใช้'}</div></div>;

  return <main className="dashboard-app relative h-screen w-screen overflow-hidden bg-slate-200" style={dashboardStyle}>
    <IncidentMap reports={reports} hotZones={analysis.hotZones} correlations={analysis.correlations} selectedId={selectedId} onSelect={selectReport} mapStyle={mapStyle} inspection={inspection} onInspect={inspectMapCoordinate} onCoordinateChange={setLiveCoordinate} onNotify={notify}/>
    <Navbar user={user} settings={settings} search={search} searchLoading={searchLoading} liveCoordinate={liveCoordinate} unread={unread} mapStyle={mapStyle} onSearch={setSearch} onSearchSubmit={submitSmartSearch} onRefresh={refresh} onSettings={() => setSettingsOpen(true)} onPassword={() => setPasswordOpen(true)} onLogout={logout} onExport={() => setExportOpen(true)} onMapStyle={setMapStyle} onNotification={selectReport} onReadAll={readAll} onMobilePanel={() => setMobilePanelOpen(true)}/>
    {!historyMode && <IncidentInsights hotZones={analysis.hotZones} correlations={analysis.correlations} windowMinutes={analysisWindow} role={user.role} onWindowChange={setAnalysisWindow} onSelectReport={(id) => { void selectReportById(id); }} onDecision={(candidate, decision) => { void decideCorrelation(candidate, decision); }}/>} 

    <div className="dashboard-left-stack pointer-events-none fixed bottom-3 left-3 top-[88px] z-[800] flex w-[350px] max-w-[calc(100vw-24px)] flex-col gap-2.5 sm:bottom-4 sm:left-4 sm:top-[92px] sm:max-w-[calc(100vw-32px)]">
      <div className="pointer-events-auto"><SummaryCard stats={stats}/></div>
      <div className="pointer-events-auto"><FilterCard severity={severity} status={status} date={date} month={month} rangeFrom={rangeFrom} rangeTo={rangeTo} historyMode={historyMode} onSeverity={setSeverity} onStatus={setStatus} onDate={changeDate} onMonth={changeMonth} onRange={changeRange} onMode={changeMode} onClear={clearFilters}/></div>
      <div className="pointer-events-auto flex min-h-0 flex-1"><ReportList reports={reports} selectedId={selectedId} loading={loading} historyMode={historyMode} onSelect={selectReport}/></div>
    </div>

    {mobilePanelOpen && <>
        <button
          type="button"
          aria-label="ปิดแผงข้อมูล"
          className="mobile-dashboard-overlay"
          onClick={() => setMobilePanelOpen(false)}
        />
        <section
          role="dialog"
          aria-modal="true"
          aria-label="ข้อมูลและเครื่องมือ Dashboard"
          className="mobile-dashboard-sheet"
        >
          <div className="mobile-sheet-handle"/>
          <div className="mobile-sheet-header">
            <div className="min-w-0">
              <strong className="block truncate text-[14px] font-extrabold text-slate-950">ข้อมูลศูนย์บัญชาการ</strong>
              <span className="text-[10px] font-semibold text-slate-500">{reports.length} เหตุ · {historyMode ? 'เหตุการณ์ย้อนหลัง' : 'เหตุปัจจุบัน'}</span>
            </div>
            <button type="button" className="mobile-sheet-close" onClick={() => setMobilePanelOpen(false)} aria-label="ปิด"><X size={18}/></button>
          </div>

          <div className="mobile-sheet-scroll">
            <form className="mobile-sheet-search" onSubmit={(event) => { event.preventDefault(); void (async () => { await submitSmartSearch(); setMobilePanelOpen(false); })(); }}>
              {searchLoading ? <LoaderCircle size={16} className="animate-spin text-blue-600"/> : <Search size={16} className="text-slate-400"/>}
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาเลขรายงาน สถานที่ หรือพิกัด" aria-label="ค้นหา"/>
              <button type="submit">ค้นหา</button>
            </form>

            <div className="mobile-sheet-tools">
              <label className="mobile-map-select"><Layers3 size={15}/><select value={mapStyle} onChange={(event) => setMapStyle(event.target.value as MapStyleId)} aria-label="รูปแบบแผนที่">{mapStyles.map((style) => <option key={style.id} value={style.id}>{style.label}</option>)}</select></label>
              <button type="button" onClick={() => { setMobilePanelOpen(false); setExportOpen(true); }}><FileDown size={15}/><span>ออกรายงาน</span></button>
              <button type="button" onClick={() => { void refresh(); }}><RefreshCw size={15}/><span>รีเฟรช</span></button>
              {user.role === 'SUPER_ADMIN' && <button type="button" onClick={() => { setMobilePanelOpen(false); setSettingsOpen(true); }}><SettingsIcon size={15}/><span>ตั้งค่า</span></button>}
            </div>

            <div className="mobile-sheet-section"><SummaryCard stats={stats}/></div>
            <div className="mobile-sheet-section"><FilterCard severity={severity} status={status} date={date} month={month} rangeFrom={rangeFrom} rangeTo={rangeTo} historyMode={historyMode} onSeverity={setSeverity} onStatus={setStatus} onDate={changeDate} onMonth={changeMonth} onRange={changeRange} onMode={changeMode} onClear={clearFilters}/></div>
            <div className="mobile-sheet-report-list flex min-h-[320px]"><ReportList reports={reports} selectedId={selectedId} loading={loading} historyMode={historyMode} onSelect={(report) => { setMobilePanelOpen(false); void selectReport(report); }}/></div>

            <div className="mobile-sheet-account">
              <div className="min-w-0"><strong className="block truncate text-[11px] text-slate-900">{user.username}</strong><span className="text-[9px] font-semibold text-slate-500">{user.role === 'SUPER_ADMIN' ? 'ผู้ดูแลระบบ' : user.role === 'OPERATOR' ? 'เจ้าหน้าที่' : 'ผู้ชม'}</span></div>
              <button type="button" onClick={() => { setMobilePanelOpen(false); setPasswordOpen(true); }}><UserRound size={15}/>รหัสผ่าน</button>
              <button type="button" className="danger" onClick={() => { setMobilePanelOpen(false); void logout(); }}><LogOut size={15}/>ออกจากระบบ</button>
            </div>
          </div>
        </section>
      </>}

    <DetailSheet open={selectedId !== null} data={detail} loading={detailLoading} role={user.role} onClose={() => { setSelectedId(null); setDetail(null); }} onSave={saveState} onNote={addNote} onPublicMessage={addPublicMessage} onComplete={complete}/>
    <SettingsDialog open={settingsOpen} settings={settings} onOpenChange={(open) => { setSettingsOpen(open); if (!open) setSurfacePreview(null); }} onPreview={(patch) => setSurfacePreview((current) => ({ ...(current || {}), ...patch }))} onSave={saveSettings}/>
    <PasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} onSuccess={() => notify('เปลี่ยนรหัสผ่านเรียบร้อย')}/>
    <ExportDialog open={exportOpen} date={date} month={month} rangeFrom={rangeFrom} rangeTo={rangeTo} onOpenChange={setExportOpen} onError={notify}/>
    <AnimatePresence>{toast && <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="fixed bottom-5 right-5 z-[5000] rounded-xl bg-slate-900 px-4 py-3 text-xs text-white shadow-2xl">{toast}</motion.div>}</AnimatePresence>
  </main>;
}
