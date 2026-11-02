# VinaCut Studio — báo cáo vòng 2

Ngày kiểm thử: 2026-11-01. Phạm vi là C:\Users\taing\Desktop\Video-MKT; không sửa _backup_before_claude_20261031/, P1_web/ hoặc P1_origin/; không commit và không push.

Người dùng đã cấp phép dùng API key đã lưu trong app để chạy batch P0. Khi thực thi, runner được yêu cầu chỉ đọc bốn biến môi trường và không tìm key trong profile/localStorage. Môi trường hiện tại không có VINACUT_AI_KEY, vì vậy runner dừng trước request; không có request AI thật nào được gửi và không có key nào được ghi ra.

## 1. Thay đổi theo hạng mục

### P0 — kiểm chứng UI thật và hậu điều kiện

- electron/engine/actions.cjs: thêm assertCleanState sau mỗi action; kiểm tra command idle, prompt treo, editor MTEXT, color picker và menu/popup. select và open_panel là hai trạng thái được cho phép có chủ đích.
- electron/engine/actions.cjs: đọc snapshot entity và extents để xác nhận kết quả. CIRCLE kiểm bán kính/tâm; lệnh tạo kiểm loại/vị trí; MOVE kiểm vector extents; COPY kiểm số lượng và bản gốc; ROTATE kiểm thay đổi hình học; ERASE kiểm số entity giảm; OFFSET kiểm entity mới và khoảng cách; MTEXT kiểm chuỗi UTF-8 và chiều cao; zoom kiểm vùng nằm trong canvas.
- electron/engine/actions.cjs: bỏ Enter tự động khi bắt đầu lệnh sửa; phân loại prompt thật thành chọn đối tượng, điểm và value. MTEXT dùng thanh editor thật, ô textbox [data-text-editor-input][role="textbox"] và nút ✓ button[aria-label="Apply text"].
- electron/engine/planner.cjs: bỏ TEXT khi chưa có luồng đã kiểm chứng; MTEXT nhận height, giới hạn value 120 ký tự và không cắt im lặng; toggle bắt buộc có on; system prompt mô tả đúng MOVE/COPY/ROTATE/ERASE/OFFSET.
- electron/engine/actions.cjs, planner.cjs: camera lấy extents của drawing context, tính thêm kích thước từ value và không cho hộp zoom nhỏ hơn khoảng 13% cạnh dài. Nhờ vậy vùng thao tác vẫn còn ngữ cảnh mặt bằng.

### P0 — structured output và runner AI

- electron/main.cjs: OpenAI gửi JSON schema với strict: false; Google/Anthropic/OpenAI có fallback một lần sang JSON mode khi provider trả lỗi 400 liên quan schema/response_format/tool.
- tools/e2e/check-ai-requests.cjs: kiểm tra request body offline cho Google, OpenAI, Anthropic và nhánh fallback.
- tools/e2e/run-ai.cjs: chỉ đọc VINACUT_AI_PROVIDER, VINACUT_AI_MODEL, VINACUT_AI_BASE_URL, VINACUT_AI_KEY; đặt userData theo thư mục evidence; không dùng localStorage/profile và không in key. Batch dựng sẵn 10 brief cụ thể từ context của hai DWG, đồng thời lưu captions/clean-state/action types.
- tools/e2e/run-ai.cjs, tools/e2e/run-actions.cjs: sao chép MP4 ra thư mục evidence ngay sau mỗi case để cơ chế giữ 4 session của app không làm mất video đầu suite.

### P0 — DWG thật và evidence

- tools/e2e/plans/t-corner.json: khôi phục plan 6 bước trên DWG XZ thật: pause, mở Layers, chọn SS_STACK_MAIN, đổi màu SS_SUPPORT, vẽ LINE theo tọa độ context, zoom extents.
- tools/e2e/plans/bat-diem.json: thêm plan có thao tác layer và LINE theo KEY_POINTS/context của 260519_test-bat-diem.dwg.
- electron/engine/director.cjs, electron/engine/capture.cjs: timeline lưu verification, clean-state và checkpoint cuối từng scene/action; checkpoint được giữ lại sau khi xóa frames gốc.
- tools/e2e/run-plan.cjs, tools/e2e/run-real.cjs: render lần hai với force: true để đo dựng không trúng cache rồi mới dọn frame; giữ result.json, MP4, contact sheet và frames-<case>/.

