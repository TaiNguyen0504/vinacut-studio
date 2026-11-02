# VinaCAD / AutoCAD Web command matrix — 2026-10-31

## Phạm vi và phương pháp

Đã smoke-probe 99 command identifier trong cùng phiên Chrome: 97 command/alias người dùng yêu cầu, cộng SPLINE và LIST để kiểm tra alias. Mỗi lệnh được đưa về command prompt bằng Escape, nhập trực tiếp, Enter, đọc prompt/modal/Unsupported rồi đóng prompt. Đây là command-level parity matrix; flow hình học đầy đủ, Osnap lồng nhau, Layout Plot, HATCH Enter, XREF chooser, UNDO default và stress RAM nằm trong báo cáo E2E.

## Ma trận theo nhóm

| Nhóm | Command | VinaCAD | AutoCAD Web | Kết luận |
|---|---|---|---|---|
| Vẽ | LINE, PLINE, POINT, ARC, CIRCLE, ELLIPSE, RECTANGLE, POLYGON, XLINE, SPLINE | Đều mở prompt tương ứng; CIRCLE có 3P/2P/Ttr, XLINE có H/V/A/B/O | Đều nhận command/prompt tương ứng | Smoke pass |
| Sửa | MOVE, COPY, OFFSET, MIRROR, STRETCH, SCALE, ROTATE, TRIM, EXTEND, FILLET, CHAMFER, ALIGN, ARRAY, JOIN, PEDIT, EXPLODE, ERASE, MATCHPROP | Đều mở prompt chọn object/option | Đều nhận command | Smoke pass |
| Sửa | GRIP_STRETCH | Unsupported | Unsupported | Command nội bộ, không phải gap riêng |
| Sửa | DELETE | Unsupported command DELETE | DELETE ánh xạ ERASE | Candidate VC-01 nếu Delete nằm trong scope |
| Sửa | ARRAYEDIT | Unsupported command ARRAYEDIT | Nhận ARRAYEDIT | Candidate VC-02; cần kiểm Array UI có thay thế đủ hay không |
| Block/reference | BLOCK, -BLOCK | BLOCK chuyển vào flow -BLOCK; -BLOCK prompt tên block | BLOCK/UI có sẵn; prompt -BLOCK không ổn định | Cần fixture tạo block để kết luận |
| Block/reference | BEDIT | Mở chooser <Bản vẽ hiện tại>, ArchTick, DetailCallout | Unsupported | Khác phạm vi; BEDIT là Block Editor desktop |
| Block/reference | BCLOSE | Nhận command | Không có prompt ổn định | Scope/không kết luận |
| Block/reference | INSERT, ATTACH, REFERENCE | Nhận command hoặc file flow | INSERT/ATTACH/REFERENCE direct bị Unsupported hoặc không có prompt ổn định | Có thể là UI-only AutoCAD Web; không coi là lỗi VC nếu UI đáp ứng |
| Block/reference | XREF, EXTERNALREFERENCES | Nhận command; XREF không mở chooser trong flow trước | Không có prompt XREF ổn định | Bug XREF chooser đã tái hiện trong báo cáo chính |
| Layer/setting | LAYER, PROPERTIES, SETTING, OSNAP, DIMSTYLE | Mở panel/dialog tương ứng; OSNAP liệt kê modes | Direct command có lệnh không hỗ trợ nhưng UI panel/checkbox tương ứng | UI-only khác command line; nested Osnap đã test riêng |
| Layer/setting | LAYMCUR, UNITS, ORTHO | Prompt/toggle tương ứng | Nhận prompt/toggle | Smoke pass |
| Text/annotation | TEXT, TEXTEDIT, MTEXT, MLEADER, REVCLOUD | Nhận prompt; MTEXT góc đầu, MLEADER mũi tên | Nhận command/UI; một số prompt không ổn định do modal | Cần fixture annotation cho kết luận hình học |
| Text/annotation | DIMENSION, DIMLINEAR | Nhận prompt gốc đường kéo | Unsupported direct | VinaCAD có superset direct |
| Text/annotation | HATCH | Chuyển thành -HATCH; Enter không kết thúc đúng trong flow trước | HATCH/UI nhận command | Bug HATCH Enter đã tái hiện |
| Text/annotation | -HATCH | Prompt point/property/select boundary/delete/draw order/origin/color/layer/transparency | Không có prompt ổn định | VinaCAD có command-line flow |
| Text/annotation | ALLTEXTPROP | Nhận command nhưng prompt không ổn định | Unsupported | Cần xác nhận scope tính năng |
| View/display | ZOOM, PAN, 3DORBIT, VIEW, -VIEW, -VISUALSTYLE, CLEANSCREENON | Đều nhận command; VIEW mở danh sách hướng nhìn | ZOOM/PAN/-VIEW/-VISUALSTYLES/CLEANSCREENON nhận; 3DORBIT/VIEW UI state không ổn định | Smoke pass, riêng ViewCube mismatch đã có bug report |
| View/display | ZOOM WINDOW | VinaCAD nhận W và hỏi góc đầu; AutoCAD prompt base có Window nhưng lượt option riêng không ổn định | Cần lặp lại profile sạch để kết luận option |
| View/display | REGEN, REGENALL | Nhận command/silent | REGEN direct Unsupported; REGENALL không có prompt ổn định | VinaCAD có superset direct |
| File/system | SAVE | File saved in browser draft | Nhận SAVE | Smoke pass |
| File/system | SAVEAS | Mở dialog Lưu tệp | UI Save/Save As | Smoke pass UI |
| File/system | PLOT | Nhận command; Model Plot từng tạo PDF | Nhận command/dialog Plot | P1 Layout Plot đã tái hiện: VinaCAD Layout1/2 không tạo final PDF |
| File/system | JSLOAD | Nhận command/flow | Không có prompt ổn định | Cần fixture JS an toàn |
| Measure/search | SELECT | Prompt góc đối diện | Một lượt bị rơi vào TEXTGAPSELECTION do trạng thái command | Ambiguous, cần profile sạch |
| Measure/search | FIND, FINDMATCH | Prompt nội dung và option Case/Whole/Wildcard/Diacritics/Width/Exit | Nhận FIND/FINDMATCH và prompt text find | Smoke pass |
| Measure/search | FINDINCLUDE | Prompt Block/Block Attribute/Xref/Text/Table/DimLeader/Hidden/Exit | Không có prompt ổn định | Không kết luận gap |
| Measure/search | AREA, MEASURE | Prompt Object/Add/Subtract và Distance/Angle/Area/Exit | AREA direct Unsupported; MEASURE không có prompt ổn định | VinaCAD có superset direct |
| Measure/search | DIST | Prompt điểm đầu | Specify point | Smoke pass |
| History | UNDO | Prompt số thao tác <1>; Enter mặc định gửi 1 thành command không hợp lệ trong flow trước | Direct command Unsupported trong phiên; UI Undo có sẵn | Bug UNDO default VinaCAD đã tái hiện |
| History | REDO | Prompt số thao tác <1> | Không có prompt direct ổn định | Cần test UI/fixture sạch |
| Bổ sung | QSAVE | Unsupported command QSAVE | Nhận QSAVE: | Candidate VC-03 nếu command plan yêu cầu |
| Bổ sung | PU, -PU, PURGE | PU/-PU/PURGE đều chuyển thành -PURGE với danh sách loại object | PURGE/-PURGE mở cùng prompt | Tương thích, không phải bug |
| Bổ sung | CONVERTPSTYLES | Unsupported | Unsupported | Không phải gap |
| Bổ sung | LAYOUT | Prompt copy/delete/new/rename/set | UI tabs/layout; prompt direct không ổn định | Flow Layout đã test riêng |
| Bổ sung | -FIND | Unsupported | Không có prompt ổn định | Không kết luận gap |
| Bổ sung | DYNMODE | Prompt giá trị <3> | Unsupported direct | VinaCAD có superset direct |
| Bổ sung | SNAPMODE, GRIDMODE, GRIDMAJOR | Unsupported | Unsupported hoặc không có prompt | Không phải gap đã chứng minh |
| Bổ sung | LI, LIST | LI của VinaCAD bị giải thành LINE; LIST Unsupported | LIST không có flow ổn định | Alias cần tài liệu hóa; chưa coi là bug cross-product |
| Bổ sung | -STYLE | Unsupported command -STYLE | Nhận -STYLE | Candidate VC-04 nếu command plan yêu cầu |
| Bổ sung | LWDISPLAY | Unsupported | Không có prompt ổn định | Không kết luận gap |
| Bổ sung | ID | Unsupported command ID | Prompt Specify point | Candidate VC-05 |
| Bổ sung | BR, BREAK, BREAKATPOINT | BR/BREAK chuyển thành BREAKATPOINT; prompt chọn object | BREAK nhận command; BREAKATPOINT không có prompt ổn định | Khác phạm vi; cần fixture 2-point để xem thiếu option |

