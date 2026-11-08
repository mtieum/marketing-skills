"""
Voices a short's lines with Kokoro, a free voice model that runs on this computer.

    <python with kokoro installed> tools/voice-kokoro.py <slug> [--force]

studio.json: voice.voice is a Kokoro voice (e.g. bf_emma, am_michael: the first letter is the accent,
a = American, b = British), voice.python the Python that has kokoro (pip install kokoro soundfile).
Writes <media>/<slug>/voice/raw/NN.wav for lines without one, then run tools/voice-finish.mjs.
"""
import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro import KPipeline

ROOT = Path(__file__).resolve().parents[1]
studio = json.loads((ROOT / 'studio.json').read_text())
media = (ROOT / studio.get('media', 'media')).resolve()
slug = sys.argv[1]
force = '--force' in sys.argv
short = json.loads((ROOT / 'shorts' / f'{slug}.json').read_text())
voice = studio.get('voice', {}).get('voice') or 'bf_emma'
pipeline = KPipeline(lang_code=voice[0], repo_id='hexgrad/Kokoro-82M')
out = media / slug / 'voice' / 'raw'
out.mkdir(parents=True, exist_ok=True)
for i, section in enumerate(short['sections']):
    target = out / f'{i:02}.wav'
    if target.exists() and not force:
        continue
    audio = [np.asarray(r.audio) for r in pipeline(section['vo'], voice=voice) if r.audio is not None]
    sf.write(target, np.concatenate(audio), 24000)
    print(f'line {i}: {target}')
