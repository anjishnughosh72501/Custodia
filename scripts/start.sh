#!/bin/sh
set -e

# Start Rust Secure Document Gateway in background if binary exists
if [ -x "/usr/local/bin/custodia-secure-gateway" ]; then
    echo "[Custodia] Starting Rust Secure Document Gateway on 127.0.0.1:8002..."
    export GATEWAY_HOST="127.0.0.1"
    export GATEWAY_PORT="8002"
    /usr/local/bin/custodia-secure-gateway &
    GATEWAY_PID=$!
else
    echo "[Custodia] Warning: Rust gateway binary not found at /usr/local/bin/custodia-secure-gateway"
    GATEWAY_PID=""
fi

# Graceful signal forwarding
cleanup() {
    echo "[Custodia] Shutting down services..."
    if [ -n "$UVICORN_PID" ]; then
        kill -TERM "$UVICORN_PID" 2>/dev/null || true
    fi
    if [ -n "$GATEWAY_PID" ]; then
        kill -TERM "$GATEWAY_PID" 2>/dev/null || true
    fi
    wait
    exit 0
}

trap cleanup INT TERM

# Start FastAPI Uvicorn server in background
echo "[Custodia] Starting FastAPI backend on port ${PORT:-8000}..."
uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --workers 1 --proxy-headers --forwarded-allow-ips '*' &
UVICORN_PID=$!

# Wait on uvicorn
wait "$UVICORN_PID"
cleanup

