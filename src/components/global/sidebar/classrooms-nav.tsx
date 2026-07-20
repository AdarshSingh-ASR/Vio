"use client";

import { GraduationCap } from "lucide-react";
import { usePathname } from "next/navigation";
import { SidebarItem } from "./sidebar.item";

export default function ClassroomsNav() {
  const pathname = usePathname();

  return (
    <SidebarItem
      title="Classrooms"
      href="/dashboard/classrooms"
      icon={<GraduationCap className="h-4 w-4" />}
      selected={pathname.startsWith("/dashboard/classrooms")}
    />
  );
}
