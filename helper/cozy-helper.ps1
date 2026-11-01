# Cozy Pixel Room helper.
# Does what a wallpaper can't: hides/shows desktop icons (the rug), tucks single icons
# under the rug, reads your Sticky Notes, opens links, launches Claude, and runs the
# cat's morning brief. Listens on 127.0.0.1:38917 only and runs a fixed set of actions.
#
# Every request must carry ?t=<token>. The token lives in helper/token.js, which only the
# wallpaper page loads, so random websites can't talk to the helper.
#
#   /state                     { iconsVisible, count }
#   /icons/hide|show|toggle
#   /launch/claude
#   /location                  { lat, lon, accuracy } from Windows location services
#   /desktop/items             desktop files with icons      /desktop/open?name=
#   /rug/area?pts=x,y;x,y;...  rug outline on screen (physical px), enables tuck-under
#   /rug/stash                 icons tucked under the rug    /rug/open?id=  /rug/restore?id=
#   /notes                     Sticky Notes                  /notes/open?id=  /notes/new
#   /open?url=                 http(s)/spotify/mailto link or an existing folder (spotify: opens the web player if the app isn't installed)
#   /media                     what's playing (Spotify app, Spotify in the browser, any player Windows knows)   /media/toggle|next|prev
#   /calendar?url=             fetches an .ics feed (https only)
#   /brief                     latest morning brief          /brief/run  /brief/open
#   /photos?url=               photos from a Google Photos shared album (cached, refreshed twice a day)
#   /kv?since=&id=             the room's shared state (tasks, curtains, timer...) for every screen
#   /kv/set?k=&v=&id=          store one key (v is JSON)   /ev?name=&data=&id=  a one-off for the other screens

# -Test runs a throwaway copy (other port and data folder, no brief, no rug polling) for tools/synctest.js.
param([int]$Port = 38917, [string]$Data = (Join-Path $env:LOCALAPPDATA 'CozyRoom'), [switch]$Test)
$ErrorActionPreference = 'Stop'
$Stash = Join-Path $env:USERPROFILE 'CozyRug'
$BriefDir = Join-Path $Data 'brief'
foreach ($d in @($Data, $Stash, $BriefDir)) { if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d | Out-Null } }

# ---------- token ----------
$TokenFile = Join-Path $PSScriptRoot 'token.js'
if (Test-Path $TokenFile) { $Token = ([regex]::Match((Get-Content $TokenFile -Raw), "'([0-9a-f]{32})'")).Groups[1].Value }
if (-not $Token) {
    $Token = -join ((1..32) | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) })
    Set-Content -Path $TokenFile -Value "window.COZY_TOKEN = '$Token';" -Encoding ASCII
}

Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;

public static class CozyDesk {
    [DllImport("user32.dll")] static extern IntPtr FindWindow(string cls, string name);
    [DllImport("user32.dll")] static extern IntPtr FindWindowEx(IntPtr parent, IntPtr after, string cls, string name);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] static extern IntPtr SendMessage(IntPtr h, uint msg, IntPtr w, IntPtr l);
    [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
    delegate bool EnumProc(IntPtr h, IntPtr l);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr l);

    // The desktop icon view lives under Progman, or under a WorkerW once a live wallpaper is running.
    public static IntPtr DefView() {
        IntPtr dv = FindWindowEx(FindWindow("Progman", null), IntPtr.Zero, "SHELLDLL_DefView", null);
        if (dv != IntPtr.Zero) return dv;
        IntPtr found = IntPtr.Zero;
        EnumWindows((h, l) => {
            IntPtr d = FindWindowEx(h, IntPtr.Zero, "SHELLDLL_DefView", null);
            if (d != IntPtr.Zero) { found = d; return false; }
            return true;
        }, IntPtr.Zero);
        return found;
    }
    public static IntPtr ListView() {
        IntPtr dv = DefView();
        return dv == IntPtr.Zero ? IntPtr.Zero : FindWindowEx(dv, IntPtr.Zero, "SysListView32", null);
    }
    public static bool IconsVisible() {
        IntPtr lv = ListView();
        return lv == IntPtr.Zero || IsWindowVisible(lv);
    }
    // Same as right-click desktop > View > Show desktop icons.
    public static void Toggle() {
        IntPtr dv = DefView();
        if (dv != IntPtr.Zero) SendMessage(dv, 0x0111, (IntPtr)0x7402, IntPtr.Zero);
    }
    public static void SetVisible(bool show) { if (IconsVisible() != show) Toggle(); }
}

