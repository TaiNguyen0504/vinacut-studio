# BÁO CÁO TỔNG HỢP MASTER BUG LIST — VINACAD WEB SO SÁNH 1-1 VỚI AUTOCAD WEB (BẢN CHUẨN HÓA ĐỂ FIX THỨ HAI)

- **Tệp báo cáo chuẩn duy nhất**: `VinaCAD-E2E-Bug-Report.md` (đồng bộ tại `bug_report.md`)
- **Môi trường đã kiểm chứng trực tiếp 1-1 trên Chrome của bạn (`chrome://inspect/#remote-debugging`)**:
  - **AutoCAD Web (Chuẩn đối chiếu)**: `https://web.autocad.com/acad/me/drawings/969081188/editor`
  - **VinaCAD Web**: `https://web.vina-cad.com/vi` & `https://app.vinacad.vn`

---

## I. TỔNG KẾT SỐ LƯỢNG BUG THỰC SỰ SAU KHI KIỂM CHỨNG 1-1 VỚI AUTOCAD WEB

### 1. Tại sao từ 308 mục thô (và 152 mục tách lẻ) rút gọn về đúng **58 Bug thực sự**?

Khi chạy kiểm tra trực tiếp từng lệnh trên cả 2 tab **AutoCAD Web (`web.autocad.com`)** và **VinaCAD Web (`web.vina-cad.com`)** trên trình duyệt Chrome của bạn:
1. **Đã loại bỏ hoàn toàn 14 lệnh mà chính AutoCAD Web cũng báo `Unsupported command`** (trước đây Codex và các đợt kiểm toán tĩnh đối chiếu nhầm với AutoCAD Desktop):
   - Khi gõ trực tiếp trên **AutoCAD Web (`web.autocad.com`)**, chính AutoCAD Web trả về `Unsupported command` cho: `DONUT`, `3DPOLY`, `REGION`, `BOUNDARY`, `TABLE`, `-IMAGE`, `BEDIT`, `BCLOSE`, `LAYFRZ`, `ELEVATION`, `CURSORSIZE`, `DYNMODE`, `DIMANGULAR`, `DIMRADIUS`, `DIMDIAMETER`, `CONVERTPSTYLES`, `LAYOUT`, `GROUP` (chỉ có `-GROUP`/`UNGROUP`), và các lệnh nội bộ riêng của VinaCAD (`ALLTEXTPROP`, `FINDINCLUDE`, `FINDMATCH`). *(Các lỗi nội bộ của nhóm lệnh VinaCAD tự làm thêm này được tách riêng xuống **Phụ lục B** cuối file, không tính vào danh sách Bug so với AutoCAD Web).*
2. **Đã gộp gọn tất cả các ý nhỏ trong cùng 1 Command về đúng 1 mã Bug của Command đó** (thay vì tách `OSNAP` thành 12 mã rời rạc, `-BLOCK` thành 4 mã, `TRIM/EXTEND` thành 4 mã... khiến con số bị đội lên 152).
3. **Đã tách riêng các điểm rò rỉ bộ nhớ C++ WASM (`.delete()`) ngầm** xuống **Phụ lục A**.

👉 **KẾT QUẢ CUỐI CÙNG ĐỂ THỨ HAI LÊN CÔNG TY FIX**:
- **Tổng số Bug E2E thực sự (đã kiểm chứng 1-1 với AutoCAD Web & gom gọn theo Command)**: **`58` BUGS (`BUG-01` đến `BUG-58`)** nằm trong **`37` Commands / Modules**.
  - **CRITICAL (Cấp bách — Crash, Xóa mất đối tượng, Sai lệch dữ liệu hoặc Liệt tính năng cốt lõi)**: **`27` bugs**
  - **HIGH (Cao — Hỏng tùy chọn lệnh, Sai toán học hình học, Liệt Undo/Redo)**: **`29` bugs**
  - **MEDIUM (Trung bình)**: **`2` bugs**

---

## II. BẢNG PHÂN BỔ 58 BUG NẰM TRONG NHỮNG COMMAND NÀO?

### 1. Phân bổ theo 6 Nhóm Chức năng

| STT | Nhóm Chức năng | Số lượng Bug | Tỷ trọng | Danh sách Mã Bug |
| :---: | :--- | :---: | :---: | :--- |
| 1 | **1. Hệ thống Bắt điểm (OSNAP, OTRACK, SNAPMODE)** | **5** | 8.6% | `BUG-01`, `BUG-02`, `BUG-03`, `BUG-04`, `BUG-05` |
| 2 | **2. Nhập Tọa độ, Chọn Đối tượng (Select), Command Bar & Undo/Redo** | **4** | 6.9% | `BUG-06`, `BUG-07`, `BUG-08`, `BUG-09` |
| 3 | **3. Nhóm Lệnh Vẽ Hình học (Draw Commands)** | **11** | 19.0% | `BUG-10`, `BUG-11`, `BUG-12`, `BUG-13`, `BUG-14`, `BUG-15`, `BUG-16`, `BUG-17`, `BUG-18`, `BUG-19`, `BUG-20` |
| 4 | **4. Nhóm Lệnh Mặt cắt (HATCH) & Khối (-BLOCK / -INSERT)** | **6** | 10.3% | `BUG-21`, `BUG-22`, `BUG-23`, `BUG-24`, `BUG-25`, `BUG-26` |
| 5 | **5. Nhóm Lệnh Chỉnh sửa Hình học (Modify Commands)** | **19** | 32.8% | `BUG-27`, `BUG-28`, `BUG-29`, `BUG-30`, `BUG-31`, `BUG-32`, `BUG-33`, `BUG-34`, `BUG-35`, `BUG-36`, `BUG-37`, `BUG-38`, `BUG-39`, `BUG-40`, `BUG-41`, `BUG-42`, `BUG-43`, `BUG-44`, `BUG-45` |
| 6 | **6. Chữ (MText/Style), Kích thước (Dim), Hệ tọa độ (UCS/View), Đo lường & Hệ thống** | **13** | 22.4% | `BUG-46`, `BUG-47`, `BUG-48`, `BUG-49`, `BUG-50`, `BUG-51`, `BUG-52`, `BUG-53`, `BUG-54`, `BUG-55`, `BUG-56`, `BUG-57`, `BUG-58` |
| — | **TỔNG CỘNG** | **58 bugs** | **100%** | **`BUG-01` -> `BUG-58`** |

### 2. Phân bổ Chi tiết Theo Từng Command (52 Commands / Modules)

