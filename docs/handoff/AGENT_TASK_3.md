# Vòng 3: sửa nền tảng kiểm chứng, khôi phục test gốc, chạy batch AI

Đọc lại hai file trước:
- `docs/handoff/AGENT_TASK.md`: mục 3 (sự thật về VinaCAD) và mục 4 (nguyên tắc bắt buộc).
- `docs/handoff/AGENT_TASK_2.md`: mục 2.1–2.10 vẫn hiệu lực, trừ chỗ file này nói khác.

Bài học của hai vòng trước: một phép kiểm tra chưa từng được chứng minh là **bắt được lỗi** thì không đáng tin. Vì vậy vòng này yêu cầu **test âm tính** cho mọi phép kiểm tra (mục 3).

## 1. Kết quả review vòng 2

Reviewer đã làm bốn việc:
- đọc code;
- chạy lại toàn bộ hồi quy bằng bản sao runner, có giữ khung gốc;
- xem khung hình;
- viết probe tái tạo các trạng thái lỗi của vòng 1.

Probe và ảnh nằm trong `docs/handoff/review-r2/`.

### Đạt (giữ nguyên)

- MTEXT:
  - gõ vào ô soạn thảo thật, bấm Apply text, rồi kiểm nội dung entity;
  - chữ "Xin chào VinaCAD" hiện trên mặt bằng, đúng dấu;
  - không còn menu nào mở.
- MOVE: đã bỏ Enter tự động, các bước nhập đi theo prompt.
- toggle_mode:
  - đã có trường `on`, và pre-roll đặt trạng thái ngược trước khi quay;
  - OSNAP bật đúng với phụ đề.
- Structured output:
  - OpenAI dùng `strict: false`;
  - code đã có fallback lỗi 400 một lần cho cả 3 provider.
- `run-ai.cjs` chỉ đọc biến môi trường. Reviewer đã quét evidence và không thấy key nào bị lộ.
- Hồi quy DWG thật đã được khôi phục: t-corner 6 bước, bat-diem có LINE.
- Camera: hộp zoom tối thiểu bằng 13% extents. Video CIRCLE và ROTATE vẫn nhận ra phòng.
- Thời gian dựng đo trên lần dựng không trúng cache (`force: true`).
- `tsc` và `node --check` sạch.
- Reviewer chạy lại toàn bộ hồi quy ngày 01/11, lúc 01:04–01:33, bằng bản sao runner có giữ khung gốc:
  - actions 10/10;
  - offline 3/3;
  - t-corner 6/6;
  - bat-diem 5/5;
  - `npm run build` đạt.
- Kết quả này lặp lại được, nhưng nhiều ca qua chỉ vì các lỗi ở mục dưới.

### Lỗi nghiêm trọng

**1. Mọi entity có cùng một id, nên hậu điều kiện MOVE, ROTATE, COPY so sai đối tượng.**
- `entitySnapshot()` và `selectedEntities()` lấy id bằng `handle.toString()`. Với mọi entity, kết quả là `"[object Object]"`.
  - Đo trên bản vẽ mẫu: 126 entity, 1 id duy nhất (xem `review-r2/id-probe.cjs`).
  - Cách đúng: `objectId().getHandle().ascii()`, trả về `"53C"`, `"53D"`…
- Hậu quả:
  - `after.find((e) => e.id === original.id)` luôn trả về **entity đầu tiên** của bản vẽ.
  - `created` luôn rỗng. `result.json` ghi `copied: []`.
  - `originalsRemain` luôn đúng.
- MOVE và ROTATE qua test chỉ vì đối tượng được chọn tình cờ là entity #0: đoạn tường (0,0)–(9000,0).

**2. Kịch bản test bị sửa để qua, vi phạm 2.1.3.** Log trong `evidence/actions-2026-10-31T16-*`:

| Lần chạy | Kịch bản | Kết quả |
|---|---|---|
| 16:10 | select [2100,600] (giống vòng 1) | FAIL "MOVE không dịch đúng vector [200,200]… delta -900,-600". Đây là lỗi id. |
| 16:13 | đổi sang [4500,0], tức entity #0 | FAIL, delta [100,200] do bắt điểm |
| 16:14 | thêm bước tắt OSNAP | OK |

- ROTATE đi theo đúng đường đó: đổi sang [4500,0], tắt OSNAP, rồi thêm ngoại lệ cho phép gõ góc khi prompt đang ở dạng "điểm" (`actions.cjs:1004`).
- Hai lỗi engine thật bị che đi:
  - id trùng nhau;
  - MOVE không xử lý bắt điểm, trong khi OSNAP mặc định bật.

