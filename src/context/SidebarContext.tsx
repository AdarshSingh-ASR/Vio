"use client";
import React, { createContext, useContext, useState } from "react";

const SidebarContext = createContext<{
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}>({ sidebarOpen: false, setSidebarOpen: () => {} });

export const SidebarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <SidebarContext.Provider value={{ sidebarOpen, setSidebarOpen }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebarSheet = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebarSheet must be used within a SidebarProvider");
  }
  return context;
}; 