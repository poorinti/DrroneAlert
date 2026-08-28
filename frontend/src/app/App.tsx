import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { FilterCard } from '../components/dashboard/FilterCard';
import { Navbar } from '../components/dashboard/Navbar';
import { SummaryCard } from '../components/dashboard/SummaryCard';
import { IncidentMap, type InspectionLocation, type MapCoordinate } from '../components/map/IncidentMap';
import { DetailSheet } from '../components/reports/DetailSheet';
import { ExportDialog } from '../components/reports/ExportDialog';
import { ReportList } from '../components/reports/ReportList';
import { PasswordDialog } from '../components/settings/PasswordDialog';
import { SettingsDialog } from '../components/settings/SettingsDialog';
import { api, geocodePlace, getMe, getNotifications, getReport, getReports, getSettings, getStats, markAllRead, markRead } from '../lib/api';
import { brandingAssetUrl, updateFavicon } from '../lib/branding';
import { isMapStyleId, type MapStyleId } from '../lib/mapStyles';
import type { DetailResponse, ReportSummary, Settings, Stats, User } from '../types';

const emptyStats: Stats = { total: 0, today: 0, active: 0, critical: 0 };
const defaultSettings: Settings = { app_title: 'D DRONE', organization_name: 'ศูนย์ควบคุมและเฝ้าระวังอากาศยาน', app_logo_path: '', secondary_logo_path: '' };

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [stats, setStats] = useState(emptyStats);
  const [reports, setReports] = useState<ReportSummary[]>([]);
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
  const [liveCoordinate, setLiveCoordinate] = useState<MapCoordinate | null>(null);
  const [inspection, setInspection] = useState<InspectionLocation | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [fatal, setFatal] = useState('');
  const [mapStyle, setMapStyle] = useState<MapStyleId>(() => {
    const saved = localStorage.getItem('ddrone-map-style');
    return isMapStyleId(saved) ? saved : 'osm';
  });

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
      const [rows, nextStats, notifications] = await Promise.all([getReports(query), getStats(), getNotifications()]);
      setReports(rows);
      setStats(nextStats);
      setUnread(notifications.reports);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'โหลดข้อมูลไม่สำเร็จ');
    }
  }, [query, notify]);

  useEffect(() => {
    localStorage.setItem('ddrone-map-style', mapStyle);
  }, [mapStyle]);

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
        const [nextSettings, nextStats, rows, notifications] = await Promise.all([
          getSettings(),
          getStats(),
          getReports(new URLSearchParams('scope=active')),
          getNotifications(),
        ]);
        setSettings(nextSettings);
        setStats(nextStats);
        setReports(rows);
        setUnread(notifications.reports);
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
    const socket = io();
    socket.on('report:new', async () => {
      notify('มีรายงานเหตุใหม่');
      await refresh();
    });
    socket.on('report:updated', async (event) => {
      await refresh();
      if (selectedId === Number(event.id)) setDetail(await getReport(Number(event.id)));
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

  async function saveSettings(form: FormData) {
    const next = await api<Settings>('/api/admin/settings', { method: 'POST', body: form });
    setSettings(next);
    document.title = `${next.app_title || 'D DRONE'} · ศูนย์บัญชาการ`;
    updateFavicon(brandingAssetUrl(next.app_logo_path));
    notify('บันทึก Branding เรียบร้อย');
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

  return <main className="dashboard-app relative h-screen w-screen overflow-hidden bg-slate-200">
    <IncidentMap reports={reports} selectedId={selectedId} onSelect={selectReport} mapStyle={mapStyle} inspection={inspection} onInspect={inspectMapCoordinate} onCoordinateChange={setLiveCoordinate} onNotify={notify}/>
    <Navbar user={user} settings={settings} search={search} searchLoading={searchLoading} liveCoordinate={liveCoordinate} unread={unread} mapStyle={mapStyle} onSearch={setSearch} onSearchSubmit={submitSmartSearch} onRefresh={refresh} onSettings={() => setSettingsOpen(true)} onPassword={() => setPasswordOpen(true)} onLogout={logout} onExport={() => setExportOpen(true)} onMapStyle={setMapStyle} onNotification={selectReport} onReadAll={readAll}/>

    <div className="dashboard-left-stack pointer-events-none fixed bottom-3 left-3 top-[88px] z-[800] flex w-[350px] max-w-[calc(100vw-24px)] flex-col gap-2.5 sm:bottom-4 sm:left-4 sm:top-[92px] sm:max-w-[calc(100vw-32px)]">
      <div className="pointer-events-auto"><SummaryCard stats={stats}/></div>
      <div className="pointer-events-auto"><FilterCard severity={severity} status={status} date={date} month={month} rangeFrom={rangeFrom} rangeTo={rangeTo} historyMode={historyMode} onSeverity={setSeverity} onStatus={setStatus} onDate={changeDate} onMonth={changeMonth} onRange={changeRange} onMode={changeMode} onClear={clearFilters}/></div>
      <div className="pointer-events-auto flex min-h-0 flex-1"><ReportList reports={reports} selectedId={selectedId} loading={loading} historyMode={historyMode} onSelect={selectReport}/></div>
    </div>

    <DetailSheet open={selectedId !== null} data={detail} loading={detailLoading} role={user.role} onClose={() => { setSelectedId(null); setDetail(null); }} onSave={saveState} onNote={addNote} onComplete={complete}/>
    <SettingsDialog open={settingsOpen} settings={settings} onOpenChange={setSettingsOpen} onSave={saveSettings}/>
    <PasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} onSuccess={() => notify('เปลี่ยนรหัสผ่านเรียบร้อย')}/>
    <ExportDialog open={exportOpen} date={date} month={month} rangeFrom={rangeFrom} rangeTo={rangeTo} onOpenChange={setExportOpen} onError={notify}/>
    <AnimatePresence>{toast && <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="fixed bottom-5 right-5 z-[5000] rounded-xl bg-slate-900 px-4 py-3 text-xs text-white shadow-2xl">{toast}</motion.div>}</AnimatePresence>
  </main>;
}
