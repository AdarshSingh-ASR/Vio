import { tavily } from "@tavily/core";

// Initialize Tavily client
export const tvly = tavily({ 
  apiKey: process.env.TAVILY_API_KEY!,
});

// Helper functions for common operations
export const searchWeb = async (query: string, options?: any) => {
  try {
    const response = await tvly.search(query, options);
    return response;
  } catch (error) {
    console.error("Tavily search error:", error);
    throw error;
  }
};

export const extractContent = async (urls: string[]) => {
  try {
    const response = await tvly.extract(urls);
    return response;
  } catch (error) {
    console.error("Tavily extract error:", error);
    throw error;
  }
}; 