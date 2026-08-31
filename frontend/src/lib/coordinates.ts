export interface CoordinateFormatter {
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
