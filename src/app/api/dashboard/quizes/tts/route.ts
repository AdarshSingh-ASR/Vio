import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedServices } from '@/lib/appwrite-server';

export async function POST(req: NextRequest) {
  try {
    // Authenticate the request
    const { user } = await getAuthenticatedServices(req);
    
    const { text } = await req.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    // Limit text length for API efficiency
    const truncatedText = text.substring(0, 1000);
    console.log('🔊 TTS API: Processing text of length:', truncatedText.length);

    // Try to use ElevenLabs API if available
    if (process.env.ELEVENLABS_API_KEY) {
      try {
        console.log('🔊 TTS API: Attempting ElevenLabs TTS');
        const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM', {
          method: 'POST',
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': process.env.ELEVENLABS_API_KEY
          },
          body: JSON.stringify({
            text: truncatedText,
            model_id: 'eleven_monolingual_v1',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.5
            }
          })
        });

        if (response.ok) {
          console.log('🔊 TTS API: ElevenLabs TTS successful');
          const audioBuffer = await response.arrayBuffer();
          return new NextResponse(audioBuffer, {
            headers: {
              'Content-Type': 'audio/mpeg',
              'Content-Length': audioBuffer.byteLength.toString(),
            },
          });
        } else {
          console.log('🔊 TTS API: ElevenLabs failed, status:', response.status);
        }
      } catch (error) {
        console.error('🔊 TTS API: ElevenLabs error:', error);
      }
    }

    // Try to use OpenAI TTS if available
    if (process.env.OPENAI_API_KEY) {
      try {
        console.log('🔊 TTS API: Attempting OpenAI TTS');
        const response = await fetch('https://api.openai.com/v1/audio/speech', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'tts-1',
            input: truncatedText,
            voice: 'alloy',
            response_format: 'mp3'
          })
        });

        if (response.ok) {
          console.log('🔊 TTS API: OpenAI TTS successful');
          const audioBuffer = await response.arrayBuffer();
          return new NextResponse(audioBuffer, {
            headers: {
              'Content-Type': 'audio/mpeg',
              'Content-Length': audioBuffer.byteLength.toString(),
            },
          });
        } else {
          console.log('🔊 TTS API: OpenAI failed, status:', response.status);
        }
      } catch (error) {
        console.error('🔊 TTS API: OpenAI error:', error);
      }
    }

    // Try Google Cloud TTS if available
    if (process.env.GOOGLE_CLOUD_TTS_API_KEY) {
      try {
        console.log('🔊 TTS API: Attempting Google Cloud TTS');
        const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${process.env.GOOGLE_CLOUD_TTS_API_KEY}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            input: { text: truncatedText },
            voice: { languageCode: 'en-US', name: 'en-US-Wavenet-D' },
            audioConfig: { audioEncoding: 'MP3' }
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.audioContent) {
            console.log('🔊 TTS API: Google Cloud TTS successful');
            const audioBuffer = Buffer.from(data.audioContent, 'base64');
            return new NextResponse(audioBuffer, {
              headers: {
                'Content-Type': 'audio/mpeg',
                'Content-Length': audioBuffer.length.toString(),
              },
            });
          }
        } else {
          console.log('🔊 TTS API: Google Cloud failed, status:', response.status);
        }
      } catch (error) {
        console.error('🔊 TTS API: Google Cloud error:', error);
      }
    }

    // Try Azure Cognitive Services TTS if available
    if (process.env.AZURE_TTS_API_KEY && process.env.AZURE_TTS_REGION) {
      try {
        console.log('🔊 TTS API: Attempting Azure TTS');
        const response = await fetch(`https://${process.env.AZURE_TTS_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': process.env.AZURE_TTS_API_KEY,
            'Content-Type': 'application/ssml+xml',
            'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3'
          },
          body: `<speak version='1.0' xml:lang='en-US'><voice xml:lang='en-US' xml:gender='Female' name='en-US-AriaNeural'>${truncatedText}</voice></speak>`
        });

        if (response.ok) {
          console.log('🔊 TTS API: Azure TTS successful');
          const audioBuffer = await response.arrayBuffer();
          return new NextResponse(audioBuffer, {
            headers: {
              'Content-Type': 'audio/mpeg',
              'Content-Length': audioBuffer.byteLength.toString(),
            },
          });
        } else {
          console.log('🔊 TTS API: Azure failed, status:', response.status);
        }
      } catch (error) {
        console.error('🔊 TTS API: Azure error:', error);
      }
    }

    // All TTS services failed, return browser fallback
    console.log('🔊 TTS API: All external TTS services failed, returning browser fallback');
    return NextResponse.json({ 
      useBrowserTTS: true, 
      text: truncatedText,
      message: 'External TTS services unavailable. Using browser speech synthesis.',
      availableServices: {
        elevenlabs: !!process.env.ELEVENLABS_API_KEY,
        openai: !!process.env.OPENAI_API_KEY,
        googleCloud: !!process.env.GOOGLE_CLOUD_TTS_API_KEY,
        azure: !!(process.env.AZURE_TTS_API_KEY && process.env.AZURE_TTS_REGION)
      }
    });

  } catch (error: any) {
    console.error('🔊 TTS generation error:', error);
    
    // Handle authentication errors
    if (error.message?.includes('JWT') || error.message?.includes('Authentication')) {
      return NextResponse.json(
        { error: 'Authentication required', details: error.message },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to generate audio',
        useBrowserTTS: true,
        text: '',
        message: 'TTS service error. Please try again.'
      },
      { status: 500 }
    );
  }
} 