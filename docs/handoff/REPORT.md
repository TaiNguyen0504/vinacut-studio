# VinaCut Studio — báo cáo bàn giao

Ngày kiểm thử: 2026-10-31. Repo được giữ nguyên không commit và không push.

## 1. Thay đổi theo hạng mục

### P0 — planner, structured output và action thật

- `electron/engine/planner.cjs`: thêm `PLAN_JSON_SCHEMA` dùng chung cho structured output; planner truyền schema cho provider; validator đồng bộ `select_layer`/`set_current_layer`; prompt mô tả đúng thứ tự nhập của lệnh sửa và TEXT/MTEXT.
- `electron/main.cjs`: Gemini dùng `responseJsonSchema`, OpenAI dùng `response_format.json_schema`, Anthropic dùng tool use; kết quả plan trả thêm số lượt thử `attempts`; parser lỏng vẫn là dự phòng.
- `electron/engine/actions.cjs`: lệnh sửa tự xác nhận preselection bằng Enter; Escape kiểm tra lệnh đã kết thúc; TEXT/MTEXT nhập qua editor UI và commit bằng click ngoài editor; `zoom_extents` chỉ thành công khi nút UI thật tồn tại.
- `src/vite-env.d.ts`: khai báo `attempts` cho response plan.

### P0 — bộ kiểm thử hồi quy

- `tools/e2e/run-plan.cjs`: chạy 3 brief offline qua IPC production, ghi `result.json` và `progress.log`.
- `tools/e2e/run-actions.cjs`: chạy các action previously untested: tạo/chọn layer, toggle mode, click, Escape, zoom, nhập value, MTEXT tiếng Việt, MOVE có preselection.
- `tools/e2e/run-real.cjs`: chạy plan thủ công trên DWG thật; hỗ trợ `DWG_PATH` để lặp trên nhiều file.
- `tools/e2e/contact-sheet.cjs`: tạo contact sheet bằng ffmpeg-static.
- `tools/e2e/run-ai.cjs`: chuẩn bị batch 10 brief AI trên hai DWG; key chỉ nằm trong memory và không ghi log.

### P1 — quay và dựng

- `electron/main.cjs`: đường manual capture hiện giữ lại Chromium `capturePage` image pipe vì probe `gdigrab` trên desktop phiên này tạo video đen; `sendAgentProgress` dead code đã được xoá.
- `electron/main.cjs`: `renderEditedVideo` sao chép Segoe UI/Arial vào thư mục tạm và truyền `fontsdir` cho ASS filter.
- `tools/e2e/run-manual-capture.cjs`: smoke test manual capture.
- `tools/e2e/run-legacy-render.cjs`: smoke test chèn phụ đề tiếng Việt vào footage nhập.

## 2. Bảng kết quả kiểm thử

Thời gian quay là thời gian `production:record` hoặc thời lượng capture; thời gian dựng là IPC `production:render` riêng khi runner có gọi bước đó. Các runner action/real tạo luôn MP4 4K trong bước record nên cột dựng ghi rõ `gộp trong record`.