| STT | Tên Command / Module | Số Bug | Mức độ | Mã Bug & Tóm tắt nhanh để Fix Thứ Hai |
| :---: | :--- | :---: | :---: | :--- |
| 1 | **`OSNAP`** | **4** | `BUG-01` (CRITICAL), `BUG-03` (CRITICAL), `BUG-04` (HIGH), `BUG-05` (CRITICAL) | Liệt 100% cả 19 từ khóa Osnap Override trên dòng lệnh và lỗi key 'Apparent Intersection' trong menu chuột phải Snap Overrides | Bắt điểm Tâm (Center) liệt trên Hình tròn (OdDbCircle) mới vẽ hoặc trong Layout1, không bắt được tâm khi rê chuột lên vành tròn | Apparent Intersection thất bại 100% trên 2 đoạn thẳng không cắt nhau | Bắt điểm ma xuyên không gian giữa Layout1 và Model Space, bắt điểm ma trên Layer đã Tắt (isOff) hoặc Đóng băng (isFrozen), và liệt Osnap qua Viewport |
| 2 | **`-BLOCK`** | **2** | `BUG-23` (CRITICAL), `BUG-24` (CRITICAL) | Trong -BLOCK, khi tên Block đã tồn tại và nhấn Enter để chọn mặc định <N> (Không ghi đè), lệnh vẫn nhảy sang state = 3 để ghi đè Block! | Định nghĩa lại Block (-BLOCK -> Yes) gây crash WASM 'RuntimeError: null function', làm reset tỉ lệ Scale của các INSERT hiện có về (1,1,1), và làm liệt hoàn toàn UNDO/REDO |
| 3 | **`-INSERT`** | **2** | `BUG-25` (HIGH), `BUG-26` (HIGH) | Trong -INSERT, chọn tùy chọn S (Scale) sau khi chọn điểm chèn sẽ phớt lờ giá trị X Scale nhập từ bàn phím (luôn chèn với Scale = 1) và bỏ qua không hỏi Y Scale | Trong -INSERT, chọn tùy chọn R (Rotate) trước khi chọn điểm chèn bị xóa sạch góc xoay về 0 ngay khi chọn điểm chèn và hỏi lại góc xoay lần 2 |
| 4 | **`HATCH / -HATCH`** | **2** | `BUG-21` (CRITICAL), `BUG-22` (HIGH) | CreateHatchAction.saveOriginpt gọi hàm async DefaultCorner không có await (gán Promise vào originPoint làm gốc Hatch luôn về 0,0), và saveGradientColor đọc biến undefined this.isGradientName | HATCH khi click điểm trong vùng kín chỉ tạo đường viền xanh tạm (nhấn Esc mất sạch Hatch), Select Object bỏ qua vùng kín tạo bởi các đoạn LINE/ARC, và -HATCH bị kẹt vòng lặp không thoát được bằng ESC ở Transparency/Gradient |
| 5 | **`-PURGE / UNGROUP / -GROUP`** | **1** | `BUG-55` (CRITICAL) | -PURGE (PurgeService.purgeItems) gọi trực tiếp .erase(true) trên C++ WASM bỏ qua hoàn toàn ActionManager (làm hỏng Undo/Redo và lệch Collab) |
| 6 | **`-VIEW / ZOOM / 3DORBIT`** | **1** | `BUG-50` (CRITICAL) | Trong -VIEW -> Orthographic, nhập hướng nhìn (T, F, L, R...) gây crash 'TypeError: reading "toUpperCase"' |
| 7 | **`ALIGN`** | **1** | `BUG-33` (CRITICAL) | ALIGN 2 điểm văng ngoại lệ WASM '[CommandManager] ALIGN failed: Exception' (OdError: eDegenerateGeometry) khi vector nguồn và vector đích song song (góc 0° hoặc 180°) |
| 8 | **`ARC`** | **1** | `BUG-13` (HIGH) | Lệnh ARC từ chối từ khóa Center (C) và nhấn Enter nối tiếp tại lời nhắc đầu tiên, và từ chối bán kính bằng đúng nửa khoảng cách 2 đầu mút |
| 9 | **`AREA / LIST / ID`** | **1** | `BUG-52` (HIGH) | AreaUtils2.calculatePerimeter bỏ qua cung tròn (bulge != 0) làm chu vi sai lệch -36.3%, và lệnh AREA / ID không in kết quả Area, Perimeter, tọa độ X,Y,Z ra Command History |
| 10 | **`ARRAY`** | **1** | `BUG-38` (CRITICAL) | Trong ARRAY -> Polar (và Rectangular), nhấn phím Escape tại lời nhắc chọn tâm vẫn chạy endSubCommand gây crash TypeError: Cannot read properties of null (reading 'x') hoặc xóa mất đối tượng gốc |
| 11 | **`BREAK / BREAKATPOINT`** | **1** | `BUG-41` (HIGH) | BREAK (BR) thiếu tùy chọn [First point] (F), từ chối cắt CIRCLE thành ARC, và BREAKATPOINT trên Polyline khép kín tự cắt thêm tại đỉnh 0 tách thành 2 Polyline rời nhau |
| 12 | **`CHAMFER`** | **1** | `BUG-35` (HIGH) | CHAMFER từ chối Distance = 0 (allowZero = false), làm mất sạch Layer/Color khi vát Polyline, đổi màu đoạn thẳng gốc sang xám trước khi kiểm tra khoảng cách, và bỏ qua chế độ No Trim |
| 13 | **`CIRCLE`** | **1** | `BUG-12` (HIGH) | CIRCLE -> Diameter (D) gán defaultValue = lastRadius rồi lại chia đôi (/ 2) khi nhấn Enter làm hình tròn tự thu nhỏ 50% mỗi lần vẽ |
| 14 | **`COMMAND BAR`** | **1** | `BUG-08` (HIGH) | Bấm nút 'Enter' trên thanh Command Bar truyền sự kiện click của React ([object Object]) làm tên lệnh, in lỗi Unsupported command "[OBJECT OBJECT]" |
| 15 | **`COPY`** | **1** | `BUG-28` (HIGH) | COPY -> Mode (O) -> Single (S) không tự thoát sau 1 lần sao chép |
| 16 | **`DIMALIGNED / DIMLINEAR / DIM`** | **1** | `BUG-47` (CRITICAL) | DIMALIGNED khi chọn đối tượng (<select object>) rồi gõ T (Text) gây crash 'TypeError: Cannot read properties of undefined (reading "toFixed")' |
| 17 | **`DIVIDE`** | **1** | `BUG-43` (HIGH) | DIVIDE -> Block (B) gọi lẻ từng executeAction trong vòng lặp (tạo ra hàng chục bước Undo rời rạc) và từ chối khi gõ đầy đủ 'YES'/'NO' |
| 18 | **`DRAWORDER`** | **1** | `BUG-44` (MEDIUM) | DRAWORDER -> Above/Under khi nhấn ESC hủy chọn đối tượng tham chiếu vẫn thực thi tiếp handleOrder |
| 19 | **`ELLIPSE`** | **1** | `BUG-16` (CRITICAL) | ELLIPSE đăng ký sai tên chính 'ELIPSE', quên truyền KeywordCollection làm liệt Center (C) / Arc (A) ở nhắc đầu, chọn Rotation (R) gây crash TypeError, và nhập góc 0° trong Arc bị kẹt vòng lặp |
| 20 | **`EXPLODE`** | **1** | `BUG-42` (CRITICAL) | EXPLODE không phân rã hình chữ nhật (RECTANG / LWPOLYLINE) thành 4 đoạn LINE, và trong ExplodeCmd của plugin lại xóa mất vĩnh viễn đối tượng nguyên thủy (LINE, CIRCLE, ARC) |
| 21 | **`FILLET`** | **1** | `BUG-34` (CRITICAL) | FILLET thiếu [Polyline/Trim/Multiple/Undo], tự chèn đoạn OdDbLine màu xanh vào Database khi click Polyline, gọi erase(true) trên thực thể kForRead gây crash eNotOpenForWrite, và không cắt/nối khi R = 0 |
| 22 | **`INPUT / COORDINATES`** | **1** | `BUG-06` (CRITICAL) | Liệt 100% bộ lọc tọa độ (.X, .Y, .Z, .XY, .XZ, .YZ), ký hiệu @ (LASTPOINT) và tọa độ cực tương đối @dist<angle |
| 23 | **`JOIN`** | **1** | `BUG-40` (HIGH) | Lỗi chính tả 'this.srouceEntity' (thay vì sourceEntity) trong JoinCmd và 5 class Create*Action (Module 39016) làm mất sạch Layer/Color/Linetype gốc khi JOIN, và không nối được 2 đoạn thẳng chung điểm đầu |
| 24 | **`LAYER / LAYMCUR / LTSCALE / VIEWPORT`** | **1** | `BUG-54` (HIGH) | hasEntitiesInLayer chỉ kiểm tra ModelSpace (xóa nhầm Layer đang dùng ở Layout1) |
| 25 | **`LINE`** | **1** | `BUG-10` (HIGH) | Lệnh LINE nhấn Enter tại nhắc đầu tiên không nối tiếp từ điểm cuối gần nhất, và gõ U (Undo) tại điểm thứ 2 không quay lại chọn điểm đầu |
| 26 | **`MATCHPROP`** | **1** | `BUG-45` (HIGH) | MATCHPROP sao chép cả tọa độ alignmentPoint làm chữ đích bay về đè lên vị trí chữ nguồn, gọi nhầm setHeight thay vì setTextHeight trên MText, và hỏng Undo 100% |
| 27 | **`MEASURE / MEASUREGEOM / DIST`** | **1** | `BUG-51` (CRITICAL) | CustomLineDim trong MEASURE tính chiều dài theo cạnh huyền sqrt(L^2 + (100*screenScale)^2) làm số đo tự thay đổi khi lăn chuột Zoom |
| 28 | **`MIRROR`** | **1** | `BUG-31` (HIGH) | MIRROR làm lật ngược mặt chữ TEXT/MTEXT như soi gương (bỏ qua MIRRTEXT = 0), hàm check3dPt từ chối tọa độ có 3 thành phần (kể cả z = 0), và từ chối khi gõ nguyên từ 'YES'/'NO' |
| 29 | **`MISSING AUTOCAD WEB CLI COMMANDS`** | **1** | `BUG-57` (HIGH) | 11 lệnh/alias dòng lệnh có thực trên AutoCAD Web thật (đã kiểm chứng trên web.autocad.com) nhưng báo 'Unsupported command' trên VinaCAD Web |
| 30 | **`MLEADER`** | **1** | `BUG-48` (HIGH) | MLEADER tự động thoát lệnh khi nhấn Enter chọn mặc định <eXit options> trong nhánh Options, đăng ký từ khóa có dấu cách làm liệt phím tắt đơn ký tự, và ArrowHeadPreviewJig đọc biến undefined this.currentValue |
| 31 | **`MOVE`** | **1** | `BUG-27` (CRITICAL) | Trong MOVE, nhấn Enter tại lời nhắc điểm gốc (Specify base point or [Displacement] <Displacement>:) gây crash TypeError: Cannot read properties of null (reading 'x') |
| 32 | **`MTEXT / TEXTEDIT / STYLE / FIND`** | **1** | `BUG-46` (CRITICAL) | Bảng STYLE crash 'TypeError: styleArrray[i].getName is not a function' khi nhập tên mới |
| 33 | **`OFFSET`** | **1** | `BUG-36` (HIGH) | OFFSET in sai trạng thái Layer=Source (luôn gán đối tượng mới vào CLAYER), kẹt vòng lặp khi nhập khoảng cách <= 0, bỏ mất các vòng kín thứ 2 trở đi, và OffsetJigActions.finish() gọi .delete() trước khi đọc |
| 34 | **`OSNAP / OTRACK / SNAPMODE`** | **1** | `BUG-02` (CRITICAL) | Không thể tắt nút BẮT ĐT (OSNAP / F3) khi ở trạng thái chờ |
| 35 | **`PEDIT`** | **1** | `BUG-39` (HIGH) | PEDIT từ chối đối tượng LINE/ARC (không tự chuyển thành LWPOLYLINE), tùy chọn Join (J) không nối được các đoạn thẳng chạm nhau, và Edit vertex không di chuyển dấu X |
| 36 | **`PLINE`** | **1** | `BUG-11` (HIGH) | PLINE -> Close (C) không tự kết thúc lệnh mà vẫn hỏi Specify next point |
| 37 | **`PLOT / EXPORT PDF`** | **1** | `BUG-53` (CRITICAL) | Xuất PDF (PLOT) khi đang ở tab Layout1 hoặc Layout2 thất bại và bật hộp thoại báo lỗi 'Error exporting PDF: Bad parameter' |
| 38 | **`POINT`** | **1** | `BUG-18` (HIGH) | Lệnh POINT không tự kết thúc sau khi đặt điểm và khi nhấn Enter để thoát lại báo 'Điểm không hợp lệ.' lặp vô tận |
| 39 | **`POLYGON`** | **1** | `BUG-15` (HIGH) | POLYGON nhấn Enter tại [Inscribed/Circumscribed] <I>: tự động hủy lệnh thay vì nhận mặc định <I>, và từ chối tùy chọn Edge (E) |
| 40 | **`PROPERTIES / SETTINGS`** | **1** | `BUG-56` (CRITICAL) | Sửa Diameter / Circumference / MinorRadius trong bảng Properties rồi nhấn Undo (UpdateCurvePropsAction) làm Hình tròn co sập 50% (R = 50 -> 25) hoặc 2π lần |
| 41 | **`RECTANG`** | **1** | `BUG-14` (HIGH) | RECTANG thiếu hoàn toàn tùy chọn [Area/Dimensions/Rotation] sau khi chọn góc đầu, tự reset Width/Fillet/Chamfer về 0 ở lần chạy sau, và bo góc ngược khi kéo từ phải sang trái |
| 42 | **`REVCLOUD`** | **1** | `BUG-20` (MEDIUM) | REVCLOUD -> Object (O) khi chọn Reverse direction (Yes) xử lý sai hướng cung và để sót thực thể preview |
| 43 | **`ROTATE`** | **1** | `BUG-29` (HIGH) | ROTATE -> Reference (R) có 2 nhánh toán tử 3 ngôi giống hệt nhau (cộng thay vì trừ góc tham chiếu: Ref=30°, New=90° bị xoay lệch thành 120° thay vì 60°) |
| 44 | **`SAVE / SAVEAS / AUTH / COLLAB / WASM MEMORY`** | **1** | `BUG-58` (CRITICAL) | oneDriveStrategy.saveAs & dropboxStrategy.saveAs gọi thẳng this.save(e) ghi đè file gốc |
| 45 | **`SCALE`** | **1** | `BUG-30` (HIGH) | SCALE -> Reference (R) dùng GetPoint thay vì GetDistance làm thất bại khi nhập chiều dài tham chiếu bằng số trên bàn phím, thiếu tùy chọn [Points] (P) và không chặn chia cho 0 |
| 46 | **`SELECT`** | **1** | `BUG-07` (CRITICAL) | Nghịch lý tại lời nhắc Select objects: Từ chối toàn bộ 15 từ khóa chọn đối tượng chuẩn (W, L, C, BOX, ALL, F, WP, CP, A, R, M, P, U, AU, SI) |
| 47 | **`SPLINE`** | **1** | `BUG-17` (HIGH) | SPLINE thiếu từ khóa [Method/Knots/Object] ở nhắc đầu, liệt chế độ CV, và khi nhấn Enter kết thúc lại bắt nhấn thêm 2 lần Enter cho Start/End Tangent |
| 48 | **`STRETCH`** | **1** | `BUG-32` (CRITICAL) | STRETCH khi chọn đối tượng bằng click đơn (!box) lại đẩy toàn bộ các đỉnh vào danh sách kéo làm dịch chuyển cả đối tượng như MOVE, từ chối từ khóa C (Crossing), và gắn cứng z = 0 |
| 49 | **`TRIM / EXTEND`** | **1** | `BUG-37` (CRITICAL) | TRIM và EXTEND không mặc định ở Quick Mode (<select all>) và nhấn Enter rỗng không nạp biên |
| 50 | **`UCS / PLAN`** | **1** | `BUG-49` (CRITICAL) | UCS -> NAmed -> Save khi gõ 'NO' (Không ghi đè) vẫn chạy ghi đè gây crash '[CommandManager] UCS failed: Exception' |
| 51 | **`UNDO / REDO`** | **1** | `BUG-09` (CRITICAL) | Nút Undo bắn thừa chuỗi '1' gây lỗi 'Unsupported commvà "1".' |
| 52 | **`XLINE`** | **1** | `BUG-19` (HIGH) | XLINE -> Offset (O) -> Through (T) xử lý sai trạng thái và Bisect (B) không kiểm tra 3 điểm thẳng hàng gây ngoại lệ WASM |

---

## III. CHI TIẾT 58 BUG E2E (STEPS TÁI HIỆN, OUTPUT MONG MUỐN TRÊN AUTOCAD WEB & OUTPUT THỰC TẾ TRÊN VINACAD WEB)

### 1. Hệ thống Bắt điểm (OSNAP, OTRACK, SNAPMODE) (5 Bugs)

#### [BUG-01] [CRITICAL] Command: `OSNAP (Overrides: END, MID, CEN, INT, PER, TAN, M2P...)` — Liệt 100% cả 19 từ khóa Osnap Override trên dòng lệnh và lỗi key 'Apparent Intersection' trong menu chuột phải Snap Overrides
- **Steps tái hiện (Steps to Reproduce)**:
  1. Vẽ 1 đoạn thẳng `(0,0)-(100,0)` và 1 hình tròn tâm `(50,50)` bán kính `25`.
  2. Gõ `LINE` -> `Enter`. Tại `Specify first point:`, gõ `MID` (hoặc `END`, `CEN`, `GCE`, `QUA`, `INT`, `PER`, `TAN`, `NEA`, `APP`, `EXT`, `PAR`, `INS`, `NOD`, `NON`, `M2P`, `MTP`, `FROM`, `TK`) -> `Enter`.
  3. Hoặc giữ `Shift` + Chuột phải mở menu `Snap Overrides` -> chọn `Apparent Intersection`.
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - AutoCAD Web chuyển sang nhắc `mid of:` / `cen of:` / `First point of mid:` và bắt chính xác điểm đặc trưng đó cho 1 lần chọn điểm tiếp theo.
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - VinaCAD Web báo lỗi `"Giá trị nhập không hợp lệ."` cho cả 19 từ khóa! Trong menu chuột phải (`Module 89753`), mục `Apparent Intersection` truyền `key: "Apparent Intersection"` nhưng `mapStringSnapModeToNumber` (`Module 4068`) chỉ nhận `"apparent"`, nên trả về `null`.
- **Vị trí sửa**: `Module 39016` (`PromptPointOptions`) & `Module 4068` (`mapStringSnapModeToNumber`).

