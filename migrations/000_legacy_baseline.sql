CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(255) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  first_name VARCHAR(255), last_name VARCHAR(255), username VARCHAR(255), image_url TEXT,
  appwrite_user_id VARCHAR(255) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_email (email), INDEX idx_users_appwrite (appwrite_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:split
CREATE TABLE IF NOT EXISTS workspaces (
  id VARCHAR(255) PRIMARY KEY, name VARCHAR(255) NOT NULL, description TEXT,
  user_id VARCHAR(255) NOT NULL, is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_workspaces_user (user_id), INDEX idx_workspaces_default (is_default), INDEX idx_workspaces_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:split
CREATE TABLE IF NOT EXISTS folders (
  id VARCHAR(255) PRIMARY KEY, name VARCHAR(255) NOT NULL, description TEXT,
  workspace_id VARCHAR(255) NOT NULL, parent_folder_id VARCHAR(255), created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_folder_id) REFERENCES folders(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_folders_workspace (workspace_id), INDEX idx_folders_parent (parent_folder_id),
  INDEX idx_folders_creator (created_by), INDEX idx_folders_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:split
CREATE TABLE IF NOT EXISTS dashboard_items (
  id VARCHAR(255) PRIMARY KEY, title VARCHAR(255) NOT NULL, display_name VARCHAR(255) NOT NULL,
  description TEXT, content LONGTEXT, file_type VARCHAR(100), file_size BIGINT, file_url TEXT,
  appwrite_file_id VARCHAR(255), appwrite_bucket_id VARCHAR(255), workspace_id VARCHAR(255) NOT NULL,
  created_by VARCHAR(255) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_items_workspace (workspace_id), INDEX idx_items_creator (created_by),
  INDEX idx_items_file_type (file_type), INDEX idx_items_created (created_at), INDEX idx_items_title (title)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:split
CREATE TABLE IF NOT EXISTS item_folders (
  id VARCHAR(255) PRIMARY KEY, item_id VARCHAR(255) NOT NULL, folder_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES dashboard_items(id) ON DELETE CASCADE,
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
  UNIQUE KEY uq_item_folder (item_id, folder_id), INDEX idx_item_folders_item (item_id), INDEX idx_item_folders_folder (folder_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:split
CREATE TABLE IF NOT EXISTS item_notes (
  id VARCHAR(255) PRIMARY KEY, item_id VARCHAR(255) NOT NULL, content LONGTEXT NOT NULL,
  created_by VARCHAR(255) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES dashboard_items(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_item_notes_item (item_id), INDEX idx_item_notes_creator (created_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:split
CREATE TABLE IF NOT EXISTS quiz_results (
  id VARCHAR(255) PRIMARY KEY, user_id VARCHAR(255) NOT NULL, quiz_type VARCHAR(100) NOT NULL,
  questions JSON, answers JSON, score DECIMAL(5,2), total_questions INT,
  completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_quiz_user (user_id), INDEX idx_quiz_type (quiz_type), INDEX idx_quiz_completed (completed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:split
CREATE TABLE IF NOT EXISTS file_metadata (
  id VARCHAR(255) PRIMARY KEY, file_name VARCHAR(255) NOT NULL, file_type VARCHAR(100), file_size BIGINT,
  appwrite_file_id VARCHAR(255) UNIQUE NOT NULL, appwrite_bucket_id VARCHAR(255) NOT NULL,
  file_url TEXT, upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP, uploaded_by VARCHAR(255) NOT NULL,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_files_appwrite (appwrite_file_id), INDEX idx_files_uploader (uploaded_by),
  INDEX idx_files_type (file_type), INDEX idx_files_date (upload_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:split
CREATE TABLE IF NOT EXISTS chat_messages (
  id VARCHAR(255) PRIMARY KEY, chat_id VARCHAR(255) NOT NULL, user_id VARCHAR(255) NOT NULL,
  role ENUM('user','assistant') NOT NULL, content LONGTEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_chat_id (chat_id), INDEX idx_chat_user (user_id), INDEX idx_chat_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:split
CREATE TABLE IF NOT EXISTS learning_paths (
  id VARCHAR(255) PRIMARY KEY, user_id VARCHAR(255) NOT NULL, workspace_id VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL, description TEXT, subject_area VARCHAR(255), difficulty_level VARCHAR(50),
  estimated_duration INT, status VARCHAR(50) DEFAULT 'draft', knowledge_gaps JSON,
  learning_objectives JSON, progress_percentage DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  INDEX idx_paths_user (user_id), INDEX idx_paths_workspace (workspace_id), INDEX idx_paths_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:split
CREATE TABLE IF NOT EXISTS learning_steps (
  id VARCHAR(255) PRIMARY KEY, learning_path_id VARCHAR(255) NOT NULL, step_order INT NOT NULL,
  step_type VARCHAR(50) NOT NULL, title VARCHAR(255) NOT NULL, description TEXT,
  content_references JSON, prerequisites JSON, learning_objectives JSON, estimated_duration INT,
  completion_criteria JSON, adaptive_difficulty BOOLEAN DEFAULT FALSE, is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (learning_path_id) REFERENCES learning_paths(id) ON DELETE CASCADE,
  INDEX idx_steps_path (learning_path_id), INDEX idx_steps_order (step_order), INDEX idx_steps_type (step_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:split
CREATE TABLE IF NOT EXISTS study_sessions (
  id VARCHAR(255) PRIMARY KEY, user_id VARCHAR(255) NOT NULL, learning_path_id VARCHAR(255),
  session_type VARCHAR(50) NOT NULL, title VARCHAR(255) NOT NULL, description TEXT,
  content_selection JSON, difficulty_progression JSON, session_data JSON, performance_metrics JSON,
  adaptive_feedback JSON, start_time TIMESTAMP NULL, end_time TIMESTAMP NULL, duration_minutes INT,
  questions_count INT DEFAULT 0, status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (learning_path_id) REFERENCES learning_paths(id) ON DELETE SET NULL,
  INDEX idx_sessions_user (user_id), INDEX idx_sessions_path (learning_path_id), INDEX idx_sessions_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:split
CREATE TABLE IF NOT EXISTS research_queries (
  id VARCHAR(255) PRIMARY KEY, user_id VARCHAR(255) NOT NULL, workspace_id VARCHAR(255) NOT NULL,
  query_text TEXT NOT NULL, query_type VARCHAR(50), search_scope VARCHAR(50), document_ids JSON,
  search_results JSON, summary TEXT, follow_up_questions JSON, related_topics JSON,
  confidence_score DECIMAL(3,2), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  INDEX idx_research_user (user_id), INDEX idx_research_workspace (workspace_id), INDEX idx_research_type (query_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
