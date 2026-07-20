CREATE TABLE api_rate_limits (
  user_id VARCHAR(255) NOT NULL,
  route_key VARCHAR(120) NOT NULL,
  window_started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  request_count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, route_key),
  CONSTRAINT fk_api_rate_limit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
