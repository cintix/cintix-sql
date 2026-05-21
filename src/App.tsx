import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { Toolbar } from './components/Toolbar';
import { Sidebar } from './components/Sidebar';
import { TabBar } from './components/TabBar';
import { EditorPanel } from './components/EditorPanel';
import { ResultPanel } from './components/ResultPanel';
import { StatusBar } from './components/StatusBar';
import { ConnectionDialog } from './components/ConnectionDialog';
import { useAppStore } from './stores/appStore';

export default function App() {
  const loadProfiles = useAppStore((s) => s.loadProfiles);
  const theme = useAppStore((s) => s.theme);
  const [sidebarWidth, setSidebarWidth] = useState(220);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  useEffect(() => {
    const unlisten = listen<string>('menu-event', (event) => {
      const store = useAppStore.getState();
      const id = event.payload;

      switch (id) {
        case 'new_query':
          store.addTab();
          break;
        case 'open_file': {
          import('@tauri-apps/plugin-dialog').then(({ open }) => {
            import('@tauri-apps/api/core').then(({ invoke }) => {
              open({ multiple: false, filters: [{ name: 'SQL Files', extensions: ['sql'] }] }).then((path) => {
                if (path) {
                  invoke<string>('read_file', { path }).then((content) => {
                    store.addTab();
                    setTimeout(() => {
                      const s = useAppStore.getState();
                      const lastTab = s.tabs[s.tabs.length - 1];
                      if (lastTab) s.updateQuery(lastTab.id, content);
                    }, 0);
                  }).catch(() => {});
                }
              });
            });
          });
          break;
        }
        case 'save_file': {
          const tab = store.tabs.find((t) => t.id === store.activeTabId);
          if (!tab) break;
          import('@tauri-apps/plugin-dialog').then(({ save }) => {
            import('@tauri-apps/api/core').then(({ invoke }) => {
              save({ filters: [{ name: 'SQL Files', extensions: ['sql'] }] }).then((path) => {
                if (path) invoke('write_file', { path, content: tab.query }).catch(() => {});
              });
            });
          });
          break;
        }
        case 'export_results': {
          const tab = store.tabs.find((t) => t.id === store.activeTabId);
          if (!tab?.results?.columns?.length) break;
          const cols = tab.results.columns;
          const rows = tab.results.rows as unknown[][];
          const lines: string[] = [];
          for (const row of rows) {
            const vals = row.map((c: unknown) => {
              if (c === null || c === undefined) return 'NULL';
              const s = String(c);
              return `'${s.replace(/'/g, "''")}'`;
            });
            lines.push(`INSERT INTO table_name (${cols.map(c => `"${c}"`).join(', ')}) VALUES (${vals.join(', ')});`);
          }
          const sql = lines.join('\n') + '\n';
          import('@tauri-apps/plugin-dialog').then(({ save }) => {
            import('@tauri-apps/api/core').then(({ invoke }) => {
              save({ filters: [{ name: 'SQL Files', extensions: ['sql'] }] }).then((path) => {
                if (path) invoke('write_file', { path, content: sql }).catch(() => {});
              });
            });
          });
          break;
        }
        case 'exit':
          import('@tauri-apps/api/window').then(({ getCurrentWindow }) => getCurrentWindow().close());
          break;
        case 'execute':
          if (store.activeTabId) store.executeQuery(store.activeTabId);
          break;
        case 'format_sql':
          store.triggerFormat();
          break;
        case 'toggle_theme':
          store.toggleTheme();
          break;
        case 'light_mode':
          if (store.theme !== 'light') store.toggleTheme();
          break;
        case 'dark_mode':
          if (store.theme !== 'dark') store.toggleTheme();
          break;
      }
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 't') {
        e.preventDefault();
        useAppStore.getState().addTab();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      unlisten.then((fn) => fn());
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleSidebarResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;
    const handleMouseMove = (ev: MouseEvent) => {
      setSidebarWidth(Math.max(160, Math.min(500, startWidth + (ev.clientX - startX))));
    };
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className="app-container">
      <Toolbar />
      <div className="main-content">
        <div style={{ width: sidebarWidth, minWidth: sidebarWidth, flexShrink: 0 }}>
          <Sidebar />
        </div>
        <div
          onMouseDown={handleSidebarResize}
          style={{
            width: 4, cursor: 'col-resize', background: 'var(--border-color)',
            flexShrink: 0, transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-blue)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--border-color)'; }}
        />
        <div className="content-area">
          <TabBar />
          <EditorPanel />
          <ResultPanel />
        </div>
      </div>
      <StatusBar />
      <ConnectionDialog />
    </div>
  );
}
