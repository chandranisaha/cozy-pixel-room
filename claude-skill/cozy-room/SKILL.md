---
name: cozy-room
description: Set up and personalise the Cozy Pixel Room Lively wallpaper. Use when the user wants to install the wallpaper, connect Google Calendar or Outlook, add their photos, Spotify playlists or bookmarks, change the room (pet, colours, objects, posters), or add a new clickable thing to the room.
---

# Cozy Pixel Room

The repo (https://github.com/chandranisaha/cozy-pixel-room; clone it first if the person doesn't have it) is a Three.js pixel-art bedroom that runs as a [Lively Wallpaper](https://www.rocksdanister.com/lively/) web wallpaper on Windows, plus an optional local PowerShell helper (`helper/cozy-helper.ps1`) for things a wallpaper can't do (desktop icons, Sticky Notes, links, calendars, photos, syncing two screens).

## First: find out what the person wants
Ask in one short message what their room should have, if they haven't said: their photos or a Google Photos shared album, Spotify playlists, bookmarks for the shelf, Google/Outlook calendar, a different pet or colours, anything they want added. Don't ask about things they can change later.

## Setup
1. Check Lively is installed (`%LOCALAPPDATA%\Programs\Lively Wallpaper\Lively.exe`). If not, point them to the Microsoft Store or rocksdanister.com/lively.
2. Copy `assets/manifest.example.js` to `assets/manifest.js` (git-ignored) and fill it in:
   - `wall`: 9 slots (`polaroid` | `photo` | `note`). Images go in `assets/photos/`; then run `python tools/embed_assets.py`.
   - `records`: Spotify playlist links for the record crate. `books`: up to 10 links/folders for the shelf.
3. Tell them to add the wallpaper: Lively → Add Wallpaper → pick `index.html`, then Settings → Wallpaper → Wallpaper input: **Mouse & keyboard**.
4. Helper: `helper/start-helper.cmd` (once) or `helper/install-startup.cmd` (at login). It creates `helper/token.js` on first run.
5. Settings that live in Lively → right-click wallpaper → **Customise**: location, timer lengths, volume, pixel size, calendar links, Google Photos shared album link. See **Calendars** below.
6. Two monitors: Lively arrangement **Duplicate**; the helper keeps both screens in sync.

## Spotify
- Records in the crate (`records` in `assets/manifest.js`) open Spotify links. Use `https://open.spotify.com/playlist/<id>` or `spotify:playlist:<id>`; without the Spotify app installed, `spotify:` links open the web player instead.
- Playback control needs no Spotify account linking: the helper reads Windows' media sessions (`/media`, `/media/toggle|next|prev`), which the Spotify app and Spotify-in-a-browser both report to. The turntable becomes play/pause when the room's own music is off; the crate shows now playing with ⏮ ⏯ ⏭.
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

## Changing the room
- Code map: `js/scene.js` (room, furniture, palette `PAL`), `js/cat.js` (pet, moods, speech lines `LINES`), `js/girl.js` (study buddy), `js/wall.js`, `js/windowfx.js`, `js/drawers.js`, `js/bin.js`, `js/audio.js` (procedural sounds). `js/main.js` builds everything in order.
- Shared helpers in `js/util.js`: `R.box`, `R.group`, `R.mat`, `R.canvasTex`, `R.makeClickable(obj, label, onClick)`, `R.panel(title, render)`, `R.toast`, `R.tick(fn)`, `R.on/R.emit`, `R.store` (persisted and synced across screens; call `R.store.watch(key, fn)` to apply changes from the other screen).
- New clickable object: write `R.buildX` in a new `js/x.js`, add the file name to the script list at the bottom of `index.html`, call it from `js/main.js`. Keep the chunky pixel style: boxes, flat colours, `R.canvasTex` textures at low resolution.
- Keep sounds procedural (Web Audio in `js/audio.js`); add one-shot sound names to `ONE_SHOTS` so they replay on the screen that has audio.

## Check your work
- Open `index.html?debug&selftest` in a browser (or headless Chrome with `--dump-dom`) and look for `SELFTEST DONE n/n passed`. Add a check to `tools/selftest.js` for anything new.
- `?hour=21`, `?weather=rain`, `?mood=sleeping`, `?demo=drawers` help preview states.
- Two-screen sync: `tools/synctest.html` with a test helper (see README).
