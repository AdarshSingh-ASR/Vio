"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserButton } from "@/components/auth/UserButton";
import { Search, UploadIcon, Video, Send } from "lucide-react";
import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import Image from "next/image";
import vioLogo from "@/assets/images/vio.svg";
import vector from "@/assets/images/Vector.svg";
import { useChatSheet } from "@/context/ChatSheetContext";
import { useSidebarSheet } from "@/context/SidebarContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/context/AuthContext";
import { usePathname } from "next/navigation";
import CustomChatSidebar from "./CustomChatSidebar";

// Define DashboardItem type for contextItems
type DashboardItem = {
  $id?: string;
  id?: string;
  name?: string;
  displayName?: string;
  url?: string;
  extractedContent?: string;
};

// Helper function to get the correct ID from an item
const getItemId = (item: DashboardItem): string => {
  return item.$id || item.id || '';
};

// Define message type for better type safety
type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt?: Date;
};

// Custom Chat Interface Component
const ChatInterface = () => {
  return <CustomChatSidebar />;
};

const InfoBar = () => {
  const { open, setOpen } = useChatSheet();
  const { sidebarOpen } = useSidebarSheet();
  const { user } = useAuth();
  const isMobile = useIsMobile();  
  const [sheetWidth, setSheetWidth] = useState(350); // px, default width
  const resizing = useRef(false);
  const pathname = usePathname();
  const allowClose = useRef(false);

  // Create a consistent chat ID for the user that works for both authenticated and anonymous users
  const chatId = user?.id ? `vio-chat-${user.id}` : 'vio-chat-session';

  // Custom handler to prevent unwanted closing
  const handleOpenChange = (newOpen: boolean) => {
    // If trying to close but we haven't explicitly allowed it, prevent it
    if (!newOpen && !allowClose.current) {
      return;
    }
    
    // Reset the flag
    allowClose.current = false;
    setOpen(newOpen);
  };

  // Function to explicitly close the sheet
  const closeSheet = useCallback(() => {
    allowClose.current = true;
    setOpen(false);
  }, [setOpen]);

  // Handle mouse drag for resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (resizing.current) {
        const minWidth = 250;
        const maxWidth = 600;
        const newWidth = Math.min(maxWidth, Math.max(minWidth, window.innerWidth - e.clientX));
        setSheetWidth(newWidth);
      }
    };
    const handleMouseUp = () => {
      resizing.current = false;
    };
    if (resizing.current) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [open]);

  // Add a class to body or root to shift content when sheet is open
  useEffect(() => {
    if (open) {
      document.body.style.setProperty('--chat-sheet-width', `${sheetWidth}px`);
      document.body.classList.add('sheet-open');
    } else {
      document.body.style.removeProperty('--chat-sheet-width');
      document.body.classList.remove('sheet-open');
    }
  }, [open, sheetWidth]);

  // Add keyboard shortcuts and prevent unwanted closing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + I to toggle chat
      if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
        e.preventDefault();
        if (open) {
          closeSheet();
        } else {
          setOpen(true);
        }
        return;
      }
      
      // Escape to close chat (only if open)
      if (e.key === 'Escape' && open) {
        closeSheet();
        return;
      }
    };

    // Prevent sheet from closing when clicking on main content
    const handleMouseDown = (e: MouseEvent) => {
      // Only handle if sheet is open
      if (!open) return;
      
      const target = e.target as Element;
      
      // Check if click is on the sheet itself or its children
      const sheetElement = document.querySelector('[data-radix-dialog-content]') || 
                          document.querySelector('.chat-sheet-content') ||
                          document.querySelector('[role="dialog"]');
      
      // If clicking on the sheet or its children, don't interfere
      if (sheetElement && (sheetElement.contains(target) || sheetElement === target)) {
        return;
      }
      
      // Check if click is on chat-related elements
      const isChatElement = target.closest('.chat-sheet-content') ||
                           target.closest('[data-radix-dialog-content]') ||
                           target.closest('.copilot-kit-wrapper') ||
                           target.closest('.context-modal') ||
                           target.closest('.context-overlay');
      
      // If clicking on chat elements, don't close
      if (isChatElement) {
        return;
      }
      
      // For any other clicks (main content), ensure sheet stays open
      // This prevents the sheet from closing when interacting with dashboard content
      e.stopPropagation();
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown, { capture: true });
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown, { capture: true });
    };
  }, [open, setOpen, closeSheet]);

  // Hide InfoBar when in quizes section - after all hooks are called
  if (pathname?.startsWith('/dashboard/quizes')) {
    return null;
  }


  return (
    <header className="fixed z-[200] p-3 w-full flex items-center gap-4">
      {/* Left space for menu icon on mobile */}
      <div className="w-12 md:w-[265px]" />
      {/* Spacer to push actions to the right */}
      <div className="flex-1" />
      {/* Fixed width actions section, right-aligned - Hide when sidebar is open on mobile only */}
      {!open && !(sidebarOpen && isMobile) && (
        <div className="flex items-center gap-3 flex-shrink-0 mr-3">
          {/* AI Chat Button */}
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-primary hover:bg-primary/90 px-3 py-2 text-primary-foreground text-sm font-medium relative focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
          >
            <span>AI</span>
            <span className="ml-1 px-1.5 py-0.5 rounded border border-primary-foreground/20 text-primary-foreground/70 text-xs font-mono bg-primary-foreground/10">⌘I</span>
          </button>
          <div className="flex items-center">
            <UserButton />
          </div>
        </div>
      )}
      {/* Chat Sidebar Sheet */}
      <Sheet open={open} onOpenChange={handleOpenChange} modal={false}>
        <SheetContent
          side="right"
          className="p-0 bg-card flex flex-col h-full shadow-xl overflow-hidden chat-sheet-content"
          style={{ width: sheetWidth, maxWidth: 600, minWidth: 250 }}
          noOverlay={true}
          data-chat-sheet="true"
        >
          {/* Custom Chat Header with Vio logo */}
          <div className="flex items-center gap-2 px-6 py-4 bg-card border-b border-border flex-shrink-0" style={{ minHeight: 60 }}>
            <Image src={vioLogo} alt="vio" width={64} height={32} />
            <button onClick={closeSheet} className="ml-auto text-muted-foreground hover:text-primary text-2xl font-bold">&times;</button>
          </div>
          
          {/* Custom Chat Interface */}
          <div className="flex-1 min-h-0 overflow-hidden mb-1">
                <ChatInterface />
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
};

export default InfoBar;
