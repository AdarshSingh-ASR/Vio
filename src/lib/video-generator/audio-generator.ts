import { AudioGenerationOptions } from './types';

export class AudioGenerator {
  private outputDir: string;

  constructor(outputDir: string = 'temp/audio') {
    this.outputDir = outputDir;
    this.ensureOutputDir();
  }

  private async ensureOutputDir(): Promise<void> {
    // Only create directories on server side
    if (typeof window === 'undefined') {
      try {
        const { promises: fs } = await import('fs');
        await fs.mkdir(this.outputDir, { recursive: true });
      } catch (error) {
        console.error('Failed to create audio output directory:', error);
      }
    }
  }

  async generateAudio(options: AudioGenerationOptions): Promise<string> {
    const {
      text,
      language = 'en',
      speed = 1.0,
      pitch = 1.0,
      voice,
      format = 'wav'
    } = options;

    try {
      // Try browser-based TTS first (for client-side generation)
      if (typeof window !== 'undefined') {
        return await this.generateBrowserTTS(options);
      }

      // Server-side TTS using Web Speech API simulation or external service
      return await this.generateServerTTS(options);

    } catch (error) {
      console.error('Audio generation failed:', error);
      throw new Error(`Failed to generate audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async generateBrowserTTS(options: AudioGenerationOptions): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const utterance = new SpeechSynthesisUtterance(options.text);
        
        // Configure voice settings
        utterance.lang = options.language || 'en';
        utterance.rate = options.speed || 1.0;
        utterance.pitch = options.pitch || 1.0;
        utterance.volume = 1.0;

        // Try to set voice if specified
        if (options.voice) {
          const voices = speechSynthesis.getVoices();
          const selectedVoice = voices.find(voice => 
            voice.name.includes(options.voice!) || 
            voice.lang.includes(options.language || 'en')
          );
          if (selectedVoice) {
            utterance.voice = selectedVoice;
          }
        }

        // Create audio context for recording
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const destination = audioContext.createMediaStreamDestination();
        const mediaRecorder = new MediaRecorder(destination.stream);
        
        const chunks: Blob[] = [];
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'audio/wav' });
          const url = URL.createObjectURL(blob);
          resolve(url);
        };

        // Start recording
        mediaRecorder.start();

        // Connect speech synthesis to audio context
        const source = audioContext.createMediaStreamSource(
          new MediaStream([destination.stream.getAudioTracks()[0]])
        );
        source.connect(destination);

        // Handle speech synthesis events
        utterance.onend = () => {
          mediaRecorder.stop();
        };

        utterance.onerror = (event) => {
          mediaRecorder.stop();
          reject(new Error(`Speech synthesis error: ${event.error}`));
        };

        // Start speech synthesis
        speechSynthesis.speak(utterance);

      } catch (error) {
        reject(error);
      }
    });
  }

  private async generateServerTTS(options: AudioGenerationOptions): Promise<string> {
    const fileName = `audio_${Date.now()}.${options.format || 'mp3'}`;

    try {
      console.log('🔊 AudioGenerator: Generating TTS for text:', options.text.substring(0, 50) + '...');
      
      // Log available TTS services
      this.logAvailableTTSServices();
      
      // Try to use external TTS services directly
      const audioData = await this.callExternalTTSServices(options);

      if (audioData) {
        if (typeof window === 'undefined') {
          // Server-side: write to file
          const { promises: fs } = await import('fs');
          const path = await import('path');
          const filePath = path.join(this.outputDir, fileName);
          await fs.writeFile(filePath, Buffer.from(audioData));
          console.log('🔊 AudioGenerator: TTS audio file saved to:', filePath);
          return filePath;
        } else {
          // Client-side: return data URL
          const blob = new Blob([audioData], { type: 'audio/mpeg' });
          return URL.createObjectURL(blob);
        }
      } else {
        console.log('🔊 AudioGenerator: No TTS services available, using fallback');
        return await this.generateFallbackAudio(options);
      }

    } catch (error) {
      console.error('🔊 AudioGenerator: Server TTS generation failed:', error);
      return await this.generateFallbackAudio(options);
    }
  }

  private logAvailableTTSServices(): void {
    console.log('🔊 AudioGenerator: Using Google Text-to-Speech (gTTS) - Free and reliable');
  }

  private async callExternalTTSServices(options: AudioGenerationOptions): Promise<ArrayBuffer | null> {
    const text = options.text; // Use full text like Python version

    // Use Google Text-to-Speech (gTTS) - Same as Python implementation
    try {
      console.log('🔊 AudioGenerator: Using Google Text-to-Speech (gTTS)');
      console.log(`🔊 AudioGenerator: Text length: ${text.length} characters`);
      return await this.generateGTTSAudio(text, options.language || 'en');
    } catch (error) {
      console.error('🔊 AudioGenerator: Google TTS error:', error);
      return null;
    }
  }

  private async generateGTTSAudio(text: string, language: string = 'en'): Promise<ArrayBuffer | null> {
    try {
      // Google TTS has URL length limits, so we need to chunk long texts
      const maxChunkLength = 200; // Conservative limit to avoid URL length issues
      
      if (text.length <= maxChunkLength) {
        // Short text - process directly
        return await this.processSingleTTSChunk(text, language);
      } else {
        // Long text - split into chunks and combine
        console.log(`🔊 AudioGenerator: Text too long (${text.length} chars), chunking...`);
        return await this.processMultipleTTSChunks(text, language, maxChunkLength);
      }
    } catch (error) {
      console.error('🔊 AudioGenerator: Google TTS error:', error);
      return null;
    }
  }

  private async processSingleTTSChunk(text: string, language: string): Promise<ArrayBuffer | null> {
    try {
      const encodedText = encodeURIComponent(text);
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=${language}&client=tw-ob`;
      
      console.log('🔊 AudioGenerator: Calling Google TTS API for single chunk');
      const response = await fetch(ttsUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Referer': 'https://translate.google.com/',
          'Accept': 'audio/mpeg, audio/*, */*'
        }
      });

      if (response.ok) {
        console.log('🔊 AudioGenerator: Google TTS successful');
        return await response.arrayBuffer();
      } else {
        console.log('🔊 AudioGenerator: Google TTS failed, status:', response.status);
        return null;
      }
    } catch (error) {
      console.error('🔊 AudioGenerator: Single chunk TTS error:', error);
      return null;
    }
  }

  private async processMultipleTTSChunks(text: string, language: string, maxChunkLength: number): Promise<ArrayBuffer | null> {
    try {
      // Split text into chunks at sentence boundaries when possible
      const chunks = this.splitTextIntoSentences(text, maxChunkLength);
      console.log(`🔊 AudioGenerator: Split text into ${chunks.length} chunks`);
      
      const audioChunks: ArrayBuffer[] = [];
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i].trim();
        if (chunk.length === 0) continue;
        
        console.log(`🔊 AudioGenerator: Processing chunk ${i + 1}/${chunks.length} (${chunk.length} chars)`);
        const audioData = await this.processSingleTTSChunk(chunk, language);
        
        if (audioData) {
          audioChunks.push(audioData);
        } else {
          console.warn(`🔊 AudioGenerator: Failed to generate audio for chunk ${i + 1}`);
        }
        
        // Small delay between requests to be respectful to Google's servers
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      if (audioChunks.length === 0) {
        console.error('🔊 AudioGenerator: No audio chunks were generated');
        return null;
      }
      
      if (audioChunks.length === 1) {
        return audioChunks[0];
      }
      
      // Combine multiple audio chunks using FFmpeg
      console.log(`🔊 AudioGenerator: Combining ${audioChunks.length} audio chunks`);
      return await this.combineAudioChunks(audioChunks);
      
    } catch (error) {
      console.error('🔊 AudioGenerator: Multiple chunks TTS error:', error);
      return null;
    }
  }

  private splitTextIntoSentences(text: string, maxLength: number): string[] {
    // First try to split by sentences
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const chunks: string[] = [];
    let currentChunk = '';
    
    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (trimmedSentence.length === 0) continue;
      
      // If adding this sentence would exceed the limit, save current chunk and start new one
      if (currentChunk.length + trimmedSentence.length + 1 > maxLength && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = trimmedSentence;
      } else {
        // Add sentence to current chunk
        if (currentChunk.length > 0) {
          currentChunk += '. ' + trimmedSentence;
        } else {
          currentChunk = trimmedSentence;
        }
      }
    }
    
    // Add the last chunk
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }
    
    // If we still have chunks that are too long, split them by words
    const finalChunks: string[] = [];
    for (const chunk of chunks) {
      if (chunk.length <= maxLength) {
        finalChunks.push(chunk);
      } else {
        // Split by words
        const words = chunk.split(' ');
        let wordChunk = '';
        
        for (const word of words) {
          if (wordChunk.length + word.length + 1 > maxLength && wordChunk.length > 0) {
            finalChunks.push(wordChunk.trim());
            wordChunk = word;
          } else {
            wordChunk += (wordChunk.length > 0 ? ' ' : '') + word;
          }
        }
        
        if (wordChunk.trim().length > 0) {
          finalChunks.push(wordChunk.trim());
        }
      }
    }
    
    return finalChunks;
  }

  private async combineAudioChunks(audioChunks: ArrayBuffer[]): Promise<ArrayBuffer | null> {
    try {
      // For now, return the first chunk if combining fails
      // In a production environment, you might want to use FFmpeg to properly combine audio
      console.log('🔊 AudioGenerator: Combining audio chunks (simplified implementation)');
      
      // Create a simple concatenation by combining the raw audio data
      // Note: This is a simplified approach. For proper audio concatenation,
      // you would typically use FFmpeg to ensure proper audio format handling
      const totalLength = audioChunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
      const combined = new Uint8Array(totalLength);
      let offset = 0;
      
      for (const chunk of audioChunks) {
        combined.set(new Uint8Array(chunk), offset);
        offset += chunk.byteLength;
      }
      
      return combined.buffer;
    } catch (error) {
      console.error('🔊 AudioGenerator: Audio combination error:', error);
      // Return first chunk as fallback
      return audioChunks.length > 0 ? audioChunks[0] : null;
    }
  }

  private async mockTTSGeneration(options: AudioGenerationOptions): Promise<Buffer | ArrayBuffer> {
    // This is a placeholder - in a real implementation, you'd call an actual TTS service
    // For now, return a minimal WAV file header
    const text = options.text;
    const duration = Math.max(1, text.length * 0.1); // Estimate duration
    const sampleRate = 44100;
    const numSamples = Math.floor(sampleRate * duration);
    
    // Create a simple sine wave as placeholder audio
    const bufferSize = 44 + numSamples * 2; // WAV header + 16-bit samples
    
    if (typeof window === 'undefined') {
      // Server-side: use Buffer
      const buffer = Buffer.alloc(bufferSize);
      
      // WAV header
      buffer.write('RIFF', 0);
      buffer.writeUInt32LE(36 + numSamples * 2, 4);
      buffer.write('WAVE', 8);
      buffer.write('fmt ', 12);
      buffer.writeUInt32LE(16, 16);
      buffer.writeUInt16LE(1, 20);
      buffer.writeUInt16LE(1, 22);
      buffer.writeUInt32LE(sampleRate, 24);
      buffer.writeUInt32LE(sampleRate * 2, 28);
      buffer.writeUInt16LE(2, 32);
      buffer.writeUInt16LE(16, 34);
      buffer.write('data', 36);
      buffer.writeUInt32LE(numSamples * 2, 40);
      
      // Generate simple sine wave
      for (let i = 0; i < numSamples; i++) {
        const sample = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.1; // 440Hz tone
        buffer.writeInt16LE(Math.floor(sample * 32767), 44 + i * 2);
      }
      
      return buffer;
    } else {
      // Client-side: use ArrayBuffer
      const buffer = new ArrayBuffer(bufferSize);
      const view = new DataView(buffer);
      
      // WAV header
      view.setUint32(0, 0x52494646, false); // "RIFF"
      view.setUint32(4, 36 + numSamples * 2, true);
      view.setUint32(8, 0x57415645, false); // "WAVE"
      view.setUint32(12, 0x666d7420, false); // "fmt "
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 1, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * 2, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true);
      view.setUint32(36, 0x64617461, false); // "data"
      view.setUint32(40, numSamples * 2, true);
      
      // Generate simple sine wave
      for (let i = 0; i < numSamples; i++) {
        const sample = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.1; // 440Hz tone
        view.setInt16(44 + i * 2, Math.floor(sample * 32767), true);
      }
      
      return buffer;
    }
  }

  private async generateFallbackAudio(options: AudioGenerationOptions): Promise<string> {
    const fileName = `audio_${Date.now()}.${options.format || 'wav'}`;
    
    try {
      console.log('🔊 AudioGenerator: Generating fallback audio');
      
      // Generate a simple tone as fallback audio
      const audioData = await this.generateToneAudio(options);
      
      if (typeof window === 'undefined') {
        // Server-side: write to file
        const { promises: fs } = await import('fs');
        const path = await import('path');
        const filePath = path.join(this.outputDir, fileName);
        await fs.writeFile(filePath, audioData as Buffer);
        console.log('🔊 AudioGenerator: Fallback audio saved to:', filePath);
        return filePath;
      } else {
        // Client-side: return data URL
        const blob = new Blob([audioData], { type: `audio/${options.format || 'wav'}` });
        return URL.createObjectURL(blob);
      }
    } catch (error) {
      console.error('🔊 AudioGenerator: Fallback audio generation failed:', error);
      throw new Error('Failed to generate fallback audio');
    }
  }

  private async generateToneAudio(options: AudioGenerationOptions): Promise<Buffer | ArrayBuffer> {
    // Generate a simple tone as placeholder audio
    const text = options.text;
    const duration = Math.max(1, text.length * 0.1); // Estimate duration based on text length
    const sampleRate = 44100;
    const numSamples = Math.floor(sampleRate * duration);
    
    // Create a simple sine wave as placeholder audio
    const bufferSize = 44 + numSamples * 2; // WAV header + 16-bit samples
    
    if (typeof window === 'undefined') {
      // Server-side: use Buffer
      const buffer = Buffer.alloc(bufferSize);
      
      // WAV header
      buffer.write('RIFF', 0);
      buffer.writeUInt32LE(36 + numSamples * 2, 4);
      buffer.write('WAVE', 8);
      buffer.write('fmt ', 12);
      buffer.writeUInt32LE(16, 16);
      buffer.writeUInt16LE(1, 20);
      buffer.writeUInt16LE(1, 22);
      buffer.writeUInt32LE(sampleRate, 24);
      buffer.writeUInt32LE(sampleRate * 2, 28);
      buffer.writeUInt16LE(2, 32);
      buffer.writeUInt16LE(16, 34);
      buffer.write('data', 36);
      buffer.writeUInt32LE(numSamples * 2, 40);
      
      // Generate simple sine wave
      const frequency = 440; // A4 note
      for (let i = 0; i < numSamples; i++) {
        const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.1;
        const intSample = Math.round(sample * 32767);
        buffer.writeInt16LE(intSample, 44 + i * 2);
      }
      
      return buffer;
    } else {
      // Client-side: use ArrayBuffer
      const buffer = new ArrayBuffer(bufferSize);
      const view = new DataView(buffer);
      
      // WAV header
      view.setUint32(0, 0x52494646, false); // "RIFF"
      view.setUint32(4, 36 + numSamples * 2, true);
      view.setUint32(8, 0x57415645, false); // "WAVE"
      view.setUint32(12, 0x666d7420, false); // "fmt "
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 1, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * 2, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true);
      view.setUint32(36, 0x64617461, false); // "data"
      view.setUint32(40, numSamples * 2, true);
      
      // Generate simple sine wave
      const frequency = 440; // A4 note
      for (let i = 0; i < numSamples; i++) {
        const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.1;
        const intSample = Math.round(sample * 32767);
        view.setInt16(44 + i * 2, intSample, true);
      }
      
      return buffer;
    }
  }

  async generateChunkedAudio(chunks: Array<{ text: string; chunkId: number }>, options: Partial<AudioGenerationOptions> = {}): Promise<string[]> {
    const audioPaths: string[] = [];

    for (const chunk of chunks) {
      try {
        const audioPath = await this.generateAudio({
          text: chunk.text,
          ...options
        });
        audioPaths.push(audioPath);
      } catch (error) {
        console.error(`Failed to generate audio for chunk ${chunk.chunkId}:`, error);
        // Continue with other chunks
      }
    }

    return audioPaths;
  }

  async combineAudioFiles(audioPaths: string[], outputPath: string): Promise<string> {
    // This would typically use FFmpeg or similar tool to combine audio files
    // For now, we'll return the first file as a placeholder
    if (audioPaths.length === 0) {
      throw new Error('No audio files to combine');
    }

    if (audioPaths.length === 1) {
      // If only one file, just return it
      return audioPaths[0];
    }

    // For multiple files, you'd use FFmpeg to concatenate them
    // This is a placeholder implementation
    console.warn('Audio concatenation not implemented - using first file as placeholder');
    
    if (typeof window === 'undefined') {
      // Server-side: copy file
      const { promises: fs } = await import('fs');
      await fs.copyFile(audioPaths[0], outputPath);
      return outputPath;
    } else {
      // Client-side: return first file
      return audioPaths[0];
    }
  }

  async cleanup(audioPaths: string[]): Promise<void> {
    for (const audioPath of audioPaths) {
      try {
        if (typeof window === 'undefined') {
          // Server-side: check if file exists before deleting
          const { promises: fs } = await import('fs');
          try {
            await fs.access(audioPath);
            await fs.unlink(audioPath);
          } catch (accessError: any) {
            // File doesn't exist or can't be accessed, skip deletion
            if (accessError.code !== 'ENOENT') {
              console.warn(`Cannot access audio file ${audioPath}:`, accessError);
            }
          }
        } else {
          // Client-side: revoke object URL
          if (audioPath.startsWith('blob:')) {
            URL.revokeObjectURL(audioPath);
          }
        }
      } catch (error) {
        console.warn(`Failed to cleanup audio file ${audioPath}:`, error);
      }
    }
  }
}
