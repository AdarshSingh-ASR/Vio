"use client";

import { usePathname } from "next/navigation";
import React from "react";
import { WorkspaceProps } from "@/types/index-types";

type Props = {
  workspaces: WorkspaceProps[];
  workspace: WorkspaceProps;
};

const GlobalHeader = ({ workspace }: Props) => {
  const pathName = usePathname().split(`/dashboard/${workspace.id}`)[1];

  // Helper function to get the header title
  const getHeaderTitle = () => {
    if (!pathName) return "Dashboard";

    if (pathName.includes("settings")) {
      return "Settings";
    }

    // Default to first character uppercase + rest lowercase
    return pathName.charAt(1).toUpperCase() + pathName.slice(2).toLowerCase();
  };

  return (
    <article className="flex flex-col gap-2">
      <span className="text-[#676CFF] text-xs">WORKSPACE</span>
      <h1 className="text-4xl font-bold">{getHeaderTitle()}</h1>
    </article>
  );
};

export default GlobalHeader;
