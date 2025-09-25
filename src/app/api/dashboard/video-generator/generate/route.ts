import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/appwrite-server';
import { userService, workspaceService, videoGenerationService } from '@/lib/tidb-service';
import { EnhancedVideoGenerator, ScriptGenerationAgent } from '@/lib/video-generator';
import { VideoScript } from '@/lib/video-generator/types';

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

    const body = await request.json();
    const { 
      script, // VideoScript object from frontend
      config, // VideoGenerationConfig object from frontend
      documentIds = [] // Array of document IDs
    } = body;

    if (!script) {
      return NextResponse.json({ error: 'Script is required' }, { status: 400 });
    }

    // Get user's workspace
    const workspace = await workspaceService.getDefaultByUserId(dbUser.id);
    if (!workspace) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 });
    }

    // Create enhanced video generator with provided config
    const enhancedGenerator = new EnhancedVideoGenerator(config || {
      chunkDuration: 5,
      totalDuration: script.totalDuration,
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

    // Generate video with progress tracking
    const result = await enhancedGenerator.generateVideo(
      script,
      (progress) => {
        console.log(`Video generation progress: ${progress.progress * 100}% - ${progress.message}`);
        // In a real implementation, you could use WebSockets or Server-Sent Events
        // to send progress updates to the client
      },
      dbUser.id, // userId
      documentIds // documentIds
    );

    if (result.success) {
      // Store video generation request in database
      const videoRequest = await videoGenerationService.create({
        userId: dbUser.id,
        workspaceId: workspace.id,
        topic: script.title,
        selectedDocuments: documentIds,
        learningLevel: script.targetAudience,
        videoStyle: 'explainer',
        durationMinutes: script.totalDuration / 60,
        includeExamples: true,
        includeVisuals: true,
        includeQuiz: false,
        script: script,
        status: 'completed'
      });

      return NextResponse.json({
        success: true,
        videoRequest,
        videoUrl: result.videoUrl,
        audioUrl: result.audioUrl,
        previewUrl: result.previewUrl,
        metadata: result.metadata
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error || 'Video generation failed',
        errorCode: result.errorCode,
        recoverable: result.recoverable
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Video generation error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to generate video',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check video generation status
export async function GET(request: NextRequest) {
  try {
    const appwriteUser = await getCurrentUser(request);
    if (!appwriteUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const videoRequestId = searchParams.get('id');

    if (!videoRequestId) {
      return NextResponse.json({ error: 'Video request ID is required' }, { status: 400 });
    }

    // Get database user from Appwrite user
    const dbUser = await userService.getByAppwriteUserId(appwriteUser.$id);
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found in database' }, { status: 404 });
    }

    // Fetch video generation request
    const videoRequest = await videoGenerationService.getById(videoRequestId);
    if (!videoRequest || videoRequest.userId !== dbUser.id) {
      return NextResponse.json({ error: 'Video request not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      videoRequest
    });

  } catch (error) {
    console.error('Error fetching video request:', error);
    return NextResponse.json(
      { error: 'Failed to fetch video request' },
      { status: 500 }
    );
  }
}