#### [BUG-02] [CRITICAL] Command: `OSNAP / OTRACK / SNAPMODE (Status Bar F3 / F9 / F11)` — Không thể tắt nút BẮT ĐT (OSNAP / F3) khi ở trạng thái chờ; nút TH.DÕI BẮT (OTRACK / F11) là nút giả (Dummy UI); nhấn F9 không gọi cad.setSnapMode()
- **Steps tái hiện (Steps to Reproduce)**:
  1. Để bản vẽ ở trạng thái chờ (`SELECT` mode), bấm nút **BẮT ĐT** trên thanh trạng thái hoặc nhấn phím `F3` nhiều lần.
  2. Bật/tắt nút **TH.DÕI BẮT** (`F11`) và nhấn phím `F9`.
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - `F3` / nút `BẮT ĐT` bật/tắt `<Osnap on>` / `<Osnap off>`; `F11` bật/tắt đường gióng Object Snap Tracking; `F9` bật/tắt `cad.setSnapMode()` và có `e.preventDefault()`.
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - Bấm `BẮT ĐT` / `F3` luôn in `Lệnh: <Bật bắt điểm>` (`objectSnapEnabled` bị kẹt cứng ở `true`); biến Redux của `TH.DÕI BẮT` (`Module 83056`) không được đọc ở bất kỳ hàm tính toán nào trong `Module 4068`; `F9` không gọi `setSnapMode()`.
- **Vị trí sửa**: `Module 28734`, `Module 83056`, `Module 4068`.

#### [BUG-03] [CRITICAL] Command: `OSNAP (Center - CEN & Geometric Center - GCE)` — Bắt điểm Tâm (Center) liệt trên Hình tròn (OdDbCircle) mới vẽ hoặc trong Layout1, không bắt được tâm khi rê chuột lên vành tròn; Geometric Center (GCE) liệt trên SPLINE kín và sai trên Polyline có bulge
- **Steps tái hiện (Steps to Reproduce)**:
  1. Bật `Center` và `Geometric Center`. Vẽ 1 `CIRCLE` tâm `(100,100)` bán kính `50`.
  2. Gõ ngay `LINE`, đưa chuột vào tâm `(100,100)` hoặc chạm vào vành hình tròn tại `(150,100)`.
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - AutoCAD Web bắt ngay `Center` `(100,100)` cả khi rê vào tâm lẫn khi chạm vào vành hình tròn `(150,100)`, và bắt đúng trọng tâm của `SPLINE` kín / `PLINE` có cung tròn.
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - `saveCreateMkForCenter` (`Module 4068`) chỉ kiểm tra `OdDbArc`/`OdDbEllipse` mà **bỏ quên hoàn toàn `OdDbCircle.cast(e)`**; khi rê lên vành hình tròn chỉ hiện dấu `+` với `snapPoint: null`; `saveCreateMkForGeoCenter` bỏ qua `OdDbSpline` và coi cung tròn Polyline là đoạn thẳng.
- **Vị trí sửa**: `Module 4068` (`saveCreateMkForCenter`, `saveCreateMkForGeoCenter`).

#### [BUG-04] [HIGH] Command: `OSNAP (Apparent Intersection, Parallel + Nearest, Insertion)` — Apparent Intersection thất bại 100% trên 2 đoạn thẳng không cắt nhau; bật Nearest ('Chọn tất cả') làm vô hiệu hóa Parallel; liệt Insertion trên Block mới chèn
- **Steps tái hiện (Steps to Reproduce)**:
  1. Vẽ 2 đoạn thẳng không chạm nhau `(0,0)-(40,0)` và `(50,10)-(50,50)` (giao điểm kéo dài tại `(50,0)`), bật `Apparent Intersection` và rê chuột tới `(50,0)`.
  2. Bấm **Chọn tất cả** trong menu Osnap (bật cả `Nearest` và `Parallel`), thử bắt điểm `Parallel`.
  3. Chèn 1 Block mới bằng `-INSERT`, thử bắt điểm `Insertion` ngay lập tức.
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - Bắt đúng giao điểm kéo dài tại `(50,0)`; `Parallel` hoạt động bình thường khi bật chung với `Nearest`; bắt được `Insertion` trên Block mới chèn.
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - 1. `class W.computeSnapPoint` (`Module 4068`) kiểm tra `if (!this.boxesOverlap(a, l)) continue` và truyền `kOnBothOperands` (`0`) thay vì `kExtendBoth` (`2`).
2. 4 chỗ trong `Module 4068` gắn cứng `&& !m.includes(v.g.near)` chặn `Parallel` khi `Nearest` bật.
3. `FreshEntityIndex` (`Module 57031`) lọc bỏ `!e.isBlockReference`.

#### [BUG-05] [CRITICAL] Command: `OSNAP (Cross-Space Model <-> Layout & Layer Off/Freeze)` — Bắt điểm ma xuyên không gian giữa Layout1 và Model Space, bắt điểm ma trên Layer đã Tắt (isOff) hoặc Đóng băng (isFrozen), và liệt Osnap qua Viewport
- **Steps tái hiện (Steps to Reproduce)**:
  1. Vẽ 1 hình chữ nhật ở `Layout1` tại `(100,100)-(200,200)`, chuyển về tab `Model`, gõ `LINE` và rê chuột qua `(100,100)`.
  2. Hoặc vẽ 1 đoạn thẳng trên `Layer1`, tắt (`Off`) hoặc đóng băng (`Freeze`) `Layer1`, rồi gõ `LINE` rê chuột qua vị trí đoạn thẳng vừa ẩn.
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - Không bao giờ bắt điểm vào đối tượng của `Layout` khi đang ở `Model` (và ngược lại), cũng không bắt điểm vào đối tượng trên Layer đang `Off`/`Frozen`.
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - `FreshEntityIndex` (`Module 57031`) lưu chung thực thể không lọc theo `blockTableRecord` hiện hành; `Module 4068` không kiểm tra `layer.isOff()` / `layer.isFrozen()` khi trả kết quả Osnap.

---

### 2. Nhập Tọa độ, Chọn Đối tượng (Select), Command Bar & Undo/Redo (4 Bugs)

#### [BUG-06] [CRITICAL] Command: `INPUT / COORDINATES (.X/.Y/.Z, @, @dist<angle, Dynamic Input Tab)` — Liệt 100% bộ lọc tọa độ (.X, .Y, .Z, .XY, .XZ, .YZ), ký hiệu @ (LASTPOINT) và tọa độ cực tương đối @dist<angle; nhấn Tab trên Dynamic Input bị trôi số khi di chuột
- **Steps tái hiện (Steps to Reproduce)**:
  1. Gõ `LINE` -> nhập điểm đầu `100,100` -> `Enter`.
  2. Tại `Specify next point:`, gõ `@` hoặc `@50<45` hoặc `.X` -> `Enter`.
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - AutoCAD Web nhận `@` là `(100,100,0)`, `@50<45` là `(135.3553, 135.3553, 0)`, và `.X` hỏi tiếp `of` để lọc hoành độ X.
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - VinaCAD Web báo `"Điểm không hợp lệ."` cho cả `@`, `@50<45` và `.X/.Y/.Z` vì `PromptOptions.getPointFromString` (`Module 39016`) chỉ `split(",")` và kiểm tra regex số thực thuần túy.

#### [BUG-07] [CRITICAL] Command: `SELECT (Selection Keywords: ALL, W, C, L, P, F, WP, CP, R, U...)` — Nghịch lý tại lời nhắc Select objects: Từ chối toàn bộ 15 từ khóa chọn đối tượng chuẩn (W, L, C, BOX, ALL, F, WP, CP, A, R, M, P, U, AU, SI)
- **Steps tái hiện (Steps to Reproduce)**:
  1. Vẽ 2 đoạn thẳng. Gõ `MOVE` (hoặc `ERASE`, `COPY`) -> `Enter`.
  2. Tại `Select objects:`, gõ `ALL` (hoặc `L`, `W`, `C`, `P`, `F`, `WP`, `CP`, `R`, `U`) -> `Enter`.
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - AutoCAD Web thực thi đúng từ khóa chọn đối tượng (`ALL` chọn tất cả, `L` chọn đối tượng cuối, `W`/`C` mở khung chọn...).
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - `PromptSelectionOptions.select` (`Module 39016`) không cài đặt từ khóa nào nhưng khi gõ `ALL`/`W`/`C`/`L` lại từ chối và in thông báo lỗi đòi chính 15 từ khóa đó: `"Expects a point or Window/Last/Crossing/BOX/ALL/Fence/WPolygon/CPolygon/Add/Remove/Multiple/Previous/Undo/AUto/SIngle"`.

#### [BUG-08] [HIGH] Command: `COMMAND BAR (UI Enter Button)` — Bấm nút 'Enter' trên thanh Command Bar truyền sự kiện click của React ([object Object]) làm tên lệnh, in lỗi Unsupported command "[OBJECT OBJECT]"
- **Steps tái hiện (Steps to Reproduce)**:
  1. Để thanh Command Bar ở trạng thái chờ, dùng chuột bấm vào nút **Enter** nằm bên phải thanh Command Bar.
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - Thực thi lệnh trong ô input hoặc lặp lại lệnh gần nhất giống phím `Enter` bàn phím.
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - In ra lỗi `Unsupported command "[OBJECT OBJECT]".`.
- **Vị trí sửa (`Module 28734` — `handleSendCommand(e)`)**: Dòng `let g = (e || ... || p).toString()` nhận `e` là `SyntheticBaseEvent` (`[object Object]`). Phải sửa thành `(typeof e === "string" ? e : "")`.

#### [BUG-09] [CRITICAL] Command: `UNDO / REDO` — Nút Undo bắn thừa chuỗi '1' gây lỗi 'Unsupported commvà "1".'; và nhấn Ctrl+Z sau khi ERASE làm mất vĩnh viễn 12+ loại đối tượng (Radial/Angular Dim, Leader, Ray, RasterImage...)
- **Steps tái hiện (Steps to Reproduce)**:
  1. Vẽ 1 đoạn thẳng rồi bấm nút `Undo` trên thanh công cụ (hoặc gõ `UNDO` -> `Enter` -> `Enter`).
  2. Tạo 1 kích thước bán kính/góc hoặc `MLEADER`, xóa bằng `ERASE` rồi nhấn `Ctrl+Z` (`UNDO`).
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - `UNDO` hoàn tác sạch sẽ không bắn chuỗi `"1"` thừa; `Ctrl+Z` khôi phục đầy đủ mọi loại đối tượng vừa xóa.
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - 1. Handler nút Undo (`Module 28734`) viết `await n.runCommand("UNDO"), r.fireSubscribeEvent(INPUT_PROMPT, "1")` — đợi `UNDO` kết thúc rồi mới bắn `"1"` gây lỗi `Unsupported commvà "1".`.
2. `_buildCreateAction` (`Module 39778`) trả về `null` cho 12+ lớp `OdDb*Dimension`, `OdDbLeader`, `OdDbTable`, `OdDbRay`, `OdDbRasterImage` khiến `Undo` sau khi xóa bị mất trắng đối tượng.

---

### 3. Nhóm Lệnh Vẽ Hình học (Draw Commands) (11 Bugs)

