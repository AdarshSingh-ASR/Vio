import { VisualCode } from './types';

export class VisualGenerationAgent {
  private groqApiKey: string;
  private openaiApiKey: string;

  constructor() {
    this.groqApiKey = process.env.GROQ_API_KEY || '';
    this.openaiApiKey = process.env.OPENAI_API_KEY || '';
  }

  async generateVisualCode(params: {
    scriptScene: any;
    topic: string;
    duration: number;
    visualStyle?: 'mathematical' | 'conceptual' | 'diagram' | 'mixed';
  }): Promise<VisualCode> {
    const { scriptScene, topic, duration, visualStyle = 'mixed' } = params;

    const systemPrompt = `You are a Manim developer who creates educational animations. 

**CRITICAL: Return ONLY valid JSON with this exact structure:**
{
  "class_name": "VideoScene",
  "python_code": "Complete executable Manim Python code here",
  "render_command": "manim -pql scene.py VideoScene",
  "timing_notes": "Timing synchronization notes",
  "dependencies": []
}

**Rules:**
1. Return ONLY valid JSON, no markdown, no explanations
2. Use double quotes for all strings
3. Escape quotes and newlines properly in python_code field
4. Use only basic Manim shapes: Circle, Rectangle, Square, Triangle, Line, Arrow, Dot
5. Use Text, MathTex for text animations
6. Use Create, Write, FadeIn, FadeOut, Transform animations
7. Use VGroup for grouping objects
8. Use BLUE, YELLOW, GREEN, WHITE colors
9. Add self.wait() calls for timing
10. NEVER use StreamLine, SVGMobject, or external files

Convert the script scene to Manim code following these guidelines:

    1. **Code Structure**
       - Create a main Scene class that inherits from Scene
       - Implement the scene with proper Manim imports and setup
       
    2. **Animation Mapping**
       For each scene type:
       - **Mathematical**: Use MathTex, equations, graphs, transformations
       - **Conceptual**: Use shapes, colors, movements to represent ideas
       - **Diagram**: Create clear diagrams with labels and connections
       - **Text**: Use engaging text animations with proper timing
       
    3. **Visual Design**
       - Use 3Blue1Brown color scheme (BLUE, YELLOW, GREEN, etc.)
       - Implement smooth camera movements and zooms
       - Add appropriate wait times for narration
       - Use fade_in, fade_out, and transform animations
       
    4. **Valid Manim Classes to Use**
       - Shapes: Circle, Rectangle, Square, Triangle, Polygon, Line, Arrow, Dot
       - Text: Text, MathTex, Tex, MarkupText
       - Animations: Create, Write, FadeIn, FadeOut, Transform, ReplacementTransform
       - 3D: Sphere, Cube, Cone (use sparingly)
       - Groups: VGroup, Group
       - NEVER USE: StreamLine, SVGMobject, or any SVG-related classes
       
    5. **Using Emojis and Icons**
       - Use emojized_text() for emojis: emojized_text(":thumbs_up:", font_size=36)
       - Use helper functions for icons:
         * create_ledger_icon() - for books/databases
         * create_blockchain_icon() - for blockchain visualizations  
         * create_computer_icon() - for computing concepts
       - NEVER import external files or use SVGMobject
       - Create all visuals with basic geometric shapes
       
    6. **Forbidden Classes and Imports**
       - NEVER use: StreamLine, SVGMobject, ImageMobject
       - NEVER import external files or assets
       - NEVER use file paths or external dependencies
       - Use only built-in Manim primitives and the provided helper functions
       
    7. **Timing Synchronization**
       - Match animation timing to narration duration
       - Add self.wait() calls for narration pauses
       - Ensure smooth transitions between scenes
       
    8. **Code Quality**
       - Write clean, well-commented Python code
       - Use descriptive variable names
       - Include proper error handling
       - Make code modular and reusable
       
    9. **Output Format**
       Return structured JSON with:
       - class_name: Name of the main Scene class
       - python_code: Complete executable Manim Python code
       - render_command: Command to render the animation
       - timing_notes: Notes about timing synchronization
       - dependencies: List of required files/assets (should always be empty)
       
    **Manim Best Practices:**
    - Use VGroup for grouping related objects
    - Implement proper object positioning and scaling
    - Use appropriate animation rates and run_times
    - Include clear visual hierarchy and focus
    - Always use basic shapes instead of external assets`;

    const userPrompt = `Create Manim code for this educational content:
Topic: ${topic}
Scene: ${scriptScene.title}
Content: ${scriptScene.narration}
Visual Description: ${scriptScene.visualDescription}
Duration: ${duration} seconds
Animation Type: ${scriptScene.animationType}
Key Concepts: ${scriptScene.keyConcepts.join(', ')}

Requirements:
- Create a Scene class named 'VideoScene'
- Create engaging visual animations using the actual content text
- Use proper timing with self.wait() calls
- Include text, shapes, and transitions
- Make it educational and clear
- Ensure total scene duration is approximately ${duration} seconds
- Use only basic Manim primitives (no external files)
- NEVER use the phrase "Educational Content" - use the actual content text instead
- Display the actual scene text: "${scriptScene.narration}"
- Make the visuals relate to the specific topic: ${topic}
- Visual style: ${visualStyle}

Return ONLY a valid JSON object with the exact structure specified in the system prompt.`;

    try {
      // Try Groq first
      const visualCode = await this.callGroqAPI(systemPrompt, userPrompt);
      if (visualCode) return visualCode;
    } catch (error) {
      console.error('Groq visual generation failed:', error);
    }

    try {
      // Fallback to OpenAI
      const visualCode = await this.callOpenAIAPI(systemPrompt, userPrompt);
      if (visualCode) return visualCode;
    } catch (error) {
      console.error('OpenAI visual generation failed:', error);
    }

    // Fallback visual code if both APIs fail
    return this.generateFallbackVisualCode(scriptScene, topic, duration);
  }

