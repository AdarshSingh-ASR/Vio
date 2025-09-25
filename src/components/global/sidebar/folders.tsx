"use client";
import React from "react";
import { SidebarItem } from "./sidebar.item";
import { AiFillFolder } from "react-icons/ai";
import { Folder } from "lucide-react";
import { useFolders } from "@/context/FoldersContext";
import { usePathname } from "next/navigation";

const Folders = () => {
  const { folders, loading } = useFolders();
  const pathname = usePathname();

  return (
    <div className="mt-6">
      <h2 
        className="flex items-center gap-2 text-xs font-medium text-sidebar-foreground/60 px-3 mb-2 uppercase tracking-wide"
        title="Folders"
      >
        <AiFillFolder className="w-4 h-4" />Folders
      </h2>
      {loading ? (
        <div className="px-3 text-xs text-muted-foreground">Loading...</div>
      ) : folders.length === 0 ? (
        <div className="px-3 text-xs text-muted-foreground">No folders yet.</div>
      ) : (
        <div className="space-y-0.5">
          {folders.map(folder => {
            // Check if current path is folder page or folder item page
            const isSelected = pathname === `/dashboard/folder/${folder.$id}` || 
                              pathname.startsWith(`/dashboard/folder/${folder.$id}/item/`);
            
            return (
              <SidebarItem
                key={folder.$id}
                icon={<Folder className="w-4 h-4" />}
                title={folder.name}
                href={`/dashboard/folder/${folder.$id}`}
                selected={isSelected}
                className="ml-2"
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Folders; 