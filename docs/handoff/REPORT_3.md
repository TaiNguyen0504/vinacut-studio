# VinaCut Studio — báo cáo vòng 3

Ngày: 2026-11-01. Repo: `C:\Users\taing\Desktop\Video-MKT`. Không sửa repo P1, không sửa `_backup_before_claude_20261031`, không commit/push. Đã đọc AGENT_TASK, AGENT_TASK_2 và AGENT_TASK_3. Người dùng đã cấp quyền dùng API/model và cho phép dọn cache, giữ bằng chứng.

**Trạng thái: ĐÃ HOÀN TẤT VÒNG 3 (ĐẠT P0).** Toàn bộ bộ hồi quy không dùng AI đạt 100% (`check-clean-state` 8/8, `check-live-postconditions` 2/2, unit âm/dương tính 100%, `run-actions` 14/14, `run-plan` offline 3/3, `run-real` T-Corner 6/6 và Bat-Diem 5/5, `check-ai-requests` 21/21, `check-render-e2e` đạt) và **Batch AI 10 brief đạt 9/10 brief hoàn chỉnh (`EXIT=0`)** tại [ai-2026-11-01T13-03-54-226Z/result.json](evidence/ai-2026-11-01T13-03-54-226Z/result.json) kèm kiểm tra hình ảnh & phụ đề 4K cho từng action.

## 1. Thay đổi theo hạng mục

- `electron/engine/actions.cjs`: dùng handle ASCII (`objectId().getHandle().ascii()`), chặn snapshot trùng/mất id; kiểm hình học riêng cho 10 lệnh `LINE`, `PLINE`, `RECTANG`, `CIRCLE`, `MTEXT`, `MOVE`, `COPY`, `ROTATE`, `ERASE`, `OFFSET`. `COPY` ghép một-một bản sao với bản gốc, kiểm bản gốc giữ nguyên. Dung sai vị trí lấy từ 10 pixel quy đổi ra đơn vị bản vẽ tại mức zoom, không theo độ lớn tọa độ.
- Clean state đọc prompt `SELECT` đang chờ góc đối diện, menu góc nhìn/menu chuột phải, picker và editor `MTEXT`. Vùng chọn bền của VinaCAD được đọc từ grip entities khi `selectionManager` tạm đã được xóa lúc `SELECT` kết thúc; chỉ đọc, không sửa ODA.
- Chọn khung dùng chuột thật. Đã loại bỏ helper/fallback chọn entity qua ODA trong lúc quay. Một input window trùng vùng đã chọn được xác minh theo id và bounds trước khi dùng preselection.
- Camera PAN bằng chuột giữa trước khi zoom để đưa vùng sát cạnh vào giữa canvas; ngưỡng `zoom_to` là `0,40`. Giữ camera tối thiểu theo extents để còn ngữ cảnh phòng. Với `zoom_extents` trên bản vẽ mẫu tạo bằng `appendOdDbEntity` (khi nút `THU PHÓNG TOÀN CẢNH` không tự thu phóng sau khi wheel zoom sâu ở `CIRCLE`/`MTEXT`), bổ sung bước điều khiển lăn chuột/pan thật (`zoomToBox`) đưa toàn bộ `ctx.context.extents` vào khung hình rồi mới kiểm `zoomCheck`.
- Đổi màu layer phải đổi RGB trong bản ghi và đổi pixel canvas theo màu đích. Phép đo dùng nền lân cận để kiểm màu nét đã pha alpha/khử răng cưa; đổi sang màu khác hoặc chỉ mất nét đều bị từ chối. Context xét màu bên trong block, bao gồm `ByBlock`, `ByLayer`/layer `0` và màu riêng; chặn layer có màu block không chắc chắn.
- `electron/engine/planner.cjs`:
  - Chỉ công bố 10 lệnh có hậu điều kiện đã kiểm chứng (`LINE`, `PLINE`, `RECTANG`, `CIRCLE`, `MTEXT`, `MOVE`, `COPY`, `ROTATE`, `ERASE`, `OFFSET`); lưu lỗi validator từng lượt; cung cấp các vật thể có hình học đã biết của bản vẽ mẫu để brief “sofa phòng khách” có căn cứ.
  - Chuẩn hóa `parsePoint` nhận cả mảng số `[x, y]` lẫn chuỗi `"[x, y]"` khi bộ tuần tự hóa JSON có schema (`additionalProperties: true`) của Gemini trả tọa độ dạng chuỗi.
  - Siết `validatePlan`: cấm dùng `click` lên tên lệnh CAD hoặc nhãn nhóm công cụ (`Vẽ`, `Chỉnh sửa`, `Chú thích`); bắt buộc mỗi lệnh CAD hoàn tất trọn vẹn trong một bước `command` duy nhất (không tách một lệnh qua nhiều cảnh); kiểm đúng quy tắc kết thúc từng lệnh (`LINE`, `PLINE`, `COPY` kết thúc bằng `Enter`; `OFFSET` kết thúc bằng `Escape`; `RECTANG`, `CIRCLE`, `MOVE`, `ROTATE` tự kết thúc không có `Enter` thừa); chuẩn hóa bước `select` (`window`/`selectionWindow`/`min`-`max`/`point`), tự sắp xếp các bước phụ (`toggle_mode`, `zoom_to`, `pause`, `open_panel`, `hover`) lên trước `select` để `select` luôn đứng sát lệnh sửa (`MOVE`, `COPY`, `ROTATE`, `ERASE`), và theo dõi vùng chọn đã dịch chuyển sau `MOVE` (`lastMovedSelection`) để bước `COPY`/`ROTATE`/`ERASE` kế tiếp chọn đúng vị trí mới của vật thể.
- `electron/engine/actions.cjs` (bổ sung cho `OFFSET` và chuỗi `select` → `MOVE` → `COPY`):
  - Bổ sung `entitiesNearPoints` để khi điểm chọn đối tượng của `OFFSET` nằm tại góc chung của hai đoạn tường, hệ thống thu thập đầy đủ các đoạn ứng viên tại điểm chọn và đối chiếu đoạn có phương song song, cùng chiều dài và đúng khoảng cách vuông góc với đoạn mới sinh ra, đồng thời vẫn bắt buộc mọi đối tượng nguồn giữ nguyên.
  - Lưu `ctx.lastSelectStep` và mở rộng `geometryPoints` của lệnh sửa theo bounds đối tượng đã chọn (cùng vị trí đích sau khi dịch chuyển) để camera giữ cả bản gốc lẫn bản sao trong khung hình; xóa sạch `ctx.selectedSnapshot` sau mỗi lệnh.
- `electron/main.cjs`: export `buildAiRequest`; test gọi chính code này và fake `fetch` qua đường request thật. Chỉ retry lỗi HTTP 400 liên quan schema, một lần. Headless runner không bị thoát giữa chừng khi cửa sổ đọc context đóng.
- `electron/engine/render.cjs`: lỗi encoder phần cứng khi dựng thật kích hoạt dựng lại toàn bộ bằng `libx264`, sau khi dừng các chunk và dọn tạm. Giới hạn luồng FFmpeg để tránh hết RAM khi dựng 4K; gắn việc dừng FFmpeg với tiến trình cha.
- `director.cjs` và runners: giữ checkpoint cả bước thất bại, final command line và timeline; lưu kết quả từng case; có timeout tổng; exit lỗi rõ. Runner PowerShell dùng `Start-Process` với `-Wait` và `-WindowStyle Hidden` vì gọi trực tiếp GUI exe không chờ trên Windows.
- `package.json`/lockfile: ghim Electron `45.1.0`.
- Planner thử lại HTTP 503 sau 2/4 giây, tối đa 3 lượt kể cả các lượt validator; hủy được khi chờ. Không tự retry lỗi 429/quota hay lỗi mạng bất kỳ. Request giữ status cho mọi provider. Runner đọc phụ đề từ `description` của plan đã chuẩn hóa, đúng trường director/render sử dụng.
- `actions.cjs`: đọc tọa độ con trỏ CAD trước click. Nếu OSNAP đang bắt lệch quá dung sai, rê ra phía đối diện điểm đang bị giữ rồi trở lại đúng tọa độ, tối đa một lần. Nếu vẫn lệch thì dừng trước click. Không tăng dung sai và không đổi tọa độ plan. `verification.pointerCorrections` lưu điểm trước/sau.
- `capture.cjs`: checkpoint sao chép đúng frame đã ghi sau action, chờ file ghi xong; không lấy một repaint mới chưa có trong video.
- `probe-media-r3.py` kiểm kích thước, fps và thời lượng MP4 thật so với timeline.

Rà bổ sung trước nghiệm thu phát hiện các khoảng hở ngay trong bản sửa vòng này. `verifier-strength-before.json` lưu 7 dữ liệu cố ý sai vẫn được chấp nhận; bản sửa tiếp kiểm `COPY` giữ nguyên kích thước và cùng vector cho toàn bộ vật thể; `LINE` kiểm mọi đoạn; `ROTATE` kiểm mọi entity được chọn; `OFFSET` giữ nguyên nguồn, giữ chiều dài và kiểm khoảng cách vuông góc. Dung sai bán kính `CIRCLE`/chiều cao `MTEXT` nhập số là 1% (tối thiểu 0,01), tách khỏi dung sai điểm click. [verifier-strength-after.json](evidence/verifier-strength-after.json) bắt đúng 8 ca sai và thêm ca dương tính nhiều đoạn/nhiều đối tượng.

## 2. Sửa các nhận định sai ở REPORT_2

Các kết luận cũ về id, hậu điều kiện, clean state và request test không còn được dùng làm bằng chứng. `SS_SUPPORT` không được coi là đổi màu nhìn thấy chỉ vì `INSERT` báo `ByLayer`. Ảnh và kiểm tra block cho thấy nhiều nét con có màu riêng. `SS_STACK_MAIN` được chọn cho cảnh đổi màu theo ngoại lệ cho phép ở mục 3.5.

## 3. Thay đổi plan test

| Case | Trước | Sau | Lý do |
|---|---|---|---|
| MOVE gốc | Vòng 2 chọn [4500,0], tắt OSNAP | Khôi phục [2100,600] → [2300,800], OSNAP mặc định | Yêu cầu 3.4; sửa lỗi id thay vì né entity |
| MOVE phụ | Plan vòng 2 | Giữ tại selection-move-osnap-off | Không bỏ hồi quy cũ |
| ROTATE gốc | [4500,0], tắt OSNAP, 45° | [2100,600], OSNAP mặc định, 45° | Kiểm đối tượng không phải entity #0 |
| ROTATE phụ | Plan vòng 2 | Giữ tại selection-rotate-osnap-off | Không bỏ hồi quy cũ |
| COPY một nét | [2100,600] → [2600,900] | Giữ nguyên case cũ | Giữ hồi quy thao tác và kiểm id |
| COPY cả vật thể | Chưa có | Thêm khung [800,500]–[3600,1600], COPY vector [1800,1400] | Chọn cả 6 nét sofa; case mới, không thay case cũ |
| RECTANG góc bếp từ AI | Chưa có trong hồi quy cố định | Thêm ai-osnap-kitchen, sao chép nguyên plan AI đã lỗi vào tools/e2e/plans/ai-osnap-kitchen.json | Bắt hồi quy con trỏ giữ nhầm điểm 6900 khi yêu cầu 7100; giữ 13 case cũ |
| T-Corner đổi màu | SS_SUPPORT, cam #FF8C42 | SS_STACK_MAIN, cam #FF8C42; caption “kết cấu chính” | SS_SUPPORT có màu riêng trong block. Giữ bản plan cũ tại plans/t-corner-r2-original.json; các bước khác giữ nguyên |
| Brief AI | 10 brief nhiều tọa độ, đều trên 2 DWG | 10 brief giọng marketing, 2 brief có tọa độ; dùng mẫu và 2 DWG thật | Yêu cầu 3.7; phòng khách/bếp chỉ dùng trên bản vẽ có các phòng đó |