| Brief | Plan hợp lệ ở lượt | OK/tổng | Thời gian quay | Thời gian dựng | Video | Contact sheet |
|---|---:|---:|---:|---:|---|---|
| Layer offline: đổi tên, đổi màu, xoá layer trống | preset (0) | 6/6 | 110.542 s | 0 ms | `docs/handoff/evidence/offline-2026-10-31T15-00-25-259Z/user-data/sessions/6daf6ba7-e4c5-4c63-9c2e-6cd1a059fc22/render_4k_1793458898630.mp4` | `docs/handoff/evidence/offline-2026-10-31T15-00-25-259Z/layer-edit-contact-sheet.jpg` |
| Vẽ RECTANG/LINE với Osnap | preset (0) | 5/5 | 131.985 s | 1 ms | `docs/handoff/evidence/offline-2026-10-31T15-00-25-259Z/user-data/sessions/c3e10844-7473-4b77-bceb-b9dce079374e/render_4k_1793459023267.mp4` | `docs/handoff/evidence/offline-2026-10-31T15-00-25-259Z/draw-osnap-contact-sheet.jpg` |
| Khoá, ẩn và bật lại layer | preset (0) | 5/5 | 69.783 s | 0 ms | `docs/handoff/evidence/offline-2026-10-31T15-00-25-259Z/user-data/sessions/252c9d09-98c3-4226-ab37-a681f3ddbba5/render_4k_1793459109368.mp4` | `docs/handoff/evidence/offline-2026-10-31T15-00-25-259Z/layer-visibility-contact-sheet.jpg` |
| DWG thật `260629_model-demo-t-corner.dwg`: zoom extents, mở Layers, pause | thủ công | 3/3 | 64.570 s | gộp trong record | `docs/handoff/evidence/real-2026-10-31T14-31-23-238Z/user-data/sessions/839edd50-8193-450e-b8b9-39bb05ee59c6/render_4k_1793457132609.mp4` | `docs/handoff/evidence/real-2026-10-31T14-31-23-238Z/contact-sheet.jpg` |
| DWG thật `260519_test-bat-diem.dwg`: zoom extents, mở Layers, pause | thủ công | 3/3 | 67.702 s | gộp trong record | `docs/handoff/evidence/real-2026-10-31T14-45-42-494Z/user-data/sessions/a325cd04-8c97-46ba-af96-15a14742a523/render_4k_1793457990324.mp4` | `docs/handoff/evidence/real-2026-10-31T14-45-42-494Z/contact-sheet.jpg` |
| Tạo và chọn layer | direct action plan | 3/3 | 52.921 s | gộp trong record | `docs/handoff/evidence/actions-2026-10-31T14-40-21-587Z/user-data/sessions/684332c4-a9c4-4664-b60e-bdcaee60734e/render_4k_1793457659208.mp4` | `docs/handoff/evidence/actions-2026-10-31T14-40-21-587Z/create-select-contact-sheet.jpg` |
| Toggle OSNAP, click Thuộc tính, Escape | direct action plan | 3/3 | 50.081 s | gộp trong record | `docs/handoff/evidence/actions-2026-10-31T14-33-10-027Z/user-data/sessions/ebbe9b11-52b9-4dba-a64a-b1788aebcfc6/render_4k_1793457277139.mp4` | `docs/handoff/evidence/actions-2026-10-31T14-33-10-027Z/mode-click-escape-contact-sheet.jpg` |
| Zoom vùng và nhập bán kính CIRCLE | direct action plan | 2/2 | 68.665 s | gộp trong record | `docs/handoff/evidence/actions-2026-10-31T14-33-10-027Z/user-data/sessions/03b6dc74-593a-46c7-960b-62ba3477d83b/render_4k_1793457346386.mp4` | `docs/handoff/evidence/actions-2026-10-31T14-33-10-027Z/zoom-value-contact-sheet.jpg` |
| MTEXT tiếng Việt | direct action plan | 1/1 | 78.033 s | gộp trong record | `docs/handoff/evidence/actions-2026-10-31T14-33-10-027Z/user-data/sessions/759852e8-0f92-47d8-8d21-dc406533a31c/render_4k_1793457425215.mp4` | `docs/handoff/evidence/actions-2026-10-31T14-33-10-027Z/text-vietnamese-contact-sheet.jpg` |
| Chọn đối tượng → MOVE → điểm đích | direct action plan | 2/2 | 70.975 s | gộp trong record | `docs/handoff/evidence/actions-2026-10-31T14-33-10-027Z/user-data/sessions/895bb400-088e-4895-9de5-39246c10f9cc/render_4k_1793457496708.mp4` | `docs/handoff/evidence/actions-2026-10-31T14-33-10-027Z/selection-move-contact-sheet.jpg` |
| Manual capture trên DWG thật | không có planner | 1/1 | 2.5 s | — | `docs/handoff/evidence/manual-capture-2026-10-31T14-56-43-025Z/manual-gdigrab.mp4` | `docs/handoff/evidence/manual-capture-2026-10-31T14-56-43-025Z/contact-sheet.jpg` |
| Footage nhập + phụ đề “Xin chào VinaCAD” | không có planner | 1/1 | — | FFmpeg thành công | `docs/handoff/evidence/legacy-render-2026-10-31T14-50-28-000Z/legacy-caption-1080p.mp4` | `docs/handoff/evidence/legacy-render-2026-10-31T14-50-28-000Z/contact-sheet.jpg` |
| Batch 10 brief AI (`run-ai.cjs`) | chưa chạy | 0/0 | — | — | chưa có | `docs/handoff/evidence/ai-2026-10-31T14-02-43-380Z/progress.log` |

