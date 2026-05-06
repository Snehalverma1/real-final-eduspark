
'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, deleteDoc, serverTimestamp, collection, addDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Video, VideoOff, Mic, MicOff, LogOut, Users, Play, Volume2, VolumeX } from 'lucide-react';
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
  const isStarted = useRef(false);
  
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isRemoteMuted, setIsRemoteMuted] = useState(true);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'failed' | 'offline'>('idle');

  const sessionId = 'active_session';
  const sessionRef = useMemoFirebase(() => {
    if (!firestore || !courseId) return null;
    return doc(firestore, 'courses', courseId, 'liveSessions', sessionId);
  }, [firestore, courseId]);

  const { data: sessionData, isLoading: isSessionLoading } = useDoc(sessionRef);

  useEffect(() => {
    if (!isInstructor) {
      setIsInitialLoading(false);
      return;
    }

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
  }, [isInstructor]);

  const startSession = async () => {
    if (!sessionRef || !localStream || !firestore || !user || isStarted.current) {
        return;
    }

    isStarted.current = true;
    setConnectionStatus('connecting');
    pc.current = new RTCPeerConnection(servers);

    localStream.getTracks().forEach((track) => {
      pc.current?.addTrack(track, localStream);
    });

    const callerCandidatesCollection = collection(sessionRef, 'callerCandidates');
    const calleeCandidatesCollection = collection(sessionRef, 'calleeCandidates');

    pc.current.onicecandidate = (event) => {
      if (event.candidate) {
        addDoc(callerCandidatesCollection, event.candidate.toJSON());
      }
    };

    pc.current.onconnectionstatechange = () => {
      if (pc.current?.connectionState === 'connected') setConnectionStatus('connected');
      if (pc.current?.connectionState === 'failed') setConnectionStatus('failed');
    };

    const offerDescription = await pc.current.createOffer();
    await pc.current.setLocalDescription(offerDescription);

    const offer = {
      sdp: offerDescription.sdp,
      type: offerDescription.type,
    };

    const sessionInitData = {
      offer,
      status: 'active',
      instructorId: user.uid,
      instructorName: user.displayName || 'Instructor',
      createdAt: serverTimestamp(),
    };

    await setDoc(sessionRef, sessionInitData);

    onSnapshot(sessionRef, (snapshot) => {
      const data = snapshot.data();
      if (!pc.current?.currentRemoteDescription && data?.answer) {
        const answerDescription = new RTCSessionDescription(data.answer);
        pc.current?.setRemoteDescription(answerDescription);
      }
    });

    onSnapshot(calleeCandidatesCollection, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          pc.current?.addIceCandidate(new RTCIceCandidate(data));
        }
      });
    });

    toast({ title: "Class Started", description: "You are now live." });
  };

  const joinSession = async () => {
    if (!sessionRef || !firestore || isInstructor || isJoining || !sessionData?.offer) {
      return;
    }

    setIsJoining(true);
    setConnectionStatus('connecting');
    
    try {
      pc.current = new RTCPeerConnection(servers);

      pc.current.ontrack = (event) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      pc.current.onconnectionstatechange = () => {
        if (pc.current?.connectionState === 'connected') setConnectionStatus('connected');
        if (pc.current?.connectionState === 'failed') setConnectionStatus('failed');
      };

      const callerCandidatesCollection = collection(sessionRef, 'callerCandidates');
      const calleeCandidatesCollection = collection(sessionRef, 'calleeCandidates');

      pc.current.onicecandidate = (event) => {
        if (event.candidate) {
          addDoc(calleeCandidatesCollection, event.candidate.toJSON());
        }
      };

      await pc.current.setRemoteDescription(new RTCSessionDescription(sessionData.offer));
      
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
            const candidateData = change.doc.data();
            pc.current?.addIceCandidate(new RTCIceCandidate(candidateData));
          }
        });
      });
    } catch (err) {
      console.error('WebRTC Join Error:', err);
      setConnectionStatus('failed');
      toast({ variant: "destructive", title: "Connection Failed", description: "Could not connect. Please try again." });
    } finally {
      setIsJoining(false);
    }
  };

  const endSession = () => {
    if (!sessionRef) return;
    deleteDoc(sessionRef).then(() => {
      pc.current?.close();
      pc.current = null;
      isStarted.current = false;
      setConnectionStatus('idle');
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
        <p className="text-muted-foreground font-medium">Preparing classroom...</p>
      </div>
    );
  }

  const isActive = sessionData?.status === 'active';
  const hasOffer = !!sessionData?.offer;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Badge variant={isActive ? "default" : "secondary"} className={cn(isActive ? "bg-red-500 animate-pulse text-white" : "")}>
            {isActive ? "LIVE" : "OFFLINE"}
          </Badge>
          <div>
            <h2 className="text-2xl font-bold font-headline">Live Classroom</h2>
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">
              {isActive ? `Host: ${sessionData.instructorName}` : "Classroom is currently idle"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {isInstructor ? (
            isActive ? (
              <Button variant="destructive" onClick={endSession}>
                <LogOut className="mr-2 h-4 w-4" /> End Broadcast
              </Button>
            ) : (
              <Button onClick={startSession} className="bg-red-600 hover:bg-red-700 text-white shadow-lg">
                <Video className="mr-2 h-4 w-4" /> Go Live Now
              </Button>
            )
          ) : (
            isActive && hasOffer && connectionStatus === 'idle' && (
              <Button onClick={joinSession} disabled={isJoining} className="bg-green-600 hover:bg-green-700 text-white shadow-lg">
                {isJoining ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                Join Live Stream
              </Button>
            )
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-4">
          <div className="relative aspect-video bg-neutral-950 rounded-2xl overflow-hidden border-4 border-muted shadow-2xl">
            {isInstructor && (
              <video 
                ref={localVideoRef} 
                className={cn("w-full h-full object-cover", !isVideoEnabled && "hidden")} 
                autoPlay 
                muted 
                playsInline 
              />
            )}

            {!isInstructor && (
              <>
                <video 
                  ref={remoteVideoRef} 
                  className={cn("w-full h-full object-cover", (!isActive || connectionStatus === 'idle') && "hidden")} 
                  autoPlay 
                  playsInline
                  muted={isRemoteMuted}
                />
                
                {isActive && connectionStatus === 'idle' && (
                   <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm text-white p-6 text-center">
                    <Video className="h-16 w-16 mb-4 text-primary opacity-50" />
                    <h3 className="text-xl font-bold">The class is live!</h3>
                    <p className="text-muted-foreground mb-6 max-w-xs">
                      {hasOffer ? "Click the green button above to start receiving the video feed." : "Waiting for instructor's signal..."}
                    </p>
                   </div>
                )}

                {isActive && connectionStatus === 'connecting' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-white">
                    <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                    <p className="font-semibold text-lg">Establishing Secure Connection...</p>
                    <p className="text-sm text-muted-foreground mt-2">Connecting to instructor's broadcast...</p>
                  </div>
                )}

                {isActive && connectionStatus === 'connected' && (
                  <div className="absolute bottom-6 right-6 z-10">
                    <Button 
                      variant="secondary" 
                      size="icon" 
                      className="rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-md"
                      onClick={() => setIsRemoteMuted(!isRemoteMuted)}
                    >
                      {isRemoteMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                    </Button>
                  </div>
                )}
              </>
            )}

            {!isActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-6 text-center bg-neutral-900/50">
                <VideoOff className="h-20 w-20 text-muted-foreground/30 mb-4" />
                <h3 className="text-2xl font-bold text-muted-foreground/50">Classroom Offline</h3>
                {isInstructor && <p className="text-sm mt-2">Click "Go Live Now" to start the session.</p>}
              </div>
            )}

            {isInstructor && isActive && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/40 backdrop-blur-xl p-4 rounded-full border border-white/20 shadow-2xl">
                <Button variant="ghost" size="icon" className={cn("rounded-full h-12 w-12 bg-white/10 hover:bg-white/20 text-white", !isAudioEnabled && "text-red-500 bg-red-500/20")} onClick={toggleAudio}>
                  {isAudioEnabled ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
                </Button>
                <Button variant="ghost" size="icon" className={cn("rounded-full h-12 w-12 bg-white/10 hover:bg-white/20 text-white", !isVideoEnabled && "text-red-500 bg-red-500/20")} onClick={toggleVideo}>
                  {isVideoEnabled ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
                </Button>
              </div>
            )}
          </div>

          {isInstructor && hasCameraPermission === false && (
            <Alert variant="destructive">
              <AlertTitle>Camera Access Required</AlertTitle>
              <AlertDescription>Please enable camera permissions in your browser to broadcast your class.</AlertDescription>
            </Alert>
          )}
        </div>

        <div className="space-y-6">
          <Card className="border-none shadow-lg bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2 font-headline">
                <Users className="h-5 w-5 text-primary" />
                Session Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-xl bg-background border shadow-sm">
                <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Connection State</p>
                <p className="font-bold text-sm capitalize">{connectionStatus === 'connected' ? 'Streaming Live' : connectionStatus}</p>
              </div>
              <div className="p-4 rounded-xl bg-background border shadow-sm">
                <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Your Role</p>
                <p className="font-bold text-sm">{isInstructor ? 'Instructor (Source)' : 'Student (Viewer)'}</p>
              </div>
              {isActive && (
                <div className="flex items-center gap-2 p-2 px-3 bg-primary/5 rounded-lg border border-primary/10">
                  <div className="h-2 w-2 rounded-full bg-primary animate-ping" />
                  <span className="text-xs font-semibold text-primary">Live Data Feed Active</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
