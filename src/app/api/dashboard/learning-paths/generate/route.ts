import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/appwrite-server';
import { userService, learningPathService, learningStepService, dashboardItemService, workspaceService } from '@/lib/tidb-service';
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
      subjectArea,
      difficultyLevel = 'beginner',
      learningObjectives,
      documentIds = []
    } = await req.json();

    console.log('🎯 Learning Path Generation Request:', {
      userId: dbUser.id,
      workspaceId,
      subjectArea,
      difficultyLevel,
      learningObjectives,
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

    // Get documents for analysis
    let documents = [];
    if (documentIds.length > 0) {
      documents = await Promise.all(
        documentIds.map(async (id: string) => {
          const item = await dashboardItemService.getById(id);
          return item ? {
            id: item.id,
            title: item.title,
            content: item.content,
            fileType: item.fileType
          } : null;
        })
      );
      documents = documents.filter(doc => doc !== null);
    } else {
      // Get all user documents if no specific documents provided
      console.log('Fetching documents for workspace:', workspace.id);
      const allItems = await dashboardItemService.getAllByWorkspaceId(workspace.id);
      console.log('Found items:', allItems.length, allItems.map(item => ({ id: item.id, title: item.title, hasContent: !!item.content })));
      documents = allItems.map(item => ({
        id: item.id,
        title: item.title,
        content: item.content,
        fileType: item.fileType
      }));
    }

    if (documents.length === 0) {
      return NextResponse.json({ error: 'No documents found for learning path generation' }, { status: 400 });
    }

    console.log(`📚 Analyzing ${documents.length} documents for learning path generation`);

    // Step 1: Analyze documents and identify knowledge gaps
    const analysisPrompt = `Analyze the following documents and create a comprehensive learning path. 

Subject Area: ${subjectArea || 'General Knowledge'}
Difficulty Level: ${difficultyLevel}
Learning Objectives: ${learningObjectives || 'Comprehensive understanding of the content'}

Documents to analyze:
${documents.map(doc => `
Title: ${doc.title}
Type: ${doc.fileType}
Content: ${doc.content.substring(0, 1500)}...
`).join('\n')}

Based on this analysis, create a structured learning path with the following components:

1. Knowledge Gap Analysis: Identify what concepts are missing or need reinforcement
2. Learning Objectives: Define clear, measurable objectives
3. Learning Steps: Create a sequence of learning activities including:
   - Reading steps (content review)
   - Quiz steps (knowledge testing)
   - Listening steps (audio comprehension)
   - Review steps (reinforcement)
   - Practice steps (application)

Return ONLY a valid JSON response with this exact structure. Do not include any markdown formatting, explanations, or additional text:
{
  "title": "Learning Path Title",
  "description": "Detailed description of the learning path",
  "subjectArea": "Subject area",
  "difficultyLevel": "${difficultyLevel}",
  "estimatedDuration": 120,
  "knowledgeGaps": ["gap1", "gap2", "gap3"],
  "learningObjectives": ["objective1", "objective2", "objective3"],
  "learningSteps": [
    {
      "stepOrder": 1,
      "stepType": "reading",
      "title": "Step Title",
      "description": "Step description",
      "contentReferences": [],
      "prerequisites": [],
      "learningObjectives": ["objective1"],
      "estimatedDuration": 30,
      "completionCriteria": {"type": "read_complete", "threshold": 0.8},
      "adaptiveDifficulty": true
    }
  ]
}

IMPORTANT: 
- Prerequisites should be arrays of step numbers (e.g., [1, 2]) or empty arrays []
- Content references should be empty arrays [] unless referencing specific document IDs
- Ensure all JSON syntax is valid with proper commas and brackets

Ensure the learning steps build upon each other logically and progressively increase in complexity.`;

    const analysisCompletion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: `You are an expert educational designer that creates personalized learning paths. You analyze content, identify knowledge gaps, and design progressive learning experiences that adapt to learner needs. 

CRITICAL: You must return ONLY valid JSON. No markdown formatting, no explanations, no additional text. The response must be parseable JSON that can be directly used by a computer system.`
        },
        {
          role: "user",
          content: analysisPrompt
        }
      ],
      temperature: 0.7,
      max_tokens: 3000,
    });

    const analysisResponse = analysisCompletion.choices[0]?.message?.content?.trim();
    if (!analysisResponse) {
      throw new Error('No response from AI analysis');
    }

    // Parse the AI response
    let learningPathData;
    try {
      // Extract JSON from markdown code block or use entire response
      const jsonMatch = analysisResponse.match(/```json\s*([\s\S]*?)\s*```/);
      let jsonString = jsonMatch ? jsonMatch[1] : analysisResponse;
      
      // If no code block, try to find JSON object
      if (!jsonMatch) {
        const jsonObjectMatch = analysisResponse.match(/\{[\s\S]*\}/);
        jsonString = jsonObjectMatch ? jsonObjectMatch[0] : analysisResponse;
      }
      
      // Clean up common AI response formatting issues
      jsonString = jsonString
        // Fix common prerequisite format issues
        .replace(/"prerequisites":\s*\[\s*"stepOrder":\s*(\d+)\s*\]/g, '"prerequisites": [$1]')
        // Remove any trailing commas before closing brackets/braces
        .replace(/,(\s*[}\]])/g, '$1')
        // Fix any malformed JSON structures
        .replace(/"contentReferences":\s*\["document_id_\d+"\]/g, '"contentReferences": []');
      
      console.log('Cleaned JSON string:', jsonString.substring(0, 500) + '...');
      learningPathData = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError instanceof Error ? parseError.message : 'Unknown parse error');
      console.error('AI response snippet:', analysisResponse.substring(0, 1000) + '...');        
      throw new Error('Invalid AI response format');
    }

    // Validate the learning path structure
    if (!learningPathData.title || !learningPathData.learningSteps || !Array.isArray(learningPathData.learningSteps)) {
      throw new Error('Invalid learning path structure from AI');
    }

    // Step 2: Create learning path in database
    const learningPath = await learningPathService.create({
      userId: dbUser.id,
      workspaceId: workspace.id,
      title: learningPathData.title,
      description: learningPathData.description,
      subjectArea: learningPathData.subjectArea || subjectArea,
      difficultyLevel: learningPathData.difficultyLevel || difficultyLevel,
      estimatedDuration: learningPathData.estimatedDuration || 120,
      status: 'draft',
      knowledgeGaps: learningPathData.knowledgeGaps || [],
      learningObjectives: learningPathData.learningObjectives || [],
      progressPercentage: 0
    });

    console.log(`✅ Created learning path: ${learningPath.id}`);

    // Step 3: Create learning steps
    const createdSteps = [];
    for (const stepData of learningPathData.learningSteps) {
      const step = await learningStepService.create({
        learningPathId: learningPath.id,
        stepOrder: stepData.stepOrder,
        stepType: stepData.stepType,
        title: stepData.title,
        description: stepData.description,
        contentReferences: stepData.contentReferences || [],
        prerequisites: stepData.prerequisites || [],
        learningObjectives: stepData.learningObjectives || [],
        estimatedDuration: stepData.estimatedDuration || 15,
        isCompleted: false,
        completionCriteria: stepData.completionCriteria || { type: 'complete', threshold: 0.8 },
        adaptiveDifficulty: stepData.adaptiveDifficulty || false
      });
      createdSteps.push(step);
    }

    console.log(`✅ Created ${createdSteps.length} learning steps`);

    // Step 4: Generate progressive quizzes for quiz steps
    const quizSteps = createdSteps.filter(step => step.stepType === 'quiz');
    for (const step of quizSteps) {
      if (step.contentReferences && step.contentReferences.length > 0) {
        try {
          // Generate quiz for this step's content
          const document = documents.find(doc => step.contentReferences.includes(doc.id));
          if (document) {
            const quizPrompt = `Create 3 multiple choice questions based on this content for a ${step.learningObjectives.join(', ')} learning objective:

Content: ${document.content.substring(0, 2000)}

Return JSON array:
[
  {
    "question": "Question text",
    "options": ["A", "B", "C", "D"],
    "correctAnswer": 0,
    "explanation": "Why this is correct",
    "topic": "Learning objective topic"
  }
]`;

            const quizCompletion = await groq.chat.completions.create({
              model: "llama-3.1-8b-instant",
              messages: [
                {
                  role: "system",
                  content: "You are an expert quiz creator. Create educational questions that test understanding. Return only valid JSON arrays."
                },
                {
                  role: "user",
                  content: quizPrompt
                }
              ],
              temperature: 0.7,
              max_tokens: 1500,
            });

            const quizResponse = quizCompletion.choices[0]?.message?.content?.trim();
            if (quizResponse) {
              try {
                const questions = JSON.parse(quizResponse);
                // Store generated questions in step's completion criteria
                await learningStepService.update(step.id, {
                  completionCriteria: {
                    ...step.completionCriteria,
                    questions: questions,
                    type: 'quiz_complete',
                    threshold: 0.7
                  }
                });
                console.log(`✅ Generated quiz for step: ${step.title}`);
              } catch (quizParseError) {
                console.warn('Failed to parse quiz questions for step:', step.title);
              }
            }
          }
        } catch (error) {
          console.warn('Failed to generate quiz for step:', step.title, error);
        }
      }
    }

    // Step 5: Schedule review sessions
    const reviewSteps = createdSteps.filter(step => step.stepType === 'review');
    for (const step of reviewSteps) {
      // Create scheduled review session
      await learningStepService.update(step.id, {
        completionCriteria: {
          ...step.completionCriteria,
          reviewSchedule: 'spaced_repetition',
          intervals: [1, 3, 7, 14], // days
          type: 'review_complete'
        }
      });
    }

    return NextResponse.json({
      success: true,
      learningPath: {
        id: learningPath.id,
        title: learningPath.title,
        description: learningPath.description,
        subjectArea: learningPath.subjectArea,
        difficultyLevel: learningPath.difficultyLevel,
        estimatedDuration: learningPath.estimatedDuration,
        knowledgeGaps: learningPath.knowledgeGaps,
        learningObjectives: learningPath.learningObjectives,
        progressPercentage: learningPath.progressPercentage,
        status: learningPath.status
      },
      learningSteps: createdSteps.map(step => ({
        id: step.id,
        stepOrder: step.stepOrder,
        stepType: step.stepType,
        title: step.title,
        description: step.description,
        estimatedDuration: step.estimatedDuration,
        isCompleted: step.isCompleted,
        adaptiveDifficulty: step.adaptiveDifficulty
      })),
      stats: {
        totalSteps: createdSteps.length,
        readingSteps: createdSteps.filter(s => s.stepType === 'reading').length,
        quizSteps: createdSteps.filter(s => s.stepType === 'quiz').length,
        listeningSteps: createdSteps.filter(s => s.stepType === 'listening').length,
        reviewSteps: createdSteps.filter(s => s.stepType === 'review').length,
        practiceSteps: createdSteps.filter(s => s.stepType === 'practice').length
      }
    });

  } catch (error: any) {
    console.error('Learning path generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate learning path', details: error.message },
      { status: 500 }
    );
  }
}
