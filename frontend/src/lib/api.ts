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
export const getReport = (id: number) => api<DetailResponse>(`/api/admin/reports/${id}`);