**3. `assertCleanState` không bắt được hai trạng thái bẩn của vòng 1.** Reviewer tái tạo bằng `review-r2/cleanstate-probe.cjs` và chụp ảnh.
- Khung chọn treo (`probe-1-window-selection.jpg`):
  - `cmd()` coi `SELECT` là "không hoạt động" (`actions.cjs:64`).
  - Prompt "Lệnh: Chỉ định góc đối diện:" vẫn được báo là sạch.
- Menu góc nhìn Trên/Dưới/Trái… (`probe-2-view-menu.jpg`):
  - Selector menu ở `actions.cjs:349` không khớp với menu này.
  - Kết quả trả về `menus: []` trong khi menu đang mở.

**4. Hậu điều kiện yếu hơn yêu cầu ở 2.1.**
- LINE, RECTANG, PLINE…: chỉ đếm số entity (`actions.cjs:751`), không kiểm loại hay vị trí. REPORT_2 ghi "lệnh tạo kiểm loại/vị trí" là sai.
- ROTATE: chỉ kiểm "bounds có đổi", không kiểm góc.
- ERASE: không kiểm số entity giảm đúng bằng số đối tượng đã chọn.
- Dung sai vị trí `closeEnough` tính bằng 2,5% *giá trị toạ độ*. Trên DWG có toạ độ khoảng 80.000, dung sai thành khoảng 2.000 đơn vị.
- zoom_to dùng ngưỡng 0,35, trong khi yêu cầu là 0,40.
- Khoảng 25 lệnh trong `SUPPORTED_COMMANDS` không có hậu điều kiện riêng: SCALE, MIRROR, TRIM, EXTEND, FILLET, CHAMFER, HATCH, DIMLINEAR… Nếu AI dùng các lệnh này, engine báo ✓ miễn là lệnh kết thúc.

**5. `check-ai-requests.cjs` không kiểm gì thật.**
- Nó tự viết request body bằng tay rồi kiểm chính các object đó.
- Nó không gọi code dựng request trong `main.cjs`. Nếu `main.cjs` quay lại `strict: true`, test vẫn báo `ok`.
- Đường fallback không được chạy.

**6. P0 vẫn mở.**
- Batch AI chưa chạy vì thiếu biến môi trường chứa key.
- 10 brief dùng toạ độ thô, không giống cách người làm marketing viết.

**7. Dọn dẹp chưa đạt.**
- Evidence tăng từ 6,1 GB lên 12,1 GB: khoảng 45 lần chạy thử, mỗi lần khoảng 100 MB, phần lớn là `user-data` của Chromium.
- Còn một tiến trình Electron chạy `run-actions.cjs` bị treo từ 23:13.

**8. Đổi màu SS_SUPPORT không hiện trên bản vẽ (mục 2.8 chưa đạt).**
- Khung `evidence/real-2026-10-31T17-23-37-551Z/frames-t-corner/scene-3-action-4.jpg` và `final.jpg`, xem ở độ phân giải gốc:
  - ký hiệu gối đỡ ①–④, ⑧, ⑨ vẫn trắng xám;
  - ⑤–⑦ màu tím;
  - không có gì chuyển sang cam;
  - chỉ ô màu trong bảng Layer đổi.
- REPORT_2 kết luận "17/17 entity ByLayer… màu cam có ý nghĩa trên hình". Kết luận này dựa vào API và không khớp với hình.
- Nhiều khả năng các ký hiệu là block: bản thân INSERT để ByLayer, nhưng nét bên trong block có màu riêng.

**9. REPORT_2 có chỗ sai.**
- "assertCleanState kiểm prompt treo, menu/popup": sai.
- "lệnh tạo kiểm loại/vị trí": sai.
- "check-ai-requests: Google/OpenAI/Anthropic đều pass": test không kiểm gì thật.
- Không ghi lại việc đã đổi kịch bản test MOVE/ROTATE.
- Kết luận về màu SS_SUPPORT (mục 8).

### Lỗi của VinaCAD (chỉ ghi nhận, không tìm cách lách)

- MTEXT hiển thị khoảng trắng rộng khoảng 4 ký tự giữa "chào" và "VinaCAD". Nội dung lưu trong entity chỉ có một dấu cách U+0020. Reviewer sẽ báo đội VinaCAD.
- Ô HEX trong bảng chọn màu layer không ghi màu. Engine đã lách bằng ô Blue (đã biết từ vòng 1).

## 2. Việc cần làm (theo thứ tự)

### 3.1 Sửa id entity và tự kiểm

- Dùng `objectId().getHandle().ascii()` cho `entitySnapshot()`, `selectedEntities()` và mọi chỗ khác cần id.
- Ngay sau mỗi lần lấy snapshot, nếu có id trùng thì ném `ActionFailure`. Không được chạy tiếp với snapshot hỏng.

### 3.2 `assertCleanState` bắt đúng trạng thái bẩn

