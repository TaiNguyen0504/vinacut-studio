# VinaCAD agent bug list — verification matrix

Ngày kiểm tra: 2026-10-31  
Oracle: AutoCAD Web trên cùng `260707_test-hieu-nang-bat-diem.dwg` (1.69 MB), cộng tài liệu Autodesk chính thức.

## Đếm số lượng

File nguồn tự ghi **102 claim (`BUG-01`–`BUG-102`)**. Tuy nhiên tài liệu không nhất quán: phần mô tả chi tiết dùng heading đến `BUG-86`, còn `BUG-87`–`BUG-102` chủ yếu xuất hiện trong bảng tổng hợp nhanh. Vì vậy tôi không coi 102 claim đó là 102 bug đã được xác nhận.

Kết quả đối chiếu claim-by-claim trong lượt này:

- **2/102 claim được xác nhận trực tiếp đủ mạnh:** `BUG-12` (ViewCube/UCS/hướng nhìn) và một phần hành vi Plot/Layout thuộc nhóm `BUG-82`.
- **3 hành vi VinaCAD tái hiện được nhưng không khớp 1:1 với một claim đánh số:** XREF không mở chooser, UNDO mặc định tạo command giả, HATCH không kết thúc bằng Enter. Chúng có thể liên quan các nhóm `BUG-43`, `BUG-71`, `BUG-82`, `BUG-86`, nhưng chưa đủ để gắn chắc vào đúng mã.
- **Một số claim đã bị phản chứng hoặc được xác định là khác phạm vi:** `BUG-01`, `BUG-02`, `BUG-09`; Layout viewport trắng và `PURGE`/`-PURGE` có hành vi tương đương AutoCAD Web; BEDIT không phải command oracle của AutoCAD Web.
- **Các claim còn lại chưa được xác minh độc lập bằng fixture và flow tương ứng.** Không nên chuyển toàn bộ 102 dòng cho dev dưới nhãn “đã tái hiện”.

## Disposition

