#!/bin/bash
set -euo pipefail

ROOT="/Users/hafizov/MedCRM"
BACKEND="$ROOT/backend"
LOG_DIR="$BACKEND/.logs"
NODE22="/Users/hafizov/.nvm/versions/node/v22.22.3/bin"

mkdir -p "$LOG_DIR"

if [ -d "$NODE22" ]; then
  export PATH="$NODE22:$PATH"
fi

cd "$BACKEND"

echo "MedCRM backend launcher"
echo "Project: $ROOT"
echo "Node: $(node -v) ($(which node))"
echo

echo "Stopping old MedCRM processes on ports 3000, 3001, 3010 and 3002..."
for port in 3000 3001 3010 3002; do
  pids="$(lsof -ti tcp:$port || true)"
  if [ -n "$pids" ]; then
    kill -9 $pids 2>/dev/null || true
  fi
done

screen -XS medcrm-auth quit 2>/dev/null || true
screen -XS medcrm-gateway quit 2>/dev/null || true
screen -XS medcrm-frontend quit 2>/dev/null || true

echo "Building backend bundles for API Gateway..."
npm run build > "$LOG_DIR/build.log" 2>&1

echo "Starting auth-service on http://localhost:3001 ..."
screen -dmS medcrm-auth bash -lc "cd '$BACKEND' && PATH='$PATH' node -r ts-node/register -r tsconfig-paths/register apps/auth-service/src/main.ts >> '$LOG_DIR/auth-service.log' 2>&1"

echo "Starting API Gateway on http://localhost:3000 and internal gateway on http://localhost:3010 ..."
screen -dmS medcrm-gateway bash -lc "cd '$BACKEND' && PATH='$PATH' node dist/apps/api-gateway/main.js >> '$LOG_DIR/api-gateway.log' 2>&1"

echo "Starting frontend on http://localhost:3002 ..."
screen -dmS medcrm-frontend bash -lc "cd '$ROOT' && PATH='$PATH' npm run frontend:dev >> '$LOG_DIR/frontend.log' 2>&1"

echo "Waiting for health checks..."
for i in {1..30}; do
  auth_code="$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health || true)"
  gateway_code="$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health || true)"
  internal_code="$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3010/health || true)"
  frontend_code="$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/dashboard || true)"

  if [ "$auth_code" = "200" ] && [ "$gateway_code" = "200" ] && [ "$internal_code" = "200" ] && { [ "$frontend_code" = "200" ] || [ "$frontend_code" = "307" ] || [ "$frontend_code" = "308" ]; }; then
    echo
    echo "MedCRM services are running:"
    echo "  auth-service:      http://localhost:3001/health"
    echo "  public gateway:    http://localhost:3000/health"
    echo "  internal gateway:  http://localhost:3010/health"
    echo "  frontend:          http://localhost:3002/dashboard"
    echo
    echo "Logs:"
    echo "  $LOG_DIR/auth-service.log"
    echo "  $LOG_DIR/api-gateway.log"
    echo "  $LOG_DIR/frontend.log"
    echo "  $LOG_DIR/build.log"
    echo
    echo "Screen sessions:"
    screen -ls | grep 'medcrm-' || true
    echo
    echo "You can close this window. MedCRM processes will keep running in screen sessions."
    exit 0
  fi

  sleep 1
done

echo
echo "MedCRM startup did not pass health checks."
echo "Last health codes: auth=$auth_code gateway=$gateway_code internal=$internal_code frontend=$frontend_code"
echo "Check logs:"
echo "  $LOG_DIR/auth-service.log"
echo "  $LOG_DIR/api-gateway.log"
echo "  $LOG_DIR/frontend.log"
echo "  $LOG_DIR/build.log"
exit 1
