"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Folder, FileText, Search, Globe, Trophy, ExternalLink } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

const SearchPage = () => {
  const router = useRouter();
  const { getAuthenticatedFetch } = useAuth();
  const [query, setQuery] = useState("");
  const [manualSearch, setManualSearch] = useState("");
  const [isWebSearch, setIsWebSearch] = useState(false);
  const debouncedQuery = useDebounce(query || manualSearch, 300);
  
  const fetchSearchResults = async (query: string, isWebSearch: boolean = false) => {
    if (!query) return { items: [], folders: [], quizResults: [], webResults: [] };
    
    const webParam = isWebSearch ? '&web=true' : '';
    const url = `/api/dashboard/search?q=${encodeURIComponent(query)}${webParam}`;
    
    // Use authenticated fetch for database search, regular fetch for web search
    const fetchFunction = isWebSearch ? fetch : getAuthenticatedFetch();
    
    try {
      const res = await fetchFunction(url);
      if (!res.ok) {
        console.error('Search API error:', res.status, res.statusText);
        return { items: [], folders: [], quizResults: [], webResults: [], error: 'Search failed' };
      }
      return res.json();
    } catch (error) {
      console.error('Search request failed:', error);
      return { items: [], folders: [], quizResults: [], webResults: [], error: 'Search failed' };
    }
  };
  
  const { data = { items: [], folders: [], quizResults: [], webResults: [] }, isLoading } = useQuery({
    queryKey: ["search", debouncedQuery, isWebSearch],
    queryFn: () => fetchSearchResults(debouncedQuery, isWebSearch),
    enabled: !!debouncedQuery,
  });

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-2xl font-normal text-muted-foreground mb-2">Search</h1>
        </div>

        {/* Search Form with Web Toggle */}
        <form 
          onSubmit={e => { e.preventDefault(); setManualSearch(query); }} 
          className="mb-8 flex justify-center"
        >
          <div className="relative max-w-2xl w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              className="w-full pl-10 pr-20 py-3 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
              placeholder={isWebSearch ? "Search the web..." : "Search for items, folders, or quizes..."}
              value={query}
              onChange={e => { setQuery(e.target.value); setManualSearch(""); }}
            />
            <button 
              className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 text-sm bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 transition-opacity" 
              type="submit"
            >
              Search
            </button>
          </div>
        </form>

        {/* Web Search Toggle */}
        <div className="mb-8 flex justify-center">
          <div className="flex items-center gap-2 p-1 bg-card border border-border rounded-lg shadow-sm">
            <button
              onClick={() => setIsWebSearch(false)}
              className={`flex items-center gap-2 px-5 py-2.5 text-xs font-medium rounded-md transition-all duration-200 ${
                !isWebSearch
                  ? 'bg-muted text-foreground shadow-sm border border-border/50'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="font-normal">My Content</span>
            </button>
            <button
              onClick={() => setIsWebSearch(true)}
              className={`flex items-center gap-2 px-5 py-2.5 text-xs font-medium rounded-md transition-all duration-200 ${
                isWebSearch
                  ? 'bg-muted text-foreground shadow-sm border border-border/50'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span className="font-normal">Web Search</span>
            </button>
          </div>
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="text-sm text-muted-foreground">Searching...</div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Error Message */}
            {data.error && (
              <div className="text-center py-8">
                <div className="text-sm text-muted-foreground mb-2">
                  {data.error === 'Authentication required for searching saved content' 
                    ? 'Please sign in to search your saved content' 
                    : 'Search encountered an error'}
                </div>
                {data.error === 'Authentication required for searching saved content' && (
                  <div className="text-xs text-muted-foreground">
                    You can still use web search without signing in
                  </div>
                )}
              </div>
            )}

            {/* Web Results */}
            {isWebSearch && data.webResults.length > 0 && (
              <div>
                <h2 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  Web Results ({data.webResults.length})
                </h2>
                <div className="space-y-4">
                  {data.webResults.map((result: any) => (
                    <div
                      key={result.id}
                      className="group p-4 bg-card border border-border rounded-lg hover:border-primary/50 transition-all"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          <a
                            href={result.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-sm text-foreground hover:text-primary transition-colors flex items-center gap-2 group"
                          >
                            <span className="truncate">{result.title}</span>
                            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                          </a>
                          <div className="text-xs text-muted-foreground mt-1 truncate">
                            {result.url}
                          </div>
                        </div>
                        {result.score && (
                          <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded flex-shrink-0">
                            {Math.round(result.score * 100)}%
                          </div>
                        )}
                      </div>
                      {result.content && (
                        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                          {result.content}
                        </p>
                      )}
                      {result.publishedDate && (
                        <div className="text-xs text-muted-foreground mt-2">
                          Published: {formatDate(result.publishedDate)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Local Search Results */}
            {!isWebSearch && (
              <>
                {/* Folders Section */}
                {data.folders.length > 0 && (
                  <div>
                    <h2 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
                      <Folder className="w-4 h-4" />
                      Folders ({data.folders.length})
                    </h2>
                    <div className="space-y-2">
                      {data.folders.map((folder: any) => (
                        <div
                          key={folder.$id}
                          className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded cursor-pointer"
                          onClick={() => router.push(`/dashboard/folder/${folder.$id}`)}
                        >
                          <Folder className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium text-sm">{folder.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Items Section */}
                {data.items.length > 0 && (
                  <div>
                    <h2 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Items ({data.items.length})
                    </h2>
                    <div className="space-y-2">
                      {data.items.map((item: any) => (
                        <div
                          key={item.id}
                          className="group p-4 bg-card border border-border rounded-lg cursor-pointer hover:border-primary/50 transition-all"
                          onClick={() => router.push(`/dashboard/item/${item.id}`)}
                        >
                          <div className="flex items-center gap-3">
                            <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">
                                {item.displayName || item.name || item.url}
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                {item.type === 'file' ? item.fileType || 'File' : item.url}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quiz Results Section */}
                {data.quizResults && data.quizResults.length > 0 && (
                  <div>
                    <h2 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
                      <Trophy className="w-4 h-4" />
                      Quiz Results ({data.quizResults.length})
                    </h2>
                    <div className="space-y-2">
                      {data.quizResults.map((quiz: any) => (
                        <div
                          key={quiz.$id}
                          className="group p-4 bg-card border border-border rounded-lg cursor-pointer hover:border-primary/50 transition-all"
                          onClick={() => router.push('/dashboard/quizes/taken')}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <Trophy className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate">
                                  {quiz.itemName}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {quiz.type === 'listening' ? 'Listening Test' : 'Quiz'} • {formatDate(quiz.completedAt)}
                                </div>
                              </div>
                            </div>
                            <div className="text-xs font-medium px-2 py-1 bg-muted rounded flex-shrink-0">
                              {quiz.score}/{quiz.totalQuestions}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* No Results */}
            {((isWebSearch && data.webResults.length === 0) || 
              (!isWebSearch && data.folders.length === 0 && data.items.length === 0 && (!data.quizResults || data.quizResults.length === 0))) && 
              debouncedQuery && (
              <div className="text-center py-12">
                <div className="text-sm text-muted-foreground">
                  No results found for &quot;{debouncedQuery}&quot;
                  {isWebSearch ? " on the web" : " in your content"}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchPage; 