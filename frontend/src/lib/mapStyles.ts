export const mapStyles = [
  { id: 'osm', label: 'มาตรฐาน', detail: 'OpenStreetMap', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap contributors', maxNativeZoom: 19 },
  { id: 'carto-light', label: 'สว่าง', detail: 'Carto Light', url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', attribution: '&copy; OpenStreetMap &copy; CARTO', maxNativeZoom: 19 },
  { id: 'carto-voyager', label: 'Voyager', detail: 'Carto Voyager', url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', attribution: '&copy; OpenStreetMap &copy; CARTO', maxNativeZoom: 19 },
  { id: 'esri-street', label: 'ถนน', detail: 'Esri World Street', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', attribution: 'Tiles &copy; Esri', maxNativeZoom: 19 },
  { id: 'esri-imagery', label: 'ดาวเทียม', detail: 'Esri World Imagery', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: 'Tiles &copy; Esri', maxNativeZoom: 19 },
  { id: 'topo', label: 'ภูมิประเทศ', detail: 'OpenTopoMap', url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', attribution: 'Map data &copy; OpenStreetMap contributors, SRTM | Map style &copy; OpenTopoMap', maxNativeZoom: 17 },
] as const;

export type MapStyleId = typeof mapStyles[number]['id'];

export function isMapStyleId(value: string | null): value is MapStyleId {
  return Boolean(value && mapStyles.some((style) => style.id === value));
}
