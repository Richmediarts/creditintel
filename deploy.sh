#!/bin/bash
export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:/usr/local/bin:/usr/bin:/bin"
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

cd /home/rich/credit-dashboard || exit 1

git fetch origin
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse @{u})

if [ "$LOCAL" != "$REMOTE" ]; then
  echo "[$(date)] Changes detected. Pulling..."
  git pull

  if [ -n "$(git diff HEAD@{1}..HEAD -- package.json 2>/dev/null)" ]; then
    echo "[$(date)] package.json changed, reinstalling..."
    npm install
  fi

  echo "[$(date)] Building..."
  npm run build

  echo "[$(date)] Restarting server..."
  pkill -f "next-server (v16" 2>/dev/null
  sleep 2
  nohup npm run dev > /tmp/next-dev.log 2>&1 &
  echo "[$(date)] Deploy complete."
fi
