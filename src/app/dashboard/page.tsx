'use client';
import React, { useEffect, useState, ChangeEvent, FormEvent, useRef, useCallback, useMemo, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trash, MoreVertical, X, Loader2, Pencil, Star, FolderPlus, ArrowUp, ArrowDown, Upload } from 'lucide-react';
import { AiFillFilePdf, AiFillFileWord, AiFillHtml5, AiFillFileImage, AiFillFileText, AiFillFile } from 'react-icons/ai';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useFolders } from '@/context/FoldersContext';
import { useRouter } from 'next/navigation';
import { useAuth } from "@/context/AuthContext";
import { clearOldJWTFormat } from '@/lib/appwrite-client';

interface DashboardItem {
  $id?: string;
  id?: string;
  type: 'file' | 'link';
  name?: string;
  displayName?: string;
  title?: string;
  url?: string;
  content?: string;
  extractedContent?: string;
  contentType?: string;
  previewUrl?: string;
  favorite: boolean;
  fileType?: string;
}

// Helper to get file type label and icon
const getFileTypeInfo = (fileType: string = '', name: string = '') => {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (fileType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) return { label: 'Image', icon: AiFillFileImage };
  if (fileType === 'application/pdf' || ext === 'pdf') return { label: 'PDF', icon: AiFillFilePdf };
  if (fileType === 'application/msword' || fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || ['doc', 'docx'].includes(ext)) return { label: 'Word', icon: AiFillFileWord };
  if (fileType === 'text/html' || ext === 'html') return { label: 'HTML', icon: AiFillHtml5 };
  if (fileType.startsWith('text/') || ['txt', 'md', 'csv'].includes(ext)) return { label: 'Text', icon: AiFillFileText };
  return { label: ext ? ext.toUpperCase() : 'File', icon: AiFillFile };
};

// Helper to get file name before last dot
const getFileBaseName = (name: string = '') => {
  if (!name) return 'Untitled file';
  const lastDot = name.lastIndexOf('.');
  return lastDot > 0 ? name.substring(0, lastDot) : name;
};

// Helper to get file extension after last dot
const getFileExtension = (name: string = ''): string => {
  if (!name) return '';
  const lastDot = name.lastIndexOf('.');
  return lastDot > 0 ? name.substring(lastDot + 1) : '';
};

