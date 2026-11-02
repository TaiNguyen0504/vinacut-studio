# VinaCut Studio

Studio tự động hóa quay và dựng video marketing 4K 60fps trên **VinaCAD Web** (`https://web.vina-cad.com/vi`) bằng AI.

## 1. Tải bản cài đặt sẵn (Dành cho Team MKT — không cần cài code)

Nếu chỉ cần cài đặt và sử dụng ngay trên Windows:
- Tải file **`VinaCut-Studio-0.1.0-Setup.exe`** tại mục **[Releases](https://github.com/TaiNguyen0504/vinacut-studio/releases/latest)** của repository này.
- Chạy file `.exe` để cài đặt tự động và mở ứng dụng **VinaCut Studio**.
- *(Lưu ý: Lần đầu mở trên máy mới, nếu Windows SmartScreen hiện bảng xanh "Windows protected your PC", bấm **More info** -> **Run anyway**).*

---

## 2. Hướng dẫn Clone và Build từ mã nguồn (Dành cho Developer)

Yêu cầu: **Node.js >= 20 LTS** trên Windows 10/11 (64-bit).

```powershell
# Bước 1: Clone mã nguồn về máy
git clone https://github.com/TaiNguyen0504/vinacut-studio.git
cd vinacut-studio

# Bước 2: Cài đặt thư viện (Electron, React, Vite, FFmpeg-static...)
npm install

# Bước 3A: Chạy thử ở chế độ phát triển (Dev mode)
npm run dev

# Bước 3B: Đóng gói ra bộ cài đặt Windows (.exe)
npm run dist
```

Sau khi lệnh `npm run dist` hoàn tất, các bản build sẽ nằm trong thư mục `dist/`:
- `dist\VinaCut-Studio-0.1.0-Setup.exe` — Bộ cài đặt 1-click chuẩn NSIS để gửi cho người dùng.
- `dist\win-unpacked\VinaCut Studio.exe` — Bản portable chạy trực tiếp không cần cài đặt.

### Kiểm tra nhanh bản đã đóng gói (Smoke Test)
```powershell
.\dist\win-unpacked\VinaCut Studio.exe --smoke-test
```

---

## 3. Tính năng nổi bật

- **Tự động hóa VinaCAD Web thật 100%:** Mở `https://web.vina-cad.com/vi` ở chế độ 4K ngầm, nạp bản vẽ `.dwg` (hoặc bản vẽ mặt bằng mẫu tích hợp sẵn), đọc cấu trúc Layer / vùng trống (`OPEN_AREAS`) / tọa độ thực tế và gửi cho AI lập kịch bản.
- **10 lệnh CAD đã kiểm chứng hậu điều kiện kép (Hình học + Điểm ảnh):**
  - Nhóm tạo hình: `LINE`, `PLINE`, `RECTANG`, `CIRCLE`, `MTEXT` (tự động tạo layer nổi bật `VINACUT-DEMO` màu cam `#FFB347` khi kịch bản không chỉ định layer).
  - Nhóm chỉnh sửa: `MOVE`, `COPY`, `ROTATE`, `OFFSET`, `ERASE`.
  - Mọi thao tác đều kiểm tra hậu điều kiện trong database ODA WASM và đo biến thiên pixel thực tế trên canvas trước/sau lệnh, kèm kiểm tra trạng thái sạch (`assertCleanState`).
- **Hỗ trợ đa nhà cung cấp AI:**
  - `Google Gemini` (`gemini-3.8-flash`, `gemini-4-argon`...)
  - `OpenAI` (`gpt-6.1-sol`, `gpt-5.5`...)
  - `Anthropic` (`claude-sonnet-5-5`, `claude-opus-5-5`...)
  - `Custom (OpenAI-compatible)` — Tương thích trực tiếp với các cổng proxy như `https://api.kingofapi.store/v1`.
- **Dựng video 4K 60fps tốc độ cao:** Tự động chọn encoder phần cứng (`h264_nvenc`, `h264_qsv`, `h264_amf`) hoặc fallback an toàn sang `libx264` với số luồng tối ưu theo CPU và RAM trống.
