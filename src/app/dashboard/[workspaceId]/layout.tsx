import { getWorkspaces, verifyWorkspaceAccess } from "@/actions/workspace";
import { redirect } from "next/navigation";
import React from "react";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import InfoBar from "@/components/global/info-bar";
import SidebarWrapper from "@/components/global/sidebar/SidebarWrapper";
import { FoldersProvider } from '@/context/FoldersContext';
import { SidebarProvider } from '@/context/SidebarContext';

type DashboardLayoutProps = {
  params: { workspaceId: string };
  children: React.ReactNode;
};

async function fetchItems() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/dashboard/items`, {
    headers: { 'cookie': '' },
    cache: 'no-store',
  });
  if (!res.ok) return [];
  return res.json();
}

export default async function DashboardLayout({
  params,
  children,
}: DashboardLayoutProps) {
  const { workspaceId } = await params;

  const hasAccess = await verifyWorkspaceAccess(workspaceId);
  if (hasAccess.status != 200) redirect("/auth/sign-in");
  if (!hasAccess.data) return null;

  const query = new QueryClient();

  await query.prefetchQuery({
    queryKey: ["user-workspaces"],
    queryFn: () => getWorkspaces(),
  });

  await query.prefetchQuery({
    queryKey: ["dashboard-items"],
    queryFn: fetchItems,
  });

  return (
    <HydrationBoundary state={dehydrate(query)}>
      <SidebarProvider>
        <FoldersProvider>
      <div className="flex h-screen w-screen bg-background text-foreground">
        <InfoBar />
            <SidebarWrapper />
        <div className="w-full pt-28 p-6 overflow-y-scroll overflow-x-hidden">
          <div className="flex-1 overflow-y-auto">{children}</div>
        </div>
      </div>
        </FoldersProvider>
      </SidebarProvider>
    </HydrationBoundary>
  );
}
