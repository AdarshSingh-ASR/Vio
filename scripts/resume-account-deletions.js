const path = require("node:path");
const mysql = require("mysql2/promise");
const { Client, Storage, Users } = require("node-appwrite");
require("dotenv").config({ path: path.join(process.cwd(), ".env.local") });

function databaseConfig() {
  return {
    host: process.env.TIDB_HOST || "localhost", port: Number(process.env.TIDB_PORT || 4000),
    user: process.env.TIDB_USER || "root", password: process.env.TIDB_PASSWORD || "",
    database: process.env.TIDB_DATABASE || "vio_database", ssl: process.env.TIDB_SSL === "true" ? {} : undefined,
  };
}

function appwrite() {
  for (const name of ["APPWRITE_ENDPOINT", "APPWRITE_PROJECT_ID", "APPWRITE_API_KEY"]) if (!process.env[name]) throw new Error(`${name} is required`);
  const client = new Client().setEndpoint(process.env.APPWRITE_ENDPOINT).setProject(process.env.APPWRITE_PROJECT_ID).setKey(process.env.APPWRITE_API_KEY);
  return { storage: new Storage(client), users: new Users(client) };
}

async function run() {
  const connection = await mysql.createConnection(databaseConfig());
  const { storage, users } = appwrite();
  try {
    const [jobs] = await connection.query("SELECT * FROM account_deletion_jobs WHERE status='failed' ORDER BY updated_at");
    for (const job of jobs) {
      try {
        let stage = job.last_successful_stage;
        if (stage === "requested") {
          const [files] = await connection.execute(
            `SELECT appwrite_bucket_id AS bucket_id, appwrite_file_id AS file_id FROM dashboard_items WHERE created_by=? AND appwrite_file_id IS NOT NULL
             UNION SELECT aa.bucket_id, aa.appwrite_file_id FROM assignment_attachments aa JOIN homework_assignments a ON a.id=aa.assignment_id JOIN classrooms c ON c.id=a.classroom_id WHERE c.owner_user_id=?
             UNION SELECT sa.bucket_id, sa.appwrite_file_id FROM submission_attachments sa JOIN submission_versions sv ON sv.id=sa.submission_version_id JOIN homework_submissions hs ON hs.id=sv.submission_id WHERE hs.student_user_id=?`,
            [job.user_id, job.user_id, job.user_id],
          );
          for (const file of files) {
            try { await storage.deleteFile(file.bucket_id, file.file_id); }
            catch (error) { if (Number(error?.code || 0) !== 404) throw error; }
          }
          await connection.execute("UPDATE account_deletion_jobs SET status='files_deleted', last_successful_stage='files_deleted', error_code=NULL WHERE id=?", [job.id]);
          stage = "files_deleted";
        }
        if (stage === "files_deleted") {
          try { await users.delete(job.appwrite_user_id); }
          catch (error) { if (Number(error?.code || 0) !== 404) throw error; }
          await connection.execute("UPDATE account_deletion_jobs SET status='identity_deleted', last_successful_stage='identity_deleted', error_code=NULL WHERE id=?", [job.id]);
          stage = "identity_deleted";
        }
        if (stage === "identity_deleted") {
          await connection.execute("DELETE FROM users WHERE id=?", [job.user_id]);
          await connection.execute("UPDATE account_deletion_jobs SET status='completed', error_code=NULL, completed_at=UTC_TIMESTAMP() WHERE id=?", [job.id]);
        }
        console.log(`Completed account deletion ${job.id}`);
      } catch (error) {
        await connection.execute("UPDATE account_deletion_jobs SET status='failed', error_code=? WHERE id=?", [String(error.name || "ACCOUNT_DELETION_ERROR").slice(0, 100), job.id]);
        console.error(`Account deletion ${job.id} still failed: ${error.message || error}`);
      }
    }
  } finally { await connection.end(); }
}

run().catch((error) => { console.error(error.message || error); process.exitCode = 1; });
