# Vòng 4: video AI phải cho người xem thấy đúng điều phụ đề nói

Đọc lại trước khi làm:
- `docs/handoff/AGENT_TASK.md`: mục 3 và mục 4.
- `docs/handoff/AGENT_TASK_2.md`: mục 2.9 (tiêu chí batch AI).
- `docs/handoff/AGENT_TASK_3.md`: mục 3 (quy trình kiểm chứng).

Các mục trên vẫn hiệu lực.

Nền tảng engine đã vững. Vòng này tập trung vào chất lượng **video do AI tạo ra**: kết quả phải nhìn thấy được, và phụ đề phải đúng với hình.

## 1. Kết quả review vòng 3

Reviewer đã làm bốn việc:
- chạy lại unit test, test request AI, clean-state và test âm tính trên VinaCAD thật;
- chạy lại toàn bộ hồi quy trên code hiện tại, có giữ khung gốc;
- xem khung hình của batch AI `evidence/ai-2026-11-01T13-03-54-226Z`;
- đo chênh lệch điểm ảnh trước và sau mỗi thao tác quan trọng.

### Đạt (giữ nguyên)

- Id entity dùng handle thật (`"5BA"`…). Snapshot có id trùng thì báo lỗi ngay.
- `assertCleanState` bắt đủ 6 trạng thái bẩn, sạch thì không báo nhầm. Reviewer đã tự chạy lại. Các trạng thái gồm:
  - khung chọn treo;
  - menu góc nhìn;
  - menu chuột phải;
  - bảng chọn màu;
  - editor MTEXT;
  - LINE đang dở.
- Hậu điều kiện cho 10 lệnh có test âm tính và gọi đúng `verifyCommand` của production:
  - LINE, PLINE, RECTANG: kiểm điểm thực;
  - ROTATE: kiểm góc;
  - ERASE, COPY: kiểm theo id.
- `SUPPORTED_COMMANDS` chỉ còn 10 lệnh đã kiểm chứng.
- Case MOVE và ROTATE gốc của vòng 1 đã được khôi phục ([2100,600], OSNAP bật). Case tắt OSNAP được giữ làm case phụ. Mọi thay đổi plan đều có bảng ghi lý do.
- Đổi màu layer có kiểm pixel. Cảnh t-corner chuyển sang SS_STACK_MAIN, có ghi lý do.
- `check-ai-requests.cjs` gọi `buildAiRequest` thật. Fallback 400 được test bằng `fetch` giả.
- Encoder phần cứng lỗi thì dựng lại toàn bộ bằng libx264. Dung lượng NVENC còn khoảng 1,46 lần x264.
- Electron đã ghim ở `45.1.0`. `tsc` và `node --check` sạch.
- Reviewer chạy lại trên code hiện tại ngày 01/11, lúc 21:34–22:23, có giữ khung gốc. Kết quả đều đạt:
  - `check-clean-state`;
  - `check-live-postconditions`;
  - actions 14/14;
  - offline 3/3;
  - t-corner 6/6;
  - bat-diem 5/5.
- Trong lần chạy đó:
  - MOVE ở [2100,600] với OSNAP bật dịch thực tế (198,2; 198,1);
  - ROTATE đo được 45,0°, có ghi lần chỉnh con trỏ khỏi điểm bắt [2200,600].

### Lỗi nghiêm trọng

**1. Batch AI chỉ đạt 7/10 theo tiêu chí 2.9, không phải 9/10.** Tiêu chí thứ 4 là: khung hình xác nhận phụ đề khớp với điều đang thấy.
- **`offset-b`: kết quả không nhìn thấy được.**
  - AI chọn tường ngoài `(0,0)–(9000,0)` rồi offset 200 vào trong. Đường mới `(0,200)–(9000,200)` trùng gần hết với tường trong có sẵn `(200,200)–(9000,200)`.
  - Reviewer đo chênh lệch điểm ảnh ở dải tường dưới, giữa `scene-2-action-2.jpg` và `scene-3-action-3.jpg`: **YMAX = 0**, tức không có gì thay đổi.
  - Phụ đề vẫn nói "Đường thẳng mới được tạo song song…". REPORT_3 ghi "thấy rõ đường tường song song vừa tạo", điều này sai.