Các video production có khung 3840×2160; contact sheet đã được mở kiểm tra bằng mắt. Bản manual capture trong bảng là đường image pipe đã được giữ lại, dù tên file lịch sử chứa `gdigrab`.

Kiểm tra tĩnh cuối cùng đều đạt: `npx tsc --noEmit -p .`, `node --check` cho toàn bộ `electron/*.cjs` và `tools/e2e/*.cjs`, cùng `npm run build`.

## 3. Chưa làm được và giới hạn

- P0 “10 brief AI, tối thiểu 9/10 thành công” chưa thể chạy. Người dùng đã cho phép dùng key, nhưng cấu hình `vinacut-ai-config` của profile app chỉ có provider Google/model và không có giá trị `apiKey`; `tools/e2e/run-ai.cjs` dừng trước request và ghi rõ “chưa gửi request nào”. Không có key nào được ghi vào source, log hoặc báo cáo.
- Chrome Computer Use không thể tiếp tục trong phiên này vì lớp an toàn không xác định được URL trình duyệt Windows với độ tin cậy đủ cao. Vì vậy không tự lấy key từ AI Studio và không giả lập kết quả AI.
- Hai DWG thật đã được nạp và quay bằng plan thủ công 3/3; phần AI trên hai DWG chỉ mới có runner chờ sẵn, chưa có số lượt plan/retry hay tỉ lệ AI.
- P1 tự sửa một lần khi action lỗi chưa bật vì tính năng này chỉ được phép dùng khi có API key thật.
- Probe `gdigrab` (`docs/handoff/evidence/manual-capture-2026-10-31T14-53-15-716Z`) tạo đúng stream 60 fps nhưng khung đen trong desktop session hiện tại. Theo yêu cầu handoff, app giữ image pipe đã kiểm chứng; cần chạy lại probe trên desktop tương tác ở scale 100% và 125% trước khi thay thế.
- Chưa xoá các nhánh capture nền còn dùng cho đường manual; chỉ xoá `sendAgentProgress` sau khi `rg` xác nhận không còn caller.

## 4. Lệnh chạy lại toàn bộ bộ hồi quy

Chạy từ `C:\Users\taing\Desktop\Video-MKT` trong PowerShell:

```powershell
$env:ELECTRON_RUN_AS_NODE = $null

& .\node_modules\.bin\electron.cmd tools\e2e\run-plan.cjs
& .\node_modules\.bin\electron.cmd tools\e2e\run-actions.cjs
& .\node_modules\.bin\electron.cmd tools\e2e\run-real.cjs
$env:DWG_PATH = 'C:\Users\taing\Downloads\260519_test-bat-diem.dwg'
& .\node_modules\.bin\electron.cmd tools\e2e\run-real.cjs
Remove-Item Env:DWG_PATH -ErrorAction SilentlyContinue

& .\node_modules\.bin\electron.cmd tools\e2e\run-manual-capture.cjs
& .\node_modules\.bin\electron.cmd tools\e2e\run-legacy-render.cjs

node tools\e2e\contact-sheet.cjs <video.mp4> <contact-sheet.jpg>
npx tsc --noEmit -p .
Get-ChildItem electron,tools\e2e -Filter *.cjs -Recurse | ForEach-Object { node --check $_.FullName }
npm run build
```

Khi API key đã có trong cấu hình app, chạy thêm:

```powershell
& .\node_modules\.bin\electron.cmd tools\e2e\run-ai.cjs
```

Runner AI chỉ đọc key vào bộ nhớ, không in key và không ghi key vào `result.json`.
