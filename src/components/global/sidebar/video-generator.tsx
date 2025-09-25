'use client';

import React from 'react';
import { Video, Play, Lightbulb, Brain, Target } from 'lucide-react';
import VideoGenerator from '@/components/video/VideoGenerator';

export default function VideoGeneratorSidebar() {
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 p-4 border-b">
        <Video className="h-5 w-5 text-blue-600" />
        <h2 className="text-lg font-semibold">Learning Script Studio</h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <VideoGenerator />
      </div>
    </div>
  );
}