## 2. Đã sửa theo review vòng 1

| Lỗi review | File đã sửa | Cách sửa | Case chứng minh |
|---|---|---|---|
| MTEXT gõ vào command line, click kết thúc mở menu góc nhìn | electron/engine/actions.cjs, planner.cjs | Chờ prompt góc đầu/góc đối diện, click điểm thật, nhập textbox editor, nhập height và click Apply text; không click bừa canvas; hậu điều kiện kiểm MTEXT/content/height | text-vietnamese: editor toolbar xuất hiện, chữ “Xin chào VinaCAD” hiện trên bản vẽ, không còn picker/menu |
| MOVE bị Enter tự động lấy làm điểm gốc, khung chọn treo | electron/engine/actions.cjs | Bỏ preselection Enter/skip Enter; đọc prompt trước từng input; snapshot entity sau select và kiểm vector [200,200] | selection-move: 3/3, đối tượng được dời đúng |
| toggle phụ đề “Bật” nhưng thao tác lại tắt | actions.cjs, planner.cjs, director.cjs | Bắt buộc on; pre-roll đưa mode về trạng thái ngược trước lần bật đầu tiên; hậu điều kiện đọc trạng thái sau click | mode-click-escape: bật OSNAP đúng, Escape kết thúc sạch |
| OpenAI structured output bị 400 | electron/main.cjs, planner.cjs | strict:false và retry JSON mode khi lỗi schema; validator vẫn là lớp kiểm tra chính | check-ai-requests.cjs: Google/OpenAI/Anthropic đều pass |
| runner AI đọc sai profile/localStorage | tools/e2e/run-ai.cjs | Đọc bốn env vars, userData riêng theo evidence, không đọc localStorage/profile, không ghi key | ai-2026-10-31T17-55-30-784Z/result.json: blocked trước request khi thiếu key |
| DWG thật bị rút còn pause/open panel | run-real.cjs, plans/t-corner.json, plans/bat-diem.json | Plan t-corner đúng 6 bước; thêm plan Bat Diem dùng layer và LINE theo context thật | T-Corner 6/6, Bat Diem 5/5 |
| thời gian dựng vòng 1 bị ghi 0 ms do cache | main.cjs, run-plan.cjs, run-real.cjs | IPC render hỗ trợ force:true; ghi recordMs, renderMs, rerenderMs, totalMs | Các result mới đều có renderMs dương, lần dựng force được ghi riêng |
| MP4 đầu suite bị session retention dọn | run-actions.cjs, run-ai.cjs | Copy MP4 ra evidence root ngay sau record/render; chỉ xóa frame gốc sau khi đã copy checkpoint | Suite action mới giữ đủ 10 MP4 và 10 contact sheet |

## 3. Bảng kết quả kiểm thử

Thời gian dựng ở các case offline/real là lần production:render(force:true) sau khi quay. Ở action acceptance, production:record tạo session mới và ghi lần dựng đầu tiên, nên renderMs vẫn là lần dựng không có cache trước đó. Tất cả thời gian dưới đây là milliseconds trong result.json.

