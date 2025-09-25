'use client';

import React, { Suspense } from 'react';
import VideoGenerator from '@/components/video/VideoGenerator';

const VideoGeneratorPageContent = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <VideoGenerator />
      </div>
    </div>
  );
};

export default function VideoGeneratorPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    }>
      <VideoGeneratorPageContent />
    </Suspense>
  );
}
