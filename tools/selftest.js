// In-page end-to-end test. Load index.html?debug&selftest (loaded by main.js only then).
// Clicks real objects through the 3D picking path and checks each feature's state.
// Results are logged as "SELFTEST ..." lines. Anything that would open an app or a link is
// stubbed (recorded instead). The rug's hide-all runs for real and is toggled back.
(async function (R) {
  const results = [];
  let errors = 0;
  window.addEventListener('error', e => { errors++; console.log('SELFTEST page error: ' + e.message); });
  const out = window.SELFTEST = { lines: [], done: false };
  const log = (ok, name, info = '') => {
    results.push(ok);
    const line = 'SELFTEST ' + (ok ? 'PASS' : 'FAIL') + ' ' + name + (info ? ' — ' + info : '');
    out.lines.push(line); console.log(line);
  };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  let simT = 1000;
  const step = sec => { for (let i = 0; i < sec * 30; i++) { simT += 1 / 30; R.mouseTravel = 0; for (const fn of R.updaters) fn(1 / 30, simT); } };
  const canvas = document.getElementById('room');
  const panel = document.getElementById('panel');

  function screenOf(obj, offset) {
    // aim at the biggest visible mesh, not the group's bounding-box centre (which can be empty air)
    let best = obj, vol = -1;
    obj.traverseVisible(o => {
      if (!o.isMesh) return;
      o.geometry.computeBoundingBox();
      const s = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld).getSize(new THREE.Vector3());
      const v = s.x * s.y + s.y * s.z + s.x * s.z;
      if (v > vol) { vol = v; best = o; }
    });
    // the mesh's own geometry only (setFromObject would also count hidden children)
    best.geometry.computeBoundingBox();
    const p = best.geometry.boundingBox.clone().applyMatrix4(best.matrixWorld).getCenter(new THREE.Vector3());
    if (offset) p.add(offset);
    p.project(R.camera);
    const r = canvas.getBoundingClientRect();
    return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height };
  }
  function fire(type, x, y, target = canvas) {
    target.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, button: 0 }));
  }
  function click(obj, offset) {
    const { x, y } = screenOf(obj, offset);
    fire('mousemove', x, y); fire('mousedown', x, y); fire('mouseup', x, y, window); fire('click', x, y);
    return R.hovered === obj;
  }
  async function drag(obj, dxPx) {
    const { x, y } = screenOf(obj);
    fire('mousemove', x, y, window); fire('mousedown', x, y);
    for (let i = 1; i <= 10; i++) { fire('mousemove', x + dxPx * i / 10, y, window); step(0.03); }
    fire('mouseup', x + dxPx, y, window); fire('click', x + dxPx, y);
    await wait(20);   // the page ignores the click that ends a drag until the next tick
  }
  const find = label => R.clickable.find(o => (o.userData.label || '').startsWith(label));
  const panelText = () => panel.hidden ? '' : panel.textContent;
  const button = text => [...panel.querySelectorAll('button')].find(b => b.textContent.includes(text));

  // record helper calls that would open things on the desktop
  const realCall = R.helper.call, opened = [];
  R.helper.call = (p, ...a) => /^\/media/.test(p) ? Promise.resolve({ active: false })     // never touch your real Spotify
    : /^\/(open|launch|notes\/(open|new)|desktop\/open|rug\/open|brief\/(run|open))/.test(p)
    ? (opened.push(p), Promise.resolve({ ok: 'stub' })) : realCall(p, ...a);
  R.music.media = { active: false };

  await wait(1500);

  // ---------- weather ----------
  for (let i = 0; i < 20 && !R.weather.loaded; i++) await wait(500);
  log(R.weather.loaded && !!R.weather.temp, 'live weather', R.weather.temp + ' ' + R.weather.desc + ' ' + R.weather.city);

  // ---------- lamp ----------
  const lampWas = R.lamp.on;
  click(find('desk lamp'));
  log(R.lamp.on !== lampWas, 'lamp toggles');
  click(find('desk lamp'));

  // ---------- vinyl + crate + vibe ----------
  click(find('record player')); step(2);
  log(R.music.playing && R.music.spinning(), 'vinyl plays + spins', R.music.station && R.music.station.title);
  click(find('record player')); step(2);
  log(!R.music.playing && !R.music.spinning(), 'vinyl stops when paused');

  click(find('record crate'));
  log(panelText().includes('late-night jazz'), 'crate opens with records', panel.querySelectorAll('.sleeve').length + ' records');
  [...panel.querySelectorAll('.sleeve')].find(b => b.textContent.includes('jazz')).click();
  step(3);
  log(R.music.playing && R.music.station.id === 'jazz' && R.vibe.name === 'jazz', 'jazz record plays, lights go amber', 'vibe=' + R.vibe.name);
  R.music.play('rain'); step(2);
  log(R.vibe.name === 'rain', 'rain record → blue lights');
  R.music.stop(); step(2);

  // Spotify-style system audio: genre looked up on MusicBrainz
  const sysAudio = (artist) => {
    window.livelyCurrentTrack(JSON.stringify({ Title: 'test song', Artist: artist }));
    for (let i = 0; i < 40; i++) { window.livelyAudioListener(Array.from({ length: 128 }, (_, k) => (k < 10 ? 0.3 + 0.3 * (i % 4 === 0) : 0.05))); step(0.05); }
  };
  for (const [artist, want] of [['Taylor Swift', 'pop'], ['Bon Iver', 'indie/folk']]) {
    let got = '';
    for (let i = 0; i < 12 && got !== want; i++) { sysAudio(artist); got = R.vibe.name; if (got !== want) await wait(800); }
    log(got === want, 'Spotify artist ' + artist + ' → ' + want + ' lights', 'got ' + (got || 'cozy'));
  }
  window.livelyCurrentTrack(''); R.music.sysHeld = -1e9; step(1);

  // ---------- photo wall ----------
  const lb = document.getElementById('lightbox');
  const wallMeshes = R.clickable.filter(o => o.parent && o.geometry && o.geometry.type === 'PlaneGeometry' && o.position.z > 0.03 && o.position.z < 0.07 && o.parent.position.x > 3);
  click(wallMeshes[0]);
  log(!lb.hidden && !lb.querySelector('img').hidden, 'polaroid opens lightbox');
  lb.querySelector('.close').click();

  // ---------- sticky notes ----------
  let notes = [];
  for (let i = 0; i < 20; i++) { notes = R.clickable.filter(o => (o.userData.label || '').startsWith('📝')); if (notes.length && !notes[0].userData.label.includes('your sticky')) break; await wait(500); }
  log(notes.length > 0, 'sticky notes synced from the app', notes.map(n => n.userData.label.slice(2, 22)).join(' | '));
  if (notes.length) { click(notes[0]); log(opened.some(p => p.startsWith('/notes/open')), 'click note → opens it in Sticky Notes'); }
  const plus = R.clickable.find(o => o.userData.label === 'new sticky note');
  if (plus) { click(plus); log(opened.includes('/notes/new'), '"+" pad → new sticky note'); }

  // ---------- tasks → plant + paper bin ----------
  const growth0 = R.plantState.growth, log0 = R.store.get('doneLog', []).length;
  document.getElementById('taskInput').value = 'selftest task';
  document.getElementById('taskForm').dispatchEvent(new Event('submit', { cancelable: true }));
  const li = [...document.querySelectorAll('#taskList li')].find(l => l.textContent.includes('selftest task'));
  li.querySelector('.check').click();
  step(2);
  log(R.plantState.growth > growth0 && R.store.get('doneLog', []).length === log0 + 1, 'task done → plant grows + paper ball into the bin');
  click(find('paper bin'));
  log(panelText().includes('selftest task'), 'bin shows what you finished');
  R.closePanel();
  R.tasks.remove(R.tasks.list.find(x => x.text === 'selftest task').id);
  R.store.set('doneLog', R.store.get('doneLog', []).filter(e => e.text !== 'selftest task'));

  // ---------- cat ----------
  const last = R.prod.last, hour = new Date().getHours();
  R.prod.last = Date.now() - R.min(+R.cfg.angryAfterMin + 5); step(3);
  log(R.cat.mood === (hour < 6 ? 'sleeping' : 'angry'), 'cat gets angry when idle', 'mood=' + R.cat.mood);
  R.prod.last = Date.now(); step(3);
  log(R.cat.mood === (hour < 6 ? 'sleeping' : 'happy'), 'cat happy after work', 'mood=' + R.cat.mood);
  R.prod.last = Date.now();
  if (R.cat.mood === 'sleeping') { R.cat.wake(); step(1); }   // at night it's asleep; a click would only wake it
  click(R.cat.group);
  R.prod.last = last; R.store.set('prod', R.prod);
  log(opened.includes('/launch/claude'), 'cat click launches Claude');
  // petting: wiggle over the cat
  const c = screenOf(R.cat.group);
  for (let i = 0; i < 40; i++) { fire('mousemove', c.x + (i % 2 ? 6 : -6), c.y); R.mouseTravel = 50; for (const fn of R.updaters) fn(1 / 30, simT += 1 / 30); }
  log(R.cat.pet > 0.35, 'petting the cat → purr + hearts', 'pet=' + R.cat.pet.toFixed(2));
  fire('mousemove', 5, 5); step(4);

  // ---------- letters: reminders + brief ----------
  click(find('letters'));
  log(panelText().includes('morning brief') && panelText().includes('reminders'), 'envelope opens the letters', R.brief.ok ? (R.brief.data ? 'brief: ' + R.brief.data.headline : 'no brief yet') : 'helper off');
  const [txt, when] = panel.querySelectorAll('.remform input');
  txt.value = 'selftest reminder'; when.value = 'in 5m';
  panel.querySelector('.remform').dispatchEvent(new Event('submit', { cancelable: true }));
  const rem = R.reminders.list().find(r => r.text === 'selftest reminder');
  log(!!rem && Math.abs(rem.at - Date.now() - 300000) < 5000, 'reminder added for in 5 min');
  rem.at = Date.now() - 1000; R.reminders.check();
  log(rem.fired && R.reminders.unread() > 0, 'due reminder → cat alert + unread letter');
  R.closePanel();
  R.reminders.list().splice(R.reminders.list().indexOf(rem), 1);

  // ---------- Spotify through Windows' media controls ----------
  const mediaCalls = [], mc = R.helper.call;
  R.helper.call = p => /^\/media/.test(p) ? (mediaCalls.push(p), Promise.resolve({ active: true, playing: !/toggle/.test(p), app: 'Spotify.exe', title: 'test song', artist: 'test artist' })) : mc(p);
  R.music.media = { active: true, playing: false, app: 'Spotify.exe', title: 'test song', artist: 'test artist' };
  click(find('record player')); await wait(50);
  log(mediaCalls.includes('/media/toggle') && !R.music.playing, 'record player is a Spotify remote when Spotify is open', mediaCalls.join(','));
  click(find('record crate')); await wait(50);
  log(panelText().includes('test song') && !!panel.querySelector('.nowplaying button'), 'crate shows Spotify now playing + controls');
  R.closePanel(); R.helper.call = mc; R.music.media = { active: false };

  // ---------- calendar ----------
  const d = new Date(), ymd = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  const DOW = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][d.getDay()];
  R.calendar.events = R.calendar.parse(['BEGIN:VCALENDAR',
    'BEGIN:VEVENT', 'DTSTART:' + ymd + 'T100000', 'DTEND:' + ymd + 'T110000', 'SUMMARY:standup', 'END:VEVENT',
    'BEGIN:VEVENT', 'DTSTART:20260105T150000', 'RRULE:FREQ=WEEKLY;BYDAY=' + DOW, 'SUMMARY:weekly class', 'END:VEVENT',
    'BEGIN:VEVENT', 'DTSTART:20260105T150000', 'RRULE:FREQ=WEEKLY;BYDAY=' + (DOW === 'MO' ? 'TU' : 'MO'), 'SUMMARY:other day', 'END:VEVENT',
    'END:VCALENDAR'].join('\r\n'));
  R.calendar.loaded = true;
  const today = R.calendar.eventsOn(d).map(e => e.title);
  log(today.length === 2 && today.includes('weekly class'), 'calendar parses events + weekly repeats', today.join(', '));
  // Google + Outlook feeds are merged and tagged
  const ics = t => ({ ics: ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'DTSTART:' + ymd + 'T120000', 'SUMMARY:' + t, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n') });
  const calCall = R.helper.call, saved = [R.cfg.calendarIcs, R.cfg.outlookIcs];
  R.helper.call = p => /^\/calendar/.test(p) ? Promise.resolve(ics(/outlook/.test(decodeURIComponent(p)) ? 'outlook meeting' : 'google event')) : calCall(p);
  window.livelyPropertyListener('calendarIcs', 'https://calendar.google.com/x/basic.ics');
  window.livelyPropertyListener('outlookIcs', 'webcal://outlook.live.com/owa/calendar/x/calendar.ics');
  await wait(50);
  const merged = R.calendar.eventsOn(d).map(e => e.title + '/' + e.src);
  log(merged.includes('google event/google') && merged.includes('outlook meeting/outlook'), 'Google and Outlook calendars both show', merged.join(', '));
  R.helper.call = calCall;
  window.livelyPropertyListener('calendarIcs', saved[0]); window.livelyPropertyListener('outlookIcs', saved[1]);
  click(find('calendar'));
  log(R.cfg.calendarIcs ? panelText().includes('today') : panelText().includes('iCal'), 'calendar opens (agenda, or setup steps when no link yet)');
  R.closePanel();

  // ---------- window + curtains ----------
  const wasOpen = R.windowState.open;
  click(R.windowPlane); step(2);
  log(R.windowState.open !== wasOpen && (!R.windowState.open || !!R.windowState.ambience), 'window opens with weather sounds', 'sound=' + R.windowState.ambience);
  if (R.windowState.open !== wasOpen) { click(R.windowPlane); step(1); }
  const k0 = R.curtainK;
  await drag(R.curtains[0], 120); step(0.5);
  log(R.curtainK > k0 + 0.3, 'drag curtain → room darker', 'curtain=' + R.curtainK.toFixed(2));
  click(R.curtains[0]); await wait(20); step(3);
  log(R.curtainK < 0.05 || R.curtainK > 0.95, 'click curtain → opens/closes fully');
  if (R.curtainK > 0.5) { click(R.curtains[0]); await wait(20); step(3); }

  // ---------- books ----------
  click(R.shelfBooks[0]);
  log(opened.some(p => p.startsWith('/open?url=')), 'book opens its link', 'hit: ' + (R.hovered && R.hovered.userData.label) + ' ' + decodeURIComponent(opened.filter(p => p.startsWith('/open'))[0] || ''));

  // ---------- bed ----------
  click(find('bed'), new THREE.Vector3(0.8, 0.5, 1.2));   // foot of the bed, away from the cat
  const bedHit = R.hovered && R.hovered.userData.label;
  step(5);
  log(R.sleeping && R.dimK > 0.9 && R.cat.mood === 'sleeping' && panelText().includes('good night'), 'bed → wind-down (dim, cat sleeps)', 'hit: ' + bedHit);
  if (button('wake up')) button('wake up').click(); else R.setSleep(false);
  step(5);
  log(!R.sleeping && R.dimK < 0.1, 'wake up');

  // ---------- sleepy cat, drawers, treats, sounds, typing ----------
  R.setSleep(true); step(3);
  const launches = opened.filter(p => p === '/launch/claude').length;
  click(R.cat.group); step(1);
  const said = () => { const b = document.getElementById('catSay'); return b && !b.hidden ? b.textContent : ''; };
  log(R.cat.mood !== 'sleeping' && opened.filter(p => p === '/launch/claude').length === launches && !!said(), 'click sleeping cat → wakes up and says something', said());
  R.setSleep(false); step(3);
  click(find('top drawer')); await wait(500); step(1);
  log(panelText().includes('memories') && !!panel.querySelector('img.memory'), 'top drawer → memories polaroid', R.photos.list.length + ' album photos');
  R.closePanel(); await wait(400); step(1);
  click(find('bottom drawer')); await wait(1200); step(2); await wait(400);
  log(R.cat.mood === 'happy' && /nom|TREATS|favourite|crunch/.test(said()), 'bottom drawer → treat flies to the cat', said());
  let sfxOk = true;
  try { ['crumple', 'thump', 'swish', 'rattle', 'crunch', 'meow'].forEach(k => R.sfx[k]()); R.sfx.sash(true); R.sfx.drawer(false); } catch (e) { sfxOk = false; }
  log(sfxOk, 'paper, window, curtain, drawer, treat and meow sounds play');
  const kd = (type, key) => { const e = new KeyboardEvent(type, { key, code: 'Key' + key.toUpperCase(), cancelable: true, bubbles: true }); window.dispatchEvent(e); return e; };
  const typed = data => { const e = new InputEvent('beforeinput', { inputType: 'insertText', data, cancelable: true, bubbles: true }); window.dispatchEvent(e); return e; };
  const d1 = kd('keydown', 'q'), d2 = kd('keydown', 'q'), t1 = typed('q'), t2 = typed('q'); kd('keyup', 'q');
  log(!d1.defaultPrevented && d2.defaultPrevented && !t1.defaultPrevented && t2.defaultPrevented, 'doubled keystroke from Lively is dropped');
  await wait(120);
  const d3 = kd('keydown', 'q'), t3 = typed('q'); kd('keyup', 'q');
  log(!d3.defaultPrevented && !t3.defaultPrevented, 'a real second press of the same key still types');

  // ---------- pomodoro → girl ----------
  click(find('focus timer'));
  log(R.pomo.mode === 'focus', 'tomato starts focus');
  step(1);
  log(R.girl.state === 'enter', 'girl walks in', R.girl.state);
  step(6);
  log(R.girl.state === 'focus', 'girl sits and studies', R.girl.state);
  document.getElementById('pomoSkip').click(); step(1);
  log(R.pomo.mode === 'break' && R.girl.state === 'break', 'break: girl leans back', R.girl.state);
  document.getElementById('pomoStop').click(); step(7);
  log(R.pomo.mode === 'idle' && R.girl.state === 'away', 'stop: girl leaves', R.girl.state);

  // ---------- rug ----------
  await R.helper.ping();
  log(R.helper.ok, 'helper reachable from the page', JSON.stringify(R.helper.state));
  if (R.helper.ok) {
    const S = R.rugState;
    step(3); await wait(300); step(3);
    const start = S.hidden;
    click(R.rug); await wait(800); step(2.2); await wait(500);
    let s = await R.helper.call('/state');
    log(S.hidden !== start && s.iconsVisible === !S.hidden, 'click rug: sweeps all icons ' + (start ? 'out' : 'under'));
    click(R.rug); await wait(800); step(2.2); await wait(500);
    s = await R.helper.call('/state');
    log(S.hidden === start && s.iconsVisible === !start, 'click again: back as before');
    if (!S.hidden) { click(R.rug); await wait(800); step(2.2); await wait(1500); step(1); }   // hide so there's something under it
    await drag(R.rug, 420); step(0.5);
    const shown = R.rug.children.filter(o => o.isMesh && o.geometry.type === 'PlaneGeometry' && o.visible && o.userData.label);
    log(S.peel > 0.5 && shown.length > 0, 'drag rug → it folds back, icons visible underneath', 'peel=' + S.peel.toFixed(2) + ', ' + shown.length + ' icons: ' + shown.slice(0, 3).map(o => o.userData.label.split(' ·')[0]).join(', '));
    if (shown.length) {
      const tile = shown[0];
      click(tile);
      log(opened.some(p => /\/(desktop|rug)\/open/.test(p)), 'click an icon under the rug → opens it');
    }
    click(R.rug); await wait(20); step(2);
    log(S.peel < 0.02, 'click lifted rug → lays flat again');
    if (S.hidden !== start) { click(R.rug); await wait(800); step(2.2); await wait(500); }
  }

  R.helper.call = realCall;
  log(errors === 0, 'no page errors', errors + ' errors');
  const pass = results.filter(Boolean).length;
  out.lines.push('SELFTEST DONE ' + pass + '/' + results.length + ' passed'); out.done = true;
  console.log(out.lines[out.lines.length - 1]);
})(window.R);
