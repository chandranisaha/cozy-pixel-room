# Restarts the Pixel Room: helper (fresh process, so code changes load) + the Lively wallpaper.
# Run by launch-room.cmd / the "Pixel Room" desktop shortcut. Safe to run any time.
$room = Split-Path $PSScriptRoot -Parent
$lively = Join-Path $env:LOCALAPPDATA 'Programs\Lively Wallpaper\Lively.exe'
$port = 38917

function Up { try { $c = New-Object Net.Sockets.TcpClient; $c.Connect('127.0.0.1', $port); $c.Close(); $true } catch { $false } }

# 1. stop the helper; the watchdog brings it back. No watchdog? start one.
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'cozy-helper\.ps1' -and $_.CommandLine -notmatch 'run-helper' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
$dog = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'run-helper\.ps1' }
if (-not $dog) { Start-Process wscript.exe -ArgumentList ('"' + (Join-Path $PSScriptRoot 'run-hidden.vbs') + '"') }
Start-Sleep -Milliseconds 800

# 2. wait (up to 25 s) for the helper to listen again
for ($i = 0; $i -lt 50 -and -not (Up); $i++) { Start-Sleep -Milliseconds 500 }

# 3. Lively running? then reload the room in it
if (-not (Get-Process Lively -ErrorAction SilentlyContinue)) { Start-Process $lively; Start-Sleep -Seconds 5 }
& $lively setwp --file (Join-Path $room 'index.html')

if (Up) { exit 0 } else { exit 1 }
