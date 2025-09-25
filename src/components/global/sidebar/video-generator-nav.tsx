'use client';

import React from 'react';
import { Video } from 'lucide-react';
import { SidebarItem } from './sidebar.item';
import { usePathname } from 'next/navigation';

export default function VideoGeneratorNav() {
  const pathname = usePathname();

  return (
    <SidebarItem
      title="Learning Script Studio"
      href="/dashboard/video-generator"
      icon={<Video className="w-4 h-4" />}
      selected={pathname === "/dashboard/video-generator"}
    />
  );
}
