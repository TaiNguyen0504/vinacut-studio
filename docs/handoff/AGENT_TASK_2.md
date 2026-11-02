# Vòng 2: sửa các lỗi từ review vòng 1 và hoàn thành P0

Đọc lại `docs/handoff/AGENT_TASK.md` trước. Các mục sau trong đó vẫn giữ nguyên hiệu lực:
- bối cảnh;
- sự thật về VinaCAD (mục 3);
- nguyên tắc bắt buộc (mục 4).

File này chỉ nêu những gì phải sửa hoặc làm tiếp sau review vòng 1.

## 1. Kết quả review vòng 1

Reviewer đã tự chạy lại hồi quy và xem từng khung hình gốc trong `<session>/frames/`.

**Đạt**
- 3 kịch bản offline vẫn 100% OK. Reviewer tự chạy lại ngày 31/10, lúc 22:20–22:26, và đã xem khung hình: layer-edit 6/6, draw-osnap 5/5, layer-visibility 5/5.
- Phụ đề tiếng Việt cho footage nhập vào hiển thị đúng dấu (`renderEditedVideo` + `fontsdir`).
- `tsc` và `node --check` đều sạch.
- `sendAgentProgress` đã được xoá.
- Không có API key nào bị ghi ra.
- Bộ runner trong `tools/e2e/` dùng tốt làm nền.

**Báo ✓ nhưng video sai** (vi phạm nguyên tắc 2). Đường dẫn bằng chứng tính từ `docs/handoff/evidence/actions-2026-10-31T14-33-10-027Z/user-data/sessions/`.

**MTEXT tiếng Việt**
- Trong video:
  - Chữ được gõ vào **dòng lệnh** (`MTEXT Press any key to continue or ESC to exit command : Xin chào VinaC`), ô soạn thảo vẫn trống.
  - Cú click "kết thúc" mở menu góc nhìn (Trên/Dưới/Trái/…). Menu này còn mở tới hết video.
  - Không thấy chữ nào trên bản vẽ.
- Bằng chứng: `759852e8-…/frames/f000200.jpg` và `f000259.jpg`.
- Nguyên nhân:
  - `actions.cjs:604` focus `#command-prompt-input` trước khi gõ.
  - `actions.cjs:607-611` click góc canvas (+18, +18), trúng nút "Trên".
  - Hậu điều kiện chỉ đếm số entity.

**MOVE có chọn trước**
- Trong video:
  - VinaCAD nhận vùng chọn ngay và hỏi `Chỉ định điểm gốc hoặc [tịnh_tiến(D)]`.
  - Enter tự động của engine bị lấy làm điểm gốc. Vì vậy click đầu tiên thành điểm thứ hai và lệnh kết thúc luôn.
  - Click "điểm đích" mở khung chọn (`Chỉ định góc đối diện`). Khung chọn treo tới hết video.
  - Đối tượng không được dời đúng (200, 200).
- Bằng chứng trong `895bb400-…/frames/`:
  - `f000160.jpg`: lệnh hỏi điểm gốc.
  - `f000203.jpg`: chưa click đã hỏi điểm thứ hai.
  - `f000220.jpg`: lệnh đã kết thúc sau click đầu.
  - `f000264.jpg`: khung chọn còn treo.
- Nguyên nhân:
  - `actions.cjs:572-579` tự bấm Enter khi đang có vùng chọn.
  - `actions.cjs:582-585` bỏ qua Enter đầu tiên ở **bất kỳ** vị trí nào trong danh sách input.
  - MOVE không có hậu điều kiện.

**toggle_mode**
- Trong video: phụ đề ghi "Bật chế độ bắt điểm" nhưng thao tác lại **tắt** OSNAP (intent ghi "Tắt OSNAP").
- Bằng chứng: `../../result.json`, case `mode-click-escape`.
- Nguyên nhân: action không có trạng thái đích.

