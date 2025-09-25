"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Pencil, Trash, CheckCircle, X, Loader2, MoreVertical, FolderPlus, Star, StarOff, Plus } from "lucide-react";
import { AiFillFilePdf, AiFillFileWord, AiFillHtml5, AiFillFileImage, AiFillFileText, AiFillFile, AiFillFolder } from "react-icons/ai";
import { useFolders } from '@/context/FoldersContext';
import { useAuth } from '@/context/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';

const getFileTypeInfo = (fileType = '', name = '') => {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const safeFileType = fileType || ''; // Handle null/undefined values
  if (safeFileType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) return { label: 'Image', icon: AiFillFileImage };
  if (safeFileType === 'application/pdf' || ext === 'pdf') return { label: 'PDF', icon: AiFillFilePdf };
  if (safeFileType === 'application/msword' || safeFileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || ['doc', 'docx'].includes(ext)) return { label: 'Word', icon: AiFillFileWord };
  if (safeFileType === 'text/html' || ext === 'html') return { label: 'HTML', icon: AiFillHtml5 };
  if (safeFileType.startsWith('text/') || ['txt', 'md', 'csv'].includes(ext)) return { label: 'Text', icon: AiFillFileText };
  return { label: ext ? ext.toUpperCase() : 'File', icon: AiFillFile };
};

// Add BookmarkIcon component
const BookmarkIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" fill="none" />
  </svg>
);