// Reads desktop icon names + on-screen centres from Explorer's list view.
public static class DeskIcons {
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
    [DllImport("kernel32.dll")] static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);
    [DllImport("kernel32.dll")] static extern IntPtr VirtualAllocEx(IntPtr p, IntPtr addr, UIntPtr size, uint type, uint prot);
    [DllImport("kernel32.dll")] static extern bool VirtualFreeEx(IntPtr p, IntPtr addr, UIntPtr size, uint type);
    [DllImport("kernel32.dll")] static extern bool WriteProcessMemory(IntPtr p, IntPtr addr, byte[] buf, UIntPtr size, out UIntPtr n);
    [DllImport("kernel32.dll")] static extern bool ReadProcessMemory(IntPtr p, IntPtr addr, byte[] buf, UIntPtr size, out UIntPtr n);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
    [DllImport("user32.dll")] static extern IntPtr SendMessage(IntPtr h, uint msg, IntPtr w, IntPtr l);
    [DllImport("user32.dll")] static extern bool ClientToScreen(IntPtr h, ref POINT p);
    public struct POINT { public int X, Y; }
    public class Item { public string Name; public int X, Y; }

    public static List<Item> Read() {
        var list = new List<Item>();
        IntPtr lv = CozyDesk.ListView();
        if (lv == IntPtr.Zero) return list;
        uint pid; GetWindowThreadProcessId(lv, out pid);
        IntPtr hp = OpenProcess(0x0008 | 0x0010 | 0x0020 | 0x0400, false, pid);
        if (hp == IntPtr.Zero) return list;
        IntPtr mem = VirtualAllocEx(hp, IntPtr.Zero, (UIntPtr)4096, 0x3000, 0x04);
        try {
            UIntPtr io;
            POINT o = new POINT(); ClientToScreen(lv, ref o);
            int n = (int)SendMessage(lv, 0x1004, IntPtr.Zero, IntPtr.Zero);          // LVM_GETITEMCOUNT
            IntPtr lviAddr = (IntPtr)((long)mem + 128), textAddr = (IntPtr)((long)mem + 512);
            for (int i = 0; i < n; i++) {
                byte[] rc = new byte[16]; BitConverter.GetBytes(1).CopyTo(rc, 0);    // LVIR_ICON
                WriteProcessMemory(hp, mem, rc, (UIntPtr)16, out io);
                SendMessage(lv, 0x100E, (IntPtr)i, mem);                               // LVM_GETITEMRECT
                ReadProcessMemory(hp, mem, rc, (UIntPtr)16, out io);
                int l = BitConverter.ToInt32(rc, 0), t = BitConverter.ToInt32(rc, 4), r = BitConverter.ToInt32(rc, 8), b = BitConverter.ToInt32(rc, 12);
                byte[] lvi = new byte[88];                                             // LVITEMW (x64)
                BitConverter.GetBytes(1).CopyTo(lvi, 0);                               // LVIF_TEXT
                BitConverter.GetBytes(i).CopyTo(lvi, 4);
                BitConverter.GetBytes((long)textAddr).CopyTo(lvi, 24);
                BitConverter.GetBytes(260).CopyTo(lvi, 32);
                WriteProcessMemory(hp, lviAddr, lvi, (UIntPtr)88, out io);
                int len = (int)SendMessage(lv, 0x1073, (IntPtr)i, lviAddr);            // LVM_GETITEMTEXTW
                byte[] tb = new byte[520];
                ReadProcessMemory(hp, textAddr, tb, (UIntPtr)520, out io);
                string name = Encoding.Unicode.GetString(tb, 0, Math.Max(0, Math.Min(len, 260)) * 2);
                list.Add(new Item { Name = name, X = o.X + (l + r) / 2, Y = o.Y + (t + b) / 2 });
            }
        } finally { VirtualFreeEx(hp, mem, UIntPtr.Zero, 0x8000); CloseHandle(hp); }
        return list;
    }
}

// Minimal read access to SQLite through Windows' built-in winsqlite3.dll.
public static class Sql {
    [DllImport("winsqlite3.dll")] static extern int sqlite3_open_v2(byte[] file, out IntPtr db, int flags, IntPtr vfs);
    [DllImport("winsqlite3.dll")] static extern int sqlite3_close(IntPtr db);
    [DllImport("winsqlite3.dll")] static extern int sqlite3_prepare16_v2(IntPtr db, [MarshalAs(UnmanagedType.LPWStr)] string sql, int n, out IntPtr stmt, IntPtr tail);
    [DllImport("winsqlite3.dll")] static extern int sqlite3_step(IntPtr stmt);
    [DllImport("winsqlite3.dll")] static extern int sqlite3_column_count(IntPtr stmt);
    [DllImport("winsqlite3.dll")] static extern IntPtr sqlite3_column_text16(IntPtr stmt, int col);
    [DllImport("winsqlite3.dll")] static extern int sqlite3_finalize(IntPtr stmt);

    public static List<string[]> Query(string file, string sql) {
        var rows = new List<string[]>();
        IntPtr db, st;
        if (sqlite3_open_v2(Encoding.UTF8.GetBytes(file + "\0"), out db, 2, IntPtr.Zero) != 0) throw new Exception("cannot open " + file);
        try {
            if (sqlite3_prepare16_v2(db, sql, -1, out st, IntPtr.Zero) != 0) throw new Exception("bad query");
            int cols = sqlite3_column_count(st);
            while (sqlite3_step(st) == 100) {
                var r = new string[cols];
                for (int c = 0; c < cols; c++) { IntPtr p = sqlite3_column_text16(st, c); r[c] = p == IntPtr.Zero ? null : Marshal.PtrToStringUni(p); }
                rows.Add(r);
            }
            sqlite3_finalize(st);
        } finally { sqlite3_close(db); }
        return rows;
    }
}
"@
[void][CozyDesk]::SetProcessDPIAware()
Add-Type -AssemblyName System.Drawing, UIAutomationClient, UIAutomationTypes

