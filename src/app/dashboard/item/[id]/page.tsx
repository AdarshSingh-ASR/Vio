"use client";
import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import dynamic from 'next/dynamic';
import { X, ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, SkipBack, SkipForward } from 'lucide-react';
import { AiFillFilePdf, AiFillFileWord, AiFillHtml5, AiFillFileImage, AiFillFileText, AiFillFile } from 'react-icons/ai';
import { useQuery } from '@tanstack/react-query';
import { useChatSheet } from "@/context/ChatSheetContext";
import { useSidebarSheet } from "@/context/SidebarContext";
import { useAuth } from "@/context/AuthContext";
import ReactMarkdown from 'react-markdown';

const FileViewer = dynamic(() => import('@/components/FileViewer'), { ssr: false });

const getFileExtension = (name = "") => {
  if (!name) return "";
  const lastDot = name.lastIndexOf(".");
  return lastDot > 0 ? name.substring(lastDot + 1) : "";
};

// Helper to get Cloudinary preview URL with correct resource type and fl_inline for raw
const getCloudinaryPreviewUrl = (url: string, resourceType: string | undefined) => {
  if (!resourceType) return url;
  if (resourceType === 'raw') {
    return url.replace('/raw/upload/', '/raw/upload/fl_inline/');
  }
  // For image or video, just return the original url
  return url;
};

interface DashboardItem {
  $id?: string;
  id?: string;
  type: 'file' | 'link';
  name?: string;
  displayName?: string;
  url?: string;
  previewUrl?: string;
  preview?: {
    title: string;
    image: string;
  };
  previewTitle?: string;
  favorite: boolean;
  fileType?: string;
  content?: string;
  extractedContent?: string;
  contentType?: string;
}

// Helper to get file type label and icon
const getFileTypeInfo = (fileType: string = '', name: string = '') => {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const safeFileType = fileType || '';
  if (safeFileType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) return { label: 'Image', icon: AiFillFileImage };
  if (safeFileType === 'application/pdf' || ext === 'pdf') return { label: 'PDF', icon: AiFillFilePdf };
  if (safeFileType === 'application/msword' || safeFileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || ['doc', 'docx'].includes(ext)) return { label: 'Word', icon: AiFillFileWord };
  if (safeFileType === 'text/html' || ext === 'html') return { label: 'HTML', icon: AiFillHtml5 };
  if (safeFileType.startsWith('text/') || ['txt', 'md', 'csv'].includes(ext)) return { label: 'Text', icon: AiFillFileText };
  return { label: ext ? ext.toUpperCase() : 'File', icon: AiFillFile };
};

const fetchItems = async (getAuthenticatedFetch: () => any): Promise<DashboardItem[]> => {
  try {
    const authenticatedFetch = getAuthenticatedFetch();
    const res = await authenticatedFetch('/api/dashboard/items?workspaceId=default');
  if (!res.ok) return [];
    const data = await res.json();
    return data.items || [];
  } catch (error) {
    console.error('Error fetching items:', error);
    return [];
  }
};

