import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedServices } from '@/lib/appwrite-server';
import { dashboardItemService, folderService, quizResultService, workspaceService, userService } from '@/lib/tidb-service';
import { searchWeb } from "@/lib/tavily";

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
      const { user } = await getAuthenticatedServices(req);
      
      console.log('Performing TiDB search for Appwrite user:', user.$id);
      
      // Get TiDB user by Appwrite user ID
      const tidbUser = await userService.getByAppwriteUserId(user.$id);
      if (!tidbUser) {
        console.log('No TiDB user found for Appwrite user:', user.$id);
        return NextResponse.json({
          items: [],
          folders: [],
          quizResults: [],
          webResults: []
        });
      }
      
      console.log('Found TiDB user:', tidbUser.id);
      
      // Get user's default workspace using TiDB user ID
      const workspaces = await workspaceService.getByUserId(tidbUser.id);
      const defaultWorkspace = workspaces.find(w => w.isDefault) || workspaces[0];
      
      if (!defaultWorkspace) {
        console.log('No workspace found for TiDB user:', tidbUser.id);
        return NextResponse.json({
          items: [],
          folders: [],
          quizResults: [],
          webResults: []
        });
      }

      console.log('Using workspace:', defaultWorkspace.id);

      // Search dashboard items
      const items = await dashboardItemService.search(query, defaultWorkspace.id, tidbUser.id);
      
      // Search folders
      const folders = await folderService.search(query, defaultWorkspace.id, tidbUser.id);
      
      // Search quiz results
      const quizResults = await quizResultService.search(query, tidbUser.id);

      console.log(`TiDB search completed: ${items.length} items, ${folders.length} folders, ${quizResults.length} quiz results`);

      return NextResponse.json({
        items: items,
        folders: folders,
        quizResults: quizResults,
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
    
    return NextResponse.json(
      { error: 'Search failed', details: error.message },
      { status: 500 }
    );
  }
}

// TODO: Integrate Tavily for web search in addition to database search
// import { tavily } from "@tavily/core";
// const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });
// Use tvly.search(query) for web search results 