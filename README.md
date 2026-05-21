# Cintix SQL

Professional cross-platform SQL editor with syntax highlighting, auto-complete, multi-tab queries, and database explorer.

Built with **Tauri v2** (~14MB) — a fraction of Electron's size.

## Features

- **Multi-database**: PostgreSQL, MySQL, SQL Server
- **Connection Profiles**: Save named server connections per database type
- **Database Explorer**: Browse tables, views, functions across all schemas including system catalogs (`information_schema`, `pg_catalog`, etc.)
- **SQL Editor**: Monaco Editor (VS Code engine) — syntax highlighting, auto-complete on 80+ keywords, formatting
- **Right-click Context Menus**: On tabs (Close/Close Others/Close All) and on schema objects (SELECT TOP 100, Show CREATE Script)
- **Double-click to Query**: Double-click any table or view to open and auto-execute `SELECT * LIMIT 100`
- **Multi-tab**: Run queries in separate tabs with smart numbering (reuses closed tab numbers)
- **Import/Export**: Open/save `.sql` files, export results as CSV, JSON, Markdown
- **Dark & Light Themes**: Toggle between themes — dark theme with `#242323` background and `#b264ed` purple accent
- **Keyboard Shortcuts**: Ctrl+T new tab, F5 execute, Ctrl+Shift+F format SQL

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Rust](https://rustup.rs/) 1.77+

## Quick Start

```bash
# Development
npm install
cargo tauri dev

# Production build
cargo tauri build

# Run release binary
./start.sh
```

Outputs `.deb`, `.rpm`, `.AppImage` (Linux), `.dmg` (macOS), `.msi` (Windows).

## Profile Storage

Connection profiles stored as JSON:
- Linux: `~/.local/share/cintix-sql/profiles.json`
- macOS: `~/Library/Application Support/cintix-sql/profiles.json`
- Windows: `%APPDATA%/cintix-sql/profiles.json`

## Tech Stack

| Layer    | Technology                        |
|----------|-----------------------------------|
| Desktop  | Tauri v2                          |
| Frontend | React 19, TypeScript, Vite        |
| Editor   | Monaco Editor                     |
| State    | Zustand                           |
| Backend  | Rust, sqlx, tiberius, tokio       |

## License

MIT
