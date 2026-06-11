
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Mic, MicOff, Sparkles, Command } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function VoiceCommander() {
  const [isListening, setIsListening] = useState(false);
  const [lastCommand, setLastCommand] = useState('');
  const router = useRouter();
  const recognitionRef = useRef<any>(null);
  const { toast } = useToast();

  const processCommand = useCallback((transcript: string) => {
    const command = transcript.toLowerCase().trim();
    setLastCommand(command);

    if (command.includes('scroll down')) {
      window.scrollBy({ top: 600, behavior: 'smooth' });
    } else if (command.includes('scroll up')) {
      window.scrollBy({ top: -600, behavior: 'smooth' });
    } else if (command.includes('go home') || command.includes('go to home')) {
      router.push('/');
    } else if (command.includes('my learning')) {
      router.push('/my-learning');
    } else if (command.includes('go profile') || command.includes('go to profile')) {
      router.push('/profile');
    } else if (command.startsWith('search ')) {
      const query = command.replace('search ', '').trim();
      router.push(`/?search=${encodeURIComponent(query)}`);
    }
  }, [router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const transcript = event.results[event.results.length - 1][0].transcript;
        processCommand(transcript);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        if (event.error === 'not-allowed') {
          toast({ variant: 'destructive', title: 'Mic Access Denied', description: 'Please enable microphone permissions in your browser.' });
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        if (isListening && recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch (e) {
            console.warn('Recognition restart failed', e);
          }
        }
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [processCommand, isListening, toast]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      toast({ 
        variant: "destructive", 
        title: "Not Supported", 
        description: "Your browser does not support voice commands." 
      });
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      toast({ title: "Voice Control Off", description: "Mic is now disabled." });
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
        toast({ title: "Voice Control Active", description: "Try saying 'Scroll down' or 'Search SSC'." });
      } catch (e) {
        console.error('Failed to start recognition', e);
      }
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-3">
      {isListening && lastCommand && (
        <div className="bg-black/80 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 border border-white/10 flex items-center gap-2">
          <Command className="h-3 w-3 text-primary" />
          Recognized: "{lastCommand}"
        </div>
      )}
      
      <Button
        onClick={toggleListening}
        size="lg"
        className={cn(
          "h-14 w-14 rounded-full shadow-2xl transition-all duration-500 group relative",
          isListening 
            ? "bg-red-600 hover:bg-red-700 scale-110" 
            : "bg-primary hover:bg-primary/90"
        )}
      >
        {isListening ? (
          <>
            <Mic className="h-6 w-6 animate-pulse" />
            <span className="absolute -inset-1 rounded-full border-2 border-red-400 animate-ping opacity-20" />
          </>
        ) : (
          <MicOff className="h-6 w-6" />
        )}
        
        <div className="absolute right-full mr-4 top-1/2 -translate-y-1/2 bg-card border px-3 py-1.5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap text-xs font-bold shadow-xl">
          {isListening ? "Voice Commands Active" : "Enable Voice Control"}
        </div>
      </Button>
    </div>
  );
}
