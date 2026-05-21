import { useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { invoke } from '@tauri-apps/api/core';
import { EditGrid } from './EditGrid';

export function ResultPanel() {
  const { tabs, activeTabId, executeQuery } = useAppStore();
  const [resultTab, setResultTab] = useState<'results' | 'messages'>('results');
  const [resizerHeight, setResizerHeight] = useState(250);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const results = activeTab?.results;
  const error = activeTab?.error;

  const handleMouseDown = () => {
    const handleMouseMove = (e: MouseEvent) => {
      const main = document.querySelector('.content-area');
      if (main) {
        const rect = main.getBoundingClientRect();
        setResizerHeight(Math.max(60, rect.bottom - e.clientY));
      }
    };
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const toCSV = (): string => {
    if (!results || !results.columns.length) return '';
    const header = results.columns.join(',');
    const body = results.rows.map((row: unknown[]) =>
      row.map((cell: unknown) => {
        if (cell === null || cell === undefined) return 'NULL';
        const s = String(cell);
        return s.includes(',') || s.includes('"') || s.includes('\n')
          ? `"${s.replace(/"/g, '""')}"`
          : s;
      }).join(',')
    ).join('\n');
    return header + '\n' + body;
  };

  const toJSON = (): string => {
    if (!results) return '';
    const arr = results.rows.map((row: unknown[]) => {
      const obj: Record<string, unknown> = {};
      results.columns.forEach((col: string, i: number) => { obj[col] = row[i]; });
      return obj;
    });
    return JSON.stringify(arr, null, 2);
  };

  const toMarkdown = (): string => {
    if (!results || !results.columns.length) return '';
    const header = '| ' + results.columns.join(' | ') + ' |';
    const sep = '| ' + results.columns.map(() => '---').join(' | ') + ' |';
    const body = results.rows.map((row: unknown[]) =>
      '| ' + row.map((cell: unknown) => {
        if (cell === null || cell === undefined) return '*NULL*';
        return String(cell).replace(/\|/g, '\\|');
      }).join(' | ') + ' |'
    ).join('\n');
    return header + '\n' + sep + '\n' + body;
  };

  const toSQL = (): string => {
    if (!results || !results.columns.length) return '';
    const cols = results.columns;
    const rows = results.rows as unknown[][];
    return rows.map(row => {
      const vals = row.map((c: unknown) => {
        if (c === null || c === undefined) return 'NULL';
        return `'${String(c).replace(/'/g, "''")}'`;
      });
      return `INSERT INTO table_name (${cols.map(c => `"${c}"`).join(', ')}) VALUES (${vals.join(', ')});`;
    }).join('\n') + '\n';
  };

  const ensureExt = (p: string, ext: string): string => {
    return p.endsWith(`.${ext}`) ? p : `${p}.${ext}`;
  };

  const exportResult = async (format: string) => {
    let content: string;
    let ext: string;
    switch (format) {
      case 'csv': content = toCSV(); ext = 'csv'; break;
      case 'json': content = toJSON(); ext = 'json'; break;
      case 'md': content = toMarkdown(); ext = 'md'; break;
      case 'sql': content = toSQL(); ext = 'sql'; break;
      default: return;
    }
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const path = await save({ filters: [{ name: `${format.toUpperCase()} Files`, extensions: [ext] }] });
      if (path) {
        await invoke('write_file', { path: ensureExt(path as string, ext), content });
      }
    } catch (_) {}
  };

  if (!activeTab) return null;

  // Edit mode for tables
  if (activeTab.editTable && results && results.columns.length > 0 && !activeTab.isExecuting) {
    const refresh = () => {
      executeQuery(activeTab.id!);
    };
    return (
      <>
        <div className="resizer" onMouseDown={handleMouseDown} />
        <div className="result-panel" style={{ height: resizerHeight, maxHeight: 'none', flex: 'none' }}>
          <EditGrid
            columns={results.columns}
            rows={results.rows as unknown[][]}
            tableName={activeTab.editTable.table}
            onRefresh={refresh}
          />
        </div>
      </>
    );
  }

  if (!results && !error && !activeTab.isExecuting) return null;

  return (
    <>
      <div className="resizer" onMouseDown={handleMouseDown} />
      <div className="result-panel" style={{ height: resizerHeight }}>
        <div className="result-header">
          <div className="result-tabs">
            <button
              className={`result-tab ${resultTab === 'results' ? 'active' : ''}`}
              onClick={() => setResultTab('results')}
            >
              Results
            </button>
            <button
              className={`result-tab ${resultTab === 'messages' ? 'active' : ''}`}
              onClick={() => setResultTab('messages')}
            >
              Messages
            </button>
          </div>
          <div style={{ display: 'flex', gap: 4, marginLeft: 12 }}>
            {results && results.columns.length > 0 && (
              <>
                <button className="btn btn-sm" onClick={() => exportResult('csv')} title="Export as CSV">CSV</button>
                <button className="btn btn-sm" onClick={() => exportResult('json')} title="Export as JSON">JSON</button>
                <button className="btn btn-sm" onClick={() => exportResult('md')} title="Export as Markdown">MD</button>
                <button className="btn btn-sm" onClick={() => exportResult('sql')} title="Export as SQL INSERT">SQL</button>
              </>
            )}
          </div>
          <div className={`result-status ${error ? 'error' : 'success'}`}>
            {activeTab.isExecuting ? (
              'Executing...'
            ) : error ? (
              'Error'
            ) : results ? (
              <>
                {results.rowCount > 0
                  ? `${results.rowCount} rows · ${results.executionTime}ms`
                  : results.affectedRows !== undefined && results.affectedRows !== null
                  ? `${results.affectedRows} rows affected · ${results.executionTime}ms`
                  : `Done · ${results.executionTime}ms`}
              </>
            ) : null}
          </div>
        </div>

        {resultTab === 'results' ? (
          <div className="result-table-wrap">
            {error ? (
              <div className="messages-panel">
                <pre className="msg-error">{error}</pre>
              </div>
            ) : results && results.columns.length > 0 ? (
              <table className="result-table">
                <thead>
                  <tr>
                    <th style={{ width: 30, color: 'var(--text-muted)' }}>#</th>
                    {results.columns.map((col: string) => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.rows.map((row: unknown[], idx: number) => (
                    <tr key={idx}>
                      <td style={{ color: 'var(--text-muted)', fontSize: 11 }}>{idx + 1}</td>
                      {(row as unknown[]).map((cell: unknown, ci: number) => (
                        <td key={ci}>
                          {cell === null || cell === undefined ? (
                            <span className="null-value">NULL</span>
                          ) : (
                            String(cell)
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : results ? (
              <div className="messages-panel">
                Query executed successfully.
                {results.affectedRows !== undefined && results.affectedRows !== null && (
                  <div>{results.affectedRows} row(s) affected.</div>
                )}
                <div>Execution time: {results.executionTime}ms</div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="messages-panel">
            {error ? (
              <div className="msg-error">{error}</div>
            ) : results ? (
              <div>
                <div>Query completed successfully.</div>
                <div>Execution time: {results.executionTime}ms</div>
                {results.rowCount > 0 && <div>Rows returned: {results.rowCount}</div>}
                {results.affectedRows !== undefined && results.affectedRows !== null && (
                  <div>Rows affected: {results.affectedRows}</div>
                )}
              </div>
            ) : (
              <div>No results yet.</div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
