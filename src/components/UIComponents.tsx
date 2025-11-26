import React, { useState, useEffect, useRef } from 'react';
import { 
  Home, Heart, Disc, Search, Play, Pause, 
  User as UserIcon, List as ListIcon, 
  MoreHorizontal, Moon, Trash2, ExternalLink, ArrowRight,
  Maximize2, Minimize2, Settings, Palette, ChevronLeft, ChevronRight, X, Minus, Square,
  Volume2, VolumeX
  // Removed unused Music import
} from 'lucide-react';
import { Track, AppTab, User, AppSettings } from '../types';

// --- CUSTOM TITLEBAR ---
export const Titlebar: React.FC = () => (
  <div className="h-9 flex items-center justify-between px-4 bg-black drag-region shrink-0 border-b border-zinc-900">
    <div className="text-xs font-semibold text-zinc-500 select-none tracking-wide">CranCloud Player</div>
    <div className="flex items-center gap-2 no-drag">
      <button onClick={() => window.electronAPI.minimize()} className="p-1.5 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-white transition"><Minus size={14} /></button>
      <button onClick={() => window.electronAPI.maximize()} className="p-1.5 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-white transition"><Square size={12} /></button>
      <button onClick={() => window.electronAPI.close()} className="p-1.5 hover:bg-red-900/50 rounded-md text-zinc-400 hover:text-red-200 transition"><X size={14} /></button>
    </div>
  </div>
);

