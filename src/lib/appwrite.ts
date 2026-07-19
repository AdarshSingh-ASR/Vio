/**
 * Server-side storage routing only. TiDB owns all production metadata.
 */
export const BUCKETS = {
  FILES: process.env.APPWRITE_FILES_BUCKET_ID || "files",
  IMAGES: process.env.APPWRITE_IMAGES_BUCKET_ID || "images",
  VIDEOS: process.env.APPWRITE_VIDEOS_BUCKET_ID || "videos",
};

export function getBucketForFileType(_mimeType: string) {
  // A single private bucket keeps direct client uploads predictable. The
  // metadata still records MIME type and every download is authorization checked.
  return BUCKETS.FILES;
}