Không tắt OSNAP âm thầm trong các case gốc. Hậu điều kiện so vector/vị trí thực tế với yêu cầu trong dung sai pickbox đã quy đổi. Các case tắt OSNAP riêng có thao tác nút và caption rõ.

## 4. Kiểm thử

### Test âm tính

`check-postconditions.cjs`: 11 ca dương tính + 11 ca âm tính. Mọi ca âm tính phải ném `ActionFailure`; lỗi JavaScript thông thường không được tính là bắt đúng lỗi.

| Phép kiểm | Cố ý sai | Kết quả unit |
|---|---|---|
| LINE | Điểm cuối sai | FAIL đúng |
| RECTANG | Polyline không kín | FAIL đúng |
| PLINE | Một đỉnh sai | FAIL đúng |
| CIRCLE | Bán kính sai | FAIL đúng |
| MTEXT | Nội dung khác | FAIL đúng |
| MOVE | Vector sai | FAIL đúng |
| COPY | Vector sai; bản gốc bị dời | FAIL đúng |
| ROTATE | Hình học/tâm sai; thực tế 30° nhưng yêu cầu 45° | FAIL đúng |
| ERASE | Số lượng/id bị xóa không khớp | FAIL đúng |
| OFFSET | Khoảng cách sai | FAIL đúng |
| zoom_to | Fraction 0,39 | FAIL đúng |
| Snapshot | Id bị trùng | FAIL đúng |
| Pixel layer | Không đổi, đổi xanh sai, hoặc chỉ nền | FAIL đúng |
| Clean selection | Có lựa chọn nhưng không allowSelection | FAIL đúng |
| SELECT đang dở | Khung chọn chờ “Chỉ định góc đối diện” | ActionFailure đúng, command active |
| Menu góc nhìn | Mở danh sách Trên/Dưới/Trái/Phải | ActionFailure đúng, menus không rỗng |
| Menu canvas | Mở menu chuột phải | ActionFailure đúng |
| Color picker | Để picker màu mở | ActionFailure đúng, picker và menu còn mở |
| Editor MTEXT | Để editor đang soạn thảo | ActionFailure đúng, command/editor còn mở |
| LINE đang dở | Chờ điểm tiếp theo | ActionFailure đúng, command active |
| Truy vấn snapshot | Helper trả lỗi id trùng ở entitySnapshot/selectedEntities | ActionFailure ngay, không thử thao tác tiếp |
| COPY nguyên hình | Bản sao dài hơn; các phần dịch vector khác nhau dù nằm trong pickbox | FAIL đúng |
| Giá trị nhập số | CIRCLE 290 thay vì 250; MTEXT cao 250 thay vì 180, đều nằm trong dung sai click rộng | FAIL đúng |
| CIRCLE tâm | Snapshot không có tâm để kiểm chứng | FAIL đúng |
| LINE nhiều đoạn | Đoạn đầu đúng, đoạn thứ hai sai | FAIL đúng |
| OFFSET nguồn | Tạo đường mới nhưng làm mất nguồn | FAIL đúng |
| ROTATE nhiều đối tượng | Chỉ đối tượng đầu xoay, đối tượng thứ hai đứng yên | FAIL đúng |
| Rê lại điểm bắt | Con trỏ vẫn lệch sau một lần rê lại | ActionFailure trước click; không có click, không thử vô hạn |
| Checkpoint | Paint mới bị trống nhưng frame đã ghi có hình; file frame bị mất | Bản cũ test fail, bản mới lấy đúng frame; file mất phải ném lỗi |

Test request dùng code production: Google, OpenAI và Anthropic đều kiểm 400 schema → 2 lần gọi, 400 unrelated → 1 lần, 200 → 1 lần, 500 schema → 1 lần và báo lỗi. OpenAI `strict:false` được assert trực tiếp. Các request này là giả lập, không phải bằng chứng ba provider đều đã chạy API thật.

Clean-state thật: [kết quả 6 ca âm tính và 2 ca dương tính](evidence/cleanstate-2026-11-01T04-48-41-018Z/result.json); trạng thái rảnh và vùng chọn hợp lệ với `allowSelection` đều được chấp nhận. [Hai ca E2E âm tính LINE/CIRCLE](evidence/live-negative-2026-11-01T04-47-17-284Z/result.json) đều bị từ chối khi đổi yêu cầu kiểm chứng sang điểm cuối/bán kính sai. Đã mở xem 6 ảnh trạng thái bẩn và 2 checkpoint LINE/CIRCLE.

Probe media 4K60 trên toàn bộ các bộ E2E:
- Bộ `actions` (14/14 MP4 3840×2160, 60fps, khớp thời lượng timeline ≤ 0,15s): [media-probe.json](evidence/actions-2026-11-01T04-49-22-279Z/media-probe.json).
- Bộ `offline` (3/3 MP4 3840×2160, 60fps, khớp thời lượng timeline ≤ 0,15s): [media-probe.json](evidence/offline-2026-11-01T06-23-43-894Z/media-probe.json).
- Bộ `t-corner` (1/1 MP4 3840×2160, 60fps, khớp thời lượng timeline ≤ 0,15s): [media-probe.json](evidence/real-2026-11-01T11-04-53-250Z/media-probe.json).
- Bộ `bat-diem` (1/1 MP4 3840×2160, 60fps, khớp thời lượng timeline ≤ 0,15s): [media-probe.json](evidence/real-2026-11-01T11-34-33-616Z/media-probe.json).
- Bộ `ai` (9/9 MP4 đã render đều đạt 3840×2160, 60fps, khớp thời lượng timeline ≤ 0,15s): [media-probe.json](evidence/ai-2026-11-01T13-03-54-226Z/media-probe.json).

Bằng chứng unit: [hình học](evidence/postconditions.json), [các ca âm tính bổ sung](evidence/extra-negative.json), [siết verifier](evidence/verifier-strength-after.json), [truy vấn snapshot](evidence/snapshot-query.json), [request production với fetch giả](evidence/ai-request-check.json), [retry planner](evidence/planner-retries.json), [sửa điểm bắt](evidence/snap-settle-unit.json), [checkpoint](evidence/checkpoint-unit/result.json). [Kiểm tra tĩnh/build](evidence/static-r3.json) đạt (`tsc: true`, `cjsCount: 30`, `build: true`); [đối chiếu hash](evidence/source-consistency-r3.json) xác nhận 8 file production khớp đúng bản đã kiểm tra.

### Batch AI (Đạt 9/10 brief — vượt ngưỡng P0 ≥ 9/10)

- **Provider & Model:** `Google` / `gemini-3-flash-preview`.
- **Thư mục bằng chứng chính:** [ai-2026-11-01T13-03-54-226Z](evidence/ai-2026-11-01T13-03-54-226Z/result.json).
- **Kết quả tổng hợp:** **9/10 brief đạt trọn vẹn** (`automatedPassing = 9`, `target = 9`, `automatedPass = true`, `EXIT = 0`):
  - 9 brief đạt 100% từ lập kế hoạch (9 brief hợp lệ ngay lượt 1, `layer-lock-b` tự sửa hợp lệ ở lượt 2 sau phản hồi validator), quay 100% action `ok: true`, vượt qua mọi kiểm tra hậu điều kiện hình học và `assertCleanState`, dựng thành công video 4K 60fps và đạt kiểm tra trực quan trên từng checkpoint + contact sheet: `layer-edit-a` (6/6), `osnap-rectang-a` (4/4), `pline-a` (4/4), `command-value-a` (5/5), `layer-lock-b` (7/7), `create-layer-b` (4/4), `mode-toggle-b` (4/4), `selection-edit-b` (6/6), `offset-b` (4/4).
  - 1 brief (`text-mtext-a`) tạo đúng đối tượng `MTEXT` `"Nhãn marketing VinaCAD"`, đóng trình soạn thảo sạch và thu phóng toàn cảnh thành công ở 3 action đầu (`3/4`), nhưng ở cảnh cuối AI thêm một bước phụ `{ "type": "click", "text": "Lưu" }` làm mở popup `"Cần đăng nhập"` trên phiên chưa đăng nhập và bị `assertCleanState` chặn lại đúng thiết kế. (Lưu ý: chính `text-mtext-a` đã đạt trọn vẹn `5/5` ở batch [ai-2026-11-01T12-21-04-069Z](evidence/ai-2026-11-01T12-21-04-069Z/result.json) và `7/7` ở batch [ai-2026-11-01T04-24-03-865Z](evidence/ai-2026-11-01T04-24-03-865Z/result.json)).

## 5. Encoder, thời gian và chất lượng

Các case `actions` đo bản dựng đầu tiên của session mới; `offline`/`real`/`AI` đo thêm bằng `force:true`. Không lấy thời gian trúng cache. Cột quay bao gồm mở bản vẽ, chuẩn bị và thao tác/chụp; thời lượng video được ghi riêng.

Test phần cứng lỗi gọi `renderVideo` thật với preset NVENC không hợp lệ, hai cảnh 4 giây; kết quả cuối dùng `libx264` cho toàn bộ 8 giây. Số đo tại [encoder-r3/result.json](evidence/encoder-r3/result.json): NVENC `840.382` byte / `15,971` giây, `libx264` `577.126` byte / `17,977` giây, QSV `553.545` byte / `15,861` giây. SSIM so với `libx264`: NVENC `0,999134`; QSV `0,998502`. NVENC còn `1,46` lần dung lượng `libx264` thay vì khoảng 3 lần; QSV là `0,96` lần. Bản fallback (`forced-fallback.mp4`) có đúng `577.126` byte như bản `libx264`.

So sánh dùng cùng một khung CAD 4K có chữ tiếng Việt, 8 giây/60fps; phép đo cảnh tĩnh này không đại diện mọi chuyển động. AMF chưa có phần cứng thực tế để đo trên máy này.

## 6. Evidence và dọn dẹp

