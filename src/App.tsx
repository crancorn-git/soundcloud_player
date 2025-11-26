import React, { useState, useEffect } from 'react';
import { 
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, 
  RefreshCw, Heart, Repeat, Shuffle, Clock
} from 'lucide-react';
import { 
  Sidebar, TrackList, GridView, Header, ImportOverlay,
  NoteWidget, QueueWidget, Thumb, MoreMenu, ZenMode, SettingsView, Titlebar
} from './components/UIComponents';
import { useSoundCloudPlayer } from './hooks/usePlayer';
import { Track, Playlist, AppTab, AppSettings } from './types';

declare global {
  interface Window {
    electronAPI: any;
    importer: any;
    app: any;
  }
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [library, setLibrary] = useState<{ likes: string[]; playlists: Playlist[]; albums: Playlist[]; }>({ likes: [], playlists: [], albums: [] });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [viewPlaylist, setViewPlaylist] = useState<Playlist | null>(null);
  
  const [settings, setSettings] = useState<AppSettings>({ accentColor: '#ff5500', sidebarCollapsed: false });
  const [zenMode, setZenMode] = useState(false);

  const [importStatus, setImportStatus] = useState<{ importing: boolean, progress: number, msg: string }>({ importing: false, progress: 0, msg: '' });
  const [user, setUser] = useState<{ username: string, avatar_url: string } | null>(null);
  const [isDraggingSeek, setIsDraggingSeek] = useState(false);
  const [dragProgress, setDragProgress] = useState(0);

  const {
    currentTrack, isPlaying, progress, duration, volume, queue, queueIndex, loopMode, isShuffled, history, sleepTimer,
    actions: { play, pause, next, prev, seek, setVolume: setPlayerVolume, toggleMute, playContext, loadTrack, toggleLoop, toggleShuffle, startSleepTimer },
    addToQueue
  } = useSoundCloudPlayer();

  useEffect(() => {
    const loadLS = (k: string, def: any) => { try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(def)); } catch { return def; } };
    setLibrary({ likes: loadLS('sc:likesQueue', []), playlists: loadLS('sc:playlists', []), albums: loadLS('sc:albums', []) });
    setSettings(loadLS('sc:settings', { accentColor: '#ff5500', sidebarCollapsed: false }));
    const checkUser = async () => { if (window.electronAPI) { const s = await window.electronAPI.accountStatus(); if (s?.loggedIn) setUser(s.user); } };
    checkUser();
  }, []);

  useEffect(() => {
    localStorage.setItem('sc:settings', JSON.stringify(settings));
    document.documentElement.style.setProperty('--accent-color', settings.accentColor);
  }, [settings]);

  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      .text-sc { color: var(--accent-color) !important; }
      .bg-sc { background-color: var(--accent-color) !important; }
      .border-sc { border-color: var(--accent-color) !important; }
      .shadow-sc { --tw-shadow-color: var(--accent-color); }
      input[type=range]::-webkit-slider-thumb { background: #fff !important; } 
      input[type=range]::-webkit-slider-thumb:hover { background: var(--accent-color) !important; }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  useEffect(() => {
    if (!window.importer) return;
    window.importer.onStatus((msg: string) => setImportStatus(p => ({ ...p, importing: true, msg })));
    window.importer.onProgress((pct: number) => setImportStatus(p => ({ ...p, importing: true, progress: pct })));
    window.importer.onDone(() => {
      setImportStatus({ importing: false, progress: 100, msg: 'Done' });
      setTimeout(() => {
        const likes = JSON.parse(localStorage.getItem('sc:likesQueue') || '[]');
        const playlists = JSON.parse(localStorage.getItem('sc:playlists') || '[]');
        const albums = JSON.parse(localStorage.getItem('sc:albums') || '[]');
        setLibrary({ likes, playlists, albums });
      }, 500);
    });
    window.importer.onError((_err: string) => { setImportStatus({ importing: false, progress: 0, msg: '' }); });
  }, []);

  useEffect(() => {
    const handleMerge = (e: MessageEvent) => {
      if (e.data?.type === 'LIBRARY_MERGE') {
        setLibrary(prev => {
          const nextState = { ...prev };
          if (e.data.likes) { nextState.likes = Array.from(new Set([...prev.likes, ...e.data.likes])); localStorage.setItem('sc:likesQueue', JSON.stringify(nextState.likes)); }
          if (e.data.playlists) { nextState.playlists = e.data.playlists; localStorage.setItem('sc:playlists', JSON.stringify(nextState.playlists)); }
          if (e.data.albums) { nextState.albums = e.data.albums; localStorage.setItem('sc:albums', JSON.stringify(nextState.albums)); }
          return nextState;
        });
      }
    };
    window.addEventListener('message', handleMerge);
    return () => window.removeEventListener('message', handleMerge);
  }, []);

  const handleGlobalSearch = async (q: string) => {
    if (!q.trim()) return;
    setIsSearching(true); setActiveTab('search'); setViewPlaylist(null); setSearchQuery(q); 
    try { const res = await window.electronAPI.searchTracks(q); setSearchResults(res || []); } catch (e) { console.error(e); } finally { setIsSearching(false); }
  };
  const handleSync = async () => { if (window.electronAPI) await window.electronAPI.importAll(); };
  const handleLogin = async () => {
    if (user) { if (confirm('Log out?')) { await window.electronAPI.accountLogout(); setUser(null); } }
    else { const ok = await window.electronAPI.accountLogin(); if (ok) { const s = await window.electronAPI.accountStatus(); setUser(s.user); } }
  };
  const handleClearCache = () => {
    if(confirm('This will clear all cached images and history. Continue?')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const renderControls = () => (
    <div className="flex flex-col items-center w-full">
       <div className="flex items-center gap-6 mb-1">
          <button onClick={toggleShuffle} className={`transition ${isShuffled ? 'text-sc' : 'text-zinc-500 hover:text-white'}`} title="Shuffle"><Shuffle size={18} /></button>
          <button onClick={prev} className="text-zinc-400 hover:text-white transition"><SkipBack size={20} fill="currentColor" /></button>
          <button onClick={isPlaying ? pause : play} className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition active:scale-95 shadow-lg shadow-white/10">{isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}</button>
          <button onClick={next} className="text-zinc-400 hover:text-white transition"><SkipForward size={20} fill="currentColor" /></button>
          <button onClick={toggleLoop} className={`transition ${loopMode !== 'none' ? 'text-sc' : 'text-zinc-500 hover:text-white'}`} title={`Loop: ${loopMode}`}>
              <Repeat size={18} />
          </button>
       </div>
       <div className="w-full max-w-xs flex items-center gap-3 text-[10px] font-mono text-zinc-500 font-bold">
          <span>{formatTime(isDraggingSeek ? dragProgress : progress)}</span>
          <div className="flex-1 h-1.5 bg-zinc-800 rounded-full relative group">
             <input type="range" min="0" max={duration} value={isDraggingSeek ? dragProgress : progress} onMouseDown={() => setIsDraggingSeek(true)} onMouseUp={(e) => { setIsDraggingSeek(false); seek(Number(e.currentTarget.value)); }} onChange={(e) => setDragProgress(Number(e.target.value))} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
             <div className="absolute top-0 left-0 h-full bg-sc rounded-full pointer-events-none" style={{ width: `${((isDraggingSeek ? dragProgress : progress) / (duration || 1)) * 100}%` }}></div>
          </div>
          <span>{formatTime(duration)}</span>
       </div>
    </div>
  );

  const renderContent = () => {
    if (activeTab === 'settings') {
      return <SettingsView settings={settings} onUpdateSettings={(s) => setSettings(prev => ({ ...prev, ...s }))} onClearCache={handleClearCache} />;
    }

    if (viewPlaylist) {
      return (
        <div className="pb-24">
          <div className="flex items-center gap-6 mb-8 p-6 bg-zinc-900/50 rounded-[32px] border border-zinc-800/50">
             <div className="w-40 h-40 rounded-2xl overflow-hidden shadow-2xl shrink-0 bg-zinc-800"><Thumb url={viewPlaylist.tracks[0]} className="w-full h-full object-cover" /></div>
             <div className="flex flex-col gap-2">
                <h2 className="text-3xl font-bold text-white">{viewPlaylist.title}</h2>
                <p className="text-zinc-400">{viewPlaylist.tracks.length} tracks</p>
                <button onClick={() => playContext(viewPlaylist.tracks, 0)} className="mt-2 px-6 py-3 bg-sc text-white rounded-full font-bold hover:brightness-110 transition w-max flex items-center gap-2"><Play size={18} fill="currentColor" /> Play All</button>
             </div>
          </div>
          <TrackList tracks={viewPlaylist.tracks} activeTrack={currentTrack?.permalink_url} isPlaying={isPlaying} onPlay={(url) => playContext(viewPlaylist.tracks, viewPlaylist.tracks.indexOf(url))} onQueue={(url) => addToQueue(url)} />
        </div>
      );
    }

    switch (activeTab) {
      case 'home':
        return (
          <div className="flex flex-col gap-6 pb-24 h-full">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-64 shrink-0">
               <div className="h-full"><NoteWidget onSearch={handleGlobalSearch} /></div>
               <div className="h-full bg-zinc-900/50 rounded-[32px] overflow-hidden border border-zinc-800/50"><QueueWidget queue={queue} currentIndex={queueIndex} onPlay={(url) => loadTrack(url, true)} /></div>
            </div>
            
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-[32px] p-6 min-h-[300px] shrink-0 hover:border-zinc-700/50 transition duration-300 flex flex-col">
                <div className="flex items-center justify-between mb-4 shrink-0">
                  <h3 className="text-lg font-bold flex items-center gap-2 text-white"><Heart size={18} className="text-sc" /> Jump Back In</h3>
                  <button onClick={handleSync} className="p-2 hover:bg-zinc-800 rounded-full transition" title="Sync Library"><RefreshCw size={16} className={importStatus.importing ? 'animate-spin' : ''} /></button>
                </div>
                <div className="overflow-y-auto flex-1 pr-2 custom-scrollbar">
                  <GridView items={library.likes.slice(0, 20)} onPlay={(url) => playContext(library.likes, library.likes.indexOf(url))} />
                </div>
            </div>
               
            {history.length > 0 && (
                 <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-[32px] p-6 min-h-[300px] shrink-0 hover:border-zinc-700/50 transition duration-300 flex flex-col">
                    <div className="flex items-center gap-2 mb-4 shrink-0"><Clock size={18} className="text-zinc-500" /><h3 className="text-lg font-bold text-white">Recently Played</h3></div>
                    <div className="overflow-y-auto flex-1 pr-2 custom-scrollbar">
                        <GridView items={history} onPlay={(url) => playContext(history, history.indexOf(url))} />
                    </div>
                 </div>
            )}
          </div>
        );
      case 'likes': return <div className="pb-24"><TrackList tracks={library.likes.filter(u => u.toLowerCase().includes(searchQuery.toLowerCase()))} activeTrack={currentTrack?.permalink_url} isPlaying={isPlaying} onPlay={(url) => playContext(library.likes, library.likes.indexOf(url))} onQueue={(url) => addToQueue(url)} /></div>;
      case 'playlists':
      case 'albums':
        const collection = activeTab === 'playlists' ? library.playlists : library.albums;
        return (
          <div className="pb-24 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {collection.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase())).map((p, i) => (
              <div key={i} onClick={() => setViewPlaylist(p)} className="bg-zinc-900 border border-zinc-800 rounded-[32px] p-5 hover:border-zinc-700 transition group flex flex-col h-64 cursor-pointer">
                <div className="flex items-start justify-between mb-4">
                   <div className="w-16 h-16 bg-zinc-800 rounded-2xl overflow-hidden shadow-lg"><Thumb url={p.tracks[0]} className="w-full h-full object-cover" /></div>
                   <button onClick={(e) => { e.stopPropagation(); playContext(p.tracks, 0); }} className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-lg hover:scale-110"><Play size={20} fill="currentColor" className="ml-0.5" /></button>
                </div>
                <h3 className="font-bold text-xl truncate mb-1">{p.title}</h3>
                <p className="text-sm text-zinc-500 mb-4">{p.tracks.length} tracks</p>
                <div className="mt-auto space-y-1">{p.tracks.slice(0, 2).map((t, idx) => { const title = decodeURIComponent(t.split('/').pop()||'').replace(/-/g, ' '); return <div key={idx} className="text-xs text-zinc-400 truncate">{title}</div> })}</div>
              </div>
            ))}
          </div>
        );
      case 'search':
        return (
          <div className="pb-24">
            <h2 className="text-xl font-medium mb-6 text-zinc-400">Search Results for <span className="text-white">"{searchQuery}"</span></h2>
            {isSearching ? <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sc"></div></div> : 
              <TrackList items={searchResults} activeTrack={currentTrack?.permalink_url} isPlaying={isPlaying} onPlay={(url) => { const urls = searchResults.map(t => t.url || t.permalink_url || ''); playContext(urls, searchResults.findIndex(t => t.url === url || t.permalink_url === url)); }} onQueue={(url) => addToQueue(url)} />
            }
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen w-screen bg-black p-1 gap-4 select-none drag-region overflow-hidden">
      <div className="flex flex-col h-full w-full bg-black relative">
        <Titlebar /> 
        <div className="flex flex-1 gap-4 p-4 pt-0 overflow-hidden h-full">
          <Sidebar 
            activeTab={activeTab} 
            onTabChange={(t) => { setActiveTab(t); setViewPlaylist(null); }} 
            user={user} 
            onLogin={handleLogin}
            collapsed={settings.sidebarCollapsed}
            onToggleCollapse={() => setSettings(s => ({...s, sidebarCollapsed: !s.sidebarCollapsed}))}
          />
          
          <main className="flex-1 bg-zinc-950 rounded-[40px] border border-zinc-900 overflow-hidden flex flex-col relative shadow-2xl min-w-0">
            <Header onSearch={handleGlobalSearch} currentSearch={searchQuery} onSearchInput={setSearchQuery} title={viewPlaylist ? viewPlaylist.title : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} onBack={viewPlaylist ? () => setViewPlaylist(null) : undefined} />
            <div className="flex-1 overflow-y-auto px-8 pt-2 scroll-smooth">{renderContent()}</div>
            
            <div className="absolute bottom-0 left-0 right-0 z-30 border-t border-zinc-900 bg-black/95 backdrop-blur-xl">
               <div className="h-20 flex items-center px-6 relative group/bar pointer-events-auto">
                  {sleepTimer && <div className="absolute -top-8 right-4 bg-zinc-800 text-zinc-400 text-xs px-3 py-1 rounded-full flex items-center gap-2"><Clock size={12} /> Sleep in {sleepTimer}m</div>}

                  <div className="flex items-center gap-4 w-1/3 min-w-[200px]">
                    <div className={`w-12 h-12 rounded-xl bg-zinc-800 overflow-hidden shadow-md ${isPlaying ? 'animate-pulse-slow' : ''}`}>{currentTrack?.art && <img src={currentTrack.art} className="w-full h-full object-cover" />}</div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <div className="font-bold text-sm truncate text-white">{currentTrack?.title || 'Not Playing'}</div>
                        <div className="text-xs text-zinc-500 truncate font-medium">{currentTrack?.user?.username || 'Select a track'}</div>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col items-center justify-center">
                    {renderControls()}
                  </div>

                  <div className="w-1/3 flex items-center justify-end gap-3">
                    <MoreMenu onSleepTimer={startSleepTimer} onClearQueue={() => playContext([], 0)} currentUrl={currentTrack?.permalink_url} onToggleZen={() => setZenMode(true)} />
                    <button onClick={() => toggleMute()} className="text-zinc-500 hover:text-white transition">{volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>
                    <div className="w-24 h-1.5 bg-zinc-800 rounded-full relative group">
                        <input type="range" min="0" max="100" value={volume} onChange={(e) => setPlayerVolume(Number(e.target.value))} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                        <div className="absolute top-0 left-0 h-full bg-white rounded-full pointer-events-none" style={{ width: `${volume}%` }}></div>
                    </div>
                  </div>
               </div>
            </div>
          </main>
        </div>
      </div>
      
      {zenMode && <ZenMode track={currentTrack} isPlaying={isPlaying} onClose={() => setZenMode(false)} controls={renderControls()} volume={volume} onSetVolume={setPlayerVolume} onToggleMute={toggleMute} />}
      {importStatus.importing && <ImportOverlay status={importStatus} />}
    </div>
  );
};

const formatTime = (ms: number) => {
  if (!ms) return '0:00';
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
};

export default App;