#### [BUG-10] [HIGH] Command: `LINE` — Lệnh LINE nhấn Enter tại nhắc đầu tiên không nối tiếp từ điểm cuối gần nhất, và gõ U (Undo) tại điểm thứ 2 không quay lại chọn điểm đầu
- **Steps tái hiện (Steps to Reproduce)**:
  1. Vẽ 1 đoạn thẳng kết thúc tại `(100,100)` rồi thoát. Gõ lại `LINE` -> `Enter` -> nhấn `Enter` tại `Specify first point:`.
  2. Hoặc gõ `LINE` -> chọn điểm đầu `(50,50)` -> tại `Specify next point:` gõ `U` -> `Enter`.
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - Nhấn `Enter` ở nhắc đầu lấy `(100,100)` làm điểm bắt đầu; gõ `U` sau điểm đầu tiên hủy điểm đầu và quay lại `Specify first point:`.
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - Nhấn `Enter` ở nhắc đầu thoát luôn lệnh `LINE`; gõ `U` khi mới có 1 điểm không quay lại bước chọn điểm đầu (`_LineCmd` trong `/Plugins/tgl/index.js`).

#### [BUG-11] [HIGH] Command: `PLINE` — PLINE -> Close (C) không tự kết thúc lệnh mà vẫn hỏi Specify next point; Width áp dụng lùi về đoạn trước; chế độ Arc tính sai chiều cung (bulge)
- **Steps tái hiện (Steps to Reproduce)**:
  1. Gõ `PLINE` -> nhập `0,0` -> `100,0` -> `100,100` -> gõ `C` (`Close`) -> `Enter`.
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - AutoCAD Web khép kín Polyline về `(0,0)` và **kết thúc ngay lệnh `PLINE`**.
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - VinaCAD Web khép kín Polyline nhưng lệnh `PLINE` vẫn chạy tiếp (`stillRunning: true`) ở lời nhắc `Specify next point:` vì nhánh `'C'` trong `_PlineCmd` quên gán `this.running = false;`.

#### [BUG-12] [HIGH] Command: `CIRCLE` — CIRCLE -> Diameter (D) gán defaultValue = lastRadius rồi lại chia đôi (/ 2) khi nhấn Enter làm hình tròn tự thu nhỏ 50% mỗi lần vẽ; vẽ CIRCLE ở zoom xa rồi zoom gần bị biến thành hình thoi 4 cạnh
- **Steps tái hiện (Steps to Reproduce)**:
  1. Gõ `CIRCLE` -> chọn tâm `0,0` -> `D` -> nhập `100` -> `Enter` (bán kính `50`). Chạy lại `CIRCLE` -> chọn tâm `200,0` -> `D` -> nhấn `Enter`.
  2. Zoom ra xa (`0.01x`), vẽ `CIRCLE` bán kính `5`, sau đó `ZOOM Window` phóng to sát vào hình tròn.
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - Nhấn `Enter` ở `Diameter` giữ nguyên đường kính `100` (`R = 50`); khi phóng to vào hình tròn nhỏ, hệ thống tự `Regen` để hiển thị tròn mịn.
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - 1. `_CircleCmd.handleDiameter` gán `defaultValue = _CircleCmd.lastRadius` (`50`) rồi khi nhấn `Enter` lại chia đôi `50 / 2 = 25`!
2. `_ZoomCmd` không gọi `DatabaseManager.regen()` khi `fieldWidth` thu nhỏ mạnh nên hình tròn hiển thị như hình thoi 4 cạnh.

#### [BUG-13] [HIGH] Command: `ARC` — Lệnh ARC từ chối từ khóa Center (C) và nhấn Enter nối tiếp tại lời nhắc đầu tiên, và từ chối bán kính bằng đúng nửa khoảng cách 2 đầu mút
- **Steps tái hiện (Steps to Reproduce)**:
  1. Gõ lệnh `ARC` -> `Enter` -> tại lời nhắc đầu tiên gõ `C` (`Center`) -> `Enter`.
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - Đã kiểm chứng trực tiếp trên AutoCAD Web (`web.autocad.com`): gõ `ARC` -> `C` chuyển ngay sang `Specify center point of arc:`.
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - VinaCAD Web báo lỗi `"Điểm không hợp lệ."` vì bước đầu tiên của `_ArcCmd` không gắn `Keyword("Center", "C", "Center")` vào `PromptPointOptions`.

#### [BUG-14] [HIGH] Command: `RECTANG` — RECTANG thiếu hoàn toàn tùy chọn [Area/Dimensions/Rotation] sau khi chọn góc đầu, tự reset Width/Fillet/Chamfer về 0 ở lần chạy sau, và bo góc ngược khi kéo từ phải sang trái
- **Steps tái hiện (Steps to Reproduce)**:
  1. Gõ `RECTANG` -> nhập góc đầu `0,0` -> gõ `D` (`Dimensions`) -> `Enter`.
  2. Hoặc gõ `RECTANG` -> `W` (`Width`) -> nhập `5` -> vẽ 1 hình chữ nhật, sau đó chạy lại `RECTANG`.
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - Đã kiểm chứng trên AutoCAD Web: sau khi nhập `0,0`, gõ `D` chuyển sang `Specify length for rectangles <10.0000>:`; và `Width = 5` được giữ nguyên cho các lần chạy `RECTANG` tiếp theo.
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - Trên VinaCAD Web, sau góc đầu chỉ dùng `PromptCornerOptions` nên gõ `D` bị từ chối; và `_RectangCmd.onCommandStart()` tự gán lại `_RectangCmd.width = 0` mỗi lần khởi động lệnh.

#### [BUG-15] [HIGH] Command: `POLYGON` — POLYGON nhấn Enter tại [Inscribed/Circumscribed] <I>: tự động hủy lệnh thay vì nhận mặc định <I>, và từ chối tùy chọn Edge (E)
- **Steps tái hiện (Steps to Reproduce)**:
  1. Gõ `POLYGON` -> nhập `6` -> tại `Specify center of polygon or [Edge]:` gõ `E` -> `Enter`.
  2. Hoặc nhập tâm `0,0` -> tại `[Inscribed in circle/Circumscribed about circle] <I>:`, nhấn `Enter`.
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - Đã kiểm chứng trên AutoCAD Web: gõ `E` chuyển sang `Specify first endpoint of edge:`; nhấn `Enter` tại `<I>` chuyển sang `Specify radius of circle:`.
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - Trên VinaCAD Web, gõ `E` bị báo điểm không hợp lệ, và nhấn `Enter` tại `<I>` nhảy vào `default: this.state = 7` hủy luôn lệnh!

#### [BUG-16] [CRITICAL] Command: `ELLIPSE (ELIPSE)` — ELLIPSE đăng ký sai tên chính 'ELIPSE', quên truyền KeywordCollection làm liệt Center (C) / Arc (A) ở nhắc đầu, chọn Rotation (R) gây crash TypeError, và nhập góc 0° trong Arc bị kẹt vòng lặp
- **Steps tái hiện (Steps to Reproduce)**:
  1. Gõ `ELLIPSE` (hoặc `ELIPSE`) -> tại nhắc đầu gõ `C` -> `Enter`.
  2. Hoặc nhập 2 đầu trục `0,0` -> `100,0` -> gõ `R` (`Rotation`) -> nhập `45` -> `Enter`.
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - Đã kiểm chứng trên AutoCAD Web: `ELLIPSE` -> `C` chuyển sang `Specify center of ellipse:`; `R` -> `45` tạo ngay Ellipse với góc xoay trục `45°`.
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - 1. Ở nhắc đầu, `_EllipseCmd` tạo `KeywordCollection` nhưng quên truyền vào `PromptPointOptions` nên từ chối `C` và `A`.
2. Chọn `R` -> nhập `45` văng crash **`TypeError: Cannot read properties of null (reading 'length')`**!
3. Trong `Arc`, kiểm tra `if (!this.startAngle)` coi `0°` là falsy.

#### [BUG-17] [HIGH] Command: `SPLINE` — SPLINE thiếu từ khóa [Method/Knots/Object] ở nhắc đầu, liệt chế độ CV, và khi nhấn Enter kết thúc lại bắt nhấn thêm 2 lần Enter cho Start/End Tangent
- **Steps tái hiện (Steps to Reproduce)**:
  1. Gõ `SPLINE` -> nhập 3 điểm `0,0` -> `50,50` -> `100,0` -> nhấn `Enter` 1 lần.
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - Đã kiểm chứng trên AutoCAD Web: nhấn `Enter` 1 lần kết thúc ngay lệnh `SPLINE` (`activeCmd: ""`) và tạo đường cong.
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - Trên VinaCAD Web, sau khi nhấn `Enter` lần 1, lệnh `SPLINE` vẫn không kết thúc (`stillRunning: true`) mà hỏi tiếp `Specify start tangent` và `Specify end tangent` (phải nhấn `Enter` 3 lần mới thoát).

#### [BUG-18] [HIGH] Command: `POINT` — Lệnh POINT không tự kết thúc sau khi đặt điểm và khi nhấn Enter để thoát lại báo 'Điểm không hợp lệ.' lặp vô tận
- **Steps tái hiện (Steps to Reproduce)**:
  1. Gõ `POINT` -> nhập `25,25` -> `Enter` -> nhấn tiếp `Enter`.
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - Đã kiểm chứng trên AutoCAD Web: ngay khi nhập `25,25` -> `Enter`, lệnh `POINT` tạo điểm và kết thúc ngay (`activeCmd: ""`); hoặc trong chế độ lặp, nhấn `Enter` rỗng phải thoát lệnh.
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - `PointCmd.handlePickPoint` (`all_99_commands_formatted.txt:29768`) lặp `while (this.running)` không đặt `allowNone = true` và thiếu `case PromptStatus.None: this.running = false;`, nên nhấn `Enter` báo `"Điểm không hợp lệ."` vô tận.

#### [BUG-19] [HIGH] Command: `XLINE` — XLINE -> Offset (O) -> Through (T) xử lý sai trạng thái và Bisect (B) không kiểm tra 3 điểm thẳng hàng gây ngoại lệ WASM
- **Steps tái hiện (Steps to Reproduce)**:
  1. Gõ `XLINE` -> `O` (`Offset`) -> `T` (`Through`) hoặc `B` (`Bisect`) với 3 điểm thẳng hàng.
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - Vẽ đường `OdDbXline` đi qua điểm chỉ định hoặc báo lỗi khi 3 điểm thẳng hàng trong `Bisect`.
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - `_XlineCmd` xử lý sai nhánh `Through` và gọi `.normalize()` lên vector không trong `Bisect`.

#### [BUG-20] [MEDIUM] Command: `REVCLOUD` — REVCLOUD -> Object (O) khi chọn Reverse direction (Yes) xử lý sai hướng cung và để sót thực thể preview
- **Steps tái hiện (Steps to Reproduce)**:
  1. Vẽ 1 hình chữ nhật, gõ `REVCLOUD` -> `O` (`Object`) -> chọn hình chữ nhật -> gõ `Y` tại `Reverse direction`.
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - Đảo chiều cung đám mây sửa đổi và xóa sạch đối tượng tạm.
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - `_RevcloudCmd` để sót đối tượng preview hoặc rò rỉ thực thể gốc.

---

### 4. Nhóm Lệnh Mặt cắt (HATCH) & Khối (-BLOCK / -INSERT) (6 Bugs)

#### [BUG-21] [CRITICAL] Command: `HATCH / -HATCH (CreateHatchAction)` — CreateHatchAction.saveOriginpt gọi hàm async DefaultCorner không có await (gán Promise vào originPoint làm gốc Hatch luôn về 0,0), và saveGradientColor đọc biến undefined this.isGradientName
- **Steps tái hiện (Steps to Reproduce)**:
  1. Vẽ hình chữ nhật tại `(500,500)-(600,600)`, chạy `-HATCH` với mẫu gạch chéo hoặc `Gradient` và đặt gốc theo góc.
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - Gốc mẫu Hatch đặt đúng tại `(500,500)` và áp dụng đúng màu Gradient.
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - Trong `CreateHatchAction` (`Module 39016`), `saveOriginpt` gọi `this.DefaultCorner(...)` không có `await` nên `this.originPoint` nhận `Promise`; `saveGradientColor` kiểm tra `this.isGradientName` (`undefined`) thay vì `this.isGradient`.