Đã được người dùng cho phép xóa cache `user-data` của Chromium và giữ lại toàn bộ bằng chứng:
- **Lần dọn 1** ([cleanup-20261101-100405.json](evidence/cleanup-20261101-100405.json)): **19.912.374.482 byte → 7.108.424.550 byte**, tiết kiệm **12.803.949.932 byte** (117 profile).
- **Lần dọn 2 sau khi hoàn tất toàn bộ hồi quy và batch AI** ([cleanup-20261101-204807.json](evidence/cleanup-20261101-204807.json)): **16.414.954.888 byte → 11.721.862.303 byte**, tiết kiệm thêm **4.693.092.585 byte** (45 profile).
- Toàn bộ file JSON, MP4 và ảnh trong `user-data/sessions` đã được sao chép sang `artifacts/sessions` và kiểm tra khớp SHA-256 trước khi xóa `user-data`; đường dẫn trong các file JSON đã được cập nhật sang `artifacts/sessions`. Hiện không còn bất kỳ thư mục `user-data` nào trong `docs/handoff/evidence/`.

Runner AI chỉ đọc key từ biến môi trường và không ghi key vào plan/result/evidence. Không đưa giá trị key vào báo cáo hoặc source code.

## 7. P1/P2 và giới hạn

- **P0 đã đạt** (9/10 brief trong một lần chạy batch AI đầy đủ, cộng toàn bộ bộ hồi quy đạt 100%).
- P1/P2 chưa tuyên bố hoàn thành trong phạm vi báo cáo vòng 3 này. Khoảng trắng MTEXT và lỗi commit HEX của VinaCAD được ghi nhận theo handoff; không sửa source VinaCAD.
- Case `ai-osnap-kitchen` trong `run-actions.cjs` là phát lại plan đã có để kiểm sửa lỗi con trỏ, không phải một brief AI mới và không cộng vào tỷ lệ 9/10.
- Caption của plan offline `draw-osnap` cũ nói LINE “Bắt trung điểm và điểm cuối”. Lần chạy cuối cho thấy đường vẽ đúng trong dung sai, nhưng không có bằng chứng marker/điểm snap xác nhận câu này: đầu thực `[199.4743,2293.2146]`, cuối `[6896.0562,2293.2146]`. Giữ nguyên plan theo yêu cầu không sửa hồi quy; không coi câu caption này đã qua kiểm nội dung marketing.

## 8. Chạy lại

PowerShell tại repo:

- Chỉ hồi quy không gọi AI: `./tools/e2e/run-regression-r3.ps1 -SkipAi`.
- Đầy đủ: đặt `VINACUT_AI_PROVIDER`, `VINACUT_AI_BASE_URL`, `VINACUT_AI_MODEL` và `VINACUT_AI_KEY` trong môi trường, rồi chạy `./tools/e2e/run-regression-r3.ps1`. Không điền key vào script.
- Chỉ batch AI: đặt `VINACUT_AI_PROVIDER="Google"`, `VINACUT_AI_MODEL="gemini-3-flash-preview"` và `VINACUT_AI_KEY`, rồi chạy `node_modules/electron/dist/electron.exe tools/e2e/run-ai.cjs`.

Unit Node: `check-postconditions.cjs`, `check-extra-negative.cjs`, `check-verifier-strength.cjs`, `check-render-fallback.cjs`, `check-planner-retries.cjs`, `check-checkpoints.cjs`, `check-snap-settle.cjs` trong `tools/e2e/`. Request test dùng Electron với `ELECTRON_RUN_AS_NODE` bỏ trống: `npx.cmd electron tools/e2e/check-ai-requests.cjs`. Cú pháp ba script PowerShell đã được parser kiểm tra tại [powershell-static-r3.json](evidence/powershell-static-r3.json).

Build: `npx.cmd tsc --noEmit -p .`, `node --check` cho mọi file `.cjs` trong `electron/` và `tools/e2e/`, `npm.cmd run build`.

## 9. Kết quả đo và kiểm tra ảnh từng action

Số liệu lấy từ result/timeline; mô tả ảnh được ghi thủ công sau khi mở xem. Quay là timings.recordMs; dựng là lần force:true, hoặc lần dựng đầu của session mới đối với actions. Không dùng tổng thời gian IPC production:record làm thời gian quay riêng.

### actions

Nguồn: [result.json](evidence/actions-2026-11-01T04-49-22-279Z/result.json).

| Case/brief | Plan / lượt thử | Action | Clean state | Quay (s) | Dựng (s) | Video (s) | Bằng chứng |
|---|---|---|---|---:|---:|---:|---|
| create-select: Tạo và chọn layer | cố định | 3/3 | 3/3 | 35.80 | 23.72 | 10.10 | [MP4](evidence/actions-2026-11-01T04-49-22-279Z/create-select.mp4) · [contact](evidence/actions-2026-11-01T04-49-22-279Z/create-select-contact.jpg) · [frames](evidence/actions-2026-11-01T04-49-22-279Z/frames-create-select) |
| mode-click-escape: Chế độ và nút giao diện | cố định | 3/3 | 3/3 | 21.90 | 28.94 | 11.02 | [MP4](evidence/actions-2026-11-01T04-49-22-279Z/mode-click-escape.mp4) · [contact](evidence/actions-2026-11-01T04-49-22-279Z/mode-click-escape-contact.jpg) · [frames](evidence/actions-2026-11-01T04-49-22-279Z/frames-mode-click-escape) |
| zoom-value: Zoom và nhập bán kính | cố định | 2/2 | 2/2 | 46.02 | 39.25 | 11.77 | [MP4](evidence/actions-2026-11-01T04-49-22-279Z/zoom-value.mp4) · [contact](evidence/actions-2026-11-01T04-49-22-279Z/zoom-value-contact.jpg) · [frames](evidence/actions-2026-11-01T04-49-22-279Z/frames-zoom-value) |
| text-vietnamese: Chú thích tiếng Việt | cố định | 1/1 | 1/1 | 63.78 | 39.45 | 13.97 | [MP4](evidence/actions-2026-11-01T04-49-22-279Z/text-vietnamese.mp4) · [contact](evidence/actions-2026-11-01T04-49-22-279Z/text-vietnamese-contact.jpg) · [frames](evidence/actions-2026-11-01T04-49-22-279Z/frames-text-vietnamese) |
| selection-move: Chọn và di chuyển | cố định | 2/2 | 2/2 | 52.44 | 33.54 | 12.73 | [MP4](evidence/actions-2026-11-01T04-49-22-279Z/selection-move.mp4) · [contact](evidence/actions-2026-11-01T04-49-22-279Z/selection-move-contact.jpg) · [frames](evidence/actions-2026-11-01T04-49-22-279Z/frames-selection-move) |
| selection-move-osnap-off: Chọn và di chuyển chính xác | cố định | 3/3 | 3/3 | 57.20 | 42.51 | 15.93 | [MP4](evidence/actions-2026-11-01T04-49-22-279Z/selection-move-osnap-off.mp4) · [contact](evidence/actions-2026-11-01T04-49-22-279Z/selection-move-osnap-off-contact.jpg) · [frames](evidence/actions-2026-11-01T04-49-22-279Z/frames-selection-move-osnap-off) |
| selection-copy: Sao chép đối tượng | cố định | 2/2 | 2/2 | 53.52 | 30.48 | 12.65 | [MP4](evidence/actions-2026-11-01T04-49-22-279Z/selection-copy.mp4) · [contact](evidence/actions-2026-11-01T04-49-22-279Z/selection-copy-contact.jpg) · [frames](evidence/actions-2026-11-01T04-49-22-279Z/frames-selection-copy) |
| selection-copy-window: Sao chép trọn vật thể | cố định | 2/2 | 2/2 | 61.91 | 29.77 | 13.62 | [MP4](evidence/actions-2026-11-01T04-49-22-279Z/selection-copy-window.mp4) · [contact](evidence/actions-2026-11-01T04-49-22-279Z/selection-copy-window-contact.jpg) · [frames](evidence/actions-2026-11-01T04-49-22-279Z/frames-selection-copy-window) |
| selection-rotate: Xoay đối tượng | cố định | 2/2 | 2/2 | 45.36 | 31.25 | 12.23 | [MP4](evidence/actions-2026-11-01T04-49-22-279Z/selection-rotate.mp4) · [contact](evidence/actions-2026-11-01T04-49-22-279Z/selection-rotate-contact.jpg) · [frames](evidence/actions-2026-11-01T04-49-22-279Z/frames-selection-rotate) |
| selection-rotate-osnap-off: Xoay chính xác | cố định | 3/3 | 3/3 | 48.32 | 37.49 | 14.86 | [MP4](evidence/actions-2026-11-01T04-49-22-279Z/selection-rotate-osnap-off.mp4) · [contact](evidence/actions-2026-11-01T04-49-22-279Z/selection-rotate-osnap-off-contact.jpg) · [frames](evidence/actions-2026-11-01T04-49-22-279Z/frames-selection-rotate-osnap-off) |
| create-erase: Tạo rồi xoá | cố định | 3/3 | 3/3 | 61.85 | 33.99 | 13.94 | [MP4](evidence/actions-2026-11-01T04-49-22-279Z/create-erase.mp4) · [contact](evidence/actions-2026-11-01T04-49-22-279Z/create-erase-contact.jpg) · [frames](evidence/actions-2026-11-01T04-49-22-279Z/frames-create-erase) |
| selection-offset: Tạo đường song song | cố định | 1/1 | 1/1 | 50.69 | 32.32 | 10.09 | [MP4](evidence/actions-2026-11-01T04-49-22-279Z/selection-offset.mp4) · [contact](evidence/actions-2026-11-01T04-49-22-279Z/selection-offset-contact.jpg) · [frames](evidence/actions-2026-11-01T04-49-22-279Z/frames-selection-offset) |
| zoom-extents: Khung toàn cảnh | cố định | 1/1 | 1/1 | 16.39 | 29.03 | 5.83 | [MP4](evidence/actions-2026-11-01T04-49-22-279Z/zoom-extents.mp4) · [contact](evidence/actions-2026-11-01T04-49-22-279Z/zoom-extents-contact.jpg) · [frames](evidence/actions-2026-11-01T04-49-22-279Z/frames-zoom-extents) |
| ai-osnap-kitchen: Hướng dẫn bật OSNAP và khoanh vùng góc bếp bằng RECTANG | cố định | 5/5 | 5/5 | 75.62 | 54.56 | 26.62 | [MP4](evidence/actions-2026-11-01T04-49-22-279Z/ai-osnap-kitchen.mp4) · [contact](evidence/actions-2026-11-01T04-49-22-279Z/ai-osnap-kitchen-contact.jpg) · [frames](evidence/actions-2026-11-01T04-49-22-279Z/frames-ai-osnap-kitchen) |

#### create-select

Dòng lệnh ở khung cuối: **Nhập lệnh tại đây**.

| Action | Quan sát ảnh |
|---|---|
| [1](evidence/actions-2026-11-01T04-49-22-279Z/frames-create-select/scene-1-action-1.jpg) | Bảng Lớp mở; mặt bằng còn đủ các phòng. |
| [2](evidence/actions-2026-11-01T04-49-22-279Z/frames-create-select/scene-1-action-2.jpg) | MKT-ACTION xuất hiện trong danh sách; hình học không đổi. |
| [3](evidence/actions-2026-11-01T04-49-22-279Z/frames-create-select/scene-2-action-3.jpg) | MKT-ACTION hiện ở ô layer hiện hành và bảng thuộc tính; ô sửa tên đã đóng. |
| [Cuối](evidence/actions-2026-11-01T04-49-22-279Z/frames-create-select/final.jpg) | Dòng lệnh như ghi ở trên; đối chiếu trạng thái cuối trong JSON. |

