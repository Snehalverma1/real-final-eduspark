
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
  
  // Video References
  const primaryVideoRef = useRef<HTMLVideoElement>(null);
  const pipVideoRef = useRef<HTMLVideoElement>(null);
  
  // WebRTC Core
  const pc = useRef<RTCPeerConnection | null>(null);
  const candidateQueue = useRef<any[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  
  // UI State
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'failed' | 'disconnected'>('idle');
  const [isSignaling, setIsSignaling] = useState(false);
  const [isLive, setIsLive] = useState(false);

  const sessionId = 'active_session';
  const sessionRef = useMemoFirebase(() => {
    if (!firestore || !courseId) return null;
    return doc(firestore, 'courses', courseId, 'liveSessions', sessionId);
  }, [firestore, courseId]);

  const { data: sessionData } = useDoc(sessionRef);

  // Synchronize Instructor Videos
  useEffect(() => {
    if (!isInstructor) return;
    
    if (screenStream) {
      if (primaryVideoRef.current) primaryVideoRef.current.srcObject = screenStream;
      if (pipVideoRef.current) pipVideoRef.current.srcObject = localStream;
    } else if (localStream) {
      if (primaryVideoRef.current) primaryVideoRef.current.srcObject = localStream;
      if (pipVideoRef.current) pipVideoRef.current.srcObject = null;
    }
  }, [isInstructor, localStream, screenStream]);

  const initCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 1280, height: 720 }, 
        audio: true 
      });
      setLocalStream(stream);
      toast({ title: "Camera Enabled", description: "You are ready to go live." });
    } catch (err) {
      toast({ variant: "destructive", title: "Camera Error", description: "Please ensure camera permissions are granted." });
    }
  };

  const initScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      setScreenStream(stream);
      
      // If already live, update the broadcast
      if (pc.current && isLive) {
        stream.getTracks().forEach(track => pc.current?.addTrack(track, stream));
        const offer = await pc.current.createOffer();
        await pc.current.setLocalDescription(offer);
        if (sessionRef) {
          await updateDoc(sessionRef, { 
            offer: { sdp: offer.sdp, type: offer.type },
            hasScreen: true,
            updatedAt: serverTimestamp()
          });
        }
      }
      
      stream.getVideoTracks()[0].onended = () => {
        setScreenStream(null);
        if (sessionRef) updateDoc(sessionRef, { hasScreen: false });
      };
    } catch (err) {
      toast({ variant: "destructive", title: "Screen Share Failed", description: "Could not access screen content." });
    }
  };

  const startBroadcast = async () => {
    if (!sessionRef || !localStream || !user) return;
    setIsSignaling(true);

    const peer = new RTCPeerConnection(servers);
    pc.current = peer;

    // Add local tracks
    localStream.getTracks().forEach(track => peer.addTrack(track, localStream));
    if (screenStream) {
      screenStream.getTracks().forEach(track => peer.addTrack(track, screenStream));
    }

    // Signaling candidates (Outgoing)
    const callerCandidates = collection(sessionRef, 'callerCandidates');
    peer.onicecandidate = (event) => {
      if (event.candidate) addDoc(callerCandidates, event.candidate.toJSON());
    };

    peer.onconnectionstatechange = () => setConnectionStatus(peer.connectionState as any);

    // Create and set offer
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

    // Listen for Answer
    const unsubscribe = onSnapshot(sessionRef, async (snapshot) => {
      const data = snapshot.data();
      if (!peer.currentRemoteDescription && data?.answer) {
        const answerDescription = new RTCSessionDescription(data.answer);
        await peer.setRemoteDescription(answerDescription);
      }
    });

    // Handle incoming ICE candidates
    const calleeCandidates = collection(sessionRef, 'calleeCandidates');
    onSnapshot(calleeCandidates, (snap) => {
      snap.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const candidate = new RTCIceCandidate(change.doc.data());
          if (peer.remoteDescription) {
            await peer.addIceCandidate(candidate);
          } else {
            candidateQueue.current.push(candidate);
          }
        }
      });
    });

    setIsSignaling(false);
    setIsLive(true);
    return () => unsubscribe();
  };

  const joinClass = async () => {
    if (!sessionRef || !sessionData?.offer || isInstructor) return;
    setIsSignaling(true);
    setConnectionStatus('connecting');

    const peer = new RTCPeerConnection(servers);
    pc.current = peer;

    // Handle Incoming Streams
    peer.ontrack = (event) => {
      const stream = event.streams[0];
      if (event.track.kind === 'video') {
        // If teacher is sharing screen, the first stream is often the camera and the second is screen
        // But we rely on hasScreen flag to help route
        if (!primaryVideoRef.current?.srcObject) {
          primaryVideoRef.current!.srcObject = stream;
        } else if (primaryVideoRef.current.srcObject !== stream && !pipVideoRef.current?.srcObject) {
          pipVideoRef.current!.srcObject = stream;
        }
      }
    };

    peer.onconnectionstatechange = () => setConnectionStatus(peer.connectionState as any);

    // Candidates
    const calleeCandidates = collection(sessionRef, 'calleeCandidates');
    peer.onicecandidate = (event) => {
      if (event.candidate) addDoc(calleeCandidates, event.candidate.toJSON());
    };

    // Handshake
    await peer.setRemoteDescription(new RTCSessionDescription(sessionData.offer));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);

    await updateDoc(sessionRef, { answer: { type: answer.type, sdp: answer.sdp } });

    // Process buffered candidates
    const callerCandidates = collection(sessionRef, 'callerCandidates');
    onSnapshot(callerCandidates, (snap) => {
      snap.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const candidate = new RTCIceCandidate(change.doc.data());
          if (peer.remoteDescription) {
            await peer.addIceCandidate(candidate);
          } else {
            candidateQueue.current.push(candidate);
          }
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
              {active ? `Instructor: ${sessionData.instructorName}` : "Wait for instructor to go live"}
            </h2>
            <p className="text-xs text-muted-foreground mt-1 capitalize">Network: {connectionStatus}</p>
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
                  <Button onClick={startBroadcast} disabled={isSignaling} className="bg-red-600 hover:bg-red-700 text-white shadow-lg">
                    {isSignaling ? <Loader2 className="animate-spin" /> : <Video className="mr-2 h-4 w-4" />} Go Live
                  </Button>
                </>
              ) : (
                <>
                   <Button onClick={initScreenShare} variant="secondary" size="sm">
                    <Monitor className="mr-2 h-4 w-4" /> {screenStream ? "Stop Sharing" : "Share Screen"}
                  </Button>
                  <Button variant="destructive" size="sm" onClick={endBroadcast}>
                    <LogOut className="mr-2 h-4 w-4" /> End Session
                  </Button>
                </>
              )}
            </>
          ) : (
            active && connectionStatus === 'idle' && (
              <Button onClick={joinClass} disabled={isSignaling} className="bg-green-600 hover:bg-green-700 text-white px-8 rounded-full">
                {isSignaling ? <Loader2 className="animate-spin" /> : <Play className="mr-2 h-5 w-5" />} Join Class
              </Button>
            )
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-6">
        <div className="relative group">
          <div className="relative aspect-video bg-neutral-900 rounded-2xl overflow-hidden border-2 border-muted shadow-2xl">
            {/* Main Stage */}
            <video 
              ref={primaryVideoRef} 
              className="w-full h-full object-contain" 
              autoPlay 
              muted 
              playsInline 
            />

            {/* Picture-in-Picture (Face Camera) */}
            <div className={cn(
                "absolute bottom-4 right-4 w-48 aspect-video bg-black rounded-lg border-2 border-white/20 shadow-xl overflow-hidden transition-all duration-300",
                ((isInstructor && screenStream) || (!isInstructor && sessionData?.hasScreen)) ? "opacity-100 scale-100" : "opacity-0 scale-90 pointer-events-none"
            )}>
              <video 
                ref={pipVideoRef} 
                className="w-full h-full object-cover" 
                autoPlay 
                muted 
                playsInline 
              />
            </div>

            {!isInstructor && !active && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-neutral-950/90 backdrop-blur-sm">
                <VideoOff className="h-16 w-16 mb-4 text-neutral-600" />
                <p className="text-xl font-bold font-headline">Classroom is currently closed</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" /> Control Panel
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
               <Button className="w-full" variant="outline" size="sm" onClick={() => {
                   if (primaryVideoRef.current) primaryVideoRef.current.muted = false;
                   if (pipVideoRef.current) pipVideoRef.current.muted = false;
                   toast({ title: "Audio Active", description: "Video is now unmuted." });
               }}>
                   <Mic className="mr-2 h-4 w-4" /> Unmute Instructor
               </Button>
               <div className="p-3 bg-primary/5 rounded-lg border text-[10px] leading-relaxed text-muted-foreground">
                   <p className="font-bold text-primary mb-1">Tips for a better experience:</p>
                   If you see a black screen, click "Unmute Instructor" or refresh the page. This is usually caused by browser autoplay restrictions.
               </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
