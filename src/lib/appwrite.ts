import { Client, Databases, Account, Storage, Functions, Query, ID, Permission, Role } from "appwrite";

// Initialize Appwrite client
const client = new Client();

client
  .setEndpoint(process.env.APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1")
  .setProject(process.env.APPWRITE_PROJECT_ID!);

// Initialize services
export const databases = new Databases(client);
export const account = new Account(client);
export const storage = new Storage(client);
export const functions = new Functions(client);

export { client, Query, ID, Permission, Role };

// Database and Collection IDs (to be configured)
export const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || "vio-database";
export const COLLECTIONS = {
  USERS: "users",
  WORKSPACES: "workspaces", 
  FOLDERS: "folders",
  DASHBOARD_ITEMS: "dashboard-items",
  ITEM_FOLDERS: "item-folders",
  ITEM_NOTES: "item-notes",
  QUIZ_RESULTS: "quiz-results",
};

// Storage Bucket IDs (to be configured)
export const BUCKETS = {
  FILES: process.env.APPWRITE_FILES_BUCKET_ID || "files",
  IMAGES: process.env.APPWRITE_IMAGES_BUCKET_ID || "images",
  VIDEOS: process.env.APPWRITE_VIDEOS_BUCKET_ID || "videos",
};

// Helper functions for common operations
export const createDocument = async (collectionId: string, data: any, documentId?: string, permissions?: string[]) => {
  // Use provided permissions or default to Role.any() for compatibility
  const defaultPermissions = permissions || [
    Permission.read(Role.any()),
    Permission.update(Role.any()),
    Permission.delete(Role.any()),
  ];
  return await databases.createDocument(DATABASE_ID, collectionId, documentId || ID.unique(), data, defaultPermissions);
};

export const getDocument = async (collectionId: string, documentId: string) => {
  return await databases.getDocument(DATABASE_ID, collectionId, documentId);
};

export const updateDocument = async (collectionId: string, documentId: string, data: any, permissions?: string[]) => {
  // If permissions are provided, use them; otherwise, let Appwrite handle based on existing document permissions
  if (permissions) {
    return await databases.updateDocument(DATABASE_ID, collectionId, documentId, data, permissions);
  } else {
    return await databases.updateDocument(DATABASE_ID, collectionId, documentId, data);
  }
};

export const deleteDocument = async (collectionId: string, documentId: string) => {
  return await databases.deleteDocument(DATABASE_ID, collectionId, documentId);
};

export const listDocuments = async (collectionId: string, queries?: string[]) => {
  return await databases.listDocuments(DATABASE_ID, collectionId, queries);
};

// File upload helper functions
export const uploadFile = async (bucketId: string, file: File, fileId?: string, permissions?: string[]) => {
  // Use 'any' permissions if none provided, since buckets are configured for 'any' or 'guests' only
  const defaultPermissions = permissions || [
    Permission.read(Role.any()),
    Permission.update(Role.any()),
    Permission.delete(Role.any()),
  ];
  return await storage.createFile(bucketId, fileId || ID.unique(), file, defaultPermissions);
};

export const getFilePreview = (bucketId: string, fileId: string, width?: number, height?: number) => {
  return storage.getFilePreview(bucketId, fileId, width, height);
};

export const getFileView = (bucketId: string, fileId: string) => {
  return storage.getFileView(bucketId, fileId);
};

export const deleteFile = async (bucketId: string, fileId: string) => {
  return await storage.deleteFile(bucketId, fileId);
};

// Helper function to determine bucket based on file type
export const getBucketForFileType = (mimeType: string): string => {
  // For free tier, we use a single bucket for all file types
  return BUCKETS.FILES;
};

// Helper function to clean up associated files when deleting dashboard items
export const cleanupItemFiles = async (item: any) => {
  try {
    if (item.appwriteFileId && item.appwriteBucketId) {
      await deleteFile(item.appwriteBucketId, item.appwriteFileId);
      console.log(`Deleted file: ${item.appwriteFileId} from bucket: ${item.appwriteBucketId}`);
    }
  } catch (error) {
    console.error('Error deleting file from storage:', error);
    // Don't throw error - file might already be deleted or not exist
  }
}; 