'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { doc, setDoc, deleteDoc, serverTimestamp, collection, addDoc, onSnapshot, getDoc, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Video, VideoOff, Mic, MicOff, LogOut, Users, Sparkles, MonitorPlay } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface LiveClassroomProps {
  courseId: string;
  isInstructor: boolean;
}

const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
  iceCandidatePoolSize: 10,
};

export default function LiveClassroom({ courseId, isInstructor }: LiveClassroomProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pc = useRef<RTCPeerConnection | null>(null);
  
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const sessionId = 'active_session';
  const sessionRef = useMemoFirebase(() => {
    if (!firestore || !courseId) return null;
    return doc(firestore, 'courses', courseId, 'liveSessions', sessionId);
  }, [firestore, courseId]);

  const { data: sessionData, isLoading: isSessionLoading } = useDoc(sessionRef);

  // Initialize WebRTC and Camera
  useEffect(() => {
    const initializeMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: true 
        });
        setLocalStream(stream);
        setHasCameraPermission(true);
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      } catch (error) {
        console.error('Error accessing media:', error);
        setHasCameraPermission(false);
      } finally {
        setIsInitialLoading(false);
      }
    };

    initializeMedia();

    return () => {
      localStream?.getTracks().forEach(track => track.stop());
      pc.current?.close();
    };
  }, []);

  // WebRTC Logic for Instructor
  const startSession = async () => {
    if (!sessionRef || !localStream || !firestore) return;

    pc.current = new RTCPeerConnection(servers);

    // Add local tracks to the connection
    localStream.getTracks().forEach((track) => {
      pc.current?.addTrack(track, localStream);
    });

    // Pull candidates from database
    const callerCandidatesCollection = collection(sessionRef, 'callerCandidates');
    const calleeCandidatesCollection = collection(sessionRef, 'calleeCandidates');

    pc.current.onicecandidate = (event) => {
      if (event.candidate) {
        addDoc(callerCandidatesCollection, event.candidate.toJSON());
      }
    };

    // Create offer
    const offerDescription = await pc.current.createOffer();
    await pc.current.setLocalDescription(offerDescription);

    const offer = {
      sdp: offerDescription.sdp,
      type: offerDescription.type,
    };

    const sessionInitData = {
      offer,
      status: 'active',
      instructorId: user?.uid,
      instructorName: user?.displayName || 'Instructor',
      createdAt: serverTimestamp(),
    };

    await setDoc(sessionRef, sessionInitData);

    // Listen for remote answer
    onSnapshot(sessionRef, (snapshot) => {
      const data = snapshot.data();
      if (!pc.current?.currentRemoteDescription && data?.answer) {
        const answerDescription = new RTCSessionDescription(data.answer);
        pc.current.setRemoteDescription(answerDescription);
      }
    });

    // Listen for remote ICE candidates
    onSnapshot(calleeCandidatesCollection, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          pc.current?.addIceCandidate(new RTCIceCandidate(data));
        }
      });
    });

    toast({ title: "Session Started", description: "Your live signals are broadcasting." });
  };

  // WebRTC Logic for Student
  const joinSession = async () => {
    if (!sessionRef || !firestore || isInstructor) return;

    pc.current = new RTCPeerConnection(servers);

    pc.current.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    const callerCandidatesCollection = collection(sessionRef, 'callerCandidates');
    const calleeCandidatesCollection = collection(sessionRef, 'calleeCandidates');

    pc.current.onicecandidate = (event) => {
      if (event.candidate) {
        addDoc(calleeCandidatesCollection, event.candidate.toJSON());
      }
    };

    const sessionSnapshot = await getDoc(sessionRef);
    const sessionData = sessionSnapshot.data();

    if (!sessionData) return;

    const offerDescription = sessionData.offer;
    await pc.current.setRemoteDescription(new RTCSessionDescription(offerDescription));

    const answerDescription = await pc.current.createAnswer();
    await pc.current.setLocalDescription(answerDescription);

    const answer = {
      type: answerDescription.type,
      sdp: answerDescription.sdp,
    };

    await updateDoc(sessionRef, { answer });

    onSnapshot(callerCandidatesCollection, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          pc.current?.addIceCandidate(new RTCIceCandidate(data));
        }
      });
    });
  };

  useEffect(() => {
    if (sessionData?.status === 'active' && !isInstructor && !pc.current) {
      joinSession();
    }
  }, [sessionData, isInstructor]);

  const endSession = () => {
    if (!sessionRef) return;
    deleteDoc(sessionRef).then(() => {
      pc.current?.close();
      pc.current = null;
      toast({ title: "Session Ended", description: "Broadcast stopped." });
    });
  };

  const toggleAudio = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => (track.enabled = !isAudioEnabled));
      setIsAudioEnabled(!isAudioEnabled);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => (track.enabled = !isVideoEnabled));
      setIsVideoEnabled(!isVideoEnabled);
    }
  };

  if (isInitialLoading || isSessionLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground">Initializing Live Connection...</p>
      </div>
    );
  }

  const isActive = sessionData?.status === 'active';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Badge variant={isActive ? "default" : "secondary"} className={cn(isActive ? "bg-red-500 animate-pulse text-white" : "")}>
            {isActive ? "LIVE" : "OFFLINE"}
          </Badge>
          <div>
            <h2 className="text-2xl font-bold font-headline">Live Classroom</h2>
            <p className="text-xs text-muted-foreground">
              {isActive ? `Instructor ${sessionData.instructorName} is streaming` : "Waiting for session to start"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {isInstructor && (
            isActive ? (
              <Button variant="destructive" onClick={endSession}>
                <LogOut className="mr-2 h-4 w-4" /> End Session
              </Button>
            ) : (
              <Button onClick={startSession} className="bg-red-600 hover:bg-red-700 text-white">
                <Video className="mr-2 h-4 w-4" /> Start Live Class
              </Button>
            )
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-4">
          <div className="relative aspect-video bg-neutral-950 rounded-2xl overflow-hidden border shadow-2xl">
            {/* INSTRUCTOR VIEW: Show local camera */}
            {isInstructor && (
              <video 
                ref={localVideoRef} 
                className={cn("w-full h-full object-cover mirror", !isVideoEnabled && "hidden")} 
                autoPlay 
                muted 
                playsInline 
              />
            )}

            {/* STUDENT VIEW: Show remote camera */}
            {!isInstructor && isActive && (
              <video 
                ref={remoteVideoRef} 
                className="w-full h-full object-cover" 
                autoPlay 
                playsInline 
              />
            )}

            {/* Offline State for Student */}
            {!isActive && !isInstructor && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-6 text-center bg-neutral-900">
                <VideoOff className="h-20 w-20 text-muted-foreground mb-4" />
                <h3 className="text-2xl font-bold">Classroom is Offline</h3>
                <p className="text-muted-foreground mt-2">The instructor has not started the live stream yet.</p>
              </div>
            )}

            {/* Instructor Controls */}
            {isInstructor && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/60 backdrop-blur-md p-3 rounded-full border border-white/10 shadow-2xl">
                <Button variant="ghost" size="icon" className={cn("rounded-full h-12 w-12 text-white", !isAudioEnabled && "text-red-500")} onClick={toggleAudio}>
                  {isAudioEnabled ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
                </Button>
                <Button variant="ghost" size="icon" className={cn("rounded-full h-12 w-12 text-white", !isVideoEnabled && "text-red-500")} onClick={toggleVideo}>
                  {isVideoEnabled ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
                </Button>
              </div>
            )}
          </div>

          {isInstructor && hasCameraPermission === false && (
            <Alert variant="destructive">
              <AlertTitle>Camera Access Required</AlertTitle>
              <AlertDescription>Please enable camera permissions in your browser to broadcast.</AlertDescription>
            </Alert>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2 font-headline">
                <Users className="h-5 w-5 text-primary" />
                Class Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50 border">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Host</p>
                <p className="font-bold text-sm">{isActive ? sessionData?.instructorName : "None"}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 border">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Mode</p>
                <p className="font-bold text-sm">{isInstructor ? "Broadcasting" : "Watching"}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-primary font-headline">
                <Sparkles className="h-4 w-4" />
                Live Interaction
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground leading-relaxed">
              Real-time video is active using Peer-to-Peer signaling via Firebase. Latency is optimized for teaching.
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