| Claim | Trạng thái | Căn cứ |
|---|---|---|
| BUG-01 OSNAP/F3 không tắt trong SELECT | **Không tái hiện** | Nút `BẮT ĐT` và F3 đều chuyển ON/OFF được trong VinaCAD. |
| BUG-02 Center Osnap hỏng | **Chưa xác nhận** | Vòng Osnap trước đó đã thấy marker Tâm; AutoCAD bắt mép vòng tròn về đúng tâm. Fixture mới VinaCAD không đủ sạch để kết luận tọa độ. |
| BUG-03 Insertion block mới | **Chưa kiểm chứng lại** | Chưa có block fixture độc lập với insertion point định vị được. |
| BUG-04 Extension/Parallel | **Không thấy lỗi trong vòng Osnap trước** | Extension/Parallel đã có marker/tracking trong test riêng; chưa có repro khác với AutoCAD. |
| BUG-05 Apparent intersection | **Chưa xác nhận** | Fixture giao của đường kéo dài chưa ổn định. |
| BUG-06 Nearest làm mất Parallel | **Chưa xác nhận** | Chưa có repro tọa độ sạch. |
| BUG-07/08 XZ và block scale | **Chưa xác nhận** | Cần fixture 3D/block riêng; không suy luận từ DWG này. |
| BUG-09 OTRACK dummy | **Không tái hiện** | Endpoint + `TH.DÕI BẮT` đã sinh tracking line/dynamic angle. |
| BUG-10 F2–F11 | **Chưa xác nhận đầy đủ** | F3 pass; F2/F4–F11 chưa có test độc lập đủ bằng chứng. |
| BUG-11 SNAP/GRID | **Chưa xác nhận** | F7/F9 và UI đã đổi state; chưa so sánh sai số tọa độ trên lưới. |
| BUG-12 XZ/ViewCube/UCS | **Có dấu hiệu lỗi VinaCAD** | VinaCAD từng hiển thị hướng view và ViewCube không đồng nhất; cần fixture XZ tối giản để chốt repro. |
| BUG-13/14/15/16/17 | **Chưa xác nhận** | Chưa đủ fixture block/bulge/hatch/polar độc lập. |
| BUG-18/19/20 | **Chưa xác nhận** | Không báo lỗi chỉ dựa trên claim/source. |
| BUG-21/22 ghost Osnap | **Chưa xác nhận** | Cần layer freeze/off và chuyển Model/Layout trong cùng một fixture. |
| BUG-23/24/25 viewport/MSPACE | **Không phải lỗi riêng của DWG này** | Layout1/2 của VinaCAD và AutoCAD Web đều hiện giấy Letter + viewport trắng. |
| BUG-26–35 properties/layer/edit | **Chưa xác nhận lại theo từng claim** | Một số flow cơ bản pass; chưa có repro parity với AutoCAD. |
| BUG-36–40 WASM/font/layer leak/freeze | **Có rủi ro hiệu năng, chưa kết luận leak** | Heap/node/listener stress có transient pressure; cần profile sạch + heap snapshot. |
| BUG-41/42 UCS/Ortho/Polar | **Chưa xác nhận** | Chưa có fixture UCS 45° độc lập. |
| BUG-43 ERASE/UNDO | **UNDO là lỗi đã xác nhận trước đó** | VinaCAD default `UNDO <1>` cho unsupported `1`/ `[OBJECT OBJECT]`; ERASE persistence cần test lại. |
| BUG-44–66 command geometry | **Phần lớn chưa xác nhận theo từng claim** | Chỉ giữ các bug đã có repro cụ thể trong report chính. |
| BUG-67–70 auth/license/localStorage | **Chưa báo cáo như bug** | Không thực hiện bypass/security exploit; chưa có bằng chứng hành vi user-facing. |
| BUG-71 PURGE bypass | **Không tái hiện khác AutoCAD Web** | VinaCAD và AutoCAD Web đều chuyển `PURGE` vào prompt `-PURGE`. Undo/Save sau purge vẫn cần test persistence. |
| BUG-72–73 BLOCK/BEDIT | **BEDIT là khác biệt phạm vi** | AutoCAD Web trả Unsupported BEDIT; Autodesk mô tả BEDIT là Block Editor desktop. Không dùng AutoCAD Web làm oracle cho tính năng này. |
| BUG-74 collaboration/Firebase security | **Chưa xác nhận** | Cần test bảo mật có ủy quyền và môi trường riêng; không suy luận từ DOM/source claim. |
| BUG-75 INSERT | **Chưa xác nhận** | Cần block fixture và kiểm tra insertion/scale/rotation độc lập. |
| BUG-87–102 command sub-options | **Chưa xác nhận** | Các claim này nằm chủ yếu trong bảng tổng hợp nhanh; chưa chạy lại từng nhánh Enter/Keyword/Cancel trên cùng fixture và chưa đối chiếu từng kết quả với AutoCAD Web. |
| Layout Plot | **Xác nhận P1** | VinaCAD Layout1 và Layout2 giữ file UUID `.tmp` 4,093 bytes, PDF trắng, không có final download; AutoCAD Web mở dialog Plot có tên PDF và nút Plot/Cancel. |
| Command gaps | **Phân loại theo scope** | VinaCAD reject nhiều command. Chỉ coi là bug khi command nằm trong scope/UI quảng bá; nhiều command cũng không có trong danh sách command AutoCAD Web. |

## Command parity đã đo

- VinaCAD trả `Unsupported command`: `RAY`, `BHATCH`, `GRADIENT`, `DONUT`, `WIPEOUT`, `LEADER`, `DIMANGULAR`, `DIMRADIUS`, `DIMDIAMETER`, `TABLE`, `ARRAYRECT`, `ARRAYPOLAR`, `DELETE`, `LENGTHEN`, `ID`, `LIST`, `OVERKILL`.
- AutoCAD Web trong cùng session: `ID` mở prompt `Specify point`; `DELETE` ánh xạ sang `ERASE`; `BEDIT` trả Unsupported; `PURGE`/ `-PURGE` mở cùng prompt command-line. Một số alias cần dùng đúng tên Autodesk (`SHOWMAT`/LIST) trước khi kết luận.
- Autodesk command list: <https://help.autodesk.com/cloudhelp/ENU/AutoCAD-Web-Help/files/AutoCAD_Web_Help_List_Commands_html.html>

## RAM / hiệu năng

Renderer baseline sau cùng DWG:

- VinaCAD: 57.9 MB heap dùng, 68.7 MB cấp phát, 2,047 DOM nodes, 1,318 listeners.
- AutoCAD Web: 95.9 MB heap dùng, 102.5 MB cấp phát, 5,348 nodes, 1,597 listeners.

