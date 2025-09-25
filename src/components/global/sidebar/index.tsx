"use client";

import React from "react";
import { Menu, Settings as SettingsIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { getWorkspaces } from "@/actions/workspace";
import { WorkspaceProps } from "@/types/index-types";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import WorkspaceSelector from "@/components/global/sidebar/workspace-selector";
import Navigation from "@/components/global/sidebar/navigation";
import Folders from "@/components/global/sidebar/folders";
import Quizes from "@/components/global/sidebar/quizes";
import AIAgents from "@/components/global/sidebar/ai-agents";
import VideoGeneratorNav from "@/components/global/sidebar/video-generator-nav";
import { useQuery } from '@tanstack/react-query';
import { useAuth } from "@/context/AuthContext";
import { SidebarItem } from "./sidebar.item";
import { useChatSheet } from "@/context/ChatSheetContext";
import { useSidebarSheet } from "@/context/SidebarContext";


type Props = {
  activeWorkspaceId: string;
};

export default function Sidebar({ activeWorkspaceId }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { getAuthenticatedFetch } = useAuth();
  const { open: chatSheetOpen } = useChatSheet();
  const { sidebarOpen, setSidebarOpen } = useSidebarSheet();

  // Fetch all workspaces
  const { data: workspaces = [], isLoading: workspacesLoading } = useQuery({
    queryKey: ["workspaces"],
    queryFn: async () => {
      try {
        const authenticatedFetch = getAuthenticatedFetch();
        const res = await authenticatedFetch("/api/workspaces");
        if (!res.ok) return [];
        return res.json();
      } catch (error) {
        console.error('Error fetching workspaces:', error);
        return [];
      }
    },
  });

  const onChangeActiveWorkspace = (value: string) => {
    router.push(`/dashboard/${value}`);
  };

  const currentWorkspace = workspaces?.find(
    (workspace: any) => workspace.id === activeWorkspaceId
  );

  const SidebarSection = (
    <div className="bg-sidebar text-sidebar-foreground flex-none relative p-0 h-full w-[260px] flex flex-col border-r border-sidebar-border z-50">
      {workspacesLoading ? (
        <div className="flex items-center justify-center w-full py-6">
          <div className="animate-spin rounded-full h-4 w-4 border border-sidebar-foreground/20 border-t-sidebar-foreground" />
        </div>
      ) : (
        <div className="px-3 py-4">
        <WorkspaceSelector
          activeWorkspaceId={activeWorkspaceId}
          workspaces={workspaces}
          onChange={onChangeActiveWorkspace}
        />
        </div>
      )}
      <div className="flex-1 flex flex-col justify-between px-2">
        <div className="flex-1 space-y-1">
          <Navigation />
          <Folders />
          <Quizes />
          <AIAgents />
          <VideoGeneratorNav />
        </div>
        <div className="pb-3 pt-2">
          <SidebarItem
            title="Settings"
            href="/dashboard/settings"
            icon={<SettingsIcon className="w-4 h-4" />}
            selected={pathname === "/dashboard/settings"}
          />
        </div>
      </div>
    </div>
  );

  return (
    <div>
      {/* Sheet mobile and desktop - Hide when AI chat sheet is open */}
      {!chatSheetOpen && (
        <div className="md:hidden fixed top-4 left-4 z-[250]">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant={"ghost"} size="sm" className="p-2 bg-card border border-border shadow-lg hover:bg-muted">
                <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side={"left"} className="p-0 w-fit h-full">
            {SidebarSection}
          </SheetContent>
        </Sheet>
      </div>
      )}
      {/* Desktop sidebar */}
      <div className="hidden md:block h-full">{SidebarSection}</div>
    </div>
  );
}