| Brief | Plan hợp lệ ở lượt | OK/tổng | Thời gian quay | Thời gian dựng | Video | Contact sheet | Clean state | Khung hình kiểm tra |
|---|---:|---:|---:|---:|---|---|---|---|
| Offline Layer: đổi tên, đổi màu, xóa layer trống | preset (0) | 6/6 | 59,926 ms | 35,846 ms | docs/handoff/evidence/offline-2026-10-31T17-14-56-797Z/user-data/sessions/8990f32a-acd2-4256-b2ac-33e54c008366/render_4k_1793466994073.mp4 | docs/handoff/evidence/offline-2026-10-31T17-14-56-797Z/contact-layer-edit.jpg | ✓ mọi action có commandIdle/editorClosed/pickerClosed/menusClosed | docs/handoff/evidence/offline-2026-10-31T17-14-56-797Z/frames-layer-edit/ |
| Offline vẽ RECTANG/LINE với Osnap | preset (0) | 5/5 | 81,068 ms | 38,481 ms | docs/handoff/evidence/offline-2026-10-31T17-14-56-797Z/user-data/sessions/c2beaa46-9e5b-48e1-a8fe-ff749419361b/render_4k_1793467157801.mp4 | docs/handoff/evidence/offline-2026-10-31T17-14-56-797Z/contact-draw-osnap.jpg | ✓ sạch sau từng bước | docs/handoff/evidence/offline-2026-10-31T17-14-56-797Z/frames-draw-osnap/ |
| Offline khóa, ẩn và bật lại layer | preset (0) | 5/5 | 37,997 ms | 24,727 ms | docs/handoff/evidence/offline-2026-10-31T17-14-56-797Z/user-data/sessions/6d3e5ae3-e2c0-4837-847f-09726117a25f/render_4k_1793467263803.mp4 | docs/handoff/evidence/offline-2026-10-31T17-14-56-797Z/contact-layer-visibility.jpg | ✓ sạch sau từng bước | docs/handoff/evidence/offline-2026-10-31T17-14-56-797Z/frames-layer-visibility/ |
| DWG thật T-Corner: Layers, đổi màu SS_SUPPORT, vẽ LINE trên mặt phẳng XZ, zoom | plan tĩnh từ context (0) | 6/6 | 83,884 ms | 42,867 ms (force 44,384 ms) | docs/handoff/evidence/real-2026-10-31T17-23-37-551Z/user-data/sessions/82143dc9-4eb1-4f0e-945f-efbd03220253/render_4k_1793467588041.mp4 | docs/handoff/evidence/real-2026-10-31T17-23-37-551Z/contact-t-corner.jpg | ✓ 6/6 sạch; select/panel không treo menu/editor | docs/handoff/evidence/real-2026-10-31T17-23-37-551Z/frames-t-corner/ |
| DWG thật Bat Diem: chọn layer 0, vẽ LINE theo KEY_POINTS, zoom | plan tĩnh từ context (0) | 5/5 | 66,535 ms | 35,625 ms (force 40,089 ms) | docs/handoff/evidence/real-2026-10-31T17-27-39-063Z/user-data/sessions/e2a04bf2-3d3f-4a44-af7d-bf06b5fe5ecd/render_4k_1793467797188.mp4 | docs/handoff/evidence/real-2026-10-31T17-27-39-063Z/contact-bat-diem.jpg | ✓ 5/5 sạch | docs/handoff/evidence/real-2026-10-31T17-27-39-063Z/frames-bat-diem/ |
| Tạo và chọn layer | direct action (0) | 3/3 | 34,237 ms | 17,775 ms | docs/handoff/evidence/actions-2026-10-31T17-33-26-727Z/create-select.mp4 | docs/handoff/evidence/actions-2026-10-31T17-33-26-727Z/create-select-contact-sheet.jpg | ✓ sạch; select giữ vùng chọn có chủ đích | docs/handoff/evidence/actions-2026-10-31T17-33-26-727Z/frames-create-select/ |
| Bật OSNAP, click Thuộc tính, Escape | direct action (0) | 3/3 | 23,238 ms | 20,165 ms | docs/handoff/evidence/actions-2026-10-31T17-33-26-727Z/mode-click-escape.mp4 | docs/handoff/evidence/actions-2026-10-31T17-33-26-727Z/mode-click-escape-contact-sheet.jpg | ✓ sạch sau Escape | docs/handoff/evidence/actions-2026-10-31T17-33-26-727Z/frames-mode-click-escape/ |
| Zoom vùng và CIRCLE bán kính 350 | direct action (0) | 2/2 | 39,245 ms | 26,066 ms | docs/handoff/evidence/actions-2026-10-31T17-33-26-727Z/zoom-value.mp4 | docs/handoff/evidence/actions-2026-10-31T17-33-26-727Z/zoom-value-contact-sheet.jpg | ✓ sạch sau từng bước | docs/handoff/evidence/actions-2026-10-31T17-33-26-727Z/frames-zoom-value/ |
| MTEXT tiếng Việt “Xin chào VinaCAD” | direct action (0) | 1/1 | 62,933 ms | 25,825 ms | docs/handoff/evidence/actions-2026-10-31T17-33-26-727Z/text-vietnamese.mp4 | docs/handoff/evidence/actions-2026-10-31T17-33-26-727Z/text-vietnamese-contact-sheet.jpg | ✓ editor đóng, picker/menu đóng | docs/handoff/evidence/actions-2026-10-31T17-33-26-727Z/frames-text-vietnamese/ |
| Chọn đối tượng → MOVE vector (200,200) | direct action (0) | 3/3 | 53,450 ms | 29,372 ms | docs/handoff/evidence/actions-2026-10-31T17-33-26-727Z/selection-move.mp4 | docs/handoff/evidence/actions-2026-10-31T17-33-26-727Z/selection-move-contact-sheet.jpg | ✓ sạch sau bước MOVE | docs/handoff/evidence/actions-2026-10-31T17-33-26-727Z/frames-selection-move/ |
| Chọn đối tượng → COPY rồi Enter | direct action (0) | 2/2 | 49,290 ms | 24,190 ms | docs/handoff/evidence/actions-2026-10-31T17-33-26-727Z/selection-copy.mp4 | docs/handoff/evidence/actions-2026-10-31T17-33-26-727Z/selection-copy-contact-sheet.jpg | ✓ sạch sau COPY | docs/handoff/evidence/actions-2026-10-31T17-33-26-727Z/frames-selection-copy/ |
| Chọn đối tượng → ROTATE 45° | direct action (0) | 3/3 | 48,422 ms | 26,564 ms | docs/handoff/evidence/actions-2026-10-31T17-33-26-727Z/selection-rotate.mp4 | docs/handoff/evidence/actions-2026-10-31T17-33-26-727Z/selection-rotate-contact-sheet.jpg | ✓ sạch sau ROTATE | docs/handoff/evidence/actions-2026-10-31T17-33-26-727Z/frames-selection-rotate/ |
| CIRCLE rồi chọn cạnh và ERASE | direct action (0) | 3/3 | 60,580 ms | 25,762 ms | docs/handoff/evidence/actions-2026-10-31T17-33-26-727Z/create-erase.mp4 | docs/handoff/evidence/actions-2026-10-31T17-33-26-727Z/create-erase-contact-sheet.jpg | ✓ sạch sau ERASE | docs/handoff/evidence/actions-2026-10-31T17-33-26-727Z/frames-create-erase/ |
| OFFSET nhập 200, chọn đường và phía offset | direct action (0) | 1/1 | 53,936 ms | 19,977 ms | docs/handoff/evidence/actions-2026-10-31T17-33-26-727Z/selection-offset.mp4 | docs/handoff/evidence/actions-2026-10-31T17-33-26-727Z/selection-offset-contact-sheet.jpg | ✓ sạch, không còn prompt chọn phía | docs/handoff/evidence/actions-2026-10-31T17-33-26-727Z/frames-selection-offset/ |
| Zoom extents | direct action (0) | 1/1 | 17,464 ms | 18,032 ms | docs/handoff/evidence/actions-2026-10-31T17-33-26-727Z/zoom-extents.mp4 | docs/handoff/evidence/actions-2026-10-31T17-33-26-727Z/zoom-extents-contact-sheet.jpg | ✓ sạch | docs/handoff/evidence/actions-2026-10-31T17-33-26-727Z/frames-zoom-extents/ |
| Batch 10 brief AI trên hai DWG | chưa có plan — blocked trước request | 0/0 | — | — | chưa có | docs/handoff/evidence/ai-2026-10-31T17-55-30-784Z/result.json | không chạy action | docs/handoff/evidence/ai-2026-10-31T17-55-30-784Z/ |

