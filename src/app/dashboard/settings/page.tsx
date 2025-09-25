"use client";
import { Suspense } from "react";
import SettingsContent from "@/components/global/sidebar/settings";

function SettingsPageContent() {
  return <SettingsContent />;
}

export default function SettingsPage() {
  return (
    <div className="p-6">
      <Suspense fallback={
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-32"></div>
          <div className="space-y-4">
            <div className="h-10 bg-muted rounded"></div>
            <div className="h-20 bg-muted rounded"></div>
          </div>
        </div>
      }>
        <SettingsPageContent />
      </Suspense>
    </div>
  );
} 