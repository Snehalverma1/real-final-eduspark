
'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, deleteDoc, serverTimestamp, collection, addDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Video, VideoOff, LogOut, Users, Play, AlertCircle, Camera } from 'lucide-react';
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
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'failed' | 'disconnected'>('idle');
  const [isSignaling, setIsSignaling] = useState(false);

  const sessionId = 'active_session';
  const sessionRef = useMemoFirebase(() => {
    if (!firestore || !courseId) return null;
    return doc(firestore, 'courses', courseId, 'liveSessions', sessionId);
  }, [firestore, courseId]);

  const { data: sessionData } = useDoc(sessionRef);

  // Instructor: Initialize Camera
  const initCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      toast({ title: "Camera Enabled", description: "You are ready to start the broadcast." });
    } catch (err) {
      console.error('Camera error:', err);
      toast({ variant: "destructive", title: "Camera Error", description: "Please ensure you have granted camera permissions." });
    }
  };

  // Instructor: Start Broadcast
  const startBroadcast = async () => {
    if (!sessionRef || !localStream || !user) return;
    setIsSignaling(true);

    const peer = new RTCPeerConnection(servers);
    pc.current = peer;

    localStream.getTracks().forEach(track => peer.addTrack(track, localStream));

    const callerCandidates = collection(sessionRef, 'callerCandidates');
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        addDoc(callerCandidates, event.candidate.toJSON());
      }
    };

    peer.onconnectionstatechange = () => setConnectionStatus(peer.connectionState as any);

    const offerDescription = await peer.createOffer();
    await peer.setLocalDescription(offerDescription);

    const offer = { sdp: offerDescription.sdp, type: offerDescription.type };
    await setDoc(sessionRef, {
      offer,
      status: 'active',
      instructorId: user.uid,
      instructorName: user.displayName || 'Instructor',
      createdAt: serverTimestamp(),
    });

    onSnapshot(sessionRef, async (snapshot) => {
      const data = snapshot.data();
      if (!peer.currentRemoteDescription && data?.answer) {
        await peer.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    });

    const calleeCandidates = collection(sessionRef, 'calleeCandidates');
    onSnapshot(calleeCandidates, (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type === 'added') {
          peer.addIceCandidate(new RTCIceCandidate(change.doc.data()));
        }
      });
    });

    setIsSignaling(false);
    toast({ title: 'Class Started', description: 'Students can now join the session.' });
  };

  // Student: Join Class
  const joinClass = async () => {
    if (!sessionRef || !sessionData?.offer || isInstructor) return;
    setIsSignaling(true);
    setConnectionStatus('connecting');

    const peer = new RTCPeerConnection(servers);
    pc.current = peer;

    peer.ontrack = (event) => {
      if (event.streams && event.streams[0] && remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
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
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          peer.addIceCandidate(new RTCIceCandidate(change.doc.data()));
        }
      });
    });

    setIsSignaling(false);
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
    };
  }, [localStream]);

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
              <Button onClick={initCamera}>
                <Camera className="mr-2 h-4 w-4" /> Enable Camera
              </Button>
            ) : !isActive ? (
              <Button onClick={startBroadcast} disabled={isSignaling} className="bg-red-600 hover:bg-red-700 text-white">
                {isSignaling ? <Loader2 className="animate-spin" /> : <Video className="mr-2 h-4 w-4" />} Start Broadcast
              </Button>
            ) : (
              <Button variant="destructive" onClick={endBroadcast}>
                <LogOut className="mr-2 h-4 w-4" /> End Class
              </Button>
            )
          ) : (
            isActive && connectionStatus === 'idle' && (
              <Button onClick={joinClass} disabled={isSignaling} className="bg-green-600 hover:bg-green-700 text-white">
                {isSignaling ? <Loader2 className="animate-spin" /> : <Play className="mr-2 h-4 w-4" />} Join Class
              </Button>
            )
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-6">
        <div className="relative aspect-video bg-black rounded-xl overflow-hidden border shadow-2xl">
          {isInstructor ? (
            <video ref={localVideoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
          ) : (
            <video ref={remoteVideoRef} className="w-full h-full object-cover" autoPlay playsInline />
          )}

          {!isInstructor && !isActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-neutral-950/80">
              <VideoOff className="h-12 w-12 mb-4 opacity-30" />
              <p className="font-bold">Teacher is Offline</p>
            </div>
          )}

          {isInstructor && !localStream && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-neutral-950/80">
              <Camera className="h-12 w-12 mb-4 opacity-30" />
              <p className="font-bold">Camera Access Required</p>
              <Button onClick={initCamera} variant="secondary" className="mt-4">Allow Camera</Button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Session Info</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Role:</span>
                <span className="font-bold">{isInstructor ? 'Instructor' : 'Student'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Network:</span>
                <Badge variant="outline" className="capitalize">{connectionStatus}</Badge>
              </div>
            </CardContent>
          </Card>
          
          <Alert className="bg-primary/5 border-primary/20">
            <AlertCircle className="h-4 w-4 text-primary" />
            <AlertDescription className="text-xs">
              If the screen is black, please ensure you clicked "Join Class" or "Enable Camera".
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  );
}
