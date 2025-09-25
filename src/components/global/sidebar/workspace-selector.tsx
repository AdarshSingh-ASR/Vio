"use client";

import React from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from '@/context/AuthContext';
import { Listbox } from '@headlessui/react';
import { ChevronDown, Check } from 'lucide-react';

interface WorkspaceSelectorProps {
  activeWorkspaceId: string;
  workspaces: any[];
  onChange: (id: string) => void;
}

const WorkspaceSelector: React.FC<WorkspaceSelectorProps> = ({ activeWorkspaceId, workspaces, onChange }) => {
  const { user } = useAuth();
  const current = workspaces?.find(w => w.id === activeWorkspaceId) || { name: `${user?.firstName || user?.username || "User"}'s Workspace`, id: activeWorkspaceId };
  const fallbackLetter = current.name?.[0]?.toUpperCase() || "M";
  // Always show at least the current workspace
  const displayWorkspaces = (workspaces && workspaces.length > 0)
    ? workspaces
    : [current];

  return (
    <div className="relative">
      <Listbox value={activeWorkspaceId} onChange={onChange}>
        {({ open }) => (
          <>
            <Listbox.Button className="flex items-center gap-3 bg-primary text-primary-foreground rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-1 focus:ring-primary/50 hover:opacity-90 transition-opacity workspace-selector-btn">
              <Avatar className="w-6 h-6">
                <AvatarImage src={user?.imageUrl} alt="User profile" />
                <AvatarFallback className="text-xs bg-muted text-muted-foreground border border-border/50 font-medium">
                  {fallbackLetter}
                </AvatarFallback>
              </Avatar>
              <span className="workspace-selector-text text-sm font-medium flex-1 truncate">{current.name}</span>
              <ChevronDown className="workspace-selector-arrow w-4 h-4 flex-shrink-0" />
            </Listbox.Button>
            {open && (
              <Listbox.Options className="absolute left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-50 py-1 max-h-60 overflow-auto">
                {displayWorkspaces.map((workspace: any) => (
                  <Listbox.Option
                    key={workspace.id}
                    value={workspace.id}
                    className={({ active, selected }) =>
                      `px-3 py-2 cursor-pointer flex items-center gap-2 text-sm ${
                        selected ? "font-medium bg-primary/10" : ""
                      } ${active ? "bg-muted" : ""}`
                    }
                  >
                    <span className="flex-1 truncate">{workspace.name}</span>
                    {workspace.id === activeWorkspaceId && (
                      <Check className="w-4 h-4 text-primary flex-shrink-0" />
                    )}
                  </Listbox.Option>
                ))}
              </Listbox.Options>
            )}
          </>
        )}
      </Listbox>
    </div>
  );
};

export default WorkspaceSelector; 