import React from "react";
import { LandingPageNavbar } from "./_components/navbar";
import { FoldersProvider } from '@/context/FoldersContext';

type Props = {
  children: React.ReactNode;
};

export default function WebsiteLayout({ children }: Props) {
  return (
      <div className="w-full flex flex-col py-10 pb-0 px-6 md:px-16 lg:px-32 bg-background text-foreground">
        <LandingPageNavbar />
        {children}
      </div>
  );
}
