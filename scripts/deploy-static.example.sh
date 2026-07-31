#!/usr/bin/env bash
# Example static deploy — copy to deploy-static.local.sh (gitignored) or export vars.
# No secrets in this file. Do not commit filled-in hostnames with credentials.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Placeholders — override in the environment before running:
#   export HOST=user@203.0.113.10
#   export REMOTE_DIR=/var/www/broadcast-web
HOST="${HOST:-USER@HOST}"
REMOTE_DIR="${REMOTE_DIR:-/var/www/broadcast-web}"

if [[ "$HOST" == "USER@HOST" ]]; then
  echo "Set HOST and REMOTE_DIR first, e.g.:" >&2
  echo "  export HOST=deploy@YOUR_SERVER" >&2
  echo "  export REMOTE_DIR=/var/www/broadcast-web" >&2
  echo "  ./scripts/deploy-static.example.sh" >&2
  exit 1
fi

npm run build

rsync -avz --delete \
  -e ssh \
  "${ROOT}/dist/" \
  "${HOST}:${REMOTE_DIR}/"

echo "Uploaded dist/ → ${HOST}:${REMOTE_DIR}/"
echo "Smoke: https://YOUR_DOMAIN/ and https://YOUR_DOMAIN/?race=demo-istanbul"
echo "See docs/ops/hetzner-static-deploy.md"
