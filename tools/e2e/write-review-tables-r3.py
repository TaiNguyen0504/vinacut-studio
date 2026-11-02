"""Combine measured results with separately written visual observations."""
import argparse
import json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--groups', default='actions,offline,t-corner,bat-diem,ai')
args = parser.parse_args()
repo = Path(__file__).resolve().parents[2]
handoff = repo / 'docs/handoff'
evidence = handoff / 'evidence'


def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def esc(value):
    return str(value).replace('|', '/').replace('\n', ' ')


def link(label, path):
    if not path:
        return '—'
    path = Path(path)
    if not path.exists():
        raise RuntimeError(f'Missing evidence: {path}')
    return f'[{label}]({path.relative_to(handoff).as_posix()})'


def seconds(value):
    return '—' if value is None else f'{value / 1000:.2f}'


observations = read(evidence / 'visual-observations-r3.json')
output = ['## 9. Kết quả đo và kiểm tra ảnh từng action', '',
          'Số liệu lấy từ result/timeline; mô tả ảnh được ghi thủ công sau khi mở xem. '
          'Quay là timings.recordMs; dựng là lần force:true, hoặc lần dựng đầu của session mới đối với actions. '
          'Không dùng tổng thời gian IPC production:record làm thời gian quay riêng.', '']
for group in args.groups.split(','):
    review = observations[group]
    root = evidence / review['run']
    result = read(root / 'result.json')
    rows = result.get('cases', [result])
    output += [f'### {group}', '', f'Nguồn: {link("result.json", root / "result.json")}.', '',
               '| Case/brief | Plan / lượt thử | Action | Clean state | Quay (s) | Dựng (s) | Video (s) | Bằng chứng |',
               '|---|---|---|---|---:|---:|---:|---|']
    detail = []
    for row in rows:
        case_id = row.get('id', group)
        record = row.get('record') or row
        actions = record.get('actions', [])
        notes = review.get('cases', {}).get(case_id, review.get('actions', []))
        if isinstance(notes, dict):
            visual = notes
            notes = visual['actions']
        else:
            visual = {}
        if len(notes) != len(actions):
            raise RuntimeError(f'{case_id}: {len(notes)} observations / {len(actions)} actions')
        timing = record.get('timings') or {}
        render = row.get('render') or {}
        render_ms = render.get('renderMsReported', render.get('ms', timing.get('rerenderMs', timing.get('renderMs'))))
        video = render.get('evidencePath') or record.get('video') or render.get('path')
        frames = Path(record.get('framesDir') or root / f'frames-{case_id}')
        contact = root / f'{case_id}-contact.jpg'
        clean = sum(all(a.get('cleanState', {}).get(k) is True for k in
                        ['commandIdle', 'editorClosed', 'pickerClosed', 'menusClosed']) for a in actions)
        ok = sum(a.get('ok') is True for a in actions)
        plan = row.get('plan') or {}
        attempts = plan.get('attempts', 'cố định')
        if group == 'ai':
            attempts = f'{"Hợp lệ" if plan.get("valid") else "Chưa có plan"} / {attempts}'
        brief = row.get('brief') or plan.get('title') or case_id
        proofs = link('MP4', video) + ' · ' + link('contact', contact if contact.exists() else None) + ' · ' + link('frames', frames if frames.exists() else None)
        action_status = f'{ok}/{len(actions)}' if actions else 'chưa quay'
        clean_status = f'{clean}/{len(actions)}' if actions else '—'
        duration = f'{record.get("duration", 0):.2f}' if video else '—'
        output.append(f'| {esc(case_id + ": " + brief)} | {attempts} | {action_status} | {clean_status} | {seconds(timing.get("recordMs"))} | {seconds(render_ms)} | {duration} | {proofs} |')
        command = record.get('finalCommandLine')
        if command is None and record.get('sessionId'):
            timelines = list(root.glob(f'**/{record["sessionId"]}/timeline.json'))
            if timelines:
                command = read(timelines[0]).get('finalCommandLine')
        command_text = (command or {}).get('text') or ''
        if isinstance(command_text, list):
            command_text = ' '.join(command_text)
        visible = (command or {}).get('inputValue') or command_text or (command or {}).get('placeholder') or 'Không có snapshot cuối (case lỗi)'
        detail += [f'#### {case_id}', '', f'Dòng lệnh ở khung cuối: **{esc(visible)}**.']
        if group == 'ai':
            detail += [f'Validator: {esc(json.dumps(plan.get("validationErrors", []), ensure_ascii=False))}.',
                       f'Kết luận xem ảnh/phụ đề: {esc(visual.get("conclusion", "CHƯA REVIEW")).rstrip(". ")}.',
                       f'Đạt bằng xem ảnh: {"Có" if visual.get("pass", False) else "Không"}.']
        if row.get('error'):
            detail += [f'Lỗi: {esc(row["error"].splitlines()[0])}.']
        detail += ['', '| Action | Quan sát ảnh |', '|---|---|']
        for number, (action, note) in enumerate(zip(actions, notes), 1):
            frame = frames / Path(action.get('checkpoint') or '').name
            detail.append(f'| {link(str(number), frame)} | {esc(note)} |')
        final = frames / 'final.jpg'
        if final.exists():
            detail += [f'| {link("Cuối", final)} | Dòng lệnh như ghi ở trên; đối chiếu trạng thái cuối trong JSON. |']
        detail.append('')
    output += [''] + detail
destination = evidence / 'review-tables-r3.md'
destination.write_text('\n'.join(output) + '\n', encoding='utf-8')
print(destination)
