#!/usr/bin/env node

/**
 * TiDB Setup Script for Vio Application
 * 
 * This script helps you set up TiDB database for your Vio application.
 * Make sure you have your TiDB credentials configured in your .env file.
 */

const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

// TiDB configuration
const getTiDBConfig = () => {
  return {
    host: process.env.TIDB_HOST || 'localhost',
    port: parseInt(process.env.TIDB_PORT || '4000'),
    user: process.env.TIDB_USER || 'root',
    password: process.env.TIDB_PASSWORD || '',
    database: process.env.TIDB_DATABASE || 'vio_database',
    ssl: process.env.TIDB_SSL === 'true' ? {} : undefined
  };
};

// Database schema
const TABLES = {
  USERS: 'users',
  WORKSPACES: 'workspaces',
  FOLDERS: 'folders',
  DASHBOARD_ITEMS: 'dashboard_items',
  ITEM_FOLDERS: 'item_folders',
  ITEM_NOTES: 'item_notes',
  QUIZ_RESULTS: 'quiz_results',
  FILE_METADATA: 'file_metadata',
  CHAT_MESSAGES: 'chat_messages',
  LEARNING_PATHS: 'learning_paths',
  LEARNING_STEPS: 'learning_steps',
  STUDY_SESSIONS: 'study_sessions',
  RESEARCH_QUERIES: 'research_queries',
  VIDEO_GENERATIONS: 'video_generations',
};

const createUsersTable = async (connection) => {
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
  await connection.execute(query);
};

const createWorkspacesTable = async (connection) => {
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
  await connection.execute(query);
};

const createFoldersTable = async (connection) => {
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
  await connection.execute(query);
};

const createDashboardItemsTable = async (connection) => {
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
  await connection.execute(query);
};

const createItemFoldersTable = async (connection) => {
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
  await connection.execute(query);
};

const createItemNotesTable = async (connection) => {
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
  await connection.execute(query);
};