#### [BUG-22] [HIGH] Command: `HATCH / -HATCH (Boundary Pick, Select Object & ESC Loop)` — HATCH khi click điểm trong vùng kín chỉ tạo đường viền xanh tạm (nhấn Esc mất sạch Hatch), Select Object bỏ qua vùng kín tạo bởi các đoạn LINE/ARC, và -HATCH bị kẹt vòng lặp không thoát được bằng ESC ở Transparency/Gradient
- **Steps tái hiện (Steps to Reproduce)**:
  1. Vẽ 4 đoạn `LINE` nối kín (hoặc 1 `RECTANG`). Gõ `HATCH` -> click vào bên trong -> nhấn `Esc` (hoặc chọn `S` `Select object` -> chọn 4 đoạn `LINE` -> `Enter`).
  2. Hoặc gõ `-HATCH` -> `T` (`Transparency`) -> nhấn `ESC`.
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - Click điểm bên trong vùng kín tạo ngay `OdDbHatch`; `Select object` tạo được Hatch từ vòng kín gồm các đoạn `LINE`/`ARC`; nhấn `ESC` ở `Transparency`/`Gradient` thoát lệnh ngay.
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - `_HatchCmd` (`all_99_commands_formatted.txt:12636, 12750`) chỉ thêm preview màu xanh vào `View` cho tới khi nhấn `Enter`; `createBySavedValues()` bỏ qua hoàn toàn `OdDbLine`/`OdDbArc`; vòng lặp `Transparency()` và `GradientBtn()` thiếu `case PromptStatus.Cancel`.

#### [BUG-23] [CRITICAL] Command: `-BLOCK (Default <N> Overwrites Anyway)` — Trong -BLOCK, khi tên Block đã tồn tại và nhấn Enter để chọn mặc định <N> (Không ghi đè), lệnh vẫn nhảy sang state = 3 để ghi đè Block!
- **Steps tái hiện (Steps to Reproduce)**:
  1. Tạo Block `B1` bằng `-BLOCK`. Gõ lại `-BLOCK` -> nhập `B1` -> tại `Block "B1" already exists. Redefine it? [Yes/No] <N>:`, nhấn `Enter`.
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - Lệnh `-BLOCK` nhận mặc định `No` và kết thúc ngay, giữ nguyên `B1`.
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - Nhánh `case PromptStatus.None:` trong `_MinusBlockCmd` vẫn gán `this.isRedefine = true; this.state = 3;` và tiếp tục ghi đè Block!

#### [BUG-24] [CRITICAL] Command: `-BLOCK (Redefine WASM Crash, Scale Reset & Broken Undo)` — Định nghĩa lại Block (-BLOCK -> Yes) gây crash WASM 'RuntimeError: null function', làm reset tỉ lệ Scale của các INSERT hiện có về (1,1,1), và làm liệt hoàn toàn UNDO/REDO
- **Steps tái hiện (Steps to Reproduce)**:
  1. Tạo Block `B1` và chèn vào bản vẽ bằng `-INSERT` với tỉ lệ `Scale = 2`.
  2. Vẽ 1 hình tròn mới, chạy `-BLOCK` -> nhập `B1` -> chọn `Y` (`Yes`) -> chọn điểm gốc và hình tròn -> `Enter`, sau đó nhấn `Ctrl+Z` (`UNDO`).
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - Cập nhật định nghĩa `B1` không văng lỗi WASM, giữ nguyên `Scale = 2` của các Block Reference đã chèn, và khi nhấn `UNDO` phải khôi phục lại định nghĩa cũ của `B1`.
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - 1. Do `_MinusBlockCmd.annotativeMode` mặc định là `true`, `CreateBlockAction.execute()` (`Module 39016`) gọi `e.addAnnoScalestoBlkRefs(true)` gây crash WASM `RuntimeError: null function` hoặc reset Scale của các `OdDbBlockReference` về `(1,1,1)`.
2. Khi `isRedefineBlock = true`, `CreateBlockAction` truyền `targetHandle = null` vào `DeleteBlockAction`, khiến `DeleteBlockAction.execute()` thoát ngay ở dòng đầu `if (!this.targetObjectId) return;` làm liệt `UNDO`!

#### [BUG-25] [HIGH] Command: `-INSERT (Post-Insertion Scale S Ignored & Y Scale Skipped)` — Trong -INSERT, chọn tùy chọn S (Scale) sau khi chọn điểm chèn sẽ phớt lờ giá trị X Scale nhập từ bàn phím (luôn chèn với Scale = 1) và bỏ qua không hỏi Y Scale
- **Steps tái hiện (Steps to Reproduce)**:
  1. Gõ `-INSERT` -> nhập tên Block `B1` -> chọn điểm chèn `100,100` -> gõ `S` (`Scale`) -> nhập `2.5` -> `Enter` -> nhập góc xoay `0` -> `Enter`.
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - Block `B1` được chèn với tỉ lệ `scaleX = 2.5, scaleY = 2.5, scaleZ = 2.5`.
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - Block vẫn bị chèn với tỉ lệ `(1, 1, 1)` vì `_MinusInsertCmd.handleScale()` (`all_99_commands_formatted.txt:20903`) dùng nhầm `JigPromptPointOptions` thay vì `PromptDoubleOptions` và chỉ đọc `this.jigActions.scale.x` (bằng `1` khi nhập bàn phím).

#### [BUG-26] [HIGH] Command: `-INSERT (Pre-Insertion Rotate R Forgotten & ZScale GetPoint)` — Trong -INSERT, chọn tùy chọn R (Rotate) trước khi chọn điểm chèn bị xóa sạch góc xoay về 0 ngay khi chọn điểm chèn và hỏi lại góc xoay lần 2; nhánh ZScale gọi nhầm GetPoint
- **Steps tái hiện (Steps to Reproduce)**:
  1. Gõ `-INSERT` -> nhập `B1` -> tại `Specify insertion point or [Basepoint/Scale/X/Y/Z/Rotate]:` gõ `R` -> nhập `45` -> `Enter` -> sau đó nhập điểm chèn `100,100` -> `Enter`.
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - Chèn Block tại `(100,100)` với góc xoay `45°` đã đặt trước mà không hỏi lại góc xoay.
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - Đầu vòng lặp `while` trong `_MinusInsertCmd.handleInsertionPoint()` (`line 20792`) gọi `this.rotation = this.jigActions.initWorldToCamera()` ghi đè `this.rotation` về `0` và `promptForRotation()` quên gán `this.activeConfig.isRotate = false`.

---

### 5. Nhóm Lệnh Chỉnh sửa Hình học (Modify Commands) (19 Bugs)

#### [BUG-27] [CRITICAL] Command: `MOVE` — Trong MOVE, nhấn Enter tại lời nhắc điểm gốc (Specify base point or [Displacement] <Displacement>:) gây crash TypeError: Cannot read properties of null (reading 'x')
- **Steps tái hiện (Steps to Reproduce)**:
  1. Vẽ 1 đoạn thẳng. Gõ `MOVE` -> chọn đoạn thẳng -> `Enter` -> tại `Specify base point or [Displacement] <Displacement>:`, nhấn `Enter`.
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - Chuyển sang `Specify displacement:` với điểm gốc mặc định `(0,0,0)`.
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - `MoveCmd` chuyển sang `handleDisplacement` khi `this.basePoint` vẫn là `null`, gây crash `[CommandManager] MOVE failed: TypeError: Cannot read properties of null (reading 'x')`.

#### [BUG-28] [HIGH] Command: `COPY` — COPY -> Mode (O) -> Single (S) không tự thoát sau 1 lần sao chép; COPY -> Array (A) -> Fit (F) chia sai khoảng cách cho n thay vì n - 1; nhập khoảng cách đơn lẻ lấy hướng theo vị trí chuột cũ
- **Steps tái hiện (Steps to Reproduce)**:
  1. Gõ `COPY` -> chọn đối tượng -> `Enter` -> `O` (`mOde`) -> `S` (`Single`) -> chọn điểm gốc và điểm thứ 2.
  2. Hoặc trong `COPY`, chọn điểm gốc -> `A` (`Array`) -> nhập `5` -> `F` (`Fit`) -> nhập khoảng cách tổng `100`.
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - Chế độ `Single` tự kết thúc sau 1 bản sao; `Array -> Fit` chia khoảng cách `100 / (5 - 1) = 25`.
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - `CopyCmd` bỏ qua cờ `Single` nên vẫn lặp tiếp, và trong `Array -> Fit` chia cho `n` (`100 / 5 = 20`).

#### [BUG-29] [HIGH] Command: `ROTATE` — ROTATE -> Reference (R) có 2 nhánh toán tử 3 ngôi giống hệt nhau (cộng thay vì trừ góc tham chiếu: Ref=30°, New=90° bị xoay lệch thành 120° thay vì 60°)
- **Steps tái hiện (Steps to Reproduce)**:
  1. Vẽ đoạn thẳng nghiêng `30°`. Gõ `ROTATE` -> chọn đoạn thẳng -> `Enter` -> chọn tâm `0,0` -> gõ `R` (`Reference`) -> nhập `30` -> nhập góc mới `90` -> `Enter`.
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - Xoay thêm `90° - 30° = 60°` để đoạn thẳng nằm ở góc `90°` giống AutoCAD Web.
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - `_RotateCmd` viết `this.isReference ? angle + refAngle : angle + refAngle` (cộng thay vì trừ `newAngle - this.referenceAngle`), làm đoạn thẳng xoay lệch sang `120°`!

#### [BUG-30] [HIGH] Command: `SCALE` — SCALE -> Reference (R) dùng GetPoint thay vì GetDistance làm thất bại khi nhập chiều dài tham chiếu bằng số trên bàn phím, thiếu tùy chọn [Points] (P) và không chặn chia cho 0
- **Steps tái hiện (Steps to Reproduce)**:
  1. Vẽ đoạn thẳng dài `50`. Gõ `SCALE` -> chọn đoạn thẳng -> `Enter` -> chọn điểm gốc `0,0` -> gõ `R` (`Reference`) -> nhập `50` -> `Enter` -> nhập `100` -> `Enter`.
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - AutoCAD Web nhận chiều dài tham chiếu `50` và chiều dài mới `100`, phóng đại đoạn thẳng lên `2x`.
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - `ScaleCmd` dùng `GetPoint` thay vì `GetDistance` cho bước nhập `Reference length` và `New length` nên báo lỗi hoặc không thay đổi kích thước khi nhập số từ bàn phím.

#### [BUG-31] [HIGH] Command: `MIRROR` — MIRROR làm lật ngược mặt chữ TEXT/MTEXT như soi gương (bỏ qua MIRRTEXT = 0), hàm check3dPt từ chối tọa độ có 3 thành phần (kể cả z = 0), và từ chối khi gõ nguyên từ 'YES'/'NO'
- **Steps tái hiện (Steps to Reproduce)**:
  1. Tạo 1 đối tượng `MTEXT`. Gõ `MIRROR` -> chọn chữ -> `Enter` -> nhập trục gương `100,0,0` và `100,100,0` -> tại `Erase source objects? [Yes/No] <N>:`, gõ `NO` -> `Enter`.
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - Chấp nhận `100,0,0` và từ khóa `NO`; chữ sau khi đối xứng không bị lật ngược mặt chữ (`normal.z = +1`).
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - `MirrorCmd.check3dPt` báo lỗi `"Invalid 2D point."` khi nhập `100,0,0`; nhân trực tiếp `mirrorMatrix` làm `normal.z = -1` khiến chữ bị lộn ngược; và so sánh chuỗi cứng `'Y'`/`'N'`.

#### [BUG-32] [CRITICAL] Command: `STRETCH` — STRETCH khi chọn đối tượng bằng click đơn (!box) lại đẩy toàn bộ các đỉnh vào danh sách kéo làm dịch chuyển cả đối tượng như MOVE, từ chối từ khóa C (Crossing), và gắn cứng z = 0
- **Steps tái hiện (Steps to Reproduce)**:
  1. Vẽ 1 hình chữ nhật `(0,0)-(100,50)`. Gõ `STRETCH` -> click chọn vào cạnh hình chữ nhật -> `Enter` -> dịch chuyển từ `(0,0)` tới `(50,0)`.
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - Chỉ các đỉnh nằm trong vùng chọn `Crossing` mới được kéo dãn; click đơn không kéo trôi toàn bộ hình chữ nhật.
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - Trong `_StretchCmd`, khi `!_0x558e18.box`, code đẩy tất cả các đỉnh của đối tượng vào `indexList`, biến `STRETCH` thành `MOVE` cả đối tượng!

