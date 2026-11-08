#!/usr/bin/env bash
# Builds a short as a muted picture and two audio stems, then mixes and masters them, and writes
# what gets posted to <media>/<slug>/upload/: the video, captions.srt and post.md.
#
#   tools/build.sh <slug>           # everything (every line needs its voice)
#   tools/build.sh <slug> --draft   # a quick picture with estimated timings, no voice needed: <media>/<slug>/video/draft.mp4
#   tools/build.sh <slug> --bed     # new music: the music stem only, then the mix (picture and voice kept)
set -euo pipefail
cd "$(dirname "$0")/.."
slug="${1:?usage: tools/build.sh <slug> [--draft|--bed]}"; only="${2:-}"
media=$(node -e "console.log(require('path').resolve(JSON.parse(require('fs').readFileSync('studio.json','utf8')).media||'media'))")
dir="$media/$slug/video"
mkdir -p "$dir"
node tools/brand.mjs >/dev/null
node tools/index.mjs >/dev/null
# A generous timeout: map tiles come over the network and a busy machine renders slowly.
render() { npx remotion render src/index.ts "$slug" "$@" --timeout=120000 --log=error; }

if [ "$only" = "--draft" ]; then
  node tools/check.mjs "$slug" --draft
  render "$dir/draft.mp4" --scale=0.5 --crf=28
  echo "$dir/draft.mp4"; exit 0
fi
node tools/check.mjs "$slug"
if [ "$only" != "--bed" ]; then
  render "$dir/picture.mp4" --muted --crf=16
  render "$dir/voice.wav" --codec=wav --props='{"stem":"voice"}'
fi
render "$dir/music.wav" --codec=wav --props='{"stem":"music"}'

bash tools/master.sh "$dir"
name=$(node -e "const s=JSON.parse(require('fs').readFileSync('studio.json','utf8'));console.log((s.upload?.name||'{slug}').replace('{slug}','$slug'))")
mkdir -p "$media/$slug/upload"
cp "$dir/short.master.mp4" "$media/$slug/upload/$name.mp4"
node tools/captions.mjs "$slug"
node tools/post.mjs "$slug"
echo "ready: $media/$slug/upload/"