// --- SIDEBAR ---
export const Sidebar: React.FC<{
  activeTab: AppTab;
  onTabChange: (t: AppTab) => void;
  user: User | null;
  onLogin: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}> = ({ activeTab, onTabChange, user, onLogin, collapsed, onToggleCollapse }) => (
  <aside className={`${collapsed ? 'w-20' : 'w-64'} py-6 flex flex-col items-center gap-6 z-20 shrink-0 transition-all duration-300 bg-black`}>
    <div className="flex items-center gap-3 w-full px-4 justify-center">
      <img src="./icon.png" alt="Logo" className="w-10 h-10 object-contain drop-shadow-xl" />
      {!collapsed && <span className="font-bold text-xl tracking-tight text-white animate-in fade-in duration-300">CranCloud</span>}
    </div>

    <nav className="flex-1 flex flex-col gap-2 w-full px-3">
      <NavItem icon={Home} label="Home" active={activeTab === 'home'} collapsed={collapsed} onClick={() => onTabChange('home')} />
      <NavItem icon={Search} label="Search" active={activeTab === 'search'} collapsed={collapsed} onClick={() => onTabChange('search')} />
      
      <div className="h-px bg-zinc-900 w-full my-2"></div>
      
      <NavItem icon={Heart} label="Likes" active={activeTab === 'likes'} collapsed={collapsed} onClick={() => onTabChange('likes')} />
      <NavItem icon={ListIcon} label="Playlists" active={activeTab === 'playlists'} collapsed={collapsed} onClick={() => onTabChange('playlists')} />
      <NavItem icon={Disc} label="Albums" active={activeTab === 'albums'} collapsed={collapsed} onClick={() => onTabChange('albums')} />
    </nav>

    <div className="w-full px-3 flex flex-col gap-3">
      <button onClick={onToggleCollapse} className="w-full h-10 rounded-xl hover:bg-zinc-900 text-zinc-500 hover:text-white transition flex items-center justify-center">
        {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
      </button>
      
      <NavItem icon={Settings} label="Settings" active={activeTab === 'settings'} collapsed={collapsed} onClick={() => onTabChange('settings')} />

      <button 
        onClick={onLogin}
        className={`h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center hover:border-zinc-700 hover:bg-zinc-800 transition overflow-hidden ${collapsed ? 'w-12 justify-center' : 'w-full px-3 gap-3'}`}
        title={user ? user.username : 'Sign In'}
      >
        <div className="w-6 h-6 rounded-full overflow-hidden bg-zinc-800 shrink-0">
           {user ? <img src={user.avatar_url} className="w-full h-full object-cover" /> : <UserIcon size={14} className="text-zinc-500 m-1" />}
        </div>
        {!collapsed && <span className="text-sm font-medium text-zinc-300 truncate">{user ? user.username : 'Sign In'}</span>}
      </button>
    </div>
  </aside>
);

const NavItem = ({ icon: Icon, label, active, collapsed, onClick }: any) => (
  <button
    onClick={onClick}
    className={`h-12 rounded-xl flex items-center transition-all duration-200 group relative ${
      active 
        ? 'bg-sc text-white shadow-lg shadow-current/20' 
        : 'text-zinc-500 hover:text-white hover:bg-zinc-900'
    } ${collapsed ? 'w-12 justify-center' : 'w-full px-4 gap-4'}`}
    title={collapsed ? label : ''}
  >
    <Icon size={20} strokeWidth={active ? 2.5 : 2} className="shrink-0" />
    {!collapsed && <span className="text-sm font-medium truncate">{label}</span>}
  </button>
);

// --- ZEN MODE ---
export const ZenMode: React.FC<{ 
  track: Track | null; 
  isPlaying: boolean; 
  onClose: () => void;
  controls: React.ReactNode;
  volume: number;
  onSetVolume: (v: number) => void;
  onToggleMute: () => void;
}> = ({ track, isPlaying, onClose, controls, volume, onSetVolume, onToggleMute }) => {
  if (!track) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center animate-in fade-in duration-500 drag-region">
      <div className="absolute inset-0 z-0 opacity-40 overflow-hidden no-drag">
         <img src={track.art || ''} className="w-full h-full object-cover blur-[100px] scale-150 animate-pulse-slow" />
      </div>
      <div className="absolute inset-0 z-10 bg-black/20 backdrop-blur-sm no-drag"></div>

      <div className="relative z-20 flex flex-col items-center justify-center w-full h-full max-w-4xl px-8 no-drag">
         <button onClick={onClose} className="absolute top-8 right-8 p-3 rounded-full bg-black/20 hover:bg-white/20 text-white transition backdrop-blur-md z-30">
            <Minimize2 size={24} />
         </button>

         <div className={`w-72 h-72 md:w-96 md:h-96 rounded-4xl shadow-2xl mb-12 overflow-hidden border border-white/10 ${isPlaying ? 'scale-100' : 'scale-95 opacity-80'} transition-all duration-700 ease-out shrink-0`}>
            <Thumb url={track.art || track.url} className="w-full h-full object-cover" />
         </div>

         <div className="w-full flex flex-col items-center text-center mb-12">
            <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight drop-shadow-xl line-clamp-1 w-full px-4">{track.title}</h1>
            <p className="text-xl text-zinc-300 font-medium drop-shadow-md mt-2">{track.artist}</p>
         </div>

         <div className="w-full max-w-2xl bg-black/40 backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-2xl flex flex-col gap-6">
            {controls}
            <div className="flex items-center justify-center gap-3 w-full max-w-xs mx-auto">
               <button onClick={onToggleMute} className="text-zinc-400 hover:text-white transition">{volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>
               <div className="flex-1 h-1.5 bg-white/20 rounded-full relative group">
                  <input type="range" min="0" max="100" value={volume} onChange={(e) => onSetVolume(Number(e.target.value))} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                  <div className="absolute top-0 left-0 h-full bg-white rounded-full pointer-events-none" style={{ width: `${volume}%` }}></div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};

// --- SETTINGS VIEW ---
export const SettingsView: React.FC<{
  settings: AppSettings;
  onUpdateSettings: (s: Partial<AppSettings>) => void;
  onClearCache: () => void;
}> = ({ settings, onUpdateSettings, onClearCache }) => {
  const colors = [
    { name: 'Orange', hex: '#ff5500' },
    { name: 'Blue', hex: '#3b82f6' },
    { name: 'Purple', hex: '#8b5cf6' },
    { name: 'Pink', hex: '#ec4899' },
    { name: 'Green', hex: '#22c55e' },
    { name: 'Red', hex: '#ef4444' },
  ];

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h2 className="text-3xl font-bold text-white mb-8">Settings</h2>
      
      <div className="space-y-6">
        <section className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Palette className="text-sc" />
            <h3 className="text-xl font-semibold text-white">Appearance</h3>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
            {colors.map(c => (
              <button
                key={c.hex}
                onClick={() => onUpdateSettings({ accentColor: c.hex })}
                className={`h-12 rounded-xl border-2 transition flex items-center justify-center gap-2 ${settings.accentColor === c.hex ? 'border-white bg-zinc-800' : 'border-transparent bg-zinc-900 hover:bg-zinc-800'}`}
              >
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: c.hex }}></div>
              </button>
            ))}
          </div>
        </section>

        <section className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Trash2 className="text-red-500" />
            <h3 className="text-xl font-semibold text-white">Maintenance</h3>
          </div>
          <p className="text-zinc-400 text-sm mb-4">
            If images aren't loading or the player is acting buggy, clearing the cache usually fixes it. This will reload the app.
          </p>
          <button onClick={onClearCache} className="px-4 py-2 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl hover:bg-red-500 hover:text-white transition font-medium">
            Clear Cache & Restart
          </button>
        </section>
      </div>
    </div>
  );
};

