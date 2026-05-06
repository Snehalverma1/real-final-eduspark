'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, deleteDoc, serverTimestamp, collection, addDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Video, VideoOff, Mic, MicOff, LogOut, Users, Play, Volume2, VolumeX, RefreshCw, Monitor, MonitorOff } from 'lucide-react';
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
  const remoteScreenRef = useRef<HTMLVideoElement>(null);
  
  const pc = useRef<RTCPeerConnection | null>(null);
  const candidateQueue = useRef<RTCIceCandidateInit[]>([]);
  const isBroadcasting = useRef(false);
  
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  
  const [isRemoteMuted, setIsRemoteMuted] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'failed' | 'offline'>('idle');

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
          video: { width: 1280, height: 720 }, 
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
      screenStream?.getTracks().forEach(track => track.stop());
      pc.current?.close();
    };
  }, [isInstructor]);

  // Attach local stream to video ref
  useEffect(() => {
    if (isInstructor && localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, isInstructor]);

  const processQueuedCandidates = () => {
    if (!pc.current || !pc.current.remoteDescription) return;
    while (candidateQueue.current.length > 0) {
      const candidate = candidateQueue.current.shift();
      if (candidate) {
        pc.current.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.error("Candidate error", e));
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
        const state = pc.current?.connectionState;
        if (state === 'connected') setConnectionStatus('connected');
        if (state === 'failed' || state === 'disconnected') setConnectionStatus('failed');
      };

      const offerDescription = await pc.current.createOffer();
      await pc.current.setLocalDescription(offerDescription);

      await setDoc(sessionRef, {
        status: 'active',
        instructorId: user.uid,
        instructorName: user.displayName || 'Instructor',
        offer: { sdp: offerDescription.sdp, type: offerDescription.type },
        createdAt: serverTimestamp(),
      });

      // Listen for student's answer
      onSnapshot(sessionRef, (snapshot) => {
        const data = snapshot.data();
        if (pc.current && data?.answer && pc.current.signalingState === 'have-local-offer') {
          pc.current.setRemoteDescription(new RTCSessionDescription(data.answer)).then(processQueuedCandidates);
        }
      });

      // Listen for student's candidates
      onSnapshot(calleeCandidatesCollection, (snapshot) => {
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

      // Student setup for receiving tracks
      pc.current.ontrack = (event) => {
        const [stream] = event.streams;
        const track = event.track;

        if (track.kind === 'video') {
            // Logic to determine if it's camera or screen
            // If the teacher has two streams, the screen sharing one usually has a different ID
            if (!remoteVideoRef.current?.srcObject) {
              remoteVideoRef.current!.srcObject = stream;
            } else if (remoteScreenRef.current && (remoteVideoRef.current.srcObject as MediaStream).id !== stream.id) {
              remoteScreenRef.current.srcObject = stream;
            }
        } else if (track.kind === 'audio') {
            if (remoteVideoRef.current && !remoteVideoRef.current.srcObject) {
              remoteVideoRef.current.srcObject = stream;
            }
        }
      };

      pc.current.onconnectionstatechange = () => {
        const state = pc.current?.connectionState;
        if (state === 'connected') setConnectionStatus('connected');
        if (state === 'failed' || state === 'disconnected') setConnectionStatus('failed');
      };

      const callerCandidatesCollection = collection(sessionRef, 'callerCandidates');
      const calleeCandidatesCollection = collection(sessionRef, 'calleeCandidates');

      pc.current.onicecandidate = (event) => {
        if (event.candidate) {
          addDoc(calleeCandidatesCollection, event.candidate.toJSON());
        }
      };

      // Listen for Offer (initial and re-negotiation)
      onSnapshot(sessionRef, async (snapshot) => {
        const data = snapshot.data();
        if (pc.current && data?.offer && data.offer.type === 'offer') {
          const remoteDesc = new RTCSessionDescription(data.offer);
          
          // Only process if it's a new offer or we are ready
          if (pc.current.signalingState !== 'stable' || !pc.current.remoteDescription || pc.current.remoteDescription.sdp !== remoteDesc.sdp) {
              await pc.current.setRemoteDescription(remoteDesc);
              processQueuedCandidates();
              
              const answer = await pc.current.createAnswer();
              await pc.current.setLocalDescription(answer);
              await updateDoc(sessionRef, { answer: { type: answer.type, sdp: answer.sdp } });
          }
        }
      });

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

  const toggleScreenShare = async () => {
    if (!isInstructor || !pc.current || !sessionRef) return;

    if (isScreenSharing) {
      // Find and remove screen tracks
      const senders = pc.current.getSenders();
      const tracks = screenStream?.getTracks() || [];
      senders.forEach(sender => {
          if (sender.track && tracks.includes(sender.track)) {
              pc.current?.removeTrack(sender);
          }
      });
      
      screenStream?.getTracks().forEach(track => track.stop());
      setScreenStream(null);
      setIsScreenSharing(false);
      
      // Trigger Re-negotiation
      const offer = await pc.current.createOffer();
      await pc.current.setLocalDescription(offer);
      await updateDoc(sessionRef, { offer: { sdp: offer.sdp, type: offer.type }, answer: null });
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        setScreenStream(stream);
        setIsScreenSharing(true);
        
        stream.getTracks()[0].onended = () => {
          if (isScreenSharing) toggleScreenShare();
        };

        // Add to PeerConnection
        stream.getTracks().forEach(track => {
            pc.current?.addTrack(track, stream);
        });
        
        // Trigger Re-negotiation
        const offer = await pc.current.createOffer();
        await pc.current.setLocalDescription(offer);
        await updateDoc(sessionRef, { offer: { sdp: offer.sdp, type: offer.type }, answer: null });

      } catch (err) {
        console.error("Screen share error:", err);
        setIsScreenSharing(false);
      }
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
  const hasOffer = !!sessionData?.offer;

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
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={toggleScreenShare} className={cn(isScreenSharing && "bg-accent text-accent-foreground")}>
                   {isScreenSharing ? <MonitorOff className="mr-2 h-4 w-4" /> : <Monitor className="mr-2 h-4 w-4" />}
                   {isScreenSharing ? "Stop Sharing" : "Share Screen"}
                </Button>
                <Button variant="destructive" size="sm" onClick={endSession}>
                  <LogOut className="mr-2 h-4 w-4" /> End
                </Button>
              </div>
            ) : (
              <Button onClick={startSession} className="bg-red-600 hover:bg-red-700 text-white shadow-lg">
                <Video className="mr-2 h-4 w-4" /> Go Live Now
              </Button>
            )
          ) : (
            isActive && hasOffer && connectionStatus === 'idle' && (
              <Button onClick={joinSession} disabled={isJoining} className="bg-green-600 hover:bg-green-700 text-white shadow-lg">
                {isJoining ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                Join Live Stream
              </Button>
            )
          )}
          {connectionStatus === 'failed' && (
            <Button variant="outline" onClick={() => window.location.reload()}>
              <RefreshCw className="mr-2 h-4 w-4" /> Retry
            </Button>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-6">
        <div className="space-y-4">
          <div className="relative aspect-video bg-neutral-950 rounded-2xl overflow-hidden border-4 border-muted shadow-2xl group/classroom">
            
            {/* INSTRUCTOR VIEW */}
            {isInstructor && (
              <div className="w-full h-full relative">
                 <video 
                    ref={localVideoRef} 
                    className={cn("w-full h-full object-cover bg-neutral-900", !isVideoEnabled && "hidden", isScreenSharing && "absolute bottom-4 right-4 w-64 h-36 border-2 border-white rounded-lg z-10 shadow-xl")} 
                    autoPlay 
                    muted 
                    playsInline 
                />
                {isScreenSharing && screenStream && (
                    <video 
                        autoPlay 
                        muted 
                        playsInline 
                        ref={(el) => { if(el) el.srcObject = screenStream; }}
                        className="w-full h-full object-contain bg-black"
                    />
                )}
              </div>
            )}

            {/* STUDENT VIEW */}
            {!isInstructor && (
              <div className="w-full h-full relative">
                    <video 
                        ref={remoteVideoRef} 
                        className={cn("w-full h-full object-cover", (!isActive || connectionStatus === 'idle') && "hidden", isScreenSharing && "absolute bottom-4 right-4 w-64 h-36 border-2 border-white rounded-lg z-10 shadow-xl")} 
                        autoPlay 
                        playsInline
                        muted={isRemoteMuted}
                    />
                    <video 
                        ref={remoteScreenRef}
                        className="w-full h-full object-contain bg-black hidden [&:not([srcObject=null])]:block"
                        autoPlay
                        playsInline
                        muted={isRemoteMuted}
                    />
                
                {isActive && connectionStatus === 'idle' && (
                   <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm text-white p-6 text-center">
                    <Video className="h-16 w-16 mb-4 text-primary opacity-50" />
                    <h3 className="text-xl font-bold">The class is live!</h3>
                    <p className="text-muted-foreground mb-6 max-w-xs text-sm">Join to start learning with the instructor.</p>
                   </div>
                )}

                {isActive && connectionStatus === 'connecting' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-white">
                    <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                    <p className="font-semibold text-lg">Connecting...</p>
                  </div>
                )}

                {isActive && connectionStatus === 'connected' && (
                  <div className="absolute bottom-6 right-6 z-30 flex gap-2">
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
            )}

            {!isActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-6 text-center bg-neutral-900/50">
                <VideoOff className="h-20 w-20 text-muted-foreground/30 mb-4" />
                <h3 className="text-2xl font-bold text-muted-foreground/50 font-headline">Classroom Offline</h3>
              </div>
            )}

            {isInstructor && isActive && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/40 backdrop-blur-xl p-4 rounded-full border border-white/20 shadow-2xl transition-opacity opacity-0 group-hover/classroom:opacity-100 z-20">
                <Button variant="ghost" size="icon" className={cn("rounded-full h-12 w-12 bg-white/10 hover:bg-white/20 text-white", !isAudioEnabled && "text-red-500 bg-red-500/20")} onClick={toggleAudio}>
                  {isAudioEnabled ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
                </Button>
                <Button variant="ghost" size="icon" className={cn("rounded-full h-12 w-12 bg-white/10 hover:bg-white/20 text-white", !isVideoEnabled && "text-red-500 bg-red-500/20")} onClick={toggleVideo}>
                  {isVideoEnabled ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
                </Button>
                <Button variant="ghost" size="icon" className={cn("rounded-full h-12 w-12 bg-white/10 hover:bg-white/20 text-white", isScreenSharing && "text-accent bg-accent/20")} onClick={toggleScreenShare}>
                  {isScreenSharing ? <MonitorOff className="h-6 w-6" /> : <Monitor className="h-6 w-6" />}
                </Button>
              </div>
            )}
          </div>

          {isInstructor && hasCameraPermission === false && (
            <Alert variant="destructive" className="mt-4">
              <AlertTitle>Camera Access Required</AlertTitle>
              <AlertDescription>Please allow camera and microphone access to start your broadcast.</AlertDescription>
            </Alert>
          )}
        </div>

        <Card className="border-none shadow-lg bg-card/50 self-start">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2 font-headline">
              <Users className="h-5 w-5 text-primary" />
              Participants
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 rounded-xl bg-background border shadow-sm">
              <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Status</p>
              <p className="font-bold text-sm capitalize">{connectionStatus === 'connected' ? 'Streaming' : connectionStatus}</p>
            </div>
            <div className="p-3 rounded-xl bg-background border shadow-sm">
              <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Your Role</p>
              <p className="font-bold text-sm">{isInstructor ? 'Instructor' : 'Student'}</p>
            </div>
            {isInstructor && (
              <div className="text-xs text-muted-foreground mt-4 italic">
                Tips: Use the monitor icon to share your laptop screen during the lesson.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
