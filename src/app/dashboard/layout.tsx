import SidebarWrapper from "@/components/global/sidebar/SidebarWrapper";
import React from "react";
import InfoBar from "@/components/global/info-bar";
import { FoldersProvider } from '@/context/FoldersContext';
import { SidebarProvider } from '@/context/SidebarContext';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <FoldersProvider>
        <div className="flex h-screen w-screen bg-background text-foreground">
          <InfoBar />
          <SidebarWrapper />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </FoldersProvider>
    </SidebarProvider>
  );
}