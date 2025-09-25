import { storage } from '@/lib/appwrite';

export class VideoStorageService {
  private videoBucketId: string;
  private tempDir: string;

  constructor() {
    this.videoBucketId = process.env.APPWRITE_VIDEOS_BUCKET_ID || 'videos';
    this.tempDir = 'temp/videos';
    this.ensureTempDir();
  }

  private async ensureTempDir(): Promise<void> {
    // Only create directories on server side
    if (typeof window === 'undefined') {
      try {
        const { promises: fs } = await import('fs');
        await fs.mkdir(this.tempDir, { recursive: true });
      } catch (error) {
        console.error('Failed to create temp directory:', error);
      }
    }
  }

  async uploadVideo(filePath: string, fileName: string, userId: string): Promise<string> {
    try {
      // Read the video file (server-side only)
      if (typeof window !== 'undefined') {
        throw new Error('Video upload must be done server-side');
      }

      const { promises: fs } = await import('fs');
      const fileBuffer = await fs.readFile(filePath);
      
      // Create a File object for Appwrite
      const file = new File([fileBuffer], fileName, { type: 'video/mp4' });
      
      // Generate unique file ID (max 36 chars, alphanumeric only)
      const timestamp = Date.now().toString(36);
      const userHash = userId.split('@')[0].substring(0, 8);
      const fileHash = fileName.substring(0, 8).replace(/[^a-zA-Z0-9]/g, '');
      const fileId = `${userHash}_${timestamp}_${fileHash}`.substring(0, 36);
      
      // Upload to Appwrite Storage
      const result = await storage.createFile(this.videoBucketId, fileId, file);
      
      // Return the file URL
      return this.getFileUrl(this.videoBucketId, result.$id);
      
    } catch (error) {
      console.error('Failed to upload video to storage:', error);
      throw new Error(`Video upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async uploadAudio(filePath: string, fileName: string, userId: string): Promise<string> {
    try {
      // Server-side only
      if (typeof window !== 'undefined') {
        throw new Error('Audio upload must be done server-side');
      }

      const audioBucketId = process.env.APPWRITE_FILES_BUCKET_ID || 'files';
      
      // Read the audio file
      const { promises: fs } = await import('fs');
      const fileBuffer = await fs.readFile(filePath);
      
      // Create a File object for Appwrite
      const file = new File([fileBuffer], fileName, { type: 'audio/wav' });
      
      // Generate unique file ID (max 36 chars, alphanumeric only)
      const timestamp = Date.now().toString(36);
      const userHash = userId.split('@')[0].substring(0, 8);
      const fileHash = fileName.substring(0, 8).replace(/[^a-zA-Z0-9]/g, '');
      const fileId = `${userHash}_${timestamp}_${fileHash}`.substring(0, 36);
      
      // Upload to Appwrite Storage
      const result = await storage.createFile(audioBucketId, fileId, file);
      
      // Return the file URL
      return this.getFileUrl(audioBucketId, result.$id);
      
    } catch (error) {
      console.error('Failed to upload audio to storage:', error);
      throw new Error(`Audio upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async uploadPreview(filePath: string, fileName: string, userId: string): Promise<string> {
    try {
      // Server-side only
      if (typeof window !== 'undefined') {
        throw new Error('Preview upload must be done server-side');
      }

      const imageBucketId = process.env.APPWRITE_IMAGES_BUCKET_ID || 'images';
      
      // Read the preview image
      const { promises: fs } = await import('fs');
      const fileBuffer = await fs.readFile(filePath);
      
      // Create a File object for Appwrite
      const file = new File([fileBuffer], fileName, { type: 'image/jpeg' });
      
      // Generate unique file ID (max 36 chars, alphanumeric only)
      const timestamp = Date.now().toString(36);
      const userHash = userId.split('@')[0].substring(0, 8);
      const fileHash = fileName.substring(0, 8).replace(/[^a-zA-Z0-9]/g, '');
      const fileId = `${userHash}_${timestamp}_${fileHash}`.substring(0, 36);
      
      // Upload to Appwrite Storage
      const result = await storage.createFile(imageBucketId, fileId, file);
      
      // Return the file URL
      return this.getFileUrl(imageBucketId, result.$id);
      
    } catch (error) {
      console.error('Failed to upload preview to storage:', error);
      throw new Error(`Preview upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private getFileUrl(bucketId: string, fileId: string): string {
    const endpoint = process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
    const projectId = process.env.APPWRITE_PROJECT_ID;
    
    if (!projectId) {
      throw new Error('APPWRITE_PROJECT_ID is not configured');
    }
    
    return `${endpoint}/storage/buckets/${bucketId}/files/${fileId}/view?project=${projectId}`;
  }

  async downloadFile(fileUrl: string): Promise<Buffer | ArrayBuffer> {
    try {
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      
      // Return Buffer on server-side, ArrayBuffer on client-side
      if (typeof window === 'undefined') {
        return Buffer.from(arrayBuffer);
      } else {
        return arrayBuffer;
      }
      
    } catch (error) {
      console.error('Failed to download file:', error);
      throw new Error(`File download failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteFile(bucketId: string, fileId: string): Promise<void> {
    try {
      await storage.deleteFile(bucketId, fileId);
    } catch (error) {
      console.error('Failed to delete file:', error);
      throw new Error(`File deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async cleanupTempFiles(filePaths: string[]): Promise<void> {
    // Only cleanup on server side
    if (typeof window === 'undefined') {
      for (const filePath of filePaths) {
        try {
          const { promises: fs } = await import('fs');
          await fs.unlink(filePath);
        } catch (error) {
          console.warn(`Failed to cleanup temp file ${filePath}:`, error);
        }
      }
    }
  }

  async getFileInfo(fileUrl: string): Promise<{ size: number; type: string; lastModified: Date }> {
    try {
      const response = await fetch(fileUrl, { method: 'HEAD' });
      if (!response.ok) {
        throw new Error(`Failed to get file info: ${response.statusText}`);
      }
      
      const contentLength = response.headers.get('content-length');
      const contentType = response.headers.get('content-type');
      const lastModified = response.headers.get('last-modified');
      
      return {
        size: contentLength ? parseInt(contentLength) : 0,
        type: contentType || 'unknown',
        lastModified: lastModified ? new Date(lastModified) : new Date()
      };
      
    } catch (error) {
      console.error('Failed to get file info:', error);
      throw new Error(`File info retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createTempFilePath(extension: string = 'mp4'): Promise<string> {
    const fileName = `temp_${Date.now()}.${extension}`;
    
    if (typeof window === 'undefined') {
      const path = await import('path');
      return path.join(this.tempDir, fileName);
    } else {
      return fileName; // Client-side: just return filename
    }
  }

  async saveTempFile(buffer: Buffer | ArrayBuffer, extension: string = 'mp4'): Promise<string> {
    const filePath = await this.createTempFilePath(extension);
    
    if (typeof window === 'undefined') {
      // Server-side: write to file
      const { promises: fs } = await import('fs');
      await fs.writeFile(filePath, buffer as Buffer);
      return filePath;
    } else {
      // Client-side: create blob URL
      const blob = new Blob([buffer], { type: `video/${extension}` });
      return URL.createObjectURL(blob);
    }
  }

  async moveTempToStorage(tempFilePath: string, fileName: string, userId: string, type: 'video' | 'audio' | 'image'): Promise<string> {
    try {
      switch (type) {
        case 'video':
          return await this.uploadVideo(tempFilePath, fileName, userId);
        case 'audio':
          return await this.uploadAudio(tempFilePath, fileName, userId);
        case 'image':
          return await this.uploadPreview(tempFilePath, fileName, userId);
        default:
          throw new Error(`Unsupported file type: ${type}`);
      }
    } finally {
      // Clean up temp file (server-side only)
      if (typeof window === 'undefined') {
        try {
          const { promises: fs } = await import('fs');
          await fs.unlink(tempFilePath);
        } catch (error) {
          console.warn(`Failed to cleanup temp file ${tempFilePath}:`, error);
        }
      } else {
        // Client-side: revoke blob URL
        if (tempFilePath.startsWith('blob:')) {
          URL.revokeObjectURL(tempFilePath);
        }
      }
    }
  }
}
