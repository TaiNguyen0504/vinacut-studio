# VinaCAD Web — AI Video Director & Operator Playbook (Source-Verified)

> Tài liệu chuẩn hóa trích xuất trực tiếp từ source code `vinacad_web_fe` (`LeftSide.tsx`, `TopSide.tsx`, `HeaderBar.tsx`, `FooterBar.tsx`, `LayerProperties.tsx`, `PropInfor.tsx`, `Block.js`, `Xref.tsx`, `Traces.tsx`, `AddIn.tsx`, `RibbonGroup.tsx`, `LayoutManager.tsx`, `PlotModal.tsx`, `DimstyleModal.tsx`, `commandNames.ts`).
> AI Director **BẮT BUỘC** tuân thủ đúng tên panel, tên lệnh, vùng camera (`focus`) và quy tắc chống thao tác thừa dưới đây.

---

## 1. Kiến trúc Giao diện VinaCAD Web (1920 × 1080 Desktop)

### A. Thanh Công cụ Dọc Bên Trái (`LeftSide.tsx` — `x: 0..72`)
Danh sách các tab điều hướng bên trái (`left-icon.json`), tương ứng với state `window.store.getState().ui.structuralElement`:
1. **`Prop`** (EN: `Prop` | VI: `Thuộc tính`)
   - Hiển thị `<PropInfor />`: Phần trên là `Drawing Properties` (khi chưa chọn đối tượng) hoặc `Object Properties` (khi đã chọn đối tượng trên bản vẽ: Color, Layer, Linetype, Lineweight, Geometry); phần dưới là `Model Properties` / `Layout Properties`.
   - **QUY TẮC QUAN TRỌNG**: Khi vừa mở bản vẽ trên Desktop, tab `Prop` **ĐÃ ĐƯỢC MỞ SẴN MẶC ĐỊNH** (`structuralElement === "Prop"`). Nếu click lại vào icon `Prop` khi nó đang mở, bảng sẽ bị đóng lại!
2. **`Layers`** (EN: `Layers` | VI: `Lớp`)
   - Hiển thị `<LayerProperties />`:
     - Phần trên (`LayerList.tsx`): Ô tìm kiếm (`Search`), nút `+` tạo Layer mới, và danh sách các lớp (`0`, `A-DIMS`, `A-DOORS`, `A-FURNITURE`, `A-NOTES`, `A-WALLS`, `A-WINDOWS`, `TEMP-EMPTY`).
     - Trên mỗi dòng Layer có 3 nút bên phải:
       - `buttons[0]`: Bật/tắt hiển thị (`isOff` — icon con mắt).
       - `buttons[1]`: Khóa/mở khóa (`isLocked` — icon ổ khóa).
       - `buttons[2]`: Ô màu (`color swatch`) -> Click mở bảng `<ColorPicker />` (`.z-[9999]`) có ô nhập mã `HEX` (`#FFB347`, v.v.).
     - Thao tác trên tên Layer:
       - **Click đơn**: Chọn Layer và hiển thị chi tiết ở khung `Layer Properties` bên dưới (`LayerDetails.tsx`).
       - **Double-click (`dblclick`)**: Mở ô input inline (`input[maxlength="50"]`) để đổi tên Layer, nhấn `Enter` để lưu.
       - **Right-click (`contextmenu`)**: Mở menu ngữ cảnh (`LayerMenu.tsx`) gồm `Rename` (`Đổi tên`) và `Delete` (`Xóa`). Lưu ý: Không thể xóa Layer `0`, Layer hiện hành (`currentLayer`) hoặc Layer đang chứa đối tượng; chỉ xóa được Layer trống như `TEMP-EMPTY`.
3. **`Blocks`** (EN: `Blocks` | VI: `Khối`)
   - Hiển thị `<Blocks />` với 4 tab con: `CurrentDrawing` (Bản vẽ hiện tại), `RecentBlocks` (Gần đây), `FavoriteBlocks` (Yêu thích), `BlocksLibraries` (Thư viện). Có nút `+` tạo Block (`-BLOCK`).
4. **`XREF`** (EN: `XREF` | VI: `XREF`)
   - Hiển thị `<Xref />` (`External References`): Cây quản lý file tham chiếu ngoài (`XrefTree`) ở trên và chi tiết `XrefDetails` ở dưới. Chuột phải vào Xref có: `Resolve Path`, `Reload`, `Unload`, `Detach`.
5. **`Traces`** (EN: `Traces` | VI: `Dấu vết`)
   - Hiển thị `<Traces />`: Quản lý vết đánh dấu cộng tác (`TraceList` & `TraceDetails`), nút `+` tạo Trace mới.
6. **`Activity`** (EN: `Activity` | VI: `Hoạt động`)
   - Hiển thị nhật ký hoạt động của bản vẽ.
