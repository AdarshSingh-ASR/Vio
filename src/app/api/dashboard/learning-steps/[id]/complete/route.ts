import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/appwrite-server';
import { userService, learningStepService, learningPathService } from '@/lib/tidb-service';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get current user from JWT
    const appwriteUser = await getCurrentUser(request);
    if (!appwriteUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get user from TiDB database
    const dbUser = await userService.getByAppwriteUserId(appwriteUser.$id);
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found in database' }, { status: 404 });
    }

    const stepId = params.id;
    const body = await request.json();
    const { isCompleted } = body;

    if (typeof isCompleted !== 'boolean') {
      return NextResponse.json({ error: 'isCompleted must be a boolean' }, { status: 400 });
    }

    // Get the learning step
    const learningStep = await learningStepService.getById(stepId);
    if (!learningStep) {
      return NextResponse.json({ error: 'Learning step not found' }, { status: 404 });
    }

    // Verify the learning path belongs to the user
    const learningPath = await learningPathService.getById(learningStep.learningPathId);
    if (!learningPath) {
      return NextResponse.json({ error: 'Learning path not found' }, { status: 404 });
    }

    if (learningPath.userId !== dbUser.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Update the learning step
    const updatedStep = await learningStepService.update(stepId, {
      isCompleted,
      completedAt: isCompleted ? new Date() : undefined
    });

    // Calculate updated progress for the learning path
    const allSteps = await learningStepService.getByLearningPathId(learningStep.learningPathId);
    const completedSteps = allSteps.filter(step => step.isCompleted).length;
    const progressPercentage = Math.round((completedSteps / allSteps.length) * 100);

    // Update the learning path progress
    await learningPathService.update(learningStep.learningPathId, {
      progressPercentage
    });

    console.log(`Updated step ${stepId} completion: ${isCompleted}, Path progress: ${progressPercentage}%`);

    return NextResponse.json({
      success: true,
      learningStep: updatedStep,
      progressPercentage
    });

  } catch (error: any) {
    console.error('Error in PATCH /api/dashboard/learning-steps/[id]/complete:', error);
    
    if (error.message?.includes('JWT') || error.message?.includes('Authentication')) {
      return NextResponse.json(
        { error: 'Authentication required', details: error.message },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to update step completion', details: error.message },
      { status: 500 }
    );
  }
}
