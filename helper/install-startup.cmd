@echo off
rem Makes the helper start automatically when you log in (adds a shortcut to your Startup folder).
rem Undo: delete "Cozy Room Helper.lnk" from shell:startup
powershell.exe -NoProfile -Command ^
  "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Startup')+'\Cozy Room Helper.lnk');" ^
  "$s.TargetPath='powershell.exe';" ^
  "$s.Arguments='-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"%~dp0cozy-helper.ps1\"';" ^
  "$s.WindowStyle=7; $s.Save(); 'Helper will start at login.'"
call "%~dp0start-helper.cmd"
