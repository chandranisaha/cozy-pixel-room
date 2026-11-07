---
name: pixel-room
description: Set up and personalise the Pixel Room Lively wallpaper. Use when the user wants to install the wallpaper, connect Google Calendar or Outlook, add their photos, Spotify playlists or bookmarks, redecorate the room (wallpaper, floor, rug, bedsheet, curtain patterns), dress up the girl or the cat, change the poster, tapes or stickers, add a new clickable thing to the room, or restart it after a change.
---

# Pixel Room

The repo (https://github.com/chandranisaha/cozy-pixel-room; clone it first if the person doesn't have it) is a Three.js pixel-art bedroom that runs as a [Lively Wallpaper](https://www.rocksdanister.com/lively/) web wallpaper on Windows, plus an optional local PowerShell helper (`helper/cozy-helper.ps1`) for things a wallpaper can't do (desktop icons, Sticky Notes, links, calendars, photos, syncing two screens).

## First: find out what the person wants
Ask in one short message what their room should have, if they haven't said: their photos or a Google Photos shared album, Spotify playlists, bookmarks for the shelf, Google/Outlook calendar, a different pet or colours, anything they want added. Don't ask about things they can change later.

## Setup
1. Check Lively is installed (`%LOCALAPPDATA%\Programs\Lively Wallpaper\Lively.exe`). If not, point them to the Microsoft Store or rocksdanister.com/lively.
2. Copy `assets/manifest.example.js` to `assets/manifest.js` (git-ignored) and fill it in:
   - `wall`: 9 slots (`polaroid` | `photo` | `note`). Images go in `assets/photos/`; then run `python tools/embed_assets.py`.
   - `records`: Spotify playlist links for the record crate. `books`: up to 10 links/folders for the shelf.
3. Tell them to add the wallpaper: Lively → Add Wallpaper → pick `index.html`, then Settings → Wallpaper → Wallpaper input: **Mouse & keyboard**.
4. Helper: `helper/start-helper.cmd` (once) or `helper/install-startup.cmd` (Task Scheduler task "Pixel Room Helper" with a watchdog that restarts it). It creates `helper/token.js` on first run.
5. **Restart after any change:** `launch-room.cmd` restarts the helper (so `.ps1` edits load), starts Lively if needed and reloads the room (~7 s). Make a desktop/Start-menu shortcut to it if they want one-click restarts.
6. Settings that live in Lively → right-click wallpaper → **Customise**: location, timer lengths, volume, pixel size, calendar links, Google Photos shared album link. See **Calendars** below.
7. Two monitors: Lively arrangement **Duplicate**; the helper keeps both screens in sync.

## Spotify
- Records in the crate (`records` in `assets/manifest.js`) open Spotify links. Use `https://open.spotify.com/playlist/<id>` or `spotify:playlist:<id>`; without the Spotify app installed, `spotify:` links open the web player instead.
- Playback control needs no Spotify account linking: the helper reads Windows' media sessions (`/media`, `/media/toggle|next|prev`), which the Spotify app and Spotify-in-a-browser both report to. The corner box has ▶/❚❚, ⏭ and a volume slider (`M.playPause`, `M.next`, `M.volume` in `js/music.js`); the turntable becomes play/pause when the room's own music is off; the crate shows now playing.
- Picking a playlist record: the helper opens it in the Spotify app and presses its "Play <name>" button through UI Automation (`/media/play`), retrying until Windows reports Playing. It matches the name loosely and falls back to the page's big play button.
- The poster's cover art comes from the helper's `/media/art` (iTunes Search API lookup by title + artist, cached).
- The helper answers one request at a time; slow routes (Spotify play, cover art, desktop icons) make others wait. Front-end calls treat a timeout as "busy", not "gone" (`js/helper.js`); keep it that way, and retry instead of giving up.
- Nothing shows? Something must have played at least once in this Windows session (start a song in Spotify), and the helper must be running.

## Calendars (Google + Outlook)
The wall calendar and the bed's "tomorrow" card read ICS feeds through the helper (`/calendar?url=`, https only, cached 10 min). Both feeds are merged; each event is tagged google/outlook when both are set.

**Google Calendar** ("Google Calendar link" in Customise):
- calendar.google.com → gear → Settings → under "Settings for my calendars" click the calendar → **Integrate calendar** → **Secret address in iCal format** (click the eye to reveal) → copy.
- Shortcut: `https://calendar.google.com/calendar/u/0/r/settings/calendar/<base64 of the calendar id>` (the primary calendar's id is the account's email).
- Looks like `https://calendar.google.com/calendar/ical/<id>/private-<key>/basic.ics`.

**Outlook** ("Outlook calendar link" in Customise):
- Personal account: `https://outlook.live.com/calendar/0/options/calendar/SharedCalendars`.
- Work or school (Microsoft 365) account: `https://outlook.office.com/calendar/options/calendar/SharedCalendars`. Some organisations switch publishing off; then there's no way to get a feed.
- Scroll to **Publish a calendar** → pick the calendar → **Can view all details** → **Publish** → copy the **ICS** link (not HTML). Looks like `https://outlook.office365.com/owa/calendar/<id>/<key>/calendar.ics`. `webcal://` links work too (turned into https).

**Setting them for the person** (instead of making them paste): edit `%LOCALAPPDATA%\Lively Wallpaper\Library\SaveData\wpdata\<wallpaper folder>\<screen number or "duplicate">\LivelyProperties.json`, set `calendarIcs` / `outlookIcs` → `value`, then restart Lively (quit it from the tray and start it again) so the page gets the new values.

**Checking a feed:** with the helper running, `curl -G "http://127.0.0.1:38917/calendar" --data-urlencode "url=<link>" --data-urlencode "t=<token from helper/token.js>"` and count `BEGIN:VEVENT` in the `ics` field. An `error` field says what went wrong.

**Good to know:**
- These links give read access to the whole calendar. Never commit them, paste them into issues, or put them in `manifest.js`. If one leaks: Google → "Reset" next to the secret address; Outlook → unpublish and publish again.
- Times with a `TZID` are read as the PC's local time; `Z` (UTC) times are converted. Daily/weekly/monthly/yearly repeats are supported; one-off exceptions to a repeating event are not.
- Feeds refresh every 10 minutes and at midnight when the page tears off.

## Decorating and dressing up (no code needed)
- **Room makeover** (`js/decor.js`): click an empty bit of wall or 🎨 room in the corner box. Each part (`PARTS`: wall, floor, rug, bed, curtain) has pattern functions that draw one low-res tile and a list of colour sets; the choice is stored as `R.store` key `decor` = `{ part: { p: pattern, c: colourIndex } }`. To restyle for someone, either set that key (helper kv `/kv/set?k=decor`) or add a new pattern/colour set to the lists. The first colour set and `def` are the original; keep them, the UI marks them ★ and "★ original room" goes back to them.
- **Dress up** (`js/looks.js` UI, options in `R.GIRL_OPTS` in `js/girl.js` and `R.CAT_OPTS` / `COATS` in `js/cat.js`): stored as `look` = `{ girl: {...}, cat: {...} }`. A new hairstyle is a branch in `hairStyle()`; a new coat is an entry in `COATS` (fur, dark, white, mark(), light). Defaults (`DEF`, `CAT_DEF`) are the original look; don't change them.
- **Poster** (`js/poster.js`): gig poster for what's playing; click flips to the week in review drawn from `R.store` key `week` (per-day `{focus, mins, tasks}`, written by `R.markProductive` in `js/pomodoro.js`).
- **Tape drawer** (`js/tapes.js`): `TAPES` (ambience loops from `js/audio.js`) and `STICKERS` (10×10 pixel patterns, one awarded per finished focus session).

## Changing the room
- Code map: `js/scene.js` (room, furniture, palette `PAL`; the parts the makeover repaints are in `R.decorParts`), `js/cat.js` (pet, coats, moods, speech lines `LINES`), `js/girl.js` (study buddy, outfits), `js/looks.js` (corner-box tabs), `js/decor.js` (makeover), `js/poster.js`, `js/tapes.js`, `js/crate.js` (vinyl catalogue with paper page turns), `js/wall.js`, `js/windowfx.js`, `js/drawers.js`, `js/bin.js`, `js/rug.js`, `js/audio.js` (procedural sounds). `js/main.js` builds everything in order.
- Left wall layout: poster, clock (over the bookshelf) and calendar share one row (centres around y≈4.45, about 2.3 apart along z). Keep new wall things in that row or clearly below it.
- Shared helpers in `js/util.js`: `R.box`, `R.group`, `R.mat`, `R.canvasTex`, `R.makeClickable(obj, label, onClick)`, `R.panel(title, render)`, `R.toast`, `R.tick(fn)`, `R.on/R.emit`, `R.store` (persisted and synced across screens; call `R.store.watch(key, fn)` to apply changes from the other screen).
- New clickable object: write `R.buildX` in a new `js/x.js`, add the file name to the script list at the bottom of `index.html`, call it from `js/main.js`. Keep the chunky pixel style: boxes, flat colours, `R.canvasTex` textures at low resolution.
- Keep sounds procedural (Web Audio in `js/audio.js`); add one-shot sound names to `ONE_SHOTS` so they replay on the screen that has audio.

## Check your work
- Open `index.html?debug&selftest` in a browser (or headless Chrome with `--dump-dom`) and look for `SELFTEST DONE n/n passed`. Add a check to `tools/selftest.js` for anything new.
- `?hour=21`, `?weather=rain`, `?mood=sleeping`, `?demo=drawers`, `?demo=poster&week`, `?demo=tapes`, `?demo=stickers`, `?demo=decor`, `?demo=dress&look=buns` help preview states. For screenshots use headless Chrome with `--use-angle=swiftshader --virtual-time-budget=9000 --screenshot`.
- Two-screen sync: `tools/synctest.html` with a test helper (see README).
