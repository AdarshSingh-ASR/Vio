CREATE TABLE IF NOT EXISTS classroom_invite_attempts (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  code_hash CHAR(64) NOT NULL,
  succeeded BOOLEAN NOT NULL DEFAULT FALSE,
  attempted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_invite_attempt_limit (user_id, attempted_at),
  INDEX idx_invite_attempt_code (code_hash, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:split
ALTER TABLE classroom_invites
  ADD COLUMN IF NOT EXISTS revoked_by VARCHAR(255) NULL AFTER revoked_at;

-- migrate:split
ALTER TABLE classroom_invites
  ADD CONSTRAINT fk_invite_revoker FOREIGN KEY (revoked_by) REFERENCES users(id) ON DELETE SET NULL;
