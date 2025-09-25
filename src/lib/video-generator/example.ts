/**
 * Example usage of the Video Generator System
 * 
 * This file demonstrates how to use the video generator in different scenarios:
 * 1. Basic script generation
 * 2. Full video generation with progress tracking
 * 3. Integration with document context
 * 4. Error handling and fallbacks
 */

import { EnhancedVideoGenerator, ScriptGenerationAgent } from './index';
import { VideoStorageService } from './storage-integration';
import { DocumentContextService } from './document-context';
import { VideoGenerationErrorHandler } from './error-handling';

// Example 1: Basic Script Generation
export async function generateBasicScript() {
  console.log('🎬 Example 1: Basic Script Generation');
  
  const scriptAgent = new ScriptGenerationAgent();
  
  try {
    const script = await scriptAgent.generateScript({
      topic: 'How does blockchain work?',
      learningLevel: 'beginner',
      videoStyle: 'explainer',
      duration: 5,
      includeExamples: true,
      includeVisuals: true,
      includeQuiz: false
    });

    console.log('✅ Script generated successfully!');
    console.log('Title:', script.title);
    console.log('Duration:', script.totalDuration, 'seconds');
    console.log('Scenes:', script.scenes.length);
    
    return script;
  } catch (error) {
    console.error('❌ Script generation failed:', error);
    throw error;
  }
}

