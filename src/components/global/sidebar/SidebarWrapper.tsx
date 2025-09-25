"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./index";

export default function SidebarWrapper() {
  const pathname = usePathname();
  
  // Extract workspaceId from pathname
  // Handle special cases like /dashboard/folder/[id], /dashboard/search, /dashboard/settings
  const match = pathname.match(/dashboard\/([^/]+)/);
  let activeWorkspaceId = match ? match[1] : "";
  
  // If we're on special pages (folder, search, settings, agents), use "default" as workspace
  if (activeWorkspaceId === "folder" || activeWorkspaceId === "search" || activeWorkspaceId === "settings" || activeWorkspaceId === "agents") {
    activeWorkspaceId = "default";
  }
  
  return <Sidebar activeWorkspaceId={activeWorkspaceId} />;
} 