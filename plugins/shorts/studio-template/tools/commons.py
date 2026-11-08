"""
Photos from Wikimedia Commons with their licence, for the shorts.

    python3 tools/commons.py search "Charles Bridge Prague"
    python3 tools/commons.py get "File:Prague_at_sunrise.jpg" <media>/<slug>/shots/bridge.jpg

`search` lists files with their size and licence. `get` downloads one and
prints the credit to paste into the shot in shorts/<slug>.json, built from the file's own
metadata so the author and licence are never typed from memory. Licences that
don't allow commercial reuse (NC), or don't allow changes such as cropping and
captions (ND), are refused: shorts promote a business and crop every photo.
"""

import html
import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

API = 'https://commons.wikimedia.org/w/api.php'
ROOT = Path(__file__).resolve().parents[1]
# Wikimedia asks every client to say who it is and how to reach them: studio.json "contact".
_contact = json.loads((ROOT / 'studio.json').read_text()).get('contact') or ''
if not _contact:
    sys.exit('set "contact" in studio.json (a URL or email for your project): Wikimedia asks every client for one')
AGENT = f'ShortsStudio/1.0 ({_contact})'


def call(**params: str) -> dict:
    query = urllib.parse.urlencode({'format': 'json', 'formatversion': '2', **params})
    request = urllib.request.Request(f'{API}?{query}', headers={'User-Agent': AGENT})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def plain(value: str) -> str:
    """Commons metadata is HTML: keep the words."""
    return html.unescape(re.sub(r'<[^>]+>', '', value or '')).strip()


def info(titles: str) -> list[dict]:
    pages = call(action='query', prop='imageinfo', titles=titles,
                 iiprop='url|size|extmetadata', iiurlwidth='2160')['query']['pages']
    found = []
    for page in pages:
        if 'imageinfo' not in page:
            continue
        ii = page['imageinfo'][0]
        meta = ii.get('extmetadata', {})
        licence = plain(meta.get('LicenseShortName', {}).get('value', ''))
        found.append({
            'title': page['title'], 'width': ii['width'], 'height': ii['height'],
            'url': ii.get('thumburl') or ii['url'], 'page': ii['descriptionurl'],
            'licence': licence, 'author': plain(meta.get('Artist', {}).get('value', '')) or 'unknown author',
            'usable': licence != '' and not re.search(r'\bNC\b|\bND\b|non-?commercial|no ?deriv', licence, re.I),
        })
    return found


def search(words: str) -> None:
    hits = call(action='query', list='search', srsearch=f'{words} filetype:bitmap', srnamespace='6', srlimit='20')
    titles = '|'.join(hit['title'] for hit in hits['query']['search'])
    if not titles:
        print('nothing found')
        return
    for f in info(titles):
        mark = 'ok ' if f['usable'] else 'NO '
        upright = 'upright' if f['height'] >= f['width'] else 'wide'
        print(f"{mark} {f['width']}x{f['height']} {upright:7} {f['licence']:16} {f['title']}")


def get(title: str, target: Path) -> None:
    found = info(title)
    if not found:
        sys.exit(f'no such file: {title}')
    f = found[0]
    if not f['usable']:
        sys.exit(f"refused: {f['licence'] or 'no licence given'} doesn't allow commercial reuse with changes")
    target.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(f['url'], headers={'User-Agent': AGENT})
    with urllib.request.urlopen(request, timeout=60) as response:
        target.write_bytes(response.read())
    print(f'saved {target}')
    # Ready to paste into the shot.
    print(f"\"credit\": \"Photo: {f['author']}, {f['licence']}, via Wikimedia Commons ({f['page']})\"")


if __name__ == '__main__':
    if len(sys.argv) == 3 and sys.argv[1] == 'search':
        search(sys.argv[2])
    elif len(sys.argv) == 4 and sys.argv[1] == 'get':
        get(sys.argv[2], Path(sys.argv[3]))
    else:
        sys.exit(__doc__)