# ---------- small utils ----------
function Read-Json($path, $default) {
    if (Test-Path $path) { try { return Get-Content $path -Raw -Encoding UTF8 | ConvertFrom-Json } catch {} }
    $default
}
function Write-Json($path, $obj) { ConvertTo-Json -InputObject $obj -Depth 6 | Set-Content -Path $path -Encoding UTF8 }
function Desktop-Dirs { @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('CommonDesktopDirectory')) | Where-Object { $_ -and (Test-Path $_) } }
function Desktop-Files {
    foreach ($d in Desktop-Dirs) {
        Get-ChildItem -LiteralPath $d -Force -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -ne 'desktop.ini' -and -not $_.Attributes.HasFlag([IO.FileAttributes]::Hidden) }
    }
}
function Get-IconCount { @(Desktop-Files).Count }
function Display-Name($f) { if ($f.Extension -in '.lnk', '.url') { $f.BaseName } else { $f.Name } }

$script:iconCache = @{}
function Icon-Data($path) {
    if ($script:iconCache.ContainsKey($path)) { return $script:iconCache[$path] }
    $data = $null
    try {
        if (-not (Test-Path -LiteralPath $path -PathType Container)) {
            $ico = [System.Drawing.Icon]::ExtractAssociatedIcon($path)
            $bmp = $ico.ToBitmap(); $ms = New-Object IO.MemoryStream
            $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
            $data = 'data:image/png;base64,' + [Convert]::ToBase64String($ms.ToArray())
            $bmp.Dispose(); $ico.Dispose()
        }
    } catch {}
    $script:iconCache[$path] = $data
    $data
}
# Desktop shows .lnk/.url without extension (and other extensions if they're hidden).
function Find-DesktopFile($name) {
    $files = @(Desktop-Files)
    $f = $files | Where-Object { $_.Name -eq $name } | Select-Object -First 1
    if (-not $f) { $f = $files | Where-Object { $_.BaseName -eq $name } | Select-Object -First 1 }
    $f
}

function Start-Claude {
    $pkg = Get-AppxPackage -Name 'Claude' -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($pkg) { Start-Process "shell:AppsFolder\$($pkg.PackageFamilyName)!Claude"; return 'store' }
    $exe = Join-Path $env:LOCALAPPDATA 'AnthropicClaude\claude.exe'
    if (Test-Path $exe) { Start-Process $exe; return 'desktop' }
    Start-Process 'https://claude.ai'
    'web'
}

$script:geo = $null
function Get-Location {
    if ($script:geo -and ((Get-Date) - $script:geo.at).TotalMinutes -lt 30) { return $script:geo.loc }
    Add-Type -AssemblyName System.Device
    $w = New-Object System.Device.Location.GeoCoordinateWatcher
    try {
        [void]$w.TryStart($false, [TimeSpan]::FromSeconds(8))
        for ($i = 0; $i -lt 16 -and $w.Position.Location.IsUnknown; $i++) { Start-Sleep -Milliseconds 500 }
        $l = $w.Position.Location
        if ($l.IsUnknown) { throw 'Windows location unavailable (Settings > Privacy > Location)' }
        $loc = @{ lat = [Math]::Round($l.Latitude, 4); lon = [Math]::Round($l.Longitude, 4); accuracy = [Math]::Round($l.HorizontalAccuracy) }
        $script:geo = @{ at = Get-Date; loc = $loc }
        $loc
    } finally { $w.Stop(); $w.Dispose() }
}

function Get-State { @{ iconsVisible = [CozyDesk]::IconsVisible(); count = (Get-IconCount) } }

# ---------- desktop items (what's revealed when the whole desktop is under the rug) ----------
function Get-DesktopItems {
    @{ items = @(Desktop-Files | ForEach-Object { @{ name = (Display-Name $_); isDir = $_.PSIsContainer; icon = (Icon-Data $_.FullName) } }) }
}
function Open-DesktopItem($name) {
    $f = Find-DesktopFile $name
    if (-not $f) { throw "not on the desktop: $name" }
    Start-Process -FilePath $f.FullName
    @{ opened = $f.Name }
}

# ---------- tuck single icons under the rug ----------
$IndexFile = Join-Path $Data 'rug.json'
$script:rugPoly = $null
$script:rugPolys = @{}      # one rug outline per wallpaper copy (Lively runs one per screen in Duplicate mode)
$script:rugSeq = 0
$script:lastPos = $null
$script:rugMsg = ''

