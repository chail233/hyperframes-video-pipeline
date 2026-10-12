#!/usr/bin/env bash
# shoot-freeze.sh — pixel harness: screenshot .verify/freeze-<id>.html (GSAP seeked to ?t=)
# with headless Chrome/Edge over file://, then diff two seconds with motion-diff.mjs.
# usage:
#   bash shoot-freeze.sh --project <dir> --id <frame-id> --prefix <name> --t 6.0 --t 6.1
#   env: EDGE or CHROME picks the browser, SIZE overrides 1920x1080, OUTDIR the PNG folder
set -euo pipefail

PROJ="" ID="" PREFIX="freeze" SIZE="1920,1080" TS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --project) PROJ="$2"; shift 2 ;;
    --id)      ID="$2"; shift 2 ;;
    --prefix)  PREFIX="$2"; shift 2 ;;
    --size)    SIZE="$2"; shift 2 ;;
    --t)       TS+=("$2"); shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done
[ -n "$PROJ" ] || PROJ="$(pwd)"
PROJ="$(cd "$PROJ" && pwd)" || { echo "no such project dir: $PROJ" >&2; exit 2; }
[ -n "$ID" ] || { echo "usage: shoot-freeze.sh --project <dir> --id <frame-id> --t <sec> [--t <sec> ...]" >&2; exit 2; }
[ ${#TS[@]} -gt 0 ] || { echo "give at least one --t <seconds>" >&2; exit 2; }

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BROWSER="${EDGE:-${CHROME:-}}"
if [ -z "$BROWSER" ]; then
  for cand in \
    "/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" \
    "/c/Program Files/Microsoft/Edge/Application/msedge.exe" \
    "/c/Program Files/Google/Chrome/Application/chrome.exe" \
    "$(command -v chromium || true)" "$(command -v google-chrome || true)"
  do
    [ -n "$cand" ] && [ -x "$cand" ] && BROWSER="$cand" && break
  done
fi
[ -n "$BROWSER" ] || { echo "no Chrome/Edge found; set EDGE=/path/to/msedge.exe" >&2; exit 1; }

node "$SKILL_DIR/build-freeze.mjs" --project "$PROJ" --id "$ID" >/dev/null

# a Windows .exe needs Windows paths; a posix binary takes the absolute path as-is.
native() {
  if [[ "$BROWSER" == *.exe ]]; then cygpath -w "$1" 2>/dev/null || echo "$1"; else echo "$1"; fi
}
urlpath() {
  if [[ "$BROWSER" == *.exe ]]; then
    cygpath -w "$1" 2>/dev/null | tr '\\' '/' | sed 's|^|file:///|'
  else
    echo "file://$1"
  fi
}

OUTDIR="${OUTDIR:-$PROJ/snapshots}"
mkdir -p "$OUTDIR"
FREEZE="$PROJ/.verify/freeze-${ID}.html"
for T in "${TS[@]}"; do
  OUT="$OUTDIR/${PREFIX}-t${T}.png"
  PROF="$(mktemp -d)"
  # --timeout is the browser's own page budget; the || true keeps a slow paint from
  # aborting the batch. Each shot gets a private profile so nothing is shared with —
  # and nothing kills — the user's running browser.
  "$BROWSER" --headless --disable-gpu --hide-scrollbars --no-first-run \
    --user-data-dir="$(native "$PROF")" \
    --screenshot="$(native "$OUT")" --window-size="$SIZE" --timeout=15000 \
    "$(urlpath "$FREEZE")?t=${T}" >/dev/null 2>&1 || true
  rm -rf "$PROF"
  [ -f "$OUT" ] && echo "$OUT" || echo "MISSING $OUT (browser produced no screenshot)" >&2
done
