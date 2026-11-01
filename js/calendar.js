// Paper wall calendar: today's date + events from your Google Calendar (the "secret address
// in iCal format") and/or Outlook calendar (Settings → Shared calendars → Publish → ICS),
// pasted into Lively → Customise. Click for the agenda.
// The page tears off at midnight.
(function (R) {
  const C = R.calendar = { events: [], loaded: false, error: '' };
  const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const DAY = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const BYDAY = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

  // ---------- tiny iCal parser (single + simple recurring events) ----------
  function parseDate(v, params) {
    const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/.exec(v);
    if (!m) return null;
    const allDay = !m[4] || /VALUE=DATE(?!-)/.test(params);
    if (allDay) return { d: new Date(+m[1], m[2] - 1, +m[3]), allDay: true };
    const args = [+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]];
    return { d: m[7] ? new Date(Date.UTC(...args)) : new Date(...args), allDay: false };
  }
  function parseICS(text) {
    const lines = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
    const evs = [];
    let ev = null;
    for (const ln of lines) {
      if (ln === 'BEGIN:VEVENT') { ev = { exdates: [] }; continue; }
      if (ln === 'END:VEVENT') { if (ev && ev.start) evs.push(ev); ev = null; continue; }
      if (!ev) continue;
      const i = ln.indexOf(':');
      if (i < 0) continue;
      const [name, ...ps] = ln.slice(0, i).split(';'), params = ps.join(';'), val = ln.slice(i + 1);
      if (name === 'SUMMARY') ev.title = val.replace(/\\,/g, ',').replace(/\\n/g, ' ').replace(/\\/g, '');
      else if (name === 'DTSTART') { const p = parseDate(val, params); if (p) { ev.start = p.d; ev.allDay = p.allDay; } }
      else if (name === 'DTEND') { const p = parseDate(val, params); if (p) ev.end = p.d; }
      else if (name === 'RRULE') ev.rrule = Object.fromEntries(val.split(';').map(kv => kv.split('=')));
      else if (name === 'EXDATE') val.split(',').forEach(v => { const p = parseDate(v, params); if (p) ev.exdates.push(p.d.toDateString()); });
      else if (name === 'STATUS' && val === 'CANCELLED') ev.cancelled = true;
    }
    return evs.filter(e => !e.cancelled);
  }
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  // occurrences of ev on `day` (a Date at local midnight)
  function occursOn(ev, day) {
    const s = ev.start, dayEnd = new Date(day); dayEnd.setDate(dayEnd.getDate() + 1);
    const at = d => { const o = new Date(day); o.setHours(d.getHours(), d.getMinutes(), 0, 0); return o; };
    if (!ev.rrule) {
      const end = ev.end || s;
      return (s < dayEnd && (end > day || sameDay(s, day))) ? [ev.allDay ? day : s] : [];
    }
    if (s >= dayEnd || ev.exdates.includes(at(s).toDateString())) return [];
    const r = ev.rrule, interval = +(r.INTERVAL || 1);
    if (r.UNTIL) { const u = parseDate(r.UNTIL, ''); if (u && u.d < day) return []; }
    const startDay = new Date(s.getFullYear(), s.getMonth(), s.getDate());
    const daysSince = Math.round((day - startDay) / 864e5);
    let ok = false, n = 0;
    if (r.FREQ === 'DAILY') { ok = daysSince % interval === 0; n = daysSince / interval; }
    else if (r.FREQ === 'WEEKLY') {
      const days = r.BYDAY ? r.BYDAY.split(',').map(d => BYDAY[d.slice(-2)]) : [s.getDay()];
      const weeks = Math.floor((daysSince + startDay.getDay()) / 7);
      ok = days.includes(day.getDay()) && weeks % interval === 0;
      n = weeks * days.length;
    } else if (r.FREQ === 'MONTHLY') { ok = day.getDate() === s.getDate(); n = (day.getFullYear() - s.getFullYear()) * 12 + day.getMonth() - s.getMonth(); }
    else if (r.FREQ === 'YEARLY') { ok = day.getDate() === s.getDate() && day.getMonth() === s.getMonth(); n = day.getFullYear() - s.getFullYear(); }
    if (r.COUNT && n >= +r.COUNT) ok = false;
    return ok ? [ev.allDay ? day : at(s)] : [];
  }
  C.eventsOn = function (date) {
    const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const out = [];
    for (const ev of C.events) for (const at of occursOn(ev, day)) out.push({ title: ev.title || '(busy)', at, allDay: ev.allDay, src: ev.src });
    return out.sort((a, b) => (a.allDay ? -1 : 0) - (b.allDay ? -1 : 0) || a.at - b.at);
  };
  C.parse = parseICS;
  C.fmtTime = e => e.allDay ? 'all day' : e.at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  const FEEDS = { calendarIcs: 'google', outlookIcs: 'outlook' };
  C.feeds = () => Object.keys(FEEDS).filter(k => (R.cfg[k] || '').trim());
  function refresh() {
    const feeds = C.feeds();
    if (!feeds.length) { C.events = []; C.loaded = false; C.error = ''; R.emit('calendar'); return; }
    const errors = [];
    Promise.all(feeds.map(k => {
      const url = R.cfg[k].trim().replace(/^webcal:/i, 'https:');
      return R.helper.call(R.helper.q('/calendar', { url }), 20000)
        .then(j => parseICS(j.ics || '').map(ev => Object.assign(ev, { src: FEEDS[k] })))
        .catch(e => { errors.push(FEEDS[k] + ': ' + (R.helper.ok ? String(e.message || e) : 'start the helper to load your calendar')); return []; });
    })).then(lists => {
      C.events = [].concat(...lists); C.loaded = errors.length < feeds.length; C.error = errors.join(' · ');
      R.emit('calendar');
    });
  }

  // ---------- the paper calendar ----------
  function drawPage(g, now) {
    g.fillStyle = '#f7f2ea'; g.fillRect(0, 0, 40, 48);
    g.fillStyle = '#d0565b'; g.fillRect(0, 0, 40, 11);
    g.fillStyle = '#fff3d6'; g.font = 'bold 8px monospace'; g.textAlign = 'center';
    g.fillText(MON[now.getMonth()] + ' ' + String(now.getFullYear()).slice(2), 20, 8);
    g.fillStyle = '#3a3560'; g.font = 'bold 18px monospace';
    g.fillText(String(now.getDate()), 20, 28);
    g.font = '6px monospace'; g.fillStyle = '#8a8496';
    g.fillText(DAY[now.getDay()].slice(0, 3), 20, 35);
    const evs = C.loaded ? C.eventsOn(now).filter(e => e.allDay || e.at > Date.now() - 36e5) : [];
    evs.slice(0, 2).forEach((e, k) => { g.fillStyle = ['#6aa0a8', '#f7c86b'][k]; g.fillRect(4, 38 + k * 4, 32, 3); });
    if (evs.length > 2) { g.fillStyle = '#c25b5b'; g.fillRect(34, 44, 3, 3); }
    // spiral binding
    g.fillStyle = '#2c2a3a'; for (let x = 5; x < 40; x += 6) g.fillRect(x, 0, 2, 2);
  }
  R.buildCalendar = function () {
    const grp = R.group(-5.97, 3.35, -3.65, R.room);
    grp.rotation.y = Math.PI / 2;
    R.box(0.9, 1.1, 0.03, R.mat('#c9b48a'), 0, 0, -0.02, grp);            // backing card
    const tex = R.canvasTex(40, 48, () => {});
    const page = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.96), R.texMat(tex));
    page.position.z = 0.01; grp.add(page);
    const redraw = () => { drawPage(tex.userData.ctx, new Date()); tex.needsUpdate = true; };
    redraw();

    // tear-off: yesterday's page falls when the date changes
    const oldTex = R.canvasTex(40, 48, () => {});
    const falling = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.96), R.texMat(oldTex, { transparent: true, side: THREE.DoubleSide }));
    falling.visible = false; R.room.add(falling);
    let fall = 0, day = new Date().toDateString();
    function tearOff() {
      oldTex.userData.ctx.drawImage(tex.userData.canvas, 0, 0); oldTex.needsUpdate = true;
      falling.position.set(-5.9, 3.35, -3.65); falling.rotation.set(0, Math.PI / 2, 0);
      falling.material.opacity = 1; falling.visible = true; fall = 1;
      redraw();
    }
    C.tearOff = tearOff;
    let acc = 0;
    R.tick(dt => {
      acc += dt;
      if (acc > 5) { acc = 0; const d = new Date().toDateString(); if (d !== day) { day = d; tearOff(); refresh(); } }
      if (fall > 0) {
        fall -= dt * 0.45;
        falling.position.x += dt * 0.6; falling.position.y = Math.max(0.05, falling.position.y - dt * 1.6);
        falling.rotation.z += dt * 2.2; falling.rotation.x -= dt * 1.2;
        falling.material.opacity = R.clamp(fall * 2, 0, 1);
        if (fall <= 0) falling.visible = false;
      }
      grp.rotation.z = R.damp(grp.rotation.z, R.hovered === grp ? 0.05 : 0, 8, dt);
    });

    R.on('calendar', redraw);
    R.on('cfg', e => { if (e.name in FEEDS) refresh(); });
    refresh();
    setInterval(refresh, 10 * 60 * 1000);

    R.makeClickable(grp, 'calendar · today', () => {
      const now = new Date(), tom = new Date(now); tom.setDate(now.getDate() + 1);
      R.panel(DAY[now.getDay()] + ', ' + now.getDate() + ' ' + MON[now.getMonth()].toLowerCase(), body => {
        if (!C.feeds().length) {
          body.append(R.el('p', { text: 'Show your Google and Outlook calendars here:' }),
            R.el('ol', {},
              R.el('li', { text: 'Google Calendar → Settings → your calendar → "Secret address in iCal format" → copy' }),
              R.el('li', { text: 'Outlook → Settings → Calendar → Shared calendars → Publish a calendar → "Can view all details" → copy the ICS link' }),
              R.el('li', { text: 'Lively → right-click this wallpaper → Customise → paste into the calendar links' })));
          return;
        }
        if (C.error) body.append(R.el('p', { cls: 'warn', text: C.error }));
        const list = (title, evs) => {
          body.append(R.el('h4', { text: title }));
          if (!evs.length) body.append(R.el('p', { cls: 'dim', text: C.loaded ? 'nothing scheduled ✨' : 'loading…' }));
          else body.append(R.el('ul', { cls: 'agenda' }, evs.map(e => R.el('li', { cls: !e.allDay && e.at < now ? 'past' : '' }, R.el('b', { text: C.fmtTime(e) }), ' ' + e.title + ' ', C.feeds().length > 1 ? R.el('span', { cls: 'src ' + e.src, text: e.src }) : ''))));
        };
        list('today', C.eventsOn(now));
        list('tomorrow', C.eventsOn(tom));
      });
    });
  };
})(window.R);
