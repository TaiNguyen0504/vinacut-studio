# -*- coding: utf-8 -*-
"""
Codex / ChatGPT Desktop 24/7 Watcher (Auto-Retry & Continue)
Giám sát 3 cuộc trò chuyện trong ứng dụng ChatGPT / Codex Desktop:
  1. Định nghĩa use case web bán...
  2. Kiểm thử chuyên sâu Osnap
  3. Chọn tool web hay app cho ma...

Khi phát hiện cuộc trò chuyện nào có dấu chấm than đỏ (!) ở sidebar
hoặc đang hiển thị nút Retry / Continue ở dưới, script sẽ tự động:
  - Click vào cuộc trò chuyện có chấm than đỏ
  - Ấn nút Retry / Continue / Tiếp tục
  - Lặp lại liên tục 24/24
"""

import argparse
import ctypes
from ctypes import wintypes
import datetime
import os
import sys
import time
import unicodedata

# Đảm bảo console Windows in tiếng Việt (UTF-8) không bị lỗi UnicodeEncodeError (cp1252)
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

import cv2
import numpy as np
from PIL import ImageGrab

try:
    import uiautomation as auto
    HAS_UIA = True
except Exception:
    HAS_UIA = False


# Bật DPI Awareness để tọa độ chụp màn hình và click chuột khớp 100% pixel thật
def enable_dpi_awareness():
    try:
        ctypes.windll.shcore.SetProcessDpiAwareness(2)
    except Exception:
        try:
            ctypes.windll.user32.SetProcessDPIAware()
        except Exception:
            pass


enable_dpi_awareness()

user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32

SW_RESTORE = 9
PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
MOUSEEVENTF_LEFTDOWN = 0x0002
MOUSEEVENTF_LEFTUP = 0x0004

TARGET_CHATS = [
    {
        "id": "chat1",
        "name": "Định nghĩa use case web bán...",
        "keywords": ["định nghĩa use case", "web bán"],
        "template_file": "chat1_title.png",
    },
    {
        "id": "chat2",
        "name": "Kiểm thử chuyên sâu Osnap",
        "keywords": ["kiểm thử chuyên sâu osnap", "osnap"],
        "template_file": "chat2_title.png",
    },
    {
        "id": "chat3",
        "name": "Chọn tool web hay app cho ma...",
        "keywords": ["chọn tool web hay app"],
        "template_file": "chat3_title.png",
    },
]

RETRY_BUTTON_NAMES = [
    "retry",
    "thử lại",
    "continue",
    "tiếp tục",
    "continue generating",
    "resume",
    "keep going",
    "try again",
]


def log(msg: str):
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{now}] {msg}", flush=True)


def normalize_text(s: str) -> str:
    if not s:
        return ""
    return unicodedata.normalize("NFC", s).strip().lower()


def get_process_name(pid: int) -> str:
    h_proc = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
    if not h_proc:
        return ""
    try:
        buf = ctypes.create_unicode_buffer(1024)
        size = wintypes.DWORD(1024)
        if kernel32.QueryFullProcessImageNameW(h_proc, 0, buf, ctypes.byref(size)):
            return os.path.basename(buf.value).lower()
        return ""
    finally:
        kernel32.CloseHandle(h_proc)


def get_window_rect(hwnd: int):
    rect = wintypes.RECT()
    if user32.GetWindowRect(hwnd, ctypes.byref(rect)):
        return (rect.left, rect.top, rect.right, rect.bottom)
    return None


def get_window_title(hwnd: int) -> str:
    length = user32.GetWindowTextLengthW(hwnd)
    if length <= 0:
        return ""
    buf = ctypes.create_unicode_buffer(length + 1)
    user32.GetWindowTextW(hwnd, buf, length + 1)
    return buf.value


def find_codex_window():
    """Tìm cửa sổ chính của ứng dụng ChatGPT / Codex Desktop."""
    candidates = []

    WNDENUMPROC = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)

    def enum_cb(hwnd, _lparam):
        if not user32.IsWindowVisible(hwnd):
            return True
        pid = wintypes.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
        proc_name = get_process_name(pid.value)
        title = get_window_title(hwnd)

        is_target_proc = proc_name in ("chatgpt.exe", "codex.exe")
        is_target_title = any(k in title.lower() for k in ("chatgpt", "codex"))

        if is_target_proc or is_target_title:
            # Tránh bắt nhầm cửa sổ terminal đang chạy chính script này
            if proc_name in ("powershell.exe", "pwsh.exe", "cmd.exe", "python.exe", "windowsterminal.exe"):
                return True
            rect = get_window_rect(hwnd)
            if rect:
                w = rect[2] - rect[0]
                h = rect[3] - rect[1]
                # Nếu cửa sổ đang bị minimize thì kích thước có thể nhỏ, vẫn ghi nhận nếu đúng process
                if is_target_proc or (w >= 350 and h >= 250):
                    area = max(w * h, 1)
                    priority = 2 if is_target_proc else 1
                    candidates.append((priority, area, hwnd, proc_name, title, rect))
        return True

    user32.EnumWindows(WNDENUMPROC(enum_cb), 0)
    if not candidates:
        return None
    candidates.sort(key=lambda item: (item[0], item[1]), reverse=True)
    return candidates[0][2]


