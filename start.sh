#!/bin/bash
# 启动学生管理系统

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Start backend
cd "$SCRIPT_DIR/backend" && node src/app.js &
BACKEND_PID=$!
echo "Backend started (PID: $BACKEND_PID)"

# Wait for backend
sleep 1

# Start frontend
cd "$SCRIPT_DIR/frontend" && npx vite --host 0.0.0.0 &
FRONTEND_PID=$!
echo "Frontend started (PID: $FRONTEND_PID)"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