## Candidate bug command-level

1. VC-01 — DELETE alias gap (P2/P3): VinaCAD Unsupported DELETE; AutoCAD Web nhận DELETE và ánh xạ ERASE. Nếu Delete nằm trong UI/command plan, thêm alias DELETE → ERASE hoặc thông báo nhất quán.
2. VC-02 — ARRAYEDIT gap (P2): VinaCAD Unsupported; AutoCAD Web nhận ARRAYEDIT. Kiểm tra Array UI có đủ edit rectangular/path/polar hay chưa.
3. VC-03 — QSAVE gap (P2): VinaCAD Unsupported; AutoCAD Web nhận QSAVE:. VinaCAD có SAVE UI, nên alias về draft save cần được xem xét nếu QSAVE nằm trong scope.
4. VC-04 — -STYLE gap (P2): VinaCAD Unsupported; AutoCAD Web nhận -STYLE. Kiểm tra style UI/command-line trước khi đóng issue.
5. VC-05 — ID gap (P2): VinaCAD Unsupported; AutoCAD Web mở Specify point. Bổ sung identify tọa độ nếu command nằm trong scope.

Các candidate trên là khác biệt command-level đã tái hiện, chưa thay thế acceptance criteria của UI tương ứng. Các lỗi P1 đã có bằng chứng riêng: Layout Plot, XREF chooser, HATCH Enter, UNDO default.