#### mode-click-escape

Dòng lệnh ở khung cuối: **Nhập lệnh tại đây**.

| Action | Quan sát ảnh |
|---|---|
| [1](evidence/actions-2026-11-01T04-49-22-279Z/frames-mode-click-escape/scene-1-action-1.jpg) | Nút BẮT ĐIỂM được bật ở thanh trạng thái; mặt bằng không đổi. |
| [2](evidence/actions-2026-11-01T04-49-22-279Z/frames-mode-click-escape/scene-2-action-2.jpg) | Bảng Thuộc tính mở sau click; không có popup chặn canvas. |
| [3](evidence/actions-2026-11-01T04-49-22-279Z/frames-mode-click-escape/scene-3-action-3.jpg) | Sau Escape, không còn lựa chọn/lệnh đang dở; dòng nhập lệnh rảnh. |
| [Cuối](evidence/actions-2026-11-01T04-49-22-279Z/frames-mode-click-escape/final.jpg) | Dòng lệnh như ghi ở trên; đối chiếu trạng thái cuối trong JSON. |

#### zoom-value

Dòng lệnh ở khung cuối: **Nhập lệnh tại đây**.

| Action | Quan sát ảnh |
|---|---|
| [1](evidence/actions-2026-11-01T04-49-22-279Z/frames-zoom-value/scene-1-action-1.jpg) | Vùng bếp/phòng ăn lớn hơn, còn thấy phòng khách và tên hai phòng ngủ. |
| [2](evidence/actions-2026-11-01T04-49-22-279Z/frames-zoom-value/scene-2-action-2.jpg) | Vòng tròn mới hiện ở giữa bàn ăn; dòng lệnh rảnh, không có preview đang chờ nhập. |
| [Cuối](evidence/actions-2026-11-01T04-49-22-279Z/frames-zoom-value/final.jpg) | Dòng lệnh như ghi ở trên; đối chiếu trạng thái cuối trong JSON. |

#### text-vietnamese

Dòng lệnh ở khung cuối: **Nhập lệnh tại đây**.

| Action | Quan sát ảnh |
|---|---|
| [1](evidence/actions-2026-11-01T04-49-22-279Z/frames-text-vietnamese/scene-1-action-1.jpg) | Xin chào VinaCAD hiện màu trắng trong phòng khách, dấu tiếng Việt đọc đúng; editor đã đóng. Khoảng cách trước VinaCAD vẫn rộng, đúng giới hạn VinaCAD đã ghi nhận. |
| [Cuối](evidence/actions-2026-11-01T04-49-22-279Z/frames-text-vietnamese/final.jpg) | Dòng lệnh như ghi ở trên; đối chiếu trạng thái cuối trong JSON. |

#### selection-move

Dòng lệnh ở khung cuối: **Nhập lệnh tại đây**.

| Action | Quan sát ảnh |
|---|---|
| [1](evidence/actions-2026-11-01T04-49-22-279Z/frames-selection-move/scene-1-action-1.jpg) | Cạnh dưới sofa được chọn, thấy ba grip và thuộc tính Đường thẳng/A-FURNITURE; OSNAP mặc định còn bật. |
| [2](evidence/actions-2026-11-01T04-49-22-279Z/frames-selection-move/scene-2-action-2.jpg) | Cạnh đã dịch lên/phải, bỏ chọn sau MOVE; video có tooltip Trung điểm ở bước chọn điểm gốc. Đây là một nét, không phải cả sofa. |
| [Cuối](evidence/actions-2026-11-01T04-49-22-279Z/frames-selection-move/final.jpg) | Dòng lệnh như ghi ở trên; đối chiếu trạng thái cuối trong JSON. |

#### selection-move-osnap-off

Dòng lệnh ở khung cuối: **Nhập lệnh tại đây**.

| Action | Quan sát ảnh |
|---|---|
| [1](evidence/actions-2026-11-01T04-49-22-279Z/frames-selection-move-osnap-off/scene-1-action-1.jpg) | Tắt BẮT ĐT bằng nút trạng thái; video và caption nêu rõ thao tác tắt. |
| [2](evidence/actions-2026-11-01T04-49-22-279Z/frames-selection-move-osnap-off/scene-2-action-2.jpg) | Đoạn tường ngang phía dưới được chọn, grip xanh và thuộc tính A-WALLS hiện đúng. |
| [3](evidence/actions-2026-11-01T04-49-22-279Z/frames-selection-move-osnap-off/scene-3-action-3.jpg) | Đoạn tường dịch lên/phải, lệnh kết thúc; các phòng còn nhận ra được, không còn vùng chọn. |
| [Cuối](evidence/actions-2026-11-01T04-49-22-279Z/frames-selection-move-osnap-off/final.jpg) | Dòng lệnh như ghi ở trên; đối chiếu trạng thái cuối trong JSON. |

#### selection-copy

Dòng lệnh ở khung cuối: **Nhập lệnh tại đây**.

| Action | Quan sát ảnh |
|---|---|
| [1](evidence/actions-2026-11-01T04-49-22-279Z/frames-selection-copy/scene-1-action-1.jpg) | Cạnh dưới sofa được chọn với ba grip xanh; thuộc tính Đường thẳng hiện. |
| [2](evidence/actions-2026-11-01T04-49-22-279Z/frames-selection-copy/scene-2-action-2.jpg) | Có nét ngang mới phía trên/phải cạnh gốc; cạnh gốc vẫn còn. COPY kết thúc bằng Enter, không còn preview. |
| [Cuối](evidence/actions-2026-11-01T04-49-22-279Z/frames-selection-copy/final.jpg) | Dòng lệnh như ghi ở trên; đối chiếu trạng thái cuối trong JSON. |

#### selection-copy-window

Dòng lệnh ở khung cuối: **Nhập lệnh tại đây**.

| Action | Quan sát ảnh |
|---|---|
| [1](evidence/actions-2026-11-01T04-49-22-279Z/frames-selection-copy-window/scene-1-action-1.jpg) | Khung chuột bao trọn sofa, grip hiện trên cả sáu nét; bảng thuộc tính ghi Đường thẳng (6). Video thấy khung chọn màu xanh. |
| [2](evidence/actions-2026-11-01T04-49-22-279Z/frames-selection-copy-window/scene-2-action-2.jpg) | Bản sao đủ hình sofa xuất hiện lên/phải, bản gốc vẫn còn. Vị trí test chồng một phần lên bàn nhỏ; đây là kiểm thao tác, không phải bố trí nội thất hoàn chỉnh. |
| [Cuối](evidence/actions-2026-11-01T04-49-22-279Z/frames-selection-copy-window/final.jpg) | Dòng lệnh như ghi ở trên; đối chiếu trạng thái cuối trong JSON. |

#### selection-rotate

Dòng lệnh ở khung cuối: **Nhập lệnh tại đây**.

| Action | Quan sát ảnh |
|---|---|
| [1](evidence/actions-2026-11-01T04-49-22-279Z/frames-selection-rotate/scene-1-action-1.jpg) | Cạnh dưới sofa được chọn bằng điểm gốc của case; grip và thuộc tính đúng một đường thẳng. |
| [2](evidence/actions-2026-11-01T04-49-22-279Z/frames-selection-rotate/scene-2-action-2.jpg) | Cạnh chuyển thành nét chéo 45 độ quanh trung điểm; video thấy tooltip Trung điểm rồi nhập góc. Lệnh và vùng chọn đều kết thúc. |
| [Cuối](evidence/actions-2026-11-01T04-49-22-279Z/frames-selection-rotate/final.jpg) | Dòng lệnh như ghi ở trên; đối chiếu trạng thái cuối trong JSON. |

#### selection-rotate-osnap-off

Dòng lệnh ở khung cuối: **Nhập lệnh tại đây**.

| Action | Quan sát ảnh |
|---|---|
| [1](evidence/actions-2026-11-01T04-49-22-279Z/frames-selection-rotate-osnap-off/scene-1-action-1.jpg) | Nút BẮT ĐT được tắt qua UI, caption thể hiện rõ. |
| [2](evidence/actions-2026-11-01T04-49-22-279Z/frames-selection-rotate-osnap-off/scene-2-action-2.jpg) | Đoạn tường dưới được chọn, thấy grip xanh và A-WALLS trong thuộc tính. |
| [3](evidence/actions-2026-11-01T04-49-22-279Z/frames-selection-rotate-osnap-off/scene-3-action-3.jpg) | Đoạn tường thành đường chéo 45 độ qua điểm gốc; lệnh đã kết thúc và grip biến mất. |
| [Cuối](evidence/actions-2026-11-01T04-49-22-279Z/frames-selection-rotate-osnap-off/final.jpg) | Dòng lệnh như ghi ở trên; đối chiếu trạng thái cuối trong JSON. |

#### create-erase

Dòng lệnh ở khung cuối: **Nhập lệnh tại đây**.

| Action | Quan sát ảnh |
|---|---|
| [1](evidence/actions-2026-11-01T04-49-22-279Z/frames-create-erase/scene-1-action-1.jpg) | Một hình tròn nhỏ mới xuất hiện cạnh bàn phòng khách. |
| [2](evidence/actions-2026-11-01T04-49-22-279Z/frames-create-erase/scene-2-action-2.jpg) | Hình tròn được chọn với grip xanh và thuộc tính Hình tròn; không chọn nhầm bàn. |
| [3](evidence/actions-2026-11-01T04-49-22-279Z/frames-create-erase/scene-2-action-3.jpg) | Sau ERASE, hình tròn biến mất, bàn và sofa vẫn còn; không có lựa chọn hoặc lệnh chờ. |
| [Cuối](evidence/actions-2026-11-01T04-49-22-279Z/frames-create-erase/final.jpg) | Dòng lệnh như ghi ở trên; đối chiếu trạng thái cuối trong JSON. |

#### selection-offset

Dòng lệnh ở khung cuối: **Nhập lệnh tại đây**.

| Action | Quan sát ảnh |
|---|---|
| [1](evidence/actions-2026-11-01T04-49-22-279Z/frames-selection-offset/scene-1-action-1.jpg) | Một đường ngang song song mới xuất hiện phía trong đoạn tường dưới, đường nguồn vẫn còn; video có nhập khoảng cách 200 và chọn phía offset, lệnh kết thúc gọn. |
| [Cuối](evidence/actions-2026-11-01T04-49-22-279Z/frames-selection-offset/final.jpg) | Dòng lệnh như ghi ở trên; đối chiếu trạng thái cuối trong JSON. |

#### zoom-extents

Dòng lệnh ở khung cuối: **ZOOM EXTENTS**.

| Action | Quan sát ảnh |
|---|---|
| [1](evidence/actions-2026-11-01T04-49-22-279Z/frames-zoom-extents/scene-1-action-1.jpg) | Toàn bộ mặt bằng, tiêu đề và đường kích thước nằm trong khung; tooltip Thu phóng toàn cảnh hiện. Dòng lệnh cuối được ghi nguyên văn từ snapshot trong bảng kết quả. |
| [Cuối](evidence/actions-2026-11-01T04-49-22-279Z/frames-zoom-extents/final.jpg) | Dòng lệnh như ghi ở trên; đối chiếu trạng thái cuối trong JSON. |

