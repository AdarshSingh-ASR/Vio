import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedServices } from '@/lib/appwrite-server';
import { Query, COLLECTIONS } from '@/lib/appwrite';
import { storeMemory } from '@/lib/mem0';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { databases, user } = await getAuthenticatedServices(req);
    const userId = user.$id;
    const itemId = params.id;
    
    console.log(`Fetching note for itemId: ${itemId}, userId: ${userId}`);
    const response = await databases.listDocuments(
      process.env.APPWRITE_DATABASE_ID || 'vio-database',
      COLLECTIONS.ITEM_NOTES,
      [
        Query.equal('itemId', itemId),
        Query.equal('userId', userId)
      ]
    );
    
    const note = response.documents[0];
    console.log(`Found ${response.documents.length} notes for item ${itemId}`);
    return NextResponse.json({ content: note?.content || '' });
  } catch (error) {
    console.error('Get note error:', error);
    return NextResponse.json({ content: '' });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { databases, user } = await getAuthenticatedServices(req);
    const userId = user.$id;
    const itemId = params.id;
    const { content } = await req.json();

    console.log(`Saving note for itemId: ${itemId}, userId: ${userId}, content length: ${content?.length || 0}`);
    
    // Check if note already exists
    const existingNotes = await databases.listDocuments(
      process.env.APPWRITE_DATABASE_ID || 'vio-database',
      COLLECTIONS.ITEM_NOTES,
      [
        Query.equal('itemId', itemId),
        Query.equal('userId', userId)
      ]
    );

    console.log(`Found ${existingNotes.documents.length} existing notes for item ${itemId}`);

    let note;
    if (existingNotes.documents.length > 0) {
      // Update existing note
      console.log(`Updating existing note: ${existingNotes.documents[0].$id}`);
      note = await databases.updateDocument(
        process.env.APPWRITE_DATABASE_ID || 'vio-database',
        COLLECTIONS.ITEM_NOTES,
        existingNotes.documents[0].$id,
        {
          content,
          updatedAt: new Date().toISOString()
        }
      );
    } else {
      // Create new note
      console.log(`Creating new note for item ${itemId}`);
      note = await databases.createDocument(
        process.env.APPWRITE_DATABASE_ID || 'vio-database',
        COLLECTIONS.ITEM_NOTES,
        'unique()',
        {
          itemId,
          userId,
          content,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      );
    }

    console.log(`Note operation successful for item ${itemId}`);

    // Store memory using Mem0 for AI agents
    try {
      await storeMemory(userId, [
        { 
          role: 'user', 
          content: [{ 
            type: 'text', 
            text: `Note for item ${itemId}: ${content}` 
          }] 
        }
      ], {
        itemId,
        type: 'item_note'
      });
    } catch (memoryError) {
      console.error('Memory storage error:', memoryError);
      // Don't fail the request if memory storage fails
    }

    return NextResponse.json({ content: note.content });
  } catch (error) {
    console.error('Save note error:', error);
    return NextResponse.json({ 
      error: 'Failed to save note', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

// TODO: Integrate Mem0 for memory and note management
// import { createMem0 } from "@mem0/vercel-ai-provider";
// const mem0 = createMem0({ mem0ApiKey: process.env.MEM0_API_KEY });
// Use mem0 to store and retrieve memories for AI agents 