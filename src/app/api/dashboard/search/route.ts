import { NextRequest, NextResponse } from "next/server";
import { dashboardItemService, folderService, quizResultService, workspaceService } from '@/lib/tidb-service';
import { searchWeb } from "@/lib/tavily";
import { apiErrorResponse, requireDbUser } from "@/lib/request-auth";
import { knowledgeStore } from "@/lib/knowledge-store";

// Define types for web search results
interface WebSearchResult {
  id: string;
  title: string;
  content: string;
  url: string;
  type: 'web';
  score: number;
  publishedDate: string | null;
}

// Force this route to be dynamic
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await requireDbUser(req);
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q');
    const isWebSearch = searchParams.get('web') === 'true';
    
    console.log(`GET /api/dashboard/search - Starting ${isWebSearch ? 'web' : 'database'} search`);
    
    if (!query) {
      return NextResponse.json({ items: [], folders: [], webResults: [] });
    }

    // Handle web search using Tavily
    if (isWebSearch) {
      try {
        console.log('Performing web search with Tavily for:', query);
        const webResponse = await searchWeb(query);
        
        // Handle Tavily response format - it returns an object with results array
        let formattedResults: WebSearchResult[] = [];
        if (webResponse && webResponse.results && Array.isArray(webResponse.results)) {
          formattedResults = webResponse.results.map((result: any): WebSearchResult => ({
            id: result.url || `result-${Date.now()}-${Math.random()}`,
            title: result.title || 'Untitled',
            content: result.content || result.snippet || '',
            url: result.url || '',
            type: 'web',
            score: result.score || 0,
            publishedDate: result.published_date || result.publishedDate || null
          }));
        } else if (Array.isArray(webResponse)) {
          // Fallback if response is directly an array
          formattedResults = webResponse.map((result: any): WebSearchResult => ({
            id: result.url || `result-${Date.now()}-${Math.random()}`,
            title: result.title || 'Untitled',
            content: result.content || result.snippet || '',
            url: result.url || '',
            type: 'web',
            score: result.score || 0,
            publishedDate: result.published_date || result.publishedDate || null
          }));
        }

        console.log(`Web search completed: ${formattedResults.length} results`);
        
        return NextResponse.json({ 
          webResults: formattedResults,
          items: [],
          folders: [],
          quizResults: []
        });
      } catch (error) {
        console.error('Web search error:', error);
        return NextResponse.json({ 
          error: 'Web search failed',
          webResults: [],
          items: [],
          folders: [],
          quizResults: []
        });
      }
    }

    // Handle database search using TiDB
    try {
      // Get user's default workspace using TiDB user ID
      const workspaces = await workspaceService.getByUserId(user.id);
      const defaultWorkspace = workspaces.find(w => w.isDefault) || workspaces[0];
      
      if (!defaultWorkspace) {
        console.log('No workspace found for TiDB user:', user.id);
        return NextResponse.json({
          items: [],
          folders: [],
          quizResults: [],
          webResults: []
        });
      }

      console.log('Using workspace:', defaultWorkspace.id);

      // Search dashboard items
      const items = await dashboardItemService.search(query, defaultWorkspace.id, user.id);
      
      // Search folders
      const folders = await folderService.search(query, defaultWorkspace.id, user.id);
      
      // Search quiz results
      const quizResults = await quizResultService.search(query, user.id);
      const knowledgeResults = await knowledgeStore.searchOwned({ userId: user.id, query, limit: 10 });

      console.log(`TiDB search completed: ${items.length} items, ${folders.length} folders, ${quizResults.length} quiz results`);

      return NextResponse.json({
        items: items,
        folders: folders,
        quizResults: quizResults,
        knowledgeResults,
        webResults: []
      });

    } catch (authError: any) {
      console.error('TiDB search authentication error:', authError);
      
      // If authentication fails, return empty results for database search
      return NextResponse.json({
        items: [],
        folders: [],
        quizResults: [],
        webResults: [],
        error: 'Authentication required for searching saved content'
      });
    }

  } catch (error: any) {
    console.error('Error in GET /api/dashboard/search:', error);
    return apiErrorResponse(error);
  }
}
