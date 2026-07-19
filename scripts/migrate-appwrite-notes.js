const crypto = require("crypto");
const mysql = require("mysql2/promise");
const { Client, Databases, Query } = require("node-appwrite");
require("dotenv").config({ path: ".env.local" });

async function run() {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1")
    .setProject(process.env.APPWRITE_PROJECT_ID || "")
    .setKey(process.env.APPWRITE_API_KEY || "");
  const databases = new Databases(client);
  const connection = await mysql.createConnection({
    host: process.env.TIDB_HOST || "localhost",
    port: Number(process.env.TIDB_PORT || 4000),
    user: process.env.TIDB_USER || "root",
    password: process.env.TIDB_PASSWORD || "",
    database: process.env.TIDB_DATABASE || "vio_database",
    ssl: process.env.TIDB_SSL === "true" ? {} : undefined,
  });
  const databaseId = process.env.APPWRITE_DATABASE_ID || "vio-database";
  const collectionId = process.env.APPWRITE_ITEM_NOTES_COLLECTION_ID || "item-notes";
  let offset = 0;
  let migrated = 0;
  let skipped = 0;
  try {
    while (true) {
      const page = await databases.listDocuments(databaseId, collectionId, [Query.limit(100), Query.offset(offset)]);
      for (const note of page.documents) {
        const [users] = await connection.execute(`SELECT id FROM users WHERE appwrite_user_id=? LIMIT 1`, [note.userId]);
        const user = users[0];
        const [items] = await connection.execute(`SELECT id FROM dashboard_items WHERE id=? AND created_by=? LIMIT 1`, [note.itemId, user?.id || ""]);
        if (!user || !items[0]) { skipped += 1; continue; }
        const [existing] = await connection.execute(`SELECT id FROM item_notes WHERE item_id=? AND created_by=? ORDER BY updated_at DESC LIMIT 1`, [note.itemId, user.id]);
        if (existing[0]) {
          await connection.execute(`UPDATE item_notes SET content=?, updated_at=? WHERE id=?`, [String(note.content || ""), note.updatedAt ? new Date(note.updatedAt) : new Date(), existing[0].id]);
        } else {
          await connection.execute(`INSERT INTO item_notes (id, item_id, content, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`, [crypto.randomUUID(), note.itemId, String(note.content || ""), user.id, note.createdAt ? new Date(note.createdAt) : new Date(), note.updatedAt ? new Date(note.updatedAt) : new Date()]);
        }
        migrated += 1;
      }
      offset += page.documents.length;
      if (offset >= page.total || page.documents.length === 0) break;
    }
    console.log(JSON.stringify({ source: offset, migrated, skipped, verified: migrated + skipped === offset }));
    if (migrated + skipped !== offset) throw new Error("Appwrite note migration verification failed");
  } finally {
    await connection.end();
  }
}

run().catch((error) => { console.error(error); process.exit(1); });
