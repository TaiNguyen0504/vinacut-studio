# Nhiệm vụ: Hoàn thiện VinaCut Studio — từ kịch bản (prompt) ra video demo VinaCAD 4K đúng ý

## 1. Bối cảnh

- Repo: `C:\Users\taing\Desktop\Video-MKT` (Electron 45, React 19, Vite 8, Node 24, Windows 11).
- Sản phẩm: người làm marketing viết kịch bản. App dùng AI để lập phân cảnh, tự thao tác VinaCAD Web (https://web.vina-cad.com/vi) và dựng video marketing **4K 60fps**. Mọi thao tác trong video đều phải **thật và đã được kiểm chứng**.
- Bản sao lưu code trước đợt refactor nằm ở `_backup_before_claude_20261031/`. Không sửa, không xoá thư mục này.
- Source frontend VinaCAD để tra cứu (chỉ đọc, không sửa): `C:\Users\taing\Desktop\P1_web\vinacad_web_fe` (nhánh develop). Bộ test tự động tham khảo: `C:\Users\taing\Desktop\P1_origin\vinacad_web_fe\automation-tests`.

## 2. Hiện trạng: đã làm và đã kiểm chứng bằng chạy thật. KHÔNG được làm hỏng

Engine mới nằm trong `electron/engine/`:

| File | Vai trò |
|---|---|
| `capture.cjs` | Cửa sổ offscreen có bố cục 1920×1080, `deviceScaleFactor: 2`, nên mỗi khung là 3840×2160. `FrameRecorder` quay stop-motion 60fps ra JPEG kèm `frames.ffconcat`. `InputDriver` gửi chuột/bàn phím thật bằng `sendInputEvent`; con trỏ và hiệu ứng click được vẽ trong DOM, đặt vị trí theo từng khung. |
| `vinacad.cjs` | Chờ editor sẵn sàng, dựng bản vẽ mẫu bằng ODA API, nạp DWG của người dùng (bằng drop event) rồi zoom extents. |
| `actions.cjs` | Thư viện thao tác qua UI thật; sau mỗi thao tác kiểm chứng hậu điều kiện bằng Redux hoặc database CAD. Gồm: `open_panel`, `select_layer`, `rename_layer`, `set_layer_color`, `toggle_layer` (locked; visible tức là freeze), `create_layer`, `delete_layer`, `command` (bấm ribbon hoặc gõ lệnh, click điểm theo toạ độ bản vẽ, rê chuột để hiện Osnap, tự zoom bằng con lăn khi hình nhỏ), `hover`, `select`, `zoom_to`, `zoom_extents`, `toggle_mode`, `click`, `pause`, `escape`. Hàm `readPlanningContext` đọc layer, khung bao và điểm then chốt theo mặt phẳng nhập liệu (XY hoặc XZ). |
| `planner.cjs` | System prompt kèm danh mục action. `validatePlan` mô phỏng trạng thái layer, kiểm tra toạ độ và lệnh có được hỗ trợ. Vòng tự sửa tối đa 3 lượt. Có 3 kịch bản offline (Layer, Vẽ + Osnap, Khoá/Ẩn), chỉ dùng khi prompt khớp rõ. |
| `render.cjs` | Camera tự động theo shot, filter `perspective` (sub-pixel), phụ đề ASS tiếng Việt (font Segoe UI chép vào thư mục phiên). Dựng song song 3 đoạn rồi ghép bằng stream copy. Encoder tự chọn theo thứ tự NVENC → QSV → AMF → x264. Xuất 4K, 1080p hoặc dọc 9:16. |
| `director.cjs` | Các hàm `openStage`, `collectContext`, `recordPlan`, `renderSession`. Phiên quay lưu ở `<userData>/sessions/<id>`, giữ 4 phiên gần nhất. |

Các file khác:
- `electron/main.cjs`:
  - IPC `production:plan|record|render|export|cancel` và sự kiện `production:progress`.
  - Giao thức `vinacut-media://<sessionId>/<file>.mp4`, có hỗ trợ Range.
  - Đã sửa tham số gọi AI: Gemini dùng `systemInstruction` và chế độ JSON; bỏ `temperature` với Gemini 3+ và GPT-5/6/o-series.
  - Pipeline cũ (slideshow từ ảnh chụp) đã bị gỡ.
- `src/App.tsx`, `electron/preload.cjs`, `src/vite-env.d.ts`, `src/styles.css`. Luồng giao diện:
  1. Lên kịch bản.
  2. Duyệt storyboard (sửa phụ đề, góc máy).
  3. Quay và dựng 4K.
  4. Xem báo cáo ✓/✗ cho từng thao tác.
  5. Dựng lại mà không cần quay lại.
  6. Xuất đúng chất lượng đã chọn.

Kết quả đã kiểm chứng:
- 3 kịch bản offline trên bản vẽ mẫu đều đạt 100% thao tác OK.
- 1 kịch bản trên DWG thật `260629_model-demo-t-corner.dwg` (mặt phẳng XZ) đạt 6/6.
- Video 3840×2160, 60fps. Thời gian dựng 4K bằng khoảng 1,7 lần thời lượng video.
- Smoke test giao diện qua app thật không có lỗi console.

Lưu ý: vài chỉnh sửa nhỏ cuối cùng **chưa được chạy lại hồi quy**:
- zoom CAD khi vẽ, `fill: 0.42`;
- sửa bộ khớp kịch bản offline;
- `loadDrawingIntoWindow` trong `main.cjs` giờ gọi engine.

Vì vậy, việc đầu tiên là chạy bộ hồi quy (mục 6).

## 3. Sự thật về VinaCAD đã được xác minh (source và chạy thật)

- Click vào một dòng layer sẽ **đặt layer đó làm layer hiện hành**. Double-click để đổi tên cũng làm layer thành hiện hành.
- Không xoá được layer hiện hành, layer `0`, hoặc layer đang có đối tượng; khi đó mục "Xóa" bị disable. Engine tự chuyển sang layer 0 trước khi xoá.
- **Ô HEX của color picker không commit màu** (đây là lỗi của VinaCAD). Engine gõ HEX rồi bấm ↑↓ ở ô B để commit qua handler của chính VinaCAD. Giữ nguyên cách này.
- Phải focus `#command-prompt-input` trước khi gõ. Bấm Enter khi đang idle và ô trống sẽ lặp lại lệnh trước. Luôn gõ đủ tên lệnh; gợi ý lệnh khớp theo tiền tố.
- Nếu hình quá nhỏ trên màn hình, nhãn kích thước động sẽ đè lên điểm click. Luôn zoom trước (hàm `zoomToBox` đã có sẵn).
- Điểm nhập chỉ nhận toạ độ tuyệt đối `x,y`; không có `@dx,dy`.
- Bản vẽ góc Front có mặt phẳng nhập liệu là XZ. Toạ độ trong plan là (u, v) trên mặt phẳng đó (`planeAxes()`).
- `ui.isLoadedFont` không reset khi mở file mới. Dấu hiệu nạp xong là `loadingDrawing.isLoading === false` và `__inWeb.drawingSessionId` tăng lên.
- Lệnh chưa hỗ trợ: RAY, BHATCH, GRADIENT, DONUT, WIPEOUT, LEADER, DIMANGULAR, DIMRADIUS, DIMDIAMETER, TABLE, ARRAYRECT, ARRAYPOLAR, DELETE, LENGTHEN, ID, LIST, OVERKILL.
- HATCH kết thúc bằng Escape. Tránh dùng UNDO.

## 4. Nguyên tắc bắt buộc

1. Mọi thao tác **xuất hiện trong video** phải đi qua UI thật (chuột/bàn phím). Chỉ được gọi Redux/ODA trực tiếp ở bước chuẩn bị không quay (pre-roll) hoặc để **kiểm chứng**.
2. Không bao giờ ghi `ok: true` khi chưa kiểm chứng. Bước thất bại thì dừng và báo lỗi tiếng Việt rõ ràng: cảnh nào, bước nào, vì sao. Không fallback im lặng sang kịch bản khác.
3. Không tạo video lạc đề. Khi không có API key, chỉ dùng kịch bản offline nếu prompt khớp rõ; còn lại thì báo cần API key.
4. Giữ phong cách code hiện có: CommonJS trong `electron/`, thụt lề 2 space, single quote, thông báo cho người dùng bằng tiếng Việt, ít comment.
5. Không sửa `_backup_before_claude_20261031/`. Không đụng các repo VinaCAD (`P1_*`). **Hỏi người dùng trước khi dùng API key của họ.**
6. Sau mỗi hạng mục, chạy lại bộ hồi quy (mục 6). Các kịch bản hồi quy phải tiếp tục đạt 100% OK.
7. Không commit, không push.

## 5. Hạng mục cần làm (theo thứ tự ưu tiên)

### P0 — Luồng AI thật

1. **Kiểm thử AI planning với API key thật.** Hỏi người dùng trước khi dùng key.
   - Chạy `production:plan` rồi `production:record` cho **ít nhất 10 brief** đa dạng: Layer; vẽ PLINE/CIRCLE/RECTANG; MOVE/COPY/OFFSET có chọn đối tượng; DIMLINEAR; MTEXT; khoá/ẩn layer; zoom vùng.
   - Chạy trên bản vẽ mẫu và trên ít nhất 2 DWG thật, ví dụ `C:\Users\taing\Downloads\260519_test-bat-diem.dwg` và `260629_model-demo-t-corner.dwg`.
   - Ghi lại: plan hợp lệ ở lượt 1, 2 hay 3; các lỗi hay gặp; tỉ lệ quay thành công.
   - Chỉnh system prompt và `validatePlan` tới khi **≥ 9/10 brief** vừa có plan hợp lệ vừa quay thành công.
2. Dùng **structured output** khi provider hỗ trợ: Gemini `responseSchema`/`responseJsonSchema`; OpenAI `response_format: { type: 'json_schema' }`; Anthropic tool use hoặc structured output. Giữ cách parse lỏng hiện tại làm dự phòng.
3. Chạy thật và hoàn thiện kiểm chứng cho các action **chưa từng chạy thật**:
   - `create_layer` có đặt tên, `select`, `toggle_mode`, `click`, `escape`, `zoom_to`.
   - Input `value` trong `command` (ví dụ khoảng cách OFFSET, bán kính CIRCLE).
   - TEXT/MTEXT với chữ tiếng Việt.
   - Lệnh sửa cần chọn đối tượng (MOVE/COPY/ROTATE/ERASE): chọn đối tượng → Enter → nhập điểm.
   - Mỗi action phải có hậu điều kiện kiểm chứng rõ ràng.

### P1 — Độ tin cậy khi quay

4. **Tự phục hồi khi một bước thất bại** (chỉ khi có API key):
   - Gửi cho AI ảnh chụp màn hình, thông báo lỗi và trạng thái hiện tại; hỏi **một lần** để sửa các bước còn lại của cảnh đó, rồi thử lại.
   - Nếu vẫn lỗi thì dừng như hiện tại. Tuyệt đối không giả thành công.
5. Kiểm tra lại **"Mở VinaCAD"** (`vinacad:prepare`) và **"Quay thủ công"** (`capture:vinacad-start`/`stop`) sau refactor.
   - Chuyển "Quay thủ công" sang FFmpeg `gdigrab` (có con trỏ chuột, 60fps) cho cửa sổ tên "VinaCAD Recorder".
   - Kiểm tra ở scale màn hình 100% và 125%. Nếu ở 125% gdigrab quay sai vùng thì giữ cách cũ và ghi lại trong báo cáo.
6. **Phụ đề cho footage nhập vào** (`renderEditedVideo` trong `main.cjs`): nạp font giống `render.cjs` (chép font vào thư mục tạm và dùng `fontsdir`), rồi kiểm tra chữ tiếng Việt hiển thị đúng.
7. **Dọn code chết trong `main.cjs`**: ví dụ `sendAgentProgress` (không còn ai gọi), nhánh background của `applyWindowVisibilityMode` nếu không còn dùng. Chỉ xoá thứ đã kiểm tra chắc chắn không còn được gọi.

### P2 — Chất lượng video marketing (chỉ làm sau khi P0 và P1 đạt)

8. **Âm thanh:**
   - Nhạc nền do người dùng chọn file, tự giảm âm lượng khi có lời (ducking).
   - Tuỳ chọn lồng tiếng TTS tiếng Việt theo phụ đề.
   - Thời lượng mỗi cảnh tự giãn theo độ dài lời đọc.
9. **Intro/outro thương hiệu**: logo VinaCAD, tiêu đề, lời kêu gọi truy cập `web.vina-cad.com`.
10. **Tuỳ chọn "Zoom siêu nét"**: quay với `deviceScaleFactor: 3` cho các cảnh zoom sâu. Đo thời gian và bộ nhớ, chỉ bật khi máy đủ mạnh.

## 6. Kiểm thử (bắt buộc, để reviewer xác minh)

- Khi chạy Electron từ shell của agent, **phải bỏ biến `ELECTRON_RUN_AS_NODE`** (VS Code đặt sẵn bằng 1). Ví dụ:
  `env -u ELECTRON_RUN_AS_NODE node_modules/electron/dist/electron.exe tools/e2e/run-plan.cjs`
- Tạo bộ hồi quy trong `tools/e2e/`. Bộ này không được đóng gói vào app.
  - `run-plan.cjs`:
    1. Đặt `app.setPath('userData', <thư mục riêng>)`, rồi `require('../../electron/main.cjs')`.
    2. Ẩn cửa sổ chính.
    3. Gọi trực tiếp `ipcMain._invokeHandlers.get('production:plan' | 'production:record' | 'production:render')({ sender: null }, payload)`.
    4. Ghi `result.json` gồm: các thao tác ✓/✗, thời lượng, thời gian quay và dựng, đường dẫn video.
  - `contact-sheet.cjs`: trích khung hình bằng `ffmpeg-static`, ví dụ `fps=1/1.5,scale=640:-2,tile=4x4`.
  - Bộ hồi quy tối thiểu:
    - 3 kịch bản offline (dùng 3 prompt mẫu trong `src/App.tsx`) trên bản vẽ mẫu;
    - 1 kịch bản trên `260629_model-demo-t-corner.dwg`.
- `npx tsc --noEmit -p .` phải sạch, và `node --check` phải qua với mọi file `.cjs` trong `electron/`.
- `vite build` sẽ xoá thư mục `dist/`. Bản build cũ trong đó đã lỗi thời nên được phép xoá, nhưng chỉ build khi thật sự cần.

## 7. Đầu ra khi xong

Tạo file `docs/handoff/REPORT.md` gồm:
1. Danh sách thay đổi theo từng hạng mục (tên file và mô tả ngắn).
2. Bảng kết quả kiểm thử. Mỗi dòng gồm: brief, plan hợp lệ ở lượt mấy, số thao tác OK trên tổng, thời gian quay và dựng, đường dẫn video và contact sheet.
3. Những gì chưa làm được hoặc giới hạn đã biết, kèm lý do.
4. Lệnh để chạy lại toàn bộ bộ hồi quy.

Giữ lại các phiên quay dùng làm bằng chứng cho tới khi reviewer duyệt xong.