#### [BUG-33] [CRITICAL] Command: `ALIGN` — ALIGN 2 điểm văng ngoại lệ WASM '[CommandManager] ALIGN failed: Exception' (OdError: eDegenerateGeometry) khi vector nguồn và vector đích song song (góc 0° hoặc 180°)
- **Steps tái hiện (Steps to Reproduce)**:
  1. Vẽ đoạn thẳng `(0,0)-(50,0)`. Gõ `ALIGN` -> chọn đoạn thẳng -> `Enter` -> cặp điểm 1: `0,0` tới `0,50` -> cặp điểm 2: `50,0` tới `100,50` -> nhấn `Enter` tại điểm 3 -> gõ `N` -> `Enter`.
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - Dời đoạn thẳng lên `(0,50)-(50,50)` mà không văng lỗi.
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - Trong `AlignCmd.createAlign()` (`all_99_commands_formatted.txt:936, 943`), khi 2 vector song song thì `crossProduct` bằng `(0,0,0)` và gọi `.normalize()` ném ngay ngoại lệ C++ `OdError(eDegenerateGeometry)`, đồng thời dòng 943 truyền nhầm `this.firstDesPoint` vào `PlaneGeometryUtils.createCurrentNormal`.

#### [BUG-34] [CRITICAL] Command: `FILLET` — FILLET thiếu [Polyline/Trim/Multiple/Undo], tự chèn đoạn OdDbLine màu xanh vào Database khi click Polyline, gọi erase(true) trên thực thể kForRead gây crash eNotOpenForWrite, và không cắt/nối khi R = 0
- **Steps tái hiện (Steps to Reproduce)**:
  1. Vẽ 2 đoạn thẳng vuông góc hoặc 1 `RECTANG`. Gõ `FILLET` -> `R` -> nhập `0` (hoặc `20`) -> chọn 2 cạnh.
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - Hỗ trợ `[Undo/Polyline/Radius/Trim/Multiple]`, cắt giao điểm sắc khi `R = 0`, bo cung tròn khi `R > 0`, không chèn đoạn thẳng rác màu xanh vào Database và không crash.
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - `_FilletCmd` chỉ có từ khóa `R`, gọi `appendOdDbEntity` chèn 1 `OdDbLine` màu xanh (`colorIndex = 5`) vào Database khi click Polyline mà không xóa, gọi `firstEntity.erase(true)` trên thực thể `kForRead` gây crash `OdError: eNotOpenForWrite`, và không cắt/nối khi `R = 0`.

#### [BUG-35] [HIGH] Command: `CHAMFER` — CHAMFER từ chối Distance = 0 (allowZero = false), làm mất sạch Layer/Color khi vát Polyline, đổi màu đoạn thẳng gốc sang xám trước khi kiểm tra khoảng cách, và bỏ qua chế độ No Trim
- **Steps tái hiện (Steps to Reproduce)**:
  1. Vẽ 2 đoạn thẳng vuông góc trên một Layer màu đỏ. Gõ `CHAMFER` -> `D` -> thử nhập `0` (hoặc nhập `20` -> `20`) rồi chọn 2 cạnh.
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - Chấp nhận `Distance = 0` để cắt góc nhọn; giữ nguyên Layer/Color của đối tượng gốc; tôn trọng chế độ `No trim`.
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - `_ChamferCmd` đặt `allowZero = false` nên từ chối `D = 0`; tạo Polyline mới trên `CLAYER` làm mất Layer/Color gốc; và đổi màu thực thể sang xám trên Database trước khi kiểm tra khoảng cách.

#### [BUG-36] [HIGH] Command: `OFFSET` — OFFSET in sai trạng thái Layer=Source (luôn gán đối tượng mới vào CLAYER), kẹt vòng lặp khi nhập khoảng cách <= 0, bỏ mất các vòng kín thứ 2 trở đi, và OffsetJigActions.finish() gọi .delete() trước khi đọc
- **Steps tái hiện (Steps to Reproduce)**:
  1. Gõ `OFFSET` -> nhập `-5` -> `Enter`, hoặc chọn `L` (`Layer`) -> `S` (`Source`) rồi offset một đối tượng nằm trên Layer khác với `CLAYER`.
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - Từ chối số âm nhưng cho phép nhập lại bình thường hoặc nhấn `ESC`; khi `Layer=Source` đối tượng mới phải nằm trên Layer của đối tượng gốc.
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - `_OffsetCmd` qua `DatabaseUtil.executeActionByCategory` luôn tạo thực thể trên `CLAYER`; vòng lặp nhập khoảng cách bị kẹt khi nhập số `<= 0`; và `OffsetJigActions.finish()` gọi `.delete()` trước khi `getResultEntity()`.

#### [BUG-37] [CRITICAL] Command: `TRIM / EXTEND` — TRIM và EXTEND không mặc định ở Quick Mode (<select all>) và nhấn Enter rỗng không nạp biên; TrimSpline luôn trả về [] (liệt cắt SPLINE); giữ Shift trong EXTEND gây crash TypeError
- **Steps tái hiện (Steps to Reproduce)**:
  1. Vẽ 2 đường cắt nhau. Gõ `TRIM` (hoặc `EXTEND`) -> nhấn `Enter` để chọn `<select all>` -> click vào đoạn cần cắt.
  2. Vẽ 1 `SPLINE` cắt 1 `LINE`, chạy `TRIM` cắt `SPLINE`; hoặc giữ `Shift` trong `EXTEND` click vào đoạn thẳng không giao biên.
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - Nhấn `Enter` chọn toàn bộ đối tượng làm biên; cắt được `SPLINE`; giữ `Shift` trong `EXTEND` không crash.
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - 1. Nhấn `Enter` rỗng tại bước chọn biên không nạp tất cả đối tượng làm biên.
2. `TrimJigActions.TrimSpline` tính `sliceSpline` rồi bỏ quên kết quả và `return [];`.
3. Giữ `Shift` trong `ExtendJigActions` gọi `this.UnExtendAbleData.push(true)` trên `undefined` gây crash `TypeError`!

#### [BUG-38] [CRITICAL] Command: `ARRAY (Rectangular / Polar / Path)` — Trong ARRAY -> Polar (và Rectangular), nhấn phím Escape tại lời nhắc chọn tâm vẫn chạy endSubCommand gây crash TypeError: Cannot read properties of null (reading 'x') hoặc xóa mất đối tượng gốc; thiếu case 3 cho Path Array
- **Steps tái hiện (Steps to Reproduce)**:
  1. Vẽ 1 hình tròn. Gõ `ARRAY` -> chọn hình tròn -> `Enter` -> gõ `PO` (`Polar`) -> `Enter`.
  2. Tại lời nhắc `Specify center point of array:`, nhấn phím `Escape`.
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - Lệnh `ARRAY` hủy sạch sẽ và giữ nguyên hình tròn gốc; hỗ trợ đủ 3 kiểu `[Rectangular/PAth/POlar]`.
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - 1. `PolarArraySubCmd.runSubCommand()` gọi `endSubCommand()` ngay cả khi `state === 0xc` (`Cancel`), truyền `centerPoint: null` vào `CreatePolarArrayAction` gây crash `TypeError: Cannot read properties of null (reading 'x')` hoặc xóa mất đối tượng gốc!
2. `_ArrayCmd` khởi tạo `pathArraySubCmd` nhưng quên thêm `case 3` trong `switch`.
3. `PolarArraySubCmd.startSubCommand` truyền nhầm `this.basePoint` vào `PlaneGeometryUtils.createCurrentNormal`.

#### [BUG-39] [HIGH] Command: `PEDIT` — PEDIT từ chối đối tượng LINE/ARC (không tự chuyển thành LWPOLYLINE), tùy chọn Join (J) không nối được các đoạn thẳng chạm nhau, và Edit vertex không di chuyển dấu X
- **Steps tái hiện (Steps to Reproduce)**:
  1. Vẽ 2 đoạn `LINE` nối tiếp nhau `(0,0)-(50,0)` và `(50,0)-(50,50)`. Gõ `PEDIT` -> chọn đoạn đầu -> chọn `J` (`Join`) -> chọn cả 2 đoạn -> `Enter`.
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - AutoCAD Web chuyển `LINE` thành `LWPOLYLINE` và nối 2 đoạn thành 1 `LWPOLYLINE` 3 đỉnh.
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - `_PeditCmd` từ chối `OdDbLine`/`OdDbArc` hoặc không ghép nối được trong `Join`, và giữ khóa `kForWrite` trên thực thể.

#### [BUG-40] [HIGH] Command: `JOIN` — Lỗi chính tả 'this.srouceEntity' (thay vì sourceEntity) trong JoinCmd và 5 class Create*Action (Module 39016) làm mất sạch Layer/Color/Linetype gốc khi JOIN, và không nối được 2 đoạn thẳng chung điểm đầu
- **Steps tái hiện (Steps to Reproduce)**:
  1. Vẽ 2 đoạn thẳng đồng phương trên Layer màu đỏ chạm nhau tại điểm đầu `(0,0)`, đổi `CLAYER` về Layer `0` rồi chạy `JOIN` chọn 2 đoạn thẳng.
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - Nối thành 1 đoạn thẳng duy nhất và giữ nguyên Layer màu đỏ của đối tượng nguồn.
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - Do viết sai chính tả `this.srouceEntity` trong `JoinCmd` và `CreateLineAction`/`CreateArcAction`/`CreatePolylineAction`/`CreateCircleAction`/`CreateEllipseAction`, thuộc tính gốc bị rơi về `CLAYER`, và `joinLines` thất bại khi 2 đoạn thẳng chung điểm đầu.

#### [BUG-41] [HIGH] Command: `BREAK / BREAKATPOINT` — BREAK (BR) thiếu tùy chọn [First point] (F), từ chối cắt CIRCLE thành ARC, và BREAKATPOINT trên Polyline khép kín tự cắt thêm tại đỉnh 0 tách thành 2 Polyline rời nhau
- **Steps tái hiện (Steps to Reproduce)**:
  1. Vẽ đoạn thẳng `(0,0)-(100,0)`. Gõ `BREAK` -> chọn đoạn thẳng -> gõ `F` (`First point`) -> nhập `30,0` -> `70,0`.
  2. Hoặc vẽ 1 `RECTANG` và chạy `BREAKATPOINT` cắt tại 1 điểm trên cạnh.
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - Gõ `F` cho phép chọn lại điểm cắt thứ nhất tại `(30,0)` và thứ hai tại `(70,0)`; `BREAKATPOINT` trên Polyline kín chỉ mở vòng kín tại điểm cắt thành 1 Polyline hở.
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - VinaCAD Web không hỗ trợ `[First point]` (`F`) trong `BREAK`, từ chối `CIRCLE`, và `BreakAtPointCmd` cắt đôi Polyline kín thành 2 thực thể rời nhau.

#### [BUG-42] [CRITICAL] Command: `EXPLODE` — EXPLODE không phân rã hình chữ nhật (RECTANG / LWPOLYLINE) thành 4 đoạn LINE, và trong ExplodeCmd của plugin lại xóa mất vĩnh viễn đối tượng nguyên thủy (LINE, CIRCLE, ARC)
- **Steps tái hiện (Steps to Reproduce)**:
  1. Vẽ 1 hình chữ nhật bằng `RECTANG`. Gõ `EXPLODE` -> chọn hình chữ nhật -> `Enter`.
  2. Hoặc chạy `ExplodeCmd` trên 1 đoạn `LINE` hoặc `CIRCLE`.
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - Trên `RECTANG`, AutoCAD Web phân rã thành **4 thực thể `OdDbLine`** rời nhau; trên `LINE`/`CIRCLE`, AutoCAD Web giữ nguyên đối tượng và báo `"1 was not able to be exploded."`.
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - Lệnh `EXPLODE` trên VinaCAD Web giữ nguyên `RECTANG` không phân rã thành 4 đoạn `LINE` (vì chỉ xử lý `OdDbBlockReference`), còn `ExplodeCmd` trong `/Plugins/tgl/index.js` luôn đẩy `DeleteEntityAction` làm xóa mất luôn `LINE`/`CIRCLE`!

#### [BUG-43] [HIGH] Command: `DIVIDE` — DIVIDE -> Block (B) gọi lẻ từng executeAction trong vòng lặp (tạo ra hàng chục bước Undo rời rạc) và từ chối khi gõ đầy đủ 'YES'/'NO'
- **Steps tái hiện (Steps to Reproduce)**:
  1. Gõ `DIVIDE` -> chọn đoạn thẳng -> `B` (`Block`) -> nhập tên Block -> gõ `YES` -> nhập `10` -> sau đó nhấn `Ctrl+Z`.
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - Chấp nhận `'YES'` và gom toàn bộ các Block/Point chia đoạn vào 1 `executeActionGroup` để 1 lần `Ctrl+Z` hoàn tác tất cả.
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - `_DivideCmd` gọi lẻ `executeAction` trong vòng lặp `for` và so sánh cứng `=== 'Y'`.

