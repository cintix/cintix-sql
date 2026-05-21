# Cintix SQL

Professional cross-platform SQL editor with syntax highlighting, auto-complete, multi-tab queries, edit mode, and database explorer.

Built with **Tauri v2** (~14MB) — a fraction of Electron's size.

## Features

- **Multi-database**: PostgreSQL, MySQL, SQL Server
- **Connection Profiles**: Save named server connections per database type
- **Database Explorer**: Browse tables, views, functions across all schemas including system catalogs. Color-coded icons: Tables (accent), Views (green), Functions (red). Click to expand and see column names with data types.
- **Edit Mode**: Right-click table → Edit Table. Inline cell editing with filter/sort, Save Changes, Insert Row, Delete Row. Result panel fills up to 80% of window.
- **SQL Editor**: Monaco Editor (VS Code engine) — syntax highlighting, auto-complete on 80+ keywords, formatting (Ctrl+Shift+F)
- **Smart Statement Execution**: Ctrl+Enter / Shift+Enter executes the current SQL statement (delimited by `;`) from cursor position
- **Multi-tab**: Run queries in separate tabs with smart numbering and right-click menu (Close, Close Others, Close All)
- **Export Results**: CSV, JSON, Markdown, SQL INSERT — with auto file extension
- **Import/Export SQL Files**: Open/save `.sql` files via native file dialog
- **Resizable Sidebar**: Drag the right edge to resize the explorer panel
- **Dark & Light Themes**: Toggle with ☀/🌙 button. Dark theme: `#2e2d2d` background, `#c792ea` purple accent
- **Native Application Menu**: File, Edit, Query, View with keyboard accelerators

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

# Run release binary (no env vars needed)
./releases/cintix-sql
```

Outputs `.deb`, `.rpm`, `.AppImage` (Linux), `.dmg` (macOS), `.msi` (Windows).

## Install

```bash
# Fedora/RHEL
sudo rpm -Uvh Cintix_SQL-1.0.1-1.x86_64.rpm

# Debian/Ubuntu
sudo dpkg -i Cintix_SQL_1.0.1_amd64.deb
```

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