  private async callGroqAPI(systemPrompt: string, userPrompt: string): Promise<VisualCode | null> {
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
        max_tokens: 3000,
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    if (!content) return null;

    return this.parseVisualCode(content);
  }

  private async callOpenAIAPI(systemPrompt: string, userPrompt: string): Promise<VisualCode | null> {
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
        max_tokens: 3000,
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    if (!content) return null;

    return this.parseVisualCode(content);
  }

  private parseVisualCode(content: string, duration: number = 5): VisualCode {
    try {
      // Clean the content first
      let cleanedContent = content.trim();
      
      // Try multiple parsing strategies
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
               if (result && this.validateVisualCode(result)) {
                 console.log('Successfully parsed visual code using strategy');
                 // Fix timing issues like Python version
                 result.python_code = this.fixManimTiming(result.python_code, 5); // Default duration
                 return result;
               }
             } catch (e) {
               console.warn('Parsing strategy failed:', (e as Error).message);
             }
           }

      // If all parsing attempts fail, return fallback
      console.warn('All JSON parsing strategies failed, using fallback visual code');
      return this.generateFallbackVisualCodeFromContent(cleanedContent);
    } catch (error) {
      console.error('Failed to parse visual code JSON:', error);
      return this.generateFallbackVisualCodeFromContent(content);
    }
  }

  private cleanJsonString(jsonStr: string): string {
    try {
      let cleaned = jsonStr
        // Remove any leading/trailing whitespace and markdown markers
        .replace(/^```(?:json)?\s*/, '')
        .replace(/\s*```$/, '')
        .trim();

      // If the string is too short or doesn't start with {, it's likely malformed
      if (cleaned.length < 10 || !cleaned.startsWith('{')) {
        throw new Error('Invalid JSON structure');
      }

      // Fix common JSON issues
      cleaned = cleaned
        // Fix control characters
        .replace(/[\x00-\x1F\x7F]/g, ' ')
        // Fix newlines and tabs
        .replace(/[\n\t\r]/g, ' ')
        // Fix multiple spaces
        .replace(/\s+/g, ' ')
        // Fix trailing commas before closing braces/brackets
        .replace(/,(\s*[}\]])/g, '$1')
        // Fix missing quotes around property names
        .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
        // Fix single quotes to double quotes (but be careful with apostrophes in strings)
        .replace(/(?<!\\)'/g, '"')
        // Fix missing commas between properties (more specific pattern)
        .replace(/"\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '","$1":')
        // Fix missing commas between string values and next property
        .replace(/"\s*"([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '","$1":')
        // Fix missing commas between object/array and next property
        .replace(/[}\]]\s*"([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '},"$1":')
        // Fix missing commas between values
        .replace(/([^,}\]])\s*"([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1,"$2":');

      // Validate that we have a proper JSON structure
      if (!cleaned.includes('"class_name"') || !cleaned.includes('"python_code"')) {
        throw new Error('Missing required JSON properties');
      }

      return cleaned;
    } catch (error) {
      console.warn('Failed to clean JSON string:', error);
      throw error;
    }
  }

  // New parsing strategies for better JSON handling
  private tryParseMarkdownJson(content: string): VisualCode | null {
    const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (jsonMatch) {
      const cleanedJson = this.cleanJsonString(jsonMatch[1]);
      return JSON.parse(cleanedJson);
    }
    return null;
  }

  private tryParseExtractedJson(content: string): VisualCode | null {
    const jsonStart = content.indexOf('{');
    const jsonEnd = content.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      const jsonStr = content.substring(jsonStart, jsonEnd + 1);
      const cleanedJson = this.cleanJsonString(jsonStr);
      return JSON.parse(cleanedJson);
    }
    return null;
  }

  private tryParseFullContent(content: string): VisualCode | null {
    const cleanedJson = this.cleanJsonString(content);
    return JSON.parse(cleanedJson);
  }

  private tryParseWithRepair(content: string): VisualCode | null {
    try {
      // Try to repair common JSON issues
      let repaired = content
        // Remove markdown code blocks first
        .replace(/```(?:json)?\s*/g, '')
        .replace(/```\s*/g, '')
        // Fix missing quotes around property names
        .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
        // Fix single quotes to double quotes (but be careful with apostrophes)
        .replace(/(?<!\\)'/g, '"')
        // Fix trailing commas
        .replace(/,(\s*[}\]])/g, '$1')
        // Fix missing commas between properties
        .replace(/\"\s*\"/g, '","')
        // Fix control characters
        .replace(/[\x00-\x1F\x7F]/g, ' ')
        // Fix newlines in strings but preserve escaped newlines
        .replace(/(?<!\\\\)\n/g, ' ')
        .replace(/\r/g, ' ')
        // Fix tabs
        .replace(/\t/g, ' ')
        // Fix multiple spaces
        .replace(/\s+/g, ' ')
        // Fix unescaped quotes in string values
        .replace(/\"([^"]*)\"([^"]*)\"([^"]*)\":/g, '"$1\\"$2\\"$3":')
        // Fix missing commas after string values
        .replace(/\"\s*\"/g, '","')
        // Fix missing commas after numeric values
        .replace(/(\d+)\s*(\"[a-zA-Z_])/g, '$1,$2')
        // Fix missing commas after boolean values
        .replace(/(true|false)\s*(\"[a-zA-Z_])/g, '$1,$2')
        // Fix missing commas after null
        .replace(/null\s*(\"[a-zA-Z_])/g, 'null,$1')
        .trim();

      // Try to find the JSON object boundaries
      const jsonStart = repaired.indexOf('{');
      const jsonEnd = repaired.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        repaired = repaired.substring(jsonStart, jsonEnd + 1);
      }

      return JSON.parse(repaired);
    } catch (error) {
      console.warn('JSON repair failed:', (error as Error).message);
      return null;
    }
  }

  private tryParseWithSchemaValidation(content: string): VisualCode | null {
    try {
      // Try to extract and validate required fields using multiple patterns
      const classPatterns = [
        /"class_name"\s*:\s*"([^"]+)"/,
        /class_name\s*:\s*"([^"]+)"/,
        /"class_name"\s*:\s*([a-zA-Z_][a-zA-Z0-9_]*)/
      ];
      
      const codePatterns = [
        /"python_code"\s*:\s*"([^"]+)"/,
        /python_code\s*:\s*"([^"]+)"/,
        /"python_code"\s*:\s*"((?:[^"\\]|\\.)*)"/,
        /"python_code"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/
      ];
      
      const commandPatterns = [
        /"render_command"\s*:\s*"([^"]+)"/,
        /render_command\s*:\s*"([^"]+)"/,
        /"render_command"\s*:\s*([a-zA-Z_][a-zA-Z0-9_]*)/
      ];

      let classMatch = null;
      let codeMatch = null;
      let commandMatch = null;

      // Try each pattern for class_name
      for (const pattern of classPatterns) {
        classMatch = content.match(pattern);
        if (classMatch) break;
      }

      // Try each pattern for python_code
      for (const pattern of codePatterns) {
        codeMatch = content.match(pattern);
        if (codeMatch) break;
      }

      // Try each pattern for render_command
      for (const pattern of commandPatterns) {
        commandMatch = content.match(pattern);
        if (commandMatch) break;
      }

      if (classMatch && codeMatch && commandMatch) {
        // Clean and construct a valid JSON object
        const visualCode: VisualCode = {
          class_name: classMatch[1].replace(/\\"/g, '"'),
          python_code: codeMatch[1]
            .replace(/\\n/g, '\n')
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\'),
          render_command: commandMatch[1].replace(/\\"/g, '"'),
          timing_notes: 'Extracted from malformed JSON',
          dependencies: []
        };
        
        // Validate the extracted data
        if (visualCode.class_name.length > 0 && 
            visualCode.python_code.length > 10 && 
            visualCode.render_command.length > 0) {
          return visualCode;
        }
      }
      return null;
    } catch (error) {
      console.warn('Schema validation failed:', (error as Error).message);
      return null;
    }
  }

  private tryParseWithAggressiveRepair(content: string): VisualCode | null {
    try {
      // Very aggressive repair for severely malformed JSON
      let repaired = content
        // Remove everything before first { and after last }
        .replace(/^[^{]*/, '')
        .replace(/}[^}]*$/, '}')
        // Remove markdown markers
        .replace(/```(?:json)?\s*/g, '')
        .replace(/```\s*/g, '')
        // Fix all common JSON issues
        .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
        .replace(/(?<!\\)'/g, '"')
        .replace(/,(\s*[}\]])/g, '$1')
        .replace(/[\x00-\x1F\x7F]/g, ' ')
        .replace(/(?<!\\\\)\n/g, ' ')
        .replace(/\r/g, ' ')
        .replace(/\t/g, ' ')
        .replace(/\s+/g, ' ')
        // Fix missing commas between properties
        .replace(/\"\s*\"/g, '","')
        .replace(/(\d+)\s*(\"[a-zA-Z_])/g, '$1,$2')
        .replace(/(true|false)\s*(\"[a-zA-Z_])/g, '$1,$2')
        .replace(/null\s*(\"[a-zA-Z_])/g, 'null,$1')
        // Fix unescaped quotes in strings
        .replace(/\"([^"]*)\"([^"]*)\"([^"]*)\":/g, '"$1\\"$2\\"$3":')
        // Try to fix incomplete JSON by adding missing closing braces
        .replace(/[^}]$/, '$&}')
        .trim();

      // If we still can't parse, try to extract just the essential fields
      if (repaired.length < 10) {
        return this.extractMinimalVisualCode(content);
      }

      return JSON.parse(repaired);
    } catch (error) {
      console.warn('Aggressive repair failed:', (error as Error).message);
      return this.extractMinimalVisualCode(content);
    }
  }

  private extractMinimalVisualCode(content: string): VisualCode | null {
    try {
      // Extract minimal required information from any text
      const classMatch = content.match(/(?:class_name|VideoScene)[\s:]*([a-zA-Z_][a-zA-Z0-9_]*)/i);
      const pythonMatch = content.match(/(?:python_code|from manim)[\s:]*([^}]+)/i);
      const commandMatch = content.match(/(?:render_command|manim)[\s:]*([a-zA-Z0-9\s\-\.]+)/i);

      const className = classMatch ? classMatch[1] : 'VideoScene';
      const pythonCode = pythonMatch ? pythonMatch[1] : this.generateBasicPythonCode();
      const command = commandMatch ? commandMatch[1] : 'manim -pql scene.py VideoScene';

      return {
        class_name: className,
        python_code: pythonCode,
        render_command: command,
        timing_notes: 'Minimal extraction from malformed content',
        dependencies: []
      };
    } catch (error) {
      return null;
    }
  }

  private generateBasicPythonCode(): string {
    return `from manim import *

class VideoScene(Scene):
    def construct(self):
        title = Text("Educational Content", font_size=36, color=BLUE)
        self.play(Write(title))
        self.wait(2)
        self.play(FadeOut(title))`;
  }

  private validateVisualCode(visualCode: any): boolean {
    return (
      visualCode &&
      typeof visualCode === 'object' &&
      typeof visualCode.class_name === 'string' &&
      typeof visualCode.python_code === 'string' &&
      typeof visualCode.render_command === 'string' &&
      visualCode.class_name.length > 0 &&
      visualCode.python_code.length > 0 &&
      visualCode.render_command.length > 0
    );
  }

  private generateFallbackVisualCodeFromContent(content: string): VisualCode {
    // Extract any useful information from the failed response
    const title = this.extractTitleFromContent(content) || 'Educational Content';
    const text = this.extractTextFromContent(content) || 'Learning content';
    
    // Clean text for safe insertion into Python code
    const cleanTitle = title.replace(/["\\]/g, '').substring(0, 50);
    const cleanText = text.replace(/["\\]/g, '').substring(0, 100);
    
    // Generate more engaging fallback animation
    const pythonCode = `from manim import *

class VideoScene(Scene):
    def construct(self):
        # Create engaging fallback animation
        title = Text("${cleanTitle}", font_size=36, color=BLUE)
        title.to_edge(UP)
        
        # Create a decorative background
        background = Rectangle(width=12, height=7, color=BLUE, fill_opacity=0.1)
        
        # Main content with better formatting
        content_lines = "${cleanText}".split(' ')
        content_text = ""
        for i, word in enumerate(content_lines):
            if i > 0 and i % 8 == 0:
                content_text += "\\n"
            content_text += word + " "
        
        content = Text(content_text.strip(), font_size=20, color=WHITE)
        content.scale_to_fit_width(10)
        
        # Create some decorative elements
        circle = Circle(radius=0.5, color=YELLOW).to_corner(UL)
        square = Square(side_length=0.4, color=GREEN).to_corner(UR)
        
        # Animation sequence
        self.play(Create(background), run_time=0.5)
        self.play(Write(title), Create(circle), Create(square), run_time=1)
        self.wait(0.5)
        self.play(Write(content), run_time=1.5)
        self.wait(2)
        
        # Clean exit
        self.play(
            FadeOut(title), 
            FadeOut(content), 
            FadeOut(circle), 
            FadeOut(square), 
            FadeOut(background),
            run_time=1
        )`;

    return {
      class_name: 'VideoScene',
      python_code: pythonCode,
      render_command: 'manim -pql VideoScene.py VideoScene',
      timing_notes: 'Enhanced fallback animation with decorative elements',
      dependencies: []
    };
  }

  private extractTitleFromContent(content: string): string | null {
    // Try to extract title from various patterns
    const titleMatch = content.match(/["']title["']:\s*["']([^"']+)["']/i) ||
                      content.match(/class_name["']:\s*["']([^"']+)["']/i) ||
                      content.match(/VideoScene["']/i);
    return titleMatch ? titleMatch[1] : null;
  }

  private extractTextFromContent(content: string): string | null {
    // Try to extract text content from various patterns
    const textMatch = content.match(/["']python_code["']:\s*["']([^"']+)["']/i) ||
                     content.match(/Text\\(["'][^"']+["']\\)/i);
    return textMatch ? textMatch[1] : null;
  }

  private generateFallbackVisualCode(scriptScene: any, topic: string, duration: number): VisualCode {
    const displayText = scriptScene.narration.length > 100 
      ? scriptScene.narration.substring(0, 100) + "..."
      : scriptScene.narration;

    const pythonCode = `from manim import *

class VideoScene(Scene):
    def construct(self):
        # Simple text animation for ${duration} seconds
        title = Text("${scriptScene.title}", font_size=40, color=BLUE)
        content = Text("${displayText.replace(/"/g, '\\"')}", font_size=24, color=WHITE)
        content.scale_to_fit_width(11)
        
        # Animate title
        self.play(Write(title), run_time=1.5)
        self.wait(0.5)
        
        # Animate content
        self.play(Transform(title, content), run_time=1)
        self.wait(${duration - 3})
        
        # Final fade out
        self.play(FadeOut(title), run_time=0.5)`;

    return {
      class_name: 'VideoScene',
      python_code: pythonCode,
      render_command: `manim -pql VideoScene.py VideoScene`,
      timing_notes: `Total duration: ${duration} seconds. Title animation: 1.5s, content transition: 1s, content display: ${duration - 3}s, fade out: 0.5s`,
      dependencies: []
    };
  }

  private fixManimTiming(manimCode: string, chunkDuration: number = 5): string {
    // Fix timing issues in Manim code like Python version
    let fixedCode = manimCode;
    
    // Ensure proper imports
    if (!fixedCode.includes('from manim import *')) {
      fixedCode = 'from manim import *\n\n' + fixedCode;
    }
    
    // Replace invalid wait(0) with wait(0.1)
    fixedCode = fixedCode.replace(/self\.wait\(0\)/g, 'self.wait(0.1)');
    
    // Fix all wait() calls to ensure positive values
    fixedCode = fixedCode.replace(/self\.wait\(([^)]+)\)/g, (match, value) => {
      try {
        const numValue = parseFloat(value);
        if (numValue <= 0) {
          return 'self.wait(0.1)';
        }
        return match;
      } catch {
        return 'self.wait(0.1)';
      }
    });
    
    // Ensure we have a VideoScene class
    if (!fixedCode.includes('class VideoScene')) {
      // Create a simple fallback scene
      fixedCode = `from manim import *

class VideoScene(Scene):
    def construct(self):
        # Simple animation for ${chunkDuration} seconds
        title = Text("Learning in Progress...", font_size=40, color=BLUE)
        self.play(Write(title), run_time=1)
        self.wait(${chunkDuration - 1})
`;
    }
    
    // Add proper scene duration based on chunk duration
    if (fixedCode.includes('class VideoScene') && fixedCode.includes('def construct(self):')) {
      const lines = fixedCode.split('\n');
      let inConstruct = false;
      let constructIndent = 0;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        if (line.includes('def construct(self):')) {
          inConstruct = true;
          constructIndent = line.length - line.trimStart().length;
          continue;
        }
        
        if (inConstruct) {
          const currentIndent = line.trim() ? (line.length - line.trimStart().length) : constructIndent + 4;
          
          // If we hit a line with same or less indentation, we're out of construct
          if (line.trim() && currentIndent <= constructIndent) {
            // Insert timing adjustment before this line
            const timingLine = ' '.repeat(constructIndent + 4) + `# Ensure total duration is ${chunkDuration} seconds`;
            const waitLine = ' '.repeat(constructIndent + 4) + 'self.wait(0.5)  # Final pause';
            lines.splice(i, 0, waitLine, timingLine);
            break;
          }
        }
      }
      
      fixedCode = lines.join('\n');
    }
    
    return fixedCode;
  }
}
