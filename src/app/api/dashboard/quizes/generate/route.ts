import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedServices } from '@/lib/appwrite-server';
import { dashboardItemService, userService } from '@/lib/tidb-service';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Helper function to validate content quality for quiz generation
function validateContentQuality(content: string) {
  if (!content || content.length < 50) {
    return { isReadable: false, wordCount: 0, reason: 'Content too short' };
  }

  // Clean the content for analysis
  const cleaned = content
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ') // Remove control characters
    .replace(/[^\w\s.,!?;:()\-"']/g, ' ') // Keep only readable characters
    .replace(/\s+/g, ' ')
    .trim();

  const words = cleaned.split(/\s+/).filter(word => 
    word.length > 1 && 
    /^[a-zA-Z]/.test(word) // Must start with a letter
  );

  const wordCount = words.length;
  
  // Calculate readability metrics
  const totalChars = content.length;
  const readableChars = content.match(/[a-zA-Z\s.,!?;:()\-"']/g) || [];
  const readableRatio = readableChars.length / totalChars;
  
  // Check for PDF artifacts or binary content
  const hasPdfArtifacts = content.includes('obj') && content.includes('endobj') ||
                         content.includes('stream') && content.includes('endstream') ||
                         content.match(/\b\d+\s+\d+\s+R\b/) ||
                         content.includes('<<') && content.includes('>>');

  const isReadable = wordCount >= 20 && 
                    readableRatio >= 0.7 && 
                    !hasPdfArtifacts;

  return {
    isReadable,
    wordCount,
    readableRatio: Math.round(readableRatio * 100),
    hasPdfArtifacts,
    reason: !isReadable ? 
      (wordCount < 20 ? 'Insufficient words' :
       readableRatio < 0.7 ? 'Low readable character ratio' :
       hasPdfArtifacts ? 'Contains PDF artifacts' : 'Unknown issue') : 'Good quality'
  };
}


export async function POST(req: NextRequest) {
  try {
    const { user } = await getAuthenticatedServices(req);
    
    const { itemId, questionCount = 5, type = 'quiz' } = await req.json();

    console.log('Quiz generation request:', { itemId, questionCount, type });

    if (!itemId) {
      console.log('Missing itemId in request');
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
    }

    // Get user from TiDB database
    const dbUser = await userService.getByAppwriteUserId(user.$id);
    if (!dbUser) {
      return NextResponse.json(
        { error: 'User not found in database' },
        { status: 404 }
      );
    }

    // Fetch the item content from TiDB
    const item = await dashboardItemService.getById(itemId);
    if (!item) {
      console.log('Item not found:', itemId);
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    console.log('Found item:', {
      id: item.id,
      name: item.displayName || item.title,
      fileType: item.fileType,
      hasContent: !!item.content,
      contentLength: item.content ? item.content.length : 0
    });

    if (item.createdBy !== dbUser.id) {
      console.log('Access denied - item createdBy:', item.createdBy, 'current dbUserId:', dbUser.id);
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    let content = item.content || '';
    
    console.log('📋 Quiz generation content analysis:', {
      hasContent: !!item.content,
      contentLength: item.content ? item.content.length : 0,
      finalContentLength: content.length,
      fileType: item.fileType
    });
    
    // Enhanced content validation
    if (!content.trim()) {
      return NextResponse.json({ error: 'No content available for quiz generation' }, { status: 400 });
    }
    
    // Validate content quality for quiz generation
    const contentQuality = validateContentQuality(content);
    console.log('📊 Content quality analysis:', contentQuality);
    
    // Check if this is fallback/error content from PDF extraction
    const isFallbackContent = content.includes('Text Extraction Failed') || 
                              content.includes('Critical PDF Extraction Error') || 
                              content.includes('Critical PDF Processing Error') ||
                              !contentQuality.isReadable;
    
    // Get content type for better prompt customization
    const contentType = item.fileType || 'content';
    const itemName = item.displayName || item.title || 'Unknown';
    
    // For fallback content, generate questions based on filename and metadata
    if (isFallbackContent && (itemName !== 'Unknown' && itemName.length > 3)) {
      console.log('🔄 Generating quiz from filename/metadata for failed extraction');
      
      // Extract meaningful terms from filename for quiz generation
      const fileNameTerms = itemName
        .replace(/\.(pdf|docx?|txt|xlsx?)$/i, '') // Remove file extensions
        .replace(/[_-]/g, ' ') // Replace underscores and hyphens with spaces
        .split(/\s+/)
        .filter((term: string) => term.length > 2) // Filter out short terms
        .join(' ');
      
      // Create different prompts based on quiz type
      const fallbackPrompt = type === 'listening' 
        ? `Based on the document title "${itemName}" and the following context, create ${questionCount} listening comprehension questions.

Document title suggests this content is about: ${fileNameTerms}

Since the full document content is not available, create listening comprehension questions based on what the document title suggests. For each question:
1. Create a short audio passage (2-3 sentences) that would be relevant to the document topic
2. Create a comprehension question about that passage
3. Provide 4 multiple choice options
4. Specify the correct answer (0-3 index)
5. Assign a topic category (e.g., "Main Ideas", "Details", "Inference", "Vocabulary")

Generate questions that test listening comprehension skills for concepts that would typically be covered in material with this title.

Return ONLY a valid JSON array with this exact structure:
[
  {
    "audioText": "Short passage to be read aloud (2-3 sentences about the topic)",
    "question": "comprehension question about the passage",
    "options": ["option A", "option B", "option C", "option D"],
    "correctAnswer": 0,
    "topic": "Main Ideas"
  }
]

Important: Return only the JSON array, no additional text or formatting.`
        : `Based on the document title "${itemName}" and the following context, create ${questionCount} educational quiz questions.

Document title suggests this content is about: ${fileNameTerms}

Since the full document content is not available, create general knowledge questions that would likely be relevant to a document with this title. Focus on:
- Key concepts that the title suggests
- General knowledge related to the topic area
- Fundamental principles of the subject matter

Generate questions that test understanding of concepts that would typically be covered in material with this title.

Return ONLY a valid JSON array with this exact structure:
[
  {
    "question": "Question text here",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": 0,
    "explanation": "Explanation of why this answer is correct"
  }
]

Important: Return only the JSON array, no additional text or formatting.`;

      try {
        const response = await groq.chat.completions.create({
          messages: [
            {
              role: "system",
              content: type === 'listening' 
                ? `You are an expert listening comprehension test generator. When full content is not available, you create relevant listening passages and questions based on document titles and topics. Focus on creating audio content that would test listening skills for the subject matter.`
                : `You are an expert quiz generator that creates educational questions based on document titles and topics. When full content is not available, you generate relevant questions based on the subject matter suggested by the title.`
            },
            {
              role: "user",
              content: fallbackPrompt
            }
          ],
          model: "llama-3.1-8b-instant",
          temperature: 0.7,
          max_tokens: 2000,
        });

        const responseText = response.choices[0]?.message?.content?.trim();
        if (!responseText) {
          throw new Error('Empty response from AI service');
        }

        console.log(`🤖 AI response for fallback ${type}:`, responseText.substring(0, 200) + '...');

        const questions = JSON.parse(responseText);
        if (!Array.isArray(questions) || questions.length === 0) {
          throw new Error('Invalid questions format');
        }

        // Validate fallback questions have the right format
        const validatedFallbackQuestions = questions.slice(0, questionCount).map((q, index) => {
          if (type === 'listening') {
            if (!q.audioText || !q.question || !Array.isArray(q.options) || typeof q.correctAnswer !== 'number') {
              throw new Error(`Invalid listening question structure at index ${index}`);
            }
            return {
              audioText: q.audioText,
              question: q.question,
              options: q.options.slice(0, 4),
              correctAnswer: Math.max(0, Math.min(3, q.correctAnswer)),
              topic: q.topic || 'Main Ideas'
            };
          } else {
            if (!q.question || !Array.isArray(q.options) || typeof q.correctAnswer !== 'number') {
              throw new Error(`Invalid question structure at index ${index}`);
            }
            return {
              question: q.question,
              options: q.options.slice(0, 4),
              correctAnswer: Math.max(0, Math.min(3, q.correctAnswer)),
              explanation: q.explanation || '',
              topic: q.topic || 'Key Concepts'
            };
          }
        });

        console.log(`✅ Fallback ${type} generated successfully:`, validatedFallbackQuestions.length, 'questions');
        return NextResponse.json({ 
          questions: validatedFallbackQuestions,
          type,
          itemId
        });

      } catch (aiError) {
        console.error(`❌ Fallback ${type} generation failed:`, aiError);
        return NextResponse.json({ 
          error: `${type === 'listening' ? 'Listening test' : 'Quiz'} generation failed for this document type`,
          details: 'Unable to generate questions from available content'
        }, { status: 500 });
      }
    }

    // Customize prompt based on content type
    const getContentTypePrefix = (type: string) => {
      switch (type) {
        case 'pdf':
        case 'docx':
          return 'document';
        case 'excel':
          return 'spreadsheet data';
        case 'text':
          return 'text file';
        case 'transcript':
          return 'video transcript';
        case 'web-content':
          return 'website content';
        case 'powerpoint':
          return 'presentation';
        default:
          return 'content';
      }
    };

    const contentTypePrefix = getContentTypePrefix(contentType);

    // Prepare the prompt based on quiz type
    const basePrompt = type === 'listening' 
      ? `Based on the following ${contentTypePrefix} from "${itemName}", create ${questionCount} listening comprehension questions. For each question, provide:
1. A passage of text (50-100 words) that would be read aloud
2. A comprehension question about the passage
3. 4 multiple choice options (A, B, C, D)
4. The correct answer (0-3 index)
5. A topic/category that this question tests (e.g., "Main Ideas", "Details", "Inference", "Vocabulary", "Cause and Effect")

Content Type: ${contentType}
Source: ${itemName}
Content: ${content.substring(0, 2000)}

Return ONLY a valid JSON array with this exact structure:
[
  {
    "audioText": "passage to be read aloud",
    "question": "comprehension question",
    "options": ["option A", "option B", "option C", "option D"],
    "correctAnswer": 0,
    "topic": "Main Ideas"
  }
]`
      : `Based on the following ${contentTypePrefix} from "${itemName}", create ${questionCount} multiple choice questions to test comprehension. For each question, provide:
1. A clear question about the content
2. 4 multiple choice options (A, B, C, D)
3. The correct answer (0-3 index)
4. A brief explanation
5. A topic/category that this question tests (e.g., "Key Concepts", "Details", "Analysis", "Application", "Definitions", "Examples")

Content Type: ${contentType}
Source: ${itemName}
Content: ${content.substring(0, 2000)}

Return ONLY a valid JSON array with this exact structure:
[
  {
    "question": "your question here",
    "options": ["option A", "option B", "option C", "option D"],
    "correctAnswer": 0,
    "explanation": "brief explanation",
    "topic": "Key Concepts"
  }
]`;

    // Generate questions using Groq
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: `You are an expert quiz generator that creates high-quality questions from various content types including:
- Documents (PDF, Word, PowerPoint)
- Spreadsheets (Excel data)
- Text files and web content
- Video transcripts
- Website content

Adapt your questions based on the content type:
- For documents: Focus on main concepts, arguments, and key information
- For spreadsheets: Focus on data interpretation, patterns, and analysis  
- For transcripts: Focus on spoken content, dialogue, and narrative flow
- For web content: Focus on information, facts, and online content structure

Always generate questions that test genuine understanding rather than trivial details. Return only valid JSON.`
        },
        {
          role: "user",
          content: basePrompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const responseText = completion.choices[0]?.message?.content?.trim();
    if (!responseText) {
      throw new Error('No response from AI');
    }

    // Parse the JSON response
    let questions;
    try {
      // Extract JSON from response if it contains other text
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      const jsonString = jsonMatch ? jsonMatch[0] : responseText;
      questions = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('Failed to parse AI response:', responseText);
      throw new Error('Invalid AI response format');
    }

    // Validate the questions structure
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error('No valid questions generated');
    }

    // Validate each question has required fields
    const validatedQuestions = questions.slice(0, questionCount).map((q, index) => {
      if (type === 'listening') {
        if (!q.audioText || !q.question || !Array.isArray(q.options) || typeof q.correctAnswer !== 'number') {
          throw new Error(`Invalid question structure at index ${index}`);
        }
        return {
          audioText: q.audioText,
          question: q.question,
          options: q.options.slice(0, 4),
          correctAnswer: Math.max(0, Math.min(3, q.correctAnswer)),
          topic: q.topic || 'Main Ideas'
        };
      } else {
        if (!q.question || !Array.isArray(q.options) || typeof q.correctAnswer !== 'number') {
          throw new Error(`Invalid question structure at index ${index}`);
        }
        return {
          question: q.question,
          options: q.options.slice(0, 4),
          correctAnswer: Math.max(0, Math.min(3, q.correctAnswer)),
          explanation: q.explanation || '',
          topic: q.topic || 'Key Concepts'
        };
      }
    });

    return NextResponse.json({ 
      questions: validatedQuestions,
      type,
      itemId
    });

  } catch (error) {
    console.error('Quiz generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate quiz questions' },
      { status: 500 }
    );
  }
} 