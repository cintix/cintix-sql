#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
export WEBKIT_DISABLE_COMPOSITING_MODE=1
export GDK_BACKEND=x11
"$DIR/src-tauri/target/release/cintix-sql" &
disown
