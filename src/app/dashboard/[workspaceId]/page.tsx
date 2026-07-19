import { getWorkspaces } from "@/actions/workspace";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";

import React from "react";

type Props = {
  params: Promise<{ workspaceId: string }>;
};

const Page = async (props: Props) => {
  const params = await props.params;
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