def bring_window_to_front(hwnd: int):
    try:
        if user32.IsIconic(hwnd):
            user32.ShowWindow(hwnd, SW_RESTORE)
            time.sleep(0.4)
        fg = user32.GetForegroundWindow()
        if fg != hwnd:
            fg_tid = user32.GetWindowThreadProcessId(fg, None)
            cur_tid = kernel32.GetCurrentThreadId()
            if fg_tid != cur_tid:
                user32.AttachThreadInput(cur_tid, fg_tid, True)
                user32.SetForegroundWindow(hwnd)
                user32.BringWindowToTop(hwnd)
                user32.AttachThreadInput(cur_tid, fg_tid, False)
            else:
                user32.SetForegroundWindow(hwnd)
            time.sleep(0.25)
    except Exception:
        pass


def click_screen(x: int, y: int, restore_cursor: bool = False):
    """Di chuyển chuột tới (x, y) và click trái."""
    old_pt = wintypes.POINT()
    user32.GetCursorPos(ctypes.byref(old_pt))

    user32.SetCursorPos(int(x), int(y))
    time.sleep(0.08)
    user32.mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
    time.sleep(0.06)
    user32.mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)
    time.sleep(0.1)

    if restore_cursor:
        user32.SetCursorPos(old_pt.x, old_pt.y)


def grab_window_bgr(hwnd: int):
    """Chụp ảnh vùng cửa sổ Codex trả về (img_bgr, (left, top, right, bottom))."""
    rect = get_window_rect(hwnd)
    if not rect:
        return None, None
    left, top, right, bottom = rect
    if right - left < 200 or bottom - top < 200:
        return None, None
    pil_img = ImageGrab.grab(bbox=(left, top, right, bottom), all_screens=True)
    rgb = np.array(pil_img.convert("RGB"))
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    return bgr, (left, top, right, bottom)


def load_templates(template_dir: str):
    templates = {}
    if not os.path.isdir(template_dir):
        return templates
    for fname in os.listdir(template_dir):
        if fname.lower().endswith(".png"):
            path = os.path.join(template_dir, fname)
            img = cv2.imread(path)
            if img is not None:
                templates[fname] = img
    return templates


def is_red_exclamation_patch(patch_bgr: np.ndarray) -> bool:
    """
    Kiểm tra xem vùng ảnh nhỏ (khoảng 18x18) có chứa đúng màu đỏ của icon chấm than (!)
    trong sidebar ChatGPT/Codex hay không (tránh nhầm với icon xám hoặc cam).
    """
    if patch_bgr is None or patch_bgr.size == 0:
        return False
    b = patch_bgr[:, :, 0].astype(int)
    g = patch_bgr[:, :, 1].astype(int)
    r = patch_bgr[:, :, 2].astype(int)

    # Màu đỏ coral của icon chấm than: R > 140, R - G > 45, R - B > 45, và G ~ B
    red_mask = (r > 140) & ((r - g) > 45) & ((r - b) > 45) & (np.abs(g - b) < 25)
    red_count = int(np.sum(red_mask))
    return 25 <= red_count <= 220


def find_chat_rows_in_sidebar(sidebar_bgr: np.ndarray, templates: dict):
    """
    Tìm vị trí y (tương đối trong cửa sổ) của 3 chat mục tiêu trong sidebar.
    Trả về dict: {chat_id: (center_x, center_y, score, chat_name)}
    """
    found = {}
    sh, sw = sidebar_bgr.shape[:2]
    for chat in TARGET_CHATS:
        tname = chat["template_file"]
        tpl = templates.get(tname)
        if tpl is None:
            continue
        th, tw = tpl.shape[:2]
        if sh < th or sw < tw:
            continue
        res = cv2.matchTemplate(sidebar_bgr, tpl, cv2.TM_CCOEFF_NORMED)
        _, max_val, _, max_loc = cv2.minMaxLoc(res)
        if max_val >= 0.72:
            cx = max_loc[0] + tw // 2
            cy = max_loc[1] + th // 2
            found[chat["id"]] = (cx, cy, float(max_val), chat["name"])
    return found


