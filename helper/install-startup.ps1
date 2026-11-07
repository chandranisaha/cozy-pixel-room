# Makes the helper start automatically at every login (Task Scheduler task "Pixel Room Helper"),
# then starts it now. Undo: run uninstall-startup.cmd.
$vbs = Join-Path $PSScriptRoot 'run-hidden.vbs'
$action = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument "`"$vbs`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$trigger.Delay = 'PT15S'
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName 'Pixel Room Helper' -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
# older installs (Startup-folder shortcut, the task's old name) would start a second copy
foreach ($old in 'Cozy Room Helper.lnk', 'Pixel Room Helper.lnk') { Remove-Item (Join-Path ([Environment]::GetFolderPath('Startup')) $old) -ErrorAction SilentlyContinue }
Unregister-ScheduledTask -TaskName 'Cozy Room Helper' -Confirm:$false -ErrorAction SilentlyContinue
Start-ScheduledTask -TaskName 'Pixel Room Helper'
'Helper will now start at every login (and is starting now).'
