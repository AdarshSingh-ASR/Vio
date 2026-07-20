import { executeQuery } from "@/lib/tidb";
import { createEmbeddings } from "@/lib/embedding-service";

export type KnowledgeHit = {
  chunkId: string;
  documentId: string;
  title: string;
  content: string;
  locator: unknown;
  score: number;
  citation: string;
};

export interface KnowledgeStore {
  searchOwned(input: { userId: string; query: string; limit?: number }): Promise<KnowledgeHit[]>;
}

function parseLocator(value: unknown) {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return null; }
}

export class TiDBKnowledgeStore implements KnowledgeStore {
  async searchOwned(input: { userId: string; query: string; limit?: number }) {
    const limit = Math.min(Math.max(input.limit || 5, 1), 20);
    const terms = input.query.toLowerCase().split(/\W+/).filter((term) => term.length > 2).slice(0, 8);
    if (!terms.length) return [];
    const conditions = terms.map(() => "LOWER(kc.content) LIKE ?").join(" OR ");
    const lexicalRows = await executeQuery<any>(
      `SELECT kc.id AS chunk_id, kd.id AS document_id, kd.file_name,
              LEFT(kc.content, 5000) AS content, kc.locator, 1 AS relevance
       FROM knowledge_chunks kc JOIN knowledge_documents kd ON kd.id=kc.document_id
       WHERE kd.user_id=? AND kd.status='ready' AND (${conditions})
       ORDER BY kd.updated_at DESC, kc.chunk_index ASC LIMIT ${limit}`,
      [input.userId, ...terms.map((term) => `%${term}%`)]
    );

    let vectorRows: any[] = [];
    try {
      const embedding = (await createEmbeddings(input.userId, [input.query], "RETRIEVAL_QUERY")).vectors[0];
      vectorRows = await executeQuery<any>(
        `SELECT kc.id AS chunk_id, kd.id AS document_id, kd.file_name,
                LEFT(kc.content, 5000) AS content, kc.locator,
                VEC_COSINE_DISTANCE(kc.embedding_vector, ?) AS distance
         FROM knowledge_chunks kc JOIN knowledge_documents kd ON kd.id=kc.document_id
         WHERE kd.user_id=? AND kd.status='ready' AND kc.embedding_vector IS NOT NULL
         ORDER BY distance ASC LIMIT ${Math.min(limit * 3, 50)}`,
        [JSON.stringify(embedding), input.userId],
      );
    } catch (error) {
      // Vector capability is optional during migration or a provider outage; lexical retrieval remains available.
      console.warn("Vector retrieval unavailable", { code: error instanceof Error ? error.name : "UNKNOWN" });
    }

    const ranked = new Map<string, { row: any; score: number }>();
    lexicalRows.forEach((row, index) => ranked.set(String(row.chunk_id), { row, score: 1 / (60 + index + 1) }));
    vectorRows.forEach((row, index) => {
      const key = String(row.chunk_id);
      const existing = ranked.get(key);
      ranked.set(key, { row: existing?.row || row, score: (existing?.score || 0) + 1 / (60 + index + 1) });
    });

    return Array.from(ranked.values()).sort((left, right) => right.score - left.score).slice(0, limit).map(({ row, score }, index) => ({
      chunkId: String(row.chunk_id),
      documentId: String(row.document_id),
      title: row.file_name || "Uploaded document",
      content: row.content,
      locator: parseLocator(row.locator),
      score,
      citation: `[K${index + 1}]`,
    }));
  }
}

export const knowledgeStore: KnowledgeStore = new TiDBKnowledgeStore();
