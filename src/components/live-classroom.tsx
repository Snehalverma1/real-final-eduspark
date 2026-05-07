
'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, deleteDoc, serverTimestamp, collection, addDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Video, VideoOff, LogOut, Users, Play, AlertCircle, Camera, Monitor, Mic } from 'lucide-react';
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
  
  // Dedicated refs for Instructor
  const instructorPrimaryRef = useRef<HTMLVideoElement>(null);
  const instructorPipRef = useRef<HTMLVideoElement>(null);
  
  // Dedicated refs for Student
  const studentPrimaryRef = useRef<HTMLVideoElement>(null);
  const studentPipRef = useRef<HTMLVideoElement>(null);
  
  const pc = useRef<RTCPeerConnection | null>(null);
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'failed' | 'disconnected'>('idle');
  const [isSignaling, setIsSignaling] = useState(false);
  const [isLive, setIsLive] = useState(false);

  const sessionId = 'active_session';
  const sessionRef = useMemoFirebase(() => {
    if (!firestore || !courseId) return null;
    return doc(firestore, 'courses', courseId, 'liveSessions', sessionId);
  }, [firestore, courseId]);

  const { data: sessionData } = useDoc(sessionRef);
  const candidateQueue = useRef<any[]>([]);

  // Instructor: Attach streams to video elements
  useEffect(() => {
    if (!isInstructor) return;

    if (screenStream) {
      if (instructorPrimaryRef.current) instructorPrimaryRef.current.srcObject = screenStream;
      if (instructorPipRef.current) instructorPipRef.current.srcObject = localStream;
    } else {
      if (instructorPrimaryRef.current) instructorPrimaryRef.current.srcObject = localStream;
    }
  }, [isInstructor, localStream, screenStream]);

  const initCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      toast({ title: "Camera Enabled", description: "You are ready to start." });
    } catch (err) {
      toast({ variant: "destructive", title: "Camera Error", description: "Could not access camera." });
    }
  };

  const initScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      setScreenStream(stream);
      
      if (pc.current) {
        stream.getTracks().forEach(track => pc.current?.addTrack(track, stream));
        const offer = await pc.current.createOffer();
        await pc.current.setLocalDescription(offer);
        if (sessionRef) {
          await updateDoc(sessionRef, { 
            offer: { sdp: offer.sdp, type: offer.type },
            updatedAt: serverTimestamp(),
            hasScreen: true
          });
        }
      }
      
      stream.getVideoTracks()[0].onended = () => {
        setScreenStream(null);
        if (sessionRef) updateDoc(sessionRef, { hasScreen: false });
      };
    } catch (err) {
      toast({ variant: "destructive", title: "Screen Error", description: "Could not share screen." });
    }
  };

  const startBroadcast = async () => {
    if (!sessionRef || !localStream || !user) return;
    setIsSignaling(true);

    const peer = new RTCPeerConnection(servers);
    pc.current = peer;

    localStream.getTracks().forEach(track => peer.addTrack(track, localStream));
    if (screenStream) {
      screenStream.getTracks().forEach(track => peer.addTrack(track, screenStream));
    }

    const callerCandidates = collection(sessionRef, 'callerCandidates');
    peer.onicecandidate = (event) => {
      if (event.candidate) addDoc(callerCandidates, event.candidate.toJSON());
    };

    peer.onconnectionstatechange = () => setConnectionStatus(peer.connectionState as any);

    const offerDescription = await peer.createOffer();
    await peer.setLocalDescription(offerDescription);

    await setDoc(sessionRef, {
      offer: { sdp: offerDescription.sdp, type: offerDescription.type },
      status: 'active',
      instructorId: user.uid,
      instructorName: user.displayName || 'Instructor',
      createdAt: serverTimestamp(),
      hasScreen: !!screenStream
    });

    onSnapshot(sessionRef, async (snapshot) => {
      const data = snapshot.data();
      if (!peer.currentRemoteDescription && data?.answer) {
        await peer.setRemoteDescription(new RTCSessionDescription(data.answer));
        while (candidateQueue.current.length > 0) {
          await peer.addIceCandidate(new RTCIceCandidate(candidateQueue.current.shift()));
        }
      }
    });

    const calleeCandidates = collection(sessionRef, 'calleeCandidates');
    onSnapshot(calleeCandidates, (snap) => {
      snap.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const candidate = change.doc.data();
          if (peer.remoteDescription) await peer.addIceCandidate(new RTCIceCandidate(candidate));
          else candidateQueue.current.push(candidate);
        }
      });
    });

    setIsSignaling(false);
    setIsLive(true);
  };

  const joinClass = async () => {
    if (!sessionRef || !sessionData?.offer || isInstructor) return;
    setIsSignaling(true);
    setConnectionStatus('connecting');

    const peer = new RTCPeerConnection(servers);
    pc.current = peer;

    peer.ontrack = (event) => {
      const stream = event.streams[0];
      if (event.track.kind === 'video') {
        // Instructor usually sends Camera first, then Screen if toggled
        // We use a simple ID mapping or sequential logic
        if (!studentPrimaryRef.current?.srcObject) {
            studentPrimaryRef.current!.srcObject = stream;
        } else if (studentPrimaryRef.current.srcObject !== stream && !studentPipRef.current?.srcObject) {
            studentPipRef.current!.srcObject = stream;
        }
      }
    };

    peer.onconnectionstatechange = () => setConnectionStatus(peer.connectionState as any);

    const calleeCandidates = collection(sessionRef, 'calleeCandidates');
    peer.onicecandidate = (event) => {
      if (event.candidate) addDoc(calleeCandidates, event.candidate.toJSON());
    };

    await peer.setRemoteDescription(new RTCSessionDescription(sessionData.offer));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);

    await updateDoc(sessionRef, { answer: { type: answer.type, sdp: answer.sdp } });

    const callerCandidates = collection(sessionRef, 'callerCandidates');
    onSnapshot(callerCandidates, (snap) => {
      snap.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const candidate = change.doc.data();
          if (peer.remoteDescription) await peer.addIceCandidate(new RTCIceCandidate(candidate));
          else candidateQueue.current.push(candidate);
        }
      });
    });

    setIsSignaling(false);
    setIsLive(true);
  };

  const endBroadcast = async () => {
    if (sessionRef && isInstructor) {
      await deleteDoc(sessionRef);
      window.location.reload();
    }
  };

  useEffect(() => {
    return () => {
      pc.current?.close();
      localStream?.getTracks().forEach(t => t.stop());
      screenStream?.getTracks().forEach(t => t.stop());
    };
  }, [localStream, screenStream]);

  const active = sessionData?.status === 'active';

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between bg-card p-6 rounded-xl border gap-4 shadow-sm">
        <div className="flex items-center gap-4">
          <Badge variant={active ? "default" : "secondary"} className={cn("px-4 py-1.5 text-sm font-bold", active && "bg-red-600 animate-pulse text-white")}>
            {active ? "LIVE" : "OFFLINE"}
          </Badge>
          <div>
            <h2 className="text-xl font-bold font-headline">
              {active ? `Instructor: ${sessionData.instructorName}` : "Classroom is currently offline"}
            </h2>
            <p className="text-xs text-muted-foreground mt-1 capitalize">Status: {connectionStatus}</p>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {isInstructor ? (
            <>
              {!localStream ? (
                <Button onClick={initCamera} variant="outline">
                  <Camera className="mr-2 h-4 w-4" /> Enable Camera
                </Button>
              ) : !active ? (
                <>
                  <Button onClick={initScreenShare} variant="outline" className={cn(screenStream && "bg-primary/10")}>
                    <Monitor className="mr-2 h-4 w-4" /> {screenStream ? "Screen Ready" : "Share Screen"}
                  </Button>
                  <Button onClick={startBroadcast} disabled={isSignaling} className="bg-red-600 hover:bg-red-700 text-white">
                    {isSignaling ? <Loader2 className="animate-spin" /> : <Video className="mr-2 h-4 w-4" />} Start Lesson
                  </Button>
                </>
              ) : (
                <>
                   <Button onClick={initScreenShare} variant="secondary">
                    <Monitor className="mr-2 h-4 w-4" /> {screenStream ? "Stop Screen" : "Share Screen"}
                  </Button>
                  <Button variant="destructive" onClick={endBroadcast}>
                    <LogOut className="mr-2 h-4 w-4" /> End Class
                  </Button>
                </>
              )}
            </>
          ) : (
            active && connectionStatus === 'idle' && (
              <Button onClick={joinClass} disabled={isSignaling} className="bg-green-600 hover:bg-green-700 text-white px-8 rounded-full shadow-lg">
                {isSignaling ? <Loader2 className="animate-spin" /> : <Play className="mr-2 h-5 w-5" />} Join Class
              </Button>
            )
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-6">
        <div className="relative group">
          <div className="relative aspect-video bg-neutral-900 rounded-2xl overflow-hidden border-4 border-muted shadow-2xl">
            {/* Primary View */}
            <video 
              ref={isInstructor ? instructorPrimaryRef : studentPrimaryRef} 
              className="w-full h-full object-contain" 
              autoPlay 
              muted 
              playsInline 
            />

            {/* Picture-in-Picture View (Camera) */}
            <div className={cn(
                "absolute bottom-4 right-4 w-48 aspect-video bg-black rounded-lg border-2 border-white/20 shadow-xl overflow-hidden transition-opacity",
                ((isInstructor && screenStream) || (!isInstructor && sessionData?.hasScreen)) ? "opacity-100" : "opacity-0 pointer-events-none"
            )}>
              <video 
                ref={isInstructor ? instructorPipRef : studentPipRef} 
                className="w-full h-full object-cover" 
                autoPlay 
                muted 
                playsInline 
              />
            </div>

            {!isInstructor && !active && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-neutral-950/90 backdrop-blur-sm">
                <VideoOff className="h-16 w-16 mb-4 text-neutral-600" />
                <p className="text-xl font-bold font-headline">Waiting for instructor...</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-headline uppercase text-muted-foreground">Session Tools</CardTitle></CardHeader>
            <CardContent className="space-y-3">
               <Button className="w-full" variant="outline" onClick={() => {
                   document.querySelectorAll('video').forEach(v => v.muted = false);
                   toast({ title: "Audio Active", description: "Audio is now unmuted." });
               }}>
                   <Mic className="mr-2 h-4 w-4" /> Unmute Audio
               </Button>
               <div className="p-3 bg-primary/5 rounded-lg border text-xs text-muted-foreground">
                   <p className="font-bold text-primary mb-1">Network: {connectionStatus}</p>
                   If the video freezes, try clicking the "Unmute" button or rejoin the class.
               </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
