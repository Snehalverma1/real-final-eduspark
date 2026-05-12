
'use client';

import { useState } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Video, LogOut, Youtube, ExternalLink, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface LiveClassroomProps {
  courseId: string;
  isInstructor: boolean;
}

export default function LiveClassroom({ courseId, isInstructor }: LiveClassroomProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sessionId = 'active_session';
  const sessionRef = useMemoFirebase(() => {
    if (!firestore || !courseId) return null;
    return doc(firestore, 'courses', courseId, 'liveSessions', sessionId);
  }, [firestore, courseId]);

  const { data: sessionData, isLoading: isSessionLoading } = useDoc(sessionRef);

  const getYouTubeEmbedUrl = (url: string) => {
    if (!url) return null;
    // Standard YouTube URL parsing
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}?autoplay=1` : null;
  };

  const handleStartStream = async () => {
    if (!sessionRef || !user || !youtubeUrl) {
      toast({ variant: "destructive", title: "Missing URL", description: "Please enter your YouTube Live link." });
      return;
    }

    const embedUrl = getYouTubeEmbedUrl(youtubeUrl);
    if (!embedUrl) {
      toast({ variant: "destructive", title: "Invalid URL", description: "This does not look like a valid YouTube link." });
      return;
    }

    setIsSubmitting(true);
    try {
      await setDoc(sessionRef, {
        status: 'active',
        instructorId: user.uid,
        instructorName: user.displayName || 'Instructor',
        playbackUrl: embedUrl,
        originalUrl: youtubeUrl,
        createdAt: serverTimestamp(),
      });
      toast({ title: "Live Session Started!", description: "Students can now see your broadcast." });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Could not start session. Check your connection." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEndStream = async () => {
    if (sessionRef && isInstructor) {
      setIsSubmitting(true);
      try {
        await deleteDoc(sessionRef);
        setYoutubeUrl('');
        toast({ title: "Stream Ended", description: "The session is now closed." });
      } catch (error) {
        toast({ variant: "destructive", title: "Error", description: "Could not end stream." });
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  if (isSessionLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground mt-4">Connecting to YouTube...</p>
      </div>
    );
  }

  const embedUrl = sessionData?.playbackUrl;

  return (
    <div className="space-y-6">
      <Card className="border-2 border-primary/10 shadow-lg">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <Badge variant={sessionData?.status === 'active' ? "default" : "secondary"} className={cn("px-4 py-1.5 text-xs font-bold", sessionData?.status === 'active' && "bg-red-600 animate-pulse")}>
                {sessionData?.status === 'active' ? "LIVE NOW" : "OFFLINE"}
              </Badge>
              <div>
                <h2 className="text-xl font-bold font-headline">
                  {sessionData?.status === 'active' ? `Broadcasting: ${sessionData.instructorName}` : "YouTube Live Stream"}
                </h2>
              </div>
            </div>

            {isInstructor && (
              <div className="flex flex-1 max-w-md items-end gap-2">
                {!sessionData ? (
                  <div className="grid w-full gap-2">
                    <Label htmlFor="youtube-url" className="text-xs font-bold uppercase text-muted-foreground">YouTube Live URL</Label>
                    <div className="flex gap-2">
                      <Input 
                        id="youtube-url"
                        placeholder="Paste YouTube link here..." 
                        value={youtubeUrl}
                        onChange={(e) => setYoutubeUrl(e.target.value)}
                      />
                      <Button onClick={handleStartStream} disabled={isSubmitting || !youtubeUrl} className="bg-red-600 hover:bg-red-700">
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Video className="mr-2 h-4 w-4" /> Go Live</>}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="destructive" onClick={handleEndStream} disabled={isSubmitting} className="ml-auto">
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><LogOut className="mr-2 h-4 w-4" /> Stop Stream</>}
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="relative aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border-4 border-muted">
        {embedUrl ? (
          <iframe
            className="w-full h-full"
            src={embedUrl}
            title="YouTube Live Stream"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          ></iframe>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
            <Youtube className="h-20 w-20 text-muted-foreground/30 mb-6" />
            <h3 className="text-2xl font-headline font-bold text-white">Stream is Offline</h3>
            <p className="text-muted-foreground max-w-sm mt-2">
              {isInstructor 
                ? "Paste your YouTube link above to start the live class." 
                : "The teacher hasn't started the stream yet. Please check back in a moment!"}
            </p>
            {isInstructor && (
              <Button variant="outline" size="sm" className="mt-6" asChild>
                <a href="https://studio.youtube.com/" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" /> Open YouTube Studio
                </a>
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="p-4 bg-blue-500/5 rounded-xl border border-blue-500/10 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold text-blue-700 dark:text-blue-400">Streaming Help</p>
          <p className="text-muted-foreground mt-1">
            Make sure your YouTube stream is set to <strong>Public</strong> or <strong>Unlisted</strong>. Private streams cannot be viewed by students here.
          </p>
        </div>
      </div>
    </div>
  );
}
