# Stops the helper from starting at login and stops it now.
foreach ($t in 'Pixel Room Helper', 'Cozy Room Helper') { Unregister-ScheduledTask -TaskName $t -Confirm:$false -ErrorAction SilentlyContinue }
Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.CommandLine -match 'run-helper|cozy-helper' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
'Helper removed from login and stopped.'
