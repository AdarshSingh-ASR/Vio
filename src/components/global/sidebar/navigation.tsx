"use client";

import React from "react";
import { SidebarItem } from "./sidebar.item";
import { usePathname } from "next/navigation";
import { Home, Search } from "lucide-react";

const Navigation = () => {
  const pathname = usePathname();
  
  // Home should be selected for dashboard root and item pages
  const isHomeSelected = pathname === "/dashboard" || pathname.startsWith("/dashboard/item");
  
  return (
    <div className="flex flex-col gap-1 mb-4">
      <SidebarItem
        title="Home"
        href="/dashboard"
        icon={<Home className="w-4 h-4" />}
        selected={isHomeSelected}
      />
      <SidebarItem
        title="Search"
        href="/dashboard/search"
        icon={<Search className="w-4 h-4" />}
        selected={pathname === "/dashboard/search"}
      />
    </div>
  );
};

export default Navigation; 