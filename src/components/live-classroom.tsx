'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Video, VideoOff, Mic, MicOff, LogOut, Users, Sparkles } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);

  const sessionId = 'active_session';
  const sessionRef = useMemoFirebase(() => {
    if (!firestore || !courseId) return null;
    return doc(firestore, 'courses', courseId, 'liveSessions', sessionId);
  }, [firestore, courseId]);

  const { data: sessionData } = useDoc(sessionRef);

  useEffect(() => {
    const getCameraPermission = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
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
          description: 'Please enable camera permissions in your browser settings to use this app.',
        });
      } finally {
        setLoading(false);
      }
    };

    if (isInstructor) {
      getCameraPermission();
    } else {
      setLoading(false);
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isInstructor, toast]);

  const startSession = () => {
    if (!sessionRef || !user) return;

    const data = {
      id: sessionId,
      courseId,
      instructorId: user.uid,
      instructorName: user.displayName || 'Instructor',
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    setDoc(sessionRef, data)
      .then(() => {
        toast({ title: "Session Started", description: "Students can now join your live class." });
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

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  const isActive = sessionData?.status === 'active';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant={isActive ? "default" : "secondary"} className={cn(isActive && "bg-red-500 animate-pulse")}>
            {isActive ? "LIVE" : "OFFLINE"}
          </Badge>
          <h2 className="text-2xl font-bold font-headline text-foreground">Live Classroom</h2>
        </div>
        <div className="flex gap-2">
          {isInstructor && !isActive && (
            <Button onClick={startSession} className="bg-red-600 hover:bg-red-700">
              <Video className="mr-2 h-4 w-4" /> Start Live Class
            </Button>
          )}
          {isInstructor && isActive && (
            <Button variant="destructive" onClick={endSession}>
              <LogOut className="mr-2 h-4 w-4" /> End Session
            </Button>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-6">
        <div className="space-y-4">
          <div className="relative aspect-video bg-black rounded-xl overflow-hidden border shadow-2xl group">
            {/* Always show video tag irrespective of hasCameraPermission check to prevent race condition */}
            <video 
              ref={videoRef} 
              className="w-full h-full object-cover" 
              autoPlay 
              muted={isInstructor} 
              playsInline 
            />
            
            {(!isActive && !isInstructor) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-white p-6 text-center">
                <VideoOff className="h-12 w-12 mb-4 text-muted-foreground" />
                <h3 className="text-xl font-bold">Waiting for Teacher</h3>
                <p className="text-sm text-muted-foreground mt-2">The live session has not started yet.</p>
              </div>
            )}

            {isInstructor && isActive && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/40 backdrop-blur-md p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="rounded-full text-white hover:bg-white/20" onClick={toggleAudio}>
                  {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5 text-red-500" />}
                </Button>
                <Button variant="ghost" size="icon" className="rounded-full text-white hover:bg-white/20" onClick={toggleVideo}>
                  {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5 text-red-500" />}
                </Button>
              </div>
            )}
          </div>

          { isInstructor && hasCameraPermission === false && (
            <Alert variant="destructive">
              <AlertTitle>Camera Access Required</AlertTitle>
              <AlertDescription>
                Please allow camera access to use this feature.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Class Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm">
                <p className="text-muted-foreground">Instructor</p>
                <p className="font-semibold">{isActive ? sessionData?.instructorName : "N/A"}</p>
              </div>
              <div className="text-sm">
                <p className="text-muted-foreground">Status</p>
                <p className="font-semibold capitalize">{isActive ? "Ongoing Session" : "Scheduled"}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Quick Tips
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2 text-muted-foreground">
              <p>• Ensure your lighting is good.</p>
              <p>• Use a headset for better audio.</p>
              <p>• Check your internet connection.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}