**Lỗi khác**
- **OpenAI structured output sẽ bị từ chối.**
  - `main.cjs:251-252` gửi `strict: true` với `PLAN_JSON_SCHEMA` (`planner.cjs:20-43`).
  - Ở strict mode, mọi property phải có trong `required` và mọi object phải đặt `additionalProperties: false`. Schema hiện tại vi phạm cả hai: `description` không có trong `required`, còn `steps.items` đặt `additionalProperties: true`.
  - OpenAI sẽ trả 400. Code không có fallback, nên lập kịch bản bằng OpenAI hỏng hoàn toàn.
- **`tools/e2e/run-ai.cjs` đọc key sai chỗ.**
  - Chạy `electron tools/e2e/run-ai.cjs` dùng profile mặc định `%APPDATA%\Electron`, không phải profile của app (`%APPDATA%\vinacut-studio`).
  - localStorage còn phụ thuộc origin: dev server khác với `file://`.
  - Vì vậy batch AI không chạy được do lỗi runner, không phải do người dùng thiếu key.
- **Hồi quy DWG thật bị làm yếu.** `run-real.cjs` chỉ còn zoom_extents, mở bảng Lớp và pause. Không còn thao tác layer hay lệnh vẽ trên DWG mặt phẳng XZ.
- **REPORT vòng 1 có số liệu sai.**
  - "Thời gian dựng 0 ms" thực ra là cache của `renderForSession`, không phải số đo thật.
  - Hai câu "TEXT/MTEXT nhập qua editor UI" và "lệnh sửa tự xác nhận preselection bằng Enter" trái với chính video bằng chứng.
- **Chưa làm:** batch AI (P0), tự phục hồi (P1), quay thủ công 60fps có con trỏ (P1), toàn bộ P2.

## 2. Việc cần làm (theo thứ tự)

### 2.1 Nền tảng kiểm chứng (làm trước, các mục sau dựa vào đây)

1. Thêm `assertCleanState(ctx, { allow })`, chạy sau **mỗi** action. Gặp lỗi thì ném `ActionFailure`. Các điều kiện:
   - Dòng lệnh rảnh, và prompt không còn chờ nhập (vd. `Chỉ định góc đối diện` của khung chọn treo).
   - Không còn menu hay popup nào mở: menu chuột phải, menu góc nhìn, color picker.
   - Không còn trình soạn thảo MTEXT.
   - `allow` dùng cho trạng thái cố ý: `select` để lại vùng chọn, `open_panel` để lại bảng.
   - Xác định selector thật từ source `vinacad_web_fe` (chỉ đọc) và bằng chạy thử.
2. Hậu điều kiện phải đọc **kết quả**, không dừng ở "lệnh đã kết thúc":
   - Lệnh vẽ: có entity mới đúng loại, kích thước và vị trí khớp các điểm nhập (cho phép lệch do bắt điểm). Với CIRCLE có `value`, bán kính phải đúng.
   - MOVE: extents của các entity đã chọn dời đúng vector (điểm 2 − điểm 1).
   - COPY: số entity tăng đúng, bản gốc giữ nguyên.
   - ROTATE: hướng đổi đúng góc.
   - ERASE: số entity giảm đúng số đã chọn.
   - OFFSET: thêm entity cách đúng khoảng.
   - MTEXT: có entity MTEXT mới, nội dung đúng chuỗi đã gõ (giữ dấu tiếng Việt), chiều cao đúng.
   - zoom_extents: sau khi bấm, extents bản vẽ nằm trọn trong canvas.
   - zoom_to: vùng đích nằm trong canvas và chiếm ít nhất 40% cạnh ngắn.
3. Không được sửa plan test để test qua khi engine sai. Case nào lộ lỗi engine thì sửa engine; chưa sửa được thì ghi FAIL.

### 2.2 MTEXT (và TEXT)

Luồng VinaCAD đã thấy trong video:
1. Prompt `Chỉ định góc đầu tiên` → click.
2. Prompt `Chỉ định góc đối diện hoặc [chiều_cao(H)] [căn_chỉnh(J)] [khoảng_cách_dòng(L)] [xoay(R)] [kiểu(S)] [độ_rộng(W)] [cột(C)]` → click.
3. Trình soạn thảo mở trên canvas, kèm thanh công cụ: font, cỡ chữ, màu, B/I/S/U, nút ✓ xanh.

