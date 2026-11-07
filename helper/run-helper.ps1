# Keeps the Pixel Room helper running: starts it, and restarts it whenever it stops.
# Started at login by the "Pixel Room Helper" scheduled task (see install-startup.cmd).
# Log: %LOCALAPPDATA%\CozyRoom\helper.log

$Data = Join-Path $env:LOCALAPPDATA 'CozyRoom'
if (-not (Test-Path $Data)) { New-Item -ItemType Directory -Path $Data | Out-Null }
$Log = Join-Path $Data 'helper.log'
function Log($msg) { Add-Content -Path $Log -Value ("{0:yyyy-MM-dd HH:mm:ss}  {1}" -f (Get-Date), $msg) }

# only one watchdog at a time
$created = $false
$mutex = New-Object System.Threading.Mutex($true, 'Local\CozyRoomHelperWatchdog', [ref]$created)
if (-not $created) { exit 0 }

# keep the log small
if ((Test-Path $Log) -and (Get-Item $Log).Length -gt 512KB) { Move-Item $Log "$Log.old" -Force }

$helper = Join-Path $PSScriptRoot 'cozy-helper.ps1'
Log "watchdog started"
while ($true) {
    $t0 = Get-Date
    Log "starting helper"
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $helper 2>&1 | ForEach-Object { Log "helper: $_" }
    $code = $LASTEXITCODE
    $ran = ((Get-Date) - $t0).TotalSeconds
    Log ("helper stopped (exit {0}) after {1:N0}s" -f $code, $ran)
    # quick exits (e.g. port still busy right after login) back off a little longer
    Start-Sleep -Seconds $(if ($ran -lt 20) { 15 } else { 3 })
}