const FileViewerPage = () => {
  const router = useRouter();
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showUpNextModal, setShowUpNextModal] = useState(false);
  const [upNextCollapsed, setUpNextCollapsed] = useState(false);
  const [tab, setTab] = useState<'notes' | 'summary'>('notes');
  const [note, setNote] = useState('');
  const [noteFetching, setNoteFetching] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [summary, setSummary] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const { open: chatSheetOpen } = useChatSheet();
  const { sidebarOpen } = useSidebarSheet();
  const { getAuthenticatedFetch } = useAuth();

  // Memoize the authenticated fetch function to prevent infinite re-renders
  const authenticatedFetch = React.useMemo(() => getAuthenticatedFetch(), [getAuthenticatedFetch]);

  // Use TanStack Query for items
  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['dashboard-items'],
    queryFn: () => fetchItems(getAuthenticatedFetch),
  });

  // Show collapsed bar by default on desktop, only button on mobile/tablet
  useEffect(() => {
    if (typeof window !== "undefined") {
      const isDesktop = window.matchMedia("(min-width: 768px)").matches;
      if (isDesktop) {
        setShowUpNextModal(true);
        setUpNextCollapsed(true);
      } else {
        setShowUpNextModal(false);
        setUpNextCollapsed(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!items.length) return;
    // Find the index of the current item by id
    const idx = items.findIndex(item => (item.$id || item.id) === id);
    setCurrentIndex(idx >= 0 ? idx : 0);
  }, [id, items]);

  // Fix the note fetching useEffect to prevent infinite re-renders
  useEffect(() => {
    if (!items.length || currentIndex < 0) return;
    const currentItem = items[currentIndex];
    const currentItemId = currentItem?.$id || currentItem?.id;
    if (!currentItemId) return;
    
    let isCurrent = true;
    setNoteFetching(true);
    authenticatedFetch(`/api/dashboard/items/${currentItemId}/note`)
      .then((res: any) => res.ok ? res.json() : { content: '' })
      .then((data: any) => {
        if (isCurrent) setNote(data?.content || '');
      })
      .catch((error: any) => {
        console.error('Error fetching note:', error);
        if (isCurrent) setNote('');
      })
      .finally(() => {
        if (isCurrent) setNoteFetching(false);
      });
    return () => { isCurrent = false; };
  }, [items, currentIndex, authenticatedFetch]);

  // Clear summary when item changes
  useEffect(() => {
    setSummary(''); // Clear summary when switching items
    setSummaryLoading(false); // Reset loading state
  }, [items, currentIndex]);

  if (itemsLoading) return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  if (!items.length) return <div className="flex justify-center items-center min-h-screen">No items found.</div>;
  const currentItem = items[currentIndex];

  const ext = getFileExtension(currentItem.name || '').toLowerCase();

  let preview = null;
  const safeFileType = currentItem.fileType || '';
  const isImage = safeFileType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext);
  const isVideo = safeFileType.startsWith('video/');
  
  if (currentItem.type === 'link') {
    if (currentItem.url?.includes('youtube.com') || currentItem.url?.includes('youtu.be')) {
      // YouTube embed
      let videoId = '';
      try {
        const url = new URL(currentItem.url);
        if (url.hostname === 'youtu.be') videoId = url.pathname.slice(1);
        else videoId = url.searchParams.get('v') || '';
      } catch {}
      if (videoId) {
        preview = (
          <div className="w-full aspect-video bg-black rounded-xl overflow-hidden">
            <iframe 
              className="w-full h-full" 
              src={`https://www.youtube.com/embed/${videoId}`} 
              allowFullScreen 
              title="YouTube Video"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            />
          </div>
        );
      } else {
        preview = (
          <div className="flex items-center justify-center h-64 bg-muted rounded-xl">
            <a href={currentItem.url} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">
              Open Link
            </a>
          </div>
        );
      }
    } else if (currentItem.extractedContent) {
      // Show readable webpage content
      preview = (
        <div className="w-full bg-background rounded-xl overflow-hidden" style={{ minHeight: '300px' }}>
          <div className="h-full overflow-y-auto p-6">
            {/* Preview image at the top if available */}
            {currentItem.content && (
              <div className="mb-6 flex justify-center">
                <img 
                  src={currentItem.content} 
                  alt={currentItem.displayName || currentItem.name || 'webpage preview'} 
                  className="max-w-full max-h-48 object-contain rounded-lg border border-border"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              </div>
            )}
            {/* Readable content */}
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <div className="whitespace-pre-line text-foreground leading-relaxed">
                {currentItem.extractedContent}
              </div>
            </div>
            {/* Open original link button */}
            <div className="mt-6 pt-4 border-t border-border">
              <a 
                href={currentItem.url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Open Original Link
              </a>
            </div>
          </div>
        </div>
      );
    } else if (currentItem.content) {
      preview = (
        <div className="w-full bg-black rounded-xl overflow-hidden flex items-center justify-center" style={{ minHeight: '300px' }}>
          <img 
            src={currentItem.content} 
            alt={currentItem.displayName || currentItem.name || 'link preview'} 
            className="max-w-full max-h-[60vh] object-contain"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                parent.innerHTML = `<div class="flex items-center justify-center w-full h-full text-white"><a href="${currentItem.url}" target="_blank" rel="noopener noreferrer" class="text-primary underline hover:text-primary/80">Open Link</a></div>`;
              }
            }}
          />
        </div>
      );
    } else {
      preview = (
        <div className="flex items-center justify-center h-64 bg-muted rounded-xl">
          <a href={currentItem.url} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">
            Open Link
          </a>
        </div>
      );
    }
  } else if (isImage && currentItem.url) {
    preview = (
      <div className="w-full bg-black rounded-xl overflow-hidden flex items-center justify-center" style={{ minHeight: '300px' }}>
        <img 
          src={currentItem.url} 
          alt={currentItem.name || 'file'} 
          className="max-w-full max-h-[60vh] object-contain"
        />
      </div>
    );
  } else if (currentItem.url) {
    // For all other file types (PDFs, docs, etc.), use FileViewer
    preview = (
      <FileViewer
        url={currentItem.url}
        fileType={currentItem.fileType}
        fileName={currentItem.name}
      />
    );
  } else {
    preview = (
      <div className="flex items-center justify-center h-64 bg-muted rounded-xl">
        <div className="text-center text-muted-foreground">
          <div className="text-4xl mb-2">📄</div>
          <div>File not available</div>
        </div>
      </div>
    );
  }

  const saveNote = async () => {
    setNoteSaving(true);
    setNoteSaved(false);
    try {
      const currentItemId = currentItem.$id || currentItem.id;
      const response = await authenticatedFetch(`/api/dashboard/items/${currentItemId}/note`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: note }),
    });
      
      if (!response.ok) {
        throw new Error(`Failed to save note: ${response.status}`);
      }
      
      setNoteSaved(true);
      // Auto-hide the saved message after 3 seconds
      setTimeout(() => {
        setNoteSaved(false);
      }, 3000);
    } catch (error) {
      console.error('Error saving note:', error);
      // You could add error state here if needed
    } finally {
    setNoteSaving(false);
    }
  };

  const getSummary = async () => {
    setSummaryLoading(true);
    setSummary(''); // Clear previous summary
    
    try {
      const currentItemId = currentItem.$id || currentItem.id;
      const res = await authenticatedFetch(`/api/dashboard/items/${currentItemId}/summary`);
      
      if (!res.ok) {
        // Try to get the error message from the response
        let errorMessage = `Failed to generate summary: ${res.status}`;
        try {
          const errorData = await res.json();
          if (errorData.summary) {
            errorMessage = errorData.summary;
          }
        } catch (parseError) {
          // If we can't parse the error, use the default message
        }
        throw new Error(errorMessage);
      }
      
      const data = await res.json();
      const generatedSummary = data.summary || 'No summary available.';
      
      // Set summary with a nice animation effect
      setSummary(generatedSummary);
      
      // Show success feedback briefly
      const tempSuccess = document.createElement('div');
      tempSuccess.className = 'fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-[300] animate-in slide-in-from-right';
      tempSuccess.innerHTML = '✅ Summary generated successfully!';
      document.body.appendChild(tempSuccess);
      
      setTimeout(() => {
        if (document.body.contains(tempSuccess)) {
          document.body.removeChild(tempSuccess);
        }
      }, 3000);
      
    } catch (error) {
      console.error('Error generating summary:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unable to generate summary. Please try again later.';
      setSummary(errorMessage);
      
      // Show error feedback
      const tempError = document.createElement('div');
      tempError.className = 'fixed top-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg z-[300] animate-in slide-in-from-right';
      tempError.innerHTML = '❌ Failed to generate summary. Please try again.';
      document.body.appendChild(tempError);
      
      setTimeout(() => {
        if (document.body.contains(tempError)) {
          document.body.removeChild(tempError);
        }
      }, 4000);
    } finally {
      setSummaryLoading(false);
    }
  };

  return (
    <>
      {/* Up Next Button (mobile/tablet only) - Hide when sidebar or AI sheet is open */}
      {!sidebarOpen && !chatSheetOpen && (
        <button
          className="fixed top-16 right-4 z-[200] bg-card border border-border rounded-full p-2 shadow-lg md:hidden"
          onClick={() => { setShowUpNextModal(true); setUpNextCollapsed(false); }}
          aria-label="Show Up Next"
        >
          <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
          </svg>
        </button>
      )}

      {/* Up Next Modal (expanded, all screens) - Better responsive positioning */}
      {showUpNextModal && !upNextCollapsed && (
        <div className="fixed inset-4 top-20 md:bottom-4 md:right-4 md:top-auto md:left-auto z-[100] w-auto md:w-[320px] md:max-w-[calc(100vw-2rem)] bg-white dark:bg-card border-2 border-primary rounded-xl shadow-2xl flex flex-col"
             style={{ maxHeight: 'calc(100vh - 6rem)' }}>
          {/* Header with title and cross */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="font-bold text-lg text-foreground">Up Next</span>
            <button
              className="p-1 rounded hover:bg-muted"
              onClick={() => { setShowUpNextModal(false); setUpNextCollapsed(false); }}
              aria-label="Close Up Next"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          {/* Scrollable list */}
          <div className="flex-1 overflow-y-auto px-2 py-2">
            {items.map((item, idx) => {
              const ext = getFileExtension(item.name || '').toLowerCase();
              const safeItemFileType = item.fileType || '';
              const isImage = safeItemFileType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext);
              const { icon: Icon } = getFileTypeInfo(item.fileType, item.name || '');
              const isActive = idx === currentIndex;
              return (
                <div
                  key={item.$id || item.id}
                  className={`flex items-center gap-3 px-2 py-2 cursor-pointer rounded-lg transition group border border-transparent ${isActive ? 'bg-primary/10 ring-2 ring-primary border-primary' : 'hover:bg-muted/70'}`}
                  onClick={() => { setCurrentIndex(idx); setShowUpNextModal(false); setUpNextCollapsed(false); }}
                  style={{ minHeight: '56px' }}
                >
                  {/* Thumbnail */}
                  <div className="w-14 h-10 flex-shrink-0">
                    {item.type === 'file' && (item.fileType?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) && item.url ? (
                      <img src={item.url} alt={item.name || 'file'} className="w-full h-full object-cover rounded-md border border-muted" />
                    ) : item.type === 'link' && item.content ? (
                      <img 
                        src={item.content} 
                        alt={item.displayName || item.name || 'link'} 
                        className="w-full h-full object-cover rounded-md border border-muted"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            parent.innerHTML = '<div class="w-full h-full flex items-center justify-center bg-muted rounded-md border border-muted"><div class="w-4 h-4 text-muted-foreground">📄</div></div>';
                          }
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-muted rounded-md border border-muted">
                        <Icon className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className={`truncate text-sm font-semibold ${isActive ? 'text-primary' : 'text-foreground'}`}>{item.displayName || item.name || item.previewTitle || item.preview?.title || 'Untitled'}</div>
                    {item.type === 'link' && item.url ? (
                      <div className="text-xs text-muted-foreground truncate">{item.url}</div>
                    ) : (
                      <div className="text-xs text-muted-foreground truncate">{item.fileType || ''}</div>
                    )}
                  </div>
                  {/* Index */}
                  <div className="ml-2 text-xs text-muted-foreground font-mono">{idx + 1}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Up Next Collapsed Bar (desktop only) */}
      {showUpNextModal && upNextCollapsed && !chatSheetOpen && (
        <div className="fixed bottom-4 right-4 z-[100] w-[320px] bg-primary text-white rounded-xl shadow-2xl px-4 py-3 cursor-pointer opacity-95 hidden md:flex md:items-center md:justify-between"
             onClick={() => setUpNextCollapsed(false)}
        >
          <div className="text-white">
            <span className="font-bold">Next:</span> {items[currentIndex + 1]?.displayName || items[currentIndex + 1]?.name || '—'}
          </div>
          <button className="ml-2" aria-label="Expand Up Next">
            <svg width="24" height="24" fill="currentColor"><path d="M8 10l4 4 4-4" stroke="currentColor" strokeWidth="2" fill="none" /></svg>
          </button>
        </div>
      )}

      {/* Main Layout */}
      <div
        className="min-h-screen w-full bg-background text-foreground flex flex-col md:flex-row px-0"
        style={{
          paddingRight: 'var(--chat-sheet-width, 0px)',
          transition: 'padding-right 0.2s ease',
          maxWidth: '100vw',
          overflowX: 'hidden',
        }}
      >
        {/* Main Content */}
        <div className="flex-1 flex flex-col items-center justify-start mt-0 pt-20 md:pt-8 lg:pt-12 px-3 md:px-8 w-full md:max-w-[70vw] relative overflow-hidden pb-6 md:pb-8">
          <div className="w-full flex flex-col items-start max-w-4xl">
            {/* Back Button - Responsive positioning */}
            <div className="w-full flex items-center justify-between mb-4">
              <button
                className="p-2 rounded-full text-muted-foreground hover:text-primary focus:outline-none border border-border bg-card shadow-sm hover:bg-muted transition-colors"
                onClick={() => router.push('/dashboard')}
                aria-label="Back to Dashboard"
                title="Back to Dashboard"
              >
                <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
              </button>
              {/* Spacer for mobile to account for Up Next button - adjusted for new position */}
              <div className="md:hidden w-10"></div>
            </div>
            {/* Preview */}
            <div
              className="w-full bg-card rounded-lg md:rounded-xl lg:rounded-2xl border border-border overflow-auto min-h-[250px] md:min-h-[400px] max-h-[50vh] md:max-h-[70vh]"
            >
              <div className="w-full h-full p-2 md:p-4">{preview}</div>
            </div>
            {/* Title and Navigation */}
            <div className="flex items-center gap-1 md:gap-2 mt-3 md:mt-4 lg:mt-6 w-full px-0 md:px-1 lg:px-2">
              <button
                onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
                disabled={currentIndex === 0}
                className="p-1.5 md:p-2 text-muted-foreground hover:text-primary disabled:opacity-50 focus:outline-none"
                aria-label="Previous Item"
                style={{ background: 'none', border: 'none' }}
              >
                <SkipBack className="w-5 h-5 md:w-7 md:h-7" />
              </button>
              <div className="text-lg md:text-xl lg:text-2xl font-bold truncate flex-1 px-2">
                {currentItem.displayName || currentItem.name || currentItem.previewTitle || currentItem.preview?.title || 'Untitled'}
              </div>
              <button
                onClick={() => setCurrentIndex(i => Math.min(items.length - 1, i + 1))}
                disabled={currentIndex === items.length - 1}
                className="p-1.5 md:p-2 text-muted-foreground hover:text-primary disabled:opacity-50 focus:outline-none"
                aria-label="Next Item"
                style={{ background: 'none', border: 'none' }}
              >
                <SkipForward className="w-5 h-5 md:w-7 md:h-7" />
              </button>
            </div>
            {/* Info */}
            {currentItem.type === 'link' && currentItem.url && (
              <div className="text-xs md:text-sm text-muted-foreground break-all mb-1 md:mb-2 px-2 md:px-1 lg:px-2">{currentItem.url}</div>
            )}
            {currentItem.fileType && (
              <div className="text-xs text-muted-foreground mb-1 md:mb-2 px-2 md:px-1 lg:px-2">{currentItem.fileType || ext.toUpperCase()}</div>
            )}
            <div className="flex gap-2 md:gap-4 mt-3 md:mt-4 w-full">
              <button
                className={`px-3 md:px-4 py-2 rounded-t text-sm md:text-base ${tab === 'notes' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}
                onClick={() => setTab('notes')}
              >
                Notes
              </button>
              <button
                className={`px-3 md:px-4 py-2 rounded-t text-sm md:text-base ${tab === 'summary' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}
                onClick={() => setTab('summary')}
              >
                Summary
              </button>
            </div>
            <div className="border rounded-b p-3 md:p-4 bg-card w-full min-h-[150px] md:min-h-[200px] pb-4 md:pb-6">
              {tab === 'notes' ? (
                noteFetching ? (
                  <div className="flex justify-center items-center min-h-[100px] md:min-h-[120px]">Loading...</div>
                ) : (
                  <div className="space-y-2 md:space-y-3">
                    <textarea
                      className="w-full h-24 md:h-32 border rounded-md p-2 md:p-3 text-sm resize-none overflow-y-auto focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="Add your notes here..."
                      value={note}
                      onChange={e => { setNote(e.target.value); setNoteSaved(false); }}
                      disabled={noteSaving}
                    />
                    <div className="flex items-center gap-2 md:gap-3">
                    <button
                        className="px-3 md:px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base"
                      onClick={saveNote}
                        disabled={noteSaving || !note.trim()}
                    >
                      {noteSaving ? 'Saving...' : 'Save Note'}
                    </button>
                      {noteSaved && (
                        <span className="text-green-600 text-sm font-medium flex items-center gap-1">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Saved!
                        </span>
                      )}
                    </div>
                  </div>
                )
              ) : (
                <div className="space-y-2 md:space-y-3">
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                    <button
                      className="px-3 md:px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base flex items-center gap-2"
                      onClick={getSummary}
                      disabled={summaryLoading}
                    >
                      {summaryLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Generating Summary...</span>
                        </>
                      ) : summary ? (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          <span>Regenerate Summary</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span>Generate Summary</span>
                        </>
                      )}
                    </button>
                    {summary && !summaryLoading && (
                      <button
                        className="px-3 md:px-4 py-2 bg-muted text-foreground rounded-md hover:bg-muted/80 transition-colors text-sm md:text-base flex items-center gap-2"
                        onClick={() => {
                          navigator.clipboard.writeText(summary);
                          const tempNotice = document.createElement('div');
                          tempNotice.className = 'fixed top-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-[300]';
                          tempNotice.innerHTML = '📋 Summary copied to clipboard!';
                          document.body.appendChild(tempNotice);
                          setTimeout(() => {
                            if (document.body.contains(tempNotice)) {
                              document.body.removeChild(tempNotice);
                            }
                          }, 2000);
                        }}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy
                      </button>
                    )}
                  </div>
                  {summaryLoading && (
                    <div className="mt-2 md:mt-3 p-3 md:p-4 bg-muted rounded-md border border-border">
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                        <div className="flex-1">
                          <div className="font-medium">Analyzing content with Gemini AI...</div>
                          <div className="text-xs mt-1">
                            {currentItem.type === 'link' ? 'Extracting web content and generating intelligent summary' : 'Processing file content for AI summarization'}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {summary && !summaryLoading && (
                    <div className="mt-2 md:mt-3 p-3 md:p-4 bg-muted rounded-md border border-border">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        <span className="text-sm font-medium text-foreground">Gemini AI Summary</span>
                      </div>
                      <div className="max-h-32 md:max-h-40 overflow-y-auto overflow-x-hidden">
                        <ReactMarkdown 
                          className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-code:text-foreground prose-pre:bg-muted prose-pre:text-foreground prose-ul:text-foreground prose-ol:text-foreground prose-li:text-foreground"
                          components={{
                            p: ({ children }) => <p className="mb-2 last:mb-0 text-sm">{children}</p>,
                            h1: ({ children }) => <h1 className="text-lg font-bold mb-2 text-foreground">{children}</h1>,
                            h2: ({ children }) => <h2 className="text-base font-bold mb-2 text-foreground">{children}</h2>,
                            h3: ({ children }) => <h3 className="text-sm font-bold mb-1 text-foreground">{children}</h3>,
                            ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1 text-sm">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1 text-sm">{children}</ol>,
                            li: ({ children }) => <li className="text-sm">{children}</li>,
                            code: ({ children, className }) => {
                              const isInline = !className?.includes('language-');
                              if (isInline) {
                                return <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono text-foreground">{children}</code>;
                              }
                              return (
                                <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
                                  <code className="text-foreground">{children}</code>
                                </pre>
                              );
                            },
                            blockquote: ({ children }) => (
                              <blockquote className="border-l-2 border-muted-foreground pl-2 italic text-sm mb-2">
                                {children}
                              </blockquote>
                            ),
                            strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                            em: ({ children }) => <em className="italic text-foreground">{children}</em>,
                          }}
                        >
                          {summary}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Mobile Up Next (below main content) - Only show when modal is not open */}
        {!showUpNextModal && (
          <div className="md:hidden w-full px-3 mt-6 mb-6">
            <div className="font-bold text-base mb-3 text-foreground">Up Next</div>
            <div className="flex flex-row gap-3 overflow-x-auto pb-3" style={{ scrollbarWidth: 'thin' }}>
            {items.map((item, idx) => {
                const ext = getFileExtension(item.name || '').toLowerCase();
                const safeItemFileType = item.fileType || '';
                const isImage = safeItemFileType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext);
              const { icon: Icon } = getFileTypeInfo(item.fileType, item.name || '');
              const isActive = idx === currentIndex;
              return (
                <div
                    key={item.$id || item.id}
                    className={`flex-shrink-0 w-20 cursor-pointer rounded-lg transition-all duration-200 group border ${isActive ? 'bg-primary/10 ring-2 ring-primary border-primary shadow-md' : 'border-border hover:bg-muted/70 hover:shadow-sm'}`}
                  onClick={() => setCurrentIndex(idx)}
                    style={{ minHeight: '80px' }}
                  >
                    {/* Thumbnail */}
                    <div className="w-full h-12 mb-2 rounded-md overflow-hidden">
                      {item.type === 'file' && (item.fileType?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) && item.url ? (
                        <img src={item.url} alt={item.name || 'file'} className="w-full h-full object-cover border border-muted" />
                      ) : item.type === 'link' && item.content ? (
                        <img 
                          src={item.content} 
                          alt={item.displayName || item.name || 'link'} 
                          className="w-full h-full object-cover border border-muted"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                              parent.innerHTML = '<div class="w-full h-full flex items-center justify-center bg-muted border border-muted"><div class="w-4 h-4 text-muted-foreground">📄</div></div>';
                            }
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-muted border border-muted">
                          <Icon className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    {/* Info */}
                    <div className="px-1">
                      <div className={`text-xs truncate leading-tight ${isActive ? 'text-primary font-medium' : 'text-foreground'}`}>
                        {item.displayName || item.name || item.previewTitle || item.preview?.title || 'Untitled'}
                      </div>
                    </div>
                </div>
              );
            })}
          </div>
        </div>
        )}
      </div>
    </>
  );
};

export default FileViewerPage; 