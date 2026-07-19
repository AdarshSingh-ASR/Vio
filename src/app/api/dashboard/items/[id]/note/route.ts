import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse, ApiError, requireDbUser } from "@/lib/request-auth";
import { executeQuery, executeSingle } from "@/lib/tidb";

async function requireOwnedItem(itemId: string, userId: string) {
  const rows = await executeQuery<any>(`SELECT id FROM dashboard_items WHERE id=? AND created_by=? LIMIT 1`, [itemId, userId]);
  if (!rows[0]) throw new ApiError(404, "Item not found", "ITEM_NOT_FOUND");
}

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id: itemId } = await props.params;
  try {
    const user = await requireDbUser(request);
    await requireOwnedItem(itemId, user.id);
    const notes = await executeQuery<any>(
      `SELECT content FROM item_notes WHERE item_id=? AND created_by=? ORDER BY updated_at DESC LIMIT 1`,
      [itemId, user.id]
    );
    return NextResponse.json({ content: notes[0]?.content || "" });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id: itemId } = await props.params;
  try {
    const user = await requireDbUser(request);
    await requireOwnedItem(itemId, user.id);
    const { content } = z.object({ content: z.string().max(100_000) }).parse(await request.json());
    const notes = await executeQuery<any>(
      `SELECT id FROM item_notes WHERE item_id=? AND created_by=? ORDER BY updated_at DESC LIMIT 1`,
      [itemId, user.id]
    );
    if (notes[0]) {
      await executeSingle(`UPDATE item_notes SET content=?, updated_at=UTC_TIMESTAMP() WHERE id=? AND created_by=?`, [content, notes[0].id, user.id]);
    } else {
      await executeSingle(`INSERT INTO item_notes (id, item_id, content, created_by) VALUES (?, ?, ?, ?)`, [crypto.randomUUID(), itemId, content, user.id]);
    }
    return NextResponse.json({ content });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
