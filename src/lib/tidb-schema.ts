import { executeQuery, TABLES } from './tidb';

// Database schema initialization
export const initializeTiDBSchema = async (): Promise<void> => {
  try {
    console.log('Initializing TiDB schema...');

    // Create database if it doesn't exist
    await executeQuery(`CREATE DATABASE IF NOT EXISTS ${process.env.TIDB_DATABASE || 'vio_database'}`);
    
    // Create tables
    await createUsersTable();
    await createWorkspacesTable();
    await createFoldersTable();
    await createDashboardItemsTable();
    await createItemFoldersTable();
    await createItemNotesTable();
    await createQuizResultsTable();
    await createChatMessagesTable();
    await createFileMetadataTable();
    await createLearningPathsTable();
    await createLearningStepsTable();
    await createStudySessionsTable();
    await createResearchQueriesTable();
    await createVideoGenerationsTable();
    
    // Create indexes for better performance
    await createIndexes();
    
    // Run migrations for existing tables
    await runMigrations();
    
    console.log('TiDB schema initialized successfully');
  } catch (error) {
    console.error('Error initializing TiDB schema:', error);
    throw error;
  }
};

const createUsersTable = async (): Promise<void> => {
  const query = `
    CREATE TABLE IF NOT EXISTS ${TABLES.USERS} (
      id VARCHAR(255) PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      first_name VARCHAR(255),
      last_name VARCHAR(255),
      username VARCHAR(255),
      image_url TEXT,
      appwrite_user_id VARCHAR(255) UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_email (email),
      INDEX idx_appwrite_user_id (appwrite_user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await executeQuery(query);
};

const createWorkspacesTable = async (): Promise<void> => {
  const query = `
    CREATE TABLE IF NOT EXISTS ${TABLES.WORKSPACES} (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      user_id VARCHAR(255) NOT NULL,
      is_default BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES ${TABLES.USERS}(id) ON DELETE CASCADE,
      INDEX idx_user_id (user_id),
      INDEX idx_is_default (is_default)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await executeQuery(query);
};

const createFoldersTable = async (): Promise<void> => {
  const query = `
    CREATE TABLE IF NOT EXISTS ${TABLES.FOLDERS} (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      workspace_id VARCHAR(255) NOT NULL,
      parent_folder_id VARCHAR(255),
      created_by VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (workspace_id) REFERENCES ${TABLES.WORKSPACES}(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_folder_id) REFERENCES ${TABLES.FOLDERS}(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES ${TABLES.USERS}(id) ON DELETE CASCADE,
      INDEX idx_workspace_id (workspace_id),
      INDEX idx_parent_folder_id (parent_folder_id),
      INDEX idx_created_by (created_by)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await executeQuery(query);
};

const createDashboardItemsTable = async (): Promise<void> => {
  const query = `
    CREATE TABLE IF NOT EXISTS ${TABLES.DASHBOARD_ITEMS} (
      id VARCHAR(255) PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      display_name VARCHAR(255) NOT NULL,
      description TEXT,
      content LONGTEXT,
      file_type VARCHAR(100),
      file_size BIGINT,
      file_url TEXT,
      appwrite_file_id VARCHAR(255),
      appwrite_bucket_id VARCHAR(255),
      workspace_id VARCHAR(255) NOT NULL,
      created_by VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (workspace_id) REFERENCES ${TABLES.WORKSPACES}(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES ${TABLES.USERS}(id) ON DELETE CASCADE,
      INDEX idx_workspace_id (workspace_id),
      INDEX idx_created_by (created_by),
      INDEX idx_file_type (file_type),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await executeQuery(query);
};

const createItemFoldersTable = async (): Promise<void> => {
  const query = `
    CREATE TABLE IF NOT EXISTS ${TABLES.ITEM_FOLDERS} (
      id VARCHAR(255) PRIMARY KEY,
      item_id VARCHAR(255) NOT NULL,
      folder_id VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (item_id) REFERENCES ${TABLES.DASHBOARD_ITEMS}(id) ON DELETE CASCADE,
      FOREIGN KEY (folder_id) REFERENCES ${TABLES.FOLDERS}(id) ON DELETE CASCADE,
      UNIQUE KEY unique_item_folder (item_id, folder_id),
      INDEX idx_item_id (item_id),
      INDEX idx_folder_id (folder_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await executeQuery(query);
};

const createItemNotesTable = async (): Promise<void> => {
  const query = `
    CREATE TABLE IF NOT EXISTS ${TABLES.ITEM_NOTES} (
      id VARCHAR(255) PRIMARY KEY,
      item_id VARCHAR(255) NOT NULL,
      content LONGTEXT NOT NULL,
      created_by VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (item_id) REFERENCES ${TABLES.DASHBOARD_ITEMS}(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES ${TABLES.USERS}(id) ON DELETE CASCADE,
      INDEX idx_item_id (item_id),
      INDEX idx_created_by (created_by)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await executeQuery(query);
};

const createQuizResultsTable = async (): Promise<void> => {
  const query = `
    CREATE TABLE IF NOT EXISTS ${TABLES.QUIZ_RESULTS} (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      item_id VARCHAR(255),
      item_name VARCHAR(500),
      quiz_type VARCHAR(100) NOT NULL,
      questions JSON,
      answers JSON,
      score DECIMAL(5,2),
      total_questions INT,
      time_spent INT DEFAULT 0,
      percentage DECIMAL(5,2),
      topic_analysis JSON,
      completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES ${TABLES.USERS}(id) ON DELETE CASCADE,
      INDEX idx_user_id (user_id),
      INDEX idx_quiz_type (quiz_type),
      INDEX idx_completed_at (completed_at),
      INDEX idx_item_id (item_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await executeQuery(query);
};

const createChatMessagesTable = async (): Promise<void> => {
  const query = `
    CREATE TABLE IF NOT EXISTS ${TABLES.CHAT_MESSAGES} (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      chat_id VARCHAR(255) NOT NULL,
      role ENUM('user', 'assistant') NOT NULL,
      content TEXT NOT NULL,
      metadata JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES ${TABLES.USERS}(id) ON DELETE CASCADE,
      INDEX idx_user_id (user_id),
      INDEX idx_chat_id (chat_id),
      INDEX idx_created_at (created_at),
      INDEX idx_role (role)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await executeQuery(query);
};

const createFileMetadataTable = async (): Promise<void> => {
  const query = `
    CREATE TABLE IF NOT EXISTS ${TABLES.FILE_METADATA} (
      id VARCHAR(255) PRIMARY KEY,
      file_name VARCHAR(255) NOT NULL,
      file_type VARCHAR(100),
      file_size BIGINT,
      appwrite_file_id VARCHAR(255) UNIQUE NOT NULL,
      appwrite_bucket_id VARCHAR(255) NOT NULL,
      file_url TEXT,
      upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      uploaded_by VARCHAR(255) NOT NULL,
      FOREIGN KEY (uploaded_by) REFERENCES ${TABLES.USERS}(id) ON DELETE CASCADE,
      INDEX idx_appwrite_file_id (appwrite_file_id),
      INDEX idx_uploaded_by (uploaded_by),
      INDEX idx_file_type (file_type),
      INDEX idx_upload_date (upload_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await executeQuery(query);
};

const createIndexes = async (): Promise<void> => {
  // Additional indexes for better query performance
  const indexes = [
    `CREATE INDEX IF NOT EXISTS idx_dashboard_items_title ON ${TABLES.DASHBOARD_ITEMS}(title)`,
    `CREATE INDEX IF NOT EXISTS idx_dashboard_items_file_type ON ${TABLES.DASHBOARD_ITEMS}(file_type)`,
    `CREATE INDEX IF NOT EXISTS idx_folders_name ON ${TABLES.FOLDERS}(name)`,
    `CREATE INDEX IF NOT EXISTS idx_workspaces_name ON ${TABLES.WORKSPACES}(name)`,
  ];

  for (const indexQuery of indexes) {
    try {
      await executeQuery(indexQuery);
    } catch (error) {
      console.warn('Index creation warning:', error);
    }
  }
};

const runMigrations = async (): Promise<void> => {
  try {
    console.log('Running database migrations...');
    
    // Migration 1: Add display_name column to dashboard_items table
    try {
      await executeQuery(`ALTER TABLE ${TABLES.DASHBOARD_ITEMS} ADD COLUMN display_name VARCHAR(255) AFTER title`);
      console.log('✅ Added display_name column to dashboard_items table');
      
      // Update existing records to set display_name = title
      await executeQuery(`UPDATE ${TABLES.DASHBOARD_ITEMS} SET display_name = title WHERE display_name IS NULL OR display_name = ''`);
      console.log('✅ Updated existing records with display_name = title');
      
      // Make display_name NOT NULL after updating existing records
      await executeQuery(`ALTER TABLE ${TABLES.DASHBOARD_ITEMS} MODIFY COLUMN display_name VARCHAR(255) NOT NULL`);
      console.log('✅ Made display_name column NOT NULL');
      
    } catch (error: any) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️ display_name column already exists, skipping migration');
      } else {
        console.warn('Migration warning for display_name column:', error.message);
      }
    }

    // Migration 2: Add preview_image_url column to dashboard_items table
    try {
      await executeQuery(`ALTER TABLE ${TABLES.DASHBOARD_ITEMS} ADD COLUMN preview_image_url TEXT AFTER content`);
      console.log('✅ Added preview_image_url column to dashboard_items table');
    } catch (error: any) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️ preview_image_url column already exists, skipping migration');
      } else {
        console.warn('Migration warning for preview_image_url column:', error.message);
      }
    }
    
    console.log('✅ Database migrations completed');
  } catch (error) {
    console.error('❌ Migration error:', error);
    // Don't throw error to prevent schema initialization failure
  }
};

// Learning Path Tables
const createLearningPathsTable = async (): Promise<void> => {
  const query = `
    CREATE TABLE IF NOT EXISTS ${TABLES.LEARNING_PATHS} (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      workspace_id VARCHAR(255) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      subject_area VARCHAR(100),
      difficulty_level ENUM('beginner', 'intermediate', 'advanced') DEFAULT 'beginner',
      estimated_duration INT DEFAULT 0,
      status ENUM('draft', 'active', 'completed', 'paused') DEFAULT 'draft',
      knowledge_gaps JSON,
      learning_objectives JSON,
      progress_percentage DECIMAL(5,2) DEFAULT 0.00,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES ${TABLES.USERS}(id) ON DELETE CASCADE,
      FOREIGN KEY (workspace_id) REFERENCES ${TABLES.WORKSPACES}(id) ON DELETE CASCADE,
      INDEX idx_user_id (user_id),
      INDEX idx_workspace_id (workspace_id),
      INDEX idx_status (status),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await executeQuery(query);
};

const createLearningStepsTable = async (): Promise<void> => {
  const query = `
    CREATE TABLE IF NOT EXISTS ${TABLES.LEARNING_STEPS} (
      id VARCHAR(255) PRIMARY KEY,
      learning_path_id VARCHAR(255) NOT NULL,
      step_order INT NOT NULL,
      step_type ENUM('reading', 'quiz', 'listening', 'review', 'practice') NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      content_references JSON,
      prerequisites JSON,
      learning_objectives JSON,
      estimated_duration INT DEFAULT 0,
      status ENUM('pending', 'in_progress', 'completed', 'skipped') DEFAULT 'pending',
      completion_criteria JSON,
      adaptive_difficulty BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (learning_path_id) REFERENCES ${TABLES.LEARNING_PATHS}(id) ON DELETE CASCADE,
      INDEX idx_learning_path_id (learning_path_id),
      INDEX idx_step_order (step_order),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await executeQuery(query);
};

const createStudySessionsTable = async (): Promise<void> => {
  const query = `
    CREATE TABLE IF NOT EXISTS ${TABLES.STUDY_SESSIONS} (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      learning_path_id VARCHAR(255),
      session_type ENUM('adaptive', 'review', 'practice', 'assessment') NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      content_selection JSON,
      difficulty_progression JSON,
      session_data JSON,
      performance_metrics JSON,
      adaptive_feedback JSON,
      start_time TIMESTAMP,
      end_time TIMESTAMP,
      duration_minutes INT DEFAULT 0,
      status ENUM('scheduled', 'active', 'completed', 'paused') DEFAULT 'scheduled',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES ${TABLES.USERS}(id) ON DELETE CASCADE,
      FOREIGN KEY (learning_path_id) REFERENCES ${TABLES.LEARNING_PATHS}(id) ON DELETE SET NULL,
      INDEX idx_user_id (user_id),
      INDEX idx_learning_path_id (learning_path_id),
      INDEX idx_status (status),
      INDEX idx_start_time (start_time)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await executeQuery(query);
};

const createResearchQueriesTable = async (): Promise<void> => {
  const query = `
    CREATE TABLE IF NOT EXISTS ${TABLES.RESEARCH_QUERIES} (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      workspace_id VARCHAR(255) NOT NULL,
      query_text TEXT NOT NULL,
      query_type ENUM('search', 'analysis', 'synthesis', 'exploration') NOT NULL,
      search_scope JSON,
      findings JSON,
      related_topics JSON,
      follow_up_questions JSON,
      source_documents JSON,
      confidence_score DECIMAL(3,2) DEFAULT 0.00,
      processing_status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES ${TABLES.USERS}(id) ON DELETE CASCADE,
      FOREIGN KEY (workspace_id) REFERENCES ${TABLES.WORKSPACES}(id) ON DELETE CASCADE,
      INDEX idx_user_id (user_id),
      INDEX idx_workspace_id (workspace_id),
      INDEX idx_query_type (query_type),
      INDEX idx_status (processing_status),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await executeQuery(query);
};

const createVideoGenerationsTable = async (): Promise<void> => {
  const query = `
    CREATE TABLE IF NOT EXISTS ${TABLES.VIDEO_GENERATIONS} (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      workspace_id VARCHAR(255) NOT NULL,
      topic VARCHAR(500) NOT NULL,
      selected_documents JSON,
      learning_level ENUM('beginner', 'intermediate', 'advanced') NOT NULL,
      video_style ENUM('explainer', 'tutorial', 'story', 'interactive') NOT NULL,
      duration_minutes INT NOT NULL,
      include_examples BOOLEAN DEFAULT TRUE,
      include_visuals BOOLEAN DEFAULT TRUE,
      include_quiz BOOLEAN DEFAULT FALSE,
      script JSON,
      status ENUM('generated', 'processing', 'completed', 'failed') DEFAULT 'generated',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES ${TABLES.USERS}(id) ON DELETE CASCADE,
      FOREIGN KEY (workspace_id) REFERENCES ${TABLES.WORKSPACES}(id) ON DELETE CASCADE,
      INDEX idx_user_id (user_id),
      INDEX idx_workspace_id (workspace_id),
      INDEX idx_topic (topic),
      INDEX idx_status (status),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await executeQuery(query);
};