const createQuizResultsTable = async (connection) => {
  const query = `
    CREATE TABLE IF NOT EXISTS ${TABLES.QUIZ_RESULTS} (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      quiz_type VARCHAR(100) NOT NULL,
      questions JSON,
      answers JSON,
      score DECIMAL(5,2),
      total_questions INT,
      completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES ${TABLES.USERS}(id) ON DELETE CASCADE,
      INDEX idx_user_id (user_id),
      INDEX idx_quiz_type (quiz_type),
      INDEX idx_completed_at (completed_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await connection.execute(query);
};

const createFileMetadataTable = async (connection) => {
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
  await connection.execute(query);
};

const createChatMessagesTable = async (connection) => {
  const query = `
    CREATE TABLE IF NOT EXISTS ${TABLES.CHAT_MESSAGES} (
      id VARCHAR(255) PRIMARY KEY,
      chat_id VARCHAR(255) NOT NULL,
      user_id VARCHAR(255) NOT NULL,
      role ENUM('user', 'assistant') NOT NULL,
      content LONGTEXT NOT NULL,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES ${TABLES.USERS}(id) ON DELETE CASCADE,
      INDEX idx_chat_id (chat_id),
      INDEX idx_user_id (user_id),
      INDEX idx_timestamp (timestamp)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await connection.execute(query);
};

const createLearningPathsTable = async (connection) => {
  const query = `
    CREATE TABLE IF NOT EXISTS ${TABLES.LEARNING_PATHS} (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      workspace_id VARCHAR(255) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      subject_area VARCHAR(255),
      difficulty_level VARCHAR(50),
      estimated_duration INT,
      status VARCHAR(50) DEFAULT 'draft',
      knowledge_gaps JSON,
      learning_objectives JSON,
      progress_percentage DECIMAL(5,2) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES ${TABLES.USERS}(id) ON DELETE CASCADE,
      FOREIGN KEY (workspace_id) REFERENCES ${TABLES.WORKSPACES}(id) ON DELETE CASCADE,
      INDEX idx_user_id (user_id),
      INDEX idx_workspace_id (workspace_id),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await connection.execute(query);
};

const createLearningStepsTable = async (connection) => {
  const query = `
    CREATE TABLE IF NOT EXISTS ${TABLES.LEARNING_STEPS} (
      id VARCHAR(255) PRIMARY KEY,
      learning_path_id VARCHAR(255) NOT NULL,
      step_order INT NOT NULL,
      step_type VARCHAR(50) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      content_references JSON,
      prerequisites JSON,
      learning_objectives JSON,
      estimated_duration INT,
      completion_criteria JSON,
      adaptive_difficulty BOOLEAN DEFAULT FALSE,
      is_completed BOOLEAN DEFAULT FALSE,
      completed_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (learning_path_id) REFERENCES ${TABLES.LEARNING_PATHS}(id) ON DELETE CASCADE,
      INDEX idx_learning_path_id (learning_path_id),
      INDEX idx_step_order (step_order),
      INDEX idx_step_type (step_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await connection.execute(query);
};

const createStudySessionsTable = async (connection) => {
  const query = `
    CREATE TABLE IF NOT EXISTS ${TABLES.STUDY_SESSIONS} (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      learning_path_id VARCHAR(255),
      session_type VARCHAR(50) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      content_selection JSON,
      difficulty_progression JSON,
      session_data JSON,
      performance_metrics JSON,
      adaptive_feedback JSON,
      start_time TIMESTAMP,
      end_time TIMESTAMP,
      duration_minutes INT,
      questions_count INT DEFAULT 0,
      status VARCHAR(50) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES ${TABLES.USERS}(id) ON DELETE CASCADE,
      FOREIGN KEY (learning_path_id) REFERENCES ${TABLES.LEARNING_PATHS}(id) ON DELETE SET NULL,
      INDEX idx_user_id (user_id),
      INDEX idx_learning_path_id (learning_path_id),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await connection.execute(query);
};

const createResearchQueriesTable = async (connection) => {
  const query = `
    CREATE TABLE IF NOT EXISTS ${TABLES.RESEARCH_QUERIES} (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      workspace_id VARCHAR(255) NOT NULL,
      query_text TEXT NOT NULL,
      query_type VARCHAR(50),
      search_scope VARCHAR(50),
      document_ids JSON,
      search_results JSON,
      summary TEXT,
      follow_up_questions JSON,
      related_topics JSON,
      confidence_score DECIMAL(3,2),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES ${TABLES.USERS}(id) ON DELETE CASCADE,
      FOREIGN KEY (workspace_id) REFERENCES ${TABLES.WORKSPACES}(id) ON DELETE CASCADE,
      INDEX idx_user_id (user_id),
      INDEX idx_workspace_id (workspace_id),
      INDEX idx_query_type (query_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await connection.execute(query);
};

const createVideoGenerationsTable = async (connection) => {
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
  await connection.execute(query);
};

const createIndexes = async (connection) => {
  const indexes = [
    `CREATE INDEX IF NOT EXISTS idx_dashboard_items_title ON ${TABLES.DASHBOARD_ITEMS}(title)`,
    `CREATE INDEX IF NOT EXISTS idx_dashboard_items_file_type ON ${TABLES.DASHBOARD_ITEMS}(file_type)`,
    `CREATE INDEX IF NOT EXISTS idx_folders_name ON ${TABLES.FOLDERS}(name)`,
    `CREATE INDEX IF NOT EXISTS idx_workspaces_name ON ${TABLES.WORKSPACES}(name)`,
  ];

  for (const indexQuery of indexes) {
    try {
      await connection.execute(indexQuery);
    } catch (error) {
      console.warn('Index creation warning:', error.message);
    }
  }
};

async function setupTiDB() {
  let connection;
  
  try {
    console.log('🚀 Starting TiDB setup...');
    
    const config = getTiDBConfig();
    
    // Show current configuration (without password)
    console.log('📋 Current TiDB Configuration:');
    console.log(`   Host: ${config.host}`);
    console.log(`   Port: ${config.port}`);
    console.log(`   User: ${config.user}`);
    console.log(`   Database: ${config.database}`);
    console.log(`   SSL: ${config.ssl ? 'enabled' : 'disabled'}`);
    
    // Validate configuration
    if (!config.host || config.host === 'localhost' || config.host.includes('your-')) {
      console.error('❌ Missing or invalid TIDB_HOST configuration!');
      console.log('\n💡 Please update your .env.local file with:');
      console.log('   TIDB_HOST=your-cluster-endpoint.tidbcloud.com');
      console.log('\n📖 For detailed setup instructions, see SETUP.md');
      process.exit(1);
    }
    
    if (!config.user || config.user.includes('your-')) {
      console.error('❌ Missing or invalid TIDB_USER configuration!');
      console.log('\n💡 Please update your .env.local file with:');
      console.log('   TIDB_USER=your-actual-username');
      console.log('\n📖 For detailed setup instructions, see SETUP.md');
      process.exit(1);
    }
    
    if (!config.password || config.password.includes('your-')) {
      console.error('❌ Missing or invalid TIDB_PASSWORD configuration!');
      console.log('\n💡 Please update your .env.local file with:');
      console.log('   TIDB_PASSWORD=your-actual-password');
      console.log('\n📖 For detailed setup instructions, see SETUP.md');
      process.exit(1);
    }
    
    console.log('📡 Connecting to TiDB...');
    connection = await mysql.createConnection(config);
    
    // Create database if it doesn't exist
    console.log('🗄️ Creating database...');
    await connection.execute(`CREATE DATABASE IF NOT EXISTS ${config.database}`);
    await connection.execute(`USE ${config.database}`);
    
    // Create tables
    console.log('📋 Creating tables...');
    await createUsersTable(connection);
    console.log('✅ Users table created');
    
    await createWorkspacesTable(connection);
    console.log('✅ Workspaces table created');
    
    await createFoldersTable(connection);
    console.log('✅ Folders table created');
    
    await createDashboardItemsTable(connection);
    console.log('✅ Dashboard items table created');
    
    await createItemFoldersTable(connection);
    console.log('✅ Item folders table created');
    
    await createItemNotesTable(connection);
    console.log('✅ Item notes table created');
    
    await createQuizResultsTable(connection);
    console.log('✅ Quiz results table created');
    
    await createFileMetadataTable(connection);
    console.log('✅ File metadata table created');
    
    await createChatMessagesTable(connection);
    console.log('✅ Chat messages table created');
    
    await createLearningPathsTable(connection);
    console.log('✅ Learning paths table created');
    
    await createLearningStepsTable(connection);
    console.log('✅ Learning steps table created');
    
    await createStudySessionsTable(connection);
    console.log('✅ Study sessions table created');
    
    await createResearchQueriesTable(connection);
    console.log('✅ Research queries table created');
    
    await createVideoGenerationsTable(connection);
    console.log('✅ Video generations table created');
    
    // Create indexes
    console.log('🔍 Creating indexes...');
    await createIndexes(connection);
    
    console.log('\n🎉 TiDB setup completed successfully!');
    console.log('📊 Database tables created:');
    console.log('   - users');
    console.log('   - workspaces');
    console.log('   - folders');
    console.log('   - dashboard_items');
    console.log('   - item_folders');
    console.log('   - item_notes');
    console.log('   - quiz_results');
    console.log('   - file_metadata');
    console.log('   - chat_messages');
    console.log('   - learning_paths');
    console.log('   - learning_steps');
    console.log('   - study_sessions');
    console.log('   - research_queries');
    console.log('   - video_generations');
    
    console.log('\n🔧 Next steps:');
    console.log('1. ✅ Your TiDB database is ready!');
    console.log('2. 🚀 Start your application with: npm run dev');
    console.log('3. 📱 Visit http://localhost:3000 to test your app');
    console.log('4. 🔄 The application will automatically sync user data to TiDB');
    console.log('5. 📁 Files will be stored in Appwrite and metadata in TiDB');
    console.log('\n🎉 Your application is ready for the TiDB AgentX Hackathon 2025!');
    
  } catch (error) {
    console.error('❌ TiDB setup failed:', error.message);
    
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('\n💡 Troubleshooting tips:');
      console.log('- Check your TIDB_USER and TIDB_PASSWORD');
      console.log('- Ensure your TiDB user has CREATE privileges');
      console.log('- Verify TIDB_HOST is correct');
    } else if (error.code === 'ENOTFOUND') {
      console.log('\n💡 Troubleshooting tips:');
      console.log('- Check your TIDB_HOST is correct');
      console.log('- Ensure your TiDB instance is running');
      console.log('- Verify network connectivity');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Troubleshooting tips:');
      console.log('- Verify your TiDB cluster is running');
      console.log('- Check if the port (4000) is correct');
      console.log('- Ensure your IP is whitelisted in TiDB Cloud');
    }
    
    console.log('\n📖 For detailed setup instructions, see SETUP.md');
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run setup if called directly
if (require.main === module) {
  setupTiDB();
}

module.exports = { setupTiDB };
