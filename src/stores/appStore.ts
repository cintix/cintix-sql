import { create } from 'zustand';
import type { ConnectionProfile, QueryTab, ConnectionStatus } from '../types';
import { invoke } from '@tauri-apps/api/core';

export interface SchemaObject {
  name: string;
  type: 'table' | 'view' | 'function' | 'procedure' | 'trigger' | 'sequence';
  schema: string;
}

interface AppState {
  tabs: QueryTab[];
  activeTabId: string | null;
  profiles: ConnectionProfile[];
  activeProfileId: string | null;
  connectionStatus: ConnectionStatus;
  showProfileDialog: boolean;
  editingProfile: ConnectionProfile | null;
  theme: 'dark' | 'light';
  schemaObjects: SchemaObject[];
  schemaLoading: boolean;
  schemaError: string | null;
  expandedSections: Record<string, boolean>;
  contextMenu: { x: number; y: number; object: SchemaObject } | null;
  formatTrigger: number;

  loadProfiles: () => Promise<void>;
  addTab: () => void;
  closeTab: (id: string) => void;
  closeOthers: (id: string) => void;
  closeAll: () => void;
  setActiveTab: (id: string) => void;
  updateQuery: (tabId: string, query: string) => void;
  setTabResults: (tabId: string, results: any) => void;
  setTabError: (tabId: string, error: string) => void;
  setTabExecuting: (tabId: string, isExecuting: boolean) => void;
  setTabEditTable: (tabId: string, editTable: { schema: string; table: string } | undefined) => void;
  saveProfile: (profile: ConnectionProfile) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
  connect: (profile: ConnectionProfile) => Promise<void>;
  disconnect: () => Promise<void>;
  executeQuery: (tabId: string) => Promise<void>;
  executeStatement: (tabId: string, sql: string) => Promise<void>;
  openProfileDialog: (profile?: ConnectionProfile) => void;
  closeProfileDialog: () => void;
  toggleTheme: () => void;
  loadSchemaObjects: () => Promise<void>;
  toggleSection: (section: string) => void;
  showContextMenu: (x: number, y: number, object: SchemaObject) => void;
  hideContextMenu: () => void;
  getObjectScript: (object: SchemaObject) => Promise<string>;
  triggerFormat: () => void;
}

function nextTabNumber(tabs: QueryTab[]): number {
  const used = new Set(tabs.map(t => {
    const m = t.title.match(/^Query (\d+)$/);
    return m ? parseInt(m[1]) : 0;
  }));
  let n = 1;
  while (used.has(n)) n++;
  return n;
}

function newTab(tabs: QueryTab[]): QueryTab {
  const num = nextTabNumber(tabs);
  return {
    id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: `Query ${num}`,
    query: '',
    isExecuting: false,
  };
}