- **`mode-toggle-b`: phụ đề sai với hình.**
  - Phụ đề: "vẽ dọc theo cạnh dài của khu vực".
  - Hình (`scene-3-action-3.jpg`): một đường **chéo** từ gối ① lên vùng ⑨.
  - Nguyên nhân là chính brief tự mâu thuẫn: hai toạ độ [72485.57,4581.56] và [90285.57,40581.56] không nằm dọc cạnh nào.
- **`text-mtext-a`:** FAIL vì AI bấm "Lưu" và hiện popup đăng nhập. REPORT_3 đã ghi đúng.
- **Ca yếu, tạm tính đạt:**
  - `pline-a`: PLINE đi đúng lên tường trong có sẵn ([200,200]→[6900,200]→[6900,3200]). Khung trước và sau giống hệt nhau, chỉ thấy được nét "dây thun" lúc đang vẽ.
  - `osnap-rectang-a`: 3 trong 4 cạnh trùng tường.

**2. Validator tự sửa kịch bản AI mà không ghi lại** (`planner.cjs:409-471`).
- Nó chuyển bước `select` sang cảnh khác, tự chèn bước chọn khi AI quên, và đổi toạ độ khung chọn sau MOVE.
- Evidence chỉ lưu bản đã sửa. Vì vậy không biết AI tự làm đúng bao nhiêu, và con số "hợp lệ ngay lượt 1" không kiểm chứng được.

**3. Ca sofa dựa vào dữ liệu viết tay.**
- `SAMPLE_CONTEXT.objects` (`vinacad.cjs:33-34`) khai báo sẵn `selectionWindow` của sofa.
- 6/10 brief chạy trên bản vẽ mẫu này. Với DWG thật của người dùng, không có dữ liệu như vậy.

**4. Lỗi quy trình: bằng chứng hồi quy trong REPORT_3 không được tạo từ code cuối.**
- `actions.cjs` sửa lúc 19:56, `planner.cjs` lúc 19:55.
- Các lần chạy làm bằng chứng đều diễn ra trước đó: actions 11:49, offline 13:23, t-corner 18:04, bat-diem 18:34.
- File `source-consistency-r3.json` (lúc 20:44) chỉ so hash với bản đã kiểm tra tĩnh.
- Lần chạy lại của reviewer trên code cuối vẫn đạt 100%, nên kết luận không đổi. Nhưng từ vòng này phải chứng minh được thứ tự (mục 4.5).

**5. Thời gian dựng chậm hơn khoảng 40%.**
- Nguyên nhân: FFmpeg bị giới hạn cứng 2 luồng mỗi tiến trình (`render.cjs:339-344`).
- Ví dụ: layer-visibility 19,7 giây video mất 41 giây dựng, vòng 2 chỉ mất 29 giây.

## 2. Việc cần làm (theo thứ tự)

### 4.1 Hậu điều kiện "nhìn thấy được" cho lệnh tạo và lệnh sửa

- Sau mỗi lệnh LINE, PLINE, RECTANG, CIRCLE, MTEXT, MOVE, COPY, ROTATE, OFFSET:
  - Lấy mẫu điểm ảnh canvas dọc theo hình học mới hoặc đã đổi, trước và sau lệnh.
  - Lệnh sửa thì xét cả vị trí cũ lẫn vị trí mới.
  - Không có thay đổi đủ lớn (đặt ngưỡng hợp lý và ghi lại) thì báo FAIL kèm lý do, ví dụ "nét mới trùng đường có sẵn".
- Test âm tính bắt buộc:
  - OFFSET từ tường ngoài vào đúng vị trí tường trong (chính case `offset-b`) phải FAIL;
  - PLINE đi đúng trên tường có sẵn phải FAIL.
- Test dương tính: case `selection-offset` cũ, chọn tường trong và tạo đường ở y=400, phải đạt.

### 4.2 Nét mới phải nổi bật

