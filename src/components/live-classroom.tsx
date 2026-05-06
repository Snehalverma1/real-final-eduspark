'use client';

import { useState, useEffect, useRef, useLayoutEffect } from 'react';
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

  // Initialize instructor media immediately
  useEffect(() => {
    if (!isInstructor) {
      setIsInitialLoading(false);
      return;
    }

    const initMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
        setHasCameraPermission(true);
      } catch (err) {
        console.error('Media init error:', err);
        setHasCameraPermission(false);
      } finally {
        setIsInitialLoading(false);
      }
    };

    initMedia();

    return () => {
      if (pc.current) pc.current.close();
      localStream?.getTracks().forEach(t => t.stop());
    };
  }, [isInstructor]);

  // Use useLayoutEffect for immediate video binding to avoid black screen race conditions
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

    // Listen for remote answer
    onSnapshot(sessionRef, async (snapshot) => {
      const data = snapshot.data();
      if (!peer.currentRemoteDescription && data?.answer) {
        const answerDescription = new RTCSessionDescription(data.answer);
        await peer.setRemoteDescription(answerDescription);

        // ONLY listen for callee candidates AFTER remote description is set
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

    toast({ title: 'Class Started', description: 'Students can now join.' });
  };

  const joinClass = async () => {
    if (!sessionRef || !sessionData?.offer || isInstructor) return;

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

    // Listen for caller candidates AFTER setting remote description
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant={isActive ? "default" : "secondary"} className={cn(isActive && "bg-red-500 animate-pulse text-white")}>
            {isActive ? "LIVE" : "OFFLINE"}
          </Badge>
          <h2 className="text-xl font-bold font-headline">
            {isActive ? `Live with ${sessionData.instructorName}` : "Classroom Offline"}
          </h2>
        </div>
        <div>
          {isInstructor ? (
            isActive ? (
              <Button variant="destructive" size="sm" onClick={endBroadcast}>
                <LogOut className="mr-2 h-4 w-4" /> End Class
              </Button>
            ) : (
              <Button onClick={startBroadcast} disabled={!hasCameraPermission || isInitialLoading} className="bg-red-600 hover:bg-red-700 text-white">
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
        <div className="relative aspect-video bg-neutral-900 rounded-xl overflow-hidden border shadow-2xl flex items-center justify-center">
          
          {/* Instructor Local View */}
          <video 
            ref={localVideoRef} 
            className={cn("w-full h-full object-cover", !isInstructor && "hidden")} 
            autoPlay 
            muted 
            playsInline 
          />
          
          {/* Remote View (Student seeing teacher) */}
          <video 
            ref={remoteVideoRef} 
            className={cn("w-full h-full object-cover", (isInstructor || !remoteStream) && "hidden")} 
            autoPlay 
            muted={true} // Mandatory for autoplay
            playsInline 
          />

          {!isActive && !isInstructor && !isSessionLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-black/80">
              <VideoOff className="h-12 w-12 mb-4 opacity-50" />
              <p className="font-bold">Classroom is currently closed.</p>
              <p className="text-sm opacity-70">Please wait for the instructor to go live.</p>
            </div>
          )}

          {isActive && !isInstructor && !remoteStream && connectionStatus !== 'idle' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-black/40">
              <Loader2 className="h-10 w-10 animate-spin mb-2" />
              <p className="text-sm">Establishing secure connection...</p>
            </div>
          )}

          {/* Unmute Helper for students */}
          {!isInstructor && remoteStream && (
             <Button 
               size="sm" 
               variant="secondary" 
               className="absolute top-4 right-4 bg-black/50 text-white hover:bg-black/70"
               onClick={() => { if (remoteVideoRef.current) remoteVideoRef.current.muted = false; }}
             >
               <Mic className="h-4 w-4 mr-2" /> Unmute Audio
             </Button>
          )}
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Class Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase">Status</p>
              <p className={cn("text-sm font-semibold capitalize", connectionStatus === 'connected' ? "text-green-500" : "text-foreground")}>
                {connectionStatus === 'idle' ? (isActive ? "Waiting to Join" : "Offline") : connectionStatus}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase">Role</p>
              <p className="text-sm font-semibold">{isInstructor ? 'Instructor' : 'Student'}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
