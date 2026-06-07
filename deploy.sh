#!/bin/bash
cd /home/rich/credit-dashboard

git fetch origin
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse @{u})

if [ "$LOCAL" != "$REMOTE" ]; then
  echo "Changes detected. Pulling..."
  git pull

  if [[ "$(git diff HEAD@{1}..HEAD -- package.json)" != "" ]]; then
    echo "package.json changed, reinstalling..."
    npm install
  fi

  npm run build
  echo "Deploy complete. Restarting server..."
  pkill -f "next dev" 2>/dev/null
  npm run dev > /tmp/next-dev.log 2>&1 &
fi
