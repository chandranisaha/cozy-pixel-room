@echo off
rem Makes the helper start automatically at every login (Task Scheduler: "Pixel Room Helper").
rem Undo: double-click uninstall-startup.cmd
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-startup.ps1"
pause