// --- HEADER ---
export const Header: React.FC<{
  onSearch: (q: string) => void;
  currentSearch: string;
  onSearchInput: (val: string) => void;
  title?: string;
  onBack?: () => void;
}> = ({ onSearch, currentSearch, onSearchInput, title, onBack }) => (
  <header className="h-20 px-8 flex items-center justify-between shrink-0">
    <div className="flex items-center gap-4">
       {onBack && (
         <button onClick={onBack} className="p-2 -ml-2 hover:bg-zinc-800 rounded-full transition text-zinc-400 hover:text-white">
           <ArrowRight size={20} className="rotate-180" />
         </button>
       )}
       <h1 className="text-3xl font-bold tracking-tight text-white truncate max-w-md">{title || 'Library'}</h1>
    </div>
    <div className="relative group w-80">
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
        <Search size={18} className="text-zinc-500 group-focus-within:text-sc transition-colors" />
      </div>
      <input
        type="text"
        className="block w-full pl-12 pr-4 py-3 bg-zinc-900 border border-zinc-800 rounded-2xl leading-5 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all shadow-sm font-medium"
        placeholder="Search tracks..."
        value={currentSearch}
        onChange={(e) => onSearchInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onSearch(currentSearch)}
      />
    </div>
  </header>
);

// --- MENU POPUP ---
export const MoreMenu: React.FC<{ 
  onSleepTimer: (min: number) => void;
  onClearQueue: () => void; 
  onToggleZen: () => void;
  currentUrl?: string;
}> = ({ onSleepTimer, onClearQueue, onToggleZen, currentUrl }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const clickOut = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setIsOpen(false); };
    document.addEventListener('mousedown', clickOut);
    return () => document.removeEventListener('mousedown', clickOut);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button onClick={() => setIsOpen(!isOpen)} className="text-zinc-500 hover:text-white transition p-2"><MoreHorizontal size={20} /></button>
      {isOpen && (
        <div className="absolute bottom-12 right-0 w-56 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-2 z-50 flex flex-col gap-1 animate-in fade-in zoom-in-95">
          <button onClick={() => { onToggleZen(); setIsOpen(false); }} className="flex items-center gap-3 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 rounded-lg transition"><Maximize2 size={16} /> Zen Mode</button>
          <div className="h-px bg-zinc-800 my-1"></div>
          <div className="px-3 py-2 text-xs font-bold text-zinc-500 uppercase tracking-wider">Sleep Timer</div>
          <button onClick={() => { onSleepTimer(15); setIsOpen(false); }} className="flex items-center gap-3 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 rounded-lg transition"><Moon size={16} /> 15 Minutes</button>
          <button onClick={() => { onSleepTimer(30); setIsOpen(false); }} className="flex items-center gap-3 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 rounded-lg transition"><Moon size={16} /> 30 Minutes</button>
          <button onClick={() => { onSleepTimer(0); setIsOpen(false); }} className="flex items-center gap-3 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 rounded-lg transition"><Moon size={16} /> Turn Off</button>
          <div className="h-px bg-zinc-800 my-1"></div>
          {currentUrl && (
             <button onClick={() => { window.electronAPI?.openExternal(currentUrl); setIsOpen(false); }} className="flex items-center gap-3 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 rounded-lg transition"><ExternalLink size={16} /> Browser</button>
          )}
          <button onClick={() => { onClearQueue(); setIsOpen(false); }} className="flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:bg-red-900/20 rounded-lg transition"><Trash2 size={16} /> Clear Queue</button>
        </div>
      )}
    </div>
  );
};

