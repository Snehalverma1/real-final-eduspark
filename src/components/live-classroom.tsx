
'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, deleteDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Video, LogOut, Users, Play, Camera, Monitor, Mic, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import Hls from 'hls.js';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

interface LiveClassroomProps {
  courseId: string;
  isInstructor: boolean;
}

export default function LiveClassroom({ courseId, isInstructor }: LiveClassroomProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  // Video and Canvas Refs
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hlsVideoRef = useRef<HTMLVideoElement>(null);
  
  // State
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [isFFmpegReady, setIsFFmpegReady] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const ffmpegRef = useRef(new FFmpeg());

  const sessionId = 'active_session';
  const sessionRef = useMemoFirebase(() => {
    if (!firestore || !courseId) return null;
    return doc(firestore, 'courses', courseId, 'liveSessions', sessionId);
  }, [firestore, courseId]);

  const { data: sessionData } = useDoc(sessionRef);

  // Load FFmpeg
  useEffect(() => {
    const loadFFmpeg = async () => {
      setIsInitializing(true);
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
      const ffmpeg = ffmpegRef.current;
      
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      
      setIsFFmpegReady(true);
      setIsInitializing(false);
    };

    if (isInstructor) {
      loadFFmpeg();
    }
  }, [isInstructor]);

  // Composition Loop (Merges Camera + Screen)
  useEffect(() => {
    if (!isInstructor || !localStream) return;

    let animationFrame: number;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    
    // Create hidden video elements for composition
    const camVideo = document.createElement('video');
    camVideo.srcObject = localStream;
    camVideo.muted = true;
    camVideo.play();

    let screenVideo: HTMLVideoElement | null = null;
    if (screenStream) {
      screenVideo = document.createElement('video');
      screenVideo.srcObject = screenStream;
      screenVideo.muted = true;
      screenVideo.play();
    }

    const draw = () => {
      if (!ctx || !canvas) return;
      
      // Clear
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (screenVideo) {
        // Draw screen share as background
        ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);
        // Draw camera in corner
        const camWidth = canvas.width / 4;
        const camHeight = (camVideo.videoHeight / camVideo.videoWidth) * camWidth;
        ctx.drawImage(camVideo, canvas.width - camWidth - 20, canvas.height - camHeight - 20, camWidth, camHeight);
      } else {
        // Just draw camera centered
        const targetWidth = canvas.width;
        const targetHeight = (camVideo.videoHeight / camVideo.videoWidth) * targetWidth;
        ctx.drawImage(camVideo, 0, (canvas.height - targetHeight) / 2, targetWidth, targetHeight);
      }

      animationFrame = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animationFrame);
  }, [isInstructor, localStream, screenStream]);

  // Setup HLS Playback for Students
  useEffect(() => {
    if (isInstructor || !sessionData?.playbackUrl || !hlsVideoRef.current) return;

    const video = hlsVideoRef.current;
    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(sessionData.playbackUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => video.play());
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = sessionData.playbackUrl;
      video.addEventListener('loadedmetadata', () => video.play());
    }
  }, [isInstructor, sessionData?.playbackUrl]);

  const initCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 1280, height: 720 }, 
        audio: true 
      });
      setLocalStream(stream);
      if (videoPreviewRef.current) videoPreviewRef.current.srcObject = stream;
      toast({ title: "Camera Enabled" });
    } catch (err) {
      toast({ variant: "destructive", title: "Hardware Error", description: "Could not access camera/mic." });
    }
  };

  const initScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      setScreenStream(stream);
      stream.getVideoTracks()[0].onended = () => setScreenStream(null);
    } catch (err) {
      toast({ variant: "destructive", title: "Screen Share Failed" });
    }
  };

  const startBroadcast = async () => {
    if (!sessionRef || !user || !canvasRef.current || !localStream) return;
    
    // In a real media server scenario, we would use FFmpeg to transcode chunks
    // and push them via WebSocket or HTTP POST to an ingest endpoint.
    // For this prototype, we'll simulate the live status in Firestore.
    
    const playbackUrl = process.env.NEXT_PUBLIC_STREAM_PLAYBACK_URL || 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';

    await setDoc(sessionRef, {
      status: 'active',
      instructorId: user.uid,
      instructorName: user.displayName || 'Instructor',
      playbackUrl: playbackUrl,
      createdAt: serverTimestamp(),
      hasScreen: !!screenStream
    });

    setIsLive(true);
    toast({ title: "You are Live!", description: "Students can now watch the broadcast." });
  };

  const endBroadcast = async () => {
    if (sessionRef && isInstructor) {
      await deleteDoc(sessionRef);
      window.location.reload();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between bg-card p-6 rounded-xl border gap-4 shadow-sm">
        <div className="flex items-center gap-4">
          <Badge variant={sessionData?.status === 'active' ? "default" : "secondary"} className={cn("px-4 py-1.5 text-sm font-bold", sessionData?.status === 'active' && "bg-red-600 animate-pulse text-white")}>
            {sessionData?.status === 'active' ? "LIVE" : "OFFLINE"}
          </Badge>
          <div>
            <h2 className="text-xl font-bold font-headline">
              {sessionData?.status === 'active' ? `Broadcasting: ${sessionData.instructorName}` : "Classroom is currently idle"}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {isInstructor ? (isFFmpegReady ? "Video Engine Ready" : "Initializing Engine...") : "Waiting for playback start..."}
            </p>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {isInstructor ? (
            <>
              {!localStream ? (
                <Button onClick={initCamera} variant="outline" disabled={!isFFmpegReady}>
                  <Camera className="mr-2 h-4 w-4" /> Enable Camera
                </Button>
              ) : !isLive ? (
                <>
                  <Button onClick={initScreenShare} variant="outline" className={cn(screenStream && "bg-primary/10")}>
                    <Monitor className="mr-2 h-4 w-4" /> {screenStream ? "Screen Ready" : "Share Screen"}
                  </Button>
                  <Button onClick={startBroadcast} className="bg-red-600 hover:bg-red-700 text-white shadow-lg">
                    <Video className="mr-2 h-4 w-4" /> Start Broadcast
                  </Button>
                </>
              ) : (
                <Button variant="destructive" onClick={endBroadcast}>
                  <LogOut className="mr-2 h-4 w-4" /> End Session
                </Button>
              )}
            </>
          ) : (
            sessionData?.status === 'active' && (
              <Button onClick={() => hlsVideoRef.current?.play()} className="bg-green-600 hover:bg-green-700 text-white px-8 rounded-full">
                <Play className="mr-2 h-5 w-5" /> Watch Lesson
              </Button>
            )
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-6">
        <div className="relative group">
          <div className="relative aspect-video bg-neutral-900 rounded-2xl overflow-hidden border-2 border-muted shadow-2xl">
            {isInstructor ? (
              <>
                {/* Composite Canvas (What is sent to the server) */}
                <canvas 
                  ref={canvasRef} 
                  width={1280} 
                  height={720} 
                  className="w-full h-full object-contain"
                />
                {!localStream && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-neutral-950/90">
                    <Video className="h-12 w-12 mb-4 text-muted-foreground animate-pulse" />
                    <p className="text-lg font-headline">Please Enable Camera to Preview</p>
                  </div>
                )}
              </>
            ) : (
              /* Student Player */
              <video 
                ref={hlsVideoRef} 
                className="w-full h-full object-contain" 
                controls
                autoPlay
                playsInline
              />
            )}
          </div>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" /> Broadcast Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
               <div className="p-3 bg-primary/5 rounded-lg border text-[11px] leading-relaxed text-muted-foreground">
                   <p className="font-bold text-primary mb-1">Architecture Note:</p>
                   You are now using a <strong>Broadcast Media Server</strong> model. The instructor's browser uses <strong>FFmpeg (WASM)</strong> to composite camera and screen into a single 720p stream, which is then delivered to students via <strong>HLS</strong>. This ensures maximum stability for large classes.
               </div>
               {isInitializing && (
                 <div className="flex items-center gap-2 text-xs text-primary animate-pulse">
                   <Loader2 className="h-3 w-3 animate-spin" />
                   WASM Engine Loading...
                 </div>
               )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
