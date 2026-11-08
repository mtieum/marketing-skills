#!/usr/bin/env bash
# Mixes a build's stems (voice.wav + music.wav, levels already set in the render) under its picture
# and brings the mix to the loudness the short-video apps play at (-14 LUFS, peaks under -1.5 dBTP),
# in two passes so the level is measured, not guessed; the picture is copied as it is.
#   tools/master.sh <media>/<slug>/video   # writes short.master.mp4 there
set -euo pipefail
dir="${1%/}"; out="$dir/short.master.mp4"
target='I=-14:TP=-1.5:LRA=11'
mix='[0:a][1:a]amix=inputs=2:duration=longest:normalize=0'
m=$(ffmpeg -hide_banner -i "$dir/voice.wav" -i "$dir/music.wav" -filter_complex "$mix,loudnorm=$target:print_format=json" -f null - 2>&1 | sed -n '/^{/,/^}/p')
get() { echo "$m" | python3 -c "import json,sys; print(json.load(sys.stdin)['$1'])"; }
ffmpeg -hide_banner -loglevel error -y -i "$dir/voice.wav" -i "$dir/music.wav" -i "$dir/picture.mp4" \
  -filter_complex "$mix,loudnorm=$target:measured_I=$(get input_i):measured_TP=$(get input_tp):measured_LRA=$(get input_lra):measured_thresh=$(get input_thresh):offset=$(get target_offset):linear=true[a]" \
  -map 2:v -map '[a]' -c:v copy -ar 48000 -c:a aac -b:a 192k -shortest -movflags +faststart "$out"
echo "$out"
