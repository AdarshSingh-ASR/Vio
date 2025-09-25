import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/appwrite-server';
import { dashboardItemService, workspaceService, videoGenerationService, userService } from '@/lib/tidb-service';
import { EnhancedVideoGenerator, ScriptGenerationAgent } from '../../../../lib/video-generator';
import { VideoGenerationRequest, VideoGenerationResponse } from '../../../../types/video';
import { VideoScript } from '../../../../lib/video-generator/types';

// Remove duplicate interfaces - using types from video-generator/types.ts

export async function POST(request: NextRequest) {
  try {
    const appwriteUser = await getCurrentUser(request);
    if (!appwriteUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get database user from Appwrite user
    const dbUser = await userService.getByAppwriteUserId(appwriteUser.$id);
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found in database' }, { status: 404 });
    }

    const body: VideoGenerationRequest = await request.json();
    const { topic, selectedDocuments = [], learningLevel, videoStyle, duration, includeExamples, includeVisuals, includeQuiz } = body;

    // Get user's workspace
    const workspace = await workspaceService.getDefaultByUserId(dbUser.id);
    if (!workspace) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 });
    }

    // Get context from selected documents
    let documentContext = '';
    if (selectedDocuments.length > 0) {
      const documents = await Promise.all(
        selectedDocuments.map(async (docId) => {
          try {
            const item = await dashboardItemService.getById(docId);
            return item;
          } catch (error) {
            console.error(`Error fetching document ${docId}:`, error);
            return null;
          }
        })
      );

      const validDocuments = documents.filter(doc => doc !== null);
      documentContext = validDocuments
        .map(doc => `Document: ${doc!.title}\nContent: ${doc!.content?.substring(0, 2000)}...`)
        .join('\n\n');
    }

    // Generate video script using AI
    const scriptAgent = new ScriptGenerationAgent();
    const videoScript = await scriptAgent.generateScript({
      topic,
      documentContext,
      learningLevel,
      videoStyle,
      duration,
      includeExamples,
      includeVisuals,
      includeQuiz
    });

    // Convert VideoScript to the format expected by the frontend
    const frontendScript = convertToFrontendScript(videoScript);

    // Generate actual video using enhanced video generator
    const enhancedGenerator = new EnhancedVideoGenerator({
      chunkDuration: 5,
      totalDuration: duration * 60,
      quality: 'medium',
      resolution: '1280x720',
      frameRate: 30,
      voiceSettings: {
        language: 'en',
        speed: 1.0,
        pitch: 1.0
      },
      visualSettings: {
        style: 'mixed',
        colorScheme: '3blue1brown',
        animationStyle: 'smooth'
      }
    });

    // For now, we'll return the script and let the client handle video generation
    // In a full implementation, you could generate the video server-side here
    const response: VideoGenerationResponse = {
      success: true,
      script: frontendScript
    };

    // Store video generation request in database
    const videoRequest = await videoGenerationService.create({
      userId: dbUser.id,
      workspaceId: workspace.id,
      topic,
      selectedDocuments,
      learningLevel,
      videoStyle,
      durationMinutes: duration,
      includeExamples,
      includeVisuals,
      includeQuiz,
      script: frontendScript,
      status: 'generated'
    });

    response.videoRequest = videoRequest;

    return NextResponse.json(response);

  } catch (error) {
    console.error('Video generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate video script' },
      { status: 500 }
    );
  }
}

// Convert VideoScript from video-generator format to frontend format
function convertToFrontendScript(videoScript: VideoScript): any {
  return {
    title: videoScript.title,
    introduction: videoScript.scenes[0]?.narration || `Welcome to this educational video about ${videoScript.title}!`,
    sections: videoScript.scenes.map((scene, index) => ({
      title: scene.title,
      content: scene.narration,
      examples: scene.keyConcepts || [],
      visualElements: [scene.visualDescription],
      duration: scene.durationSeconds / 60 // Convert to minutes
    })),
    conclusion: videoScript.scenes[videoScript.scenes.length - 1]?.narration || 'Thank you for watching!',
    quizQuestions: [], // Could be generated separately if needed
    visualSuggestions: videoScript.scenes.map((scene, index) => ({
      type: scene.animationType === 'mathematical' ? 'diagram' : 'animation',
      description: scene.visualDescription,
      timing: index * 30 // Approximate timing
    })),
    estimatedDuration: videoScript.totalDuration / 60 // Convert to minutes
  };
}

// Legacy functions removed - now handled by ScriptGenerationAgent