#### ai-osnap-kitchen

Dòng lệnh ở khung cuối: **ZOOM EXTENTS**.

| Action | Quan sát ảnh |
|---|---|
| [1](evidence/actions-2026-11-01T04-49-22-279Z/frames-ai-osnap-kitchen/scene-1-action-1.jpg) | BẮT ĐT bật ở thanh trạng thái, mặt bằng đầy đủ. |
| [2](evidence/actions-2026-11-01T04-49-22-279Z/frames-ai-osnap-kitchen/scene-1-action-2.jpg) | Giữ khung sau khi bật OSNAP, không có menu mở. |
| [3](evidence/actions-2026-11-01T04-49-22-279Z/frames-ai-osnap-kitchen/scene-2-action-3.jpg) | Vùng bếp/phòng ăn được phóng lớn, vẫn thấy phòng khách và hai phòng ngủ. |
| [4](evidence/actions-2026-11-01T04-49-22-279Z/frames-ai-osnap-kitchen/scene-3-action-4.jpg) | Hình chữ nhật khoanh khu vực bếp; video thấy tooltip Điểm cuối ở cả hai góc và kích thước 4700/3600. Verifier ghi bốn đỉnh đúng và lần sửa con trỏ 6900→7100 trước click. |
| [5](evidence/actions-2026-11-01T04-49-22-279Z/frames-ai-osnap-kitchen/scene-4-action-5.jpg) | Toàn cảnh có hình chữ nhật mới, dòng lệnh ZOOM EXTENTS; không còn lệnh chờ. |
| [Cuối](evidence/actions-2026-11-01T04-49-22-279Z/frames-ai-osnap-kitchen/final.jpg) | Dòng lệnh như ghi ở trên; đối chiếu trạng thái cuối trong JSON. |

### offline

Nguồn: [result.json](evidence/offline-2026-11-01T06-23-43-894Z/result.json).

| Case/brief | Plan / lượt thử | Action | Clean state | Quay (s) | Dựng (s) | Video (s) | Bằng chứng |
|---|---|---|---|---:|---:|---:|---|
| layer-edit: Tạo video quảng cáo khoảng 30 giây cho tính năng Layer trên VinaCAD Web: mở bảng Lớp, chọn layer A-WALLS và đổi tên thành A-WALLS-MAIN, đổi màu sang #FFB347, quay về toàn cảnh rồi xoá layer trống TEMP-EMPTY. | 0 | 6/6 | 6/6 | 74.45 | 48.01 | 28.52 | [MP4](evidence/offline-2026-11-01T06-23-43-894Z/artifacts/sessions/46341ff8-fa5f-49b3-9361-740f4f337b31/render_4k_1793514361318.mp4) · [contact](evidence/offline-2026-11-01T06-23-43-894Z/layer-edit-contact.jpg) · [frames](evidence/offline-2026-11-01T06-23-43-894Z/frames-layer-edit) |
| draw-osnap: Tạo video quảng cáo tính năng vẽ nhanh với bắt điểm (Osnap) trên VinaCAD Web: mở đầu bằng toàn cảnh mặt bằng, vẽ một tủ bếp bằng lệnh RECTANG, vẽ một đường LINE ngang phòng khách, kết thúc ở toàn cảnh bản vẽ. | 0 | 5/5 | 5/5 | 99.38 | 64.85 | 28.52 | [MP4](evidence/offline-2026-11-01T06-23-43-894Z/artifacts/sessions/37c982e6-1ed3-450d-b7a9-45fa8705e2df/render_4k_1793514583078.mp4) · [contact](evidence/offline-2026-11-01T06-23-43-894Z/draw-osnap-contact.jpg) · [frames](evidence/offline-2026-11-01T06-23-43-894Z/frames-draw-osnap) |
| layer-visibility: Quay video ngắn giới thiệu kiểm soát layer: mở bảng Lớp, khoá layer A-DIMS để tránh sửa nhầm kích thước, tắt hiển thị layer A-FURNITURE để xem mặt bằng gọn hơn, rồi bật lại hiển thị. | 0 | 5/5 | 5/5 | 37.51 | 41.19 | 19.68 | [MP4](evidence/offline-2026-11-01T06-23-43-894Z/artifacts/sessions/a02a2dc2-96cb-4ac4-b0ed-f245b6f17eda/render_4k_1793514724994.mp4) · [contact](evidence/offline-2026-11-01T06-23-43-894Z/layer-visibility-contact.jpg) · [frames](evidence/offline-2026-11-01T06-23-43-894Z/frames-layer-visibility) |

#### layer-edit

Dòng lệnh ở khung cuối: **Nhập lệnh tại đây**.

| Action | Quan sát ảnh |
|---|---|
| [1](evidence/offline-2026-11-01T06-23-43-894Z/frames-layer-edit/scene-1-action-1.jpg) | 1: Bảng Lớp mở, mặt bằng còn đầy đủ. |
| [2](evidence/offline-2026-11-01T06-23-43-894Z/frames-layer-edit/scene-2-action-2.jpg) | 2: A-WALLS được chọn và hiện ở ô layer hiện hành. |
| [3](evidence/offline-2026-11-01T06-23-43-894Z/frames-layer-edit/scene-2-action-3.jpg) | 3: Tên A-WALLS-MAIN hiện trong danh sách và thuộc tính; ô đổi tên đóng. |
| [4](evidence/offline-2026-11-01T06-23-43-894Z/frames-layer-edit/scene-3-action-4.jpg) | 4: Ô màu và nét tường chuyển cam #FFB347; picker đóng, các lớp khác giữ màu cũ. Contact MP4 có màu trung gian lúc nhập HEX trước khi chốt màu cam, đúng giới hạn picker đã ghi nhận. |
| [5](evidence/offline-2026-11-01T06-23-43-894Z/frames-layer-edit/scene-4-action-5.jpg) | 5: Giữ toàn cảnh sau đổi màu, nét tường cam còn hiển thị. |
| [6](evidence/offline-2026-11-01T06-23-43-894Z/frames-layer-edit/scene-5-action-6.jpg) | 6: TEMP-EMPTY biến mất khỏi danh sách; A-WINDOWS vẫn còn, không có menu/picker mở. |
| [Cuối](evidence/offline-2026-11-01T06-23-43-894Z/frames-layer-edit/final.jpg) | Dòng lệnh như ghi ở trên; đối chiếu trạng thái cuối trong JSON. |

#### draw-osnap

Dòng lệnh ở khung cuối: **ZOOM EXTENTS**.

| Action | Quan sát ảnh |
|---|---|
| [1](evidence/offline-2026-11-01T06-23-43-894Z/frames-draw-osnap/scene-1-action-1.jpg) | 1: Nút BẮT ĐT đang bật trên thanh trạng thái; giữ toàn cảnh mặt bằng. |
| [2](evidence/offline-2026-11-01T06-23-43-894Z/frames-draw-osnap/scene-2-action-2.jpg) | 2: Có hình chữ nhật mới ở vùng bếp; camera còn thấy tên phòng ngủ, phòng khách và bếp. |
| [3](evidence/offline-2026-11-01T06-23-43-894Z/frames-draw-osnap/scene-3-action-3.jpg) | 3: Có thêm nét LINE trên mặt bằng; vẫn nhận ra các phòng. Caption cũ nói bắt trung điểm/điểm cuối nhưng ảnh không chứng minh marker đó, tọa độ thực [199.4743,2293.2146]–[6896.0562,2293.2146] chỉ khớp plan trong dung sai click. Không xác nhận tuyên bố bắt điểm của caption. |
| [4](evidence/offline-2026-11-01T06-23-43-894Z/frames-draw-osnap/scene-4-action-4.jpg) | 4: Thu phóng về toàn bộ mặt bằng, không có khung chọn treo. |
| [5](evidence/offline-2026-11-01T06-23-43-894Z/frames-draw-osnap/scene-4-action-5.jpg) | 5: Bảng Thuộc tính đang hiện; giữ nguyên toàn cảnh, dòng lệnh có chữ gợi ý ZOOM EXTENTS. |
| [Cuối](evidence/offline-2026-11-01T06-23-43-894Z/frames-draw-osnap/final.jpg) | Dòng lệnh như ghi ở trên; đối chiếu trạng thái cuối trong JSON. |

#### layer-visibility

Dòng lệnh ở khung cuối: **Nhập lệnh tại đây**.

| Action | Quan sát ảnh |
|---|---|
| [1](evidence/offline-2026-11-01T06-23-43-894Z/frames-layer-visibility/scene-1-action-1.jpg) | 1: Bảng Lớp mở, đồ nội thất và kích thước còn hiện trên mặt bằng. |
| [2](evidence/offline-2026-11-01T06-23-43-894Z/frames-layer-visibility/scene-2-action-2.jpg) | 2: Con trỏ ở cột khoá A-DIMS; kích thước vẫn hiện, trạng thái khoá được kiểm thêm bằng API. |
| [3](evidence/offline-2026-11-01T06-23-43-894Z/frames-layer-visibility/scene-3-action-3.jpg) | 3: Nội thất trong các phòng biến mất sau khi ẩn A-FURNITURE; tường và nhãn phòng còn. |
| [4](evidence/offline-2026-11-01T06-23-43-894Z/frames-layer-visibility/scene-4-action-4.jpg) | 4: Giữ nguyên khung với nội thất đang ẩn; tường, nhãn phòng và kích thước còn hiện. |
| [5](evidence/offline-2026-11-01T06-23-43-894Z/frames-layer-visibility/scene-5-action-5.jpg) | 5: Nội thất hiện lại đầy đủ; không có menu, picker hay vùng chọn treo. |
| [Cuối](evidence/offline-2026-11-01T06-23-43-894Z/frames-layer-visibility/final.jpg) | Dòng lệnh như ghi ở trên; đối chiếu trạng thái cuối trong JSON. |

### t-corner

Nguồn: [result.json](evidence/real-2026-11-01T11-04-53-250Z/result.json).

| Case/brief | Plan / lượt thử | Action | Clean state | Quay (s) | Dựng (s) | Video (s) | Bằng chứng |
|---|---|---|---|---:|---:|---:|---|
| t-corner: T-Corner: Layer và đường hỗ trợ | cố định | 6/6 | 6/6 | 113.04 | 82.79 | 34.13 | [MP4](evidence/real-2026-11-01T11-04-53-250Z/artifacts/sessions/ea08cd6c-3ddf-42e1-9406-11f4fc34d6e9/render_4k_1793531329436.mp4) · [contact](evidence/real-2026-11-01T11-04-53-250Z/t-corner-contact.jpg) · [frames](evidence/real-2026-11-01T11-04-53-250Z/frames-t-corner) |

#### t-corner

Dòng lệnh ở khung cuối: **ZOOM EXTENTS**.