function getTheme(): 'dark' | 'light' {
  try {
    const saved = localStorage.getItem('cintix-theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch (_) {}
  return 'dark';
}

export const useAppStore = create<AppState>((set, get) => ({
  tabs: [newTab([])],
  activeTabId: null,
  profiles: [],
  activeProfileId: null,
  connectionStatus: 'disconnected',
  showProfileDialog: false,
  editingProfile: null,
  theme: getTheme(),
  schemaObjects: [],
  schemaLoading: false,
  schemaError: null,
  expandedSections: { tables: true, views: true, functions: false, procedures: false },
  contextMenu: null,
  formatTrigger: 0,

  triggerFormat: () => set((s) => ({ formatTrigger: s.formatTrigger + 1 })),

  loadProfiles: async () => {
    try {
      const profiles = await invoke<ConnectionProfile[]>('get_profiles');
      set({ profiles });
    } catch (e) {
      console.error('Failed to load profiles:', e);
    }
  },

  addTab: () => {
    set((s) => {
      const tab = newTab(s.tabs);
      return { tabs: [...s.tabs, tab], activeTabId: tab.id };
    });
  },

  closeTab: (id: string) => {
    set((s) => {
      const tabs = s.tabs.filter((t) => t.id !== id);
      if (tabs.length === 0) {
        const nt = newTab([]);
        return { tabs: [nt], activeTabId: nt.id };
      }
      const activeTabId = s.activeTabId === id ? tabs[0].id : s.activeTabId;
      return { tabs, activeTabId };
    });
  },

  closeOthers: (id: string) => {
    set((s) => {
      const tabs = s.tabs.filter((t) => t.id === id);
      return { tabs, activeTabId: id };
    });
  },

  closeAll: () => {
    const nt = newTab([]);
    set({ tabs: [nt], activeTabId: nt.id });
  },

  setActiveTab: (id: string) => set({ activeTabId: id }),

  updateQuery: (tabId: string, query: string) => {
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, query } : t)),
    }));
  },

  setTabResults: (tabId: string, results: any) => {
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === tabId ? { ...t, results, error: undefined } : t
      ),
    }));
  },

  setTabError: (tabId: string, error: string) => {
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === tabId ? { ...t, error, results: undefined } : t
      ),
    }));
  },

  setTabExecuting: (tabId: string, isExecuting: boolean) => {
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, isExecuting } : t)),
    }));
  },

  setTabEditTable: (tabId: string, editTable: { schema: string; table: string } | undefined) => {
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, editTable } : t)),
    }));
  },

  saveProfile: async (profile: ConnectionProfile) => {
    try {
      const profiles = await invoke<ConnectionProfile[]>('save_profile', { profile });
      set({ profiles, showProfileDialog: false, editingProfile: null });
    } catch (e) {
      console.error('Failed to save profile:', e);
    }
  },

  deleteProfile: async (id: string) => {
    try {
      const profiles = await invoke<ConnectionProfile[]>('delete_profile', { id });
      set({ profiles });
    } catch (e) {
      console.error('Failed to delete profile:', e);
    }
  },

  connect: async (profile: ConnectionProfile) => {
    set({ connectionStatus: 'connecting' });
    try {
      await invoke<string>('connect', { profile });
      set({ connectionStatus: 'connected', activeProfileId: profile.id });
      get().loadSchemaObjects();
    } catch (e: any) {
      set({ connectionStatus: 'error' });
      console.error('Connection failed:', e);
    }
  },

  disconnect: async () => {
    try {
      await invoke('disconnect');
    } catch (_) {}
    set({ connectionStatus: 'disconnected', activeProfileId: null, schemaObjects: [], schemaLoading: false, schemaError: null });
  },

  executeQuery: async (tabId: string) => {
    const { activeProfileId, connectionStatus } = get();
    if (connectionStatus !== 'connected' || !activeProfileId) return;

    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab || !tab.query.trim()) return;

    get().setTabExecuting(tabId, true);
    try {
      const results = await invoke<any>('execute_query', {
        profileId: activeProfileId,
        sql: tab.query,
      });
      get().setTabResults(tabId, results);
      get().setTabExecuting(tabId, false);
    } catch (e: any) {
      get().setTabError(tabId, typeof e === 'string' ? e : e.message || 'Unknown error');
      get().setTabExecuting(tabId, false);
    }
  },

  executeStatement: async (tabId: string, sql: string) => {
    const { activeProfileId, connectionStatus } = get();
    if (connectionStatus !== 'connected' || !activeProfileId) return;
    if (!sql.trim()) return;

    get().setTabExecuting(tabId, true);
    try {
      const results = await invoke<any>('execute_query', {
        profileId: activeProfileId,
        sql,
      });
      get().setTabResults(tabId, results);
      get().setTabExecuting(tabId, false);
    } catch (e: any) {
      get().setTabError(tabId, typeof e === 'string' ? e : e.message || 'Unknown error');
      get().setTabExecuting(tabId, false);
    }
  },

  openProfileDialog: (profile?: ConnectionProfile) => {
    set({ showProfileDialog: true, editingProfile: profile || null });
  },

  closeProfileDialog: () => {
    set({ showProfileDialog: false, editingProfile: null });
  },

  toggleTheme: () => {
    set((s) => {
      const theme = s.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('cintix-theme', theme);
      document.documentElement.setAttribute('data-theme', theme);
      return { theme };
    });
  },

  loadSchemaObjects: async () => {
    const { activeProfileId } = get();
    if (!activeProfileId) return;
    set({ schemaLoading: true, schemaError: null });
    try {
      const objects = await invoke<SchemaObject[]>('get_schema_objects', {
        profileId: activeProfileId,
      });
      set({ schemaObjects: objects, schemaLoading: false });
    } catch (e: any) {
      set({ schemaLoading: false, schemaObjects: [], schemaError: typeof e === 'string' ? e : e?.message || 'Unknown error' });
    }
  },

  toggleSection: (section: string) => {
    set((s) => ({
      expandedSections: {
        ...s.expandedSections,
        [section]: !s.expandedSections[section],
      },
    }));
  },

  showContextMenu: (x: number, y: number, object: SchemaObject) => {
    set({ contextMenu: { x, y, object } });
  },

  hideContextMenu: () => {
    set({ contextMenu: null });
  },

  getObjectScript: async (object: SchemaObject): Promise<string> => {
    const { activeProfileId } = get();
    if (!activeProfileId) return '';
    try {
      const result = await invoke<any>('get_object_script', {
        profileId: activeProfileId,
        objectType: object.type,
        objectName: object.name,
        schemaName: object.schema,
      });
      return result.script || '';
    } catch (e: any) {
      return `-- Error: ${e}`;
    }
  },
}));
