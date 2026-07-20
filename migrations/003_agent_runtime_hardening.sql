-- Agno session and memory tables are managed by Vio migrations so the
-- production agent service never needs runtime DDL privileges.
CREATE TABLE IF NOT EXISTS agno_sessions (
  session_id VARCHAR(128) PRIMARY KEY,
  session_type VARCHAR(20) NOT NULL,
  agent_id VARCHAR(128),
  team_id VARCHAR(128),
  workflow_id VARCHAR(128),
  user_id VARCHAR(128),
  session_data JSON,
  agent_data JSON,
  team_data JSON,
  workflow_data JSON,
  metadata JSON,
  runs JSON,
  summary JSON,
  created_at BIGINT NOT NULL,
  updated_at BIGINT,
  INDEX idx_agno_sessions_type (session_type),
  INDEX idx_agno_sessions_created (created_at),
  INDEX idx_agno_sessions_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:split
CREATE TABLE IF NOT EXISTS agno_memories (
  memory_id VARCHAR(128) PRIMARY KEY,
  memory JSON NOT NULL,
  input TEXT,
  agent_id VARCHAR(128),
  team_id VARCHAR(128),
  user_id VARCHAR(128),
  topics JSON,
  feedback TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT,
  INDEX idx_agno_memories_user (user_id),
  INDEX idx_agno_memories_created (created_at),
  INDEX idx_agno_memories_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:split
ALTER TABLE approval_requests
  ADD COLUMN IF NOT EXISTS requirement_id VARCHAR(255) NULL AFTER tool_execution_id,
  ADD COLUMN IF NOT EXISTS decision_note TEXT NULL AFTER status;

-- migrate:split
ALTER TABLE agent_runs
  ADD COLUMN IF NOT EXISTS allow_built_in_fallback BOOLEAN DEFAULT FALSE AFTER model;

-- migrate:split
ALTER TABLE agent_runs
  ADD COLUMN IF NOT EXISTS context_item_ids JSON NULL AFTER allow_built_in_fallback;
