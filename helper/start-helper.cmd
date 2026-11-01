@echo off
rem Starts the Cozy Pixel Room helper hidden in the background.
start "" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0cozy-helper.ps1"
