export interface Track {
  url?: string;
  permalink_url?: string;
  title: string;
  artist: string;
  art?: string;
  user?: { username: string; avatar_url?: string };
}

export interface Playlist {
  title: string;
  url: string;
  tracks: string[];
}

export interface User {
  username: string;
  avatar_url: string;
}

export type AppTab = 'home' | 'search' | 'likes' | 'playlists' | 'albums' | 'settings';

export interface AppSettings {
  accentColor: string;
  sidebarCollapsed: boolean;
}