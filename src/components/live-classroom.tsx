'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, deleteDoc, serverTimestamp, collection, addDoc, onSnapshot, getDoc, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Video, VideoOff, Mic, MicOff, LogOut, Users, Sparkles, Play } from 'lucide-react';
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
  const [isJoining, setIsJoining] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'failed' | 'offline'>('idle');

  const sessionId = 'active_session';
  const sessionRef = useMemoFirebase(() => {
    if (!firestore || !courseId) return null;
    return doc(firestore, 'courses', courseId, 'liveSessions', sessionId);
  }, [firestore, courseId]);

  const { data: sessionData, isLoading: isSessionLoading } = useDoc(sessionRef);

  // Initialize Media for Instructor
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

  // Start Session (Instructor/Caller)
  const startSession = async () => {
    if (!sessionRef || !localStream || !firestore || !user) return;

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

    // Listen for Answer
    const unsubscribe = onSnapshot(sessionRef, (snapshot) => {
      const data = snapshot.data();
      if (!pc.current?.currentRemoteDescription && data?.answer) {
        const answerDescription = new RTCSessionDescription(data.answer);
        pc.current?.setRemoteDescription(answerDescription);
      }
    });

    // Listen for Callee ICE Candidates
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

  // Join Session (Student/Callee)
  const joinSession = async () => {
    if (!sessionRef || !firestore || isInstructor || isJoining) return;

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

      const sessionSnapshot = await getDoc(sessionRef);
      const data = sessionSnapshot.data();

      if (!data || !data.offer) {
        toast({ variant: "destructive", title: "Error", description: "No active broadcast found." });
        setConnectionStatus('offline');
        return;
      }

      // 1. Set Remote Description (Offer)
      await pc.current.setRemoteDescription(new RTCSessionDescription(data.offer));
      
      // 2. Create Answer
      const answerDescription = await pc.current.createAnswer();
      await pc.current.setLocalDescription(answerDescription);

      const answer = {
        type: answerDescription.type,
        sdp: answerDescription.sdp,
      };

      // 3. Write Answer to Firestore
      await updateDoc(sessionRef, { answer });

      // 4. Listen for Caller ICE Candidates
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
    } finally {
      setIsJoining(false);
    }
  };

  const endSession = () => {
    if (!sessionRef) return;
    deleteDoc(sessionRef).then(() => {
      pc.current?.close();
      pc.current = null;
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
            isActive && connectionStatus === 'idle' && (
              <Button onClick={joinSession} className="bg-green-600 hover:bg-green-700 text-white shadow-lg">
                <Play className="mr-2 h-4 w-4" /> Join Live Stream
              </Button>
            )
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-4">
          <div className="relative aspect-video bg-neutral-950 rounded-2xl overflow-hidden border-4 border-muted shadow-2xl">
            {/* INSTRUCTOR VIEW */}
            {isInstructor && (
              <video 
                ref={localVideoRef} 
                className={cn("w-full h-full object-cover mirror", !isVideoEnabled && "hidden")} 
                autoPlay 
                muted 
                playsInline 
              />
            )}

            {/* STUDENT VIEW */}
            {!isInstructor && (
              <>
                <video 
                  ref={remoteVideoRef} 
                  className={cn("w-full h-full object-cover", (connectionStatus !== 'connected' || !isActive) && "hidden")} 
                  autoPlay 
                  playsInline 
                />
                
                {isActive && connectionStatus === 'idle' && (
                   <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm text-white p-6 text-center">
                    <Video className="h-16 w-16 mb-4 text-primary opacity-50" />
                    <h3 className="text-xl font-bold">The class is live!</h3>
                    <p className="text-muted-foreground mb-6 max-w-xs">Click the button above to start receiving the video feed.</p>
                   </div>
                )}

                {isActive && connectionStatus === 'connecting' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-white">
                    <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                    <p className="font-semibold">Establishing P2P Connection...</p>
                    <p className="text-xs text-muted-foreground mt-2">Checking signal via Firestore</p>
                  </div>
                )}
              </>
            )}

            {/* Offline/Empty State */}
            {!isActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-6 text-center bg-neutral-900/50">
                <VideoOff className="h-20 w-20 text-muted-foreground/30 mb-4" />
                <h3 className="text-2xl font-bold text-muted-foreground/50">Classroom Offline</h3>
              </div>
            )}

            {/* Controls Layer */}
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
              <AlertTitle>Camera Blocked</AlertTitle>
              <AlertDescription>We need camera access to broadcast your class. Please check your browser settings.</AlertDescription>
            </Alert>
          )}

          {connectionStatus === 'failed' && (
            <Alert variant="destructive">
              <AlertTitle>Connection Failed</AlertTitle>
              <AlertDescription>Could not establish a direct peer-to-peer connection. This can happen on some corporate networks or if signaling is interrupted.</AlertDescription>
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
                <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Status</p>
                <p className="font-bold text-sm capitalize">{connectionStatus === 'connected' ? 'Streaming Active' : connectionStatus}</p>
              </div>
              <div className="p-4 rounded-xl bg-background border shadow-sm">
                <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Technology</p>
                <div className="flex items-center gap-2">
                   <div className="h-2 w-2 rounded-full bg-blue-500" />
                   <p className="font-bold text-sm">WebRTC + STUN</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-primary/5 border-primary/20 border-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-primary font-headline">
                <Sparkles className="h-4 w-4" />
                Troubleshooting
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground leading-relaxed">
              If the screen remains black, ensure both tabs are active. Some browsers throttle background tabs, which can interrupt the WebRTC handshake.
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