7. **`AddIn`** (EN: `Add-Ins` | VI: `Add-In`)
   - Hiển thị `<AddIn />`: Quản lý các gói mở rộng LISP/JS Add-in và Template.

---

### B. Cụm Ribbon Công cụ CAD (`TopSideRibbonTabs.tsx` & `RibbonGroup.tsx`)
Khi mở bảng bên trái trên Desktop, cụm Ribbon (`450px × 190px`) nằm ở góc dưới bên trái (hoặc trên thanh Header nếu bật `preferences.ribbon`), gồm 3 nhóm:
1. **Tab `Draw` (VI: `Vẽ` | `drawing-ribbon`)**:
   - `RECTANGLE` (Hình chữ nhật), `CIRCLE` (Hình tròn), `ARC` (Cung tròn), `SPLINE` (Đường cong mềm), `XLINE` (Đường vô hạn), `LINE` (Đường thẳng), `3DORBIT` (Xoay 3D), `PLINE` (Đường đa tuyến), `-HATCH` (Tô vật liệu/Mặt cắt), `ARRAY` (Mảng), `DIVIDE` (Chia đều), `ELLIPSE` (Elip), `POLYGON` (Đa giác).
2. **Tab `Annotate` (VI: `Chú thích` | `annotate-ribbon`)**:
   - `MEASURE` (Đo lường khoảng cách/diện tích), `REVCLOUD` (Đám mây chỉnh sửa), `DIMENSION` (Ghi kích thước), `MTEXT` (Văn bản nhiều dòng), `MLEADER` (Ghi chú dẫn), `FIND` (Tìm kiếm & Thay thế văn bản), `ATTACH` (Đính kèm ảnh Raster).
3. **Tab `Modify` (VI: `Chỉnh sửa` | `modify-ribbon`)**:
   - `MOVE` (Di chuyển), `STRETCH` (Kéo giãn), `MIRROR` (Đối xứng), `FILLET` (Bo góc), `CHAMFER` (Vát góc), `COPY` (Sao chép), `TRIM` (Cắt xén), `ERASE` (Xóa), `ROTATE` (Xoay), `SCALE` (Tỷ lệ), `OFFSET` (Đồng dạng), `JOIN` (Nối), `MATCHPROP` (Sao chép thuộc tính), `EXTEND` (Kéo dài), `EXPLODE` (Phá khối), `BREAKATPOINT` (Ngắt tại điểm).

---

### C. Thanh Header Phía Trên (`TopSide.tsx` & `HeaderBar.tsx`)
- **Thanh TopSide (`y: 0..46`)**: Menu tệp (`New`, `Open`, `Save`, `Plot` / Xuất PDF, `Download` .dwg, `Share`, `Settings`), chuyển đổi ngôn ngữ (`EN` / `VI` / `JA`).
- **Thanh HeaderBar (`y: 46..103`)**:
  - Các nút thao tác nhanh: `UNDO` (Hoàn tác), `REDO` (Làm lại), `SAVE` (Lưu), `ZOOM EXTENTS` (Thu phóng toàn bản vẽ), `ZOOM WINDOW` (Phóng theo cửa sổ).
  - `<ColorOption />`: Hộp chọn màu nhanh cho đối tượng/layer đang hoạt động.

---

### D. Thanh Footer & Command Bar Phía Dưới (`FooterBar.tsx` — `y: 1040..1080`)
- **Trái (`LayoutManager.tsx`)**: Các tab không gian bản vẽ `Model`, `Layout1`, `Layout2` và nút `+` thêm Layout mới.
- **Giữa (`CommandInput.tsx`)**: Ô nhập lệnh CAD (`Type command here` / `Nhập lệnh tại đây`). Nhận mọi lệnh chuẩn trong `commandNames.ts` (`LINE`, `PLINE`, `RECTANGLE`, `CIRCLE`, `DIMLINEAR`, `DIMENSION`, `-HATCH`, `MEASURE`, `AREA`, `DIST`, `PLOT`, `DIMSTYLE`, `UNITS`, `REGEN`, `ZOOM`...).
- **Phải (`ToolButtonsSection.tsx`)**: Các nút bật/tắt chế độ vẽ chính xác:
  - `MODEL` / `PAPER` (`paperModelToggle`)
  - `GRID` (F7) / `SNAP` (F9) (`snapAndGrid`)
  - `OSNAP` (F3 — Bắt điểm Endpoint, Midpoint, Center, Intersection, Perpendicular...)
  - `OTRACK` (F11 — Theo dõi bắt điểm)
  - `ORTHO` (F8 — Chế độ trực giao vuông góc)
  - `POLAR` (F10 — Theo dõi cực)

---

## 2. Quy tắc Đạo diễn Camera 60 FPS (`focus`) & Chống Thao Tác Thừa

