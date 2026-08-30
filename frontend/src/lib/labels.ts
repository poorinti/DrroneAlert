export const severityLabels: Record<string, string> = { LOW: 'ต่ำ', MEDIUM: 'ปานกลาง', HIGH: 'สูง', CRITICAL: 'วิกฤต' };
export const statusLabels: Record<string, string> = { NEW: 'ใหม่', ACKNOWLEDGED: 'รับทราบแล้ว', INVESTIGATING: 'กำลังตรวจสอบ', VERIFIED: 'ยืนยันแล้ว', FALSE_ALARM: 'ไม่ใช่เหตุจริง', RESOLVED: 'ดำเนินการแล้ว', CLOSED: 'ปิดเหตุ' };
export const objectLabels: Record<string, string> = { DRONE: 'โดรน', AIRCRAFT: 'อากาศยาน', UNKNOWN: 'ไม่สามารถระบุได้' };
export const sourceLabels: Record<string, string> = { LINE_LIFF: 'ไลน์', WEB: 'เว็บไซต์' };
export const reporterLabels: Record<string, string> = { ANONYMOUS: 'ไม่ระบุตัวตน', PUBLIC: 'ประชาชน', OFFICIAL: 'เจ้าหน้าที่' };
export const actionLabels: Record<string, string> = { REPORT_CREATED: 'สร้างรายงาน', STATUS_CHANGED: 'เปลี่ยนสถานะ', SEVERITY_CHANGED: 'เปลี่ยนระดับเหตุ', NOTE_ADDED: 'เพิ่มหมายเหตุ', PUBLIC_MESSAGE_ADDED: 'ส่งข้อความถึงผู้รายงาน' };
