"""Check rendered E2E videos against their recorded timelines, without re-rendering."""
import json
from pathlib import Path
import re
import subprocess
import sys

repo = Path(__file__).resolve().parents[2]
ffmpeg = repo / 'node_modules/ffmpeg-static/ffmpeg.exe'
all_passed = True
for argument in sys.argv[1:]:
    root = Path(argument).resolve()
    result = json.loads((root / 'result.json').read_text(encoding='utf-8-sig'))
    rows = []
    for case in result.get('cases', [result]):
        record = case.get('record') or case
        render = case.get('render') or {}
        video = render.get('evidencePath') or record.get('video') or render.get('path')
        if not video:
            raise RuntimeError(f'No video for {case.get("id", root.name)}')
        probe = subprocess.run([str(ffmpeg), '-hide_banner', '-i', video],
                               capture_output=True, text=True, encoding='utf-8',
                               errors='replace', timeout=15,
                               creationflags=subprocess.CREATE_NO_WINDOW)
        duration_match = re.search(r'Duration: (\d+):(\d+):([\d.]+)', probe.stderr)
        size_match = re.search(r'Video:.*?\b(\d{3,5})x(\d{3,5})\b', probe.stderr)
        fps_match = re.search(r'Video:.*?\b([\d.]+) fps', probe.stderr)
        if not all([duration_match, size_match, fps_match]):
            raise RuntimeError(f'Cannot probe {video}')
        h, m, s = map(float, duration_match.groups())
        duration = h * 3600 + m * 60 + s
        width, height = map(int, size_match.groups())
        fps = float(fps_match[1])
        timeline_duration = record['duration']
        ok = width == 3840 and height == 2160 and fps == 60 and abs(duration - timeline_duration) <= .15
        rows.append(dict(id=case.get('id', root.name), ok=ok, duration=duration,
                         timelineDuration=timeline_duration, width=width, height=height, fps=fps))
    passed = bool(rows) and all(row['ok'] for row in rows)
    all_passed = all_passed and passed
    (root / 'media-probe.json').write_text(json.dumps(dict(passed=passed, rows=rows), indent=2), encoding='utf-8')
    print(json.dumps(dict(root=root.name, passed=passed, videos=len(rows))))
sys.exit(0 if all_passed and len(sys.argv) > 1 else 1)
