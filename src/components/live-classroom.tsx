
'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, deleteDoc, serverTimestamp, collection, addDoc, onSnapshot, updateDoc, DocumentReference } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Video, VideoOff, LogOut, Users, Play, AlertCircle, Camera, Monitor, MonitorOff } from 'lucide-react';
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
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteScreenRef = useRef<HTMLVideoElement>(null);
  
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

  // Buffer for ICE candidates arriving before remote description is set
  const candidateQueue = useRef<any[]>([]);

  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (screenStream && screenVideoRef.current) {
      screenVideoRef.current.srcObject = screenStream;
    }
  }, [screenStream]);

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
      
      // If already live, add tracks to existing peer connection
      if (pc.current) {
        stream.getTracks().forEach(track => {
          pc.current?.addTrack(track, stream);
        });
        // Re-negotiate
        const offer = await pc.current.createOffer();
        await pc.current.setLocalDescription(offer);
        if (sessionRef) {
          await updateDoc(sessionRef, { 
            offer: { sdp: offer.sdp, type: offer.type },
            updatedAt: serverTimestamp()
          });
        }
      }
      
      stream.getVideoTracks()[0].onended = () => {
        setScreenStream(null);
      };
      
      toast({ title: "Screen Sharing", description: "Your screen is now being shared." });
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
      if (event.candidate) {
        addDoc(callerCandidates, event.candidate.toJSON());
      }
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
        const answer = new RTCSessionDescription(data.answer);
        await peer.setRemoteDescription(answer);
        // Process queued candidates
        while (candidateQueue.current.length > 0) {
          const candidate = candidateQueue.current.shift();
          await peer.addIceCandidate(new RTCIceCandidate(candidate));
        }
      }
    });

    const calleeCandidates = collection(sessionRef, 'calleeCandidates');
    onSnapshot(calleeCandidates, (snap) => {
      snap.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const candidate = change.doc.data();
          if (peer.remoteDescription) {
            await peer.addIceCandidate(new RTCIceCandidate(candidate));
          } else {
            candidateQueue.current.push(candidate);
          }
        }
      });
    });

    setIsSignaling(false);
    setIsLive(true);
    toast({ title: 'Class Started', description: 'Students can now join.' });
  };

  const joinClass = async () => {
    if (!sessionRef || !sessionData?.offer || isInstructor) return;
    setIsSignaling(true);
    setConnectionStatus('connecting');

    const peer = new RTCPeerConnection(servers);
    pc.current = peer;

    peer.ontrack = (event) => {
      const streams = event.streams;
      if (streams && streams[0]) {
        // Simple logic: first stream is camera, second (if any) is screen
        if (event.track.kind === 'video') {
            const streamId = streams[0].id;
            // Map streams to players
            if (!remoteVideoRef.current?.srcObject) {
                remoteVideoRef.current!.srcObject = streams[0];
            } else if (remoteVideoRef.current?.srcObject !== streams[0] && !remoteScreenRef.current?.srcObject) {
                remoteScreenRef.current!.srcObject = streams[0];
            }
        }
      }
    };

    peer.onconnectionstatechange = () => setConnectionStatus(peer.connectionState as any);

    const calleeCandidates = collection(sessionRef, 'calleeCandidates');
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        addDoc(calleeCandidates, event.candidate.toJSON());
      }
    };

    await peer.setRemoteDescription(new RTCSessionDescription(sessionData.offer));
    const answerDescription = await peer.createAnswer();
    await peer.setLocalDescription(answerDescription);

    await updateDoc(sessionRef, { answer: { type: answerDescription.type, sdp: answerDescription.sdp } });

    const callerCandidates = collection(sessionRef, 'callerCandidates');
    onSnapshot(callerCandidates, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const candidate = change.doc.data();
          if (peer.remoteDescription) {
            await peer.addIceCandidate(new RTCIceCandidate(candidate));
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
              {active ? `Live Class: ${sessionData.instructorName}` : "Classroom is currently offline"}
            </h2>
            <div className="flex items-center gap-2 mt-1">
               <div className={cn("h-2 w-2 rounded-full", connectionStatus === 'connected' ? "bg-green-500" : "bg-neutral-300")} />
               <p className="text-xs text-muted-foreground capitalize">{connectionStatus}</p>
            </div>
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
                    <Monitor className="mr-2 h-4 w-4" /> Update Screen
                  </Button>
                  <Button variant="destructive" onClick={endBroadcast}>
                    <LogOut className="mr-2 h-4 w-4" /> End Class
                  </Button>
                </>
              )}
            </>
          ) : (
            active && connectionStatus === 'idle' && (
              <Button onClick={joinClass} disabled={isSignaling} className="bg-green-600 hover:bg-green-700 text-white h-12 px-8 text-lg rounded-full shadow-lg hover:scale-105 transition-all">
                {isSignaling ? <Loader2 className="animate-spin" /> : <Play className="mr-2 h-5 w-5" />} Join Live Lesson
              </Button>
            )
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-6">
        <div className="relative group">
          {/* Primary View (Screen or Camera) */}
          <div className="relative aspect-video bg-neutral-900 rounded-2xl overflow-hidden border-4 border-muted shadow-2xl">
            {isInstructor ? (
              <video ref={screenStream ? screenVideoRef : localVideoRef} className="w-full h-full object-contain" autoPlay muted playsInline />
            ) : (
              <video ref={remoteScreenRef.current?.srcObject ? remoteScreenRef : remoteVideoRef} className="w-full h-full object-contain" autoPlay playsInline muted />
            )}

            {/* Picture-in-Picture for Face Cam if Screen Sharing */}
            {(isInstructor ? !!(screenStream && localStream) : !!(remoteScreenRef.current?.srcObject && remoteVideoRef.current?.srcObject)) && (
               <div className="absolute bottom-4 right-4 w-48 aspect-video bg-black rounded-lg border-2 border-white/20 shadow-xl overflow-hidden z-10">
                  {isInstructor ? (
                    <video ref={localVideoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                  ) : (
                    <video ref={remoteVideoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                  )}
               </div>
            )}

            {!isInstructor && !active && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-neutral-950/90 backdrop-blur-sm">
                <VideoOff className="h-16 w-16 mb-4 text-neutral-600" />
                <p className="text-xl font-bold font-headline">Waiting for teacher to start...</p>
                <p className="text-neutral-500 mt-2">The video feed will appear here once the class begins.</p>
              </div>
            )}

            {isInstructor && !localStream && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-neutral-950/90 backdrop-blur-sm">
                <Camera className="h-16 w-16 mb-4 text-neutral-600" />
                <p className="text-xl font-bold font-headline">Setup Your Camera</p>
                <Button onClick={initCamera} variant="secondary" className="mt-6 rounded-full px-8">Enable Camera Access</Button>
              </div>
            )}
          </div>
          
          {active && connectionStatus === 'connected' && !isInstructor && (
             <div className="absolute top-4 left-4">
                <Badge className="bg-black/50 backdrop-blur-md text-white border-white/20">
                    <Users className="w-3 h-3 mr-2" /> Live Stream Active
                </Badge>
             </div>
          )}
        </div>

        <div className="space-y-4">
          <Card className="border-none shadow-md">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-headline uppercase tracking-wider text-muted-foreground">Session Statistics</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-4">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">Your Role</span>
                <Badge variant="outline" className="font-bold">{isInstructor ? 'Instructor' : 'Student'}</Badge>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">Network State</span>
                <span className="font-mono text-xs uppercase font-bold text-primary">{connectionStatus}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-muted-foreground">Sharing Screen</span>
                <span className="font-bold">{ (isInstructor ? !!screenStream : !!remoteScreenRef.current?.srcObject) ? 'Yes' : 'No' }</span>
              </div>
            </CardContent>
          </Card>
          
          <Alert className="bg-primary/5 border-primary/20">
            <AlertCircle className="h-4 w-4 text-primary" />
            <AlertTitle className="text-primary font-bold">Pro Tip</AlertTitle>
            <AlertDescription className="text-xs leading-relaxed">
              If the video feed looks frozen, try toggling your camera or re-joining the session. Browser security may occasionally block initial playback.
            </AlertDescription>
          </Alert>
          
          {active && !isInstructor && connectionStatus === 'connected' && (
            <Button className="w-full" variant="secondary" onClick={() => {
                const audios = document.querySelectorAll('video');
                audios.forEach(v => v.muted = false);
                toast({ title: "Audio Enabled", description: "You can now hear the instructor." });
            }}>
                Unmute Audio
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
