import { useState, useEffect, useRef } from 'react';
import { Track } from '../types';

declare const SC: any;

// Removed 'track' from type
type LoopMode = 'none' | 'queue';

export function useSoundCloudPlayer() {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  
  // Volume State
  const [volume, setVolumeState] = useState(() => {
    try { return Number(localStorage.getItem('sc:volume')) || 80; } catch { return 80; }
  });
  const prevVolumeRef = useRef<number>(80);
  
  const [loopMode, setLoopMode] = useState<LoopMode>('none');
  const [isShuffled, setIsShuffled] = useState(false);
  const [sleepTimer, setSleepTimer] = useState<number | null>(null);
  
  const [queue, setQueue] = useState<string[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const originalQueueRef = useRef<string[]>([]);

  const [history, setHistory] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('sc:history') || '[]'); } catch { return []; }
  });

  const widgetRef = useRef<any>(null);
  const sleepTimeoutRef = useRef<any>(null);
  const loopRef = useRef<LoopMode>('none');

  // Sync ref
  useEffect(() => { loopRef.current = loopMode; }, [loopMode]);

  // --- ACTIONS ---
  const setVolume = (v: number) => {
    setVolumeState(v);
    localStorage.setItem('sc:volume', String(v));
    if (widgetRef.current) widgetRef.current.setVolume(v);
  };

  const toggleMute = () => {
    if (volume > 0) {
      prevVolumeRef.current = volume;
      setVolume(0);
    } else {
      setVolume(prevVolumeRef.current || 80);
    }
  };

  // --- INIT ---
  useEffect(() => {
    if (!document.getElementById('sc-player')) {
      const frame = document.createElement('iframe');
      frame.id = 'sc-player';
      frame.style.display = 'none';
      frame.allow = 'autoplay'; 
      frame.src = 'https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/293&auto_play=false&show_artwork=true';
      document.body.appendChild(frame);

      frame.onload = () => {
        const widget = SC.Widget(frame);
        widgetRef.current = widget;
        setupListeners(widget);
      };
    }
  }, []);

  // Re-bind listeners
  useEffect(() => {
    if (widgetRef.current) setupListeners(widgetRef.current);
  }, [queue, queueIndex, loopMode, isShuffled, volume]);

  const setupListeners = (widget: any) => {
    widget.unbind(SC.Widget.Events.READY);
    widget.unbind(SC.Widget.Events.PLAY);
    widget.unbind(SC.Widget.Events.PAUSE);
    widget.unbind(SC.Widget.Events.PLAY_PROGRESS);
    widget.unbind(SC.Widget.Events.FINISH);

    widget.bind(SC.Widget.Events.READY, () => widget.setVolume(volume));
    widget.bind(SC.Widget.Events.PLAY, () => setIsPlaying(true));
    widget.bind(SC.Widget.Events.PAUSE, () => setIsPlaying(false));
    
    widget.bind(SC.Widget.Events.PLAY_PROGRESS, (e: any) => {
      setProgress(e.currentPosition);
      if(e.currentPosition > 0 && duration === 0) {
         widget.getDuration((d: number) => setDuration(d));
      }
    });
    
    // --- FINISH LOGIC ---
    widget.bind(SC.Widget.Events.FINISH, () => {
      if (queue.length > 0) {
        if (queueIndex < queue.length - 1) {
          // Normal next track
          playIndex(queueIndex + 1);
        } else if (loopRef.current === 'queue') {
          // Loop entire queue: go back to start
          playIndex(0);
        }
      }
    });
  };

  const loadTrack = (url: string, autoPlay = true, isLooping = false) => {
    if (!widgetRef.current) return;
    
    if (url && !history.includes(url) && !isLooping) {
      setHistory(prev => {
        const newHist = [url, ...prev.filter(u => u !== url)].slice(0, 20);
        localStorage.setItem('sc:history', JSON.stringify(newHist));
        return newHist;
      });
    }

    if (!isLooping) {
        setCurrentTrack(prev => ({ 
        ...(prev || { title: 'Loading...', artist: 'SoundCloud' }),
        url: url,
        permalink_url: url
        }));
    }

    widgetRef.current.load(url, {
      auto_play: autoPlay,
      show_artwork: true,
      callback: () => {
        widgetRef.current.setVolume(volume);
        widgetRef.current.getDuration((d: number) => setDuration(d));
        widgetRef.current.getCurrentSound((sound: any) => {
          if(sound) {
            setCurrentTrack({
              title: sound.title,
              artist: sound.user?.username || 'Unknown',
              art: sound.artwork_url?.replace('-large', '-t500x500'),
              url: sound.permalink_url,
              user: sound.user
            });
          }
        });
      }
    });
  };

  const playContext = (tracks: string[], startIndex: number = 0) => {
    setIsShuffled(false);
    originalQueueRef.current = []; 
    setQueue(tracks);
    setQueueIndex(startIndex);
    loadTrack(tracks[startIndex], true);
  };

  const playIndex = (idx: number) => {
    if (idx >= 0 && idx < queue.length) {
      setQueueIndex(idx);
      loadTrack(queue[idx], true);
    }
  };

  const handleNext = () => {
    if (queue.length > 0) {
      if (queueIndex < queue.length - 1) playIndex(queueIndex + 1);
      else if (loopMode === 'queue') playIndex(0);
    }
  };

  const handlePrev = () => {
    if (progress > 3000) { widgetRef.current.seekTo(0); return; }
    if (queue.length > 0) {
      if (queueIndex > 0) playIndex(queueIndex - 1);
      else if (loopMode === 'queue') playIndex(queue.length - 1);
    }
  };

  const toggleLoop = () => {
    // Toggle between 'none' and 'queue'
    setLoopMode(prev => (prev === 'none' ? 'queue' : 'none'));
  };

  const toggleShuffle = () => {
    if (queue.length <= 1) return;
    const newState = !isShuffled;
    setIsShuffled(newState);
    const currentUrl = queue[queueIndex];

    if (newState) {
      originalQueueRef.current = [...queue];
      const shuffled = [...queue];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      setQueue(shuffled);
      setQueueIndex(shuffled.indexOf(currentUrl));
    } else {
      if (originalQueueRef.current.length > 0) {
        setQueue(originalQueueRef.current);
        setQueueIndex(originalQueueRef.current.indexOf(currentUrl));
      }
    }
  };

  const startSleepTimer = (minutes: number) => {
    if (sleepTimeoutRef.current) clearTimeout(sleepTimeoutRef.current);
    if (minutes === 0) { setSleepTimer(null); return; }
    setSleepTimer(minutes);
    sleepTimeoutRef.current = setTimeout(() => {
      widgetRef.current?.pause();
      setIsPlaying(false);
      setSleepTimer(null);
    }, minutes * 60 * 1000);
  };

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!widgetRef.current) return;
      if (e.data.type === 'MEDIA_TOGGLE') widgetRef.current.toggle();
      if (e.data.type === 'MEDIA_NEXT') handleNext();
      if (e.data.type === 'MEDIA_PREV') handlePrev();
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [queue, queueIndex, loopMode]);

  return {
    currentTrack, isPlaying, progress, duration, volume, queue, queueIndex, loopMode, isShuffled, history, sleepTimer,
    actions: {
      play: () => widgetRef.current?.play(),
      pause: () => widgetRef.current?.pause(),
      next: handleNext,
      prev: handlePrev,
      seek: (ms: number) => widgetRef.current?.seekTo(ms),
      setVolume, toggleMute,
      playContext, loadTrack, toggleLoop, toggleShuffle, startSleepTimer
    },
    addToQueue: (url: string) => {
        if(isShuffled) originalQueueRef.current.push(url);
        setQueue(prev => [...prev, url]);
    }
  };
}