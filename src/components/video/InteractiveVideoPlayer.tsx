'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  SkipBack, 
  SkipForward,
  Settings,
  Maximize,
  RotateCcw,
  RotateCw
} from 'lucide-react';

interface InteractiveVideoPlayerProps {
  videoUrl: string;
  audioUrl?: string;
  title: string;
  duration: number;
  chapters?: Array<{
    title: string;
    startTime: number;
    endTime: number;
  }>;
  interactiveFeatures?: string[];
  onVideoEnd?: () => void;
  onChapterChange?: (chapterIndex: number) => void;
}

export default function InteractiveVideoPlayer({
  videoUrl,
  audioUrl,
  title,
  duration,
  chapters = [],
  interactiveFeatures = [],
  onVideoEnd,
  onChapterChange
}: InteractiveVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [currentChapter, setCurrentChapter] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const [useSeparateAudio, setUseSeparateAudio] = useState(false);

  // Update current time
  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    
    if (!video) return;

    const updateTime = () => {
      const currentVideoTime = video.currentTime;
      setCurrentTime(currentVideoTime);
      
      // Sync audio with video if using separate audio
      if (useSeparateAudio && audio && audioUrl) {
        const audioTime = audio.currentTime;
        const timeDiff = Math.abs(currentVideoTime - audioTime);
        if (timeDiff > 0.5) { // If more than 0.5 seconds difference
          audio.currentTime = currentVideoTime;
        }
      }
    };
    
    const handleEnded = () => {
      setIsPlaying(false);
      if (useSeparateAudio && audio) {
        audio.pause();
      }
      onVideoEnd?.();
    };

    video.addEventListener('timeupdate', updateTime);
    video.addEventListener('ended', handleEnded);
    
    if (useSeparateAudio && audio) {
      audio.addEventListener('timeupdate', updateTime);
      audio.addEventListener('ended', handleEnded);
    }

    return () => {
      video.removeEventListener('timeupdate', updateTime);
      video.removeEventListener('ended', handleEnded);
      if (audio) {
        audio.removeEventListener('timeupdate', updateTime);
        audio.removeEventListener('ended', handleEnded);
      }
    };
  }, [onVideoEnd, useSeparateAudio, audioUrl]);

  // Update current chapter
  useEffect(() => {
    if (chapters.length === 0) return;

    const chapterIndex = chapters.findIndex(
      (chapter, index) => 
        currentTime >= chapter.startTime && 
        (index === chapters.length - 1 || currentTime < chapters[index + 1].startTime)
    );

    if (chapterIndex !== -1 && chapterIndex !== currentChapter) {
      setCurrentChapter(chapterIndex);
      onChapterChange?.(chapterIndex);
    }
  }, [currentTime, chapters, currentChapter, onChapterChange]);

  const togglePlay = () => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video) return;

    if (video.paused) {
      video.play();
      if (useSeparateAudio && audio && audioUrl) {
        audio.play();
      }
      setIsPlaying(true);
    } else {
      video.pause();
      if (useSeparateAudio && audio) {
        audio.pause();
      }
      setIsPlaying(false);
    }
  };

  const handleSeek = (value: number[]) => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video) return;

    video.currentTime = value[0];
    if (useSeparateAudio && audio && audioUrl) {
      audio.currentTime = value[0];
    }
    setCurrentTime(value[0]);
  };

  const handleVolumeChange = (value: number[]) => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video) return;

    const newVolume = value[0];
    video.volume = newVolume;
    if (useSeparateAudio && audio) {
      audio.volume = newVolume;
    }
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video) return;

    if (isMuted) {
      video.volume = volume;
      if (useSeparateAudio && audio) {
        audio.volume = volume;
      }
      setIsMuted(false);
    } else {
      video.volume = 0;
      if (useSeparateAudio && audio) {
        audio.volume = 0;
      }
      setIsMuted(true);
    }
  };

  const changePlaybackRate = (rate: number) => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video) return;

    video.playbackRate = rate;
    if (useSeparateAudio && audio) {
      audio.playbackRate = rate;
    }
    setPlaybackRate(rate);
  };

  const skipToChapter = (chapterIndex: number) => {
    const video = videoRef.current;
    if (!video || !chapters[chapterIndex]) return;

    video.currentTime = chapters[chapterIndex].startTime;
    setCurrentChapter(chapterIndex);
  };

  const skipBackward = () => {
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = Math.max(0, video.currentTime - 10);
  };

  const skipForward = () => {
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = Math.min(duration, video.currentTime + 10);
  };

  const toggleFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;

    if (!document.fullscreenElement) {
      video.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{title}</span>
          <div className="flex items-center gap-2">
            {interactiveFeatures.map((feature, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {feature}
              </Badge>
            ))}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Video Player */}
        <div 
          className="relative bg-black rounded-lg overflow-hidden"
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        >
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-auto"
            poster=""
            onClick={togglePlay}
            muted={useSeparateAudio}
          />
          
          {/* Hidden audio element for separate audio */}
          {audioUrl && (
            <audio
              ref={audioRef}
              src={audioUrl}
              preload="metadata"
              style={{ display: 'none' }}
            />
          )}
          
          {/* Overlay Controls */}
          {(isHovering || !isPlaying) && (
            <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
              <Button
                size="lg"
                variant="secondary"
                onClick={togglePlay}
                className="w-16 h-16 rounded-full"
              >
                {isPlaying ? <Pause className="h-8 w-8" /> : <Play className="h-8 w-8" />}
              </Button>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <Slider
            value={[currentTime]}
            onValueChange={handleSeek}
            max={duration}
            step={0.1}
            className="w-full"
          />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={togglePlay}>
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            
            <Button variant="ghost" size="sm" onClick={skipBackward}>
              <SkipBack className="h-4 w-4" />
            </Button>
            
            <Button variant="ghost" size="sm" onClick={skipForward}>
              <SkipForward className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={toggleMute}>
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
              <Slider
                value={[isMuted ? 0 : volume]}
                onValueChange={handleVolumeChange}
                max={1}
                step={0.1}
                className="w-20"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="h-4 w-4" />
            </Button>
            
            <Button variant="ghost" size="sm" onClick={toggleFullscreen}>
              <Maximize className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <Card className="p-4">
            <h4 className="font-medium mb-3">Playback Settings</h4>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Playback Speed</label>
                <div className="flex gap-2 mt-1">
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                    <Button
                      key={rate}
                      variant={playbackRate === rate ? "default" : "outline"}
                      size="sm"
                      onClick={() => changePlaybackRate(rate)}
                    >
                      {rate}x
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Chapter Navigation */}
        {chapters.length > 0 && (
          <Card className="p-4">
            <h4 className="font-medium mb-3">Chapters</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {chapters.map((chapter, index) => (
                <Button
                  key={index}
                  variant={currentChapter === index ? "default" : "outline"}
                  size="sm"
                  onClick={() => skipToChapter(index)}
                  className="justify-start"
                >
                  <span className="truncate">
                    {chapter.title} ({formatTime(chapter.startTime)})
                  </span>
                </Button>
              ))}
            </div>
          </Card>
        )}

        {/* Audio Track Selection */}
        {audioUrl && (
          <Card className="p-4">
            <h4 className="font-medium mb-3">Audio Tracks</h4>
            <div className="flex gap-2">
              <Button
                variant={!useSeparateAudio ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setUseSeparateAudio(false);
                  const video = videoRef.current;
                  const audio = audioRef.current;
                  if (video) {
                    video.muted = false;
                    video.volume = volume;
                  }
                  if (audio) {
                    audio.pause();
                  }
                }}
              >
                Video Audio
              </Button>
              <Button
                variant={useSeparateAudio ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setUseSeparateAudio(true);
                  const video = videoRef.current;
                  const audio = audioRef.current;
                  if (video) {
                    video.muted = true;
                  }
                  if (audio) {
                    audio.volume = volume;
                    audio.currentTime = video?.currentTime || 0;
                  }
                }}
              >
                Generated Audio
              </Button>
            </div>
            {useSeparateAudio && (
              <p className="text-sm text-muted-foreground mt-2">
                Using AI-generated voiceover audio
              </p>
            )}
          </Card>
        )}
      </CardContent>
    </Card>
  );
}
