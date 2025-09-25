"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeWrapper({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const { theme, systemTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      const currentTheme = theme === "system" ? systemTheme : theme;
      document.documentElement.setAttribute("data-theme", currentTheme || "light");
    }
  }, [mounted, theme, systemTheme]);

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <div style={{ opacity: 0 }}>
        {children}
      </div>
    );
  }

  return <>{children}</>;
} 