import { VideoScript, ScriptScene } from './types';

export class ScriptGenerationAgent {
  private groqApiKey: string;
  private openaiApiKey: string;

  constructor() {
    this.groqApiKey = process.env.GROQ_API_KEY || '';
    this.openaiApiKey = process.env.OPENAI_API_KEY || '';
  }

  async generateScript(params: {
    topic: string;
    documentContext?: string;
    learningLevel: 'beginner' | 'intermediate' | 'advanced';
    videoStyle: 'explainer' | 'tutorial' | 'story' | 'interactive';
    duration: number; // in minutes
    includeExamples: boolean;
    includeVisuals: boolean;
    includeQuiz: boolean;
  }): Promise<VideoScript> {
    const {
      topic,
      documentContext,
      learningLevel,
      videoStyle,
      duration,
      includeExamples,
      includeVisuals,
      includeQuiz
    } = params;

    const systemPrompt = `You are an expert educational content creator specializing in creating 
    concise, engaging video scripts in the style of 3Blue1Brown. You excel at:
    
    - Breaking down complex concepts into digestible visual narratives
    - Creating scripts optimized for mathematical animations and visual explanations
    - Structuring content for maximum learning impact in minimal time
    - Identifying key visual moments that enhance understanding
    
    When creating a video script, follow this process:

    1. **Concept Analysis**
       - Identify the core concept and its key components
       - Determine the appropriate complexity level for the target audience
       - Identify prerequisite knowledge needed
       
    2. **Script Structure** (Target: ${duration} minutes = ~${Math.round(duration * 150)} words narration)
       - Opening Hook (15-20 seconds): Engaging question or relatable scenario
       - Core Explanation (${Math.round((duration - 0.5) * 60)} seconds): Main content broken into 3-4 key scenes
       - Conclusion & Takeaway (10-15 seconds): Summary and practical application
       
    3. **Scene Planning**
       For each scene, specify:
       - Scene duration (in seconds)
       - Narration text (natural, conversational tone)
       - Visual description (what should be animated/shown)
       - Key concepts being illustrated
       - Animation type: "mathematical", "conceptual", "diagram", or "text"
       
    4. **Visual Optimization**
       - Prioritize visual metaphors and analogies
       - Include mathematical formulas, graphs, or diagrams where helpful
       - Ensure each scene has a clear visual focus
       - Plan smooth transitions between concepts
       
    5. **Output Format**
       Return a structured JSON response with:
       - title: Video title
       - totalDuration: Total duration in seconds  
       - targetAudience: Description of target audience
       - learningObjectives: List of learning objectives
       - scenes: List of scene objects with scene_number, duration_seconds, title, narration, visual_description, key_concepts, and animation_type
       
    **Style Guidelines:**
    - Use clear, conversational language
    - Include rhetorical questions to engage viewers
    - Build concepts progressively
    - Use concrete examples before abstract concepts
    - Maintain enthusiasm and curiosity throughout
    - Make it fun and engaging while being educational`;

    const userPrompt = `Create a ${duration}-minute educational video script about "${topic}" for ${learningLevel} learners.

Video Specifications:
- Target Audience: ${learningLevel} level
- Video Style: ${videoStyle}
- Duration: ${duration} minutes
- Include Examples: ${includeExamples}
- Include Visual Elements: ${includeVisuals}
- Include Quiz: ${includeQuiz}

${documentContext ? `Context from user's documents:\n${documentContext}\n` : ''}

Make sure to:
1. Start with an engaging hook
2. Break down the concept into digestible parts
3. Use visual metaphors and analogies
4. Include specific scenes with timing
5. End with a practical takeaway
6. Make it fun and engaging while being educational

Return ONLY a valid JSON object with the exact structure specified in the system prompt.`;

    try {
      // Try Groq first
      const script = await this.callGroqAPI(systemPrompt, userPrompt);
      if (script) return script;
    } catch (error) {
      console.error('Groq script generation failed:', error);
    }

    try {
      // Fallback to OpenAI
      const script = await this.callOpenAIAPI(systemPrompt, userPrompt);
      if (script) return script;
    } catch (error) {
      console.error('OpenAI script generation failed:', error);
    }

    // Fallback script if both APIs fail
    return this.generateFallbackScript(topic, learningLevel, duration);
  }

  private async callGroqAPI(systemPrompt: string, userPrompt: string): Promise<VideoScript | null> {
    if (!this.groqApiKey) return null;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    if (!content) return null;

    return this.parseVideoScript(content);
  }

  private async callOpenAIAPI(systemPrompt: string, userPrompt: string): Promise<VideoScript | null> {
    if (!this.openaiApiKey) return null;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    if (!content) return null;

    return this.parseVideoScript(content);
  }

  private parseVideoScript(content: string): VideoScript {
    try {
      // Clean the content first
      let cleanedContent = content.trim();
      
      // Try multiple parsing strategies like visual agent
      const parsingStrategies = [
        () => this.tryParseMarkdownJson(cleanedContent),
        () => this.tryParseExtractedJson(cleanedContent),
        () => this.tryParseFullContent(cleanedContent),
        () => this.tryParseWithRepair(cleanedContent),
        () => this.tryParseWithSchemaValidation(cleanedContent),
        () => this.tryParseWithAggressiveRepair(cleanedContent)
      ];

      for (const strategy of parsingStrategies) {
        try {
          const result = strategy();
          if (result && this.validateVideoScript(result)) {
            console.log('Successfully parsed video script using strategy');
            return result;
          }
        } catch (e) {
          console.warn('Script parsing strategy failed:', (e as Error).message);
        }
      }

      // If all parsing attempts fail, return fallback
      console.warn('All JSON parsing strategies failed, using fallback script');
      return this.generateFallbackScript('Educational Content', 'beginner', 2);
    } catch (error) {
      console.error('Failed to parse video script JSON:', error);
      return this.generateFallbackScript('Educational Content', 'beginner', 2);
    }
  }

  private tryParseMarkdownJson(content: string): VideoScript | null {
    try {
      const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch) {
        const cleanedJson = this.cleanJsonString(jsonMatch[1]);
        return JSON.parse(cleanedJson);
      }
      return null;
    } catch {
      return null;
    }
  }

  private tryParseExtractedJson(content: string): VideoScript | null {
    try {
      const jsonStart = content.indexOf('{');
      const jsonEnd = content.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        const jsonStr = content.substring(jsonStart, jsonEnd + 1);
        const cleanedJson = this.cleanJsonString(jsonStr);
        return JSON.parse(cleanedJson);
      }
      return null;
    } catch {
      return null;
    }
  }

  private tryParseFullContent(content: string): VideoScript | null {
    try {
      const cleanedJson = this.cleanJsonString(content);
      return JSON.parse(cleanedJson);
    } catch {
      return null;
    }
  }

  private tryParseWithRepair(content: string): VideoScript | null {
    try {
      let cleanedJson = this.cleanJsonString(content);
      
      // Try to repair common JSON issues
      cleanedJson = this.repairJsonString(cleanedJson);
      
      return JSON.parse(cleanedJson);
    } catch {
      return null;
    }
  }

  private tryParseWithSchemaValidation(content: string): VideoScript | null {
    try {
      const cleanedJson = this.cleanJsonString(content);
      const parsed = JSON.parse(cleanedJson);
      
      // Basic schema validation
      if (this.validateVideoScript(parsed)) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }

  private tryParseWithAggressiveRepair(content: string): VideoScript | null {
    try {
      let cleanedJson = this.cleanJsonString(content);
      
      // Aggressive repair attempts
      cleanedJson = this.aggressiveJsonRepair(cleanedJson);
      
      const parsed = JSON.parse(cleanedJson);
      if (this.validateVideoScript(parsed)) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }

  private cleanJsonString(jsonStr: string): string {
    // Remove any non-JSON content before and after
    let cleaned = jsonStr.trim();
    
    // Remove markdown code block markers if present
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    
    // Remove any text before the first { and after the last }
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }
    
    return cleaned;
  }

  private repairJsonString(jsonStr: string): string {
    let repaired = jsonStr;
    
    // Fix common issues
    repaired = repaired.replace(/,\s*}/g, '}'); // Remove trailing commas
    repaired = repaired.replace(/,\s*]/g, ']'); // Remove trailing commas in arrays
    repaired = repaired.replace(/(\w+):/g, '"$1":'); // Quote unquoted keys
    repaired = repaired.replace(/:(\s*)([^",{\[\s][^",}\]\s]*)/g, ': "$2"'); // Quote unquoted string values
    
    return repaired;
  }

  private aggressiveJsonRepair(jsonStr: string): string {
    let repaired = jsonStr;
    
    // More aggressive repairs
    repaired = this.repairJsonString(repaired);
    
    // Try to fix malformed strings
    repaired = repaired.replace(/([^\\])"([^"]*)"([^\\])/g, '$1\\"$2\\"$3');
    
    // Fix incomplete objects
    if (!repaired.endsWith('}')) {
      repaired += '}';
    }
    
    return repaired;
  }

  private validateVideoScript(script: any): boolean {
    try {
      // Basic validation
      if (!script || typeof script !== 'object') return false;
      if (!script.title || typeof script.title !== 'string') return false;
      if (!Array.isArray(script.scenes)) return false;
      
      // Validate scenes
      for (const scene of script.scenes) {
        if (!scene.title || !scene.narration || typeof scene.narration !== 'string') {
          return false;
        }
      }
      
      return true;
    } catch {
      return false;
    }
  }

  private generateFallbackScript(topic: string, learningLevel: string, duration: number): VideoScript {
    const totalSeconds = duration * 60;
    const sceneCount = Math.max(3, Math.floor(duration / 2));
    const sceneDuration = totalSeconds / sceneCount;

    const scenes: ScriptScene[] = [];

    // Introduction scene
    scenes.push({
      sceneNumber: 1,
      durationSeconds: sceneDuration,
      title: 'Introduction',
      narration: `Welcome to this educational video about ${topic}! Today we'll explore this fascinating concept in a fun and engaging way.`,
      visualDescription: 'Title slide with topic name and engaging visual',
      keyConcepts: ['Introduction', 'Overview'],
      animationType: 'text'
    });

    // Main content scenes
    for (let i = 2; i < sceneCount; i++) {
      scenes.push({
        sceneNumber: i,
        durationSeconds: sceneDuration,
        title: `Key Concept ${i - 1}`,
        narration: `Let's dive into the ${i - 1 === 1 ? 'first' : i - 1 === 2 ? 'second' : 'third'} important aspect of ${topic}.`,
        visualDescription: `Visual representation of concept ${i - 1}`,
        keyConcepts: [`Concept ${i - 1}`, 'Visual Learning'],
        animationType: i % 2 === 0 ? 'mathematical' : 'conceptual'
      });
    }

    // Conclusion scene
    scenes.push({
      sceneNumber: sceneCount,
      durationSeconds: sceneDuration,
      title: 'Conclusion',
      narration: `Congratulations! You've learned the basics of ${topic}. Keep practicing and exploring to deepen your understanding.`,
      visualDescription: 'Summary slide with key takeaways',
      keyConcepts: ['Summary', 'Next Steps'],
      animationType: 'text'
    });

    return {
      title: `Understanding ${topic}`,
      totalDuration: totalSeconds,
      targetAudience: `${learningLevel} learners`,
      learningObjectives: [
        `Understand the basic concepts of ${topic}`,
        `Apply knowledge of ${topic} in practical situations`,
        `Identify key components and relationships in ${topic}`
      ],
      scenes
    };
  }
}