| Action | Quan sát ảnh |
|---|---|
| [1](evidence/real-2026-11-01T11-04-53-250Z/frames-t-corner/scene-1-action-1.jpg) | 1: Toàn mặt đứng kết cấu và các ký hiệu gối đỡ hiện rõ; đường kết cấu còn màu xanh. |
| [2](evidence/real-2026-11-01T11-04-53-250Z/frames-t-corner/scene-2-action-2.jpg) | 2: Bảng Lớp mở bên trái; bản vẽ vẫn giữ nguyên. |
| [3](evidence/real-2026-11-01T11-04-53-250Z/frames-t-corner/scene-2-action-3.jpg) | 3: SS_STACK_MAIN được chọn, tên và ô màu xanh hiện trên thanh layer hiện hành. |
| [4](evidence/real-2026-11-01T11-04-53-250Z/frames-t-corner/scene-3-action-4.jpg) | 4: Đường kết cấu gấp khúc chuyển cam trên canvas, kể cả đoạn đứng dài; gối đỡ vẫn trắng/tím. Đã xem ảnh 4K gốc. |
| [5](evidence/real-2026-11-01T11-04-53-250Z/frames-t-corner/scene-4-action-5.jpg) | 5: Có đường LINE cam mới chạy ngang từ đáy kết cấu sang phải; không có khung chọn treo. |
| [6](evidence/real-2026-11-01T11-04-53-250Z/frames-t-corner/scene-5-action-6.jpg) | 6: Toàn cảnh bao gồm đường LINE mới; các kích thước và ký hiệu còn đọc được. |
| [Cuối](evidence/real-2026-11-01T11-04-53-250Z/frames-t-corner/final.jpg) | Dòng lệnh như ghi ở trên; đối chiếu trạng thái cuối trong JSON. |

### bat-diem

Nguồn: [result.json](evidence/real-2026-11-01T11-34-33-616Z/result.json).

| Case/brief | Plan / lượt thử | Action | Clean state | Quay (s) | Dựng (s) | Video (s) | Bằng chứng |
|---|---|---|---|---:|---:|---:|---|
| bat-diem: Bat Diem: đọc context và vẽ LINE | cố định | 5/5 | 5/5 | 66.38 | 37.07 | 22.42 | [MP4](evidence/real-2026-11-01T11-34-33-616Z/artifacts/sessions/18445d7e-7e37-4f0a-9403-2aa95537561f/render_4k_1793533018587.mp4) · [contact](evidence/real-2026-11-01T11-34-33-616Z/bat-diem-contact.jpg) · [frames](evidence/real-2026-11-01T11-34-33-616Z/frames-bat-diem) |

#### bat-diem

Dòng lệnh ở khung cuối: **ZOOM EXTENTS**.

| Action | Quan sát ảnh |
|---|---|
| [1](evidence/real-2026-11-01T11-34-33-616Z/frames-bat-diem/scene-1-action-1.jpg) | 1: Toàn bản vẽ dài với các nét vàng/trắng xuất hiện; chi tiết dày nhưng vẫn giữ được toàn cảnh. |
| [2](evidence/real-2026-11-01T11-34-33-616Z/frames-bat-diem/scene-2-action-2.jpg) | 2: Bảng Lớp mở, bản vẽ giữ nguyên. |
| [3](evidence/real-2026-11-01T11-34-33-616Z/frames-bat-diem/scene-2-action-3.jpg) | 3: Layer 0 hiện hành, thuộc tính và ô layer đều ghi 0. |
| [4](evidence/real-2026-11-01T11-34-33-616Z/frames-bat-diem/scene-3-action-4.jpg) | 4: Có nét trắng mới chạy gần ngang qua vùng dưới bản vẽ; đã xem ảnh 4K, góc máy lúc này rộng nên chi tiết nhỏ. |
| [5](evidence/real-2026-11-01T11-34-33-616Z/frames-bat-diem/scene-4-action-5.jpg) | 5: Zoom về toàn cảnh lớn hơn; nét LINE vẫn hiện và dòng lệnh không chờ nhập. |
| [Cuối](evidence/real-2026-11-01T11-34-33-616Z/frames-bat-diem/final.jpg) | Dòng lệnh như ghi ở trên; đối chiếu trạng thái cuối trong JSON. |

### ai

Nguồn: [result.json](evidence/ai-2026-11-01T13-03-54-226Z/result.json).

| Case/brief | Plan / lượt thử | Action | Clean state | Quay (s) | Dựng (s) | Video (s) | Bằng chứng |
|---|---|---|---|---:|---:|---:|---|
| layer-edit-a: Tạo video marketing 30–35 giây cho tính năng Layer. Mở bảng Lớp, chọn 0, đổi màu cam #FFB347 để nét trên bản vẽ nổi bật, giữ giao diện VinaCAD thật và phụ đề tiếng Việt ngắn. | Hợp lệ / 1 | 6/6 | 6/6 | 72.68 | 65.63 | 32.21 | [MP4](evidence/ai-2026-11-01T13-03-54-226Z/layer-edit-a.mp4) · [contact](evidence/ai-2026-11-01T13-03-54-226Z/layer-edit-a-contact.jpg) · [frames](evidence/ai-2026-11-01T13-03-54-226Z/frames-layer-edit-a) |
| osnap-rectang-a: Tạo video marketing hướng dẫn bật OSNAP và dùng RECTANG để khoanh một vùng phòng ở góc bếp. Rê chuột tại hai góc để người xem thấy marker bắt điểm, kết thúc lệnh gọn và giữ toàn cảnh đủ ngữ cảnh. | Hợp lệ / 1 | 4/4 | 4/4 | 60.51 | 55.42 | 26.72 | [MP4](evidence/ai-2026-11-01T13-03-54-226Z/osnap-rectang-a.mp4) · [contact](evidence/ai-2026-11-01T13-03-54-226Z/osnap-rectang-a-contact.jpg) · [frames](evidence/ai-2026-11-01T13-03-54-226Z/frames-osnap-rectang-a) |
| text-mtext-a: Tạo demo MTEXT tiếng Việt trong khu vực phòng khách: đặt khung chữ dễ đọc, nội dung chính xác "Nhãn marketing VinaCAD", có chiều cao phù hợp với bản vẽ và đóng trình soạn thảo đúng nút xác nhận. Điểm bắt đầu tham chiếu [4500,3000] và góc đối diện [6000,3400]. | Hợp lệ / 1 | 3/4 | 3/4 | — | — | — | — · — · [frames](evidence/ai-2026-11-01T13-03-54-226Z/frames-text-mtext-a) |
| pline-a: Tạo video marketing ngắn cho PLINE: bật OSNAP, vẽ một đường gấp khúc đi qua ba góc của khu vực phòng khách, kết thúc bằng Enter rồi đưa camera về toàn cảnh. Không dùng lệnh ngoài danh mục đã kiểm chứng. | Hợp lệ / 1 | 4/4 | 4/4 | 59.34 | 52.10 | 21.48 | [MP4](evidence/ai-2026-11-01T13-03-54-226Z/pline-a.mp4) · [contact](evidence/ai-2026-11-01T13-03-54-226Z/pline-a-contact.jpg) · [frames](evidence/ai-2026-11-01T13-03-54-226Z/frames-pline-a) |
| command-value-a: Tạo demo nhập giá trị với CIRCLE: chọn một khoảng trống dễ nhìn gần khu vực trung tâm bản vẽ, nhập bán kính 250, xác nhận bằng bàn phím và giữ khung hình đủ rộng để thấy kích thước vừa tạo. | Hợp lệ / 1 | 5/5 | 5/5 | 63.76 | 54.98 | 23.84 | [MP4](evidence/ai-2026-11-01T13-03-54-226Z/command-value-a.mp4) · [contact](evidence/ai-2026-11-01T13-03-54-226Z/command-value-a-contact.jpg) · [frames](evidence/ai-2026-11-01T13-03-54-226Z/frames-command-value-a) |
| layer-lock-b: Tạo video marketing 30 giây về quản lý layer trên mô hình T-Corner. Mở Layers, khóa SS_STACK_MAIN, chọn SS_SUPPORT, tắt hiển thị rồi bật lại để kiểm chứng trạng thái bằng giao diện thật. | Hợp lệ / 2 | 7/7 | 7/7 | 54.89 | 42.64 | 21.88 | [MP4](evidence/ai-2026-11-01T13-03-54-226Z/layer-lock-b.mp4) · [contact](evidence/ai-2026-11-01T13-03-54-226Z/layer-lock-b-contact.jpg) · [frames](evidence/ai-2026-11-01T13-03-54-226Z/frames-layer-lock-b) |
| create-layer-b: Tạo demo quản lý layer: mở bảng Layers, tạo layer mới tên MKT-DEMO, chọn layer đó làm hiện hành và giữ bảng layer rõ trong khung hình. Phụ đề nêu lợi ích tổ chức bản vẽ. | Hợp lệ / 1 | 4/4 | 4/4 | 39.63 | 40.22 | 17.82 | [MP4](evidence/ai-2026-11-01T13-03-54-226Z/create-layer-b.mp4) · [contact](evidence/ai-2026-11-01T13-03-54-226Z/create-layer-b-contact.jpg) · [frames](evidence/ai-2026-11-01T13-03-54-226Z/frames-create-layer-b) |
| mode-toggle-b: Tạo video marketing về vẽ chính xác trên mô hình T-Corner: bật OSNAP, vẽ LINE dọc theo cạnh dài của khu vực trung tâm, kết thúc bằng Enter và zoom extents. Hai điểm tham chiếu kiểm thử là [72485.57,4581.56] và [90285.57,40581.56]. | Hợp lệ / 1 | 4/4 | 4/4 | 74.34 | 53.34 | 24.00 | [MP4](evidence/ai-2026-11-01T13-03-54-226Z/mode-toggle-b.mp4) · [contact](evidence/ai-2026-11-01T13-03-54-226Z/mode-toggle-b-contact.jpg) · [frames](evidence/ai-2026-11-01T13-03-54-226Z/frames-mode-toggle-b) |
| selection-edit-b: Tạo demo chỉnh sửa vật thể: chọn trọn chiếc sofa phòng khách bằng khung cửa sổ, MOVE lên trên 200 đơn vị để người xem thấy thay đổi, sau đó COPY trọn vật thể và kết thúc bằng Enter. Giữ bản gốc trong khung hình. | Hợp lệ / 1 | 6/6 | 6/6 | 93.43 | 70.28 | 26.60 | [MP4](evidence/ai-2026-11-01T13-03-54-226Z/selection-edit-b.mp4) · [contact](evidence/ai-2026-11-01T13-03-54-226Z/selection-edit-b-contact.jpg) · [frames](evidence/ai-2026-11-01T13-03-54-226Z/frames-selection-edit-b) |
| offset-b: Tạo video marketing cho OFFSET: chọn một đường tường rõ ở khu vực phòng chính, nhập khoảng cách 200, chọn phía offset, xác nhận kết quả là một đường song song rồi zoom extents. Chỉ dùng các thao tác đã được kiểm chứng. | Hợp lệ / 1 | 4/4 | 4/4 | 66.78 | 55.50 | 20.90 | [MP4](evidence/ai-2026-11-01T13-03-54-226Z/offset-b.mp4) · [contact](evidence/ai-2026-11-01T13-03-54-226Z/offset-b-contact.jpg) · [frames](evidence/ai-2026-11-01T13-03-54-226Z/frames-offset-b) |

