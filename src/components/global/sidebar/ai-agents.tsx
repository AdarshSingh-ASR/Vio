"use client";
import React, { Suspense } from "react";
import { SidebarItem } from "./sidebar.item";
import { Brain, BookOpen, Search, Target } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";

const AIAgentsContent = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab');

  return (
    <div className="mt-14">
      <h2 
        className="flex items-center gap-2 text-xs font-medium text-sidebar-foreground/60 px-3 mb-2 uppercase tracking-wide"
        title="AI Agents"
      >
        <Brain className="w-4 h-4" />
        AI Agents
      </h2>
      <div className="space-y-0.5">
        <SidebarItem
          icon={<BookOpen className="w-4 h-4" />}
          title="Learning Path Generator"
          href="/dashboard/agents"
          selected={pathname === "/dashboard/agents" && (!currentTab || currentTab === 'learning-path')}
          className="ml-2"
        />
        <SidebarItem
          icon={<Search className="w-4 h-4" />}
          title="Research Assistant"
          href="/dashboard/agents?tab=research"
          selected={pathname === "/dashboard/agents" && currentTab === 'research'}
          className="ml-2"
        />
        <SidebarItem
          icon={<Target className="w-4 h-4" />}
          title="Study Orchestrator"
          href="/dashboard/agents?tab=study-session"
          selected={pathname === "/dashboard/agents" && currentTab === 'study-session'}
          className="ml-2"
        />
      </div>
    </div>
  );
};

const AIAgents = () => {
  return (
    <Suspense fallback={
      <div className="mt-14">
        <h2 
          className="flex items-center gap-2 text-xs font-medium text-sidebar-foreground/60 px-3 mb-2 uppercase tracking-wide"
          title="AI Agents"
        >
          <Brain className="w-4 h-4" />
          AI Agents
        </h2>
        <div className="space-y-0.5">
          <div className="h-8 bg-muted/20 rounded mx-2 animate-pulse"></div>
          <div className="h-8 bg-muted/20 rounded mx-2 animate-pulse"></div>
          <div className="h-8 bg-muted/20 rounded mx-2 animate-pulse"></div>
        </div>
      </div>
    }>
      <AIAgentsContent />
    </Suspense>
  );
};

export default AIAgents;
