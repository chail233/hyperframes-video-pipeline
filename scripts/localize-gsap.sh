#!/usr/bin/env bash
# Localize GSAP into a HyperFrames project's assets/vendor/ so renders/previews work
# when the external CDN is unreachable (npm registry IS reachable). Idempotent.
# Usage: bash localize-gsap.sh <project-dir-relative-to-repo-root>
# e.g.   bash <SKILL_DIR>/scripts/localize-gsap.sh projects/my-video
set -euo pipefail

GSAP_VERSION="${GSAP_VERSION:-3.14.2}"
PROJ="${1:-}"
if [ -z "$PROJ" ]; then
  echo "ERROR: pass the project directory, e.g. localize-gsap.sh projects/my-video" >&2
  exit 2
fi

VENDOR_DIR="$PROJ/assets/vendor"
DEST="$VENDOR_DIR/gsap.min.js"

if [ -f "$DEST" ]; then
  echo "OK: $DEST already exists — nothing to do."
  echo "Ensure index.html uses: <script src=\"assets/vendor/gsap.min.js\"></script>"
  exit 0
fi

mkdir -p "$VENDOR_DIR"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Fetching gsap@${GSAP_VERSION} via npm pack (registry is reachable, CDN is not)..."
( cd "$TMP" && npm pack "gsap@${GSAP_VERSION}" >/dev/null 2>&1 )
TARBALL="$(ls "$TMP"/gsap-*.tgz | head -1)"
tar -xzf "$TARBALL" -C "$TMP"

SRC="$TMP/package/dist/gsap.min.js"
if [ ! -f "$SRC" ]; then
  echo "ERROR: dist/gsap.min.js not found in the packed tarball." >&2
  exit 1
fi

cp "$SRC" "$DEST"
echo "OK: wrote $DEST"
echo "Next: edit $PROJ/index.html and replace the CDN script tag with:"
echo "  <script src=\"assets/vendor/gsap.min.js\"></script>"
