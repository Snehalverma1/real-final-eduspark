'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, deleteDoc, serverTimestamp, collection, addDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Video, VideoOff, Mic, MicOff, LogOut, Users, Play, Volume2, VolumeX, RefreshCw } from 'lucide-react';
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
  const candidateQueue = useRef<RTCIceCandidateInit[]>([]);
  const isBroadcasting = useRef(false);
  
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  
  const [isRemoteMuted, setIsRemoteMuted] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'failed' | 'offline' | 'closed'>('idle');

  const sessionId = 'active_session';
  const sessionRef = useMemoFirebase(() => {
    if (!firestore || !courseId) return null;
    return doc(firestore, 'courses', courseId, 'liveSessions', sessionId);
  }, [firestore, courseId]);

  const { data: sessionData, isLoading: isSessionLoading } = useDoc(sessionRef);

  // Initialize media for instructor
  useEffect(() => {
    if (!isInstructor) {
      setIsInitialLoading(false);
      return;
    }

    const getCameraPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: true 
        });
        setLocalStream(stream);
        setHasCameraPermission(true);
      } catch (error) {
        console.error('Error accessing media:', error);
        setHasCameraPermission(false);
      } finally {
        setIsInitialLoading(false);
      }
    };

    getCameraPermission();

    return () => {
      localStream?.getTracks().forEach(track => track.stop());
      pc.current?.close();
    };
  }, [isInstructor]);

  // Sync local media to video ref
  useEffect(() => {
    if (isInstructor && localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, isInstructor]);

  const processQueuedCandidates = async () => {
    if (!pc.current || !pc.current.remoteDescription) return;
    while (candidateQueue.current.length > 0) {
      const candidate = candidateQueue.current.shift();
      if (candidate) {
        try {
          await pc.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error("Error adding queued candidate", e);
        }
      }
    }
  };

  const startSession = async () => {
    if (!sessionRef || !localStream || !firestore || !user || isBroadcasting.current) return;

    isBroadcasting.current = true;
    setConnectionStatus('connecting');

    try {
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
        setConnectionStatus(pc.current?.connectionState as any);
      };

      const offerDescription = await pc.current.createOffer();
      await pc.current.setLocalDescription(offerDescription);

      const sessionPayload = {
        status: 'active',
        instructorId: user.uid,
        instructorName: user.displayName || 'Instructor',
        offer: { sdp: offerDescription.sdp, type: offerDescription.type },
        answer: null,
        createdAt: serverTimestamp(),
      };

      await setDoc(sessionRef, sessionPayload);

      // Listen for student's answer
      const unsubscribeAnswer = onSnapshot(sessionRef, (snapshot) => {
        const data = snapshot.data();
        if (pc.current && data?.answer && pc.current.signalingState === 'have-local-offer') {
          pc.current.setRemoteDescription(new RTCSessionDescription(data.answer)).then(processQueuedCandidates);
        }
      });

      // Listen for student's candidates
      const unsubscribeCandidates = onSnapshot(calleeCandidatesCollection, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data() as RTCIceCandidateInit;
            if (pc.current?.remoteDescription) {
              pc.current.addIceCandidate(new RTCIceCandidate(data)).catch(e => console.error("ICE error", e));
            } else {
              candidateQueue.current.push(data);
            }
          }
        });
      });

      toast({ title: "Class Started", description: "You are now live." });
    } catch (err) {
      console.error("Start Session Error:", err);
      setConnectionStatus('failed');
      isBroadcasting.current = false;
    }
  };

  const joinSession = async () => {
    if (!sessionRef || !firestore || isInstructor || isJoining || !sessionData?.offer) return;

    setIsJoining(true);
    setConnectionStatus('connecting');
    candidateQueue.current = [];
    
    try {
      pc.current = new RTCPeerConnection(servers);

      pc.current.ontrack = (event) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      pc.current.onconnectionstatechange = () => {
        setConnectionStatus(pc.current?.connectionState as any);
      };

      const callerCandidatesCollection = collection(sessionRef, 'callerCandidates');
      const calleeCandidatesCollection = collection(sessionRef, 'calleeCandidates');

      pc.current.onicecandidate = (event) => {
        if (event.candidate) {
          addDoc(calleeCandidatesCollection, event.candidate.toJSON());
        }
      };

      const offerDescription = new RTCSessionDescription(sessionData.offer);
      await pc.current.setRemoteDescription(offerDescription);
      await processQueuedCandidates();

      const answerDescription = await pc.current.createAnswer();
      await pc.current.setLocalDescription(answerDescription);

      const answer = {
        type: answerDescription.type,
        sdp: answerDescription.sdp,
      };

      await updateDoc(sessionRef, { answer });

      // Listen for caller candidates
      onSnapshot(callerCandidatesCollection, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const candidateData = change.doc.data() as RTCIceCandidateInit;
            if (pc.current?.remoteDescription) {
              pc.current.addIceCandidate(new RTCIceCandidate(candidateData)).catch(e => console.error("ICE error", e));
            } else {
              candidateQueue.current.push(candidateData);
            }
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
      isBroadcasting.current = false;
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
              <Button variant="destructive" size="sm" onClick={endSession}>
                <LogOut className="mr-2 h-4 w-4" /> End Session
              </Button>
            ) : (
              <Button onClick={startSession} className="bg-red-600 hover:bg-red-700 text-white shadow-lg">
                <Video className="mr-2 h-4 w-4" /> Start Broadcast
              </Button>
            )
          ) : (
            isActive && connectionStatus === 'idle' && (
              <Button onClick={joinSession} disabled={isJoining} className="bg-green-600 hover:bg-green-700 text-white shadow-lg">
                {isJoining ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                Join Lesson
              </Button>
            )
          )}
          {connectionStatus === 'failed' && (
            <Button variant="outline" onClick={() => window.location.reload()}>
              <RefreshCw className="mr-2 h-4 w-4" /> Reconnect
            </Button>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-6">
        <div className="space-y-4">
          <div className="relative aspect-video bg-neutral-950 rounded-2xl overflow-hidden border-4 border-muted shadow-2xl group/classroom">
            
            {/* VIDEO FEED */}
            <div className="w-full h-full">
              {isInstructor ? (
                <video 
                  ref={localVideoRef} 
                  className={cn("w-full h-full object-cover", !isVideoEnabled && "hidden")} 
                  autoPlay 
                  muted 
                  playsInline 
                />
              ) : (
                <video 
                  ref={remoteVideoRef} 
                  className="w-full h-full object-cover" 
                  autoPlay 
                  playsInline 
                  muted={isRemoteMuted}
                />
              )}

              {/* OVERLAYS */}
              {!isActive && !isInstructor && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-white p-6 text-center">
                  <VideoOff className="h-16 w-16 mb-4 text-muted-foreground" />
                  <h3 className="text-xl font-bold font-headline">Classroom is currently offline</h3>
                  <p className="text-muted-foreground mt-2 max-w-xs">The instructor has not started the live session yet.</p>
                </div>
              )}

              {isInstructor && !isVideoEnabled && (
                 <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900 text-white">
                    <VideoOff className="h-16 w-16 text-muted-foreground" />
                    <p className="mt-4 text-muted-foreground">Camera is turned off</p>
                 </div>
              )}

              {isActive && !isInstructor && connectionStatus === 'idle' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white">
                   <Play className="h-16 w-16 text-primary mb-4" />
                   <p className="text-lg font-bold">Class is live!</p>
                   <p className="text-sm text-muted-foreground">Click Join to see the instructor.</p>
                </div>
              )}

              {(connectionStatus === 'connecting' || connectionStatus === 'checking') && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-white z-50">
                  <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                  <p className="font-semibold text-lg">Establishing connection...</p>
                </div>
              )}
            </div>

            {/* CONTROLS OVERLAY (Instructor Only) */}
            {isInstructor && isActive && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/40 backdrop-blur-xl p-4 rounded-full border border-white/20 shadow-2xl transition-opacity opacity-0 group-hover/classroom:opacity-100">
                <Button variant="ghost" size="icon" className={cn("rounded-full h-12 w-12 bg-white/10 hover:bg-white/20 text-white", !isAudioEnabled && "text-red-500 bg-red-500/20")} onClick={toggleAudio}>
                  {isAudioEnabled ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
                </Button>
                <Button variant="ghost" size="icon" className={cn("rounded-full h-12 w-12 bg-white/10 hover:bg-white/20 text-white", !isVideoEnabled && "text-red-500 bg-red-500/20")} onClick={toggleVideo}>
                  {isVideoEnabled ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
                </Button>
              </div>
            )}

            {/* REMOTE VOLUME CONTROL (Student Only) */}
            {!isInstructor && isActive && connectionStatus === 'connected' && (
               <div className="absolute bottom-6 right-6 flex items-center gap-2">
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
          </div>

          {isInstructor && hasCameraPermission === false && (
            <Alert variant="destructive">
              <AlertTitle>Camera Access Required</AlertTitle>
              <AlertDescription>Please allow camera and microphone access in your browser settings to use the live classroom.</AlertDescription>
            </Alert>
          )}
        </div>

        <Card className="border-none shadow-lg bg-card/50 self-start">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2 font-headline">
              <Users className="h-5 w-5 text-primary" />
              Class Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 rounded-xl bg-background border shadow-sm">
              <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1 text-primary">Connection</p>
              <p className="font-bold text-sm capitalize">{connectionStatus === 'connected' ? 'Stable' : connectionStatus}</p>
            </div>
            <div className="p-3 rounded-xl bg-background border shadow-sm">
              <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1 text-primary">Your Role</p>
              <p className="font-bold text-sm">{isInstructor ? 'Instructor' : 'Enrolled Student'}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
