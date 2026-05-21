import { useState, useEffect } from 'react';
import { useAppStore } from '../stores/appStore';
import type { ConnectionProfile, DatabaseType } from '../types';
import { DEFAULT_PORTS, DB_LABELS } from '../types';

function emptyProfile(): ConnectionProfile {
  return {
    id: '',
    name: '',
    type: 'postgresql',
    host: 'localhost',
    port: 5432,
    username: '',
    password: '',
    database: '',
    ssl: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function ConnectionDialog() {
  const { showProfileDialog, editingProfile, saveProfile, closeProfileDialog } = useAppStore();
  const [profile, setProfile] = useState<ConnectionProfile>(emptyProfile());

  useEffect(() => {
    if (editingProfile) {
      setProfile({ ...editingProfile, password: '' });
    } else {
      setProfile(emptyProfile());
    }
  }, [editingProfile, showProfileDialog]);

  if (!showProfileDialog) return null;

  const handleTypeChange = (type: DatabaseType) => {
    setProfile((p) => ({
      ...p,
      type,
      port: DEFAULT_PORTS[type],
    }));
  };

  const handleSave = () => {
    const now = new Date().toISOString();
    saveProfile({
      ...profile,
      id: profile.id || crypto.randomUUID(),
      createdAt: profile.createdAt || now,
      updatedAt: now,
    });
  };

  const isValid = profile.name.trim() && profile.host.trim() && profile.username.trim();

  return (
    <div className="modal-overlay" onClick={closeProfileDialog}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">
            {editingProfile ? 'Edit Profile' : 'New Connection Profile'}
          </span>
          <button className="modal-close" onClick={closeProfileDialog}>×</button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Profile Name</label>
            <input
              className="form-input"
              placeholder="e.g. Production PostgreSQL"
              value={profile.name}
              onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Database Type</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(Object.keys(DEFAULT_PORTS) as DatabaseType[]).map((t) => (
                <button
                  key={t}
                  className={`btn ${profile.type === t ? 'btn-primary' : ''}`}
                  onClick={() => handleTypeChange(t)}
                >
                  {DB_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group" style={{ flex: 2 }}>
              <label className="form-label">Host</label>
              <input
                className="form-input"
                placeholder="localhost"
                value={profile.host}
                onChange={(e) => setProfile((p) => ({ ...p, host: e.target.value }))}
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Port</label>
              <input
                className="form-input"
                type="number"
                value={profile.port}
                onChange={(e) => setProfile((p) => ({ ...p, port: parseInt(e.target.value) || 0 }))}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Username</label>
              <input
                className="form-input"
                placeholder="Username"
                value={profile.username}
                onChange={(e) => setProfile((p) => ({ ...p, username: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                className="form-input"
                type="password"
                placeholder={editingProfile ? 'Leave empty to keep current' : 'Password'}
                value={profile.password}
                onChange={(e) => setProfile((p) => ({ ...p, password: e.target.value }))}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Database</label>
            <input
              className="form-input"
              placeholder="Database name"
              value={profile.database}
              onChange={(e) => setProfile((p) => ({ ...p, database: e.target.value }))}
            />
          </div>

          <label className="form-check">
            <input
              type="checkbox"
              checked={profile.ssl}
              onChange={(e) => setProfile((p) => ({ ...p, ssl: e.target.checked }))}
            />
            Use SSL/TLS
          </label>
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={closeProfileDialog}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!isValid}>
            {editingProfile ? 'Update' : 'Save Profile'}
          </button>
        </div>
      </div>
    </div>
  );
}
