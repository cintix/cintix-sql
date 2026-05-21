import { useAppStore } from '../stores/appStore';
import { DB_LABELS } from '../types';
import type { ConnectionProfile } from '../types';
import { DatabaseExplorer } from './DatabaseExplorer';

function ProfileIcon({ type }: { type: string }) {
  const cls = type === 'postgresql' ? 'pg' : type === 'mysql' ? 'mysql' : 'mssql';
  const letter = type === 'postgresql' ? 'PG' : type === 'mysql' ? 'MY' : 'MS';
  return <div className={`profile-icon ${cls}`}>{letter}</div>;
}

export function Sidebar() {
  const {
    profiles, activeProfileId, connectionStatus,
    connect, disconnect, deleteProfile, openProfileDialog,
    schemaObjects, schemaLoading, schemaError,
  } = useAppStore();

  const handleConnect = async (profile: ConnectionProfile) => {
    if (activeProfileId === profile.id && connectionStatus === 'connected') return;
    await connect(profile);
  };

  const isConnected = connectionStatus === 'connected' && activeProfileId;

  return (
    <div className="sidebar">
      {isConnected ? (
        <>
          <div className="sidebar-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--accent-green)', fontSize: 8 }}>●</span>
              Database Explorer
            </div>
            <button
              onClick={disconnect}
              style={{
                marginLeft: 'auto', background: 'none', border: 'none',
                color: 'var(--accent-red)', cursor: 'pointer', fontSize: 11,
                padding: '2px 6px', borderRadius: 4,
              }}
            >
              Disconnect
            </button>
          </div>
          <div className="sidebar-list">
            {schemaLoading ? (
              <div style={{ padding: '20px 14px', color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>
                Loading schema...
              </div>
            ) : schemaError ? (
              <div style={{ padding: '20px 14px', color: 'var(--accent-red)', fontSize: 12, textAlign: 'center' }}>
                Schema load failed:<br/>
                <span style={{ fontSize: 11, wordBreak: 'break-all' }}>{schemaError}</span>
                <br/><br/>
                <button className="btn btn-sm" onClick={() => useAppStore.getState().loadSchemaObjects()}>Retry</button>
              </div>
            ) : schemaObjects.length === 0 ? (
              <div style={{ padding: '20px 14px', color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>
                No tables, views or functions found.<br/>
                <span style={{ fontSize: 11 }}>Create some objects or run a query.</span>
              </div>
            ) : (
              <DatabaseExplorer />
            )}
          </div>
          <div className="sidebar-footer" style={{ display: 'flex', gap: 4 }}>
            <button className="btn btn-sm" style={{ flex: 1 }} onClick={() => openProfileDialog()}>
              + Profile
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="sidebar-header">Connections</div>
          <div className="sidebar-list">
            {profiles.map((profile) => (
              <div
                key={profile.id}
                className={`profile-item ${activeProfileId === profile.id && connectionStatus === 'connected' ? 'active' : ''}`}
                onClick={() => handleConnect(profile)}
              >
                <ProfileIcon type={profile.type} />
                <div className="profile-info">
                  <div className="profile-name">{profile.name}</div>
                  <div className="profile-detail">
                    {DB_LABELS[profile.type as keyof typeof DB_LABELS] || profile.type} · {profile.host}:{profile.port}
                  </div>
                </div>
                <div className="profile-actions">
                  <button
                    className="profile-action-btn"
                    title="Edit"
                    onClick={(e) => { e.stopPropagation(); openProfileDialog(profile); }}
                  >
                    ✎
                  </button>
                  <button
                    className="profile-action-btn danger"
                    title="Delete"
                    onClick={(e) => { e.stopPropagation(); deleteProfile(profile.id); }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
            {profiles.length === 0 && (
              <div style={{ padding: '20px 14px', color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>
                No connections yet.<br />Click + New Profile to add one.
              </div>
            )}
          </div>
          <div className="sidebar-footer">
            <button className="btn" style={{ width: '100%' }} onClick={() => openProfileDialog()}>
              + New Profile
            </button>
          </div>
        </>
      )}
    </div>
  );
}