function Rug-Index { @(Read-Json $IndexFile @()) | Where-Object { $_ -and $_.file -and (Test-Path -LiteralPath $_.file) } }
function In-Poly($x, $y, $pts) {
    $in = $false; $n = $pts.Count; $j = $n - 1
    for ($i = 0; $i -lt $n; $i++) {
        $xi = $pts[$i][0]; $yi = $pts[$i][1]; $xj = $pts[$j][0]; $yj = $pts[$j][1]
        if ((($yi -gt $y) -ne ($yj -gt $y)) -and ($x -lt ($xj - $xi) * ($y - $yi) / ($yj - $yi) + $xi)) { $in = -not $in }
        $j = $i
    }
    $in
}
function Stash-File($f) {
    $dest = Join-Path $Stash $f.Name
    $k = 2
    while (Test-Path -LiteralPath $dest) { $dest = Join-Path $Stash ("{0} ({1}){2}" -f $f.BaseName, $k, $f.Extension); $k++ }
    Move-Item -LiteralPath $f.FullName -Destination $dest
    $idx = @(Rug-Index)
    $idx += [pscustomobject]@{ id = [guid]::NewGuid().ToString('n').Substring(0, 8); name = (Display-Name $f); file = $dest; orig = $f.FullName; isDir = [bool]$f.PSIsContainer; at = (Get-Date).ToString('s') }
    Write-Json $IndexFile $idx
    $script:rugSeq++
}
function In-Rug($x, $y) {
    foreach ($r in @($script:rugPolys.Values)) { if (In-Poly $x $y $r.pts) { return $true } }
    $false
}
function Poll-Rug {
    foreach ($k in @($script:rugPolys.Keys)) { if (((Get-Date) - $script:rugPolys[$k].at).TotalSeconds -gt 90) { $script:rugPolys.Remove($k) } }
    if (-not $script:rugPolys.Count -or -not [CozyDesk]::IconsVisible()) { $script:lastPos = $null; return }
    $now = @{}
    foreach ($it in [DeskIcons]::Read()) { if ($it.Name) { $now[$it.Name] = $it } }
    if ($script:lastPos) {
        foreach ($name in @($now.Keys)) {
            $a = $now[$name]; $b = $script:lastPos[$name]
            if (-not $b) { continue }
            $moved = [Math]::Abs($a.X - $b.X) + [Math]::Abs($a.Y - $b.Y) -gt 6
            if (-not $moved -or -not (In-Rug $a.X $a.Y)) { continue }
            $f = Find-DesktopFile $name
            if (-not $f) { continue }
            $userDesk = [Environment]::GetFolderPath('Desktop')
            if (-not $f.FullName.StartsWith($userDesk, [StringComparison]::OrdinalIgnoreCase)) {
                $script:rugMsg = "$name is a shared desktop icon, so it can't go under the rug"; $script:rugSeq++; continue
            }
            try { Stash-File $f; $script:rugMsg = "$name tucked under the rug" }
            catch { $script:rugMsg = "couldn't move $name ($($_.Exception.Message))"; $script:rugSeq++ }
        }
    }
    $script:lastPos = $now
}
function Get-Stash {
    $items = @(Rug-Index | ForEach-Object { @{ id = $_.id; name = $_.name; isDir = [bool]$_.isDir; icon = (Icon-Data $_.file) } })
    @{ items = $items; seq = $script:rugSeq; msg = $script:rugMsg }
}
function Find-Stashed($id) {
    $e = Rug-Index | Where-Object { $_.id -eq $id } | Select-Object -First 1
    if (-not $e) { throw 'not under the rug' }
    $e
}
function Restore-Stashed($id) {
    $e = Find-Stashed $id
    $dest = $e.orig
    $dir = Split-Path $dest; $base = [IO.Path]::GetFileNameWithoutExtension($dest); $ext = [IO.Path]::GetExtension($dest); $k = 2
    while (Test-Path -LiteralPath $dest) { $dest = Join-Path $dir ("{0} ({1}){2}" -f $base, $k, $ext); $k++ }
    Move-Item -LiteralPath $e.file -Destination $dest
    Write-Json $IndexFile @(Rug-Index | Where-Object { $_.id -ne $id })
    $script:rugSeq++
    $script:lastPos = $null    # it lands somewhere new; don't treat that as a drop
    @{ restored = $e.name }
}

