"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';

interface Folder {
  $id: string;
  name: string;
  userId: string;
  createdAt: string;
}

interface FoldersContextType {
  folders: Folder[];
  loading: boolean;
  refreshFolders: () => Promise<void>;
  setLoading: (val: boolean) => void;
}

const FoldersContext = createContext<FoldersContextType | undefined>(undefined);

export const FoldersProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const { getAuthenticatedFetch, isSignedIn } = useAuth();

  const refreshFolders = useCallback(async () => {
    if (!isSignedIn) {
      setFolders([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const authenticatedFetch = getAuthenticatedFetch();
      const res = await authenticatedFetch('/api/dashboard/folders');
      if (res.ok) {
        setFolders(await res.json());
      } else {
        console.error('Failed to fetch folders:', res.status, res.statusText);
        setFolders([]);
      }
    } catch (error) {
      console.error('Error fetching folders:', error);
      setFolders([]);
    } finally {
      setLoading(false);
    }
  }, [getAuthenticatedFetch, isSignedIn]);

  useEffect(() => {
    refreshFolders();
  }, [refreshFolders]);

  return (
    <FoldersContext.Provider value={{ folders, loading, refreshFolders, setLoading }}>
      {children}
    </FoldersContext.Provider>
  );
};

export const useFolders = () => {
  const ctx = useContext(FoldersContext);
  if (!ctx) throw new Error('useFolders must be used within a FoldersProvider');
  return ctx;
}; 