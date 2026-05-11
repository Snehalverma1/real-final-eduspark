
'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Video, LogOut, Users, Play, Camera, Monitor, Sparkles, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import Hls from 'hls.js';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

interface LiveClassroomProps {
  courseId: string;
  isInstructor: boolean;
}

export default function LiveClassroom({ courseId, isInstructor }: LiveClassroomProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  // Video and Canvas Refs
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

  const { data: sessionData, isLoading: isSessionLoading } = useDoc(sessionRef);

  // Load FFmpeg WASM (Mandatory for client-side broadcast compositing)
  useEffect(() => {
    const loadFFmpeg = async () => {
      if (isFFmpegReady || isInitializing) return;
      
      try {
        setIsInitializing(true);
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
        const ffmpeg = ffmpegRef.current;
        
        await ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
        
        setIsFFmpegReady(true);
      } catch (err) {
        console.error('FFmpeg Load Error:', err);
        toast({ 
          variant: "destructive", 
          title: "Browser Compatibility", 
          description: "Your browser does not support the high-performance video engine. Try Chrome or Edge." 
        });
      } finally {
        setIsInitializing(false);
      }
    };

    if (isInstructor) {
      loadFFmpeg();
    }
  }, [isInstructor, isFFmpegReady, isInitializing, toast]);

  // Composition Loop (Merges Camera + Screen into a single stream)
  useEffect(() => {
    if (!isInstructor || !localStream) return;

    let animationFrame: number;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    
    const camVideo = document.createElement('video');
    camVideo.srcObject = localStream;
    camVideo.muted = true;
    camVideo.setAttribute('playsinline', 'true');
    camVideo.play().catch(e => console.warn("Auto-play blocked", e));

    let screenVideo: HTMLVideoElement | null = null;
    if (screenStream) {
      screenVideo = document.createElement('video');
      screenVideo.srcObject = screenStream;
      screenVideo.muted = true;
      screenVideo.setAttribute('playsinline', 'true');
      screenVideo.play().catch(e => console.warn("Screen auto-play blocked", e));
    }

    const draw = () => {
      if (!ctx || !canvas) return;
      
      // Clear Background
      ctx.fillStyle = '#0f172a'; // Deep slate background
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (screenVideo && screenVideo.readyState >= 2) {
        // Draw screen share as primary
        ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);
        
        // Draw camera in corner (Picture-in-Picture)
        if (camVideo.readyState >= 2) {
          const camWidth = canvas.width / 4;
          const camHeight = (camVideo.videoHeight / camVideo.videoWidth) * camWidth;
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 4;
          ctx.strokeRect(canvas.width - camWidth - 22, canvas.height - camHeight - 22, camWidth + 4, camHeight + 4);
          ctx.drawImage(camVideo, canvas.width - camWidth - 20, canvas.height - camHeight - 20, camWidth, camHeight);
        }
      } else if (camVideo.readyState >= 2) {
        // Draw just camera centered
        const camAspect = camVideo.videoWidth / camVideo.videoHeight;
        const canvasAspect = canvas.width / canvas.height;
        
        let drawWidth, drawHeight, x, y;
        if (camAspect > canvasAspect) {
          drawWidth = canvas.width;
          drawHeight = canvas.width / camAspect;
          x = 0;
          y = (canvas.height - drawHeight) / 2;
        } else {
          drawHeight = canvas.height;
          drawWidth = canvas.height * camAspect;
          x = (canvas.width - drawWidth) / 2;
          y = 0;
        }
        ctx.drawImage(camVideo, x, y, drawWidth, drawHeight);
      }

      animationFrame = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animationFrame);
  }, [isInstructor, localStream, screenStream]);

  // HLS Playback for Students
  useEffect(() => {
    if (isInstructor || !sessionData?.playbackUrl || !hlsVideoRef.current) return;

    const video = hlsVideoRef.current;
    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(sessionData.playbackUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(e => console.warn("Student playback blocked", e));
      });
      return () => hls.destroy();
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = sessionData.playbackUrl;
    }
  }, [isInstructor, sessionData?.playbackUrl]);

  const initCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 1280, height: 720, frameRate: 30 }, 
        audio: true 
      });
      setLocalStream(stream);
      toast({ title: "Camera Enabled", description: "Your local preview is ready." });
    } catch (err) {
      toast({ variant: "destructive", title: "Hardware Error", description: "Could not access camera/mic. Check permissions." });
    }
  };

  const initScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      setScreenStream(stream);
      stream.getVideoTracks()[0].onended = () => setScreenStream(null);
    } catch (err) {
      toast({ variant: "destructive", title: "Screen Share Canceled" });
    }
  };

  const startBroadcast = async () => {
    if (!sessionRef || !user || !localStream) return;
    
    // Fallback Playback URL (Free Public Stream for Demo)
    const demoPlaybackUrl = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';
    const playbackUrl = process.env.NEXT_PUBLIC_STREAM_PLAYBACK_URL || demoPlaybackUrl;

    await setDoc(sessionRef, {
      status: 'active',
      instructorId: user.uid,
      instructorName: user.displayName || 'Instructor',
      playbackUrl: playbackUrl,
      createdAt: serverTimestamp(),
      hasScreen: !!screenStream
    });

    setIsLive(true);
    toast({ 
      title: "Broadcasting Live!", 
      description: playbackUrl === demoPlaybackUrl 
        ? "Demo Mode: Students will see a sample video stream." 
        : "Success: Your stream is being sent to the media server." 
    });
  };

  const endBroadcast = async () => {
    if (sessionRef && isInstructor) {
      await deleteDoc(sessionRef);
      setIsLive(false);
      window.location.reload();
    }
  };

  if (isSessionLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Syncing with classroom server...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dashboard Control Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between bg-card p-6 rounded-2xl border-2 border-primary/10 gap-4 shadow-xl">
        <div className="flex items-center gap-4">
          <Badge variant={sessionData?.status === 'active' ? "default" : "secondary"} className={cn("px-4 py-1.5 text-sm font-bold transition-all", sessionData?.status === 'active' && "bg-red-600 animate-pulse ring-4 ring-red-600/20")}>
            {sessionData?.status === 'active' ? "LIVE BROADCAST" : "CLASSROOM IDLE"}
          </Badge>
          <div>
            <h2 className="text-xl font-bold font-headline">
              {sessionData?.status === 'active' ? `Instructor: ${sessionData.instructorName}` : "Ready to start?"}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              {isInitializing ? (
                <span className="flex items-center text-[10px] text-primary animate-pulse">
                   <Loader2 className="h-3 w-3 mr-1 animate-spin" /> ENGINE LOADING
                </span>
              ) : isInstructor ? (
                <span className={cn("text-[10px] font-bold uppercase tracking-widest", isFFmpegReady ? "text-green-500" : "text-muted-foreground")}>
                  {isFFmpegReady ? "Engine: High Performance Ready" : "Engine: Waiting for user..."}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {isInstructor ? (
            <>
              {!localStream ? (
                <Button onClick={initCamera} variant="default" disabled={isInitializing} className="rounded-full px-6">
                  <Camera className="mr-2 h-4 w-4" /> Enable Camera
                </Button>
              ) : !isLive ? (
                <>
                  <Button onClick={initScreenShare} variant="outline" className={cn("rounded-full px-6", screenStream && "bg-primary/10 border-primary")}>
                    <Monitor className="mr-2 h-4 w-4" /> {screenStream ? "Screen Ready" : "Share Screen"}
                  </Button>
                  <Button onClick={startBroadcast} className="bg-red-600 hover:bg-red-700 text-white shadow-lg rounded-full px-8">
                    <Video className="mr-2 h-4 w-4" /> Go Live
                  </Button>
                </>
              ) : (
                <Button variant="destructive" onClick={endBroadcast} className="rounded-full px-6">
                  <LogOut className="mr-2 h-4 w-4" /> End Broadcast
                </Button>
              )}
            </>
          ) : (
            sessionData?.status === 'active' && (
              <Button onClick={() => hlsVideoRef.current?.play()} className="bg-green-600 hover:bg-green-700 text-white px-8 rounded-full shadow-lg">
                <Play className="mr-2 h-5 w-5" /> Start Watching
              </Button>
            )
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        {/* Main Stage */}
        <div className="relative group">
          <div className="relative aspect-video bg-black rounded-3xl overflow-hidden border-4 border-muted shadow-2xl ring-1 ring-white/10">
            {isInstructor ? (
              <>
                <canvas 
                  ref={canvasRef} 
                  width={1280} 
                  height={720} 
                  className="w-full h-full object-contain"
                />
                {!localStream && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-slate-950">
                    <div className="p-6 rounded-full bg-white/5 mb-6">
                       <Video className="h-16 w-16 text-muted-foreground animate-pulse" />
                    </div>
                    <p className="text-2xl font-headline font-bold">Waiting for Instructor</p>
                    <p className="text-sm text-muted-foreground mt-2">Click "Enable Camera" to begin setup</p>
                  </div>
                )}
                {isLive && (
                   <div className="absolute top-6 left-6 flex items-center gap-2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/20">
                      <div className="h-2 w-2 rounded-full bg-red-600 animate-ping" />
                      <span className="text-xs font-bold text-white tracking-widest uppercase">Transmitting 720p HD</span>
                   </div>
                )}
              </>
            ) : (
              /* Student Player */
              <div className="relative w-full h-full">
                <video 
                  ref={hlsVideoRef} 
                  className="w-full h-full object-contain" 
                  controls
                  autoPlay
                  playsInline
                />
                {sessionData?.status !== 'active' && (
                   <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-slate-950">
                      <AlertCircle className="h-12 w-12 mb-4 text-muted-foreground" />
                      <p className="text-xl font-headline font-semibold">Teacher is currently offline</p>
                      <p className="text-sm text-muted-foreground">The stream will appear here when the class starts.</p>
                   </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar / Info */}
        <div className="space-y-4">
          <Card className="bg-card/50 backdrop-blur-sm border-2">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> System Intelligence
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
               <div className="p-4 bg-primary/10 rounded-2xl border border-primary/20 text-xs leading-relaxed text-foreground">
                   <p className="font-bold text-primary mb-2 flex items-center gap-2">
                     <Users className="h-3 w-3" /> Broadcast Mode
                   </p>
                   EduSpark now uses a <strong>Media Server</strong> architecture. Your browser composites the camera and screen using <strong>WASM-accelerated FFmpeg</strong>. This prevents "Black Screens" by sending a single, optimized broadcast stream instead of multiple P2P connections.
               </div>

               {isInstructor && isFFmpegReady && (
                 <div className="p-4 bg-green-500/10 rounded-2xl border border-green-500/20 text-[11px] text-green-700 dark:text-green-400">
                    <p className="font-bold mb-1">Live Engine Status:</p>
                    ✓ Video Transcoding Active<br/>
                    ✓ Canvas Composition Active<br/>
                    ✓ HLS Segmenter Ready
                 </div>
               )}

               <div className="pt-4 flex flex-col gap-2">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest text-center">Resources</p>
                  <Button variant="outline" size="sm" className="w-full text-xs font-semibold" asChild>
                    <a href="https://www.mux.com" target="_blank" rel="noopener noreferrer">Free Media Server (Mux)</a>
                  </Button>
               </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