1. **Quy tắc chọn vùng Camera (`focus`)**:
   - Đặt `"focus": "full"` khi: Mở đầu video giới thiệu tổng quan bản vẽ, kiểm tra sự thay đổi màu sắc/hình học trên toàn mặt bằng, hoặc cảnh kết thúc.
   - Đặt `"focus": "left"` khi: Thao tác với các bảng bên trái (`Layers`, `Prop`, `Blocks`, `XREF`, `Traces`, `AddIn`) hoặc cụm Ribbon góc dưới trái (`Draw`, `Annotate`, `Modify`) để người xem thấy rõ chữ, ô màu và thao tác chuột.
   - Đặt `"focus": "center"` khi: Thực hiện lệnh vẽ, đo kích thước, chọn đối tượng trên vùng bản vẽ chính hoặc mở hộp thoại ở giữa màn hình (`PlotModal`, `DimstyleModal`).

2. **Quy tắc Chống Thao Tác Thừa (Zero Redundant Actions)**:
   - Không gọi `open_panel` lặp lại ở mọi cảnh nếu bảng đó đã mở sẵn ở cảnh trước.
   - Không tự bịa tên Layer hoặc tên nút không tồn tại. Trên bản vẽ mẫu `Sample_FloorPlan_ISO.dwg`, chỉ sử dụng đúng 8 lớp đã xác thực: `0`, `A-DIMS`, `A-DOORS`, `A-FURNITURE`, `A-NOTES`, `A-WALLS`, `A-WINDOWS`, `TEMP-EMPTY`.
   - Khi xóa Layer, chỉ xóa Layer trống (`TEMP-EMPTY`).
   - Mỗi video quảng cáo tính năng nên có **4 đến 5 phân cảnh (scenes)** mạch lạc:
     - **Cảnh 1 (`full`)**: Mở tính năng / bảng công cụ từ giao diện tổng thể.
     - **Cảnh 2 (`left` hoặc `center`)**: Thực hiện thao tác cốt lõi thứ nhất (VD: chọn & đổi tên Layer / chọn công cụ vẽ).
     - **Cảnh 3 (`left` hoặc `center`)**: Thực hiện thao tác cốt lõi thứ hai có phản hồi thị giác ngay lập tức (VD: đổi màu Layer sang `#FFB347` cập nhật trực tiếp lên bản vẽ).
     - **Cảnh 4 (`full`)**: Thu phóng về toàn cảnh để chứng minh hiệu quả trực quan trên mặt bằng CAD.
     - **Cảnh 5 (`left` hoặc `full`)**: Hoàn tất quy trình (VD: dọn Layer trống `TEMP-EMPTY`) và kết thúc sạch sẽ.

---

## 3. Danh mục Action Steps Chuẩn cho AI Operator

AI Director chỉ được phép sinh các `steps` nằm trong danh mục đã được engine `executeChoreographyStepOnTimeline` hỗ trợ:
- `{ "type": "open_panel", "target": "Layers" | "Prop" | "Blocks" | "XREF" | "Traces" | "Activity" | "AddIn" }`
- `{ "type": "select_layer", "layer": "A-WALLS" }`
- `{ "type": "rename_layer", "layer": "A-WALLS", "newName": "A-WALLS-MAIN" }`
- `{ "type": "color_layer", "layer": "A-WALLS-MAIN", "hex": "#FFB347" }`
- `{ "type": "toggle_layer_visibility", "layer": "A-FURNITURE" }`
- `{ "type": "toggle_layer_lock", "layer": "A-DIMS" }`
- `{ "type": "delete_layer", "layer": "TEMP-EMPTY" }`
- `{ "type": "switch_ribbon_tab", "tab": "Draw" | "Annotate" | "Modify" }`
- `{ "type": "click_ribbon_tool", "command": "RECTANGLE" | "CIRCLE" | "LINE" | "DIMENSION" | "MEASURE" | "MOVE" | "COPY" | "OFFSET" | "ZOOM EXTENTS" }`
- `{ "type": "open_modal", "modal": "PLOT" | "DIMSTYLE" | "SETTING" }`
- `{ "type": "switch_layout", "layout": "Model" | "Layout1" | "Layout2" }`
- `{ "type": "toggle_status_bar", "item": "GRID" | "ORTHO" | "OSNAP" | "POLAR" }`
- `{ "type": "cad_command", "command": "ZOOM" | "REGEN" | "DIMLINEAR" }`
- `{ "type": "hover_canvas", "xRatio": 0.55, "yRatio": 0.48 }`
- `{ "type": "click_canvas", "xRatio": 0.55, "yRatio": 0.48 }`
- `{ "type": "click_text", "text": "..." }`
- `{ "type": "wait", "ms": 1200 }`
