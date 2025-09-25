import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedServices } from '@/lib/appwrite-server';
import { 
  Query, 
  COLLECTIONS, 
  listDocuments, 
  deleteDocument 
} from '@/lib/appwrite';
import { Users } from 'node-appwrite';

export async function DELETE(request: NextRequest) {
  try {
    console.log('DELETE /api/user/delete - Starting user account deletion');
    
    // Get authenticated services with JWT
    const { databases, user } = await getAuthenticatedServices(request);
    
    console.log('User authenticated for deletion:', user.email);
    
    // First, get all user-related data from the database
    
    // Get user's dashboard items
    const userItems = await databases.listDocuments(
      process.env.APPWRITE_DATABASE_ID || "vio-database",
      COLLECTIONS.DASHBOARD_ITEMS,
      [Query.equal('userId', user.$id)]
    );
    
    console.log(`Found ${userItems.documents.length} dashboard items to delete`);
    
    // Get user's folders
    const userFolders = await databases.listDocuments(
      process.env.APPWRITE_DATABASE_ID || "vio-database",
      COLLECTIONS.FOLDERS,
      [Query.equal('userId', user.$id)]
    );
    
    console.log(`Found ${userFolders.documents.length} folders to delete`);
    
    // Delete item-folder relationships for user's items
    if (userItems.documents.length > 0) {
      for (const item of userItems.documents) {
        const itemFolders = await databases.listDocuments(
          process.env.APPWRITE_DATABASE_ID || "vio-database",
          COLLECTIONS.ITEM_FOLDERS,
          [Query.equal('itemId', item.$id)]
        );
        
        for (const itemFolder of itemFolders.documents) {
          await databases.deleteDocument(
            process.env.APPWRITE_DATABASE_ID || "vio-database",
            COLLECTIONS.ITEM_FOLDERS,
            itemFolder.$id
          );
        }
      }
    }
    
    // Delete item-folder relationships for user's folders
    if (userFolders.documents.length > 0) {
      for (const folder of userFolders.documents) {
        const folderItems = await databases.listDocuments(
          process.env.APPWRITE_DATABASE_ID || "vio-database",
          COLLECTIONS.ITEM_FOLDERS,
          [Query.equal('folderId', folder.$id)]
        );
        
        for (const folderItem of folderItems.documents) {
          await databases.deleteDocument(
            process.env.APPWRITE_DATABASE_ID || "vio-database",
            COLLECTIONS.ITEM_FOLDERS,
            folderItem.$id
          );
        }
      }
    }
    
    console.log('Item-folder relationships deleted');
    
    // Delete all user's dashboard items
    for (const item of userItems.documents) {
      await databases.deleteDocument(
        process.env.APPWRITE_DATABASE_ID || "vio-database",
        COLLECTIONS.DASHBOARD_ITEMS,
        item.$id
      );
    }
    
    // Delete user's folders
    for (const folder of userFolders.documents) {
      await databases.deleteDocument(
        process.env.APPWRITE_DATABASE_ID || "vio-database",
        COLLECTIONS.FOLDERS,
        folder.$id
      );
    }
    
    // Delete quiz results
    const quizResults = await databases.listDocuments(
      process.env.APPWRITE_DATABASE_ID || "vio-database",
      COLLECTIONS.QUIZ_RESULTS,
      [Query.equal('userId', user.$id)]
    );
    
    console.log(`Found ${quizResults.documents.length} quiz results to delete`);
    
    for (const quizResult of quizResults.documents) {
      await databases.deleteDocument(
        process.env.APPWRITE_DATABASE_ID || "vio-database",
        COLLECTIONS.QUIZ_RESULTS,
        quizResult.$id
      );
    }
    
    // Delete user profile from database
    const existingUsers = await databases.listDocuments(
      process.env.APPWRITE_DATABASE_ID || "vio-database",
      COLLECTIONS.USERS,
      [Query.equal('appwriteId', user.$id)]
    );
    
    if (existingUsers.documents.length > 0) {
      console.log('Deleting user profile from database');
      await databases.deleteDocument(
        process.env.APPWRITE_DATABASE_ID || "vio-database",
        COLLECTIONS.USERS,
        existingUsers.documents[0].$id
      );
    }
    
    // Finally, delete the user account from Appwrite using admin SDK
    try {
      // Create admin client for user deletion
      const { Client } = require('node-appwrite');
      const adminClient = new Client()
        .setEndpoint(process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
        .setProject(process.env.APPWRITE_PROJECT_ID || '')
        .setKey(process.env.APPWRITE_API_KEY || '');
      
      const adminUsers = new Users(adminClient);
      
      console.log('Deleting user account from Appwrite');
      await adminUsers.delete(user.$id);
      
      console.log('User account deleted successfully:', user.$id);
    } catch (error) {
      console.error('Error deleting user from Appwrite (continuing anyway):', error);
      // Continue even if Appwrite user deletion fails, since we've cleaned up the data
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Account deleted successfully' 
    });

  } catch (error: any) {
    console.error('Error in DELETE /api/user/delete:', error);
    
    // Handle authentication errors
    if (error.message?.includes('JWT') || error.message?.includes('Authentication')) {
      return NextResponse.json(
        { error: 'Authentication required', details: error.message },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to delete account', details: error.message },
      { status: 500 }
    );
  }
} 