#### layer-edit-a

Dòng lệnh ở khung cuối: **ZOOM EXTENTS**.
Validator: [].
Kết luận xem ảnh/phụ đề: Đã xem 6 checkpoint, khung cuối và contact sheet MP4 4K. Màu cam #FFB347 của layer 0 hiện rõ cả trong bảng Lớp lẫn trên nét bản vẽ khi phóng to trục Xd1–Xd3; phụ đề tiếng Việt khớp từng cảnh.
Đạt bằng xem ảnh: Có.

| Action | Quan sát ảnh |
|---|---|
| [1](evidence/ai-2026-11-01T13-03-54-226Z/frames-layer-edit-a/scene-1-action-1.jpg) | 1: Toàn cảnh bản vẽ 260519_test-bat-diem.dwg; các nét vàng và xám hiện rõ trong khung. |
| [2](evidence/ai-2026-11-01T13-03-54-226Z/frames-layer-edit-a/scene-2-action-2.jpg) | 2: Bảng Lớp mở ở bên trái; bản vẽ vẫn giữ nguyên toàn cảnh. |
| [3](evidence/ai-2026-11-01T13-03-54-226Z/frames-layer-edit-a/scene-3-action-3.jpg) | 3: Layer 0 được chọn làm hiện hành trong danh sách và thanh trạng thái layer. |
| [4](evidence/ai-2026-11-01T13-03-54-226Z/frames-layer-edit-a/scene-3-action-4.jpg) | 4: Ô màu layer 0 chuyển sang cam #FFB347, picker màu đã đóng; nét thuộc layer 0 ở vùng dưới bản vẽ đổi sang cam. |
| [5](evidence/ai-2026-11-01T13-03-54-226Z/frames-layer-edit-a/scene-4-action-5.jpg) | 5: Phóng to vùng trục 8125 / Xd1–Xd3, thấy rõ đường kích thước màu cam của layer 0 và các nhãn xung quanh. |
| [6](evidence/ai-2026-11-01T13-03-54-226Z/frames-layer-edit-a/scene-5-action-6.jpg) | 6: Thu phóng toàn cảnh (ZOOM EXTENTS); không có menu hay picker mở. |
| [Cuối](evidence/ai-2026-11-01T13-03-54-226Z/frames-layer-edit-a/final.jpg) | Dòng lệnh như ghi ở trên; đối chiếu trạng thái cuối trong JSON. |

#### osnap-rectang-a

Dòng lệnh ở khung cuối: **ZOOM EXTENTS**.
Validator: [].
Kết luận xem ảnh/phụ đề: Đã xem 4 checkpoint, khung cuối và contact sheet MP4 4K. Marker bắt điểm Điểm cuối hiển thị rõ khi rê chuột tại hai góc; hình chữ nhật bốn đỉnh khớp chính xác [7100,200]–[11800,3800], phụ đề khớp hình.
Đạt bằng xem ảnh: Có.

| Action | Quan sát ảnh |
|---|---|
| [1](evidence/ai-2026-11-01T13-03-54-226Z/frames-osnap-rectang-a/scene-1-action-1.jpg) | 1: Phóng to khu vực góc bếp (KITCHEN / DINING); vẫn thấy LIVING ROOM, BEDROOM 01 và BEDROOM 02. |
| [2](evidence/ai-2026-11-01T13-03-54-226Z/frames-osnap-rectang-a/scene-2-action-2.jpg) | 2: Bật nút BẮT ĐT (OSNAP) trên thanh trạng thái dưới cùng. |
| [3](evidence/ai-2026-11-01T13-03-54-226Z/frames-osnap-rectang-a/scene-3-action-3.jpg) | 3: Vẽ hình chữ nhật RECTANG khoanh gọn khu vực bếp/ăn từ [7100,200] tới [11800,3800]; contact sheet MP4 thấy rõ marker Điểm cuối tại hai góc. |
| [4](evidence/ai-2026-11-01T13-03-54-226Z/frames-osnap-rectang-a/scene-4-action-4.jpg) | 4: Thu phóng toàn cảnh (ZOOM EXTENTS), giữ đầy đủ mặt bằng và hình chữ nhật mới ở góc bếp. |
| [Cuối](evidence/ai-2026-11-01T13-03-54-226Z/frames-osnap-rectang-a/final.jpg) | Dòng lệnh như ghi ở trên; đối chiếu trạng thái cuối trong JSON. |

#### text-mtext-a

Dòng lệnh ở khung cuối: **Không có snapshot cuối (case lỗi)**.
Validator: [].
Kết luận xem ảnh/phụ đề: MTEXT tạo đúng nội dung và đóng editor sạch ở bước 2–3, nhưng bước phụ click nút "Lưu" ở cảnh 3 làm mở hộp thoại yêu cầu đăng nhập nên bị assertCleanState đánh FAIL đúng thiết kế. (Case này đã đạt 5/5 ở lần chạy gemini-3.1-flash-lite tại ai-2026-11-01T12-21-04-069Z và 7/7 tại ai-2026-11-01T04-24-03-865Z khi plan không bấm nút Lưu).
Đạt bằng xem ảnh: Không.
Lỗi: Error: Cảnh 3 "Hoàn tất và lưu bản vẽ": Trạng thái VinaCAD chưa sạch: popup/menu vẫn mở: không rõ..

| Action | Quan sát ảnh |
|---|---|
| [1](evidence/ai-2026-11-01T13-03-54-226Z/frames-text-mtext-a/scene-1-action-1.jpg) | 1: Phóng to khu vực phòng khách (LIVING ROOM), thấy rõ sofa, bàn và các phòng lân cận. |
| [2](evidence/ai-2026-11-01T13-03-54-226Z/frames-text-mtext-a/scene-2-action-2.jpg) | 2: Tạo MTEXT "Nhãn marketing VinaCAD" trong phòng khách, đúng dấu tiếng Việt và chiều cao dễ đọc; trình soạn thảo đã đóng (còn khoảng trắng rộng giữa các từ theo giới hạn hiển thị VinaCAD). |
| [3](evidence/ai-2026-11-01T13-03-54-226Z/frames-text-mtext-a/scene-3-action-3.jpg) | 3: Thu phóng toàn cảnh (ZOOM EXTENTS), nhãn văn bản mới hiện rõ trong phòng khách. |
| [4](evidence/ai-2026-11-01T13-03-54-226Z/frames-text-mtext-a/scene-3-action-4-failed.jpg) | 4: Bước phụ click nút "Lưu" ở cảnh cuối mở popup "Cần đăng nhập"; assertCleanState bắt đúng trạng thái popup đang mở và từ chối case. |

#### pline-a

Dòng lệnh ở khung cuối: **ZOOM EXTENTS**.
Validator: [].
Kết luận xem ảnh/phụ đề: Đã xem 4 checkpoint, khung cuối và contact sheet MP4 4K. PLINE đi qua đúng 3 góc phòng khách với marker Điểm cuối hiển thị rõ trong video, kết thúc sạch bằng Enter và đưa camera về toàn cảnh.
Đạt bằng xem ảnh: Có.

| Action | Quan sát ảnh |
|---|---|
| [1](evidence/ai-2026-11-01T13-03-54-226Z/frames-pline-a/scene-1-action-1.jpg) | 1: Bật nút BẮT ĐT (OSNAP) trên thanh trạng thái; mặt bằng ở góc nhìn toàn cảnh. |
| [2](evidence/ai-2026-11-01T13-03-54-226Z/frames-pline-a/scene-2-action-2.jpg) | 2: Phóng to khu vực phòng khách (LIVING ROOM), giữ ngữ cảnh các phòng lân cận. |
| [3](evidence/ai-2026-11-01T13-03-54-226Z/frames-pline-a/scene-2-action-3.jpg) | 3: Vẽ đường gấp khúc PLINE đi qua ba góc phòng khách ([200,200] -> [6900,200] -> [6900,3200]) và kết thúc bằng Enter; contact sheet MP4 hiện marker Điểm cuối tại các đỉnh. |
| [4](evidence/ai-2026-11-01T13-03-54-226Z/frames-pline-a/scene-3-action-4.jpg) | 4: Thu phóng toàn cảnh (ZOOM EXTENTS), không còn lệnh hay dây thun treo. |
| [Cuối](evidence/ai-2026-11-01T13-03-54-226Z/frames-pline-a/final.jpg) | Dòng lệnh như ghi ở trên; đối chiếu trạng thái cuối trong JSON. |

#### command-value-a

Dòng lệnh ở khung cuối: **Nhập lệnh tại đây**.
Validator: [].
Kết luận xem ảnh/phụ đề: Đã xem 5 checkpoint, khung cuối và contact sheet MP4 4K. Đường tròn bán kính 250 được tạo đúng vị trí trung tâm, contact sheet thấy bước nhập bán kính 250 và khung hình đủ rộng để nhận ra các phòng xung quanh.
Đạt bằng xem ảnh: Có.

| Action | Quan sát ảnh |
|---|---|
| [1](evidence/ai-2026-11-01T13-03-54-226Z/frames-command-value-a/scene-1-action-1.jpg) | 1: Thu phóng toàn cảnh mặt bằng mẫu (ZOOM EXTENTS). |
| [2](evidence/ai-2026-11-01T13-03-54-226Z/frames-command-value-a/scene-2-action-2.jpg) | 2: Phóng to khoảng trống khu vực hành lang trung tâm gần cửa BEDROOM 02. |
| [3](evidence/ai-2026-11-01T13-03-54-226Z/frames-command-value-a/scene-3-action-3.jpg) | 3: Vẽ CIRCLE tâm [7300,4200] với bán kính nhập số 250 và xác nhận bằng bàn phím; đường tròn mới hiện rõ, lệnh kết thúc sạch. |
| [4](evidence/ai-2026-11-01T13-03-54-226Z/frames-command-value-a/scene-4-action-4.jpg) | 4: Đưa khung nhìn ra rộng hơn ([5000,2000]–[10000,6000]) để thấy đường tròn vừa tạo trong ngữ cảnh BEDROOM 01, BEDROOM 02 và LIVING ROOM. |
| [5](evidence/ai-2026-11-01T13-03-54-226Z/frames-command-value-a/scene-4-action-5.jpg) | 5: Giữ khung 1.5s, dòng lệnh rảnh (Nhập lệnh tại đây). |
| [Cuối](evidence/ai-2026-11-01T13-03-54-226Z/frames-command-value-a/final.jpg) | Dòng lệnh như ghi ở trên; đối chiếu trạng thái cuối trong JSON. |

#### layer-lock-b

