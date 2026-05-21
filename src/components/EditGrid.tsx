import { useState, useMemo } from 'react';
import { useAppStore } from '../stores/appStore';

interface Props {
  columns: string[];
  rows: unknown[][];
  tableName: string;
  onRefresh: () => void;
}

export function EditGrid({ columns, rows: initialRows, tableName, onRefresh }: Props) {
  const { activeProfileId } = useAppStore();
  const [rows, setRows] = useState<unknown[][]>(() => initialRows.map(r => [...r]));
  const [original] = useState<unknown[][]>(() => initialRows.map(r => [...r]));
  const [deleted, setDeleted] = useState<Set<number>>(new Set());
  const [inserted, setInserted] = useState<Set<number>>(new Set());
  const [editCell, setEditCell] = useState<{ r: number; c: number } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [filter, setFilter] = useState<Record<string, string>>({});
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [statusMsg, setStatusMsg] = useState('');

  const colRefs = columns.map(c => `"${c}"`).join(', ');

  const filtered = useMemo(() => {
    let result = rows.map((r, i) => ({ row: r, idx: i }));
    for (const [col, val] of Object.entries(filter)) {
      if (!val) continue;
      const ci = columns.indexOf(col);
      if (ci < 0) continue;
      const lower = val.toLowerCase();
      result = result.filter(({ row }) => String(row[ci] ?? '').toLowerCase().includes(lower));
    }
    if (sortCol !== null) {
      result.sort((a, b) => {
        const av = String(a.row[sortCol] ?? '');
        const bv = String(b.row[sortCol] ?? '');
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    return result;
  }, [rows, filter, sortCol, sortAsc]);

  const isChanged = (idx: number): boolean => {
    if (inserted.has(idx)) return true;
    if (deleted.has(idx)) return true;
    const orig = original[idx];
    const curr = rows[idx];
    if (!orig || !curr) return false;
    for (let i = 0; i < columns.length; i++) {
      if (String(orig[i] ?? '') !== String(curr[i] ?? '')) return true;
    }
    return false;
  };

  const startEdit = (r: number, c: number) => {
    setEditCell({ r, c });
    const val = rows[r]?.[c];
    setEditValue(val === null || val === undefined ? '' : String(val));
  };

  const commitEdit = () => {
    if (editCell) {
      setRows(prev => {
        const next = prev.map(r => [...r]);
        next[editCell.r] = [...next[editCell.r]];
        next[editCell.r][editCell.c] = editValue;
        return next;
      });
    }
    setEditCell(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!editCell) return;
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      commitEdit();
      if (e.key === 'Tab') {
        const nextC = editCell.c + 1;
        if (nextC < columns.length) {
          setTimeout(() => startEdit(editCell.r, nextC), 0);
        }
      } else if (!e.shiftKey) {
        const nextR = editCell.r + 1;
        if (nextR < rows.length) {
          setTimeout(() => startEdit(nextR, editCell.c), 0);
        }
      }
    } else if (e.key === 'Escape') {
      setEditCell(null);
    }
  };

  const insertRow = () => {
    const newRow = new Array(columns.length).fill('');
    setRows(prev => [...prev, newRow]);
    setInserted(prev => new Set([...prev, rows.length]));
  };

  const deleteRow = (idx: number) => {
    if (inserted.has(idx)) {
      setRows(prev => prev.filter((_, i) => i !== idx));
      setInserted(prev => { const n = new Set(prev); n.delete(idx); return n; });
    } else {
      setDeleted(prev => new Set([...prev, idx]));
    }
  };

  const saveChanges = async () => {
    if (!activeProfileId) return;
    setStatusMsg('Saving...');
    const stmts: string[] = [];

    for (const idx of deleted) {
      const origRow = original[idx];
      if (!origRow) continue;
      const where = columns.map((c, i) => {
        const v = origRow[i];
        if (v === null || v === undefined) return `"${c}" IS NULL`;
        return `"${c}" = '${String(v).replace(/'/g, "''")}'`;
      }).join(' AND ');
      stmts.push(`DELETE FROM "${tableName}" WHERE ${where};`);
    }

    for (let i = 0; i < rows.length; i++) {
      if (deleted.has(i)) continue;
      if (inserted.has(i)) {
        const vals = rows[i].map(v => {
          if (v === null || v === undefined || v === '') return 'NULL';
          return `'${String(v).replace(/'/g, "''")}'`;
        }).join(', ');
        stmts.push(`INSERT INTO "${tableName}" (${colRefs}) VALUES (${vals});`);
      } else if (isChanged(i) && !inserted.has(i)) {
        const origRow = original[i];
        if (!origRow) continue;
        const sets = columns.map((c, ci) => {
          const v = rows[i][ci];
          if (v === null || v === undefined) return `"${c}" = NULL`;
          return `"${c}" = '${String(v).replace(/'/g, "''")}'`;
        }).join(', ');
        const where = columns.map((c, ci) => {
          const ov = origRow[ci];
          if (ov === null || ov === undefined) return `"${c}" IS NULL`;
          return `"${c}" = '${String(ov).replace(/'/g, "''")}'`;
        }).join(' AND ');
        stmts.push(`UPDATE "${tableName}" SET ${sets} WHERE ${where};`);
      }
    }

    if (stmts.length === 0) { setStatusMsg('No changes'); return; }

    try {
      for (const sql of stmts) {
        await (await import('@tauri-apps/api/core')).invoke('execute_query', {
          profileId: activeProfileId,
          sql,
        });
      }
      setStatusMsg(`Saved: ${stmts.length} statement(s)`);
      setTimeout(() => onRefresh(), 500);
    } catch (e: any) {
      setStatusMsg(`Error: ${e}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px',
        background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)',
        minHeight: 32,
      }}>
        <span style={{ fontSize: 11, color: 'var(--accent-amber)', fontWeight: 600, marginRight: 8 }}>
          ✎ Edit Mode: {tableName}
        </span>
        <button className="btn btn-sm btn-success" onClick={saveChanges}>Save Changes</button>
        <button className="btn btn-sm" onClick={insertRow}>+ Insert Row</button>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{statusMsg}</span>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
          <thead>
            <tr>
              <th style={thStyle}>#</th>
              {columns.map((c, ci) => (
                <th
                  key={c}
                  style={{ ...thStyle, cursor: 'pointer' }}
                  onClick={() => {
                    if (sortCol === ci) setSortAsc(!sortAsc);
                    else { setSortCol(ci); setSortAsc(true); }
                  }}
                >
                  {c}
                  {sortCol === ci ? (sortAsc ? ' ▲' : ' ▼') : ''}
                </th>
              ))}
              <th style={{ ...thStyle, width: 24 }}></th>
            </tr>
            {/* Filter row */}
            <tr>
              <th style={thStyle}></th>
              {columns.map(c => (
                <th key={c} style={{ ...thStyle, padding: 2 }}>
                  <input
                    className="form-input"
                    placeholder="Filter..."
                    value={filter[c] || ''}
                    onChange={e => setFilter(prev => ({ ...prev, [c]: e.target.value }))}
                    style={{ width: '100%', padding: '2px 6px', fontSize: 11, minWidth: 80 }}
                  />
                </th>
              ))}
              <th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(({ row, idx }) => (
              <tr
                key={idx}
                style={{
                  background: deleted.has(idx) ? 'rgba(239,83,80,0.15)' :
                    inserted.has(idx) ? 'rgba(102,187,106,0.1)' :
                    isChanged(idx) ? 'rgba(178,100,237,0.08)' : undefined,
                  opacity: deleted.has(idx) ? 0.5 : 1,
                }}
              >
                <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: 10 }}>
                  {inserted.has(idx) ? '+' : deleted.has(idx) ? '✕' : idx + 1}
                </td>
                {columns.map((_c, ci) => {
                  const editing = editCell?.r === idx && editCell?.c === ci;
                  return (
                    <td
                      key={ci}
                      style={tdStyle}
                      onClick={() => !deleted.has(idx) && startEdit(idx, ci)}
                    >
                      {editing ? (
                        <input
                          autoFocus
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={commitEdit}
                          onKeyDown={handleKeyDown}
                          style={{
                            width: '100%', padding: '2px 4px', fontSize: 12,
                            fontFamily: 'var(--font-mono)', background: 'var(--bg-input)',
                            color: 'var(--text-primary)', border: '1px solid var(--accent-blue)',
                            borderRadius: 3, outline: 'none',
                          }}
                        />
                      ) : (
                        <span>
                          {row[ci] === null || row[ci] === undefined
                            ? <span className="null-value">NULL</span>
                            : String(row[ci])}
                        </span>
                      )}
                    </td>
                  );
                })}
                <td style={tdStyle}>
                  {!deleted.has(idx) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteRow(idx); }}
                      style={{
                        background: 'none', border: 'none', color: 'var(--accent-red)',
                        cursor: 'pointer', fontSize: 14, padding: '0 4px',
                      }}
                      title="Delete row"
                    >×</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  position: 'sticky', top: 0, background: 'var(--bg-tertiary)',
  padding: '6px 10px', textAlign: 'left', fontWeight: 600,
  color: 'var(--accent-blue)', borderBottom: '2px solid var(--border-color)',
  whiteSpace: 'nowrap', fontSize: 11.5,
};

const tdStyle: React.CSSProperties = {
  padding: '3px 10px', borderBottom: '1px solid var(--border-color)',
  whiteSpace: 'nowrap', maxWidth: 350, overflow: 'hidden', textOverflow: 'ellipsis',
  color: 'var(--text-primary)', cursor: 'text',
};
