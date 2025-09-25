"use client";
import React, { createContext, useContext, useState } from "react";

const ChatSheetContext = createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
}>({ open: false, setOpen: () => {} });

export const ChatSheetProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState(false);
  return (
    <ChatSheetContext.Provider value={{ open, setOpen }}>
      {children}
    </ChatSheetContext.Provider>
  );
};

export const useChatSheet = () => useContext(ChatSheetContext); 