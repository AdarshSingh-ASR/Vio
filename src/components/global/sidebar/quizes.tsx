"use client";
import React from "react";
import { SidebarItem } from "./sidebar.item";
import { GraduationCap, Trophy, FileText, Headphones } from "lucide-react";
import { usePathname } from "next/navigation";

const Quizes = () => {
  const pathname = usePathname();

  return (
    <div className="mt-14">
      <h2 
        className="flex items-center gap-2 text-xs font-medium text-sidebar-foreground/60 px-3 mb-2 uppercase tracking-wide"
        title="Quizes"
      >
        <GraduationCap className="w-4 h-4" />
        Quizes
      </h2>
      <div className="space-y-0.5">
        <SidebarItem
          icon={<Trophy className="w-4 h-4" />}
          title="Quizes Taken"
          href="/dashboard/quizes/taken"
          selected={pathname === "/dashboard/quizes/taken"}
          className="ml-2"
        />
        <SidebarItem
          icon={<FileText className="w-4 h-4" />}
          title="Quiz"
          href="/dashboard/quizes/quiz"
          selected={pathname === "/dashboard/quizes/quiz"}
          className="ml-2"
        />
        <SidebarItem
          icon={<Headphones className="w-4 h-4" />}
          title="Listening Test"
          href="/dashboard/quizes/listening"
          selected={pathname === "/dashboard/quizes/listening"}
          className="ml-2"
        />
      </div>
    </div>
  );
};

export default Quizes; 