import mysql from 'mysql2/promise';

// TiDB connection configuration
export interface TiDBConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl?: {} | undefined;
}

// Get TiDB configuration from environment variables
export const getTiDBConfig = (): TiDBConfig => {
  return {
    host: process.env.TIDB_HOST || 'localhost',
    port: parseInt(process.env.TIDB_PORT || '4000'),
    user: process.env.TIDB_USER || 'root',
    password: process.env.TIDB_PASSWORD || '',
    database: process.env.TIDB_DATABASE || 'vio_database',
    ssl: process.env.TIDB_SSL === 'true' ? {} : undefined
  };
};

// Create TiDB connection pool
let connectionPool: mysql.Pool | null = null;

export const getTiDBPool = (): mysql.Pool => {
  if (!connectionPool) {
    const config = getTiDBConfig();
    connectionPool = mysql.createPool({
      ...config,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }
  return connectionPool;
};

// Execute query with connection pool
export const executeQuery = async <T = any>(
  query: string, 
  params: any[] = []
): Promise<T[]> => {
  const pool = getTiDBPool();
  try {
    const [rows] = await pool.execute(query, params);
    return rows as T[];
  } catch (error) {
    console.error('TiDB Query Error:', error);
    throw error;
  }
};

// Execute single query (for INSERT, UPDATE, DELETE)
export const executeSingle = async (
  query: string, 
  params: any[] = []
): Promise<mysql.ResultSetHeader> => {
  const pool = getTiDBPool();
  try {
    const [result] = await pool.execute(query, params);
    return result as mysql.ResultSetHeader;
  } catch (error) {
    console.error('TiDB Execute Error:', error);
    throw error;
  }
};

// Transaction helper
export const withTransaction = async <T>(
  callback: (connection: mysql.PoolConnection) => Promise<T>
): Promise<T> => {
  const pool = getTiDBPool();
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

// Close connection pool (for cleanup)
export const closeTiDBPool = async (): Promise<void> => {
  if (connectionPool) {
    await connectionPool.end();
    connectionPool = null;
  }
};

// Database schema and table definitions
export const TABLES = {
  USERS: 'users',
  WORKSPACES: 'workspaces',
  FOLDERS: 'folders',
  DASHBOARD_ITEMS: 'dashboard_items',
  ITEM_FOLDERS: 'item_folders',
  ITEM_NOTES: 'item_notes',
  QUIZ_RESULTS: 'quiz_results',
  CHAT_MESSAGES: 'chat_messages',
  FILE_METADATA: 'file_metadata',
  LEARNING_PATHS: 'learning_paths',
  LEARNING_STEPS: 'learning_steps',
  STUDY_SESSIONS: 'study_sessions',
  RESEARCH_QUERIES: 'research_queries',
  VIDEO_GENERATIONS: 'video_generations'
} as const;

// Helper function to escape table names and columns
export const escapeId = (id: string): string => {
  return `\`${id.replace(/`/g, '``')}\``;
};

// Helper function to escape values
export const escapeValue = (value: any): string => {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'string') {
    return `'${value.replace(/'/g, "''")}'`;
  }
  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }
  if (value instanceof Date) {
    return `'${value.toISOString().slice(0, 19).replace('T', ' ')}'`;
  }
  return String(value);
};
