const mysql = require('mysql2/promise');

async function migrateQuizChatToTiDB() {
  const connection = await mysql.createConnection({
    host: process.env.TIDB_HOST || 'localhost',
    port: parseInt(process.env.TIDB_PORT || '4000'),
    user: process.env.TIDB_USER || 'root',
    password: process.env.TIDB_PASSWORD || '',
    database: process.env.TIDB_DATABASE || 'vio_database',
    ssl: process.env.TIDB_SSL === 'true' ? {} : false
  });

  try {
    console.log('🔧 Running quiz and chat migration...');
    
    // Check if quiz_results table needs updates
    const [quizColumns] = await connection.execute(
      "SHOW COLUMNS FROM quiz_results LIKE 'item_id'"
    );
    
    if (quizColumns.length === 0) {
      console.log('📝 Adding missing columns to quiz_results table...');
      
      // Add missing columns to quiz_results table
      await connection.execute(
        'ALTER TABLE quiz_results ADD COLUMN item_id VARCHAR(255) AFTER user_id'
      );
      await connection.execute(
        'ALTER TABLE quiz_results ADD COLUMN item_name VARCHAR(500) AFTER item_id'
      );
      await connection.execute(
        'ALTER TABLE quiz_results ADD COLUMN time_spent INT DEFAULT 0 AFTER total_questions'
      );
      await connection.execute(
        'ALTER TABLE quiz_results ADD COLUMN percentage DECIMAL(5,2) AFTER time_spent'
      );
      await connection.execute(
        'ALTER TABLE quiz_results ADD COLUMN topic_analysis JSON AFTER percentage'
      );
      await connection.execute(
        'ALTER TABLE quiz_results ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER completed_at'
      );
      
      // Add index for item_id
      await connection.execute(
        'CREATE INDEX IF NOT EXISTS idx_item_id ON quiz_results(item_id)'
      );
      
      console.log('✅ Updated quiz_results table with missing columns');
    } else {
      console.log('ℹ️ quiz_results table already has required columns');
    }
    
    // Check if chat_messages table exists
    const [chatTables] = await connection.execute(
      "SHOW TABLES LIKE 'chat_messages'"
    );
    
    if (chatTables.length === 0) {
      console.log('📝 Creating chat_messages table...');
      
      await connection.execute(`
        CREATE TABLE chat_messages (
          id VARCHAR(255) PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          chat_id VARCHAR(255) NOT NULL,
          role ENUM('user', 'assistant') NOT NULL,
          content TEXT NOT NULL,
          metadata JSON,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          INDEX idx_user_id (user_id),
          INDEX idx_chat_id (chat_id),
          INDEX idx_created_at (created_at),
          INDEX idx_role (role)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      
      console.log('✅ Created chat_messages table');
    } else {
      console.log('ℹ️ chat_messages table already exists');
    }
    
    console.log('🎉 Quiz and chat migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

// Load environment variables
require('dotenv').config({ path: '.env.local' });

migrateQuizChatToTiDB().catch(console.error);
