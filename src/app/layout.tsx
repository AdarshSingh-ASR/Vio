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
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: "Vio — AI learning with teachers in control",
  description: "An evidence-grounded AI education workspace for classrooms, assignments, study agents, and human-reviewed feedback.",
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Vio",
    title: "Vio — AI learning with teachers in control",
    description: "Turn learning material into grounded answers, study workflows, and teacher-reviewed classroom feedback.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Vio AI education workspace landing page" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Vio — AI learning with teachers in control",
    description: "Grounded learning tools and human-reviewed classroom feedback in one workspace.",
    images: ["/opengraph-image"],
  },
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
