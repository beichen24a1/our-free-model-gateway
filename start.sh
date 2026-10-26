#!/usr/bin/env bash
# Linux / macOS 启动脚本；Windows 用 start.cmd。
set -euo pipefail
cd "$(dirname "$0")"
exec node server.mjs
