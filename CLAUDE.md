# Cintix SQL

Cross-platform SQL editor built with Tauri v2, React, TypeScript, and Monaco Editor.

## Tech Stack

- **Frontend:** React 19 + TypeScript + Vite + Monaco Editor (`@monaco-editor/react`)
- **Backend:** Rust (Tauri v2) + sqlx (PostgreSQL, MySQL) + tiberius (SQL Server)
- **State:** Zustand
- **Styling:** Custom CSS — dark theme (`#242323` bg, `#b264ed` purple accent) + light theme

## Project Structure

```
src/                         # React frontend
├── components/
│   ├── Toolbar.tsx          # Branding, profile selector, Connect/Run, theme toggle, import/export
│   ├── Sidebar.tsx          # Profile list (disconnected) / Database Explorer (connected)
│   ├── TabBar.tsx           # Query tabs with right-click context menu
│   ├── EditorPanel.tsx      # Monaco editor: SQL highlighting, autocomplete, light/dark themes
│   ├── ResultPanel.tsx      # Results table + CSV/JSON/MD export buttons
│   ├── StatusBar.tsx        # Connection status
│   ├── ConnectionDialog.tsx # Profile create/edit modal
│   └── DatabaseExplorer.tsx # Schema → Type → Object tree with context menu
├── stores/appStore.ts       # Zustand: tabs, profiles, theme, schema objects, all Tauri invocations
├── types/index.ts           # TypeScript interfaces
└── styles/global.css        # CSS variables for dark/light themes, all component styles

src-tauri/                   # Rust backend
├── tauri.conf.json          # Window 1280x800, "Cintix SQL"
├── Cargo.toml               # tauri, sqlx (pg+mysql), tiberius, tauri-plugin-dialog
└── src/
    ├── lib.rs               # Tauri setup, plugin registration, command list
    ├── main.rs              # Entry point
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
| `get_object_script`  | Get DDL/CREATE script for a schema object  |
| `read_file`          | Read file content for SQL import           |
| `write_file`         | Write file content for SQL/result export   |

## Database Queries for Schema

### PostgreSQL
- Tables: `information_schema.tables` (all schemas, `table_type = 'BASE TABLE'`)
- Views: `information_schema.views` (all schemas)
- Functions: `information_schema.routines` (all schemas)
- Table DDL: Column info from `information_schema.columns`
- View DDL: `pg_get_viewdef()`
- Function DDL: `pg_get_functiondef()`

### MySQL
- Tables: `information_schema.TABLES` (all schemas, `TABLE_TYPE = 'BASE TABLE'`)
- Views: `information_schema.VIEWS` (all schemas)
- Functions: `information_schema.ROUTINES` (all schemas)
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

After build, run with: `./start.sh` (sets required WebKit env vars)

## Architecture Notes

- **Send safety**: `MutexGuard` is not `Send` — always scope locks with `{}` before `.await`
- **sqlx traits**: `Row` and `Column` must be imported for `.columns()` and `.name()` methods
- **Vite `base: ''`**: Required for relative asset paths in Tauri's custom protocol
- **Tauri invoke naming**: JS camelCase keys auto-convert to Rust snake_case params
- **Tauri argument conversion**: The `State<>` param is auto-injected; only data params come from JS
- **`cargo tauri build`** re-runs `npm run build` via `beforeBuildCommand`; plain `cargo build` does not — to embed new frontend assets after a plain cargo build, touch a Rust source file first
- **GBM buffer error**: On some Linux/Wayland setups, set `WEBKIT_DISABLE_COMPOSITING_MODE=1 GDK_BACKEND=x11`
- **Light theme**: `[data-theme="light"]` selector overrides CSS variables; `document.documentElement.setAttribute('data-theme', theme)` in App.tsx
- **Monaco themes**: Both `cintix-dark` and `cintix-light` defined in `handleMount`; theme switching via `monaco.editor.setTheme()` in a `useEffect`
- **Tab numbering**: `nextTabNumber()` scans existing tab titles for "Query N" pattern and picks the lowest unused number
- **`@tauri-apps/plugin-dialog`**: Used only for file open/save dialogs; file I/O goes through our own `read_file`/`write_file` Rust commands
