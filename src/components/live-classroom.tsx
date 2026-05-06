'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, deleteDoc, serverTimestamp, collection, addDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Video, VideoOff, Mic, MicOff, LogOut, Users, Play, AlertCircle } from 'lucide-react';
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
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'failed' | 'disconnected'>('idle');
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const sessionId = 'active_session';
  const sessionRef = useMemoFirebase(() => {
    if (!firestore || !courseId) return null;
    return doc(firestore, 'courses', courseId, 'liveSessions', sessionId);
  }, [firestore, courseId]);

  const { data: sessionData, isLoading: isSessionLoading } = useDoc(sessionRef);

  // Initialize local media for instructor
  useEffect(() => {
    if (!isInstructor) {
      setIsInitialLoading(false);
      return;
    }

    const getMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
        setHasCameraPermission(true);
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Camera Access Denied',
          description: 'Please enable camera permissions to start teaching.',
        });
      } finally {
        setIsInitialLoading(false);
      }
    };

    getMedia();

    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (pc.current) {
        pc.current.close();
      }
    };
  }, [isInstructor]);

  // Bind local stream to video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Bind remote stream to video element
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const setupPeerConnection = () => {
    if (pc.current) pc.current.close();
    
    const peer = new RTCPeerConnection(servers);
    
    peer.onconnectionstatechange = () => {
      setConnectionStatus(peer.connectionState as any);
      console.log('Connection state change:', peer.connectionState);
    };

    peer.ontrack = (event) => {
      console.log('Received remote track:', event.streams[0]);
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    pc.current = peer;
    return peer;
  };

  const startSession = async () => {
    if (!sessionRef || !localStream || !user) return;

    const peer = setupPeerConnection();
    localStream.getTracks().forEach(track => peer.addTrack(track, localStream));

    const callerCandidates = collection(sessionRef, 'callerCandidates');
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('New ICE candidate (caller):', event.candidate);
        addDoc(callerCandidates, event.candidate.toJSON());
      }
    };

    const offerDescription = await peer.createOffer();
    await peer.setLocalDescription(offerDescription);

    const sessionPayload = {
      status: 'active',
      instructorId: user.uid,
      instructorName: user.displayName || 'Instructor',
      offer: { sdp: offerDescription.sdp, type: offerDescription.type },
      createdAt: serverTimestamp(),
    };

    await setDoc(sessionRef, sessionPayload);

    // Watch for student's answer
    const unsubscribe = onSnapshot(sessionRef, async (snapshot) => {
      const data = snapshot.data();
      if (data?.answer && !peer.currentRemoteDescription) {
        console.log('Received student answer, setting remote description...');
        const answer = new RTCSessionDescription(data.answer);
        await peer.setRemoteDescription(answer);

        // NOW it is safe to start listening for callee candidates
        const calleeCandidates = collection(sessionRef, 'calleeCandidates');
        onSnapshot(calleeCandidates, (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              console.log('Adding ICE candidate (callee):', change.doc.data());
              const candidate = new RTCIceCandidate(change.doc.data());
              peer.addIceCandidate(candidate).catch(e => console.error("Error adding candidate", e));
            }
          });
        });
      }
    });

    toast({ title: 'Class Started', description: 'Students can now join your room.' });
  };

  const joinSession = async () => {
    if (!sessionRef || !sessionData?.offer || isInstructor) return;

    console.log('Joining session, setting up peer connection...');
    const peer = setupPeerConnection();
    const calleeCandidates = collection(sessionRef, 'calleeCandidates');
    
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('New ICE candidate (callee):', event.candidate);
        addDoc(calleeCandidates, event.candidate.toJSON());
      }
    };

    const offer = new RTCSessionDescription(sessionData.offer);
    await peer.setRemoteDescription(offer);

    const answerDescription = await peer.createAnswer();
    await peer.setLocalDescription(answerDescription);

    await updateDoc(sessionRef, {
      answer: { sdp: answerDescription.sdp, type: answerDescription.type }
    });

    // NOW it is safe to start listening for caller candidates
    const callerCandidates = collection(sessionRef, 'callerCandidates');
    onSnapshot(callerCandidates, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          console.log('Adding ICE candidate (caller):', change.doc.data());
          const candidate = new RTCIceCandidate(change.doc.data());
          peer.addIceCandidate(candidate).catch(e => console.error("Error adding candidate", e));
        }
      });
    });
  };

  const endSession = async () => {
    if (sessionRef) {
      if (isInstructor) {
        await deleteDoc(sessionRef);
      }
      pc.current?.close();
      setConnectionStatus('idle');
      setRemoteStream(null);
      window.location.reload();
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(t => t.enabled = !isAudioEnabled);
      setIsAudioEnabled(!isAudioEnabled);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(t => t.enabled = !isVideoEnabled);
      setIsVideoEnabled(!isVideoEnabled);
    }
  };

  const isActive = sessionData?.status === 'active';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Badge variant={isActive ? "default" : "secondary"} className={cn(isActive && "bg-red-500 animate-pulse text-white")}>
            {isActive ? "LIVE" : "OFFLINE"}
          </Badge>
          <h2 className="text-xl font-bold font-headline">
            {isActive ? `Live with ${sessionData.instructorName}` : "Classroom Offline"}
          </h2>
        </div>
        <div className="flex gap-2">
          {isInstructor ? (
            isActive ? (
              <Button variant="destructive" size="sm" onClick={endSession}>
                <LogOut className="mr-2 h-4 w-4" /> End Class
              </Button>
            ) : (
              <Button onClick={startSession} disabled={!hasCameraPermission || isInitialLoading} className="bg-red-600 hover:bg-red-700 text-white">
                <Video className="mr-2 h-4 w-4" /> Start Broadcast
              </Button>
            )
          ) : (
            isActive && connectionStatus === 'idle' && (
              <Button onClick={joinSession} className="bg-green-600 hover:bg-green-700 text-white">
                <Play className="mr-2 h-4 w-4" /> Join Class
              </Button>
            )
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-6">
        <div className="relative aspect-video bg-neutral-900 rounded-xl overflow-hidden border-2 shadow-xl flex flex-col items-center justify-center">
          
          {(isInitialLoading || isSessionLoading) && (
             <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="mt-2 text-sm text-muted-foreground">Initializing Classroom...</p>
             </div>
          )}

          {/* Instructor Video */}
          <video 
            ref={localVideoRef} 
            className={cn("w-full h-full object-cover", (!isInstructor || !isVideoEnabled || !hasCameraPermission) && "hidden")} 
            autoPlay 
            muted 
            playsInline 
          />
          
          {/* Student/Remote Video */}
          <video 
            ref={remoteVideoRef} 
            className={cn("w-full h-full object-cover", (isInstructor || !remoteStream) && "hidden")} 
            autoPlay 
            muted={true} /* Muted by default to allow browser autoplay */
            playsInline 
          />

          {/* Instructor Controls Overlay */}
          {isInstructor && isActive && hasCameraPermission && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3 bg-black/40 backdrop-blur-md p-2 rounded-full border border-white/20">
              <Button variant="ghost" size="icon" className={cn("rounded-full hover:bg-white/20 text-white", !isAudioEnabled && "text-red-500")} onClick={toggleAudio}>
                {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              </Button>
              <Button variant="ghost" size="icon" className={cn("rounded-full hover:bg-white/20 text-white", !isVideoEnabled && "text-red-500")} onClick={toggleVideo}>
                {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              </Button>
            </div>
          )}

          {/* Student "Unmute" Helper */}
          {!isInstructor && remoteStream && (
             <Button 
               size="sm" 
               variant="secondary" 
               className="absolute top-4 right-4 bg-black/50 text-white hover:bg-black/70 border-white/20"
               onClick={() => {
                 if (remoteVideoRef.current) {
                   remoteVideoRef.current.muted = false;
                 }
               }}
             >
               <Mic className="h-4 w-4 mr-2" /> Unmute Teacher
             </Button>
          )}

          {/* Status Overlays */}
          {isInstructor && hasCameraPermission === false && !isInitialLoading && (
             <Alert variant="destructive" className="max-w-md mx-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Camera Access Required</AlertTitle>
                <AlertDescription>
                  Please allow camera access in your browser settings to start teaching.
                </AlertDescription>
             </Alert>
          )}

          {!isActive && !isInstructor && !isSessionLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-black/60">
              <VideoOff className="h-12 w-12 mb-3 opacity-50" />
              <p className="font-medium px-4 text-center">The classroom is currently closed.</p>
              <p className="text-sm opacity-70">Wait for the teacher to go live.</p>
            </div>
          )}
        </div>

        <Card className="bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Connection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-xs uppercase font-bold text-muted-foreground">Status</div>
            <div className={cn("text-sm font-semibold capitalize", connectionStatus === 'connected' ? 'text-green-500' : 'text-foreground')}>
               {connectionStatus === 'idle' ? (isActive ? 'Available' : 'Offline') : connectionStatus}
            </div>
            <div className="text-xs uppercase font-bold text-muted-foreground mt-4">Your Role</div>
            <div className="text-sm font-semibold">{isInstructor ? 'Instructor' : 'Student'}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
