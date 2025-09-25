import { dashboardItemService } from '@/lib/tidb-service';

export interface DocumentContext {
  title: string;
  content: string;
  type: string;
  relevanceScore?: number;
}

export class DocumentContextService {
  async getDocumentContext(documentIds: string[]): Promise<string> {
    if (documentIds.length === 0) {
      return '';
    }

    try {
      // Fetch all documents in parallel
      const documents = await Promise.all(
        documentIds.map(async (docId) => {
          try {
            const item = await dashboardItemService.getById(docId);
            return item;
          } catch (error) {
            console.error(`Error fetching document ${docId}:`, error);
            return null;
          }
        })
      );

      // Filter out null results and extract relevant content
      const validDocuments = documents.filter(doc => doc !== null);
      
      if (validDocuments.length === 0) {
        return '';
      }

      // Build context string
      const contextParts = validDocuments.map((doc, index) => {
        const content = doc!.content || '';
        const truncatedContent = content.length > 2000 
          ? content.substring(0, 2000) + '...' 
          : content;

        return `Document ${index + 1}: ${doc!.title}
Type: ${doc!.fileType}
Content: ${truncatedContent}`;
      });

      return contextParts.join('\n\n---\n\n');

    } catch (error) {
      console.error('Error building document context:', error);
      return '';
    }
  }

  async getRelevantDocuments(topic: string, limit: number = 5): Promise<DocumentContext[]> {
    try {
      // This would need to be implemented in your dashboardItemService
      // For now, we'll return a placeholder
      console.warn('getRelevantDocuments not implemented - would search for documents related to topic:', topic);
      return [];
    } catch (error) {
      console.error('Error getting relevant documents:', error);
      return [];
    }
  }

  async extractKeyInformation(documentIds: string[], topic: string): Promise<string> {
    try {
      const context = await this.getDocumentContext(documentIds);
      
      if (!context.trim()) {
        return '';
      }

      // Use AI to extract key information relevant to the topic
      // This would integrate with your existing AI services
      const keyInfo = await this.extractKeyInfoWithAI(context, topic);
      
      return keyInfo;

    } catch (error) {
      console.error('Error extracting key information:', error);
      return '';
    }
  }

  private async extractKeyInfoWithAI(context: string, topic: string): Promise<string> {
    try {
      // Use Groq API to extract key information
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            {
              role: 'system',
              content: `You are an expert at extracting key information from documents that is relevant to a specific topic. 
              Your task is to analyze the provided documents and extract only the information that is directly relevant to the given topic.
              
              Focus on:
              - Key concepts and definitions
              - Important facts and data
              - Examples and case studies
              - Relevant explanations and details
              
              Ignore information that is not relevant to the topic.
              Return a concise summary of the relevant information.`
            },
            {
              role: 'user',
              content: `Topic: ${topic}
              
Documents:
${context}

Please extract the key information from these documents that is relevant to the topic "${topic}".`
            }
          ],
          temperature: 0.3,
          max_tokens: 1000,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices[0]?.message?.content;
        return content || '';
      }

      return '';

    } catch (error) {
      console.error('AI key extraction failed:', error);
      return '';
    }
  }

  async getDocumentSummary(documentIds: string[]): Promise<{ [docId: string]: string }> {
    try {
      const summaries: { [docId: string]: string } = {};

      for (const docId of documentIds) {
        try {
          const item = await dashboardItemService.getById(docId);
          if (item?.content) {
            // Use AI to generate a summary
            const summary = await this.generateDocumentSummary(item.content, item.title);
            summaries[docId] = summary;
          }
        } catch (error) {
          console.error(`Error summarizing document ${docId}:`, error);
          summaries[docId] = 'Summary not available';
        }
      }

      return summaries;

    } catch (error) {
      console.error('Error generating document summaries:', error);
      return {};
    }
  }

  private async generateDocumentSummary(content: string, title: string): Promise<string> {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            {
              role: 'system',
              content: `You are an expert at creating concise summaries of documents. Create a brief, informative summary that captures the key points and main ideas.`
            },
            {
              role: 'user',
              content: `Please summarize this document:

Title: ${title}

Content: ${content.substring(0, 3000)}${content.length > 3000 ? '...' : ''}`
            }
          ],
          temperature: 0.3,
          max_tokens: 500,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const summary = data.choices[0]?.message?.content;
        return summary || 'Summary not available';
      }

      return 'Summary not available';

    } catch (error) {
      console.error('AI summary generation failed:', error);
      return 'Summary not available';
    }
  }

  async getTopicRelevantSnippets(documentIds: string[], topic: string, maxSnippets: number = 3): Promise<string[]> {
    try {
      const context = await this.getDocumentContext(documentIds);
      
      if (!context.trim()) {
        return [];
      }

      // Use AI to extract the most relevant snippets
      const snippets = await this.extractRelevantSnippetsWithAI(context, topic, maxSnippets);
      
      return snippets;

    } catch (error) {
      console.error('Error extracting relevant snippets:', error);
      return [];
    }
  }

  private async extractRelevantSnippetsWithAI(context: string, topic: string, maxSnippets: number): Promise<string[]> {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            {
              role: 'system',
              content: `You are an expert at finding the most relevant snippets of text from documents. 
              Extract ${maxSnippets} specific quotes or passages that are most relevant to the given topic.
              Each snippet should be 1-3 sentences and directly related to the topic.
              Return them as a JSON array of strings.`
            },
            {
              role: 'user',
              content: `Topic: ${topic}
              
Documents:
${context}

Extract ${maxSnippets} most relevant snippets and return as JSON array.`
            }
          ],
          temperature: 0.3,
          max_tokens: 800,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices[0]?.message?.content;
        
        try {
          const snippets = JSON.parse(content);
          return Array.isArray(snippets) ? snippets : [];
        } catch (parseError) {
          console.error('Failed to parse snippets JSON:', parseError);
          return [];
        }
      }

      return [];

    } catch (error) {
      console.error('AI snippet extraction failed:', error);
      return [];
    }
  }
}