Khi xem frame gốc, các điểm chính đã được xác nhận:

- text-vietnamese: thanh editor thật hiện trên canvas, ô nhập có “Xin chào VinaCAD”, nút ✓ màu xanh được bấm; frame cuối còn chữ trên mặt bằng và không có menu góc nhìn.
- selection-move: frame chọn có đối tượng được highlight; frame sau MOVE thể hiện vị trí đã dời; không còn prompt “Chỉ định góc đối diện”.
- selection-copy: bản gốc vẫn còn và bản sao xuất hiện ở điểm đích; hậu điều kiện đếm entity tăng.
- selection-rotate: hướng hình học thay đổi 45° và command kết thúc sạch.
- create-erase: CIRCLE tạm xuất hiện rồi biến mất; entity count giảm.
- selection-offset: command prompt hiển thị khoảng cách 200, đường song song được tạo và Escape kết thúc lệnh.
- zoom-value: CIRCLE có bán kính 350 và camera vẫn giữ phòng/khu vực xung quanh.
- T-Corner: SS_SUPPORT có 17 entity, cả 17 là ByLayer, 0 entity màu riêng; màu cam #FF8C42 vì vậy có ý nghĩa trên hình, không chỉ là màu ô UI. LINE làm entity count tăng 37→38; zoom extents có fraction 0.9793 nằm trong canvas.
- Bat Diem: frame cuối giữ toàn cảnh bản vẽ thật, line kiểm tra được tạo trên layer 0 và không có prompt treo.

