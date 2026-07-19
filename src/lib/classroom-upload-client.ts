import { clientStorage, ID } from "@/lib/appwrite-client";

export type StoredUpload = { fileId: string; bucketId: string; name: string; size: number; mimeType: string };

const bucketId = process.env.NEXT_PUBLIC_APPWRITE_FILES_BUCKET_ID || "files";

export async function uploadClassroomFilesDirect(
  files: File[],
  onProgress?: (completed: number, total: number, currentPercent: number) => void
): Promise<StoredUpload[]> {
  if (files.length > 10) throw new Error("Upload at most 10 files at a time");
  const uploaded: StoredUpload[] = [];
  try {
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      if (file.size > 20 * 1024 * 1024) throw new Error(`${file.name} exceeds the 20 MB limit`);
      const fileId = ID.unique();
      await clientStorage.createFile(bucketId, fileId, file, undefined, (progress) => {
        onProgress?.(index, files.length, Math.round(progress.progress));
      });
      uploaded.push({ fileId, bucketId, name: file.name, size: file.size, mimeType: file.type });
      onProgress?.(index + 1, files.length, 100);
    }
    return uploaded;
  } catch (error) {
    await Promise.allSettled(uploaded.map((file) => clientStorage.deleteFile(file.bucketId, file.fileId)));
    throw error;
  }
}

export async function cleanupStoredUploads(files: StoredUpload[]) {
  await Promise.allSettled(files.map((file) => clientStorage.deleteFile(file.bucketId, file.fileId)));
}