## RAM/hiệu năng sau lượt test

Chrome DevTools hiện tại sau ma trận command: VinaCAD khoảng 62.98 MB heap dùng, 86.14 MB heap cấp phát, 1,255 DOM nodes, 2 canvas; AutoCAD Web khoảng 103.91 MB heap dùng, 110.56 MB heap cấp phát, 6,834 DOM nodes, 17 canvas. Đây là renderer metrics, không phải Private Working Set toàn Chrome. Số hiện tại bị ảnh hưởng bởi lịch sử modal/panel trong phiên; dùng cùng với stress Layout sạch trước đó (VinaCAD peak 62.6/94.0 MB, AutoCAD peak 151.5/210.3 MB; VinaCAD còn nhiều node/listener sau idle) để lập kế hoạch profile 50–100 vòng Layout trên profile sạch.

## Oracle

- Autodesk command list: https://help.autodesk.com/cloudhelp/ENU/AutoCAD-Web-Help/files/AutoCAD_Web_Help_List_Commands_html.html
- Plot to PDF: https://help.autodesk.com/view/ACADWEB/ENU/?caas=caas/sfdcarticles/sfdcarticles/How-to-export-a-drawing-to-PDF-in-AutoCAD-Web-Application.html
- BEDIT desktop Block Editor: https://help.autodesk.com/cloudhelp/2025/ENG/AutoCAD-Core/files/GUID-D57D4195-72FC-4FA5-B9F4-E021291D808C.htm



## Evidence snippets for the five candidate gaps

- DELETE: VinaCAD DOM showed Unsupported command "DELETE"; AutoCAD Web DOM showed Command: ERASE after entering DELETE.
- ARRAYEDIT: VinaCAD DOM showed Unsupported command "ARRAYEDIT"; AutoCAD Web DOM showed Command: ARRAYEDIT.
- QSAVE: VinaCAD DOM showed Unsupported command "QSAVE"; AutoCAD Web DOM showed Command: QSAVE and Command: QSAVE:.
- -STYLE: VinaCAD DOM showed Unsupported command "-STYLE"; AutoCAD Web DOM showed Command: -STYLE.
- ID: VinaCAD DOM showed Unsupported command "ID"; AutoCAD Web DOM showed Command: ID followed by Specify point:.
- PURGE parity: VinaCAD showed -PURGE plus the full type list; AutoCAD Web showed Command: PURGE, Command: -PURGE, and Enter type of unused objects to purge.