// --- WIDGETS ---
export const NoteWidget: React.FC<{ onSearch: (q: string) => void }> = ({ onSearch }) => {
  const [val, setVal] = useState('');
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-[32px] p-8 flex flex-col relative overflow-hidden group hover:border-zinc-700 transition h-full">
       <div className="absolute top-6 left-6 flex items-center gap-2 text-zinc-500 text-xs font-bold tracking-widest uppercase group-hover:text-sc transition-colors">
          <span className="w-2 h-2 rounded-full bg-current"></span> Quick Play
       </div>
       <div className="mt-8">
         <input className="w-full bg-transparent text-2xl font-medium text-zinc-300 placeholder-zinc-600 outline-none h-12" placeholder="Play a song..." value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onSearch(val)} />
       </div>
    </div>
  );
};

export const QueueWidget: React.FC<{ queue: string[], currentIndex: number, onPlay: (url: string) => void }> = ({ queue, currentIndex, onPlay }) => {
  const upcoming = queue.slice(currentIndex + 1, currentIndex + 50);
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-[32px] p-6 flex flex-col relative overflow-hidden hover:border-zinc-700 transition h-full">
        <div className="flex items-center justify-between mb-6 shrink-0">
           <div className="flex items-center gap-2 text-zinc-500 text-xs font-bold tracking-widest uppercase"><span className="w-2 h-2 rounded-full bg-orange-500"></span> Up Next</div>
        </div>
        <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
           {upcoming.length === 0 ? <div className="h-full flex items-center justify-center text-zinc-600 text-sm">Queue is empty</div> : upcoming.map((url, i) => {
              const name = decodeURIComponent(url.split('/').pop() || 'Unknown').replace(/-/g, ' ');
              return (
                <div key={i} onClick={() => onPlay(url)} className="flex items-center gap-3 p-3 rounded-xl bg-zinc-950/50 hover:bg-zinc-800 cursor-pointer transition group">
                   <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500 text-[10px] font-mono group-hover:text-white group-hover:bg-sc transition-colors shrink-0">{i + 1}</div>
                   <div className="flex-1 truncate text-sm font-medium text-zinc-400 group-hover:text-white">{name}</div>
                </div>
              );
           })}
        </div>
    </div>
  );
};

