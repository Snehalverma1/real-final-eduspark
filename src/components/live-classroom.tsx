'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, deleteDoc, serverTimestamp, collection, addDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Video, VideoOff, Mic, MicOff, LogOut, Users, Play } from 'lucide-react';
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
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
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

  // Initialize media for instructor
  useEffect(() => {
    if (!isInstructor) {
      setIsInitialLoading(false);
      return;
    }

    const initMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Media Access Error:', error);
        toast({ variant: 'destructive', title: 'Camera Error', description: 'Please allow camera access.' });
      } finally {
        setIsInitialLoading(false);
      }
    };

    initMedia();

    return () => {
      localStream?.getTracks().forEach(track => track.stop());
      pc.current?.close();
    };
  }, [isInstructor]);

  const setupPeerConnection = () => {
    const peer = new RTCPeerConnection(servers);
    
    peer.onconnectionstatechange = () => {
      setConnectionStatus(peer.connectionState as any);
    };

    peer.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
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
      if (event.candidate) addDoc(callerCandidates, event.candidate.toJSON());
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

    onSnapshot(sessionRef, (snapshot) => {
      const data = snapshot.data();
      if (data?.answer && !peer.currentRemoteDescription) {
        const answer = new RTCSessionDescription(data.answer);
        peer.setRemoteDescription(answer);
      }
    });

    onSnapshot(collection(sessionRef, 'calleeCandidates'), (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          peer.addIceCandidate(new RTCIceCandidate(change.doc.data()));
        }
      });
    });

    toast({ title: 'Class Started', description: 'You are now live.' });
  };

  const joinSession = async () => {
    if (!sessionRef || !sessionData?.offer || isInstructor) return;

    const peer = setupPeerConnection();
    const calleeCandidates = collection(sessionRef, 'calleeCandidates');
    
    peer.onicecandidate = (event) => {
      if (event.candidate) addDoc(calleeCandidates, event.candidate.toJSON());
    };

    const offer = new RTCSessionDescription(sessionData.offer);
    await peer.setRemoteDescription(offer);

    const answerDescription = await peer.createAnswer();
    await peer.setLocalDescription(answerDescription);

    await updateDoc(sessionRef, {
      answer: { sdp: answerDescription.sdp, type: answerDescription.type }
    });

    onSnapshot(collection(sessionRef, 'callerCandidates'), (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          peer.addIceCandidate(new RTCIceCandidate(change.doc.data()));
        }
      });
    });
  };

  const endSession = async () => {
    if (sessionRef) {
      await deleteDoc(sessionRef);
      pc.current?.close();
      setConnectionStatus('idle');
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

  if (isInitialLoading || isSessionLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground">Initializing classroom...</p>
      </div>
    );
  }

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
                <LogOut className="mr-2 h-4 w-4" /> End
              </Button>
            ) : (
              <Button onClick={startSession} className="bg-red-600 hover:bg-red-700 text-white">
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
        <div className="relative aspect-video bg-neutral-900 rounded-xl overflow-hidden border-2 shadow-xl">
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
            />
          )}

          {!isActive && !isInstructor && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-black/60">
              <VideoOff className="h-12 w-12 mb-3 opacity-50" />
              <p className="font-medium">The instructor hasn't started the session yet.</p>
            </div>
          )}

          {isInstructor && !isVideoEnabled && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-800 text-white">
              <VideoOff className="h-12 w-12 opacity-50" />
              <p className="mt-2">Camera Off</p>
            </div>
          )}

          {/* Instructor Controls */}
          {isInstructor && isActive && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3 bg-black/20 backdrop-blur-md p-2 rounded-full border border-white/20">
              <Button variant="ghost" size="icon" className={cn("rounded-full", !isAudioEnabled && "text-red-500")} onClick={toggleAudio}>
                {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              </Button>
              <Button variant="ghost" size="icon" className={cn("rounded-full", !isVideoEnabled && "text-red-500")} onClick={toggleVideo}>
                {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              </Button>
            </div>
          )}
        </div>

        <Card className="bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-xs uppercase font-bold text-muted-foreground">Connection</div>
            <div className="text-sm font-semibold capitalize">{connectionStatus}</div>
            <div className="text-xs uppercase font-bold text-muted-foreground mt-4">Role</div>
            <div className="text-sm font-semibold">{isInstructor ? 'Instructor' : 'Student'}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