Yêu cầu:
- Gõ nội dung vào ô soạn thảo đang focus. **Không** focus `#command-prompt-input`.
- Kết thúc bằng nút ✓ (click UI thật). Không click bừa lên canvas.
- Chiều cao chữ:
  - Style mặc định cao 3 đơn vị, không thể nhìn thấy trên mặt bằng 12 m.
  - Cho plan một trường `height` tuỳ chọn. Nếu thiếu thì tự tính theo extents bản vẽ (khoảng 2–3% cạnh ngắn).
  - Nhập chiều cao qua tuỳ chọn H ở prompt góc đối diện, hoặc qua ô cỡ chữ trên thanh công cụ.
- `planner.cjs:230` đang cắt `value` còn 40 ký tự mà không báo gì. Với chú thích, phải báo lỗi thay vì cắt im lặng (giới hạn hợp lý khoảng 120 ký tự).
- TEXT một dòng: chỉ hỗ trợ khi đã xác định đúng chuỗi prompt của VinaCAD (đọc source, chạy thử). Nếu chưa kiểm chứng được, bỏ TEXT khỏi `SUPPORTED_COMMANDS` và system prompt.

### 2.3 Lệnh sửa (MOVE/COPY/ROTATE/SCALE/MIRROR/OFFSET/ERASE…)

- Bỏ Enter tự động (`actions.cjs:572-579`) và logic bỏ qua Enter (`actions.cjs:582-589`).
- Điều khiển theo prompt thật. Trước mỗi input, đọc `cmd().prompt`:
  - Prompt hỏi chọn đối tượng: click chọn, hoặc Enter để kết thúc chọn.
  - Prompt hỏi điểm: click điểm.
  - Prompt không khớp input của plan: báo lỗi rõ (cảnh, bước, prompt thực tế). Không đoán.
- Cập nhật system prompt (`planner.cjs:82`) và `validatePlan` theo luồng thật. Ví dụ: sau `select`, MOVE nhận ngay [điểm gốc, điểm đích]; COPY kết thúc bằng Enter.
- Chạy thật MOVE, COPY, ROTATE (góc nhập bằng value), ERASE và OFFSET (khoảng cách nhập bằng value). Mỗi lệnh có hậu điều kiện như mục 2.1.

### 2.4 toggle_mode có trạng thái đích

- Thêm trường `"on": true | false`, bắt buộc trong validator và trong ACTION_DOCS.
- Ở pre-roll (phần không quay), dùng Redux đặt mỗi mode về trạng thái **ngược** với lần bật/tắt đầu tiên của mode đó trong plan. Pre-roll được phép gọi Redux. Nhờ vậy cú click trong video luôn đúng với phụ đề.
- Hậu điều kiện: trạng thái sau click bằng `on`, và intent khớp phụ đề (Bật/Tắt).

### 2.5 Structured output và fallback thật

- OpenAI: chọn một trong hai cách:
  - dùng `json_schema` với `strict: false`;
  - hoặc viết schema strict hợp lệ: step là `anyOf` các action, mọi field nằm trong `required`, field tuỳ chọn khai báo nullable.
- Validator và vòng sửa 3 lượt vẫn là lớp kiểm tra chính.
- Mọi provider: nếu nhận HTTP 400 nhắc tới schema, response_format hoặc tool, thử lại **một lần** ở JSON mode không kèm schema. Comment ở `planner.cjs:18-19` nói có fallback nhưng code chưa có.
- Viết `tools/e2e/check-ai-requests.cjs` (không gọi mạng): dựng request body cho Google, OpenAI và Anthropic, rồi kiểm tra theo quy tắc của từng provider.

### 2.6 Runner AI đọc key từ biến môi trường