#### [BUG-44] [MEDIUM] Command: `DRAWORDER` — DRAWORDER -> Above/Under khi nhấn ESC hủy chọn đối tượng tham chiếu vẫn thực thi tiếp handleOrder
- **Steps tái hiện (Steps to Reproduce)**:
  1. Gõ `DRAWORDER` -> chọn đối tượng -> `Enter` -> chọn `Above objects` (`A`) -> tại lời nhắc chọn đối tượng tham chiếu, nhấn `ESC`.
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - Hủy ngay lệnh `DRAWORDER` khi nhấn `ESC`.
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - `selectReferenceObj()` không dừng vòng lặp khi `PromptStatus.Cancel`.

#### [BUG-45] [HIGH] Command: `MATCHPROP` — MATCHPROP sao chép cả tọa độ alignmentPoint làm chữ đích bay về đè lên vị trí chữ nguồn, gọi nhầm setHeight thay vì setTextHeight trên MText, và hỏng Undo 100%
- **Steps tái hiện (Steps to Reproduce)**:
  1. Tạo 2 chữ tại `(0,0)` và `(200,200)` có cỡ chữ khác nhau. Chạy `MATCHPROP` chọn chữ ở `(0,0)` rồi quét lên chữ ở `(200,200)`, sau đó nhấn `Ctrl+Z`.
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - Chữ ở `(200,200)` nhận kiểu/cỡ chữ mới nhưng giữ nguyên vị trí `(200,200)` và `Undo` khôi phục đúng cỡ chữ cũ.
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - `UpdateMatchPropertiesAction` (`Module 39016`) chép luôn `setAlignmentPoint` làm chữ đích bay về `(0,0)`, gọi nhầm `setHeight` trên `MText`, và lưu con trỏ WASM đã giải phóng vào `restoreStates` làm liệt `Undo`.

---

### 6. Chữ (MText/Style), Kích thước (Dim), Hệ tọa độ (UCS/View), Đo lường & Hệ thống (13 Bugs)

#### [BUG-46] [CRITICAL] Command: `MTEXT / TEXTEDIT / STYLE / FIND` — Bảng STYLE crash 'TypeError: styleArrray[i].getName is not a function' khi nhập tên mới; TEXTEDIT xóa trắng chữ trên DB trước khi mở ô sửa & thiếu undoAction; MTEXT Columns bị fall-through; FIND bỏ sót Layout2+
- **Steps tái hiện (Steps to Reproduce)**:
  1. Mở `STYLE`, bấm tạo kiểu chữ mới và gõ tên vào ô input.
  2. Chạy `TEXTEDIT` sửa 1 chữ rồi nhấn `Ctrl+Z` (`UNDO`).
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - Tạo/sửa kiểu chữ trong `STYLE` không crash; `TEXTEDIT` hỗ trợ `Undo` qua `ActionManager`; `FIND` tìm trên toàn bộ các Layout.
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - 1. Sidebar `TextStyle` gọi `this.styleArrray[i].getName()` trên plain object gây crash `TypeError`.
2. `UpdateTextEditAction` (`Module 3872`) và `CreateTextStyleAction`/`UpdateTextStyleAction` (`Module 39016`) không tạo `undoAction`.
3. `FIND` chỉ quét `Model` và `Layout1`.

#### [BUG-47] [CRITICAL] Command: `DIMALIGNED / DIMLINEAR / DIM` — DIMALIGNED khi chọn đối tượng (<select object>) rồi gõ T (Text) gây crash 'TypeError: Cannot read properties of undefined (reading "toFixed")'; nhập tọa độ điểm đặt đường kích thước bằng bàn phím bị phớt lờ (lấy vị trí chuột 0,0); DIMLINEAR thiếu case 'M'
- **Steps tái hiện (Steps to Reproduce)**:
  1. Vẽ đoạn thẳng `(0,0)-(100,0)`. Gõ `DIMALIGNED` -> nhấn `Enter` (`<select object>`) -> chọn đoạn thẳng -> gõ `T` (`Text`) -> `Enter`.
  2. Hoặc gõ `DIMLINEAR` -> nhập điểm 1 `0,0` -> điểm 2 `100,0` -> nhập vị trí đường kích thước `50,30` bằng bàn phím -> `Enter`.
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - Gõ `T` hiển thị nhắc nhập chữ kích thước `<100.0000>:`; nhập `50,30` đặt đường kích thước đi qua đúng `(50,30)`.
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - 1. `_DimAlignedCmd.handleSelectObject()` (`all_99_commands_formatted.txt:5704`) quên gán `_DimAlignedCmd.defaultDim`, nên khi gõ `T` hàm `handleText()` gọi `_DimAlignedCmd.defaultDim.toFixed(...)` trên `undefined` gây crash `TypeError`!
2. `handleLocation()` trong `DIMLINEAR`/`DIMALIGNED` đọc `this.jigActions.dimLinePoint` (vị trí chuột) thay vì `PromptPointResult.Value` khi nhập từ bàn phím!
3. `DimLinearUtils.checkRotation` thiếu từ khóa `return`.

#### [BUG-48] [HIGH] Command: `MLEADER` — MLEADER tự động thoát lệnh khi nhấn Enter chọn mặc định <eXit options> trong nhánh Options, đăng ký từ khóa có dấu cách làm liệt phím tắt đơn ký tự, và ArrowHeadPreviewJig đọc biến undefined this.currentValue
- **Steps tái hiện (Steps to Reproduce)**:
  1. Gõ `MLEADER` -> `O` (`Options`) -> nhấn `Enter` để chọn mặc định `<eXit options>` quay lại vẽ đường dẫn.
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - Quay lại lời nhắc `Specify leader arrowhead location:` để tiếp tục vẽ `MLEADER`.
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - Nhấn `Enter` trong `Options` làm kết thúc luôn lệnh `MLEADER`.

#### [BUG-49] [CRITICAL] Command: `UCS / PLAN (UCS Save 'NO' Crash & Ortho/Polar Ignores 2D Rotated UCS)` — UCS -> NAmed -> Save khi gõ 'NO' (Không ghi đè) vẫn chạy ghi đè gây crash '[CommandManager] UCS failed: Exception'; xoay UCS 2D (45°) bị Ortho (F8) và Polar (F10) bỏ qua hoàn toàn; lệnh PLAN nhấn Enter bị kẹt vòng lặp
- **Steps tái hiện (Steps to Reproduce)**:
  1. Gõ `UCS` -> `NA` -> `S` -> nhập `U1` -> `Enter`. Gõ lại `UCS` -> `NA` -> `S` -> nhập `U1` -> tại `Replace it? [Yes/No] <N>:`, gõ `NO` -> `Enter`.
  2. Gõ `UCS` -> `Z` -> nhập `45` -> bật `ORTHO` (`F8`) -> chạy `LINE` vẽ đoạn thẳng.
  3. Gõ `PLAN` -> `Enter` -> nhấn `Enter`.
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - Gõ `NO` không ghi đè UCS và không crash; `Ortho` khóa theo góc `45°`/`135°` của trục UCS; `PLAN` xoay camera về mặt phẳng UCS và kết thúc ngay.
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - 1. `_UcsCmd.saveUcs()` (`all_99_commands_formatted.txt:36186`) kiểm tra `Value.toUpperCase() == 'N'` nên khi gõ `'NO'` điều kiện là `false`, chạy thẳng xuống `CreateUcsAction` trùng tên gây crash `Exception`!
2. `createViewAlignedOrthographicAxes` (`Module 58758`) vứt bỏ trục X/Y của UCS khi góc nhìn song song mặt phẳng XY.
3. `_PlanCmd` quên gán `this.running = false` khi nhấn `Enter`.

#### [BUG-50] [CRITICAL] Command: `-VIEW / ZOOM / 3DORBIT` — Trong -VIEW -> Orthographic, nhập hướng nhìn (T, F, L, R...) gây crash 'TypeError: reading "toUpperCase"'; 8 hàm trong ViewCmdUtils gọi Database.getViewTable() không tồn tại; ZOOM Previous chỉ lưu 1 khung nhìn và ZOOM All/Object hỏng ở góc phần tư âm
- **Steps tái hiện (Steps to Reproduce)**:
  1. Gõ `-VIEW` -> `O` (`Orthographic`) -> `T` (`Top`) -> `Enter` (hoặc `-VIEW` -> `S` `Save` / `R` `Restore`).
  2. Thực hiện `ZOOM` 3 lần rồi gõ `ZOOM` -> `P` (`Previous`) 2 lần.
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - `-VIEW` chuyển góc nhìn hoặc lưu/khôi phục View không crash; `ZOOM Previous` quay lui qua nhiều khung nhìn lịch sử.
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - 1. `_ViewCmd.handleOrthographic` đọc `Value.toUpperCase()` trên `undefined` gây crash `TypeError`; cả 8 hàm trong `ViewCmdUtils` gọi `this.Database.getViewTable()` không tồn tại!
2. `_ZoomCmd.savePreviousView()` viết điều kiện ngược `if (!_ZoomCmd.lastView)` nên chỉ lưu đúng 1 khung nhìn; `ZOOM All/Object` khởi tạo `maxX = Number.MIN_VALUE` (`+5e-324 > 0`) thay vì `-Infinity`.

#### [BUG-51] [CRITICAL] Command: `MEASURE / MEASUREGEOM / DIST` — CustomLineDim trong MEASURE tính chiều dài theo cạnh huyền sqrt(L^2 + (100*screenScale)^2) làm số đo tự thay đổi khi lăn chuột Zoom; MEASURE -> Angle trên Circle hoặc nhấn ESC ở Vertex gây crash TypeError; DIST không in kết quả ra Command History và mất ΔZ
- **Steps tái hiện (Steps to Reproduce)**:
  1. Vẽ đoạn thẳng dài `100`, chạy `MEASURE` đo đoạn thẳng và lăn chuột Zoom xa/gần; hoặc chạy `MEASURE` -> `A` (`Angle`) chọn `CIRCLE` rồi thoát.
  2. Gõ `DIST` -> nhập `0,0,0` -> `30,40,50` -> `Enter`.
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - Số đo `MEASURE` luôn cố định bằng `100.0000` ở mọi mức Zoom và thoát `Angle` không crash; `DIST` in đầy đủ `Distance = 70.7107, Delta X = 30, Delta Y = 40, Delta Z = 50` ra Command History.
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - 1. `CustomLineDim` (`phase12_part2_formatted.js`) đo khoảng cách tới điểm đặt đường gióng đã dịch `100 * screenScale`.
2. `handleAngleCircle` đẩy mảng con `[arc, dim]` vào `previewEntities` gây crash `_0x3c615b.delete is not a function`.
3. `DIST` chiếu điểm xuống 2D và không in kết quả ra Command History.

#### [BUG-52] [HIGH] Command: `AREA / LIST / ID` — AreaUtils2.calculatePerimeter bỏ qua cung tròn (bulge != 0) làm chu vi sai lệch -36.3%, và lệnh AREA / ID không in kết quả Area, Perimeter, tọa độ X,Y,Z ra Command History
- **Steps tái hiện (Steps to Reproduce)**:
  1. Gõ `AREA` -> nhập 4 đỉnh `0,0` -> `100,0` -> `100,50` -> `0,50` -> `Enter` (hoặc đo `AREA -> Object` trên Polyline có cung tròn).
  2. Gõ `ID` -> nhập `125.5, 250.75, 0` -> `Enter`.
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - `AREA` in `Area = 5000.0000, Perimeter = 300.0000` và tính đúng chiều dài cung tròn `bulge`; `ID` in `X = 125.5000  Y = 250.7500  Z = 0.0000` ra Command History.
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - `AREA` và `ID` kết thúc mà không in kết quả ra Command History; `AreaUtils2.calculatePerimeter` chỉ tính khoảng cách dây cung thẳng `p1.distanceTo(p2)` bỏ qua `bulge`.

