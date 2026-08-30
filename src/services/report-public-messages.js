const pool = require('../config/database');

let publicMessagesTableReady;

function ensureReportPublicMessagesTable() {
  if (!publicMessagesTableReady) {
    publicMessagesTableReady = pool.query(`CREATE TABLE IF NOT EXISTS report_public_messages (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      report_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      message TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_public_messages_report_created (report_id, created_at),
      CONSTRAINT fk_public_messages_report FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
      CONSTRAINT fk_public_messages_user FOREIGN KEY (user_id) REFERENCES users(id)
    ) ENGINE=InnoDB`).catch((error) => {
      publicMessagesTableReady = null;
      throw error;
    });
  }
  return publicMessagesTableReady;
}

module.exports = { ensureReportPublicMessagesTable };