# ---------- Sticky Notes ----------
$Plum = Join-Path $env:LOCALAPPDATA 'Packages\Microsoft.MicrosoftStickyNotes_8wekyb3d8bbwe\LocalState'
$StickyApp = 'shell:AppsFolder\Microsoft.MicrosoftStickyNotes_8wekyb3d8bbwe!App'
$script:notes = $null; $script:notesStamp = ''
function Get-Notes {
    # read a copy, so Sticky Notes' own database is never touched
    $src = Join-Path $Plum 'plum.sqlite'
    if (-not (Test-Path $src)) { return @{ notes = @(); installed = $false } }
    $stamp = (@('plum.sqlite', 'plum.sqlite-wal') | ForEach-Object { $p = Join-Path $Plum $_; if (Test-Path $p) { (Get-Item $p).LastWriteTimeUtc.Ticks } }) -join '.'
    if ($stamp -ne $script:notesStamp -or $null -eq $script:notes) {
        $copy = Join-Path $Data 'plum'
        if (-not (Test-Path $copy)) { New-Item -ItemType Directory $copy | Out-Null }
        Remove-Item (Join-Path $copy 'plum.sqlite*') -ErrorAction SilentlyContinue
        foreach ($s in 'plum.sqlite', 'plum.sqlite-wal', 'plum.sqlite-shm') {
            $p = Join-Path $Plum $s
            if (Test-Path $p) { Copy-Item -LiteralPath $p -Destination (Join-Path $copy $s) -Force }
        }
        $rows = [Sql]::Query((Join-Path $copy 'plum.sqlite'), 'SELECT Id, Text, Theme, IsOpen, UpdatedAt FROM Note WHERE DeletedAt IS NULL ORDER BY UpdatedAt DESC')
        $script:notes = @($rows | ForEach-Object { @{ id = $_[0]; text = $_[1]; theme = $_[2]; isOpen = ($_[3] -eq '1') } })
        $script:notesStamp = $stamp
    }
    @{ notes = $script:notes; installed = $true }
}
function Letters($s) { (($s -replace '\\id=[0-9a-f-]+', ' ') -replace '\\[a-z]+\d*', ' ' -replace '[^\p{L}\p{N}]', '').ToLower() }
function Sticky-Windows {
    $root = [Windows.Automation.AutomationElement]::RootElement
    $cond = New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::ClassNameProperty, 'ApplicationFrameWindow')
    @($root.FindAll('Children', $cond) | Where-Object { $_.Current.Name -match 'Sticky Notes' })
}
function Find-ById($el, $id) {
    $el.FindFirst('Descendants', (New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::AutomationIdProperty, $id)))
}
function Sticky-List {
    Start-Process $StickyApp     # launching (again) brings up the notes list
    for ($i = 0; $i -lt 12; $i++) {
        foreach ($w in Sticky-Windows) { $l = Find-ById $w 'NotesList'; if ($l) { return @{ win = $w; list = $l } } }
        Start-Sleep -Milliseconds 400
    }
    $null
}
function Open-Note($id) {
    $note = (Get-Notes).notes | Where-Object { $_.id -eq $id } | Select-Object -First 1
    if (-not $note) { throw 'note not found' }
    $want = Letters $note.text
    $want = $want.Substring(0, [Math]::Min(24, $want.Length))
    $L = Sticky-List
    if (-not $L) { return @{ opened = 'app' } }
    $items = $L.list.FindAll('Descendants', (New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::ControlTypeProperty, [Windows.Automation.ControlType]::ListItem)))
    foreach ($it in $items) {
        if ($want -and (Letters $it.Current.Name).Contains($want)) {
            $pat = $null
            if ($it.TryGetCurrentPattern([Windows.Automation.InvokePattern]::Pattern, [ref]$pat)) { $pat.Invoke(); return @{ opened = 'note' } }
            if ($it.TryGetCurrentPattern([Windows.Automation.SelectionItemPattern]::Pattern, [ref]$pat)) { $pat.Select(); return @{ opened = 'selected' } }
        }
    }
    @{ opened = 'app' }
}
function New-Note {
    # every Sticky Notes window (the notes list, or any open note) has a "New note" button
    Start-Process $StickyApp
    for ($i = 0; $i -lt 15; $i++) {
        foreach ($w in Sticky-Windows) {
            $b = Find-ById $w 'NewNoteButton'; $pat = $null
            if ($b -and $b.TryGetCurrentPattern([Windows.Automation.InvokePattern]::Pattern, [ref]$pat)) { $pat.Invoke(); $script:notesStamp = ''; return @{ created = $true } }
        }
        Start-Sleep -Milliseconds 400
    }
    @{ created = $false }
}

