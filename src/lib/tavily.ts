import { tavily } from "@tavily/core";

const getClient = () => {
  const apiKey = process.env.TAVILY_API_KEY?.trim();
  if (!apiKey) throw new Error("Tavily web search is not configured. Set TAVILY_API_KEY to enable it.");
  return tavily({ apiKey });
};

// Helper functions for common operations
export const searchWeb = async (query: string, options?: any) => {
  try {
    const response = await getClient().search(query, options);
    return response;
  } catch (error) {
    console.error("Tavily search error:", error);
    throw error;
  }
};

export const extractContent = async (urls: string[]) => {
  try {
    const response = await getClient().extract(urls);
    return response;
  } catch (error) {
    console.error("Tavily extract error:", error);
    throw error;
  }
};