Dòng lệnh ở khung cuối: **ZOOM EXTENTS**.
Validator: [{"attempt": 1, "errors": ["Cảnh 3, bước 2: không thể tắt hiển thị layer hiện hành \"SS_SUPPORT\"; hãy chọn layer khác trước.", "Cảnh 4, bước 1: không thể tắt hiển thị layer hiện hành \"SS_SUPPORT\"; hãy chọn layer khác trước."]}].
Kết luận xem ảnh/phụ đề: Đã xem 7 checkpoint, khung cuối và contact sheet MP4 4K. Plan tự sửa ở lượt 2 sau phản hồi validator về layer hiện hành; thao tác khoá SS_STACK_MAIN, chọn SS_SUPPORT, ẩn rồi bật lại SS_SUPPORT làm các gối đỡ ẩn/hiện rõ ràng trên canvas.
Đạt bằng xem ảnh: Có.

| Action | Quan sát ảnh |
|---|---|
| [1](evidence/ai-2026-11-01T13-03-54-226Z/frames-layer-lock-b/scene-1-action-1.jpg) | 1: Mở bảng Lớp bên trái; toàn bộ mô hình T-Corner và các ký hiệu gối đỡ hiển thị đầy đủ. |
| [2](evidence/ai-2026-11-01T13-03-54-226Z/frames-layer-lock-b/scene-2-action-2.jpg) | 2: Khoá layer SS_STACK_MAIN; biểu tượng ổ khoá sáng lên trên dòng SS_STACK_MAIN. |
| [3](evidence/ai-2026-11-01T13-03-54-226Z/frames-layer-lock-b/scene-3-action-3.jpg) | 3: Chọn layer SS_SUPPORT làm layer hiện hành; tên SS_SUPPORT hiện trên thanh công cụ layer. |
| [4](evidence/ai-2026-11-01T13-03-54-226Z/frames-layer-lock-b/scene-3-action-4.jpg) | 4: Chuyển layer hiện hành về 0 trước khi tắt hiển thị SS_SUPPORT (sau khi validator lượt 1 nhắc không tắt layer đang hiện hành). |
| [5](evidence/ai-2026-11-01T13-03-54-226Z/frames-layer-lock-b/scene-3-action-5.jpg) | 5: Tắt hiển thị layer SS_SUPPORT; toàn bộ ký hiệu gối đỡ ①–⑨ biến mất trên canvas, chỉ còn kết cấu chính và kích thước. |
| [6](evidence/ai-2026-11-01T13-03-54-226Z/frames-layer-lock-b/scene-4-action-6.jpg) | 6: Bật lại hiển thị layer SS_SUPPORT; các ký hiệu gối đỡ trắng/tím hiện lại đầy đủ trên mô hình. |
| [7](evidence/ai-2026-11-01T13-03-54-226Z/frames-layer-lock-b/scene-4-action-7.jpg) | 7: Thu phóng toàn cảnh (ZOOM EXTENTS); dòng lệnh sạch và bảng Lớp hiển thị rõ. |
| [Cuối](evidence/ai-2026-11-01T13-03-54-226Z/frames-layer-lock-b/final.jpg) | Dòng lệnh như ghi ở trên; đối chiếu trạng thái cuối trong JSON. |

#### create-layer-b

Dòng lệnh ở khung cuối: **ZOOM EXTENTS**.
Validator: [].
Kết luận xem ảnh/phụ đề: Đã xem 4 checkpoint, khung cuối và contact sheet MP4 4K. Layer MKT-DEMO được tạo mới và đặt làm layer hiện hành đúng yêu cầu, bảng Lớp giữ rõ trong khung hình và phụ đề nêu rõ lợi ích tổ chức bản vẽ.
Đạt bằng xem ảnh: Có.

| Action | Quan sát ảnh |
|---|---|
| [1](evidence/ai-2026-11-01T13-03-54-226Z/frames-create-layer-b/scene-1-action-1.jpg) | 1: Mở bảng Lớp bên trái trên bản vẽ T-Corner. |
| [2](evidence/ai-2026-11-01T13-03-54-226Z/frames-create-layer-b/scene-2-action-2.jpg) | 2: Tạo layer mới tên MKT-DEMO trong bảng Lớp; ô nhập tên đóng sạch sau khi xác nhận. |
| [3](evidence/ai-2026-11-01T13-03-54-226Z/frames-create-layer-b/scene-3-action-3.jpg) | 3: Chọn MKT-DEMO làm layer hiện hành; tên MKT-DEMO hiển thị cả trong danh sách lẫn hộp chọn layer phía trên. |
| [4](evidence/ai-2026-11-01T13-03-54-226Z/frames-create-layer-b/scene-4-action-4.jpg) | 4: Thu phóng toàn cảnh (ZOOM EXTENTS) trong khi vẫn giữ bảng Lớp mở rõ bên trái. |
| [Cuối](evidence/ai-2026-11-01T13-03-54-226Z/frames-create-layer-b/final.jpg) | Dòng lệnh như ghi ở trên; đối chiếu trạng thái cuối trong JSON. |

#### mode-toggle-b

Dòng lệnh ở khung cuối: **ZOOM EXTENTS**.
Validator: [].
Kết luận xem ảnh/phụ đề: Đã xem 4 checkpoint, khung cuối và contact sheet MP4 4K. OSNAP được bật, con trỏ được tinh chỉnh trước click khi bắt điểm và vẽ chính xác đoạn LINE giữa hai điểm tham chiếu trên mô hình T-Corner.
Đạt bằng xem ảnh: Có.

| Action | Quan sát ảnh |
|---|---|
| [1](evidence/ai-2026-11-01T13-03-54-226Z/frames-mode-toggle-b/scene-1-action-1.jpg) | 1: Bật chế độ BẮT ĐT (OSNAP) trên thanh trạng thái của bản vẽ T-Corner. |
| [2](evidence/ai-2026-11-01T13-03-54-226Z/frames-mode-toggle-b/scene-2-action-2.jpg) | 2: Phóng to khu vực trung tâm của mô hình T-Corner ([71000,3500]–[91500,41500]). |
| [3](evidence/ai-2026-11-01T13-03-54-226Z/frames-mode-toggle-b/scene-3-action-3.jpg) | 3: Vẽ LINE dọc theo cạnh dài khu vực trung tâm từ [72485.57,4581.56] tới [90285.57,40581.56] và kết thúc bằng Enter; contact sheet MP4 thấy rõ marker bắt điểm và đường nối mới. |
| [4](evidence/ai-2026-11-01T13-03-54-226Z/frames-mode-toggle-b/scene-4-action-4.jpg) | 4: Thu phóng toàn cảnh (ZOOM EXTENTS), thấy trọn mô hình T-Corner cùng đường LINE mới. |
| [Cuối](evidence/ai-2026-11-01T13-03-54-226Z/frames-mode-toggle-b/final.jpg) | Dòng lệnh như ghi ở trên; đối chiếu trạng thái cuối trong JSON. |

#### selection-edit-b

Dòng lệnh ở khung cuối: **ZOOM EXTENTS**.
Validator: [].
Kết luận xem ảnh/phụ đề: Đã xem 6 checkpoint, khung cuối và contact sheet MP4 4K. Khung chọn cửa sổ chọn đủ 6/6 nét sofa ở cả bước MOVE lẫn bước COPY; sofa dời lên 200 đơn vị rồi tạo bản sao trọn vẹn bên cạnh bản gốc, kết thúc sạch bằng Enter.
Đạt bằng xem ảnh: Có.

| Action | Quan sát ảnh |
|---|---|
| [1](evidence/ai-2026-11-01T13-03-54-226Z/frames-selection-edit-b/scene-1-action-1.jpg) | 1: Phóng to khu vực phòng khách (LIVING ROOM) chứa chiếc sofa. |
| [2](evidence/ai-2026-11-01T13-03-54-226Z/frames-selection-edit-b/scene-2-action-2.jpg) | 2: Kéo khung cửa sổ [800,500]–[3600,1600] chọn trọn 6 nét của chiếc sofa; bảng Thuộc tính hiện Đường thẳng (6) và các grip xanh bao quanh sofa. |
| [3](evidence/ai-2026-11-01T13-03-54-226Z/frames-selection-edit-b/scene-2-action-3.jpg) | 3: Dùng lệnh MOVE dịch chuyển trọn chiếc sofa lên trên 200 đơn vị ([0,200]); lệnh kết thúc gọn và bỏ chọn. |
| [4](evidence/ai-2026-11-01T13-03-54-226Z/frames-selection-edit-b/scene-3-action-4.jpg) | 4: Kéo khung cửa sổ [800,700]–[3600,1800] chọn lại trọn 6 nét của chiếc sofa tại vị trí vừa dời. |
| [5](evidence/ai-2026-11-01T13-03-54-226Z/frames-selection-edit-b/scene-3-action-5.jpg) | 5: Dùng lệnh COPY sao chép trọn chiếc sofa sang phải ([2300,0]) và kết thúc bằng Enter; cả sofa gốc lẫn sofa bản sao đều hiển thị đầy đủ trong phòng khách. |
| [6](evidence/ai-2026-11-01T13-03-54-226Z/frames-selection-edit-b/scene-4-action-6.jpg) | 6: Thu phóng toàn cảnh (ZOOM EXTENTS), thấy rõ toàn bộ mặt bằng với hai chiếc sofa trong phòng khách. |
| [Cuối](evidence/ai-2026-11-01T13-03-54-226Z/frames-selection-edit-b/final.jpg) | Dòng lệnh như ghi ở trên; đối chiếu trạng thái cuối trong JSON. |

#### offset-b

Dòng lệnh ở khung cuối: **ZOOM EXTENTS**.
Validator: [].
Kết luận xem ảnh/phụ đề: Đã xem 4 checkpoint, khung cuối và contact sheet MP4 4K. Lệnh OFFSET nhập khoảng cách 200, chọn đoạn tường dưới phòng khách và phía offset tạo ra đường thẳng song song cách đúng 200 đơn vị, kết thúc sạch và zoom extents đầy đủ.
Đạt bằng xem ảnh: Có.

| Action | Quan sát ảnh |
|---|---|
| [1](evidence/ai-2026-11-01T13-03-54-226Z/frames-offset-b/scene-1-action-1.jpg) | 1: Mở bảng Thuộc tính và giữ toàn cảnh mặt bằng mẫu. |
| [2](evidence/ai-2026-11-01T13-03-54-226Z/frames-offset-b/scene-2-action-2.jpg) | 2: Phóng to khu vực tường dưới của phòng khách (LIVING ROOM). |
| [3](evidence/ai-2026-11-01T13-03-54-226Z/frames-offset-b/scene-3-action-3.jpg) | 3: Thực hiện lệnh OFFSET với khoảng cách 200 trên đoạn tường ngang dưới phòng khách ([3500,200] -> phía trong [3500,600]) và kết thúc sạch; xuất hiện đường song song mới cách đúng 200 đơn vị, tường gốc giữ nguyên. |
| [4](evidence/ai-2026-11-01T13-03-54-226Z/frames-offset-b/scene-4-action-4.jpg) | 4: Thu phóng toàn cảnh (ZOOM EXTENTS), thấy rõ đường tường song song vừa tạo trong phòng khách. |
| [Cuối](evidence/ai-2026-11-01T13-03-54-226Z/frames-offset-b/final.jpg) | Dòng lệnh như ghi ở trên; đối chiếu trạng thái cuối trong JSON. |