## 4. Structured request và kiểm thử tĩnh

- node tools/e2e/check-ai-requests.cjs → {"ok":true,"providers":["Google","OpenAI","Anthropic"],"fallback":true}.
- npx tsc --noEmit -p . → sạch.
- node --check cho 16 file .cjs trong electron/ và tools/e2e/ → sạch.
- npm run build → Vite 8.3.5 build thành công.

## 5. Batch AI, P1 và giới hạn còn lại

### Batch P0

Người dùng đã trả lời cho phép dùng API key. Runner đã đọc cấu hình theo hợp đồng mới nhưng lần chạy ai-2026-10-31T17-55-30-784Z nhận thấy thiếu VINACUT_AI_KEY, nên trả status: blocked-no-env-key và thoát trước khi gọi production:plan. Vì vậy chưa thể báo tỉ lệ 9/10, số lượt retry hoặc lỗi provider. Cần đặt bốn biến sau trước lần chạy tiếp theo:

~~~
$env:VINACUT_AI_PROVIDER = 'Google'
$env:VINACUT_AI_MODEL = '<model id>'
$env:VINACUT_AI_BASE_URL = '<base url>'
$env:VINACUT_AI_KEY = '<key>'
npx electron tools/e2e/run-ai.cjs
~~~

Runner không in key và không ghi key vào result.json.

### P1

P1 chưa được kích hoạt vì điều kiện của AGENT_TASK_2 yêu cầu batch P0 10 brief đạt trước khi chạy phục hồi và quay thủ công. Bộ phục hồi một lần, kiểm thử ddagrab ở scale 100%/125% và thay manual capture chỉ nên chạy sau khi có key thật và P0 đạt. Không ghi nhận thành công giả cho các mục chưa chạy.

Các giới hạn còn biết:

- Batch AI thật chưa có số liệu do thiếu key trong environment; đây là trạng thái chặn có kiểm chứng, không phải lỗi runner profile.
- run-ai.cjs đã sẵn sàng cho 10 brief nhưng chưa test network/provider thật trong vòng này.
- gdigrab/manual capture vẫn giữ image pipe đã kiểm chứng từ vòng 1 vì probe desktop hiện tại cho khung đen; cần phiên desktop tương tác để đánh giá ddagrab 100% và 125%.
- Plan DWG dùng tọa độ context được thu thập tại thời điểm test; nếu file nguồn thay đổi hình học, cần thu context và tạo plan lại.

## 6. Lệnh chạy lại toàn bộ bộ hồi quy

Chạy tại C:\Users\taing\Desktop\Video-MKT trong PowerShell:

~~~
$env:ELECTRON_RUN_AS_NODE = $null

npx electron tools/e2e/run-plan.cjs
npx electron tools/e2e/run-actions.cjs

Remove-Item Env:DWG_PATH -ErrorAction SilentlyContinue
npx electron tools/e2e/run-real.cjs
$env:DWG_PATH = 'C:\Users\taing\Downloads\260519_test-bat-diem.dwg'
npx electron tools/e2e/run-real.cjs
Remove-Item Env:DWG_PATH -ErrorAction SilentlyContinue

node tools/e2e/check-ai-requests.cjs
npx tsc --noEmit -p .
Get-ChildItem electron,tools\e2e -Filter *.cjs -Recurse | ForEach-Object { node --check $_.FullName }
npm run build

# Chỉ chạy sau khi người dùng đã cấp phép và đã đặt đủ env vars:
npx electron tools/e2e/run-ai.cjs

# Tạo contact sheet cho một MP4:
node tools/e2e/contact-sheet.cjs <video.mp4> <contact-sheet.jpg>
~~~

Các thư mục evidence vòng 1 và vòng 2 được giữ nguyên để reviewer đối chiếu.


