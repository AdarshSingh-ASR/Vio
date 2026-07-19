const crypto = require("crypto");
const path = require("path");
const mysql = require("mysql2/promise");
const { GoogleAuth } = require("google-auth-library");
require("dotenv").config({ path: path.join(process.cwd(), ".env.local") });

function databaseConfig() {
  return {
    host: process.env.TIDB_HOST || "localhost",
    port: Number(process.env.TIDB_PORT || 4000),
    user: process.env.TIDB_USER || "root",
    password: process.env.TIDB_PASSWORD || "",
    database: process.env.TIDB_DATABASE || "vio_database",
    ssl: process.env.TIDB_SSL === "true" ? {} : undefined,
  };
}

function token(userId) {
  const secret = process.env.AGENT_SHARED_SECRET;
  if (!secret || secret.length < 32) throw new Error("AGENT_SHARED_SECRET must contain at least 32 characters");
  const payload = Buffer.from(JSON.stringify({ sub: userId, permissions: ["ai:embed"], exp: Math.floor(Date.now() / 1000) + 300 })).toString("base64url");
  return `${payload}.${crypto.createHmac("sha256", secret).update(payload).digest("base64url")}`;
}

async function serviceHeaders(baseUrl, userId) {
  const headers = { "Content-Type": "application/json", "X-Vio-Agent-Token": token(userId) };
  if (process.env.AGENT_SERVICE_REQUIRE_OIDC === "true") {
    const client = await new GoogleAuth().getIdTokenClient(process.env.AGENT_SERVICE_OIDC_AUDIENCE || baseUrl);
    const identity = await client.getRequestHeaders(baseUrl);
    headers.Authorization = typeof identity.get === "function" ? identity.get("authorization") : identity.Authorization || identity.authorization;
  }
  return headers;
}

async function embed(baseUrl, userId, texts) {
  const response = await fetch(`${baseUrl}/v1/embeddings`, {
    method: "POST",
    headers: await serviceHeaders(baseUrl, userId),
    body: JSON.stringify({ texts, task_type: "RETRIEVAL_DOCUMENT" }),
  });
  if (!response.ok) throw new Error(`Embedding request failed with HTTP ${response.status}`);
  const result = await response.json();
  if (!Array.isArray(result.vectors) || result.vectors.length !== texts.length) throw new Error("Embedding response count mismatch");
  return result;
}

async function run() {
  const baseUrl = process.env.AGENT_SERVICE_URL?.replace(/\/$/, "");
  if (!baseUrl) throw new Error("AGENT_SERVICE_URL is required");
  const connection = await mysql.createConnection(databaseConfig());
  try {
    const [documents] = await connection.query(
      `SELECT id, user_id FROM knowledge_documents
       WHERE status='ready' AND embedding_status IN ('pending','failed','disabled') ORDER BY created_at`,
    );
    for (const document of documents) {
      try {
        const [chunks] = await connection.execute(
          "SELECT id, content FROM knowledge_chunks WHERE document_id=? AND embedding_vector IS NULL ORDER BY chunk_index",
          [document.id],
        );
        let model = null;
        for (let start = 0; start < chunks.length; start += 16) {
          const batch = chunks.slice(start, start + 16);
          const result = await embed(baseUrl, document.user_id, batch.map((chunk) => chunk.content));
          model = result.model;
          await connection.beginTransaction();
          try {
            for (let index = 0; index < batch.length; index += 1) {
              await connection.execute("UPDATE knowledge_chunks SET embedding_vector=? WHERE id=?", [JSON.stringify(result.vectors[index]), batch[index].id]);
            }
            await connection.commit();
          } catch (error) {
            await connection.rollback();
            throw error;
          }
        }
        await connection.execute(
          "UPDATE knowledge_documents SET embedding_status='ready', embedding_model=?, error_message=NULL WHERE id=?",
          [model || process.env.VERTEX_EMBEDDING_MODEL || "gemini-embedding-001", document.id],
        );
        console.log(`Embedded ${document.id} (${chunks.length} chunks)`);
      } catch (error) {
        await connection.execute(
          "UPDATE knowledge_documents SET embedding_status='failed', error_message=? WHERE id=?",
          [String(error.message || error).slice(0, 2000), document.id],
        );
        console.error(`Failed ${document.id}: ${error.message || error}`);
      }
    }
    console.log(`Embedding backfill complete (${documents.length} documents inspected)`);
  } finally {
    await connection.end();
  }
}

run().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
