import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/appwrite-server';
import { userService, researchQueryService, dashboardItemService, workspaceService } from '@/lib/tidb-service';
import { Groq } from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    // Get current user from JWT
    const appwriteUser = await getCurrentUser(req);
    if (!appwriteUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get user from TiDB database
    const dbUser = await userService.getByAppwriteUserId(appwriteUser.$id);
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found in database' }, { status: 404 });
    }

    const { 
      workspaceId = 'default',
      queryText,
      queryType = 'search',
      searchScope = 'all',
      documentIds = []
    } = await req.json();

    console.log('🔍 Research Assistant Query:', {
      userId: dbUser.id,
      workspaceId,
      queryText,
      queryType,
      searchScope,
      documentIds
    });

    // Get workspace - handle "default" workspace properly
    let actualWorkspaceId = workspaceId;
    if (workspaceId === 'default') {
      const userWorkspaces = await workspaceService.getByUserId(dbUser.id);
      if (userWorkspaces && userWorkspaces.length > 0) {
        const defaultWorkspace = userWorkspaces.find(w => w.isDefault) || userWorkspaces[0];
        actualWorkspaceId = defaultWorkspace.id;
        console.log("Using default workspace ID:", actualWorkspaceId);
      } else {
        return NextResponse.json(
          { error: 'No workspace found for user' },
          { status: 404 }
        );
      }
    } else {
      // Verify workspace belongs to user
      const workspace = await workspaceService.getById(workspaceId);
      if (!workspace || workspace.userId !== dbUser.id) {
        return NextResponse.json(
          { error: 'Workspace not found or access denied' },
          { status: 403 }
        );
      }
      actualWorkspaceId = workspaceId;
    }
    
    const workspace = { id: actualWorkspaceId };

    // Create research query record
    const researchQuery = await researchQueryService.create({
      userId: dbUser.id,
      workspaceId: workspace.id,
      queryText,
      queryType,
      searchScope: searchScope,
      documentIds: documentIds,
      confidenceScore: 0.0
    });

    try {
      // Step 1: Search across documents
      let searchResults = [];
      if (documentIds.length > 0) {
        // Search specific documents
        searchResults = await Promise.all(
          documentIds.map(async (id: string) => {
            const item = await dashboardItemService.getById(id);
            if (item && item.content && item.content.toLowerCase().includes(queryText.toLowerCase())) {
              return {
                id: item.id,
                title: item.title,
                content: item.content,
                relevance: calculateRelevance(item.content, queryText)
              };
            }
            return null;
          })
        );
        searchResults = searchResults.filter(result => result !== null);
      } else {
        // Search all user documents
        const allItems = await dashboardItemService.getAllByWorkspaceId(workspace.id);
        searchResults = allItems
          .filter(item => item.content && item.content.toLowerCase().includes(queryText.toLowerCase()))
          .map(item => ({
            id: item.id,
            title: item.title,
            content: item.content!,
            relevance: calculateRelevance(item.content!, queryText)
          }));
      }

      // Sort by relevance
      searchResults.sort((a, b) => b.relevance - a.relevance);

      console.log(`📊 Found ${searchResults.length} relevant documents`);

      // Step 2: Analyze findings using AI
      const analysisPrompt = `Analyze the following search results for the query: "${queryText}"

Query Type: ${queryType}
Search Scope: ${searchScope}

Search Results:
${searchResults.slice(0, 5).map((result, index) => `
Document ${index + 1}: ${result.title}
Content: ${result.content.substring(0, 1000)}...
Relevance: ${result.relevance}
`).join('\n')}

Based on this analysis, provide:

1. Key Findings: Summarize the main insights and answers to the query
2. Related Topics: Identify topics that are connected or worth exploring further
3. Follow-up Questions: Generate 3-5 thoughtful follow-up questions that deepen understanding
4. Source Documents: List the most relevant documents with brief explanations
5. Confidence Score: Rate your confidence in the findings (0.0 to 1.0)

Return JSON response:
{
  "keyFindings": [
    {
      "finding": "Main insight or answer",
      "confidence": 0.9,
      "sourceDocument": "document_title",
      "explanation": "Why this finding is important"
    }
  ],
  "relatedTopics": [
    {
      "topic": "Related topic name",
      "relevance": 0.8,
      "description": "Why this topic is relevant"
    }
  ],
  "followUpQuestions": [
    {
      "question": "Follow-up question",
      "type": "clarification|exploration|application",
      "priority": "high|medium|low"
    }
  ],
  "sourceDocuments": [
    {
      "documentId": "doc_id",
      "title": "Document title",
      "relevanceScore": 0.9,
      "keyInsights": ["insight1", "insight2"]
    }
  ],
  "overallConfidence": 0.85,
  "analysisSummary": "Brief summary of the research findings"
}`;

      const analysisCompletion = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: `You are an expert research assistant that analyzes information across multiple documents. You identify key insights, connections, and gaps in knowledge. You provide comprehensive analysis with confidence scores. You MUST respond with valid JSON only. Do not include any text before or after the JSON object.`
          },
          {
            role: "user",
            content: analysisPrompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2500,
      });

      const analysisResponse = analysisCompletion.choices[0]?.message?.content?.trim();
      if (!analysisResponse) {
        throw new Error('No response from AI analysis');
      }

      // Parse the AI response
      let analysisData;
      try {
        const jsonMatch = analysisResponse.match(/\{[\s\S]*\}/);
        const jsonString = jsonMatch ? jsonMatch[0] : analysisResponse;
        analysisData = JSON.parse(jsonString);
      } catch (parseError) {
        console.error('Failed to parse AI response:', analysisResponse);
        throw new Error('Invalid AI response format');
      }

      // Step 3: Update research query with findings
      const updateData = {
        searchResults: {
          keyFindings: analysisData.keyFindings || [],
          sourceDocuments: analysisData.sourceDocuments || []
        },
        summary: `Found ${analysisData.keyFindings?.length || 0} key findings related to "${queryText}"`,
        relatedTopics: analysisData.relatedTopics || [],
        followUpQuestions: analysisData.followUpQuestions || [],
        confidenceScore: Number(analysisData.overallConfidence) || 0.5
      };
      
      console.log('Updating research query with data:', JSON.stringify(updateData, null, 2));
      await researchQueryService.update(researchQuery.id, updateData);

      // Step 4: Generate synthesis and recommendations
      const synthesisPrompt = `Based on the research findings, create a comprehensive synthesis:

Research Query: "${queryText}"
Key Findings: ${JSON.stringify(analysisData.keyFindings || [])}
Related Topics: ${JSON.stringify(analysisData.relatedTopics || [])}

Create a synthesis that:
1. Synthesizes the key findings into coherent insights
2. Identifies knowledge gaps or areas needing further research
3. Suggests next steps for deeper exploration
4. Provides actionable recommendations

Return JSON:
{
  "synthesis": "Comprehensive synthesis of findings",
  "knowledgeGaps": ["gap1", "gap2"],
  "recommendations": ["recommendation1", "recommendation2"],
  "nextSteps": ["step1", "step2"],
  "connections": [
    {
      "concept1": "concept name",
      "concept2": "related concept",
      "connection": "type of relationship"
    }
  ]
}`;

      const synthesisCompletion = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: "You are an expert synthesizer that creates comprehensive insights from research findings. You identify patterns, gaps, and actionable next steps. You MUST respond with valid JSON only. Do not include any text before or after the JSON object."
          },
          {
            role: "user",
            content: synthesisPrompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1500,
      });

      const synthesisResponse = synthesisCompletion.choices[0]?.message?.content?.trim();
      if (synthesisResponse) {
        try {
          // Extract JSON from response - look for JSON object
          const jsonMatch = synthesisResponse.match(/\{[\s\S]*\}/);
          const jsonString = jsonMatch ? jsonMatch[0] : synthesisResponse;
          const synthesisData = JSON.parse(jsonString);
          
          // Update research query with synthesis
          await researchQueryService.update(researchQuery.id, {
            searchResults: {
              keyFindings: [
                ...(analysisData.keyFindings || []),
                {
                  finding: synthesisData.synthesis,
                  confidence: analysisData.overallConfidence || 0.5,
                  sourceDocument: "synthesis",
                  explanation: "Comprehensive synthesis of research findings",
                  type: "synthesis"
                }
              ],
              sourceDocuments: analysisData.sourceDocuments || []
            },
            relatedTopics: [
              ...(analysisData.relatedTopics || []),
              ...(synthesisData.knowledgeGaps || []).map((gap: string) => ({
                topic: gap,
                relevance: 0.7,
                description: "Identified knowledge gap requiring further research",
                type: "knowledge_gap"
              }))
            ]
          });

          console.log('✅ Research analysis completed with synthesis');

          return NextResponse.json({
            success: true,
            researchQuery: {
              id: researchQuery.id,
              queryText,
              queryType,
              confidenceScore: analysisData.overallConfidence || 0.5
            },
            findings: analysisData.keyFindings || [],
            relatedTopics: analysisData.relatedTopics || [],
            followUpQuestions: analysisData.followUpQuestions || [],
            sourceDocuments: analysisData.sourceDocuments || [],
            synthesis: {
              summary: synthesisData.synthesis,
              knowledgeGaps: synthesisData.knowledgeGaps || [],
              recommendations: synthesisData.recommendations || [],
              nextSteps: synthesisData.nextSteps || [],
              connections: synthesisData.connections || []
            },
            searchStats: {
              documentsSearched: searchResults.length,
              relevantDocuments: analysisData.sourceDocuments?.length || 0,
              overallConfidence: analysisData.overallConfidence || 0.5
            }
          });

        } catch (synthesisParseError) {
          console.warn('Failed to parse synthesis response:', synthesisParseError);
          console.warn('Raw synthesis response:', synthesisResponse);
          
          // Create a fallback synthesis object
          const fallbackSynthesis = {
            synthesis: synthesisResponse || "Analysis completed but synthesis parsing failed",
            knowledgeGaps: [],
            recommendations: [],
            nextSteps: [],
            connections: []
          };
          
          // Update research query with fallback synthesis
          await researchQueryService.update(researchQuery.id, {
            searchResults: {
              keyFindings: [
                ...(analysisData.keyFindings || []),
                {
                  finding: fallbackSynthesis.synthesis,
                  confidence: analysisData.overallConfidence || 0.5,
                  sourceDocument: "synthesis",
                  explanation: "Synthesis generated from research findings",
                  type: "synthesis"
                }
              ],
              sourceDocuments: analysisData.sourceDocuments || []
            }
          });
        }
      }

      // Fallback response without synthesis
      return NextResponse.json({
        success: true,
        researchQuery: {
          id: researchQuery.id,
          queryText,
          queryType,
          confidenceScore: analysisData.overallConfidence || 0.5
        },
        findings: analysisData.keyFindings || [],
        relatedTopics: analysisData.relatedTopics || [],
        followUpQuestions: analysisData.followUpQuestions || [],
        sourceDocuments: analysisData.sourceDocuments || [],
        searchStats: {
          documentsSearched: searchResults.length,
          relevantDocuments: analysisData.sourceDocuments?.length || 0,
          overallConfidence: analysisData.overallConfidence || 0.5
        }
      });

    } catch (analysisError) {
      // Update query status to failed
      await researchQueryService.update(researchQuery.id, {
        summary: 'Research query processing failed',
        confidenceScore: 0.0
      });
      throw analysisError;
    }

  } catch (error: any) {
    console.error('Research assistant error:', error);
    return NextResponse.json(
      { error: 'Failed to process research query', details: error.message },
      { status: 500 }
    );
  }
}

// Helper function to calculate relevance score
function calculateRelevance(content: string, query: string): number {
  const contentLower = content.toLowerCase();
  const queryLower = query.toLowerCase();
  
  // Simple relevance calculation based on keyword frequency and position
  const queryWords = queryLower.split(/\s+/);
  let score = 0;
  
  queryWords.forEach(word => {
    if (word.length > 2) { // Skip short words
      const matches = (contentLower.match(new RegExp(word, 'g')) || []).length;
      score += matches;
      
      // Bonus for early occurrence
      const firstMatch = contentLower.indexOf(word);
      if (firstMatch !== -1 && firstMatch < content.length * 0.1) {
        score += 2;
      }
    }
  });
  
  // Normalize score
  return Math.min(score / queryWords.length, 1.0);
}
