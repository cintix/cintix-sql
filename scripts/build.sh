#!/bin/bash
set -e

cd "$(dirname "$0")/.."
echo "=== Cintix SQL Build ==="
echo "Platform: $(uname -s) $(uname -m)"

# Install frontend dependencies
echo ""
echo "[1/3] Installing npm dependencies..."
npm install --silent

# Build frontend
echo ""
echo "[2/3] Building frontend..."
npm run build

# Build Tauri (Rust + bundle)
echo ""
echo "[3/3] Building Tauri application..."
cargo tauri build

echo ""
echo "=== Build complete ==="
case "$(uname -s)" in
  Linux)
    echo "Packages:"
    ls -lh src-tauri/target/release/bundle/deb/*.deb 2>/dev/null
    ls -lh src-tauri/target/release/bundle/rpm/*.rpm 2>/dev/null
    ls -lh src-tauri/target/release/bundle/appimage/*.AppImage 2>/dev/null
    ;;
  Darwin)
    echo "Package:"
    ls -lh src-tauri/target/release/bundle/dmg/*.dmg 2>/dev/null
    ;;
  MINGW*|MSYS*)
    echo "Package:"
    ls -lh src-tauri/target/release/bundle/msi/*.msi 2>/dev/null
    ;;
esac
echo "Binary: src-tauri/target/release/cintix-sql"
