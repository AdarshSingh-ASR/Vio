import { getWorkspaces } from "@/actions/workspace";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";

import React from "react";

type Props = {
  params: { workspaceId: string };
};

const Page = async ({ params }: Props) => {
  const { workspaceId } = params;
  const query = new QueryClient();

  return (
    <HydrationBoundary state={dehydrate(query)}>
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-lg">
        <h1 className="text-2xl font-bold text-foreground mb-4">Workspace</h1>
        <p>Use the sidebar to navigate to your saved items and folders.</p>
      </div>
    </HydrationBoundary>
  );
};

export default Page;
