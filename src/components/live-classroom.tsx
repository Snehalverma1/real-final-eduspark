'use client';

import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, deleteDoc, serverTimestamp, collection, addDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Video, VideoOff, Mic, MicOff, LogOut, Users, Play, AlertCircle, Camera } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'failed' | 'disconnected'>('idle');
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const sessionId = 'active_session';
  const sessionRef = useMemoFirebase(() => {
    if (!firestore || !courseId) return null;
    return doc(firestore, 'courses', courseId, 'liveSessions', sessionId);
  }, [firestore, courseId]);

  const { data: sessionData, isLoading: isSessionLoading } = useDoc(sessionRef);

  // Initialize Media for Instructor
  const initInstructorMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      setHasCameraPermission(true);
      toast({ title: "Camera Ready", description: "You can now start the broadcast." });
    } catch (err) {
      console.error('Media access error:', err);
      setHasCameraPermission(false);
      toast({ variant: "destructive", title: "Camera Error", description: "Please allow camera access in your browser." });
    } finally {
      setIsInitialLoading(false);
    }
  };

  useEffect(() => {
    if (!isInstructor) {
      setIsInitialLoading(false);
    }
    return () => {
      if (pc.current) pc.current.close();
      localStream?.getTracks().forEach(t => t.stop());
    };
  }, [isInstructor]);

  // Bind streams to video elements
  useLayoutEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useLayoutEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const createPeerConnection = () => {
    if (pc.current) pc.current.close();
    const peer = new RTCPeerConnection(servers);

    peer.onconnectionstatechange = () => {
      setConnectionStatus(peer.connectionState as any);
    };

    peer.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    pc.current = peer;
    return peer;
  };

  const startBroadcast = async () => {
    if (!sessionRef || !localStream || !user) return;

    const peer = createPeerConnection();
    localStream.getTracks().forEach(track => peer.addTrack(track, localStream));

    const callerCandidates = collection(sessionRef, 'callerCandidates');
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        addDoc(callerCandidates, event.candidate.toJSON());
      }
    };

    const offerDescription = await peer.createOffer();
    await peer.setLocalDescription(offerDescription);

    const offer = {
      sdp: offerDescription.sdp,
      type: offerDescription.type,
    };

    await setDoc(sessionRef, {
      offer,
      status: 'active',
      instructorId: user.uid,
      instructorName: user.displayName || 'Instructor',
      createdAt: serverTimestamp(),
    });

    // Listen for Answer
    onSnapshot(sessionRef, async (snapshot) => {
      const data = snapshot.data();
      if (!peer.currentRemoteDescription && data?.answer) {
        const answerDescription = new RTCSessionDescription(data.answer);
        await peer.setRemoteDescription(answerDescription);

        // Process callee candidates only after remote description is set
        const calleeCandidates = collection(sessionRef, 'calleeCandidates');
        onSnapshot(calleeCandidates, (snap) => {
          snap.docChanges().forEach((change) => {
            if (change.type === 'added') {
              peer.addIceCandidate(new RTCIceCandidate(change.doc.data()));
            }
          });
        });
      }
    });

    toast({ title: 'Class Started', description: 'Students can now join the session.' });
  };

  const joinClass = async () => {
    if (!sessionRef || !sessionData?.offer || isInstructor) return;

    setConnectionStatus('connecting');
    const peer = createPeerConnection();
    const calleeCandidates = collection(sessionRef, 'calleeCandidates');

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        addDoc(calleeCandidates, event.candidate.toJSON());
      }
    };

    const offerDescription = new RTCSessionDescription(sessionData.offer);
    await peer.setRemoteDescription(offerDescription);

    const answerDescription = await peer.createAnswer();
    await peer.setLocalDescription(answerDescription);

    const answer = {
      type: answerDescription.type,
      sdp: answerDescription.sdp,
    };

    await updateDoc(sessionRef, { answer });

    // Process caller candidates only after remote description is set
    const callerCandidates = collection(sessionRef, 'callerCandidates');
    onSnapshot(callerCandidates, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          peer.addIceCandidate(new RTCIceCandidate(change.doc.data()));
        }
      });
    });
  };

  const endBroadcast = async () => {
    if (sessionRef && isInstructor) {
      await deleteDoc(sessionRef);
      window.location.reload();
    }
  };

  const isActive = sessionData?.status === 'active';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-card p-4 rounded-xl border">
        <div className="flex items-center gap-4">
          <Badge variant={isActive ? "default" : "secondary"} className={cn("px-3 py-1", isActive && "bg-red-500 animate-pulse text-white")}>
            {isActive ? "LIVE" : "OFFLINE"}
          </Badge>
          <div>
            <h2 className="text-xl font-bold font-headline">
              {isActive ? `Live with ${sessionData.instructorName}` : "Classroom Offline"}
            </h2>
            <p className="text-xs text-muted-foreground">
              Status: <span className="capitalize font-semibold">{connectionStatus}</span>
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          {isInstructor ? (
            !localStream ? (
              <Button onClick={initInstructorMedia} className="bg-primary hover:bg-primary/90">
                <Camera className="mr-2 h-4 w-4" /> Enable Camera
              </Button>
            ) : isActive ? (
              <Button variant="destructive" onClick={endBroadcast}>
                <LogOut className="mr-2 h-4 w-4" /> End Class
              </Button>
            ) : (
              <Button onClick={startBroadcast} className="bg-red-600 hover:bg-red-700 text-white">
                <Video className="mr-2 h-4 w-4" /> Start Broadcast
              </Button>
            )
          ) : (
            isActive && connectionStatus === 'idle' && (
              <Button onClick={joinClass} className="bg-green-600 hover:bg-green-700 text-white">
                <Play className="mr-2 h-4 w-4" /> Join Class
              </Button>
            )
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-6">
        <div className="relative aspect-video bg-black rounded-xl overflow-hidden border shadow-2xl flex items-center justify-center">
          
          {/* Instructor View */}
          {isInstructor && (
            <div className="w-full h-full relative">
              <video 
                ref={localVideoRef} 
                className="w-full h-full object-cover" 
                autoPlay 
                muted 
                playsInline 
              />
              {!localStream && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-neutral-900">
                  <Camera className="h-12 w-12 mb-4 opacity-50" />
                  <p className="font-bold">Camera is not enabled</p>
                  <Button onClick={initInstructorMedia} variant="secondary" className="mt-4">
                    Enable Camera
                  </Button>
                </div>
              )}
            </div>
          )}
          
          {/* Student View */}
          {!isInstructor && (
            <div className="w-full h-full relative">
              <video 
                ref={remoteVideoRef} 
                className={cn("w-full h-full object-cover", !remoteStream && "hidden")} 
                autoPlay 
                muted={false} 
                playsInline 
              />
              
              {!isActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-neutral-950">
                  <VideoOff className="h-12 w-12 mb-4 opacity-30" />
                  <p className="font-bold">The teacher is not online</p>
                  <p className="text-sm opacity-50">Please wait for the class to start.</p>
                </div>
              )}

              {isActive && !remoteStream && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-neutral-900">
                  {connectionStatus === 'idle' ? (
                    <>
                      <Play className="h-12 w-12 mb-4 text-primary" />
                      <p className="font-bold">The class is live!</p>
                      <Button onClick={joinClass} className="mt-4">Click to Join</Button>
                    </>
                  ) : (
                    <>
                      <Loader2 className="h-10 w-10 animate-spin mb-4 text-primary" />
                      <p className="text-sm">Connecting to teacher's stream...</p>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Class Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Your Role</p>
                <p className="text-sm font-semibold">{isInstructor ? 'Instructor' : 'Student'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Connection Status</p>
                <Badge variant="outline" className={cn("mt-1 capitalize", connectionStatus === 'connected' ? "text-green-500 border-green-500/30" : "")}>
                  {connectionStatus}
                </Badge>
              </div>
            </CardContent>
          </Card>
          
          <Alert className="bg-primary/5 border-primary/20">
            <AlertCircle className="h-4 w-4 text-primary" />
            <AlertTitle className="text-xs font-bold uppercase tracking-wide">Live Tip</AlertTitle>
            <AlertDescription className="text-xs">
              If the video is black, try refreshing or clicking the "Enable Camera" / "Join Class" buttons again.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  );
}
