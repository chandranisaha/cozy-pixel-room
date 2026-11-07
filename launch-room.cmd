@echo off
rem Pixel Room: restart the helper and reload the wallpaper (works whether or not they are running)
powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0helper\restart-room.ps1"