// --- TRACK LIST ---
export const TrackList: React.FC<{ 
  tracks?: string[]; items?: Track[]; activeTrack?: string; isPlaying: boolean; 
  onPlay: (url: string) => void; onQueue: (url: string) => void; 
}> = ({ tracks, items, activeTrack, isPlaying, onPlay, onQueue }) => {
  const list = items || (tracks || []).map(url => {
    try { const parts = new URL(url).pathname.split('/').filter(Boolean); return { url, permalink_url: url, title: decodeURIComponent(parts[parts.length - 1]).replace(/[-_]/g, ' '), artist: decodeURIComponent(parts[0]).replace(/[-_]/g, ' ') } as Track; } catch { return { title: 'Unknown', artist: 'Unknown', url } as Track; }
  });
  return (
    <div className="flex flex-col gap-2">
      {list.map((track, i) => {
        const trackUrl = track.permalink_url || track.url || '';
        const isActive = activeTrack === trackUrl;
        return (
          <div key={i} className={`group flex items-center gap-4 p-3 rounded-2xl cursor-pointer transition-all border ${isActive ? 'bg-zinc-800/80 border-zinc-700 shadow-lg' : 'bg-transparent border-transparent hover:bg-zinc-900 hover:border-zinc-800'}`} onClick={() => onPlay(trackUrl)}>
            <div className="w-12 h-12 rounded-xl bg-zinc-800 overflow-hidden relative flex-shrink-0 shadow-sm">
               <Thumb url={track.art || trackUrl} />
               <div className={`absolute inset-0 bg-black/40 flex items-center justify-center ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>{isActive && isPlaying ? <Pause size={18} className="text-white fill-current" /> : <Play size={18} className="text-white fill-current" />}</div>
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
              <div className={`text-sm font-semibold truncate ${isActive ? 'text-sc' : 'text-zinc-200'}`}>{track.title}</div>
              <div className="text-xs text-zinc-500 truncate font-medium">{track.artist}</div>
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity px-2"><button onClick={(e) => { e.stopPropagation(); onQueue(trackUrl); }} className="p-2 hover:bg-zinc-700 rounded-full text-zinc-400 hover:text-white transition"><ListIcon size={18} /></button></div>
          </div>
        );
      })}
    </div>
  );
};

// --- GRID VIEW ---
export const GridView: React.FC<{ items: string[]; onPlay: (url: string) => void; }> = ({ items, onPlay }) => {
  if (!items.length) return <div className="text-zinc-500 italic p-4">No items found.</div>;
  return (
    <div className="flex flex-wrap gap-4 p-1">
      {items.map((url, i) => (
        <div key={i} className="w-36 group cursor-pointer bg-zinc-900 border border-zinc-800 p-3 rounded-3xl hover:border-zinc-700 transition-all hover:-translate-y-1 hover:shadow-xl shrink-0" onClick={() => onPlay(url)}>
          <div className="w-28 h-28 rounded-2xl overflow-hidden mb-3 relative shadow-inner mx-auto">
             <Thumb url={url} className="w-full h-full object-cover transition duration-700 group-hover:scale-110" />
             <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors"></div>
             <div className="absolute bottom-3 right-3 w-10 h-10 bg-sc text-white rounded-full flex items-center justify-center shadow-lg translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300"><Play size={20} className="fill-current ml-1" /></div>
          </div>
          <div className="text-sm font-bold text-zinc-200 truncate px-1">{decodeURIComponent(url.split('/').pop() || '').replace(/-/g, ' ')}</div>
        </div>
      ))}
    </div>
  );
};

export const ImportOverlay: React.FC<{ status: { msg: string, progress: number } }> = ({ status }) => (
  <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
    <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-[32px] p-8 shadow-2xl flex flex-col items-center">
      <h3 className="text-2xl font-bold text-white mb-2">Syncing Library</h3>
      <p className="text-zinc-400 text-sm mb-6 text-center">{status.msg}</p>
      <div className="w-full h-3 bg-zinc-950 rounded-full overflow-hidden mb-3 border border-zinc-800"><div className="h-full bg-sc transition-all duration-300 ease-out relative" style={{ width: `${status.progress}%` }}></div></div>
    </div>
  </div>
);

export const Thumb: React.FC<{ url?: string; className?: string }> = ({ url, className }) => {
  const [src, setSrc] = useState<string>('');
  useEffect(() => {
    if (!url) return;
    if(url.match(/\.(jpeg|jpg|gif|png)$/) != null) { setSrc(url.replace('-large', '-t500x500')); return; }
    const cached = localStorage.getItem(`thumb:${url}`);
    if (cached) { setSrc(cached); return; }
    fetch(`https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url)}`).then(r => r.json()).then(d => {
      if (d.thumbnail_url) { const hr = d.thumbnail_url.replace('-large', '-t500x500'); setSrc(hr); try { localStorage.setItem(`thumb:${url}`, hr); } catch {} }
    }).catch(() => {});
  }, [url]);
  if (!src) return <div className={`bg-zinc-800 flex items-center justify-center ${className || 'w-full h-full'}`}><Disc size={24} className="text-zinc-700" /></div>;
  return <img src={src} className={className || 'w-full h-full object-cover'} alt="Art" />;
};