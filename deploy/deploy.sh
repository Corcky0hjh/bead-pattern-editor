#!/usr/bin/env bash
set -euo pipefail
target=/home/ubuntu/apps/sites/beads
test -f dist/index.html
test -d "$target"
# Update inside the mounted directory so the existing Caddy container sees it.
rsync -a --delete --delay-updates dist/ "$target/"
