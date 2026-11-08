"""
Video clips from Pixabay, for the shorts: real footage of the place, where a
still would only be panned.

    python3 tools/pixabay.py search "Charles Bridge Prague"
    python3 tools/pixabay.py search "Charles Bridge Prague" --thumbs /tmp/look
    python3 tools/pixabay.py get 123456 <media>/<slug>/shots/bridge.mp4

`search` lists clips with their length and how sharp they stay once cropped
upright ("upright" is the width left after the 9:16 crop; under 1080 is soft),
and with --thumbs saves a still of each, named by id, to look at before
choosing. `get` downloads the sharpest version of one clip and prints the
credit to paste into the shot in shorts/<slug>.json.

Pixabay's licence allows commercial use with changes and asks no credit, but
the shorts credit every picture anyway. Search matches on uploaders' tags, so
look at every clip before using it: a clip tagged "Prague" is not always
Prague, and Pixabay also hosts generated footage, which must never be shown as a
real place.

The key is PIXABAY_API, from the environment or the studio's .env.
"""

import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

import os

API = 'https://pixabay.com/api/videos/'
ROOT = Path(__file__).resolve().parents[1]
AGENT = 'ShortsStudio/1.0'


def secret(name: str) -> str | None:
    """A key from the environment, or from the studio's .env."""
    if os.environ.get(name):
        return os.environ[name]
    env = ROOT / '.env'
    if env.exists():
        for line in env.read_text().splitlines():
            key, _, value = line.partition('=')
            if key.strip() == name:
                return value.strip().strip('"') or None
    return None


def key() -> str:
    return secret('PIXABAY_API') or sys.exit('no PIXABAY_API in the environment or .env')


def call(**params: str) -> dict:
    query = urllib.parse.urlencode({'key': key(), **params})
    request = urllib.request.Request(f'{API}?{query}', headers={'User-Agent': AGENT})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def upright(rendition: dict) -> int:
    """The width left once the clip is cropped to 9:16 (an upright clip keeps all of it)."""
    return min(rendition['width'], rendition['height'] * 9 // 16)


def sharpest(hit: dict) -> dict:
    renditions = [r for r in hit['videos'].values() if r.get('url')]
    return max(renditions, key=lambda r: (upright(r), -r.get('size', 0)))


def fetch(url: str, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(url, headers={'User-Agent': AGENT})
    with urllib.request.urlopen(request, timeout=120) as response:
        target.write_bytes(response.read())


def search(words: str, thumbs: Path | None) -> None:
    hits = call(q=words, per_page='20', safesearch='true')['hits']
    if not hits:
        print('nothing found')
        return
    for hit in hits:
        best = sharpest(hit)
        mark = 'ok  ' if upright(best) >= 1080 else 'soft'
        print(f"{mark} {hit['id']:>9} {hit['duration']:>3}s {best['width']}x{best['height']} upright {upright(best):>4}  "
              f"{hit['user']}: {hit['tags']}")
        if thumbs and best.get('thumbnail'):
            fetch(best['thumbnail'], thumbs / f"{hit['id']}.jpg")
    if thumbs:
        print(f'stills in {thumbs}')


def get(clip: str, target: Path) -> None:
    hits = call(id=clip)['hits']
    if not hits:
        sys.exit(f'no such clip: {clip}')
    hit = hits[0]
    best = sharpest(hit)
    fetch(best['url'], target)
    print(f"saved {target}  {best['width']}x{best['height']}, {hit['duration']}s")
    if upright(best) < 1080:
        print(f'  soft: only {upright(best)} px wide once upright')
    # Ready to paste into the shot.
    print(f"\"credit\": \"Video: {hit['user']}, via Pixabay ({hit['pageURL']})\"")


if __name__ == '__main__':
    args = sys.argv[1:]
    if len(args) in (2, 4) and args[0] == 'search' and (len(args) == 2 or args[2] == '--thumbs'):
        search(args[1], Path(args[3]) if len(args) == 4 else None)
    elif len(args) == 3 and args[0] == 'get':
        get(args[1], Path(args[2]))
    else:
        sys.exit(__doc__)
