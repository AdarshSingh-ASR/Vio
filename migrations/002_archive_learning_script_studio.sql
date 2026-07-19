CREATE TABLE IF NOT EXISTS video_generations_archive (
  id VARCHAR(255) PRIMARY KEY,
  payload JSON NOT NULL,
  archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The migration runner performs a guarded copy and drop because fresh databases
-- do not contain the legacy video_generations table.

