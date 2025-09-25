const mysql = require('mysql2/promise');

async function migrateDisplayName() {
  const connection = await mysql.createConnection({
    host: process.env.TIDB_HOST || 'localhost',
    port: parseInt(process.env.TIDB_PORT || '4000'),
    user: process.env.TIDB_USER || 'root',
    password: process.env.TIDB_PASSWORD || '',
    database: process.env.TIDB_DATABASE || 'vio_database',
    ssl: process.env.TIDB_SSL === 'true' ? {} : false
  });

  try {
    console.log('🔧 Running display_name migration...');
    
    // Check if display_name column exists
    const [columns] = await connection.execute(
      "SHOW COLUMNS FROM dashboard_items LIKE 'display_name'"
    );
    
    if (columns.length === 0) {
      console.log('📝 Adding display_name column...');
      
      // Add the display_name column
      await connection.execute(
        'ALTER TABLE dashboard_items ADD COLUMN display_name VARCHAR(255) AFTER title'
      );
      console.log('✅ Added display_name column');
      
      // Update existing records to set display_name = title
      await connection.execute(
        'UPDATE dashboard_items SET display_name = title WHERE display_name IS NULL OR display_name = ""'
      );
      console.log('✅ Updated existing records with display_name = title');
      
      // Make display_name NOT NULL after updating existing records
      await connection.execute(
        'ALTER TABLE dashboard_items MODIFY COLUMN display_name VARCHAR(255) NOT NULL'
      );
      console.log('✅ Made display_name column NOT NULL');
      
    } else {
      console.log('ℹ️ display_name column already exists, skipping migration');
    }
    
    console.log('🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

// Load environment variables
require('dotenv').config({ path: '.env.local' });

migrateDisplayName().catch(console.error);
