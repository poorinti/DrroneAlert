export type Role = 'SUPER_ADMIN' | 'OPERATOR' | 'VIEWER';
export interface User { id: number; username: string; email?: string; role: Role }
export type SurfaceMode = 'glass' | 'white' | 'custom';
export interface Settings { app_title: string; organization_name: string; app_logo_path: string; secondary_logo_path: string; navbar_surface_mode: SurfaceMode; navbar_surface_color: string; panel_surface_mode: SurfaceMode; panel_surface_color: string; gemini_api_key_configured?: boolean; gemini_api_key_updated_at?: string | null; gemini_model?: string }
export interface Stats { total: number; today: number; active: number; critical: number }
export interface ReportSummary { id: number; report_no: string; source: string; object_type: string; reporter_severity: string; operator_severity?: string; effective_severity?: string; status: string; location_name?: string; incident_lat: string | number; incident_lng: string | number; description?: string; occurred_at: string; submitted_at: string; cover_image?: string; image_count: number; is_unread?: boolean | number }
export interface ReportDetail extends ReportSummary { direction?: string; speed_estimate?: string; altitude_estimate?: string; distance_estimate?: string; object_count?: number; appearance_notes?: string; reporter_type?: string; line_display_name?: string; reporter_name?: string; organization?: string; phone?: string }
export interface ReportImage { id: number; file_path: string }
export interface Note { id: number; note: string; created_at: string; username: string }
export interface PublicMessage { id: number; message: string; created_at: string; username: string }
export interface History { id: number; action: string; old_value?: string; new_value?: string; created_at: string; username?: string }
export interface DetailResponse { report: ReportDetail; images: ReportImage[]; notes: Note[]; publicMessages: PublicMessage[]; history: History[] }
export interface HotZone { id: string; lat: number; lng: number; radiusM: number; reportCount: number; criticalCount: number; reportIds: number[]; reportNos: string[]; latestAt: number }
export type CorrelationDecision = 'CONFIRMED' | 'DISMISSED' | null;
export interface CorrelationCandidate { id: string; reportA: ReportSummary; reportB: ReportSummary; score: number; timeMinutes: number; distanceM: number; reasons: string[]; decision: CorrelationDecision }
export interface IncidentAnalysis { windowMinutes: 15 | 30 | 60; hotZones: HotZone[]; correlations: CorrelationCandidate[] }
export type WatchAreaPriority = 'NORMAL' | 'IMPORTANT' | 'CRITICAL';
export interface WatchArea { id: number; name: string; priority: WatchAreaPriority; center_lat: string | number; center_lng: string | number; radius_m: number; enabled: boolean | number; created_at?: string; updated_at?: string }
export interface WatchAreaAlert { reportId: number; reportNo: string; areaId: number; areaName: string; priority: WatchAreaPriority }