const DashboardPageContent = () => {
  const [input, setInput] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [hovered, setHovered] = useState<string | null>(null);
  const [showMenuId, setShowMenuId] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState<'none' | 'select' | 'addToFolder'>('none');
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folders, setFolders] = useState<any[]>([]);
  const [folderLoading, setFolderLoading] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [createNew, setCreateNew] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [renameItemId, setRenameItemId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>('');
  const [renameLoading, setRenameLoading] = useState(false);
  const [sortBy, setSortBy] = useState<'favourite' | 'latest' | 'oldest' | 'name'>('latest');
  const [sortAsc, setSortAsc] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [sheetWidth, setSheetWidth] = useState(0);
  const { user, isLoading, getAuthenticatedFetch, clearJWTCache } = useAuth();
  const isSignedIn = !!user;
  const router = useRouter();

  // Create authenticated fetch function with useMemo to prevent recreating on every render
  const authFetch = useMemo(() => getAuthenticatedFetch(), [getAuthenticatedFetch]);

  const fetchUser = useCallback(async () => {
    try {
      const res = await authFetch('/api/user');
      if (!res.ok) return null;
      return res.json();
    } catch (error) {
      console.error('fetchUser error:', error);
      return null;
    }
  }, [authFetch]);

  const fetchItems = useCallback(async (): Promise<DashboardItem[]> => {
    try {
      const res = await authFetch('/api/dashboard/items?workspaceId=default');
      if (!res.ok) return [];
      const data = await res.json();
      return data.items || [];
    } catch (error) {
      console.error('fetchItems error:', error);
      return [];
    }
  }, [authFetch]);

  const { data: userData, isLoading: userLoading } = useQuery({
    queryKey: ['user'],
    queryFn: fetchUser,
  });
  const { data: itemsData = [], isLoading: itemsLoading, refetch } = useQuery({
    queryKey: ['dashboard-items'],
    queryFn: fetchItems,
  });

  const username = user?.firstName || user?.username || 'User';

  const { refreshFolders, setLoading: setFoldersLoading } = useFolders();

  // Initialize and clear old JWT format on mount
  useEffect(() => {
    clearOldJWTFormat();
  }, []);

  useEffect(() => {
    if (itemsData && Array.isArray(itemsData)) {
      setFavorites(new Set(itemsData.filter(i => i.favorite && i.id).map(i => i.id as string)));
    }
  }, [itemsData]);

  useEffect(() => {
    if (open) {
      document.body.style.setProperty('--chat-sheet-width', `${sheetWidth}px`);
      document.body.classList.add('sheet-open');
    } else {
      document.body.style.removeProperty('--chat-sheet-width');
      document.body.classList.remove('sheet-open');
    }
  }, [open, sheetWidth]);

  const supportedTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp',
    'video/mp4', 'video/webm', 'video/quicktime',
    'application/pdf',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv',
  ];
  const supportedExts = [
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp',
    'mp4', 'webm', 'mov',
    'pdf',
    'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
    'txt', 'csv',
  ];

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    
    try {
      const formData = new FormData();
      if (file) formData.append('file', file);
      if (input) formData.append('link', input);
      
      const res = await authFetch('/api/dashboard/upload', {
        method: 'POST',
        body: formData,
        headers: {}
      });
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data?.error || 'Could not upload file or link.');
        setLoading(false);
        return;
      }
      
      const result = await res.json();
      console.log('Upload successful:', result);
      
      setInput('');
      setFile(null);
      const fileInput = document.getElementById('file-upload') as HTMLInputElement | null;
      if (fileInput) fileInput.value = '';
      refetch();
      setLoading(false);
    } catch (error) {
      console.error('Upload error:', error);
      setErrorMsg('Upload failed. Please try again.');
      setLoading(false);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    setErrorMsg(null);
    if (selectedFile) {
      const ext = selectedFile.name.split('.').pop()?.toLowerCase() || '';
      if (!supportedExts.includes(ext) || !supportedTypes.includes(selectedFile.type)) {
        setErrorMsg('Unsupported file type. Please upload a valid image, video, PDF, Office doc, or text file.');
        setFile(null);
        e.target.value = '';
        return;
      }
      setFile(selectedFile);
      setInput('');
    } else {
      setFile(null);
    }
  };

  const handleFavorite = async (id: string) => {
    const isFav = favorites.has(id);
    setFavorites(prev => {
      const newSet = new Set(prev);
      isFav ? newSet.delete(id) : newSet.add(id);
      return newSet;
    });
    await authFetch(`/api/dashboard/items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ favorite: !isFav }),
    });
    refetch();
  };

  const handleSelectAll = () => {
    const itemsLength = itemsData?.length || 0;
    if (selected.size === itemsLength) {
      setSelected(new Set());
      setSelectMode('none');
    } else {
      setSelected(new Set((itemsData || []).filter(i => i.$id || i.id).map(i => (i.$id || i.id) as string)));
      setSelectMode('select');
    }
  };

  const handleSelect = (id: string) => {
    setSelected(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      if (newSet.size === 0) setSelectMode('none');
      else setSelectMode('select');
      return newSet;
    });
  };

  const handleAddToFolder = () => {
    setSelectMode('addToFolder');
    setShowFolderModal(true);
    setCreateNew(false);
    setSelectedFolderId(null);
    setNewFolderName('');
    fetchFolders();
  };

  const handleCancelSelect = () => {
    setSelectMode('none');
    setSelected(new Set());
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await authFetch(`/api/dashboard/items/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error('Failed to delete item');
      }
    setDeleteItemId(null);
    refetch();
    } catch (error) {
      console.error('Error deleting item:', error);
      setErrorMsg('Failed to delete item. Please try again.');
    }
  };

  const handleDeleteSelected = async () => {
    try {
      // Delete items sequentially to avoid rate limiting
      for (const id of Array.from(selected)) {
        await authFetch(`/api/dashboard/items/${id}`, { method: 'DELETE' });
        // Small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    setSelected(new Set());
    refetch();
    } catch (error) {
      console.error('Error deleting items:', error);
      setErrorMsg('Failed to delete some items. Please try again.');
    }
  };

  const handleRename = async (id: string) => {
    setRenameLoading(true);
    await authFetch(`/api/dashboard/items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: renameValue }),
    });
    setRenameItemId(null);
    setRenameValue('');
    setRenameLoading(false);
    refetch();
  };

  const fetchFolders = async () => {
    setFolderLoading(true);
    const res = await authFetch('/api/dashboard/folders');
    if (res.ok) {
      setFolders(await res.json());
    }
    setFolderLoading(false);
  };

  const handleFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFoldersLoading(true);
    if (createNew && newFolderName.trim()) {
      await authFetch('/api/dashboard/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFolderName.trim(), itemIds: Array.from(selected) }),
      });
    } else if (selectedFolderId) {
      await authFetch('/api/dashboard/folders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId: selectedFolderId, itemIds: Array.from(selected) }),
      });
    }
    setSaving(false);
    setShowFolderModal(false);
    setSelectMode('none');
    setSelected(new Set());
    await refreshFolders();
    setFoldersLoading(false);
    refetch();
  };

  const sortedItems = React.useMemo(() => {
    if (!itemsData || !Array.isArray(itemsData)) return [];
    let sorted = [...itemsData];
    if (sortBy === 'favourite') {
      sorted.sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0));
    } else if (sortBy === 'latest') {
      sorted.sort((a, b) => (b.id || '').localeCompare(a.id || ''));
    } else if (sortBy === 'oldest') {
      sorted.sort((a, b) => (a.id || '').localeCompare(b.id || ''));
    } else if (sortBy === 'name') {
      sorted.sort((a, b) => (a.displayName || a.name || '').localeCompare(b.displayName || b.name || ''));
    }
    if (sortAsc) sorted.reverse();
    return sorted;
  }, [itemsData, sortBy, sortAsc]);

  const menuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!showMenuId) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMenuId]);

  if (userLoading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Not Authenticated</h1>
          <p>Please sign in to access the dashboard.</p>
        </div>
      </div>
    );
  }

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "Good Morning";
    if (hour >= 12 && hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const showBulkBar = selectMode !== 'none' && selected.size > 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-2xl font-normal text-muted-foreground mb-2">
            {getGreeting()}, {username}
          </h1>
        </div>

        {/* Upload Form */}
        <form onSubmit={handleSubmit} className="mb-12 flex justify-center">
          <div className="relative max-w-2xl w-full">
        <input
          type="text"
              placeholder="Paste URL or upload a file"
              className="w-full px-4 py-3 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors pr-32 dashboard-upload-input"
          value={file ? file.name : input}
          onChange={e => {
            setInput(e.target.value);
            setFile(null);
          }}
        />
        <input
          id="file-upload"
          type="file"
          className="hidden"
          onChange={handleFileChange}
        />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2 dashboard-input-actions">
        <label
          htmlFor="file-upload"
                className="cursor-pointer p-1.5 text-muted-foreground hover:text-foreground transition-colors dashboard-upload-label"
        >
                <Upload size={16} />
        </label>
        <button
          type="submit"
                className="px-4 py-1.5 text-sm bg-primary text-primary-foreground rounded-md font-medium disabled:opacity-50 hover:opacity-90 transition-opacity dashboard-save-btn"
          disabled={loading}
        >
          {loading ? 'Saving...' : 'Save'}
        </button>
            </div>
          </div>
      </form>

        {/* Error Message */}
      {errorMsg && (
          <div className="max-w-2xl mx-auto mb-6 p-3 bg-destructive/10 text-destructive text-sm rounded-lg border border-destructive/20">
            <div className="flex items-center justify-between">
              <span>{errorMsg}</span>
              <button onClick={() => setErrorMsg(null)} className="ml-2 text-destructive/70 hover:text-destructive">
                <X size={14} />
              </button>
            </div>
        </div>
      )}

        {/* Bulk Actions */}
      {selected.size > 0 && (
          <div className="flex justify-between items-center mb-6">
            <span className="text-sm text-muted-foreground">
              {selected.size} item{selected.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center gap-2">
          <button
                onClick={handleSelectAll}
                className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-md hover:bg-muted transition-colors"
              >
                {selected.size === (itemsData?.length || 0) ? 'Deselect All' : 'Select All'}
          </button>
          <button
            onClick={handleCancelSelect}
                className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-md hover:bg-muted transition-colors"
          >
                Cancel
          </button>
          <button
                onClick={handleAddToFolder}
                className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
          >
                Add to Folder
          </button>
              {selectMode === 'select' && (
            <button
              onClick={() => setShowBulkDeleteConfirm(true)}
              className="px-3 py-1.5 text-xs text-destructive border border-destructive/20 rounded-md hover:bg-destructive/10 transition-colors"
            >
              Delete
            </button>
          )}
            </div>
        </div>
      )}

        {/* Sort Controls */}
        <div className="flex justify-between items-center mb-6">
          <div></div>
        <div className="relative">
          <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
              Sort by {sortBy}
              {sortAsc ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
          </button>
          {showSortMenu && (
              <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg z-10 min-w-32">
                <button className={`block w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors ${sortBy === 'favourite' ? 'font-medium' : ''}`} onClick={() => { setSortBy('favourite'); setShowSortMenu(false); }}>Favourite</button>
                <button className={`block w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors ${sortBy === 'latest' ? 'font-medium' : ''}`} onClick={() => { setSortBy('latest'); setShowSortMenu(false); }}>Latest</button>
                <button className={`block w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors ${sortBy === 'oldest' ? 'font-medium' : ''}`} onClick={() => { setSortBy('oldest'); setShowSortMenu(false); }}>Oldest</button>
                <button className={`block w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors ${sortBy === 'name' ? 'font-medium' : ''}`} onClick={() => { setSortBy('name'); setShowSortMenu(false); }}>Name</button>
                <div className="border-t border-border">
                  <button className="block w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors" onClick={() => { setSortAsc(!sortAsc); }}>
                    {sortAsc ? 'Descending' : 'Ascending'}
                  </button>
                </div>
            </div>
          )}
        </div>
      </div>

        {/* Items Grid */}
      {itemsLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="text-sm text-muted-foreground">Loading...</div>
          </div>
      ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sortedItems.map((item, idx) => {
              const id = item.$id || item.id || String(idx);
            const isSelected = selected.has(id);
            return (
              <div
                key={id}
                  className={`group relative bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-all cursor-pointer ${
                    isSelected ? 'ring-1 ring-primary border-primary bg-primary/5' : ''
                  }`}
                onClick={() => router.push(`/dashboard/item/${id}`)}
                onMouseEnter={() => setHovered(id)}
                  onMouseLeave={() => setHovered(null)}
              >
                  {/* Selection Checkbox */}
                {(selectMode !== 'none' || hovered === id) && (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleSelect(id)}
                      className="absolute top-3 left-3 w-4 h-4 accent-primary cursor-pointer z-10"
                    onClick={e => { e.stopPropagation(); setSelectMode('select'); }}
                  />
                )}

                  {/* Menu Button */}
                  <div className="absolute top-3 right-3 z-10">
                  <button
                      className={`p-1 rounded-md bg-card border border-border hover:bg-muted transition-colors ${
                        showMenuId === id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}
                    onClick={e => { e.stopPropagation(); setShowMenuId(id === showMenuId ? null : id); }}
                  >
                      <MoreVertical size={14} />
                  </button>
                  {showMenuId === id && (
                    <div
                      ref={menuRef}
                        className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg z-20 min-w-36"
                      onClick={e => e.stopPropagation()}
                    >
                      <button
                        onClick={() => { handleFavorite(id); setShowMenuId(null); }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-muted transition-colors"
                      >
                          <Star size={12} />
                        {favorites.has(id) ? 'Unfavorite' : 'Favorite'}
                      </button>
                      <button
                        onClick={() => setRenameItemId(id)}
                          className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-muted transition-colors"
                      >
                          <Pencil size={12} />
                          Rename
                      </button>
                      <button
                        onClick={() => {
                          setSelected(new Set([id]));
                          handleAddToFolder();
                          setShowMenuId(null);
                        }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-muted transition-colors"
                        >
                          <FolderPlus size={12} />
                          Add to Folder
                        </button>
                        <div className="border-t border-border">
                          <button
                            onClick={() => setDeleteItemId(id)}
                            className="flex items-center gap-2 w-full px-3 py-2 text-xs text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            <Trash size={12} />
                            Delete
                      </button>
                        </div>
                    </div>
                  )}
                </div>

                  {/* Content */}
                {item.type === 'file' && (
                  <>
                      {(item.fileType?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(getFileExtension(item.name).toLowerCase())) && item.url ? (
                        <img src={item.url} alt={item.name || 'file'} className="rounded-md w-full h-32 object-cover mb-3" />
                    ) : (
                        <div className="flex items-center justify-center w-full h-32 bg-muted rounded-md mb-3">
                        {(() => {
                          const { icon: Icon } = getFileTypeInfo(item.fileType, item.name || '');
                            return Icon ? <Icon className="w-8 h-8 text-muted-foreground" /> : null;
                        })()}
                      </div>
                    )}
                      <h3 className="font-medium text-sm truncate mb-1">{getFileBaseName(item.displayName || item.name)}</h3>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      {(() => {
                        const { icon: Icon, label } = getFileTypeInfo(item.fileType, item.name || '');
                          return Icon ? <><Icon className="w-3 h-3" /><span>{label}</span></> : null;
                      })()}
                    </div>
                  </>
                )}
                {item.type === 'link' && (
                  <>
                      <div className="relative w-full h-32 bg-muted rounded-md mb-3 overflow-hidden">
                        {item.content ? (
                          <img 
                            src={item.content}
                            alt={item.title || 'link preview'}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const parent = target.parentElement;
                              if (parent) {
                                parent.innerHTML = '<div class="flex items-center justify-center w-full h-full"><div class="text-xs text-muted-foreground">Link</div></div>';
                              }
                            }}
                          />
                        ) : (
                          <div className="flex items-center justify-center w-full h-full">
                            <div className="text-xs text-muted-foreground">Link</div>
                          </div>
                        )}
                      </div>
                      <h3 className="font-medium text-sm truncate mb-1">{item.title || item.displayName || item.name || 'Untitled Link'}</h3>
                      <p className="text-xs text-muted-foreground truncate">{item.url}</p>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
      </div>

      {/* Modals */}
      <Dialog open={showFolderModal} onOpenChange={setShowFolderModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-sm font-medium">Add to Folder</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleFolderSubmit} className="flex flex-col gap-3">
            {!createNew ? (
              <>
                <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
                  {folderLoading ? (
                    <div className="text-xs text-muted-foreground py-2">Loading folders...</div>
                  ) : (
                    folders.length > 0 ? folders.map((folder) => (
                      <button
                        type="button"
                        key={folder.$id}
                        className={`w-full text-left px-2 py-1.5 text-xs rounded border transition-colors ${selectedFolderId === folder.$id ? 'bg-primary/10 border-primary' : 'hover:bg-muted border-transparent'}`}
                        onClick={() => setSelectedFolderId(folder.$id)}
                      >
                        {folder.name}
                      </button>
                    )) : <div className="text-xs text-muted-foreground py-2">No folders yet.</div>
                  )}
                </div>
                <button
                  type="button"
                  className="px-2 py-1.5 text-xs rounded border border-dashed border-primary text-primary hover:bg-primary/10 transition-colors"
                  onClick={() => { setCreateNew(true); setSelectedFolderId(null); }}
                >
                  + Create New Folder
                </button>
              </>
            ) : (
              <input
                type="text"
                className="border rounded px-2 py-1.5 text-xs"
                placeholder="Folder name"
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                autoFocus
              />
            )}
            <DialogFooter className="pt-2 gap-2">
              <DialogClose asChild>
                <button type="button" className="px-3 py-1.5 text-xs rounded border border-border hover:bg-muted transition-colors">Cancel</button>
              </DialogClose>
              <button
                type="submit"
                className="px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground disabled:opacity-50 flex items-center gap-1"
                disabled={saving || (createNew ? !newFolderName.trim() : !selectedFolderId)}
              >
                {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                {saving ? 'Saving...' : 'Save'}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {deleteItemId && (
        <Dialog open={!!deleteItemId} onOpenChange={() => setDeleteItemId(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader className="pb-2">
              <DialogTitle className="text-sm font-medium">Delete Item</DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground leading-relaxed">This item will be permanently deleted and removed from all folders.</p>
            <DialogFooter className="pt-3 gap-2">
              <DialogClose asChild>
                <button className="px-3 py-1.5 text-xs rounded border border-border hover:bg-muted transition-colors">Cancel</button>
              </DialogClose>
              <button
                className="px-3 py-1.5 text-xs rounded bg-destructive text-destructive-foreground hover:opacity-90 transition-opacity"
                onClick={() => handleDelete(deleteItemId)}
              >
                Delete
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {showBulkDeleteConfirm && (
        <Dialog open={showBulkDeleteConfirm} onOpenChange={() => setShowBulkDeleteConfirm(false)}>
          <DialogContent className="max-w-sm">
            <DialogHeader className="pb-2">
              <DialogTitle className="text-sm font-medium">Delete Items</DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {selected.size} item{selected.size !== 1 ? 's' : ''} will be permanently deleted and removed from all folders. This action cannot be undone.
            </p>
            <DialogFooter className="pt-3 gap-2">
              <DialogClose asChild>
                <button className="px-3 py-1.5 text-xs rounded border border-border hover:bg-muted transition-colors">Cancel</button>
              </DialogClose>
              <button
                className="px-3 py-1.5 text-xs rounded bg-destructive text-destructive-foreground hover:opacity-90 transition-opacity"
                onClick={() => {
                  setShowBulkDeleteConfirm(false);
                  handleDeleteSelected();
                }}
              >
                Delete {selected.size} Item{selected.size !== 1 ? 's' : ''}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {renameItemId && (
        <Dialog open={!!renameItemId} onOpenChange={() => setRenameItemId(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader className="pb-2">
              <DialogTitle className="text-sm font-medium">Rename Item</DialogTitle>
            </DialogHeader>
            <input
              className="border rounded px-2 py-1.5 w-full text-xs"
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              placeholder="Enter new name"
              autoFocus
            />
            <DialogFooter className="pt-3 gap-2">
              <DialogClose asChild>
                <button className="px-3 py-1.5 text-xs rounded border border-border hover:bg-muted transition-colors">Cancel</button>
              </DialogClose>
              <button
                className="px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground disabled:opacity-50"
                disabled={renameLoading || !renameValue.trim()}
                onClick={() => handleRename(renameItemId)}
              >
                {renameLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

const DashboardPage = () => {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    }>
      <DashboardPageContent />
    </Suspense>
  );
};

export default DashboardPage;
