'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Video, VideoOff, Mic, MicOff, LogOut, Users, Sparkles, Radio, MonitorPlay } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface LiveClassroomProps {
  courseId: string;
  isInstructor: boolean;
}

export default function LiveClassroom({ courseId, isInstructor }: LiveClassroomProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const sessionId = 'active_session';
  const sessionRef = useMemoFirebase(() => {
    if (!firestore || !courseId) return null;
    return doc(firestore, 'courses', courseId, 'liveSessions', sessionId);
  }, [firestore, courseId]);

  const { data: sessionData, isLoading: isSessionLoading } = useDoc(sessionRef);

  // Handle Camera Permission for Instructor
  useEffect(() => {
    const getCameraPermission = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 1280, height: 720 }, 
          audio: true 
        });
        setHasCameraPermission(true);
        setStream(mediaStream);
        
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Camera Access Denied',
          description: 'Please enable camera permissions in your browser settings to broadcast.',
        });
      } finally {
        setIsInitialLoading(false);
      }
    };

    if (isInstructor) {
      getCameraPermission();
    } else {
      setIsInitialLoading(false);
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isInstructor, toast]);

  // Ensure video ref is updated if it was initially null
  useEffect(() => {
    if (videoRef.current && stream && isInstructor) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, isInstructor, isVideoEnabled]);

  const startSession = () => {
    if (!sessionRef || !user) return;

    const data = {
      id: sessionId,
      courseId,
      instructorId: user.uid,
      instructorName: user.displayName || 'Instructor',
      status: 'active',
      startedAt: serverTimestamp(),
    };

    setDoc(sessionRef, data)
      .then(() => {
        toast({ title: "Session Started", description: "You are now broadcasting live signals!" });
      })
      .catch((e) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: sessionRef.path,
          operation: 'create',
          requestResourceData: data,
        }));
      });
  };

  const endSession = () => {
    if (!sessionRef) return;
    deleteDoc(sessionRef).then(() => {
      if (stream) {
        // Don't stop tracks immediately so instructor can restart if needed
      }
      toast({ title: "Session Ended", description: "The live class signals have been stopped." });
    });
  };

  const toggleAudio = () => {
    if (stream) {
      stream.getAudioTracks().forEach(track => (track.enabled = !isAudioEnabled));
      setIsAudioEnabled(!isAudioEnabled);
    }
  };

  const toggleVideo = () => {
    if (stream) {
      stream.getVideoTracks().forEach(track => (track.enabled = !isVideoEnabled));
      setIsVideoEnabled(!isVideoEnabled);
    }
  };

  if (isInitialLoading || isSessionLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Initializing Classroom...</p>
      </div>
    );
  }

  const isActive = sessionData?.status === 'active';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Badge variant={isActive ? "default" : "secondary"} className={cn(isActive ? "bg-red-500 animate-pulse px-3 py-1 text-white border-none" : "px-3 py-1")}>
            {isActive ? "LIVE" : "OFFLINE"}
          </Badge>
          <div>
            <h2 className="text-2xl font-bold font-headline text-foreground leading-none">Live Classroom</h2>
            {isActive ? (
               <p className="text-xs text-muted-foreground mt-1">Instructor {sessionData.instructorName} is streaming</p>
            ) : (
               <p className="text-xs text-muted-foreground mt-1">Waiting for instructor to start</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {isInstructor && (
            isActive ? (
              <Button variant="destructive" onClick={endSession} className="shadow-lg">
                <LogOut className="mr-2 h-4 w-4" /> End Session
              </Button>
            ) : (
              <Button onClick={startSession} className="bg-red-600 hover:bg-red-700 shadow-lg text-white">
                <Video className="mr-2 h-4 w-4" /> Start Live Class
              </Button>
            )
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-4">
          <div className="relative aspect-video bg-neutral-900 rounded-2xl overflow-hidden border-4 border-card shadow-2xl group ring-1 ring-border">
            {/* Always render video tag for instructor side */}
            <video 
              ref={videoRef} 
              className={cn(
                "w-full h-full object-cover transition-opacity duration-500",
                (!isInstructor || !isVideoEnabled) && "hidden"
              )} 
              autoPlay 
              muted={true} 
              playsInline 
            />
            
            {/* Instructor Video Off State */}
            {(isInstructor && !isVideoEnabled) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-800 text-white">
                    <VideoOff className="h-16 w-16 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium">Your Camera is Off</p>
                    <p className="text-sm text-muted-foreground">Students see an "Instructor Camera Off" placeholder</p>
                </div>
            )}

            {/* Student View / Offline State */}
            {(!isActive && !isInstructor) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-white p-6 text-center">
                <div className="bg-white/5 p-8 rounded-full mb-6">
                    <VideoOff className="h-20 w-20 text-muted-foreground/30" />
                </div>
                <h3 className="text-3xl font-bold font-headline">Classroom is Empty</h3>
                <p className="text-muted-foreground mt-2 max-w-sm">The instructor has not started the session yet. You will be notified automatically when they go live.</p>
              </div>
            )}

            {/* Student Viewing Live (Signaling Prototype View) */}
            {(isActive && !isInstructor) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950 text-white p-6 text-center">
                    <div className="relative mb-8">
                        <MonitorPlay className="h-24 w-24 text-primary animate-pulse" />
                        <span className="absolute -top-2 -right-2 flex h-6 w-6">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-6 w-6 bg-red-600"></span>
                        </span>
                    </div>
                    <h3 className="text-2xl font-bold font-headline">Receiving Live Feed...</h3>
                    <p className="text-muted-foreground mt-2 max-w-xs">You are connected to {sessionData.instructorName}&apos;s classroom signals.</p>
                    
                    <div className="mt-10 grid grid-cols-3 gap-4 w-full max-w-sm">
                        <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                            <p className="text-[10px] uppercase font-bold text-primary">Latency</p>
                            <p className="text-lg font-mono">24ms</p>
                        </div>
                        <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                            <p className="text-[10px] uppercase font-bold text-primary">Quality</p>
                            <p className="text-lg font-mono">1080p</p>
                        </div>
                        <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                            <p className="text-[10px] uppercase font-bold text-primary">Users</p>
                            <p className="text-lg font-mono">12</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Instructor UI Overlays */}
            {isInstructor && isActive && (
              <div className="absolute top-4 left-4 flex items-center gap-2">
                <div className="bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1.5 uppercase tracking-widest shadow-lg">
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                  Live Recording
                </div>
              </div>
            )}

            {/* Controls Overlays for Instructor */}
            {isInstructor && (
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/80 backdrop-blur-2xl p-4 rounded-full border border-white/20 shadow-2xl transition-all duration-300">
                <Button variant="ghost" size="icon" className={cn("rounded-full h-14 w-14 text-white hover:bg-white/20", !isAudioEnabled && "text-red-500 bg-red-500/20")} onClick={toggleAudio}>
                  {isAudioEnabled ? <Mic className="h-7 w-7" /> : <MicOff className="h-7 w-7" />}
                </Button>
                <Button variant="ghost" size="icon" className={cn("rounded-full h-14 w-14 text-white hover:bg-white/20", !isVideoEnabled && "text-red-500 bg-red-500/20")} onClick={toggleVideo}>
                  {isVideoEnabled ? <Video className="h-7 w-7" /> : <VideoOff className="h-7 w-7" />}
                </Button>
              </div>
            )}
          </div>

          { isInstructor && hasCameraPermission === false && (
            <Alert variant="destructive" className="bg-destructive/10 border-destructive/20">
              <AlertTitle className="flex items-center gap-2">
                <VideoOff className="h-4 w-4" />
                Camera Access Required
              </AlertTitle>
              <AlertDescription>
                Please allow camera access in your browser to start the live class.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <div className="space-y-6">
          <Card className="border-none shadow-xl bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2 font-headline">
                <Users className="h-5 w-5 text-primary" />
                Class Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-black">Current Host</p>
                <p className="font-bold text-sm text-foreground mt-0.5">{isActive ? sessionData?.instructorName : "None"}</p>
              </div>
              <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-black">Connection Status</p>
                <p className={cn("font-bold text-sm mt-0.5", isActive ? "text-green-600" : "text-muted-foreground")}>
                    {isActive ? "Stable Signaling" : "Idle"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-primary/5 border-primary/20 shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2 text-primary font-headline">
                <Sparkles className="h-5 w-5" />
                Teaching Tips
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-4 text-muted-foreground leading-relaxed">
              <div className="flex gap-3">
                <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                <p>Welcome students by name as they join the signaling room.</p>
              </div>
              <div className="flex gap-3">
                <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                <p>Use the "Ask AI" panel to help answer tough questions.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
