import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import mysql from "mysql2/promise";
import { Client, Storage } from "node-appwrite";
import { GoogleAuth } from "google-auth-library";

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for live infrastructure tests`);
  return value;
};

test("TiDB contains every applied migration and vector-capable production table", async () => {
  const connection = await mysql.createConnection({
    host: required("TIDB_HOST"), port: Number(process.env.TIDB_PORT || 4000), user: required("TIDB_USER"),
    password: required("TIDB_PASSWORD"), database: required("TIDB_DATABASE"), ssl: process.env.TIDB_SSL === "true" ? {} : undefined,
  });
  try {
    const [[migration]] = await connection.query("SELECT COUNT(*) AS count FROM schema_migrations");
    assert.ok(Number(migration.count) >= 13);
    const [columns] = await connection.query(
      "SELECT COLUMN_NAME, DATA_TYPE FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='knowledge_chunks' AND column_name='embedding_vector'",
    );
    assert.equal(columns.length, 1);
    assert.match(String(columns[0].DATA_TYPE), /vector/i);
  } finally { await connection.end(); }
});

test("Appwrite storage buckets enforce file security", async () => {
  const client = new Client().setEndpoint(required("NEXT_PUBLIC_APPWRITE_ENDPOINT")).setProject(required("NEXT_PUBLIC_APPWRITE_PROJECT_ID")).setKey(required("APPWRITE_API_KEY"));
  const storage = new Storage(client);
  const ids = [required("NEXT_PUBLIC_APPWRITE_FILES_BUCKET_ID"), required("NEXT_PUBLIC_APPWRITE_IMAGES_BUCKET_ID"), required("NEXT_PUBLIC_APPWRITE_VIDEOS_BUCKET_ID")];
  for (const id of new Set(ids)) {
    const bucket = await storage.getBucket(id);
    assert.equal(bucket.fileSecurity, true, `${id} must have fileSecurity enabled`);
    assert.deepEqual(bucket.permissions, [], `${id} must not grant bucket-wide public permissions`);
  }
});

test("application credential-encryption key has the required strength", () => {
  const key = Buffer.from(required("AI_CREDENTIAL_ENCRYPTION_KEY"), "base64");
  assert.equal(key.length, 32, "AI_CREDENTIAL_ENCRYPTION_KEY must decode to 32 bytes");
});

test("inline agent evaluation service is reachable", async () => {
  const baseUrl = required("AGENT_SERVICE_URL").replace(/\/$/, "");
  const headers = {};
  if (process.env.AGENT_SERVICE_REQUIRE_OIDC === "true") {
    const identity = await new GoogleAuth().getIdTokenClient(process.env.AGENT_SERVICE_OIDC_AUDIENCE || baseUrl);
    Object.assign(headers, await identity.getRequestHeaders(baseUrl));
  }
  const response = await fetch(`${baseUrl}/health/ready`, { headers });
  assert.equal(response.status, 200, await response.text());

  const payload = Buffer.from(JSON.stringify({ sub: "live-provider-check", permissions: ["ai:embed"], exp: Math.floor(Date.now() / 1000) + 300 })).toString("base64url");
  const signed = `${payload}.${crypto.createHmac("sha256", required("AGENT_SHARED_SECRET")).update(payload).digest("base64url")}`;
  const embedding = await fetch(`${baseUrl}/v1/embeddings`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json", "X-Vio-Agent-Token": signed, "X-Vio-Trace-Id": crypto.randomUUID() },
    body: JSON.stringify({ texts: ["Vio production provider health check"], task_type: "RETRIEVAL_QUERY" }),
  });
  if (!embedding.ok) assert.fail(`Embedding health check failed (${embedding.status}): ${await embedding.text()}`);
  const embeddingResult = await embedding.json();
  assert.equal(embeddingResult.vectors?.[0]?.length, 768);
});
