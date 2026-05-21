import { useAppStore } from '../stores/appStore';
import { DB_LABELS } from '../types';

export function StatusBar() {
  const { profiles, activeProfileId, connectionStatus } = useAppStore();
  const activeProfile = profiles.find((p) => p.id === activeProfileId);

  const connectionLabel = () => {
    if (!activeProfile) return 'Not connected';
    const dbLabel = DB_LABELS[activeProfile.type as keyof typeof DB_LABELS] || activeProfile.type;
    return `${dbLabel} · ${activeProfile.host}:${activeProfile.port}/${activeProfile.database}`;
  };

  return (
    <div className="status-bar">
      <span className={`status-dot ${connectionStatus}`} />
      <span>{connectionLabel()}</span>
      <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>
        Cintix SQL v1.0.1
      </span>
    </div>
  );
}
