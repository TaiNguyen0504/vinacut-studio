"""Create small sheets and a per-action index without changing source evidence."""
import json
import re
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(sys.argv[1]).resolve()
font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 16)
index = ['# Danh mục checkpoint', '', 'Mô tả lấy từ action log; nhận xét hình ảnh được ghi riêng trong REPORT_3.', '']
folders = sorted(root.glob('frames-*'))
if (root / 'checkpoints').is_dir():
    folders.append(root / 'checkpoints')
if not folders and any(root.glob('*.jpg')):
    folders = [root]
for folder in folders:
    case_id = 'checks' if folder == root else folder.name.removeprefix('frames-')
    timeline_file = root / f'{case_id}-timeline.json'
    descriptions = {}
    if timeline_file.exists():
        timeline = json.loads(timeline_file.read_text(encoding='utf-8-sig'))
        for action in timeline.get('actions', []):
            descriptions[Path(action.get('checkpoint') or '').name] = action.get('intent', '')
    result_file = root / 'result.json'
    if result_file.exists():
        result = json.loads(result_file.read_text(encoding='utf-8-sig'))
        rows = result.get('cases', [result])
        for row in rows:
            if row.get('id') not in [case_id, None]:
                continue
            for action in (row.get('record') or row).get('actions', []):
                descriptions[Path(action.get('checkpoint') or '').name] = action.get('intent', '')
    files = sorted((p for p in folder.glob('*.jpg') if '-checkpoints-' not in p.name and '-contact' not in p.name), key=lambda p: (p.name == 'final.jpg', [int(part) if part.isdigit() else part for part in re.split(r'(\d+)', p.name)]))
    index += [f'## {case_id}', '', '| Khung | Mô tả action log |', '|---|---|']
    for frame in files:
        description = descriptions.get(frame.name, 'Khung cuối' if frame.name == 'final.jpg' else 'Xem ảnh gốc')
        index.append(f'| [{frame.name}]({frame.relative_to(root).as_posix()}) | {description.replace(chr(10), " ").replace("|", "/")} |')
    index.append('')
    for page in range(0, len(files), 8):
        frames = files[page:page + 8]
        sheet = Image.new('RGB', (2560, ((len(frames) + 3) // 4) * 390), '#111827')
        draw = ImageDraw.Draw(sheet)
        for i, frame in enumerate(frames):
            x, y = i % 4 * 640, i // 4 * 390
            draw.text((x + 6, y + 6), frame.stem, font=font, fill='white')
            with Image.open(frame) as im:
                im.thumbnail((640, 360))
                sheet.paste(im, (x, y + 30))
        sheet.save(root / f'{case_id}-checkpoints-{page // 8 + 1}.jpg', quality=90)
(root / 'frames-index.md').write_text('\n'.join(index), encoding='utf-8')
print(str(root / 'frames-index.md'))
