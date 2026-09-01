const pool = require('../config/database');

let ready;

function ensureWatchAreasTable() {
  if (!ready) {
    ready = pool.query(`CREATE TABLE IF NOT EXISTS watch_areas (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      name VARCHAR(120) NOT NULL,
      priority ENUM('NORMAL','IMPORTANT','CRITICAL') NOT NULL DEFAULT 'NORMAL',
      center_lat DECIMAL(10,7) NOT NULL,
      center_lng DECIMAL(10,7) NOT NULL,
      radius_m INT UNSIGNED NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      created_by BIGINT UNSIGNED NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_watch_areas_enabled (enabled),
      CONSTRAINT fk_watch_areas_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB`).catch((error) => { ready = null; throw error; });
  }
  return ready;
}

function distanceMeters(lat1, lng1, lat2, lng2) {
  const toRad = (value) => value * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function getMatchingWatchAreas(lat, lng) {
  await ensureWatchAreasTable();
  const [rows] = await pool.query(`SELECT id, name, priority, center_lat, center_lng, radius_m
    FROM watch_areas WHERE enabled = TRUE ORDER BY FIELD(priority, 'CRITICAL','IMPORTANT','NORMAL'), id`);
  return rows.filter((area) => distanceMeters(Number(area.center_lat), Number(area.center_lng), Number(lat), Number(lng)) <= Number(area.radius_m));
}

module.exports = { ensureWatchAreasTable, getMatchingWatchAreas };
