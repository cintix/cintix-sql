import { useState } from 'react';
import { useAppStore } from '../stores/appStore';

export function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab, closeOthers, closeAll, addTab } = useAppStore();
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; tabId: string } | null>(null);

  const handleContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, tabId });
  };

  const handleClose = () => {
    if (ctxMenu) { closeTab(ctxMenu.tabId); setCtxMenu(null); }
  };
  const handleCloseOthers = () => {
    if (ctxMenu) { closeOthers(ctxMenu.tabId); setCtxMenu(null); }
  };
  const handleCloseAll = () => {
    closeAll(); setCtxMenu(null);
  };

  return (
    <div className="tab-bar">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`tab ${tab.id === activeTabId ? 'active' : ''}`}
          onClick={() => setActiveTab(tab.id)}
          onContextMenu={(e) => handleContextMenu(e, tab.id)}
        >
          <span>{tab.title}</span>
          {tab.isExecuting && (
            <span style={{ color: 'var(--accent-amber)', fontSize: '10px' }}>●</span>
          )}
          <button
            className="tab-close"
            onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
          >
            ×
          </button>
        </div>
      ))}
      <button className="new-tab-btn" onClick={addTab} title="New Query (Ctrl+T)">+</button>

      {ctxMenu && (
        <>
          <div onClick={() => setCtxMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 999 }} />
          <div style={{
            position: 'fixed', left: ctxMenu.x, top: ctxMenu.y, zIndex: 1000,
            background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)',
            minWidth: 160, padding: 4,
          }}>
            <div className="ctx-item" onClick={handleClose} style={iStyle}>
              Close
            </div>
            <div className="ctx-item" onClick={handleCloseOthers} style={iStyle}>
              Close Others
            </div>
            <div className="ctx-item" onClick={handleCloseAll} style={iStyle}>
              Close All
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const iStyle: React.CSSProperties = {
  padding: '6px 10px', cursor: 'pointer', fontSize: 12.5,
  borderRadius: 'var(--radius-sm)',
};
