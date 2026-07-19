CREATE TABLE IF NOT EXISTS account_deletion_jobs (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  appwrite_user_id VARCHAR(255) NOT NULL,
  status ENUM('requested', 'files_deleted', 'identity_deleted', 'completed', 'failed') NOT NULL DEFAULT 'requested',
  last_successful_stage ENUM('requested', 'files_deleted', 'identity_deleted') NOT NULL DEFAULT 'requested',
  error_code VARCHAR(100),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  INDEX idx_account_deletion_status (status, updated_at),
  INDEX idx_account_deletion_appwrite (appwrite_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
