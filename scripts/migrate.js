const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config({ path: path.join(process.cwd(), '.env') });

function config() {
  return {
    host: process.env.TIDB_HOST || 'localhost',
    port: Number(process.env.TIDB_PORT || 4000),
    user: process.env.TIDB_USER || 'root',
    password: process.env.TIDB_PASSWORD || '',
    database: process.env.TIDB_DATABASE || 'vio_database',
    ssl: process.env.TIDB_SSL === 'true' ? {} : undefined,
  };
}

async function archiveVideoGenerations(connection) {
  const [tables] = await connection.query(
    "SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'video_generations'"
  );
  if (!tables[0].count) return;

  await connection.query(`
    INSERT IGNORE INTO video_generations_archive (id, payload)
    SELECT id, JSON_OBJECT(
      'userId', user_id,
      'workspaceId', workspace_id,
      'topic', topic,
      'selectedDocuments', selected_documents,
      'learningLevel', learning_level,
      'videoStyle', video_style,
      'durationMinutes', duration_minutes,
      'includeExamples', include_examples,
      'includeVisuals', include_visuals,
      'includeQuiz', include_quiz,
      'script', script,
      'status', status,
      'createdAt', created_at,
      'updatedAt', updated_at
    ) FROM video_generations
  `);

  const [[source]] = await connection.query('SELECT COUNT(*) AS count FROM video_generations');
  const [[archive]] = await connection.query('SELECT COUNT(*) AS count FROM video_generations_archive');
  if (Number(archive.count) < Number(source.count)) {
    throw new Error('Learning Script Studio archive verification failed; legacy table was preserved.');
  }
  await connection.query('DROP TABLE video_generations');
}

async function run() {
  const connection = await mysql.createConnection(config());
  try {
    await connection.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(100) PRIMARY KEY,
      checksum VARCHAR(64) NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    const directory = path.join(process.cwd(), 'migrations');
    const files = fs.readdirSync(directory).filter((file) => file.endsWith('.sql')).sort();
    for (const file of files) {
      const sql = fs.readFileSync(path.join(directory, file), 'utf8');
      const checksum = crypto.createHash('sha256').update(sql).digest('hex');
      const [rows] = await connection.execute('SELECT checksum FROM schema_migrations WHERE version = ?', [file]);
      if (rows.length) {
        if (rows[0].checksum !== checksum) throw new Error(`Migration ${file} changed after it was applied.`);
        continue;
      }

      await connection.beginTransaction();
      try {
        for (const statement of sql.split('-- migrate:split').map((part) => part.trim()).filter(Boolean)) {
          const executable = statement.replace(/^--.*$/gm, '').trim();
          if (executable) await connection.query(executable);
        }
        if (file === '002_archive_learning_script_studio.sql') await archiveVideoGenerations(connection);
        await connection.execute('INSERT INTO schema_migrations (version, checksum) VALUES (?, ?)', [file, checksum]);
        await connection.commit();
        console.log(`Applied ${file}`);
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    }
  } finally {
    await connection.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
