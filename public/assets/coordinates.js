(function (root, factory) {
  const api = factory(
    root && root.mgrs
      ? root.mgrs
      : (typeof require === 'function' ? require('mgrs') : null)
  );
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DroneCoordinates = api;
})(typeof window !== 'undefined' ? window : globalThis, function (mgrsApi) {
  function finiteCoordinate(lat, lng) {
    const latitude = Number(lat);
    const longitude = Number(lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
    return { lat: latitude, lng: longitude };
  }

  function formatMgrs(raw) {
    const compact = String(raw || '').replace(/\s+/g, '').toUpperCase();
    const match = compact.match(/^(\d{1,2}[C-HJ-NP-X])([A-HJ-NP-Z]{2})(\d*)$/);
    if (!match) return compact || null;
    const digits = match[3];
    if (!digits || digits.length % 2 !== 0) return `${match[1]} ${match[2]}`;
    const half = digits.length / 2;
    return [match[1], match[2], digits.slice(0, half), digits.slice(half)].filter(Boolean).join(' ');
  }

  function toMgrs(lat, lng, precision) {
    const point = finiteCoordinate(lat, lng);
    if (!point || point.lat < -80 || point.lat > 84 || !mgrsApi || typeof mgrsApi.forward !== 'function') return null;
    const requestedPrecision = Number.isInteger(precision) ? Math.max(0, Math.min(5, precision)) : 5;
    try {
      return formatMgrs(mgrsApi.forward([point.lng, point.lat], requestedPrecision));
    } catch (_) {
      return null;
    }
  }

  function latLngText(lat, lng, digits) {
    const point = finiteCoordinate(lat, lng);
    if (!point) return '-';
    const decimals = Number.isInteger(digits) ? Math.max(0, Math.min(8, digits)) : 6;
    return `${point.lat.toFixed(decimals)}, ${point.lng.toFixed(decimals)}`;
  }

  function pairText(lat, lng, options) {
    const opts = options || {};
    const latLng = latLngText(lat, lng, opts.digits);
    if (latLng === '-') return '-';
    const military = toMgrs(lat, lng, opts.precision);
    return military ? `${latLng} · MGRS ${military}` : latLng;
  }

  return Object.freeze({ finiteCoordinate, formatMgrs, toMgrs, latLngText, pairText });
});
