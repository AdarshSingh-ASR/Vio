CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(100) PRIMARY KEY,
  checksum VARCHAR(64) NOT NULL,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:split
CREATE TABLE IF NOT EXISTS ai_credentials (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  provider ENUM('openai', 'codex') NOT NULL,
  encrypted_value LONGTEXT NOT NULL,
  key_version VARCHAR(255),
  last_four VARCHAR(4) NOT NULL,
  status ENUM('active', 'invalid', 'revoked') DEFAULT 'active',
  validated_at TIMESTAMP NULL,
  revoked_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ai_credential_user_provider (user_id, provider),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:split
CREATE TABLE IF NOT EXISTS user_ai_preferences (
  user_id VARCHAR(255) PRIMARY KEY,
  default_provider ENUM('built_in', 'openai_byok') DEFAULT 'built_in',
  agent_engine ENUM('vio', 'codex') DEFAULT 'vio',
  allow_built_in_fallback BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:split
CREATE TABLE IF NOT EXISTS conversations (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  title VARCHAR(255),
  engine ENUM('vio', 'codex') DEFAULT 'vio',
  external_thread_id VARCHAR(255),
  scope_type ENUM('personal', 'workspace', 'classroom') DEFAULT 'personal',
  scope_id VARCHAR(255),
  status ENUM('active', 'archived') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_conversation_owner (user_id, updated_at),
  INDEX idx_conversation_scope (scope_type, scope_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:split
CREATE TABLE IF NOT EXISTS conversation_messages (
  id VARCHAR(36) PRIMARY KEY,
  conversation_id VARCHAR(36) NOT NULL,
  role ENUM('system', 'user', 'assistant', 'tool') NOT NULL,
  content LONGTEXT NOT NULL,
  parts JSON,
  provider VARCHAR(50),
  model VARCHAR(100),
  status ENUM('streaming', 'completed', 'failed') DEFAULT 'completed',
  token_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  INDEX idx_message_conversation (conversation_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:split
CREATE TABLE IF NOT EXISTS conversation_summaries (
  conversation_id VARCHAR(36) PRIMARY KEY,
  summary LONGTEXT NOT NULL,
  through_message_id VARCHAR(36),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:split
CREATE TABLE IF NOT EXISTS user_memories (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  scope_type ENUM('user', 'workspace', 'classroom', 'conversation') DEFAULT 'user',
  scope_id VARCHAR(255),
  content TEXT NOT NULL,
  source_message_id VARCHAR(36),
  confidence DECIMAL(4,3) DEFAULT 0.750,
  expires_at TIMESTAMP NULL,
  superseded_by VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_memory_retrieval (user_id, scope_type, scope_id, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:split
CREATE TABLE IF NOT EXISTS agent_runs (
  id VARCHAR(36) PRIMARY KEY,
  conversation_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  status ENUM('running', 'awaiting_approval', 'completed', 'failed', 'cancelled') DEFAULT 'running',
  provider VARCHAR(50),
  model VARCHAR(100),
  error_code VARCHAR(100),
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_agent_runs_conversation (conversation_id, started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:split
CREATE TABLE IF NOT EXISTS agent_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  run_id VARCHAR(36) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  payload JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (run_id) REFERENCES agent_runs(id) ON DELETE CASCADE,
  INDEX idx_agent_events_run (run_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:split
CREATE TABLE IF NOT EXISTS tool_executions (
  id VARCHAR(36) PRIMARY KEY,
  run_id VARCHAR(36) NOT NULL,
  tool_id VARCHAR(100) NOT NULL,
  risk_level ENUM('read', 'write', 'sensitive') NOT NULL,
  arguments_json JSON NOT NULL,
  result_json JSON,
  status ENUM('pending', 'approved', 'running', 'completed', 'failed', 'denied') DEFAULT 'pending',
  error_code VARCHAR(100),
  started_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  FOREIGN KEY (run_id) REFERENCES agent_runs(id) ON DELETE CASCADE,
  INDEX idx_tool_execution_run (run_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:split
CREATE TABLE IF NOT EXISTS approval_requests (
  id VARCHAR(36) PRIMARY KEY,
  run_id VARCHAR(36) NOT NULL,
  tool_execution_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  prompt TEXT NOT NULL,
  status ENUM('pending', 'approved', 'denied', 'expired') DEFAULT 'pending',
  decided_at TIMESTAMP NULL,
  expires_at TIMESTAMP NULL,
  FOREIGN KEY (run_id) REFERENCES agent_runs(id) ON DELETE CASCADE,
  FOREIGN KEY (tool_execution_id) REFERENCES tool_executions(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_approval_user (user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:split
CREATE TABLE IF NOT EXISTS knowledge_documents (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  scope_type ENUM('user', 'workspace', 'classroom', 'assignment', 'submission') NOT NULL,
  scope_id VARCHAR(255) NOT NULL,
  source_item_id VARCHAR(255),
  file_name VARCHAR(500),
  mime_type VARCHAR(150),
  status ENUM('pending', 'processing', 'ready', 'failed') DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_knowledge_scope (scope_type, scope_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:split
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id VARCHAR(36) PRIMARY KEY,
  document_id VARCHAR(36) NOT NULL,
  chunk_index INT NOT NULL,
  content LONGTEXT NOT NULL,
  locator JSON,
  embedding JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (document_id) REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  UNIQUE KEY uq_knowledge_chunk (document_id, chunk_index),
  FULLTEXT KEY ft_knowledge_content (content)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:split
CREATE TABLE IF NOT EXISTS classrooms (
  id VARCHAR(36) PRIMARY KEY,
  owner_user_id VARCHAR(255) NOT NULL,
  workspace_id VARCHAR(255),
  name VARCHAR(255) NOT NULL,
  subject VARCHAR(255),
  description TEXT,
  status ENUM('active', 'archived') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL,
  INDEX idx_classroom_owner (owner_user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:split
CREATE TABLE IF NOT EXISTS classroom_members (
  id VARCHAR(36) PRIMARY KEY,
  classroom_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  role ENUM('teacher', 'student') NOT NULL,
  status ENUM('active', 'removed') DEFAULT 'active',
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_classroom_member (classroom_id, user_id),
  INDEX idx_classroom_member_user (user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:split
CREATE TABLE IF NOT EXISTS classroom_invites (
  id VARCHAR(36) PRIMARY KEY,
  classroom_id VARCHAR(36) NOT NULL,
  code_hash CHAR(64) NOT NULL,
  code_hint VARCHAR(8) NOT NULL,
  created_by VARCHAR(255) NOT NULL,
  max_uses INT DEFAULT 50,
  use_count INT DEFAULT 0,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_invite_hash (code_hash),
  INDEX idx_invite_classroom (classroom_id, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:split
CREATE TABLE IF NOT EXISTS homework_assignments (
  id VARCHAR(36) PRIMARY KEY,
  classroom_id VARCHAR(36) NOT NULL,
  creator_user_id VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  lesson_number VARCHAR(50),
  chapter_number VARCHAR(50),
  chapter_name VARCHAR(255),
  instructions LONGTEXT NOT NULL,
  rubric_json JSON,
  due_at TIMESTAMP NOT NULL,
  max_marks DECIMAL(8,2) DEFAULT 100,
  allow_late BOOLEAN DEFAULT FALSE,
  allow_resubmission BOOLEAN DEFAULT TRUE,
  status ENUM('draft', 'published', 'closed') DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE,
  FOREIGN KEY (creator_user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_assignment_classroom (classroom_id, status, due_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:split
CREATE TABLE IF NOT EXISTS assignment_attachments (
  id VARCHAR(36) PRIMARY KEY,
  assignment_id VARCHAR(36) NOT NULL,
  appwrite_file_id VARCHAR(255) NOT NULL,
  bucket_id VARCHAR(255) NOT NULL,
  file_name VARCHAR(500) NOT NULL,
  mime_type VARCHAR(150),
  size_bytes BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (assignment_id) REFERENCES homework_assignments(id) ON DELETE CASCADE,
  INDEX idx_assignment_attachment (assignment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:split
CREATE TABLE IF NOT EXISTS homework_submissions (
  id VARCHAR(36) PRIMARY KEY,
  assignment_id VARCHAR(36) NOT NULL,
  student_user_id VARCHAR(255) NOT NULL,
  current_version INT DEFAULT 0,
  status ENUM('draft', 'submitted', 'evaluating', 'evaluated', 'checked', 'published', 'failed') DEFAULT 'draft',
  submitted_at TIMESTAMP NULL,
  is_late BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (assignment_id) REFERENCES homework_assignments(id) ON DELETE CASCADE,
  FOREIGN KEY (student_user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_assignment_student (assignment_id, student_user_id),
  INDEX idx_submission_assignment (assignment_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:split
CREATE TABLE IF NOT EXISTS submission_versions (
  id VARCHAR(36) PRIMARY KEY,
  submission_id VARCHAR(36) NOT NULL,
  version_number INT NOT NULL,
  text_content LONGTEXT,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (submission_id) REFERENCES homework_submissions(id) ON DELETE CASCADE,
  UNIQUE KEY uq_submission_version (submission_id, version_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:split
CREATE TABLE IF NOT EXISTS submission_attachments (
  id VARCHAR(36) PRIMARY KEY,
  submission_version_id VARCHAR(36) NOT NULL,
  appwrite_file_id VARCHAR(255) NOT NULL,
  bucket_id VARCHAR(255) NOT NULL,
  file_name VARCHAR(500) NOT NULL,
  mime_type VARCHAR(150),
  size_bytes BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (submission_version_id) REFERENCES submission_versions(id) ON DELETE CASCADE,
  INDEX idx_submission_attachment (submission_version_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:split
CREATE TABLE IF NOT EXISTS ai_evaluations (
  id VARCHAR(36) PRIMARY KEY,
  submission_version_id VARCHAR(36) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  model VARCHAR(100) NOT NULL,
  rubric_version VARCHAR(50) DEFAULT '1',
  initial_score DECIMAL(8,2),
  feedback LONGTEXT,
  strengths JSON,
  weaknesses JSON,
  improvements JSON,
  citations JSON,
  confidence DECIMAL(4,3),
  status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
  error_code VARCHAR(100),
  trace_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (submission_version_id) REFERENCES submission_versions(id) ON DELETE CASCADE,
  INDEX idx_evaluation_version (submission_version_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:split
CREATE TABLE IF NOT EXISTS teacher_reviews (
  id VARCHAR(36) PRIMARY KEY,
  submission_id VARCHAR(36) NOT NULL,
  submission_version_id VARCHAR(36) NOT NULL,
  teacher_user_id VARCHAR(255) NOT NULL,
  ai_evaluation_id VARCHAR(36),
  marks DECIMAL(8,2) NOT NULL,
  remarks LONGTEXT,
  improvements LONGTEXT,
  override_reason TEXT,
  status ENUM('draft', 'published') DEFAULT 'draft',
  checked_at TIMESTAMP NULL,
  published_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (submission_id) REFERENCES homework_submissions(id) ON DELETE CASCADE,
  FOREIGN KEY (submission_version_id) REFERENCES submission_versions(id) ON DELETE CASCADE,
  FOREIGN KEY (teacher_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (ai_evaluation_id) REFERENCES ai_evaluations(id) ON DELETE SET NULL,
  UNIQUE KEY uq_teacher_review (submission_id),
  INDEX idx_review_teacher (teacher_user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:split
CREATE TABLE IF NOT EXISTS ai_usage_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  model VARCHAR(100) NOT NULL,
  feature VARCHAR(100) NOT NULL,
  input_tokens INT DEFAULT 0,
  output_tokens INT DEFAULT 0,
  latency_ms INT DEFAULT 0,
  success BOOLEAN DEFAULT TRUE,
  fallback_from VARCHAR(50),
  error_code VARCHAR(100),
  trace_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_ai_usage_user (user_id, created_at),
  INDEX idx_ai_usage_trace (trace_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:split
CREATE TABLE IF NOT EXISTS audit_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  actor_user_id VARCHAR(255),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100) NOT NULL,
  resource_id VARCHAR(255) NOT NULL,
  metadata JSON,
  ip_hash CHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_audit_resource (resource_type, resource_id, created_at),
  INDEX idx_audit_actor (actor_user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