const FolderPage = () => {
  const router = useRouter();
  const params = useParams();
  const folderId = params.id as string;
  const { refreshFolders, setLoading: setFoldersLoading } = useFolders();
  const { getAuthenticatedFetch } = useAuth();
  const [folder, setFolder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hovered, setHovered] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameLoading, setRenameLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [removeLoading, setRemoveLoading] = useState(false);
  const [showMenuId, setShowMenuId] = useState<string | null>(null);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folderLoading, setFolderLoading] = useState(false);
  const [folders, setFolders] = useState<any[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [createNew, setCreateNew] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [saving, setSaving] = useState(false);
  const [renameItemId, setRenameItemId] = useState<string | null>(null);
  const [renameItemValue, setRenameItemValue] = useState('');
  const [renameItemLoading, setRenameItemLoading] = useState(false);
  const [removeItemId, setRemoveItemId] = useState<string | null>(null);
  const [removeItemLoading, setRemoveItemLoading] = useState(false);
  
  // Add Items Modal State
  const [showAddItemsModal, setShowAddItemsModal] = useState(false);
  const [availableItems, setAvailableItems] = useState<any[]>([]);
  const [addItemsLoading, setAddItemsLoading] = useState(false);
  const [selectedItemsToAdd, setSelectedItemsToAdd] = useState<Set<string>>(new Set());
  const [addingSaving, setAddingSaving] = useState(false);

  // Fetch folder and items
  const fetchData = useCallback(async () => {
    setLoading(true);
    const authFetch = getAuthenticatedFetch();
    const folderRes = await authFetch(`/api/dashboard/folders`);
    const folders = folderRes.ok ? await folderRes.json() : [];
    const found = folders.find((f: any) => f.$id === folderId);
    setFolder(found);
    setRenameValue(found?.name || '');
    
    if (folderId && folderId !== 'undefined') {
      const itemsRes = await authFetch(`/api/dashboard/items?folderId=${folderId}`);
      if (itemsRes.ok) {
        const data = await itemsRes.json();
        setItems(data.items || []);
      } else {
        setItems([]);
      }
    } else {
      setItems([]);
    }
    setLoading(false);
  }, [folderId, getAuthenticatedFetch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Fetch folders for modal
  const fetchFolders = async () => {
    setFolderLoading(true);
    const authFetch = getAuthenticatedFetch();
    const res = await authFetch('/api/dashboard/folders');
    if (res.ok) {
      setFolders(await res.json());
    }
    setFolderLoading(false);
  };

  // Fetch available items (not in current folder)
  const fetchAvailableItems = async () => {
    setAddItemsLoading(true);
    const authFetch = getAuthenticatedFetch();
    const res = await authFetch('/api/dashboard/items?workspaceId=default');
    if (res.ok) {
      const data = await res.json();
      const allItems = data.items || [];
      // Filter out items that are already in this folder
      const currentItemIds = new Set(items.map(item => item.$id || item.id));
      const availableItems = allItems.filter((item: any) => !currentItemIds.has(item.$id || item.id));
      setAvailableItems(availableItems);
    }
    setAddItemsLoading(false);
  };

  // Rename logic
  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    setRenameLoading(true);
    setFoldersLoading(true);
    const authFetch = getAuthenticatedFetch();
    await authFetch(`/api/dashboard/folders/${folderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: renameValue }),
    });
    setRenaming(false);
    setRenameLoading(false);
    await refreshFolders();
    setFoldersLoading(false);
    fetchData();
  };

  // Delete logic
  const handleDelete = async () => {
    setDeleteLoading(true);
    setFoldersLoading(true);
    const authFetch = getAuthenticatedFetch();
    await authFetch(`/api/dashboard/folders/${folderId}`, { method: 'DELETE' });
    setDeleteLoading(false);
    await refreshFolders();
    setFoldersLoading(false);
    router.push('/dashboard');
  };

  // Remove items from folder (bulk)
  const handleRemoveItems = async () => {
    setRemoveLoading(true);
    const authFetch = getAuthenticatedFetch();
    await Promise.all(Array.from(selected).map(id =>
      authFetch(`/api/dashboard/folders/${folderId}/items/${id}`, {
        method: 'DELETE',
      })
    ));
    setRemoveLoading(false);
    setSelected(new Set());
    fetchData();
    await refreshFolders();
  };

  // Save to folder logic
  const handleSaveToFolder = (itemId: string) => {
    setSelected(new Set([itemId]));
    setShowFolderModal(true);
    setCreateNew(false);
    setSelectedFolderId(null);
    setNewFolderName('');
    fetchFolders();
  };

  // Remove from folder logic
  const handleRemoveFromFolder = async (itemId: string) => {
    setRemoveItemLoading(true);
    const authFetch = getAuthenticatedFetch();
    await authFetch(`/api/dashboard/folders/${folderId}/items/${itemId}`, {
      method: 'DELETE',
    });
    setRemoveItemLoading(false);
    setRemoveItemId(null);
    fetchData();
    await refreshFolders();
  };

  // Rename logic for item
  const handleRenameItem = async () => {
    setRenameItemLoading(true);
    const authFetch = getAuthenticatedFetch();
    await authFetch(`/api/dashboard/items/${renameItemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: renameItemValue }),
    });
    setRenameItemId(null);
    setRenameItemValue('');
    setRenameItemLoading(false);
    fetchData();
  };

  // Add items to folder logic
  const handleAddItemsToFolder = async () => {
    setAddingSaving(true);
    const authFetch = getAuthenticatedFetch();
    await authFetch('/api/dashboard/folders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        folderId: folderId, 
        itemIds: Array.from(selectedItemsToAdd) 
      }),
    });
    setAddingSaving(false);
    setShowAddItemsModal(false);
    setSelectedItemsToAdd(new Set());
    fetchData();
    await refreshFolders();
  };

  // Bulk bar logic
  const allSelected = selected.size === items.length && items.length > 0;
  const showBulkBar = selected.size > 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-12">
        <div className="flex items-center gap-3 group">
            <AiFillFolder className="w-6 h-6 text-muted-foreground" />
          {renaming ? (
            <form onSubmit={handleRename} className="flex items-center gap-2">
              <input
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                  className="text-xl font-normal bg-transparent border-b border-border focus:outline-none focus:border-primary"
                disabled={renameLoading}
                autoFocus
              />
                <button 
                  type="submit" 
                  className="p-1 rounded hover:bg-muted transition-colors" 
                  disabled={renameLoading}
                >
                {renameLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              </button>
                <button 
                  type="button" 
                  className="p-1 rounded hover:bg-muted transition-colors" 
                  onClick={() => setRenaming(false)} 
                  disabled={renameLoading}
                >
                <X className="w-4 h-4" />
              </button>
            </form>
          ) : folder ? (
            <>
                <h1 className="text-2xl font-normal">{folder.name}</h1>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                    className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                onClick={() => setRenaming(true)}
                disabled={renaming || loading}
              >
                    <Pencil className="w-3 h-3" /> Rename
              </button>
              <button
                    className="flex items-center gap-1 px-2 py-1 text-xs text-destructive hover:bg-destructive/10 rounded transition-colors"
                onClick={() => setDeleteConfirm(true)}
                disabled={loading}
              >
                    <Trash className="w-3 h-3" /> Delete
              </button>
                </div>
            </>
          ) : <span className="text-muted-foreground">Loading...</span>}
          </div>
          
          {/* Add Items Button */}
          {folder && !renaming && (
            <div className="mt-4">
              <button
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium shadow-sm"
                onClick={() => {
                  setShowAddItemsModal(true);
                  fetchAvailableItems();
                }}
                disabled={loading}
              >
                <Plus className="w-4 h-4" />
                Add Items
              </button>
            </div>
          )}
        </div>

        {/* Bulk Actions */}
      {showBulkBar && (
          <div className="flex justify-between items-center mb-4 px-1">
            <span className="text-xs text-muted-foreground">
              {selected.size} item{selected.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center gap-2">
          <button
            type="button"
                className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded hover:bg-muted transition-colors"
            onClick={() => setSelected(new Set())}
            disabled={removeLoading}
          >
                Cancel
          </button>
          <button
            type="button"
                className="px-2 py-1 text-xs bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity"
                onClick={() => setSelected(new Set(items.map(i => i.$id)))}
            disabled={removeLoading}
          >
            Select All
          </button>
          <button
            type="button"
                className="px-2 py-1 text-xs text-destructive border border-destructive/20 rounded hover:bg-destructive/10 transition-colors"
            onClick={handleRemoveItems}
            disabled={removeLoading}
          >
                <div className="flex items-center gap-1">
                  {removeLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                  Remove ({selected.size})
                </div>
          </button>
            </div>
        </div>
      )}

        {/* Items List */}
      {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="text-xs text-muted-foreground">Loading items...</div>
          </div>
      ) : (
          <div className="space-y-2">
          {items.map((item, idx) => {
              const id = item.$id || String(idx);
            const isSelected = selected.has(id);
            return (
              <div
                key={id}
                  className={`group relative flex items-center gap-5 px-5 py-4 rounded-lg hover:bg-muted/50 transition-all cursor-pointer ${
                    isSelected ? 'bg-primary/5 border border-primary/20' : 'border border-transparent'
                  }`}
                onClick={e => {
                  if ((e.target as HTMLElement).closest('input[type="checkbox"]') || (e.target as HTMLElement).closest('button')) return;
                  router.push(`/dashboard/folder/${folderId}/item/${id}`);
                }}
                  onMouseEnter={() => setHovered(id)}
                  onMouseLeave={() => setHovered(null)}
              >
                  {/* Selection Checkbox */}
                  {(selected.size > 0 || hovered === id) && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {
                        setSelected(prev => {
                        const newSet = new Set(prev);
                        if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
                        return newSet;
                        });
                      }}
                      className="w-3 h-3 accent-primary cursor-pointer flex-shrink-0"
                      onClick={e => e.stopPropagation()}
                    />
                  )}

                  {/* Thumbnail */}
                  <div className="w-14 h-12 flex-shrink-0 rounded overflow-hidden bg-muted flex items-center justify-center">
                    {item.type === 'file' && (
                      (item.fileType?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(item.name?.split('.').pop()?.toLowerCase() || '')) && item.url ? (
                        <img src={item.url} alt={item.name || 'file'} className="w-full h-full object-cover" />
                      ) : (
                        (() => {
                          const { icon: Icon } = getFileTypeInfo(item.fileType, item.name || '');
                          return Icon ? <Icon className="w-6 h-6 text-muted-foreground" /> : null;
                        })()
                      )
                    )}
                    {item.type === 'link' && (
                      item.content ? (
                        <img 
                          src={item.content}
                          alt={item.title || 'link preview'}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                              parent.innerHTML = '<div class="flex items-center justify-center w-full h-full text-xs text-muted-foreground">Link</div>';
                            }
                          }}
                        />
                      ) : (
                        <div className="text-xs text-muted-foreground">Link</div>
                      )
                  )}
                </div>

                  {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="text-base font-medium text-foreground truncate">
                      {item.displayName || item.name || item.title || 'Untitled'}
                    </div>
                  <div className="text-sm text-muted-foreground truncate">
                      {item.type === 'file' 
                        ? (() => {
                            const { label } = getFileTypeInfo(item.fileType, item.name || '');
                            return label;
                          })()
                        : item.url
                      }
                    </div>
                  </div>

                  {/* Menu Button */}
                  <div className="flex-shrink-0">
                  <button
                      className={`p-1 rounded hover:bg-muted transition-colors ${
                        showMenuId === id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}
                    onClick={e => { e.stopPropagation(); setShowMenuId(id === showMenuId ? null : id); }}
                  >
                      <MoreVertical className="w-4 h-4" />
                  </button>
                  {showMenuId === id && (
                      <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-md shadow-lg z-20 min-w-32">
                        <button 
                          className="flex items-center gap-2 w-full px-2 py-1.5 text-xs hover:bg-muted transition-colors"
                          onClick={() => { handleSaveToFolder(id); setShowMenuId(null); }}
                        >
                          <BookmarkIcon className="w-3 h-3" /> Save to folder
                      </button>
                        <button 
                          className="flex items-center gap-2 w-full px-2 py-1.5 text-xs hover:bg-muted transition-colors"
                          onClick={() => { setRemoveItemId(id); setShowMenuId(null); }}
                        >
                          <Trash className="w-3 h-3" /> Remove from folder
                      </button>
                        <button 
                          className="flex items-center gap-2 w-full px-2 py-1.5 text-xs hover:bg-muted transition-colors"
                          onClick={() => { setRenameItemId(id); setRenameItemValue(item.displayName || item.name || ''); setShowMenuId(null); }}
                        >
                          <Pencil className="w-3 h-3" /> Rename
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>

      {/* Add Items Modal */}
      <Dialog open={showAddItemsModal} onOpenChange={setShowAddItemsModal}>
        <DialogContent className="max-w-md">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-sm font-medium">Add Items to {folder?.name}</DialogTitle>
          </DialogHeader>
          
          {addItemsLoading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading available items...</span>
            </div>
          ) : availableItems.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-sm text-muted-foreground">No items available to add.</div>
              <div className="text-xs text-muted-foreground mt-1">All your saved items are already in this folder.</div>
            </div>
          ) : (
            <>
              <div className="max-h-64 overflow-y-auto border border-border rounded-md">
                {availableItems.map((item) => {
                  const id = item.$id || item.id;
                  const isSelected = selectedItemsToAdd.has(id);
                  const { icon: Icon } = getFileTypeInfo(item.fileType, item.name || '');
                  
                  return (
                    <div
                      key={id}
                      className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors border-b border-border last:border-b-0 ${
                        isSelected ? 'bg-primary/5 border-l-2 border-l-primary' : ''
                      }`}
                      onClick={() => {
                        setSelectedItemsToAdd(prev => {
                          const newSet = new Set(prev);
                          if (newSet.has(id)) {
                            newSet.delete(id);
                          } else {
                            newSet.add(id);
                          }
                          return newSet;
                        });
                      }}
                    >
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // Handled by parent div onClick
                        className="w-3 h-3 accent-primary cursor-pointer"
                      />
                      
                      {/* Thumbnail */}
                      <div className="w-10 h-8 flex-shrink-0 rounded overflow-hidden bg-muted flex items-center justify-center">
                        {item.type === 'file' && (item.fileType?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(item.name?.split('.').pop()?.toLowerCase() || '')) && item.url ? (
                          <img src={item.url} alt={item.name || 'file'} className="w-full h-full object-cover" />
                        ) : item.type === 'link' && item.content ? (
                          <img 
                            src={item.content}
                            alt={item.title || 'link preview'}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const parent = target.parentElement;
                              if (parent) {
                                parent.innerHTML = '<div class="flex items-center justify-center w-full h-full"><div class="w-3 h-3 text-muted-foreground">📄</div></div>';
                              }
                            }}
                          />
                        ) : (
                          <Icon className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">
                          {item.displayName || item.name || item.title || 'Untitled'}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {item.type === 'file' 
                            ? (() => {
                                const { label } = getFileTypeInfo(item.fileType, item.name || '');
                                return label;
                              })()
                            : item.url
                          }
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {selectedItemsToAdd.size > 0 && (
                <div className="text-xs text-muted-foreground">
                  {selectedItemsToAdd.size} item{selectedItemsToAdd.size !== 1 ? 's' : ''} selected
                </div>
              )}
            </>
          )}
          
          <DialogFooter className="pt-3 gap-2">
            <DialogClose asChild>
              <button className="px-3 py-1.5 text-xs rounded border border-border hover:bg-muted transition-colors">
                Cancel
              </button>
            </DialogClose>
            <button
              className="px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground disabled:opacity-50 flex items-center gap-1"
              disabled={addingSaving || selectedItemsToAdd.size === 0}
              onClick={handleAddItemsToFolder}
            >
              {addingSaving && <Loader2 className="w-3 h-3 animate-spin" />}
              {addingSaving ? 'Adding...' : `Add ${selectedItemsToAdd.size > 0 ? `(${selectedItemsToAdd.size})` : ''}`}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Folder Modal */}
      <Dialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-sm font-medium">Delete Folder</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground leading-relaxed">All items will remain saved, but will be removed from this folder.</p>
          <DialogFooter className="pt-3 gap-2">
            <DialogClose asChild>
              <button className="px-3 py-1.5 text-xs rounded border border-border hover:bg-muted transition-colors">Cancel</button>
            </DialogClose>
            <button
              className="px-3 py-1.5 text-xs rounded bg-destructive text-destructive-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
              onClick={handleDelete}
              disabled={deleteLoading}
            >
              {deleteLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Delete'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add to Folder Modal */}
      <Dialog open={showFolderModal} onOpenChange={setShowFolderModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-sm font-medium">Add to Folder</DialogTitle>
          </DialogHeader>
          <form onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            if (createNew && newFolderName.trim()) {
              const authFetch = getAuthenticatedFetch();
              await authFetch('/api/dashboard/folders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newFolderName.trim(), itemIds: Array.from(selected) }),
              });
            } else if (selectedFolderId) {
              const authFetch = getAuthenticatedFetch();
              await authFetch('/api/dashboard/folders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folderId: selectedFolderId, itemIds: Array.from(selected) }),
              });
            }
            setSaving(false);
            setShowFolderModal(false);
            setSelected(new Set());
            setCreateNew(false);
            setSelectedFolderId(null);
            setNewFolderName('');
            fetchData();
            await refreshFolders();
          }} className="flex flex-col gap-3">
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

      {/* Remove from Folder Modal */}
      {removeItemId && (
        <Dialog open={!!removeItemId} onOpenChange={() => setRemoveItemId(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader className="pb-2">
              <DialogTitle className="text-sm font-medium">Remove from Folder</DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground leading-relaxed">Do you want to remove this item from the folder?</p>
            <DialogFooter className="pt-3 gap-2">
              <DialogClose asChild>
                <button className="px-3 py-1.5 text-xs rounded border border-border hover:bg-muted transition-colors">Cancel</button>
              </DialogClose>
              <button
                className="px-3 py-1.5 text-xs rounded bg-destructive text-destructive-foreground hover:opacity-90 transition-opacity"
                onClick={() => handleRemoveFromFolder(removeItemId)}
                disabled={removeItemLoading}
              >
                {removeItemLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Remove'}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Rename Item Modal */}
      {renameItemId && (
        <Dialog open={!!renameItemId} onOpenChange={() => setRenameItemId(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader className="pb-2">
              <DialogTitle className="text-sm font-medium">Rename Item</DialogTitle>
            </DialogHeader>
            <input
              className="border rounded px-2 py-1.5 w-full text-xs"
              value={renameItemValue}
              onChange={e => setRenameItemValue(e.target.value)}
              autoFocus
            />
            <DialogFooter className="pt-3 gap-2">
              <DialogClose asChild>
                <button className="px-3 py-1.5 text-xs rounded border border-border hover:bg-muted transition-colors">Cancel</button>
              </DialogClose>
              <button
                className="px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground disabled:opacity-50"
                disabled={renameItemLoading || !renameItemValue.trim()}
                onClick={handleRenameItem}
              >
                {renameItemLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default FolderPage; 