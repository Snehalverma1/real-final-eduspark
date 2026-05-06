'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Video, VideoOff, Mic, MicOff, LogOut, Users, Sparkles, Radio } from 'lucide-react';
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
  }, [stream, isInstructor]);

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
        toast({ title: "Session Started", description: "You are now broadcasting live!" });
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
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
      toast({ title: "Session Ended", description: "The live class has been closed." });
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
          <Badge variant={isActive ? "default" : "secondary"} className={cn(isActive ? "bg-red-500 animate-pulse px-3 py-1" : "px-3 py-1")}>
            {isActive ? "LIVE" : "OFFLINE"}
          </Badge>
          <div>
            <h2 className="text-2xl font-bold font-headline text-foreground leading-none">Live Classroom</h2>
            {isActive && <p className="text-xs text-muted-foreground mt-1">Session started by {sessionData.instructorName}</p>}
          </div>
        </div>
        <div className="flex gap-2">
          {isInstructor && (
            isActive ? (
              <Button variant="destructive" onClick={endSession} className="shadow-lg">
                <LogOut className="mr-2 h-4 w-4" /> End Session
              </Button>
            ) : (
              <Button onClick={startSession} className="bg-red-600 hover:bg-red-700 shadow-lg">
                <Video className="mr-2 h-4 w-4" /> Start Live Stream
              </Button>
            )
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-4">
          <div className="relative aspect-video bg-neutral-900 rounded-2xl overflow-hidden border-4 border-card shadow-2xl group ring-1 ring-border">
            {/* Always render video tag as per guidelines */}
            <video 
              ref={videoRef} 
              className={cn(
                "w-full h-full object-cover transition-opacity duration-500",
                (!isInstructor || !isVideoEnabled) && "opacity-0"
              )} 
              autoPlay 
              muted={isInstructor} 
              playsInline 
            />
            
            {/* Student View / Offline State */}
            {(!isActive && !isInstructor) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white p-6 text-center">
                <div className="bg-white/10 p-6 rounded-full mb-4">
                    <VideoOff className="h-16 w-16 text-muted-foreground/50" />
                </div>
                <h3 className="text-2xl font-bold font-headline">Classroom is Offline</h3>
                <p className="text-sm text-muted-foreground mt-2 max-w-xs">The teacher has not started the session yet. Please wait or check back later.</p>
              </div>
            )}

            {/* Student Viewing Live (Placeholder for signaling) */}
            {(isActive && !isInstructor) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900 text-white p-6 text-center">
                    <Radio className="h-12 w-12 mb-4 text-red-500 animate-pulse" />
                    <h3 className="text-xl font-bold">Connecting to Stream...</h3>
                    <p className="text-sm text-muted-foreground mt-2">You are now in the live room. The teacher is broadcasting.</p>
                    <div className="mt-8 flex gap-2">
                        <Badge variant="outline" className="text-white border-white/20">HD 1080p</Badge>
                        <Badge variant="outline" className="text-white border-white/20">Live Audio</Badge>
                    </div>
                </div>
            )}

            {/* Instructor Video Off State */}
            {(isInstructor && !isVideoEnabled) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-800 text-white">
                    <VideoOff className="h-16 w-16 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium">Your Camera is Off</p>
                </div>
            )}

            {/* Controls Overlays */}
            {isInstructor && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/60 backdrop-blur-xl p-3 rounded-full border border-white/10 opacity-0 group-hover:opacity-100 transition-all duration-300">
                <Button variant="ghost" size="icon" className={cn("rounded-full h-12 w-12 text-white hover:bg-white/20", !isAudioEnabled && "text-red-500 bg-red-500/10")} onClick={toggleAudio}>
                  {isAudioEnabled ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
                </Button>
                <Button variant="ghost" size="icon" className={cn("rounded-full h-12 w-12 text-white hover:bg-white/20", !isVideoEnabled && "text-red-500 bg-red-500/10")} onClick={toggleVideo}>
                  {isVideoEnabled ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
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
                We couldn't access your camera. Please ensure permissions are granted in your browser settings to broadcast the class.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <div className="space-y-6">
          <Card className="border-none shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Class Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50 border">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Instructor</p>
                <p className="font-semibold text-sm">{isActive ? sessionData?.instructorName : "Waiting..."}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 border">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Status</p>
                <p className="font-semibold text-sm capitalize">{isActive ? "Ongoing Broadcasting" : "Session Offline"}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-primary/5 border-primary/20 shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2 text-primary">
                <Sparkles className="h-5 w-5" />
                Live Tips
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-3 text-muted-foreground leading-tight">
              <div className="flex gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                <p>Check your lighting before starting.</p>
              </div>
              <div className="flex gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                <p>Use a wired connection if possible.</p>
              </div>
              <div className="flex gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                <p>Mute your mic when not speaking.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
