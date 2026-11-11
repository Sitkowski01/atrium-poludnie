#!/usr/bin/env bash
# Wszystkie panoramy w 6144 px, układ po układzie; po każdym od razu wersje dla strony.
# Uruchomienie z katalogu projektu: bash blender/render-pano6.sh
set -e
BLENDER="${BLENDER:-/c/Program Files/Blender Foundation/Blender 5.1/blender.exe}"
D="$(cygpath -m "$PWD")"
for slot in s0 s1 s2 s3 s4 s4n; do
  SECONDS=0
  "$BLENDER" --background --python blender/wnetrze.py -- "$D/blender/plany.json" "$slot" "$D/blender/render/pano6" - 6144 80 \
    2>&1 | grep -E "Error|Traceback|usuniete" || true
  echo "$slot: ${SECONDS}s"
  node blender/pano-web.mjs blender/render/pano6
done
echo koniec
