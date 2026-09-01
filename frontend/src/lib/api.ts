import type { DetailResponse, IncidentAnalysis, ReportSummary, Settings, Stats, User, WatchArea, WatchAreaPriority } from '../types';

export async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, options);
  if (response.status === 401) { window.location.href = '/login/'; throw new Error('กรุณาเข้าสู่ระบบ'); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
  return data as T;
}
export const getMe = () => fetch('/api/auth/me').then((r) => r.json()) as Promise<{ user: User | null }>;
export const getStats = () => api<Stats>('/api/admin/stats');
export const getSettings = () => api<Settings>('/api/admin/settings');
export const getReports = (query: URLSearchParams) => api<ReportSummary[]>(`/api/admin/reports?${query}`);
export const markRead = (id: number) => api<{ ok: boolean }>(`/api/admin/reports/${id}/read`, { method: 'POST' });
export const markAllRead = () => api<{ ok: boolean }>('/api/admin/reports/read-all', { method: 'POST' });
export const getNotifications = () => api<{ unread_count: number; reports: ReportSummary[] }>('/api/admin/notifications');
export const getReport = (id: number) => api<DetailResponse>(`/api/admin/reports/${id}`);
export const getIncidentAnalysis = (windowMinutes: 15 | 30 | 60) => api<IncidentAnalysis>(`/api/admin/incident-analysis?window=${windowMinutes}`);
export const saveCorrelationDecision = (reportAId: number, reportBId: number, decision: 'CONFIRMED' | 'DISMISSED') => api<{ ok: boolean }>('/api/admin/correlations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reportAId, reportBId, decision }) });
export const getWatchAreas = () => api<WatchArea[]>('/api/admin/watch-areas');
export const createWatchArea = (input: { name: string; priority: WatchAreaPriority; centerLat: number; centerLng: number; radiusM: number }) => api<WatchArea>('/api/admin/watch-areas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
export const updateWatchArea = (id: number, input: { name?: string; priority?: WatchAreaPriority; enabled?: boolean }) => api<{ ok: boolean }>(`/api/admin/watch-areas/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
export const geocodePlace = (query: string) => api<{ display_name: string; lat: number; lng: number }>(`/api/admin/geocode?q=${encodeURIComponent(query)}`);
