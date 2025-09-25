import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme";
import { ThemeWrapper } from "@/components/theme/ThemeWrapper";
import { Toaster } from "@/components/ui/toaster";
import { geist, geistMono } from "./fonts";
import ReactQueryProvider from "./react-query";
import { ChatSheetProvider } from "@/context/ChatSheetContext";
import { AuthProvider } from "@/context/AuthContext";

export const metadata: Metadata = {
  title: "vio",
  description: "Your intelligent writing and research companion.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body className={`${geist.variable} ${geistMono.variable} font-sans`}>
        <ThemeProvider
          attribute="data-theme"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ThemeWrapper>
            <AuthProvider>
              <ReactQueryProvider>
                <ChatSheetProvider>
                  <div style={{ maxWidth: "100vw", boxSizing: "border-box" }}>{children}</div>
                </ChatSheetProvider>
              </ReactQueryProvider>
              <Toaster />
            </AuthProvider>
          </ThemeWrapper>
        </ThemeProvider>
      </body>
    </html>
  );
}