- `SELECT` đang có prompt chờ nhập (ví dụ "Chỉ định góc đối diện") phải bị coi là bẩn.
- Menu góc nhìn, menu chuột phải, và các dropdown/popover khác: tìm DOM thật bằng probe hoặc đọc `vinacad_web_fe` (chỉ đọc), rồi thêm selector.
- Viết `tools/e2e/check-clean-state.cjs`:
  - Tạo lần lượt từng trạng thái bẩn: khung chọn treo; menu góc nhìn; menu chuột phải trên canvas; color picker đang mở; editor MTEXT đang mở; LINE đang dở.
  - Với mỗi trạng thái, khẳng định `assertCleanState` **ném lỗi**.
  - Với trạng thái sạch, và với `allowSelection` khi có vùng chọn, khẳng định nó **không ném**.

### 3.3 Hậu điều kiện đủ mạnh, kèm test âm tính

- **LINE:** có entity Line mới, hai đầu khớp điểm nhập.
- **RECTANG:** có polyline kín, 4 đỉnh khớp hai góc đã nhập.
- **PLINE:** các đỉnh khớp điểm nhập.
- **ROTATE:** góc thực khớp `value` ±1°, đo từ hướng Line hoặc từ hai điểm của entity. Tâm xoay phải đúng điểm gốc.
- **ERASE:** số entity giảm đúng bằng số đối tượng đã chọn, và các id đó biến mất.
- **COPY:** bản sao dời đúng vector, bản gốc giữ nguyên. Hai điều này kiểm bằng id thật.
- **Dung sai vị trí:** tính theo đơn vị bản vẽ, từ kích thước pickbox hoặc aperture quy đổi theo mức zoom lúc click. Không tính theo độ lớn toạ độ.
- **zoom_to:** ngưỡng 0,40.
- **`SUPPORTED_COMMANDS`:**
  - Chỉ giữ lệnh đã có cả luồng nhập lẫn hậu điều kiện được kiểm chứng. Đề xuất: LINE, PLINE, RECTANG, CIRCLE, MTEXT, MOVE, COPY, ROTATE, ERASE, OFFSET.
  - Các lệnh khác bỏ khỏi danh sách và khỏi system prompt cho tới khi có hậu điều kiện và test.
- **Test âm tính (bắt buộc):**
  - Mỗi hậu điều kiện cần ít nhất một case cố ý sai. Ví dụ: ROTATE 30° nhưng kiểm 45°; MOVE kiểm sai vector; LINE kiểm sai điểm cuối; ERASE khi không có gì bị xoá.
  - Khẳng định engine báo FAIL cho từng case.
  - Làm bằng unit test gọi `verifyCommand` với snapshot giả, cộng 1–2 case E2E.

### 3.4 Lệnh sửa khi OSNAP bật (trạng thái mặc định)

- Khôi phục case gốc của vòng 1 và giữ OSNAP mặc định:
  - select [2100,600];
  - MOVE từ [2100,600] tới [2300,800].
- Thêm ROTATE và COPY trên đối tượng **không phải** entity #0.
- Engine phải xử lý bắt điểm. Chọn một trong hai cách và ghi rõ trong REPORT_3:
  - Khi plan cần toạ độ chính xác, tắt OSNAP có chủ đích bằng nút thật trên giao diện, có phụ đề.
  - Hoặc hậu điều kiện so với điểm VinaCAD thật sự nhận được sau khi bắt điểm. Ví dụ: mọi đối tượng đã chọn dời cùng một vector, và vector đó lệch không quá dung sai bắt điểm.
- Case [4500,0] có tắt OSNAP được giữ làm case phụ, **không** thay cho case gốc.
- `select` hiện chỉ chọn được một nét mỗi lần click.
  - Trong case COPY, bản sao chỉ là một nét của chiếc sofa, lơ lửng lệch sang phải. Người xem sẽ tưởng là lỗi.
  - Thêm chọn bằng khung (2 điểm) để chọn trọn một vật thể.
  - Case COPY phải sao chép trọn một vật thể.

### 3.5 Đổi màu layer phải thấy được trên hình

- Hậu điều kiện của `set_layer_color`: lấy mẫu pixel trên canvas tại vị trí các entity của layer, trước và sau khi đổi. Màu phải chuyển về phía màu đích. Nếu không đổi, báo FAIL kèm lý do, ví dụ "nét trong block có màu riêng".
- `readPlanningContext` báo cho mỗi layer: đổi màu layer có làm đổi màu nét trên hình hay không. Phải xét cả nét bên trong block (ByBlock, ByLayer trên layer 0, hoặc màu riêng).
- Planner chỉ chọn layer có đổi màu trên hình cho các cảnh "đổi màu để nổi bật".
- Với t-corner: tìm một layer đổi màu thấy được. Nếu không có layer nào, đổi cảnh đó sang thao tác khác và ghi rõ trong mục "Thay đổi plan test".

### 3.6 Test request AI bằng code thật