- `run-ai.cjs` đọc `VINACUT_AI_PROVIDER`, `VINACUT_AI_MODEL`, `VINACUT_AI_BASE_URL` và `VINACUT_AI_KEY`.
- Không đọc localStorage hay profile của app. Không in và không ghi key ra đâu cả.
- Đặt `userData` vào thư mục evidence, giống các runner khác.
- Thiếu key thì dừng kèm hướng dẫn rõ ràng. Hỏi người dùng trước khi chạy bằng key của họ.

### 2.7 Camera và zoom CAD phải giữ ngữ cảnh

Đây là lỗi nằm trong engine reviewer viết ban đầu.

- Với 1 điểm hoặc các điểm sát nhau, `boxOf` (`actions.cjs:385-395`) tạo hộp chỉ khoảng 200 đơn vị. Hậu quả: video CIRCLE và MOVE zoom vào vùng trống, người xem mất ngữ cảnh.
- Hộp zoom phải tính cả kích thước suy ra từ value (bán kính CIRCLE, khoảng cách OFFSET). Kích thước tối thiểu khoảng 12–15% cạnh dài của extents bản vẽ.
- Tiêu chí đạt: trong mọi video vẽ hoặc sửa, người xem vẫn nhận ra phòng hay khu vực đang thao tác.

### 2.8 Khôi phục hồi quy trên DWG thật

- `run-real.cjs`: đọc context bằng `director.collectContext`, rồi gọi `production:record` với plan 6 bước bên dưới. Lưu plan thành `tools/e2e/plans/t-corner.json`.
- Kết quả của plan này: reviewer chạy đạt trước bàn giao, và chạy lại sau vòng 1 vẫn đạt 6/6. Khung cuối cho thấy SS_STACK_MAIN là layer hiện hành, SS_SUPPORT đã chuyển màu cam và đường LINE đã được vẽ.
- Cần kiểm tra thêm: các ký hiệu gối đỡ trên bản vẽ có thật sự đổi màu theo layer không (entity có màu ByLayer hay màu riêng). Nếu không đổi, phụ đề "đổi màu để nổi bật" là sai. Khi đó `readPlanningContext` nên báo layer nào có entity ByLayer để AI chọn cho đúng.
- Thêm một plan có lệnh vẽ cho `260519_test-bat-diem.dwg`, dựng từ KEY_POINTS của chính bản vẽ đó.

```json
{
  "title": "Bản vẽ kết cấu trên VinaCAD Web",
  "scenes": [
    { "label": "Mở bản vẽ", "caption": "Bản vẽ mặt đứng kết cấu mở ngay trên trình duyệt.", "focus": "full", "hold": 1.2, "steps": [ { "type": "pause", "seconds": 0.6 } ] },
    { "label": "Chọn layer kết cấu", "caption": "Chọn layer kết cấu chính để làm việc.", "focus": "auto", "hold": 1.2, "steps": [ { "type": "open_panel", "panel": "Layers" }, { "type": "select_layer", "layer": "SS_STACK_MAIN" } ] },
    { "label": "Đổi màu giá đỡ", "caption": "Đổi màu layer giá đỡ để nổi bật trên bản vẽ.", "focus": "auto", "hold": 1.2, "steps": [ { "type": "set_layer_color", "layer": "SS_SUPPORT", "color": "#FFB347" } ] },
    { "label": "Vẽ đường nối", "caption": "Vẽ đường nối, bắt điểm góc chính xác trên mặt đứng.", "focus": "auto", "hold": 1.2, "steps": [ { "type": "command", "name": "LINE", "inputs": [ { "point": [72485.57, 4581.56], "hover": 1.0 }, { "point": [90285.57, 4581.56], "hover": 1.0 }, { "key": "Enter" } ] } ] },
    { "label": "Kết quả", "caption": "Mọi thay đổi hiển thị tức thì trên toàn bản vẽ.", "focus": "full", "hold": 1.6, "steps": [ { "type": "zoom_extents" } ] }
  ]
}
```

### 2.9 P0: batch AI (tiêu chí không đổi)

