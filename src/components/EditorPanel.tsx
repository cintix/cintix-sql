import { useRef, useCallback, useEffect } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type { editor, Position } from 'monaco-editor';
import { useAppStore } from '../stores/appStore';

export function EditorPanel() {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<any>(null);
  const { tabs, activeTabId, updateQuery, theme, formatTrigger } = useAppStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);

  useEffect(() => {
    if (monacoRef.current) {
      monacoRef.current.editor.setTheme(theme === 'dark' ? 'cintix-dark' : 'cintix-light');
    }
  }, [theme]);

  useEffect(() => {
    if (editorRef.current && formatTrigger > 0) {
      const action = editorRef.current.getAction('format-sql');
      if (action) action.run();
    }
  }, [formatTrigger]);

  const handleMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    monaco.editor.defineTheme('cintix-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: 'b264ed', fontStyle: 'bold' },
        { token: 'string', foreground: 'ce9178' },
        { token: 'number', foreground: 'b5cea8' },
        { token: 'comment', foreground: '6a9955', fontStyle: 'italic' },
        { token: 'operator', foreground: 'd4d4d4' },
        { token: 'identifier', foreground: '9cdcfe' },
        { token: 'type', foreground: 'b264ed' },
        { token: 'function', foreground: 'dcdcaa' },
      ],
      colors: {
        'editor.background': '#242323',
        'editor.foreground': '#e8e6e3',
        'editor.lineHighlightBackground': '#2a2929',
        'editor.selectionBackground': '#5a3580',
        'editor.inactiveSelectionBackground': '#3a3939',
        'editorCursor.foreground': '#b264ed',
        'editorLineNumber.foreground': '#666463',
        'editorLineNumber.activeForeground': '#999796',
        'editor.selectionHighlightBackground': '#4a2a6a',
      },
    });

    monaco.editor.defineTheme('cintix-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: '0000ff', fontStyle: 'bold' },
        { token: 'string', foreground: 'a31515' },
        { token: 'number', foreground: '098658' },
        { token: 'comment', foreground: '008000', fontStyle: 'italic' },
        { token: 'operator', foreground: '000000' },
        { token: 'identifier', foreground: '001080' },
        { token: 'type', foreground: '267f99' },
        { token: 'function', foreground: '795e26' },
      ],
      colors: {
        'editor.background': '#ffffff',
        'editor.foreground': '#1a1d23',
        'editor.lineHighlightBackground': '#f0f1f4',
        'editor.selectionBackground': '#add6ff',
        'editor.inactiveSelectionBackground': '#d5d8de',
        'editorCursor.foreground': '#1a8fc2',
        'editorLineNumber.foreground': '#8b909e',
        'editorLineNumber.activeForeground': '#5a5f6b',
        'editor.selectionHighlightBackground': '#cce5ff',
      },
    });

    const initialTheme = useAppStore.getState().theme;
    monaco.editor.setTheme(initialTheme === 'dark' ? 'cintix-dark' : 'cintix-light');

    monaco.languages.registerCompletionItemProvider('sql', {
      provideCompletionItems: (model: editor.ITextModel, position: Position) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        const keywords = [
          'SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER',
          'DROP', 'TABLE', 'INTO', 'VALUES', 'SET', 'JOIN', 'LEFT', 'RIGHT', 'INNER',
          'OUTER', 'ON', 'AND', 'OR', 'NOT', 'IN', 'EXISTS', 'BETWEEN', 'LIKE',
          'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET', 'AS', 'DISTINCT',
          'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
          'UNION', 'ALL', 'INDEX', 'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES',
          'CASCADE', 'NULL', 'NOT NULL', 'DEFAULT', 'CHECK', 'UNIQUE', 'CONSTRAINT',
          'BEGIN', 'COMMIT', 'ROLLBACK', 'TRANSACTION', 'GRANT', 'REVOKE',
          'VARCHAR', 'INT', 'INTEGER', 'BIGINT', 'BOOLEAN', 'TEXT', 'FLOAT',
          'DOUBLE', 'DECIMAL', 'DATE', 'TIMESTAMP', 'SERIAL', 'UUID',
          'EXPLAIN', 'ANALYZE', 'WITH', 'RETURNING', 'ILIKE', 'IS', 'TRUE', 'FALSE',
          'ASC', 'DESC', 'NULLS', 'FIRST', 'LAST', 'OVER', 'PARTITION', 'WINDOW',
          'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'LAG', 'LEAD',
          'SCHEMA', 'DATABASE', 'VIEW', 'FUNCTION', 'PROCEDURE', 'TRIGGER',
          'IF', 'ELSE', 'THEN', 'END IF', 'LOOP', 'WHILE', 'FOR', 'RETURN',
          'TOP', 'PERCENT', 'NOLOCK', 'READUNCOMMITTED',
        ];

        const suggestions = keywords.map((kw) => ({
          label: kw,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: kw,
          range,
        }));

        return { suggestions };
      },
    });

    editor.addAction({
      id: 'format-sql',
      label: 'Format SQL',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF],
      run: (ed) => {
        const sql = ed.getValue();
        ed.setValue(formatSQL(sql));
      },
    });

    editor.addAction({
      id: 'execute-query',
      label: 'Execute Query',
      keybindings: [monaco.KeyCode.F5],
      run: () => {
        const store = useAppStore.getState();
        if (store.activeTabId) {
          store.executeQuery(store.activeTabId);
        }
      },
    });

    editor.addAction({
      id: 'execute-statement',
      label: 'Execute Current Statement',
      keybindings: [
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
        monaco.KeyMod.Shift | monaco.KeyCode.Enter,
      ],
      run: (ed) => {
        const store = useAppStore.getState();
        if (!store.activeTabId) return;
        const pos = ed.getPosition();
        if (!pos) return;
        const text = ed.getValue();
        if (!text.trim()) return;

        // Find current statement between ; boundaries
        const offset = ed.getModel()!.getOffsetAt(pos);
        let start = 0;
        let end = text.length;

        // Find previous ; before cursor
        for (let i = offset - 1; i >= 0; i--) {
          if (text[i] === ';') {
            start = i + 1;
            break;
          }
        }

        // Find next ; after cursor (not at exact cursor position)
        for (let i = Math.max(offset, offset); i < text.length; i++) {
          if (text[i] === ';') {
            end = i;
            break;
          }
        }

        let stmt = text.substring(start, end).trim();
        // Skip if cursor is on an empty statement (just ; or whitespace between ;)
        if (!stmt) {
          return;
        }
        // If the statement doesn't end with ; add one
        if (!stmt.endsWith(';')) stmt += ';';

        store.executeStatement(store.activeTabId, stmt);
      },
    });

    editor.focus();
  }, []);

  if (!activeTab) {
    return (
      <div className="editor-panel">
        <div className="empty-state">
          <div className="brand-large">
            <span style={{ color: 'var(--text-primary)' }}>Cintix</span>
            <span style={{ color: 'var(--accent-blue)' }}>SQL</span>
          </div>
          <div>Ctrl+T to open a new query tab</div>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-panel">
      <Editor
        key={activeTab.id}
        language="sql"
        theme={theme === 'dark' ? 'cintix-dark' : 'cintix-light'}
        value={activeTab.query}
        onChange={(value) => updateQuery(activeTab.id, value || '')}
        onMount={handleMount}
        options={{
          fontSize: 14,
          fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace",
          minimap: { enabled: false },
          lineNumbers: 'on',
          renderWhitespace: 'selection',
          bracketPairColorization: { enabled: true },
          automaticLayout: true,
          scrollBeyondLastLine: false,
          wordWrap: 'off',
          tabSize: 2,
          padding: { top: 12, bottom: 12 },
          suggest: { showKeywords: true, showSnippets: true },
        }}
        loading={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
            Loading editor...
          </div>
        }
      />
    </div>
  );
}

function formatSQL(sql: string): string {
  const keywords = [
    'SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER',
    'DROP', 'TABLE', 'INTO', 'VALUES', 'SET', 'JOIN', 'LEFT', 'RIGHT', 'INNER',
    'OUTER', 'ON', 'AND', 'OR', 'NOT', 'IN', 'EXISTS', 'BETWEEN', 'LIKE',
    'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET',
    'UNION', 'ALL', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
    'BEGIN', 'COMMIT', 'ROLLBACK', 'WITH', 'AS', 'RETURNING',
  ];

  let result = sql.trim();
  for (const kw of keywords) {
    const regex = new RegExp(`\\b${kw}\\b`, 'gi');
    result = result.replace(regex, (match) => match.toUpperCase());
  }

  const newlineKeywords = ['FROM', 'WHERE', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN',
    'OUTER JOIN', 'ON', 'AND', 'OR', 'ORDER BY', 'GROUP BY', 'HAVING',
    'LIMIT', 'OFFSET', 'UNION', 'SET', 'VALUES'];

  for (const kw of newlineKeywords) {
    const regex = new RegExp(`\\b(${kw})\\b`, 'gi');
    result = result.replace(regex, '\n$1');
  }

  return result;
}