- Khi plan có lệnh tạo hình và không tự chọn layer, pre-roll (phần không quay) tạo một layer nổi bật, ví dụ `VINACUT-DEMO` màu cam, rồi đặt làm hiện hành.
- System prompt nói rõ hai điều:
  - nét mới sẽ có màu nổi bật;
  - nên đặt hình ở chỗ trống, không trùng đường có sẵn.
- Context nên cung cấp vài vùng trống, ví dụ giữa phòng, để AI chọn.

### 4.3 Validator minh bạch

- Mỗi case lưu ba thứ:
  - `raw-plan.json` (AI trả về nguyên văn);
  - `plan.json` (sau chuẩn hoá);
  - `repairs` (danh sách từng chỗ validator đã sửa: loại, cảnh, bước, trước và sau).
- REPORT ghi số lần sửa của mỗi brief. "Hợp lệ ở lượt 1" chỉ tính khi không có sửa nào làm đổi toạ độ hoặc chèn bước.
- Ưu tiên trả lỗi cho AI tự sửa (vòng 3 lượt) thay vì tự viết lại toạ độ. Nếu giữ chuẩn hoá tự động, phải giải thích vì sao nó an toàn.
- Cấm `click` vào thao tác tệp hoặc tài khoản: Lưu, Save, Mở, Xuất, Chia sẻ, Đăng nhập…

### 4.4 Batch AI lần 2 (tiêu chí không đổi: ít nhất 9/10, cả 4 điều kiện)

- Rà lại 10 brief: brief không được tự mâu thuẫn (toạ độ phải khớp với mô tả bằng lời). Sửa `mode-toggle-b`.
- Ít nhất 4/10 brief chạy trên DWG thật (t-corner, bat-diem). Brief trên bản vẽ mẫu không được dựa vào `objects` viết tay, trừ ca sofa, và phải ghi rõ ca đó.
- Mỗi brief ghi thêm:
  - kết quả hậu điều kiện "nhìn thấy được" của từng action;
  - một dòng xác nhận từng phụ đề khớp với khung hình tương ứng.
- Mọi mô tả kiểu "thấy rõ…" phải có số đo chênh lệch điểm ảnh hoặc ảnh cắt kèm theo.

### 4.5 Hồi quy chạy trên code cuối

- Sau lần sửa code cuối cùng, chạy lại **toàn bộ** hồi quy và batch AI.
- REPORT_4 ghi giờ sửa cuối của từng file production và giờ bắt đầu từng lần chạy, để chứng minh thứ tự.

### 4.6 Dựng nhanh lại

- Bỏ giới hạn cứng `-threads 2`. Tính số luồng theo số lõi và RAM trống (ví dụ dùng `os.totalmem()` và `os.freemem()`).
- Đo lại 3 case offline trên máy này. Thời gian dựng không được chậm hơn vòng 2 quá 10%, và không bị hết RAM.

### 4.7 Bản cài đặt

- `dist/VinaCut-Studio-0.1.0-Setup.exe` đã được tạo lúc 21:33 bằng `npm run dist`, không nằm trong vòng 3.
- FFmpeg đã nằm đúng ở `app.asar.unpacked`.
- Thêm smoke test cho bản đã đóng gói, ví dụ cờ `--smoke-test`:
  - mở bản vẽ mẫu, quay và dựng một preset ngắn;
  - ghi file kết quả;
  - thoát với mã lỗi rõ ràng.
- Chạy smoke test trên `dist/win-unpacked`.

## 3. Bộ hồi quy vòng 4 (phải đạt 100% trên code cuối)

- Toàn bộ bộ vòng 3: unit test, `check-ai-requests`, `check-clean-state`, `check-live-postconditions`, `run-actions`, `run-plan`, `run-real` ×2.
- Test âm tính và dương tính của mục 4.1.
- Batch AI lần 2, đạt ít nhất 9/10.
- Smoke test bản đóng gói.
- `tsc`, `node --check`, `npm run build`.

## 4. Đầu ra

Tạo `docs/handoff/REPORT_4.md` theo khuôn REPORT_3, thêm các mục:
- Bảng giờ sửa file và giờ chạy (mục 4.5).
- Bảng sửa của validator cho từng brief (mục 4.3).
- Kết quả "nhìn thấy được" và phụ đề cho từng action của batch AI.