#### [BUG-53] [CRITICAL] Command: `PLOT / EXPORT PDF` — Xuất PDF (PLOT) khi đang ở tab Layout1 hoặc Layout2 thất bại và bật hộp thoại báo lỗi 'Error exporting PDF: Bad parameter'; applyPDFExportSettingsToLayout luôn ép setPrintLineweights(false)
- **Steps tái hiện (Steps to Reproduce)**:
  1. Chuyển sang tab `Layout1` hoặc `Layout2`, gõ `PLOT` -> bấm **Plot to PDF**.
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - Xuất tệp PDF của `Layout1`/`Layout2` thành công và giữ đúng độ dày nét (`Lineweight`).
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - Trong `Module 70850` (`applyPDFExportSettingsToLayout`), gọi `n.setPlotType(t, r.plotType)` với `kExtents` trên Layout chưa có đối tượng Paper Space ném ngoại lệ WASM `OdError("Bad parameter")`; và dòng `t.setPrintLineweights(!1)` làm mất toàn bộ nét dày khi in.

#### [BUG-54] [HIGH] Command: `LAYER / LAYMCUR / LTSCALE / VIEWPORT` — hasEntitiesInLayer chỉ kiểm tra ModelSpace (xóa nhầm Layer đang dùng ở Layout1); CreateLayerAction/DeleteLayerAction thiếu undoAction; LAYMCUR giữ khóa kForWrite và in '*error*'; LTSCALE không tự Regen; Viewport khóa vẫn bị zoom trong MSPACE
- **Steps tái hiện (Steps to Reproduce)**:
  1. Tạo đối tượng trên `Layer1` ở `Layout1` rồi xóa `Layer1`; chạy `LAYMCUR` nhấn `Enter`; chạy `LTSCALE` đổi tỉ lệ nét đứt; hoặc lăn chuột zoom trong `MSPACE` trên Viewport đã khóa (`isLocked = true`).
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - Chặn xóa Layer đang có đối tượng ở Layout; `CreateLayer`/`DeleteLayer` hỗ trợ `Undo`; `LAYMCUR` mở ở `kForRead` và đóng con trỏ; `LTSCALE` tự gọi `Regen`; Viewport đã khóa không bị lệch tỉ lệ khi lăn chuột.
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - `LayerManager.hasEntitiesInLayer` (`Module 50886`) chỉ kiểm tra `ModelSpace`; `LAYMCUR` mở thực thể ở `kForWrite` không `.delete()`; `LTSCALE` thiếu `regen()`; và chuyển tab Layout khi đang có lệnh hoạt động gây trễ/đơ.

#### [BUG-55] [CRITICAL] Command: `-PURGE / UNGROUP / -GROUP` — -PURGE (PurgeService.purgeItems) gọi trực tiếp .erase(true) trên C++ WASM bỏ qua hoàn toàn ActionManager (làm hỏng Undo/Redo và lệch Collab); -GROUP/UNGROUP thao tác ngoài ActionManager
- **Steps tái hiện (Steps to Reproduce)**:
  1. Chạy `-PURGE` -> `A` (`All`) xóa các Block/Layer trống rồi nhấn `Ctrl+Z` (`UNDO`).
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - Mọi thao tác xóa trong `-PURGE` và tạo/hủy nhóm `-GROUP`/`UNGROUP` đều đi qua `ActionManager` để `Undo` được.
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - `PurgeService.purgeItems` gọi trực tiếp `.erase(true)` ngoài `ActionManager` khiến không thể `Undo`.

#### [BUG-56] [CRITICAL] Command: `PROPERTIES / SETTINGS` — Sửa Diameter / Circumference / MinorRadius trong bảng Properties rồi nhấn Undo (UpdateCurvePropsAction) làm Hình tròn co sập 50% (R = 50 -> 25) hoặc 2π lần; bảng Properties tính thiếu cạnh đóng của RECTANG (250 thay vì 300) và ép màu TrueColor 24-bit về ACI 8-bit
- **Steps tái hiện (Steps to Reproduce)**:
  1. Vẽ `CIRCLE` bán kính `R = 50` (`D = 100`). Trong bảng `Properties`, sửa `Diameter` thành `200` (`R = 100`), sau đó nhấn `Ctrl+Z` (`UNDO`).
  2. Vẽ `RECTANG` `100 x 50` (chu vi `300`) và xem mục `Length` trong bảng `Properties`.
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - Nhấn `Undo` đưa hình tròn về đúng bán kính gốc `R = 50`; `Length` của hình chữ nhật `100 x 50` hiển thị `300.0000`.
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - `UpdateCurvePropsAction` (`Module 39016`) lưu `oldRadius = 50` nhưng khi `Undo` lại truyền vào nhánh `diameter = 50` chia đôi thành `R = 25`! Trong `Module 85183`, vòng lặp tính `Length` của Polyline kín bỏ sót cạnh đóng cuối cùng nên hiện `250` thay vì `300`.

#### [BUG-57] [HIGH] Command: `MISSING AUTOCAD WEB CLI COMMANDS (QSAVE, PURGE, LIST, -STYLE, ARRAYEDIT, -FIND, SNAPMODE, GRIDMODE, LWDISPLAY, CHPROP, BR)` — 11 lệnh/alias dòng lệnh có thực trên AutoCAD Web thật (đã kiểm chứng trên web.autocad.com) nhưng báo 'Unsupported command' trên VinaCAD Web
- **Steps tái hiện (Steps to Reproduce)**:
  1. Gõ lần lượt trên dòng lệnh: `QSAVE`, `PURGE` (`PU`), `LIST`, `-STYLE`, `ARRAYEDIT`, `-FIND`, `SNAPMODE`, `GRIDMODE`, `GRIDMAJOR`, `LWDISPLAY`, `CHPROP`.
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - Đã kiểm chứng trực tiếp trên `web.autocad.com`: tất cả các lệnh/alias này đều hoạt động trên AutoCAD Web.
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - VinaCAD Web báo `Unsupported command` (ví dụ chỉ đăng ký `-PURGE` mà thiếu `PURGE`/`PU`, chỉ có `STYLE` mà thiếu `-STYLE`, thiếu `LIST`, `CHPROP`, `QSAVE`, `ARRAYEDIT`, `-FIND`, `SNAPMODE`, `GRIDMODE`, `LWDISPLAY`).

#### [BUG-58] [CRITICAL] Command: `SAVE / SAVEAS / AUTH / COLLAB / WASM MEMORY` — oneDriveStrategy.saveAs & dropboxStrategy.saveAs gọi thẳng this.save(e) ghi đè file gốc; lỗi tabId RAM làm /session/heartbeat tự khóa tài khoản bản quyền HTTP 403 khi F5; mở lại bản vẽ rò rỉ ~84 MB WASM do không gọi Database.delete()
- **Steps tái hiện (Steps to Reproduce)**:
  1. Mở file từ OneDrive/Dropbox và chọn `Save As`; hoặc nhấn `F5` reload trang khi đang đăng nhập tài khoản bản quyền; hoặc mở lại bản vẽ nặng nhiều lần.
- **Output mong muốn (Expected Output — Đã kiểm chứng trên AutoCAD Web `web.autocad.com`)**:
  - `Save As` tạo file mới không ghi đè file gốc; `F5` giữ nguyên `tabId` trong `sessionStorage` không bị lỗi 403; mở file mới gọi `oldDb.delete()`.
- **Output thực tế & Vị trí Code cần sửa (Actual Output on VinaCAD Web & Root Cause)**:
  - `oneDriveStrategy.saveAs` và `dropboxStrategy.saveAs` (`Module 45352`) gọi thẳng `return this.save(e)`; `tabId` lưu trong RAM làm `/session/heartbeat` trả về HTTP 403 khi F5; `drawingLoadService` không gọi `this.host.Database.delete()`.

---

## PHỤ LỤC A: CÁC LỆNH VINACAD WEB TỰ MỞ RỘNG (KHÔNG CÓ TRÊN AUTOCAD WEB `web.autocad.com` NHƯNG CÓ LỖI NỘI BỘ NẾU GIỮ LẠI TRên UI)

> Khi chạy kiểm chứng trực tiếp trên **AutoCAD Web (`web.autocad.com`)**, các lệnh dưới đây đều trả về `Unsupported command`. Tuy nhiên vì VinaCAD Web có đăng ký các lệnh này trong `CommandManager`, nếu công ty vẫn giữ các lệnh này cho người dùng thì cần lưu ý sửa các lỗi nội bộ sau:

1. **`DONUT`**: AutoCAD Web báo `Unsupported command "DONUT"`. Trên VinaCAD Web, `DonutCmd` đang tạo ra 2 thực thể `OdDbCircle` đồng tâm rời rạc thay vì 1 `OdDbPolyline` khép kín gồm 2 cung tròn có độ dày `constantWidth`.
2. **`REGION` & `BOUNDARY`**: AutoCAD Web báo `Unsupported command`. Trên VinaCAD Web, `CreateRegionAction.execute()` (`Module 39016`) chỉ lấy `a.get(0)` làm mất các miền Region từ vị trí thứ 2 trở đi.
3. **`3DPOLY`**: AutoCAD Web báo `Unsupported command`. Trên VinaCAD Web, `Create3dPolylineAction` (`Module 39016`) quên khởi tạo `this.undoAction`.
4. **`BEDIT` & `BCLOSE`**: AutoCAD Web báo `Unsupported command`. Trên VinaCAD Web, `BlockEditService` không cô lập riêng stack Undo và khi chọn `Discard` vẫn lưu một phần thay đổi.
5. **`TABLE`**: AutoCAD Web báo `Unsupported command`. Trên VinaCAD Web, `UpdateTablePropsAction` (`Module 84873`) làm mất nội dung chữ trong các ô bị cắt khi giảm số hàng/cột rồi nhấn `Undo`.
6. **`-IMAGE` & `XREF`**: AutoCAD Web báo `Unsupported command "-IMAGE"`. Trên VinaCAD Web, nút `Attach XREF...` (`Module 21696`) gắn hàm rỗng `() => {}` và `DeleteRasterImageAction` thiếu khôi phục `OdDbRasterImageDef` khi `Undo`.
7. **`TEXT` (Chữ đơn dòng)**: Trên AutoCAD Web, gõ `TEXT` sẽ gọi `TEXTEDIT` (AutoCAD Web chỉ tạo chữ bằng `MTEXT`). Trên VinaCAD Web, `_TextCmd` có hỗ trợ tạo `OdDbText` nhưng truyền `horizontalMode: null, verticalMode: null` cho 11/15 chế độ `Justify`.
8. **`ALLTEXTPROP`, `FINDINCLUDE`, `FINDMATCH`**: Các lệnh riêng của VinaCAD Web (`ALLTEXTPROP` bỏ qua `OdDbText` khi đổi chiều cao chữ; `FINDINCLUDE` in ngược thông báo bật/tắt).
9. **`LAYFRZ`, `ELEVATION`, `DYNMODE`, `CURSORSIZE`**: AutoCAD Web báo `Unsupported command`. Trên VinaCAD Web, `DatabaseVariable.set()` (`Module 39016`) viết sai chính tả `case "Evelation":` (thay vì `"Elevation"`), và `LAYFRZ` thiếu `break` trong `switch`.

---

## PHỤ LỤC B: CHECKLIST DỌN RÒ RỈ BỘ NHỚ C++ WASM (`.delete()`) & KHÓA `OpenMode.kForWrite`

1. **`drawingLoadService.loadDatabaseWithYield` (`Module 70850`)**: Gọi `this.host.Database.delete()` trước khi gán Database mới (chặn rò rỉ `~84 MB`/lần mở file).
2. **`FontManager` (`Module 2123`) & `LayerManager.extractLayerInfo` (`Module 50886`)**: Bổ sung `.delete()` cho các con trỏ `.cast()`, `OdString`, `OdDbObjectId`.
3. **`cad.databaseManager` & `cad.ucsManager` (`Module 70850`)**: Đổi `OpenMode.kForWrite` (`1`) sang `OpenMode.kForRead` (`0`) trong các hàm chỉ đọc (`getEntityXDataId`, `hasLayer`, `getBlockNames`, `getAllEntities`, `openAsType`) và sửa `getSortentsTable()` dùng `this.CadModule.OdDbBlockTableRecord.cast`.
4. **`DatabaseUtil.executeActionByCategory` (`/Plugins/tgl/index.js`)**: Bỏ từ khóa `return` sớm bên trong vòng lặp `for..of` để không làm rơi các thực thể từ vị trí thứ 2 trở đi.
5. **Class rác `BaCmd` (`commandName = ""` trong `/Plugins/tgl/index.js`)**: Xóa khỏi `CommandManager.pluginRegistry.commands`.