def find_red_exclamation_rows(window_bgr: np.ndarray, templates: dict):
    """
    Quét vùng sidebar bên trái của cửa sổ để tìm tất cả các dòng có icon chấm than đỏ (!).
    Trả về danh sách: [(click_x_rel, click_y_rel, icon_x_rel, icon_y_rel, chat_label)]
    """
    wh, ww = window_bgr.shape[:2]
    sidebar_w = min(460, max(320, ww // 2))
    sidebar_bgr = window_bgr[:, :sidebar_w]

    chat_rows = find_chat_rows_in_sidebar(sidebar_bgr, templates)

    candidate_points = []

    # Cách 1: So khớp mẫu icon chấm than đỏ (active & inactive)
    for tpl_name in ("red_excl_active.png", "red_excl_inactive.png"):
        tpl = templates.get(tpl_name)
        if tpl is None:
            continue
        th, tw = tpl.shape[:2]
        if sidebar_bgr.shape[0] < th or sidebar_bgr.shape[1] < tw:
            continue
        res = cv2.matchTemplate(sidebar_bgr, tpl, cv2.TM_CCOEFF_NORMED)
        ys, xs = np.where(res >= 0.80)
        for y, x in zip(ys, xs):
            patch = sidebar_bgr[y : y + th, x : x + tw]
            if is_red_exclamation_patch(patch):
                score = float(res[y, x])
                candidate_points.append((int(x + tw // 2), int(y + th // 2), score))

    # Cách 2: Quét cụm điểm ảnh đỏ hình tròn 16x16 ở cột bên phải của sidebar (phòng khi DPI/zoom lệch nhẹ)
    b = sidebar_bgr[:, :, 0].astype(int)
    g = sidebar_bgr[:, :, 1].astype(int)
    r = sidebar_bgr[:, :, 2].astype(int)
    red_mask = ((r > 145) & ((r - g) > 45) & ((r - b) > 45) & (np.abs(g - b) < 22)).astype(np.uint8)
    # Chỉ xét vùng từ x = 140 tới sidebar_w
    red_mask[:, :140] = 0
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(red_mask)
    for i in range(1, num_labels):
        x, y, w, h, area = stats[i]
        # Vòng tròn chấm than đỏ có kích thước khoảng 12x12 đến 24x24
        if 10 <= w <= 26 and 10 <= h <= 26 and 20 <= area <= 220:
            cx, cy = int(centroids[i][0]), int(centroids[i][1])
            patch = sidebar_bgr[max(0, cy - 9) : cy + 9, max(0, cx - 9) : cx + 9]
            if is_red_exclamation_patch(patch):
                candidate_points.append((cx, cy, 0.85))

    # Gom cụm các điểm gần nhau theo trục y (cách nhau < 18px là cùng 1 dòng)
    candidate_points.sort(key=lambda item: item[2], reverse=True)
    deduped = []
    for cx, cy, score in candidate_points:
        if all(abs(cy - ey) > 18 or abs(cx - ex) > 25 for ex, ey, _ in deduped):
            deduped.append((cx, cy, score))

    # Sắp xếp từ trên xuống dưới theo thứ tự dòng
    deduped.sort(key=lambda item: item[1])

    results = []
    for icon_x, icon_y, _score in deduped:
        # Xác định xem icon đỏ này thuộc về chat nào trong 3 chat
        matched_label = None
        click_x = max(80, icon_x - 120)
        click_y = icon_y

        for _cid, (row_cx, row_cy, _rscore, chat_name) in chat_rows.items():
            if abs(icon_y - row_cy) <= 22:
                matched_label = chat_name
                click_x = row_cx
                click_y = row_cy
                break

        if matched_label is None:
            matched_label = f"Chat tại dòng y={icon_y}"

        results.append((click_x, click_y, icon_x, icon_y, matched_label))

    return results


def find_retry_or_continue_visual(window_bgr: np.ndarray, templates: dict):
    """
    Tìm vị trí nút Retry hoặc Continue trong cửa sổ bằng hình ảnh (OpenCV).
    Trả về (click_x_rel, click_y_rel, label) hoặc None.
    """
    wh, ww = window_bgr.shape[:2]

    # 1. Tìm trực tiếp mẫu nút Retry (retry_btn.png)
    retry_tpl = templates.get("retry_btn.png")
    if retry_tpl is not None:
        th, tw = retry_tpl.shape[:2]
        if wh >= th and ww >= tw:
            res = cv2.matchTemplate(window_bgr, retry_tpl, cv2.TM_CCOEFF_NORMED)
            _, max_val, _, max_loc = cv2.minMaxLoc(res)
            if max_val >= 0.80:
                cx = max_loc[0] + tw // 2
                cy = max_loc[1] + th // 2
                return (cx, cy, f"Retry button (visual score={max_val:.2f})")

    # 2. Nếu thấy banner "Selected model is at capacity", tìm nút Retry nằm cùng hàng bên phải
    cap_tpl = templates.get("capacity_banner.png")
    if cap_tpl is not None:
        th, tw = cap_tpl.shape[:2]
        if wh >= th and ww >= tw:
            res = cv2.matchTemplate(window_bgr, cap_tpl, cv2.TM_CCOEFF_NORMED)
            _, max_val, _, max_loc = cv2.minMaxLoc(res)
            if max_val >= 0.78:
                banner_y = max_loc[1]
                banner_x = max_loc[0]
                # Quét dải ngang của banner về phía bên phải để tìm nút Retry
                band_top = max(0, banner_y - 8)
                band_bot = min(wh, banner_y + th + 8)
                band_left = min(ww - 40, banner_x + tw)
                band = window_bgr[band_top:band_bot, band_left:]
                if retry_tpl is not None and band.shape[0] >= retry_tpl.shape[0] and band.shape[1] >= retry_tpl.shape[1]:
                    res_b = cv2.matchTemplate(band, retry_tpl, cv2.TM_CCOEFF_NORMED)
                    _, b_val, _, b_loc = cv2.minMaxLoc(res_b)
                    if b_val >= 0.65:
                        cx = band_left + b_loc[0] + retry_tpl.shape[1] // 2
                        cy = band_top + b_loc[1] + retry_tpl.shape[0] // 2
                        return (cx, cy, f"Retry button trên thanh capacity (score={b_val:.2f})")

    return None


def find_and_click_retry_uia(hwnd: int) -> bool:
    """
    Dùng Windows UI Automation (uiautomation) để tìm và ấn nút Retry / Continue / Tiếp tục
    bên trong cửa sổ Codex/ChatGPT.
    """
    if not HAS_UIA:
        return False
    try:
        root = auto.ControlFromHandle(hwnd)
        if not root:
            return False

        win_rect = get_window_rect(hwnd)
        if not win_rect:
            return False
        w_left, w_top, w_right, w_bottom = win_rect

        # Duyệt cây UIA tìm ButtonControl hoặc TextControl có tên Retry / Continue / Tiếp tục
        stack = [root]
        visited = 0
        while stack and visited < 600:
            ctrl = stack.pop(0)
            visited += 1
            try:
                name_norm = normalize_text(ctrl.Name)
                ctrl_type = ctrl.ControlTypeName
                if name_norm in RETRY_BUTTON_NAMES and ctrl_type in (
                    "ButtonControl",
                    "TextControl",
                    "HyperlinkControl",
                    "CustomControl",
                    "GroupControl",
                ):
                    rect = ctrl.BoundingRectangle
                    if rect and rect.width() > 15 and rect.height() > 12:
                        cx = (rect.left + rect.right) // 2
                        cy = (rect.top + rect.bottom) // 2
                        # Đảm bảo nút nằm trong vùng nội dung chat (không phải tiêu đề sidebar bên trái)
                        if cx > w_left + 260 and w_top < cy < w_bottom:
                            log(f"  -> [UIA] Phát hiện nút '{ctrl.Name}' tại ({cx}, {cy}), đang click...")
                            click_screen(cx, cy)
                            return True
            except Exception:
                pass

            try:
                children = ctrl.GetChildren()
                if children:
                    stack.extend(children)
            except Exception:
                pass
    except Exception:
        pass
    return False


def try_click_retry_in_current_chat(hwnd: int, templates: dict) -> bool:
    """
    Kiểm tra xem cuộc trò chuyện đang mở hiện tại có nút Retry / Continue hay không.
    Nếu có thì click ngay và trả về True.
    """
    window_bgr, win_rect = grab_window_bgr(hwnd)
    if window_bgr is None or win_rect is None:
        return False

    w_left, w_top, _, _ = win_rect

    # Ưu tiên 1: Nhận diện hình ảnh (OpenCV) nút Retry
    hit = find_retry_or_continue_visual(window_bgr, templates)
    if hit is not None:
        rel_x, rel_y, desc = hit
        abs_x = w_left + rel_x
        abs_y = w_top + rel_y
        log(f"  -> Phát hiện {desc} tại ({abs_x}, {abs_y}) -> Đang ấn...")
        click_screen(abs_x, abs_y)
        return True

    # Ưu tiên 2: Quét bằng Windows UI Automation (bắt cả nút Continue / Tiếp tục / Retry)
    if find_and_click_retry_uia(hwnd):
        return True

    return False


def run_watcher_cycle(hwnd: int, templates: dict, focus_window: bool = True):
    """Thực hiện 1 chu kỳ kiểm tra cửa sổ Codex."""
    if focus_window:
        bring_window_to_front(hwnd)

    # Bước 1: Kiểm tra ngay màn hình chat đang mở xem có nút Retry / Continue không
    if try_click_retry_in_current_chat(hwnd, templates):
        time.sleep(1.8)

    # Bước 2: Chụp lại cửa sổ và quét sidebar tìm các chat có dấu chấm than đỏ (!)
    window_bgr, win_rect = grab_window_bgr(hwnd)
    if window_bgr is None or win_rect is None:
        return

    w_left, w_top, _, _ = win_rect
    red_rows = find_red_exclamation_rows(window_bgr, templates)

    if not red_rows:
        return

    log(f"Phát hiện {len(red_rows)} cuộc trò chuyện có dấu chấm than đỏ (!):")
    for click_x_rel, click_y_rel, icon_x_rel, icon_y_rel, label in red_rows:
        abs_row_x = w_left + click_x_rel
        abs_row_y = w_top + click_y_rel
        log(
            f"  [!] Mở '{label}' (chấm đỏ tại x={w_left + icon_x_rel}, y={w_top + icon_y_rel} -> click dòng tại {abs_row_x}, {abs_row_y})"
        )
        if focus_window:
            bring_window_to_front(hwnd)
        click_screen(abs_row_x, abs_row_y)

        # Chờ giao diện cuộc trò chuyện tải xong
        time.sleep(1.4)

        # Thử tìm và bấm Retry / Continue (thử tối đa 2 lần cách nhau 0.8s phòng khi UI render trễ)
        clicked = False
        for attempt in range(2):
            if try_click_retry_in_current_chat(hwnd, templates):
                clicked = True
                break
            time.sleep(0.8)

        if clicked:
            log(f"  [OK] Đã ấn Retry / Continue thành công cho '{label}'!")
        else:
            log(f"  [--] Đã vào '{label}' nhưng chưa thấy nút Retry/Continue (có thể đã tự chạy lại).")

        # Nghỉ ngắn trước khi chuyển sang dòng chấm than đỏ tiếp theo
        time.sleep(1.8)


def main():
    parser = argparse.ArgumentParser(
        description="Tự động canh 24/24 3 chat trong Codex/ChatGPT App và bấm Retry/Continue khi có chấm than đỏ."
    )
    parser.add_argument(
        "--interval",
        type=float,
        default=5.0,
        help="Thời gian nghỉ giữa mỗi lần quét (giây, mặc định: 5.0)",
    )
    parser.add_argument(
        "--no-focus",
        action="store_true",
        help="Không tự động đưa cửa sổ Codex lên trên cùng trước khi quét",
    )
    args = parser.parse_args()

    script_dir = os.path.dirname(os.path.abspath(__file__))
    template_dir = os.path.join(script_dir, "templates")
    templates = load_templates(template_dir)

    log("============================================================")
    log(" BẮT ĐẦU TRỰC MÁY 24/24 - GIÁM SÁT CODEX / CHATGPT DESKTOP")
    log(f" Đã nạp {len(templates)} mẫu hình ảnh từ: {template_dir}")
    log(f" Chu kỳ quét: {args.interval} giây/lần | Nhấn Ctrl+C để dừng.")
    log("============================================================")

    last_not_found_log = 0.0

    try:
        while True:
            hwnd = find_codex_window()
            if not hwnd:
                now = time.time()
                if now - last_not_found_log > 30:
                    log("Đang chờ mở cửa sổ ứng dụng ChatGPT / Codex Desktop...")
                    last_not_found_log = now
                time.sleep(args.interval)
                continue

            try:
                run_watcher_cycle(hwnd, templates, focus_window=not args.no_focus)
            except Exception as err:
                log(f"Lỗi trong chu kỳ quét: {err}")

            time.sleep(args.interval)
    except KeyboardInterrupt:
        log("Đã dừng script giám sát theo yêu cầu (Ctrl+C).")
        sys.exit(0)


if __name__ == "__main__":
    main()