Sau 8 vòng chuyển Layout1/Layout2 (nghỉ 0.7 giây):

- VinaCAD peak: 62.6 / 94.0 MB, 10,391 nodes, 4,823 listeners; sau 10 giây: 58.1 / 94.0 MB, 6,207 nodes, 3,063 listeners.
- AutoCAD peak: 151.5 / 210.3 MB, 5,373 nodes, 1,663 listeners; sau 10 giây: 87.6 / 94.5 MB, 5,372 nodes, 1,545 listeners.

Đây là renderer metrics, không phải Private Working Set toàn bộ Chrome. Kết quả VinaCAD cho thấy cần profiling giữ node/listener sau 50–100 vòng Layout trên profile sạch; chưa đủ để gọi memory leak.

## Tài liệu phạm vi

- Plot to PDF: <https://help.autodesk.com/view/ACADWEB/ENU/?caas=caas/sfdcarticles/sfdcarticles/How-to-export-a-drawing-to-PDF-in-AutoCAD-Web-Application.html>
- PURGE Activity Insights: <https://help.autodesk.com/cloudhelp/ENU/AutoCAD-Web-Help/files/File-Management/AutoCAD_Web_Help_File_Management_activity_insights_html.html>
- BEDIT desktop Block Editor: <https://help.autodesk.com/cloudhelp/2025/ENG/AutoCAD-Core/files/GUID-D57D4195-72FC-4FA5-B9F4-E021291D808C.htm>



## Ma trận command mở rộng 2026-10-31

Đã smoke-probe 99 command identifier (97 command/alias người dùng yêu cầu, cộng SPLINE và LIST để kiểm tra alias) trên cùng phiên Chrome và so sánh command prompt với AutoCAD Web. Ma trận đầy đủ, prompt observed và phân loại scope nằm ở [VinaCAD-Command-Matrix-2026-10-31.md](C:/Users/taing/Desktop/Video-MKT/VinaCAD-Command-Matrix-2026-10-31.md).

Các khác biệt command-level cần dev xem xét:

- VC-01 DELETE: VinaCAD trả Unsupported; AutoCAD Web nhận DELETE và ánh xạ ERASE.
- VC-02 ARRAYEDIT: VinaCAD trả Unsupported; AutoCAD Web nhận ARRAYEDIT.
- VC-03 QSAVE: VinaCAD trả Unsupported; AutoCAD Web nhận QSAVE.
- VC-04 -STYLE: VinaCAD trả Unsupported; AutoCAD Web nhận -STYLE.
- VC-05 ID: VinaCAD trả Unsupported; AutoCAD Web mở Specify point.

Đây là candidate gap khi command nằm trong scope sản phẩm; các command desktop/UI-only như BEDIT, LAYER, PROPERTIES, SETTING, INSERT, ATTACH và reference panel không được kết luận là lỗi chỉ vì direct command khác AutoCAD Web. LIST/LI cũng chưa được coi là lỗi cross-product: VinaCAD giải LI thành LINE còn AutoCAD Web không có flow LIST ổn định.

Heap/DOM sau lượt command hiện tại: VinaCAD 62.98 MB used / 86.14 MB total, 1,255 nodes, 2 canvas; AutoCAD Web 103.91 MB used / 110.56 MB total, 6,834 nodes, 17 canvas. Đây là renderer metrics, bổ sung cho stress Layout trước đó và chưa đủ gọi memory leak.


## Deep option retest wave 2026-11-01

BUG-87–BUG-125 were split into a command/option replay matrix. Browser control became unresponsive before this wave could execute direct replay; see [VinaCAD-New-Bug-Retest-2026-11-01.md](VinaCAD-New-Bug-Retest-2026-11-01.md). Existing independent evidence remains separate from source-only claims.

## Count reconciliation for 2026-11-01

The master source report contains 125 headings exactly once. The earlier independent VinaCAD-versus-AutoCAD replay had 2/102 source claims directly confirmed (`BUG-12` and a `BUG-82` Plot/Layout subset), plus three reproduced behaviors whose source IDs were not one-to-one (XREF chooser, HATCH Enter, UNDO default). This wave adds no fresh UI replay because Chrome control stopped responding. Existing Phase 7/8 runtime artifacts contain probe outputs for 16 IDs in BUG-87–BUG-102 and positive/partial probes for BUG-103–BUG-125 as described in the companion report; these are not counted as fresh independent confirmations.
