import { useAppStore } from '../stores/appStore';
import { DB_LABELS } from '../types';

export function Toolbar() {
  const {
    profiles, activeProfileId, connectionStatus, theme,
    activeTabId, tabs, connect, disconnect, executeQuery,
    toggleTheme,
  } = useAppStore();

  const activeProfile = profiles.find((p) => p.id === activeProfileId);
  const activeTab = tabs.find((t) => t.id === activeTabId);

  const handleConnect = async () => {
    if (connectionStatus === 'connected' || connectionStatus === 'connecting') {
      await disconnect();
    } else if (activeProfile) {
      await connect(activeProfile);
    }
  };

  const handleRun = () => {
    if (activeTabId && connectionStatus === 'connected') {
      executeQuery(activeTabId);
    }
  };

  const connLabel = connectionStatus === 'connected'
    ? 'Disconnect'
    : connectionStatus === 'connecting'
    ? 'Connecting...'
    : 'Connect';

  const connClass = connectionStatus === 'connected' ? 'btn-danger' : 'btn-primary';

  return (
    <div className="toolbar">
      <div className="toolbar-brand">
        <span className="cintix">Cintix</span>
        <span className="sql">SQL</span>
      </div>

      <div className="toolbar-actions">
        <select
          className="select"
          value={activeProfileId || ''}
          onChange={(e) => {
            const pid = e.target.value;
            const profile = profiles.find((p) => p.id === pid);
            if (profile) connect(profile);
          }}
        >
          <option value="">-- Select Profile --</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({DB_LABELS[p.type as keyof typeof DB_LABELS] || p.type})
            </option>
          ))}
        </select>

        <button
          className={`btn ${connClass}`}
          onClick={handleConnect}
          disabled={connectionStatus === 'connecting' || (!activeProfile && connectionStatus !== 'connected')}
        >
          {connLabel}
        </button>

        <button
          className="btn btn-success"
          onClick={handleRun}
          disabled={connectionStatus !== 'connected' || !activeTab || activeTab?.isExecuting}
        >
          {activeTab?.isExecuting ? 'Running...' : '▶ Run'}
        </button>
      </div>

      <div className="toolbar-spacer" />

      <div className="toolbar-actions">
        <button className="btn btn-sm" onClick={toggleTheme} title="Toggle theme">
          {theme === 'dark' ? '☀' : '🌙'}
        </button>
      </div>
    </div>
  );
}
