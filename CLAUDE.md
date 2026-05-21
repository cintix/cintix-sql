# Cintix SQL

Cross-platform SQL editor built with Tauri v2, React, TypeScript, and Monaco Editor.

## Tech Stack

- **Frontend:** React 19 + TypeScript + Vite + Monaco Editor (`@monaco-editor/react`)
- **Backend:** Rust (Tauri v2) + sqlx (PostgreSQL, MySQL) + tiberius (SQL Server)
- **State:** Zustand
- **Styling:** Custom CSS — dark theme (`#2e2d2d` bg, `#c792ea` purple accent) + light theme

## Project Structure

```
src/                         # React frontend
├── components/
│   ├── Toolbar.tsx          # Branding, profile selector, Connect/Run, theme toggle
│   ├── Sidebar.tsx          # Profile list (disconnected) / Database Explorer (connected)
│   ├── TabBar.tsx           # Query tabs with right-click context menu (Close/Close Others/Close All)
│   ├── EditorPanel.tsx      # Monaco editor: SQL highlighting, autocomplete, Ctrl+Enter statement exec
│   ├── ResultPanel.tsx      # Results table + CSV/JSON/MD/SQL export + EditGrid in edit mode
│   ├── EditGrid.tsx         # Editable data grid: inline editing, filter, sort, Save/Insert/Delete
│   ├── StatusBar.tsx        # Connection status + version
│   ├── ConnectionDialog.tsx # Profile create/edit modal
│   └── DatabaseExplorer.tsx # Schema → flat object list with color-coded icons, column expansion
├── stores/appStore.ts       # Zustand: tabs, profiles, theme, schema, columns, all Tauri invocations
├── types/index.ts           # TypeScript interfaces
└── styles/global.css        # CSS variables for dark/light themes, all component styles

src-tauri/                   # Rust backend
├── tauri.conf.json          # Window 1280x800, "Cintix SQL"
├── Cargo.toml               # tauri, sqlx (pg+mysql), tiberius, tauri-plugin-dialog
└── src/
    ├── lib.rs               # Tauri setup, native menu (File/Edit/Query/View), command registration
    ├── main.rs              # Entry point + WebKit env var fallback for Linux
    └── db/
        ├── mod.rs           # ConnectionProfile, QueryResult, DbConnection enum, AppState
        └── commands.rs      # All Tauri commands (see below)
```

## Tauri Commands

| Command              | Purpose                                    |
|----------------------|--------------------------------------------|
| `get_profiles`       | Load saved connection profiles             |
| `save_profile`       | Create or update a profile                 |
| `delete_profile`     | Remove a profile by ID                     |
| `connect`            | Connect to PostgreSQL/MySQL with profile   |
| `disconnect`         | Drop all connections                       |
| `execute_query`      | Run SQL and return columns + rows          |
| `get_schema_objects` | List tables/views/functions across schemas |
| `get_columns`        | Get column names, types, nullable for a table/view |
| `get_object_script`  | Get DDL/CREATE script for a schema object  |
| `read_file`          | Read file content for SQL import           |
| `write_file`         | Write file content for SQL/result export   |

## Database Queries for Schema

### PostgreSQL
- Tables: `information_schema.tables` (all schemas, `table_type = 'BASE TABLE'`)
- Views: `information_schema.views` (all schemas)
- Functions: `information_schema.routines` (all schemas)
- Columns: `information_schema.columns` (by schema + table)
- View DDL: `pg_get_viewdef()`
- Function DDL: `pg_get_functiondef()`

### MySQL
- Tables: `information_schema.TABLES` (all schemas)
- Views: `information_schema.VIEWS` (all schemas)
- Functions: `information_schema.ROUTINES` (all schemas)
- Columns: `information_schema.COLUMNS` (by schema + table)
- DDL: `SHOW CREATE TABLE/VIEW/FUNCTION`

## Development

```bash
npm install
cargo tauri dev              # Vite + Tauri with hot reload
```

## Build

```bash
npm run build                # Frontend only
cargo build --release --manifest-path src-tauri/Cargo.toml  # Backend only
cargo tauri build            # Full production build → deb, rpm, bundle
```

After build, binary runs directly: `./src-tauri/target/release/cintix-sql` — no env vars needed.

## Architecture Notes

- **Send safety**: `MutexGuard` is not `Send` — always scope locks with `{}` before `.await`
- **sqlx traits**: `Row` and `Column` must be imported for `.columns()` and `.name()` methods
- **Vite `base: ''`**: Required for relative asset paths in Tauri's custom protocol
- **Tauri invoke naming**: JS camelCase keys auto-convert to Rust snake_case params
- **WebKit env vars**: `WEBKIT_DISABLE_COMPOSITING_MODE=1` and `GDK_BACKEND=x11` are set in `main.rs` for Linux as fallback (only if not already set by user)
- **Light theme**: `[data-theme="light"]` selector overrides CSS variables; `document.documentElement.setAttribute('data-theme', theme)` in App.tsx
- **Monaco themes**: Both `cintix-dark` (`#2e2d2d` bg, `#c792ea` accent) and `cintix-light` defined in `handleMount`; theme switching via `monaco.editor.setTheme()` in a `useEffect`
- **Tab numbering**: `nextTabNumber()` scans existing tab titles for "Query N" pattern and picks the lowest unused number
- **`@tauri-apps/plugin-dialog`**: Used only for file open/save dialogs; file I/O goes through our own `read_file`/`write_file` Rust commands
- **`cargo tauri build`** re-runs `npm run build` via `beforeBuildCommand`; plain `cargo build` does not — touch a Rust source file to force re-embed of frontend assets
- **Statement execution**: Ctrl+Enter finds current SQL statement by searching for previous `;` (backwards) and next `;` (forwards) from cursor position; handles first/last/only statement edge cases
- **Sidebar resizing**: Controlled by `sidebarWidth` state in App.tsx (160px–500px), persisted only in session
- **Column expansion**: Click table/view in explorer → toggleObjectExpand → get_columns command → cached in columnCache
- **Explorer icons**: Color-coded via TYPE_COLORS map (table=accent-blue, view=accent-green, function=accent-red)
