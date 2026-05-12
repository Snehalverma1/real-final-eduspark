
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
  
  const [streamUrl, setStreamUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sessionId = 'active_session';
  const sessionRef = useMemoFirebase(() => {
    if (!firestore || !courseId) return null;
    return doc(firestore, 'courses', courseId, 'liveSessions', sessionId);
  }, [firestore, courseId]);

  const { data: sessionData, isLoading: isSessionLoading } = useDoc(sessionRef);

  const getVideoEmbedUrl = (url: string) => {
    if (!url) return null;

    // YouTube Check
    const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/;
    const youtubeMatch = url.match(youtubeRegex);
    if (youtubeMatch && youtubeMatch[1]) {
      return `https://www.youtube.com/embed/${youtubeMatch[1]}?autoplay=1`;
    }

    // Vimeo Check
    const vimeoRegex = /(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(?:channels\/(?:\w+\/)|groups\/(?:[^\/]*)\/videos\/|album\/(?:\d+)\/video\/|video\/|)(\d+)(?:\/(\w+))?/;
    const vimeoMatch = url.match(vimeoRegex);
    if (vimeoMatch) {
      const videoId = vimeoMatch[1];
      const hash = vimeoMatch[2];
      let embed = `https://player.vimeo.com/video/${videoId}?autoplay=1&title=0&byline=0&portrait=0`;
      if (hash) embed += `&h=${hash}`;
      return embed;
    }

    return null;
  };

  const handleStartStream = async () => {
    if (!sessionRef || !user || !streamUrl) {
      toast({ variant: "destructive", title: "Missing URL", description: "Please enter your Live link." });
      return;
    }

    const embedUrl = getVideoEmbedUrl(streamUrl);
    if (!embedUrl) {
      toast({ variant: "destructive", title: "Invalid URL", description: "Please provide a valid YouTube or Vimeo link." });
      return;
    }

    setIsSubmitting(true);
    try {
      await setDoc(sessionRef, {
        status: 'active',
        instructorId: user.uid,
        instructorName: user.displayName || 'Instructor',
        playbackUrl: embedUrl,
        originalUrl: streamUrl,
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
        setStreamUrl('');
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
        <p className="text-muted-foreground mt-4">Connecting to live feed...</p>
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
                  {sessionData?.status === 'active' ? `Broadcasting: ${sessionData.instructorName}` : "Live Classroom Feed"}
                </h2>
              </div>
            </div>

            {isInstructor && (
              <div className="flex flex-1 max-w-md items-end gap-2">
                {!sessionData ? (
                  <div className="grid w-full gap-2">
                    <Label htmlFor="live-url" className="text-xs font-bold uppercase text-muted-foreground">Video Stream URL (YouTube/Vimeo)</Label>
                    <div className="flex gap-2">
                      <Input 
                        id="live-url"
                        placeholder="Paste live link here..." 
                        value={streamUrl}
                        onChange={(e) => setStreamUrl(e.target.value)}
                      />
                      <Button onClick={handleStartStream} disabled={isSubmitting || !streamUrl} className="bg-red-600 hover:bg-red-700">
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
            title="Live Stream"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          ></iframe>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
            <Video className="h-20 w-20 text-muted-foreground/30 mb-6" />
            <h3 className="text-2xl font-headline font-bold text-white">Stream is Offline</h3>
            <p className="text-muted-foreground max-w-sm mt-2">
              {isInstructor 
                ? "Paste your YouTube or Vimeo Live link above to start the session." 
                : "The teacher hasn't started the stream yet. Please check back in a moment!"}
            </p>
            {isInstructor && (
              <div className="flex gap-4 mt-6">
                <Button variant="outline" size="sm" asChild>
                    <a href="https://studio.youtube.com/" target="_blank" rel="noopener noreferrer">
                    <Youtube className="mr-2 h-4 w-4" /> YouTube Studio
                    </a>
                </Button>
                 <Button variant="outline" size="sm" asChild>
                    <a href="https://vimeo.com/live" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" /> Vimeo Live
                    </a>
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="p-4 bg-blue-500/5 rounded-xl border border-blue-500/10 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold text-blue-700 dark:text-blue-400">Supported Platforms</p>
          <p className="text-muted-foreground mt-1">
            EduSpark supports <strong>YouTube</strong> and <strong>Vimeo</strong> live streams. Simply paste the URL from your browser's address bar.
          </p>
        </div>
      </div>
    </div>
  );
}
