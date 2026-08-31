export interface CoordinateValidation { valid: boolean; normalized?: string | null; error?: string }
export interface ParsedMgrs { lat: number; lng: number; mgrs?: string | null }
export interface CoordinateFormatter {
  precisionOptions: ReadonlyArray<{ precision: number; label: string }>;
  finiteCoordinate(lat: number | string, lng: number | string): { lat: number; lng: number } | null;
  normalizeMgrs(value: string): string;
  formatMgrs(value: string): string | null;
  validateMgrs(value: string): CoordinateValidation;
  fromMgrs(value: string): ParsedMgrs | null;
  toMgrs(lat: number | string, lng: number | string, precision?: number): string | null;
  latLngText(lat: number | string, lng: number | string, digits?: number): string;
  pairText(lat: number | string, lng: number | string, options?: { digits?: number; precision?: number }): string;
}

declare global {
  interface Window {
    DroneCoordinates: CoordinateFormatter;
  }
}

export const coordinates = window.DroneCoordinates;