- Tách phần dựng request trong `main.cjs` thành hàm thuần, ví dụ `buildAiRequest({ provider, model, system, prompt, schema, json })`, và export ra.
- `check-ai-requests.cjs` phải gọi chính hàm đó cho cả 3 provider.
- Test fallback bằng `fetch` giả:
  - Trả 400 có chữ "schema" → khẳng định có lần gọi thứ hai, và lần đó không kèm schema.
  - Trả 400 không liên quan → khẳng định không gọi lại.
  - Trả 200 → khẳng định chỉ gọi một lần.

### 3.7 Batch AI (P0, tiêu chí không đổi: ít nhất 9/10)

- Người dùng sẽ đặt biến môi trường `VINACUT_AI_*`. Hỏi người dùng trước khi chạy.
- Viết lại 10 brief theo giọng marketing:
  - Nêu tên phòng, tên layer, loại hình. Mô tả vị trí bằng lời, ví dụ "góc bếp", "tường dưới phòng khách".
  - Tối đa 3/10 brief được chứa toạ độ.
- Planner chỉ được dùng lệnh trong `SUPPORTED_COMMANDS` mới.
- REPORT_3 ghi cho từng brief:
  - số lượt cần để có plan hợp lệ;
  - lỗi validator;
  - action nào fail, clean-state nào fail;
  - khung hình sau mỗi action, kèm một dòng mô tả.

### 3.8 Độ bền khi cài sang máy khác

Reviewer đã đo trên máy này:
- NVENC và Intel QSV dựng nhanh như nhau. Chỉ dùng CPU thì chậm khoảng 1,8 lần.
- Bước quay chạy được cả khi tắt GPU.

Việc cần làm:
- `render.cjs`: nếu encoder phần cứng lỗi khi dựng thật, phải dựng lại **toàn bộ** video bằng libx264. Không được trộn encoder giữa các đoạn, vì các đoạn được ghép bằng `-c copy`. Test bằng cách ép encoder phần cứng lỗi.
- Thống nhất chất lượng giữa các encoder:
  - Hiện cùng một video, NVENC (`cq 18`) ra file lớn khoảng 3 lần so với x264 (`crf 17`) và QSV.
  - Chọn tham số để dung lượng và chất lượng tương đương, rồi ghi số đo.
- `package.json`: ghim `electron` ở `45.1.0`. Hiện đang để `"latest"`.

### 3.9 Dọn dẹp

- Tắt tiến trình test bị treo.
- Mọi runner phải luôn thoát: có timeout tổng, và gọi `app.exit` khi lỗi.
- Sau khi chạy xong, không giữ `user-data` (cache Chromium) trong evidence. Chỉ giữ MP4, các file json, contact sheet và khung đã xuất.
- Hỏi người dùng trước khi xoá các lần chạy cũ.

## 3. Quy trình kiểm chứng (bổ sung vào mục 3 của AGENT_TASK_2)

1. **Không sửa plan test đã có.**
   - Mọi thay đổi so với vòng trước phải được liệt kê trong REPORT_3, mỗi mục ghi: trước, sau, lý do.
   - Muốn kiểm thêm thì thêm case mới. Không thay case cũ.
2. **Mỗi phép kiểm tra phải có test âm tính** chứng minh nó bắt được lỗi. Áp dụng cho clean state và cho từng hậu điều kiện.
3. Xem khung hình như vòng 2. Thêm: ghi đúng dòng lệnh đang hiện ở khung cuối của mỗi case.

## 4. Bộ hồi quy vòng 3 (phải đạt 100% trước khi báo xong)

- `check-clean-state.cjs`: mọi trạng thái bẩn đều bị bắt, trạng thái sạch không bị báo nhầm.
- Unit test hậu điều kiện, cả dương tính lẫn âm tính.
- `run-actions.cjs`:
  - các case gốc của vòng 1, giữ OSNAP mặc định và đối tượng [2100,600];
  - các case mới.
- `run-plan.cjs`, và `run-real.cjs` cho cả 2 DWG.
- `check-ai-requests.cjs` bản gọi code thật.
- Test fallback encoder ở `render.cjs`.
- `npx tsc --noEmit -p .`, `node --check` cho mọi file `.cjs`, và `npm run build`.
- Batch AI đạt ít nhất 9/10, khi người dùng đã cấp key.

## 5. Đầu ra

Tạo `docs/handoff/REPORT_3.md` theo khuôn REPORT_2, thêm các mục:
- **Thay đổi plan test:** bảng trước, sau, lý do. Nếu không đổi gì thì ghi "không có".
- **Test âm tính:** từng phép kiểm tra, case cố ý sai, và kết quả FAIL đúng như mong đợi.
- **Batch AI:** bảng 10 brief, hoặc lý do chưa chạy.
- Dung lượng evidence trước và sau khi dọn.