- Viết 10 brief cụ thể, giống cách người làm marketing thật sẽ viết: nêu rõ layer, hình và vị trí. Tránh brief mơ hồ kiểu "TEXT hoặc MTEXT", "OSNAP hoặc ORTHO".
- Một brief chỉ tính là đạt khi thoả cả bốn điều kiện:
  - plan hợp lệ trong tối đa 3 lượt;
  - mọi action ✓ theo hậu điều kiện ở mục 2.1;
  - trạng thái sạch sau mỗi action;
  - khung hình xác nhận phụ đề khớp với điều đang thấy.
- Cần đạt ít nhất 9/10.
- Ghi lại: số lượt cần để có plan hợp lệ, các lỗi hay gặp, những thay đổi đã làm với prompt và validator.

### 2.10 P1 (chỉ làm sau khi 2.1–2.9 đạt)

- **Tự phục hồi một lần khi bước lỗi:**
  - cho phép inject `chat` để thay bằng chat giả;
  - viết unit test với chat giả trước;
  - test thật khi đã có key.
- **Quay thủ công 60fps có con trỏ:**
  - `gdigrab` theo `title=` cho ra khung đen với cửa sổ Chromium; đây là chuyện bình thường.
  - FFmpeg đi kèm (6.1.1) có `ddagrab` (Desktop Duplication), hỗ trợ `draw_mouse`, `framerate=60`, `offset_x`, `offset_y` và `video_size`.
  - Lấy vùng quay từ `win.getContentBounds()` nhân với `scaleFactor` của màn hình chứa cửa sổ.
  - Kiểm tra ở scale 100% và 125%: quay đúng vùng, có con trỏ, đủ 60fps.

## 3. Quy trình kiểm chứng bắt buộc (mới)

1. **Xuất và xem khung hình của mỗi video test.**
   - Lấy khung gốc ngay sau mỗi action, cộng khung cuối, từ `<session>/frames/`. Dùng `frames.ffconcat` để biết thời điểm từng khung.
   - Lưu vào `evidence/<run>/frames-<case>/`.
   - Mở xem từng ảnh. Trong REPORT, ghi một dòng cho mỗi action mô tả điều nhìn thấy, ví dụ: "chữ 'Phòng khách' cao khoảng 250 hiện giữa phòng; không có menu nào mở".
2. **Đo thời gian dựng trên một lần dựng không trúng cache.**
3. **Giảm dung lượng evidence** (hiện đã 6,1 GB).
   - Dựng xong thì chỉ giữ: MP4, `timeline.json`, `result.json`, contact sheet và các khung đã xuất. Xoá thư mục `frames/` gốc.
   - Không xoá evidence của vòng 1 khi người dùng chưa đồng ý.

## 4. Bộ hồi quy vòng 2 (phải đạt 100% trước khi báo xong)

- 3 kịch bản offline (`run-plan.cjs`).
- `run-actions.cjs` mở rộng, mỗi case đều có hậu điều kiện và clean state:
  - tạo và chọn layer;
  - toggle_mode có `on`;
  - zoom_to;
  - CIRCLE có bán kính;
  - MTEXT tiếng Việt;
  - MOVE, COPY, ROTATE, ERASE, OFFSET.
- `run-real.cjs` cho cả 2 DWG thật, với plan có thao tác layer và lệnh vẽ.
- `check-ai-requests.cjs`.
- `npx tsc --noEmit -p .`, `node --check` cho mọi file `.cjs`, và `npm run build`.

## 5. Đầu ra

Tạo `docs/handoff/REPORT_2.md` theo khuôn REPORT vòng 1, thêm:
- Hai cột mới trong bảng kết quả: "Clean state" và "Khung hình kiểm tra" (đường dẫn thư mục frames của case).
- Mục "Đã sửa theo review vòng 1": với mỗi lỗi ở mục 1, ghi file đã sửa, cách sửa và case chứng minh.
- Kết quả batch AI nếu người dùng đã cấp key; nếu chưa chạy thì ghi rõ lý do.
