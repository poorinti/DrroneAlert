import type { DetailResponse, ReportSummary, Settings, Stats, User } from '../types';

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
export const geocodePlace = (query: string) => api<{ display_name: string; lat: number; lng: number }>(`/api/admin/geocode?q=${encodeURIComponent(query)}`);