# ---------- links ----------
function Open-Url($url) {
    if ($url -match '^spotify:' -and -not (Test-Path 'Registry::HKEY_CLASSES_ROOT\spotify')) {
        $p = $url -split ':'
        $url = if ($p.Count -ge 3 -and $p[2]) { "https://open.spotify.com/$($p[1])/$($p[2])" } else { 'https://open.spotify.com' }
    }
    if ($url -match '^(https?://|spotify:|mailto:)') { Start-Process $url; return @{ opened = $url } }
    if ($url -and (Test-Path -LiteralPath $url -PathType Container)) { Start-Process explorer.exe -ArgumentList "`"$url`""; return @{ opened = $url } }
    throw 'only web links, spotify: links and folders can be opened'
}
$script:cal = @{}
function Get-Calendar($url) {
    if ($url -notmatch '^https://') { throw 'calendar link must start with https://' }
    $c = $script:cal[$url]
    if ($c -and ((Get-Date) - $c.at).TotalMinutes -lt 10) { return @{ ics = $c.ics } }
    $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 15 $url
    $ics = [Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray())
    $script:cal[$url] = @{ at = Get-Date; ics = $ics }
    @{ ics = $ics }
}

# ---------- photos from a Google Photos shared album ----------
# The album page lists its photos as lh3.googleusercontent.com/pw/... links. They're
# downloaded once (resized by Google) into %LOCALAPPDATA%\CozyRoom\photos and handed to the
# wallpaper as data URIs, so WebGL can draw them without cross-origin trouble.
$PhotoDir = Join-Path $Data 'photos'
function Get-Photos($url) {
    if ($url -notmatch '^https://(photos\.app\.goo\.gl|photos\.google\.com|goo\.gl)/') { throw 'paste a Google Photos shared album link (https://photos.app.goo.gl/...)' }
    $sha = [Security.Cryptography.SHA1]::Create()
    $key = -join ($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($url))[0..5] | ForEach-Object { $_.ToString('x2') })
    $dir = Join-Path $PhotoDir $key
    $meta = Read-Json (Join-Path $dir 'album.json') $null
    $fresh = $meta -and ((Get-Date) - [DateTime]$meta.at).TotalHours -lt 12
    if (-not $fresh) {
        $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 20 -UserAgent 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36' $url
        $links = @([regex]::Matches($r.Content, '"(https://lh3\.googleusercontent\.com/pw/[A-Za-z0-9_\-]+)"') | ForEach-Object { $_.Groups[1].Value } | Select-Object -Unique | Select-Object -First 24)
        if (-not $links.Count) { if ($meta) { $fresh = $true } else { throw 'no photos found: is the album shared with "anyone with the link"?' } }
        else {
            if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
            Get-ChildItem $dir -Filter '*.jpg' | Remove-Item
            $i = 0
            foreach ($l in $links) {
                $i++
                try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 15 ($l + '=w720-h720') -OutFile (Join-Path $dir ('{0:d2}.jpg' -f $i)) } catch {}
            }
            Write-Json (Join-Path $dir 'album.json') @{ at = (Get-Date).ToString('s'); url = $url; count = $i }
        }
    }
    $files = @(Get-ChildItem $dir -Filter '*.jpg' -ErrorAction SilentlyContinue | Sort-Object Name)
    @{ photos = @($files | ForEach-Object { 'data:image/jpeg;base64,' + [Convert]::ToBase64String([IO.File]::ReadAllBytes($_.FullName)) }); count = $files.Count }
}

# ---------- morning brief (Claude Code, once a day after 7am) ----------
$BriefState = Join-Path $BriefDir 'state.json'
$script:briefProc = $null
function Brief-Paths($day) { @{ json = (Join-Path $BriefDir "brief-$day.json"); html = (Join-Path $BriefDir "brief-$day.html"); log = (Join-Path $BriefDir "log-$day.txt") } }
function Wsl-Path($p) { '/mnt/' + $p.Substring(0, 1).ToLower() + ($p.Substring(2) -replace '\\', '/') }
function Start-Brief {
    if ($script:briefProc -and -not $script:briefProc.HasExited) { return @{ running = $true } }
    $day = (Get-Date).ToString('yyyy-MM-dd'); $P = Brief-Paths $day
    $skill = Get-ChildItem (Join-Path $env:USERPROFILE '.claude\skills') -Recurse -Filter SKILL.md -ErrorAction SilentlyContinue | Where-Object { $_.Directory.Name -eq 'morning' } | Select-Object -First 1
    $skillLine = if ($skill) { "Read the morning brief skill at $(Wsl-Path $skill.FullName) and follow its Gather and Sort steps (this is an unattended run: skip connector suggestions)." } else { 'Gather my day: unanswered emails that need me, anything due today, and what is already sorted.' }
    $prompt = @"
$skillLine
Today is $day. Use whichever connected tools you have (email, calendar, chat, drive). Then:
1. Write the full brief as one self-contained, warm, hand-drawn-style HTML page to the file $(Wsl-Path $P.html).
2. Write a JSON summary to $(Wsl-Path $P.json) with exactly this shape:
   {"date":"$day","headline":"<one short line about the shape of my day>","items":[{"text":"<under 80 chars>","kind":"attention|sorted|info"}]}
   At most 5 items, most important first. Plain text only.
Do not publish anything or send any messages. Only read from my tools and write those two files.
"@
    Set-Content -Path (Join-Path $BriefDir 'prompt.txt') -Value $prompt -Encoding UTF8
    $tools = 'Read,Glob,Grep,Write,mcp__claude_ai_Gmail__search_threads,mcp__claude_ai_Gmail__get_thread,mcp__claude_ai_Gmail__get_message,mcp__claude_ai_Gmail__list_labels,mcp__claude_ai_Google_Drive__search_files,mcp__claude_ai_Google_Drive__read_file_content,mcp__claude_ai_Google_Drive__list_recent_files,mcp__claude_ai_Google_Drive__get_file_metadata'
    $sh = "cd '$(Wsl-Path $BriefDir)' && claude -p `"`$(cat prompt.txt)`" --permission-mode acceptEdits --allowedTools '$tools' > '$(Wsl-Path $P.log)' 2>&1`n"
    [IO.File]::WriteAllText((Join-Path $BriefDir 'run-brief.sh'), $sh)
    $script:briefProc = Start-Process wsl.exe -ArgumentList '-e', 'bash', '-l', (Wsl-Path (Join-Path $BriefDir 'run-brief.sh')) -WindowStyle Hidden -PassThru
    Write-Json $BriefState @{ lastAttempt = $day }
    @{ running = $true; started = $day }
}
function Get-Brief {
    $latest = Get-ChildItem $BriefDir -Filter 'brief-*.json' -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
    $b = $null
    if ($latest) { try { $b = Get-Content $latest.FullName -Raw -Encoding UTF8 | ConvertFrom-Json } catch {} }
    $running = [bool]($script:briefProc -and -not $script:briefProc.HasExited)
    @{ brief = $b; running = $running; hasPage = [bool]($latest -and (Test-Path ($latest.FullName -replace '\.json$', '.html'))) }
}
function Open-Brief {
    $latest = Get-ChildItem $BriefDir -Filter 'brief-*.html' -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
    if (-not $latest) { throw 'no brief yet' }
    Start-Process $latest.FullName
    @{ opened = $latest.Name }
}
function Auto-Brief {
    # opt-in: create %LOCALAPPDATA%\CozyRoom\auto-brief.on to have it run by itself every morning
    if (-not (Test-Path (Join-Path $Data 'auto-brief.on'))) { return }
    $now = Get-Date
    if ($now.Hour -lt 7) { return }
    $day = $now.ToString('yyyy-MM-dd')
    if (Test-Path (Brief-Paths $day).json) { return }
    $st = Read-Json $BriefState $null
    if ($st -and $st.lastAttempt -eq $day) { return }      # one automatic try per day
    [void](Start-Brief)
}

# ---------- media controls ----------
# Windows' media sessions (the ones the volume flyout shows): the Spotify app, or Spotify /
# YouTube playing in a browser. Read what's playing and press play/pause/next/previous.
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$script:asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
function Await-WinRT($op, [Type]$t) { $task = $script:asTask.MakeGenericMethod($t).Invoke($null, @($op)); [void]$task.Wait(5000); $task.Result }
$script:mediaMgr = $null
function Media-Session {
    if (-not $script:mediaMgr) {
        [void][Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
        $script:mediaMgr = Await-WinRT ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
    }
    $sp = @($script:mediaMgr.GetSessions()) | Where-Object { $_.SourceAppUserModelId -match 'Spotify' } | Select-Object -First 1
    if ($sp) { return $sp }
    $script:mediaMgr.GetCurrentSession()      # e.g. Spotify in Chrome
}
function Get-Media {
    $s = Media-Session
    if (-not $s) { return @{ active = $false } }
    $p = Await-WinRT ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
    @{ active = $true; app = [string]$s.SourceAppUserModelId; playing = ($s.GetPlaybackInfo().PlaybackStatus.ToString() -eq 'Playing'); title = [string]$p.Title; artist = [string]$p.Artist }
}
function Invoke-Media($what) {
    $s = Media-Session
    if (-not $s) { throw 'nothing is playing. Start Spotify (app or open.spotify.com) first' }
    $op = switch ($what) { 'toggle' { $s.TryTogglePlayPauseAsync() } 'next' { $s.TrySkipNextAsync() } 'prev' { $s.TrySkipPreviousAsync() } }
    [void](Await-WinRT $op ([bool]))
    Start-Sleep -Milliseconds 300
    Get-Media
}

# ---------- shared room state ----------
# Lively runs one copy of the wallpaper per screen, each in a throwaway browser profile, so
# the room's state lives here and survives Lively restarts. Values are kept as JSON text.
$KvFile = Join-Path $Data 'room-state.json'
$script:kv = @{}; $script:kvRev = 0; $script:events = [Collections.ArrayList]::new()
$saved = Read-Json $KvFile $null
if ($saved) {
    $script:kvRev = [int]$saved.rev
    foreach ($p in $saved.items.PSObject.Properties) { $script:kv[$p.Name] = @{ v = [string]$p.Value.v; rev = [int]$p.Value.rev; from = '' } }
}
function Save-Kv {
    $items = @{}; foreach ($k in $script:kv.Keys) { $items[$k] = @{ v = $script:kv[$k].v; rev = $script:kv[$k].rev } }
    Write-Json $KvFile @{ rev = $script:kvRev; items = $items }
}
function Get-Kv([int]$since, $id) {
    $items = @{}
    foreach ($k in $script:kv.Keys) { $e = $script:kv[$k]; if ($e.rev -gt $since -and ($since -eq 0 -or $e.from -ne $id)) { $items[$k] = $e.v } }
    $evs = @($script:events | Where-Object { $_.rev -gt $since -and $_.from -ne $id -and $since -gt 0 })
    @{ rev = $script:kvRev; items = $items; events = $evs }
}
function Set-Kv($k, $v, $id) {
    if ($k -notmatch '^[A-Za-z]{1,32}$') { throw 'bad key' }
    if ($v.Length -gt 200000) { throw 'value too big' }
    $script:kvRev++
    $script:kv[$k] = @{ v = $v; rev = $script:kvRev; from = $id }
    Save-Kv
    @{ rev = $script:kvRev }
}
function Add-Event($name, $data, $id) {
    if ($name -notmatch '^[A-Za-z]{1,32}$') { throw 'bad event' }
    $script:kvRev++
    [void]$script:events.Add(@{ rev = $script:kvRev; name = $name; data = $data; from = $id; at = [DateTimeOffset]::Now.ToUnixTimeMilliseconds() })
    while ($script:events.Count -gt 40) { $script:events.RemoveAt(0) }
    @{ rev = $script:kvRev }
}

# ---------- routing ----------
function Invoke-Route([string]$path, $q) {
    switch -Regex ($path) {
        '^/(ping|state)$'   { return Get-State }
        '^/icons/hide$'     { [CozyDesk]::SetVisible($false); Start-Sleep -Milliseconds 150; return Get-State }
        '^/icons/show$'     { [CozyDesk]::SetVisible($true);  Start-Sleep -Milliseconds 150; return Get-State }
        '^/icons/toggle$'   { [CozyDesk]::Toggle();           Start-Sleep -Milliseconds 150; return Get-State }
        '^/launch/claude$'  { return @{ launched = (Start-Claude) } }
        '^/location$'       { return Get-Location }
        '^/desktop/items$'  { return Get-DesktopItems }
        '^/desktop/open$'   { return Open-DesktopItem $q['name'] }
        '^/desktop/positions$' { return @{ items = @([DeskIcons]::Read() | ForEach-Object { @{ name = $_.Name; x = $_.X; y = $_.Y } }); rug = $script:rugPoly } }
        '^/rug/area$'       {
            $script:rugPoly = @($q['pts'] -split ';' | ForEach-Object { , @($_ -split ',' | ForEach-Object { [double]$_ }) })
            $script:rugPolys[[string]$q['id']] = @{ pts = $script:rugPoly; at = Get-Date }
            return @{ ok = $true; points = $script:rugPoly.Count }
        }
        '^/rug/stash$'      { return Get-Stash }
        '^/rug/open$'       { $e = Find-Stashed $q['id']; Start-Process -FilePath $e.file; return @{ opened = $e.name } }
        '^/rug/restore$'    { return Restore-Stashed $q['id'] }
        '^/notes$'          { return Get-Notes }
        '^/notes/open$'     { return Open-Note $q['id'] }
        '^/notes/new$'      { return New-Note }
        '^/open$'           { return Open-Url $q['url'] }
        '^/calendar$'       { return Get-Calendar $q['url'] }
        '^/brief$'          { return Get-Brief }
        '^/brief/run$'      { return Start-Brief }
        '^/brief/open$'     { return Open-Brief }
        '^/photos$'         { return Get-Photos $q['url'] }
        '^/media$'          { return Get-Media }
        '^/media/(toggle|next|prev)$' { return Invoke-Media $Matches[1] }
        '^/kv$'             { return Get-Kv ([int]$q['since']) $q['id'] }
        '^/kv/set$'         { return Set-Kv $q['k'] $q['v'] $q['id'] }
        '^/ev$'             { return Add-Event $q['name'] $q['data'] $q['id'] }
        default             { return $null }
    }
}
function Parse-Query($s) {
    $q = @{}
    if ($s) { foreach ($kv in $s -split '&') { $p = $kv -split '=', 2; if ($p[0]) { $q[[Uri]::UnescapeDataString($p[0])] = [Uri]::UnescapeDataString((($p[1] + '') -replace '\+', ' ')) } } }
    $q
}
# Pages are allowed from Lively's virtual host, a local file (origin "null"), or no browser at all.
function Origin-Ok($o) { -not $o -or $o -eq 'null' -or $o -match '^https://[a-z0-9]+\.localhost$' }

try {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
    $listener.Start()
} catch {
    Write-Host "Could not listen on port $Port (already running?): $($_.Exception.InnerException.Message)"
    exit 0
}
Write-Host "Cozy helper listening on http://127.0.0.1:$Port  (Ctrl+C to stop)"

$lastPoll = [DateTime]::MinValue; $lastBriefCheck = [DateTime]::MinValue
while ($true) {
    if (-not $listener.Pending()) {
        Start-Sleep -Milliseconds 60
        $now = Get-Date
        if ($Test) { continue }
        if (($now - $lastPoll).TotalMilliseconds -gt 700) { $lastPoll = $now; try { Poll-Rug } catch {} }
        if (($now - $lastBriefCheck).TotalSeconds -gt 60) { $lastBriefCheck = $now; try { Auto-Brief } catch {} }
        continue
    }
    $client = $listener.AcceptTcpClient()
    try {
        $client.ReceiveTimeout = 2000
        $stream = $client.GetStream()
        $reader = [System.IO.StreamReader]::new($stream, [Text.Encoding]::UTF8, $false, 8192, $true)
        $requestLine = $reader.ReadLine()
        $origin = $null
        while ($true) {
            $h = $reader.ReadLine()
            if ([string]::IsNullOrEmpty($h)) { break }
            if ($h -match '^Origin:\s*(.+)$') { $origin = $Matches[1].Trim() }
        }
        if (-not $requestLine) { continue }
        $parts = $requestLine.Split(' ')
        $method = $parts[0]
        $pq = $parts[1] -split '\?', 2
        $path = $pq[0]; $q = Parse-Query $pq[1]

        $status = '200 OK'
        $body = ''
        if ($method -eq 'OPTIONS') {
            $status = '204 No Content'
        } elseif (-not (Origin-Ok $origin) -or $q['t'] -ne $Token) {
            $status = '403 Forbidden'; $body = '{"error":"forbidden"}'
        } else {
            try {
                $result = Invoke-Route $path $q
                if ($null -eq $result) { $status = '404 Not Found'; $body = '{"error":"unknown route"}' }
                else { $body = ConvertTo-Json -InputObject $result -Compress -Depth 6 }
            } catch {
                $status = '500 Internal Server Error'
                $body = (@{ error = $_.Exception.Message } | ConvertTo-Json -Compress)
            }
        }
        $bytes = [Text.Encoding]::UTF8.GetBytes($body)
        $allow = if ($origin -and (Origin-Ok $origin)) { $origin } else { 'null' }
        $head = "HTTP/1.1 $status`r`n" +
                "Content-Type: application/json; charset=utf-8`r`n" +
                "Access-Control-Allow-Origin: $allow`r`n" +
                "Access-Control-Allow-Methods: GET, OPTIONS`r`n" +
                "Access-Control-Allow-Headers: *`r`n" +
                "Access-Control-Allow-Private-Network: true`r`n" +
                "Cache-Control: no-store`r`n" +
                "Content-Length: $($bytes.Length)`r`n" +
                "Connection: close`r`n`r`n"
        $hb = [Text.Encoding]::ASCII.GetBytes($head)
        $stream.Write($hb, 0, $hb.Length)
        if ($bytes.Length) { $stream.Write($bytes, 0, $bytes.Length) }
        $stream.Flush()
    } catch {
        # a bad request shouldn't kill the helper
    } finally {
        $client.Close()
    }
}