// Example 2: Full Video Generation with Progress Tracking
async function generateFullVideo() {
  console.log('🎬 Example 2: Full Video Generation');
  
  // Create video generator with custom configuration
  const generator = new EnhancedVideoGenerator({
    chunkDuration: 3, // 3-second chunks for faster processing
    totalDuration: 30, // 30-second video
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

  // Generate script first
  const scriptAgent = new ScriptGenerationAgent();
  const script = await scriptAgent.generateScript({
    topic: 'Machine Learning Basics',
    learningLevel: 'intermediate',
    videoStyle: 'tutorial',
    duration: 0.5, // 30 seconds
    includeExamples: true,
    includeVisuals: true,
    includeQuiz: false
  });

  // Generate video with progress tracking
  const result = await generator.generateVideo(
    script,
    (progress) => {
      console.log(`📊 Progress: ${Math.round(progress.progress * 100)}% - ${progress.message}`);
    },
    'user123', // User ID for storage
    [] // Document IDs (empty for this example)
  );

  if (result.success) {
    console.log('✅ Video generated successfully!');
    console.log('Video URL:', result.videoUrl);
    console.log('Audio URL:', result.audioUrl);
    console.log('Preview URL:', result.previewUrl);
    console.log('Generation time:', result.metadata?.generationTime, 'ms');
    console.log('File size:', result.metadata?.fileSize, 'bytes');
  } else {
    console.error('❌ Video generation failed:', result.error);
    console.error('Error code:', result.errorCode);
    console.error('Recoverable:', result.recoverable);
  }

  return result;
}

// Example 3: Integration with Document Context
async function generateVideoWithDocuments() {
  console.log('🎬 Example 3: Video Generation with Document Context');
  
  const documentService = new DocumentContextService();
  const scriptAgent = new ScriptGenerationAgent();
  
  // Get context from documents
  const documentIds = ['doc1', 'doc2', 'doc3'];
  const documentContext = await documentService.getDocumentContext(documentIds);
  
  // Extract key information relevant to the topic
  const keyInfo = await documentService.extractKeyInformation(
    documentIds,
    'Artificial Intelligence'
  );

  // Generate script with document context
  const script = await scriptAgent.generateScript({
    topic: 'Artificial Intelligence',
    documentContext: keyInfo || documentContext,
    learningLevel: 'advanced',
    videoStyle: 'interactive',
    duration: 10,
    includeExamples: true,
    includeVisuals: true,
    includeQuiz: true
  });

  console.log('✅ Script generated with document context!');
  console.log('Context length:', documentContext.length);
  console.log('Key info length:', keyInfo.length);
  
  return script;
}

// Example 4: Error Handling and Fallbacks
async function demonstrateErrorHandling() {
  console.log('🎬 Example 4: Error Handling and Fallbacks');
  
  // Validate environment first
  const envValidation = await VideoGenerationErrorHandler.validateEnvironment();
  if (!envValidation.valid) {
    console.warn('⚠️ Environment issues detected:');
    envValidation.issues.forEach(issue => console.warn('-', issue));
  }

  const generator = new EnhancedVideoGenerator({
    chunkDuration: 5,
    totalDuration: 60,
    quality: 'high' // Use high quality to potentially trigger errors
  });

  const scriptAgent = new ScriptGenerationAgent();

  try {
    // This might fail due to resource constraints
    const script = await scriptAgent.generateScript({
      topic: 'Quantum Computing',
      learningLevel: 'advanced',
      videoStyle: 'explainer',
      duration: 10,
      includeExamples: true,
      includeVisuals: true,
      includeQuiz: true
    });

    const result = await generator.generateVideo(
      script,
      (progress) => {
        console.log(`📊 Progress: ${Math.round(progress.progress * 100)}% - ${progress.message}`);
      }
    );

    if (result.success) {
      console.log('✅ Video generated with error handling!');
    } else {
      console.log('⚠️ Video generation failed but handled gracefully');
      console.log('Error:', result.error);
      console.log('Recoverable:', result.recoverable);
    }

    return result;
  } catch (error) {
    const handledError = await VideoGenerationErrorHandler.handleError(
      error as Error,
      'Demonstration'
    );
    
    console.log('🔧 Error handled:', handledError.message);
    console.log('Error code:', handledError.code);
    console.log('Recoverable:', handledError.recoverable);
    
    throw handledError;
  }
}

// Example 5: Storage Integration
async function demonstrateStorageIntegration() {
  console.log('🎬 Example 5: Storage Integration');
  
  const storageService = new VideoStorageService();
  const generator = new EnhancedVideoGenerator();

  try {
    // Generate a simple video
    const scriptAgent = new ScriptGenerationAgent();
    const script = await scriptAgent.generateScript({
      topic: 'Data Structures',
      learningLevel: 'beginner',
      videoStyle: 'tutorial',
      duration: 2,
      includeExamples: true,
      includeVisuals: true,
      includeQuiz: false
    });

    const result = await generator.generateVideo(
      script,
      (progress) => console.log(`📊 ${Math.round(progress.progress * 100)}%`),
      'user456' // User ID for storage
    );

    if (result.success) {
      console.log('✅ Video generated and uploaded to storage!');
      console.log('Video URL:', result.videoUrl);
      console.log('Audio URL:', result.audioUrl);
      console.log('Preview URL:', result.previewUrl);
      
      // Get file information
      if (result.videoUrl) {
        const fileInfo = await storageService.getFileInfo(result.videoUrl);
        console.log('File info:', fileInfo);
      }
    }

    return result;
  } catch (error) {
    console.error('❌ Storage integration failed:', error);
    throw error;
  }
}

// Example 6: Batch Processing
async function demonstrateBatchProcessing() {
  console.log('🎬 Example 6: Batch Processing');
  
  const topics = [
    'Introduction to Programming',
    'Web Development Basics',
    'Database Design',
    'API Development'
  ];

  const generator = new EnhancedVideoGenerator({
    chunkDuration: 3,
    totalDuration: 30,
    quality: 'low' // Use low quality for faster batch processing
  });

  const scriptAgent = new ScriptGenerationAgent();
  const results = [];

  for (let i = 0; i < topics.length; i++) {
    const topic = topics[i];
    console.log(`📝 Processing ${i + 1}/${topics.length}: ${topic}`);
    
    try {
      const script = await scriptAgent.generateScript({
        topic,
        learningLevel: 'beginner',
        videoStyle: 'explainer',
        duration: 0.5, // 30 seconds
        includeExamples: true,
        includeVisuals: true,
        includeQuiz: false
      });

      const result = await generator.generateVideo(
        script,
        (progress) => {
          if (progress.progress === 1.0) {
            console.log(`✅ Completed: ${topic}`);
          }
        },
        `batch_user_${i}`
      );

      results.push({ topic, success: result.success, error: result.error });
    } catch (error) {
      console.error(`❌ Failed: ${topic}`, error);
      results.push({ topic, success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  console.log('📊 Batch Processing Results:');
  results.forEach(result => {
    console.log(`${result.success ? '✅' : '❌'} ${result.topic}: ${result.success ? 'Success' : result.error}`);
  });

  return results;
}

// Main function to run all examples
export async function runAllExamples() {
  console.log('🚀 Running Video Generator Examples\n');

  try {
    // Example 1: Basic Script Generation
    await generateBasicScript();
    console.log('\n' + '='.repeat(50) + '\n');

    // Example 2: Full Video Generation
    await generateFullVideo();
    console.log('\n' + '='.repeat(50) + '\n');

    // Example 3: Document Context Integration
    await generateVideoWithDocuments();
    console.log('\n' + '='.repeat(50) + '\n');

    // Example 4: Error Handling
    await demonstrateErrorHandling();
    console.log('\n' + '='.repeat(50) + '\n');

    // Example 5: Storage Integration
    await demonstrateStorageIntegration();
    console.log('\n' + '='.repeat(50) + '\n');

    // Example 6: Batch Processing
    await demonstrateBatchProcessing();
    
    console.log('\n🎉 All examples completed successfully!');
  } catch (error) {
    console.error('\n💥 Examples failed:', error);
  }
}

// Export individual examples for testing
export {
  generateFullVideo,
  generateVideoWithDocuments,
  demonstrateErrorHandling,
  demonstrateStorageIntegration,
  demonstrateBatchProcessing
};
