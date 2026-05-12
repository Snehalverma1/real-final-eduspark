
'use client';

import { useState } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Video, LogOut, Radio, Youtube, ExternalLink, AlertTriangle } from 'lucide-react';
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
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}?autoplay=1` : null;
  };

  const handleStartStream = async () => {
    if (!sessionRef || !user || !youtubeUrl) {
      toast({ variant: "destructive", title: "Missing Information", description: "Please enter a valid YouTube Live URL." });
      return;
    }

    const embedUrl = getYouTubeEmbedUrl(youtubeUrl);
    if (!embedUrl) {
      toast({ variant: "destructive", title: "Invalid URL", description: "Please enter a valid YouTube link." });
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
      toast({ title: "Stream Started!", description: "Your students can now join the live room." });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Could not start the stream. Check your permissions." });
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
        toast({ title: "Stream Ended", description: "The live session has been closed." });
      } catch (error) {
        toast({ variant: "destructive", title: "Error", description: "Could not end stream." });
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  if (isSessionLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Connecting to live room...</p>
      </div>
    );
  }

  const embedUrl = sessionData?.playbackUrl;

  return (
    <div className="space-y-6">
      {/* Dashboard Control Bar */}
      <Card className="border-2 border-primary/10 shadow-xl overflow-hidden">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <Badge variant={sessionData?.status === 'active' ? "default" : "secondary"} className={cn("px-4 py-1.5 text-sm font-bold", sessionData?.status === 'active' && "bg-red-600 animate-pulse")}>
                {sessionData?.status === 'active' ? "LIVE NOW" : "OFFLINE"}
              </Badge>
              <div>
                <h2 className="text-xl font-bold font-headline">
                  {sessionData?.status === 'active' ? `Instructor: ${sessionData.instructorName}` : "Setup YouTube Live"}
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {sessionData?.status === 'active' ? "Broadcasting to all enrolled students" : "Enter your YouTube Live link to begin"}
                </p>
              </div>
            </div>

            {isInstructor && (
              <div className="flex flex-1 max-w-md items-end gap-2">
                {!sessionData ? (
                  <div className="grid w-full gap-1.5">
                    <Label htmlFor="youtube-url" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">YouTube Live URL</Label>
                    <div className="flex gap-2">
                      <Input 
                        id="youtube-url"
                        placeholder="https://www.youtube.com/watch?v=..." 
                        value={youtubeUrl}
                        onChange={(e) => setYoutubeUrl(e.target.value)}
                        className="bg-muted/50"
                      />
                      <Button onClick={handleStartStream} disabled={isSubmitting || !youtubeUrl} className="bg-red-600 hover:bg-red-700 whitespace-nowrap">
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Video className="mr-2 h-4 w-4" /> Go Live</>}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="destructive" onClick={handleEndStream} disabled={isSubmitting} className="rounded-full px-6 ml-auto">
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><LogOut className="mr-2 h-4 w-4" /> End Stream</>}
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        {/* Main Stage */}
        <div className="space-y-4">
          <div className="relative aspect-video bg-slate-950 rounded-3xl overflow-hidden shadow-2xl border-4 border-muted ring-1 ring-white/10">
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
                <div className="p-6 rounded-full bg-white/5 mb-6">
                  <Youtube className="h-16 w-16 text-muted-foreground/50" />
                </div>
                <h3 className="text-2xl font-headline font-bold text-white">Classroom Offline</h3>
                <p className="text-muted-foreground max-w-sm mt-2">
                  {isInstructor 
                    ? "Start your stream on YouTube, then paste the link above to begin teaching." 
                    : "The instructor hasn't started the live session yet. Please wait or check the course schedule."}
                </p>
                {isInstructor && (
                  <Button variant="outline" size="sm" className="mt-6 border-white/20 text-white hover:bg-white/10" asChild>
                    <a href="https://studio.youtube.com/" target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" /> Open YouTube Studio
                    </a>
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card className="bg-card/50 backdrop-blur-sm border-2">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                <Radio className="h-4 w-4" /> Stream Guidelines
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4 text-sm leading-relaxed">
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">1</div>
                  <p>Set your YouTube stream to <strong>"Public"</strong> or <strong>"Unlisted"</strong>.</p>
                </div>
                <div className="flex gap-3">
                  <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">2</div>
                  <p>Enable <strong>"Embedding"</strong> in your YouTube stream settings.</p>
                </div>
                <div className="flex gap-3">
                  <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">3</div>
                  <p>Paste the browser URL directly into the input field above.</p>
                </div>
              </div>

              <div className="p-4 bg-amber-500/10 rounded-xl border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-400 mt-4">
                <div className="flex items-center gap-2 font-bold mb-1">
                  <AlertTriangle className="h-3 w-3" /> Note on Latency
                </div>
                YouTube Live typically has a 10-20 second delay. Encourage students to use the lesson Q&A for complex questions.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
