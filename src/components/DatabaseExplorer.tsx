import { useAppStore, type SchemaObject } from '../stores/appStore';

const TYPE_ICONS: Record<string, string> = {
  table: '⊞',
  view: '◉',
  function: 'ƒ',
  procedure: '⚙',
  trigger: '⚡',
  sequence: '≣',
};

const TYPE_LABELS: Record<string, string> = {
  table: 'Tables',
  view: 'Views',
  function: 'Functions',
  procedure: 'Procedures',
};

const SYSTEM_SCHEMAS = ['pg_catalog', 'information_schema', 'mysql', 'sys', 'performance_schema'];

function groupBySchema(objects: SchemaObject[]): Map<string, SchemaObject[]> {
  const map = new Map<string, SchemaObject[]>();
  for (const obj of objects) {
    const list = map.get(obj.schema) || [];
    list.push(obj);
    map.set(obj.schema, list);
  }
  return map;
}

function groupByType(objects: SchemaObject[]): Map<string, SchemaObject[]> {
  const map = new Map<string, SchemaObject[]>();
  for (const obj of objects) {
    const list = map.get(obj.type) || [];
    list.push(obj);
    map.set(obj.type, list);
  }
  return map;
}

const ctxItemStyle: React.CSSProperties = {
  padding: '6px 10px', cursor: 'pointer', fontSize: 12.5,
  borderRadius: 'var(--radius-sm)', transition: 'background 0.1s',
};

export function DatabaseExplorer() {
  const {
    schemaObjects, expandedSections, toggleSection,
    showContextMenu, hideContextMenu, contextMenu,
    getObjectScript,
  } = useAppStore();

  const schemas = groupBySchema(schemaObjects);
  const schemaNames = Array.from(schemas.keys()).sort((a, b) => {
    const aSys = SYSTEM_SCHEMAS.includes(a);
    const bSys = SYSTEM_SCHEMAS.includes(b);
    if (aSys && !bSys) return 1;
    if (!aSys && bSys) return -1;
    return a.localeCompare(b);
  });

  const openInTab = (q: string, execute = false) => {
    const state = useAppStore.getState();
    state.addTab();
    setTimeout(() => {
      const s = useAppStore.getState();
      const lastTab = s.tabs[s.tabs.length - 1];
      if (lastTab) {
        s.updateQuery(lastTab.id, q);
        if (execute) setTimeout(() => s.executeQuery(lastTab.id), 50);
      }
    }, 0);
  };

  const handleObjectDoubleClick = (obj: SchemaObject) => {
    if (obj.type === 'table' || obj.type === 'view') {
      openInTab(`SELECT * FROM "${obj.schema}"."${obj.name}" LIMIT 100;`, true);
    } else {
      const q = `-- ${obj.type}: ${obj.schema}.${obj.name}`;
      const state = useAppStore.getState();
      state.addTab();
      setTimeout(() => {
        const s = useAppStore.getState();
        const lastTab = s.tabs[s.tabs.length - 1];
        if (lastTab) s.updateQuery(lastTab.id, q);
      }, 0);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, obj: SchemaObject) => {
    e.preventDefault();
    showContextMenu(e.clientX, e.clientY, obj);
  };

  const handleShowScript = async () => {
    if (!contextMenu) return;
    const script = await getObjectScript(contextMenu.object);
    hideContextMenu();
    openInTab(script);
  };

  const handleEditTable = () => {
    if (!contextMenu) return;
    hideContextMenu();
    const obj = contextMenu.object;
    const q = `SELECT * FROM "${obj.schema}"."${obj.name}" LIMIT 200;`;
    const state = useAppStore.getState();
    state.addTab();
    setTimeout(() => {
      const s = useAppStore.getState();
      const lastTab = s.tabs[s.tabs.length - 1];
      if (lastTab) {
        s.updateQuery(lastTab.id, q);
        s.setTabEditTable(lastTab.id, { schema: obj.schema, table: obj.name });
        setTimeout(() => s.executeQuery(lastTab.id), 50);
      }
    }, 0);
  };

  const handleSelectAll = () => {
    if (!contextMenu) return;
    hideContextMenu();
    const obj = contextMenu.object;
    openInTab(`SELECT * FROM "${obj.schema}"."${obj.name}" LIMIT 100;`, true);
  };

  return (
    <>
      {schemaNames.map((schemaName) => {
        const objs = schemas.get(schemaName)!;
        const byType = groupByType(objs);
        const isSystem = SYSTEM_SCHEMAS.includes(schemaName);
        const sectionKey = `schema:${schemaName}`;
        const expanded = expandedSections[sectionKey] ?? !isSystem;

        return (
          <div key={schemaName} style={{ marginBottom: 1 }}>
            <div
              onClick={() => toggleSection(sectionKey)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 12px', cursor: 'pointer',
                fontSize: 12, fontWeight: 600,
                color: isSystem ? 'var(--text-muted)' : 'var(--text-secondary)',
                userSelect: 'none',
              }}
            >
              <span style={{
                fontSize: 10, transition: 'transform 0.15s',
                transform: expanded ? 'rotate(90deg)' : '',
                color: 'var(--text-muted)',
              }}>
                ▶
              </span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {schemaName}
              </span>
              <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 10 }}>
                {objs.length}
              </span>
            </div>

            {expanded && Array.from(byType.entries()).map(([type, items]) => (
              <div key={`${schemaName}:${type}`} style={{ marginBottom: 1 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '4px 12px 4px 28px',
                  fontSize: 11, color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: 0.3,
                  fontWeight: 500,
                }}>
                  {TYPE_LABELS[type] || type}
                  <span style={{ marginLeft: 'auto', fontSize: 10 }}>{items.length}</span>
                </div>
                {items.map((obj) => (
                  <div
                    key={`${obj.schema}.${obj.type}.${obj.name}`}
                    onDoubleClick={() => handleObjectDoubleClick(obj)}
                    onContextMenu={(e) => handleContextMenu(e, obj)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '5px 12px 5px 40px', cursor: 'pointer',
                      fontSize: 12.5, borderRadius: 'var(--radius-sm)',
                      margin: '1px 4px', color: 'var(--text-secondary)',
                      transition: 'all 0.1s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--bg-hover)';
                      e.currentTarget.style.color = 'var(--text-primary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }}
                  >
                    <span style={{ width: 16, textAlign: 'center', fontSize: 13 }}>
                      {TYPE_ICONS[obj.type] || '•'}
                    </span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {obj.name}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        );
      })}

      {contextMenu && (
        <>
          <div onClick={hideContextMenu} style={{ position: 'fixed', inset: 0, zIndex: 999 }} />
          <div style={{
            position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 1000,
            background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)',
            minWidth: 220, padding: 4,
          }}>
            <div style={{ padding: '4px 10px 6px', fontSize: 11, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)', marginBottom: 2 }}>
              {contextMenu.object.schema}.{contextMenu.object.name}
              <span style={{ marginLeft: 8, color: 'var(--text-muted)', fontSize: 10 }}>
                {contextMenu.object.type}
              </span>
            </div>
            {contextMenu.object.type === 'table' && (
              <div className="ctx-item" onClick={handleEditTable} style={ctxItemStyle}>
                ✎ Edit Table
              </div>
            )}
            <div className="ctx-item" onClick={handleSelectAll} style={ctxItemStyle}>
              SELECT TOP 100
            </div>
            <div className="ctx-item" onClick={handleShowScript} style={ctxItemStyle}>
              Show CREATE Script
            </div>
          </div>
        </>
      )}
    </>
  );
}
