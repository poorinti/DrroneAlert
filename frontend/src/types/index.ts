export type Role = 'SUPER_ADMIN' | 'OPERATOR' | 'VIEWER';
export interface User { id: number; username: string; email?: string; role: Role }
export type SurfaceMode = 'glass' | 'white' | 'custom';
export interface Settings { app_title: string; organization_name: string; app_logo_path: string; secondary_logo_path: string; navbar_surface_mode: SurfaceMode; navbar_surface_color: string; panel_surface_mode: SurfaceMode; panel_surface_color: string }
export interface Stats { total: number; today: number; active: number; critical: number }
export interface ReportSummary { id: number; report_no: string; source: string; object_type: string; reporter_severity: string; operator_severity?: string; effective_severity?: string; status: string; location_name?: string; incident_lat: string | number; incident_lng: string | number; description?: string; occurred_at: string; submitted_at: string; cover_image?: string; image_count: number; is_unread?: boolean | number }
export interface ReportDetail extends ReportSummary { direction?: string; speed_estimate?: string; altitude_estimate?: string; distance_estimate?: string; object_count?: number; appearance_notes?: string; reporter_type?: string; line_display_name?: string; reporter_name?: string; organization?: string; phone?: string }
export interface ReportImage { id: number; file_path: string }
export interface Note { id: number; note: string; created_at: string; username: string }
export interface History { id: number; action: string; old_value?: string; new_value?: string; created_at: string; username?: string }
export interface DetailResponse { report: ReportDetail; images: ReportImage[]; notes: Note[]; history: History[] }
