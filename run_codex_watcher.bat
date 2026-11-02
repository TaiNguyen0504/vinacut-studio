@echo off
chcp 65001 >nul
title Codex 24/7 Auto-Retry Watcher
echo ============================================================
echo   DANG KHOI DONG CODEX / CHATGPT 24/7 AUTO-RETRY WATCHER
echo   Giữ cửa sổ Codex hiển thị trên màn hình để script canh 24/24
echo   Nhấn Ctrl+C để dừng bất cứ lúc nào.
echo ============================================================
python "%~dp0tools\codex_watcher\codex_watcher.py" --interval 5
pause
