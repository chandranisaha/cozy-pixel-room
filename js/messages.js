// The cat's letters: a little envelope on the bed next to the cat. It bounces when there's
// something new — your morning brief (Claude runs it every day after 7am through the helper)
// or a reminder that's due. Click it to read; add reminders there too.
(function (R) {
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const B = R.brief = { data: null, running: false, hasPage: false, ok: false };
  let reminders = R.store.get('reminders', []);
  const saveRem = () => R.store.set('reminders', reminders);
  R.store.watch('reminders', v => { reminders = v || []; R.emit('brief'); });
  R.store.watch('briefSeen', () => R.emit('brief'));

  const unread = () => {
    const briefNew = B.data && B.data.date === today() && R.store.get('briefSeen', '') !== B.data.date;
    return (briefNew ? 1 : 0) + reminders.filter(r => r.fired && !r.seen).length;
  };

  // ---------- brief ----------
  function pollBrief() {
    const before = JSON.stringify([B.data, B.running, B.hasPage, B.ok]);
    const changed = () => { if (JSON.stringify([B.data, B.running, B.hasPage, B.ok]) !== before) R.emit('brief'); };
    return R.helper.call('/brief', 4000).then(j => {
      const was = B.ok ? (B.data && B.data.date) : undefined;   // first poll stays quiet
      Object.assign(B, { data: j.brief, running: j.running, hasPage: j.hasPage, ok: true });
      if (B.data && B.data.date !== was && B.data.date === today() && was !== undefined) { R.toast('☀ your morning brief is here (the letter on the bed)'); R.emit('cat:alert'); }
      changed();
    }).catch(() => { B.ok = false; changed(); });
  }
  let briefTimer;
  function schedulePoll() { clearTimeout(briefTimer); briefTimer = setTimeout(() => pollBrief().finally(schedulePoll), B.running ? 10000 : 60000); }

  // ---------- reminders ----------
  function checkReminders() {
    let changed = false;
    reminders.forEach(r => {
      if (!r.fired && Date.now() >= r.at) {
        r.fired = true; changed = true;
        R.toast('⏰ ' + r.text);
        R.emit('cat:alert');
        R.sfx.pop(660); setTimeout(() => R.sfx.pop(880), 160);
      }
    });
    // forget acknowledged reminders after a day
    const n = reminders.length;
    reminders = reminders.filter(r => !(r.seen && Date.now() - r.at > 864e5));
    if (changed || n !== reminders.length) { saveRem(); R.emit('brief'); }
  }
  function parseWhen(s) {
    s = s.trim().toLowerCase();
    let m = /^(?:in\s*)?(\d+)\s*(m|min|mins|minutes|h|hr|hrs|hours)$/.exec(s) || /^in\s*(\d+)()$/.exec(s);
    if (m) return Date.now() + (+m[1]) * (m[2][0] === 'h' ? 3600e3 : 60e3);
    m = /^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?$/.exec(s);
    if (m) {
      let h = +m[1]; const min = +(m[2] || 0);
      if (m[3] === 'pm' && h < 12) h += 12;
      if (m[3] === 'am' && h === 12) h = 0;
      const d = new Date(); d.setHours(h, min, 0, 0);
      if (d < Date.now()) d.setDate(d.getDate() + 1);
      return +d;
    }
    return NaN;
  }
  const fmt = at => new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + (new Date(at).toDateString() !== new Date().toDateString() ? ' tmrw' : '');

  // ---------- the panel ----------
  function open() {
    if (B.data) R.store.set('briefSeen', B.data.date);
    reminders.forEach(r => { if (r.fired) r.seen = true; });
    saveRem();
    R.panel('letters from the cat ✉', render);
    R.emit('brief');
  }
  function render(body) {
    body.textContent = '';
    // brief
    body.append(R.el('h4', { text: '☀ morning brief' }));
    if (!B.ok) body.append(R.el('p', { cls: 'dim', text: 'start the helper (helper/start-helper.cmd) so Claude can write your brief every morning.' }));
    else if (B.data) {
      const stale = B.data.date !== today();
      body.append(R.el('p', { cls: 'headline', text: B.data.headline || '' }));
      if (stale) body.append(R.el('p', { cls: 'dim', text: 'from ' + B.data.date + ' · today\'s arrives after 7am' }));
      const icon = { attention: '!', sorted: '✓', info: '·' };
      body.append(R.el('ul', { cls: 'brief' }, (B.data.items || []).map(it => R.el('li', { cls: it.kind || 'info' }, R.el('b', { text: icon[it.kind] || '·' }), ' ' + it.text))));
    } else body.append(R.el('p', { cls: 'dim', text: B.running ? '' : 'no brief yet. it runs on its own each morning after 7am.' }));
    if (B.ok) {
      const row = R.el('div', { cls: 'prow' });
      if (B.running) row.append(R.el('span', { cls: 'dim', text: '✎ Claude is writing your brief… (a few minutes)' }));
      else {
        if (B.hasPage) row.append(R.el('button', { text: 'open full brief', onclick: () => R.helper.call('/brief/open').catch(e => R.toast(String(e.message || e))) }));
        row.append(R.el('button', { text: B.data ? '↻ write a fresh one' : 'write one now', onclick: () => R.helper.call('/brief/run').then(() => { B.running = true; schedulePoll(); render(body); }) }));
      }
      body.append(row);
    }

    // reminders
    body.append(R.el('h4', { text: '⏰ reminders' }));
    const upcoming = reminders.slice().sort((a, b) => a.at - b.at);
    if (!upcoming.length) body.append(R.el('p', { cls: 'dim', text: 'nothing yet. the cat will nag you when one is due.' }));
    body.append(R.el('ul', { cls: 'agenda' }, upcoming.map(r => R.el('li', { cls: r.fired ? 'past' : '' },
      R.el('b', { text: fmt(r.at) }), ' ' + r.text + ' ',
      R.el('button', { cls: 'x', text: '×', title: 'remove', onclick: () => { reminders = reminders.filter(x => x !== r); saveRem(); render(body); } })))));
    const text = R.el('input', { placeholder: 'remind me to…', maxlength: '80' });
    const when = R.el('input', { placeholder: 'in 30m / 6pm', maxlength: '12', cls: 'when' });
    const form = R.el('form', { cls: 'remform', autocomplete: 'off' }, text, when, R.el('button', { type: 'submit', text: '+' }));
    form.onsubmit = e => {
      e.preventDefault();
      const at = parseWhen(when.value || 'in 30m');
      if (!text.value.trim()) return text.focus();
      if (isNaN(at)) { R.toast('try "in 20m", "in 2h", "18:30" or "6pm"'); return when.focus(); }
      reminders.push({ id: Date.now(), text: text.value.trim(), at, fired: false });
      saveRem(); render(body);
      R.toast('ok! I\'ll remind you at ' + fmt(at));
    };
    body.append(form);
  }

  // ---------- the envelope on the bed ----------
  R.reminders = { list: () => reminders, check: () => checkReminders(), unread };

  R.buildMessages = function () {
    const env = R.group(0.35, 1.04, 0.95, R.bedGroup);
    env.rotation.y = -0.3;
    const tex = R.canvasTex(24, 16, g => {
      g.fillStyle = '#f7f2ea'; g.fillRect(0, 0, 24, 16);
      g.fillStyle = '#d8cfc0';
      for (let i = 0; i < 12; i++) { g.fillRect(i, i * 0.7, 1, 1); g.fillRect(23 - i, i * 0.7, 1, 1); }
      g.fillStyle = '#d0565b'; g.fillRect(10, 7, 4, 3);
    });
    const card = R.box(0.48, 0.03, 0.32, [R.mat('#e9e1d2'), R.mat('#e9e1d2'), R.texMat(tex), R.mat('#e9e1d2'), R.mat('#e9e1d2'), R.mat('#e9e1d2')], 0, 0.015, 0, env);
    const badgeTex = R.canvasTex(16, 16, g => {
      g.fillStyle = '#d0565b';
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (Math.hypot(x - 7.5, y - 7.5) < 7) g.fillRect(x, y, 1, 1);
      g.fillStyle = '#fff'; g.fillRect(7, 3, 2, 7); g.fillRect(7, 11, 2, 2);
    });
    const badge = new THREE.Sprite(new THREE.SpriteMaterial({ map: badgeTex, transparent: true }));
    badge.scale.set(0.3, 0.3, 1); badge.position.set(0, 0.5, 0); env.add(badge);

    let t = 0;
    R.tick(dt => {
      t += dt;
      const n = unread();
      badge.visible = n > 0;
      const hop = n > 0 ? Math.abs(Math.sin(t * 3)) * 0.12 : 0;
      card.position.y = R.damp(card.position.y, 0.015 + hop + (R.hovered === env ? 0.06 : 0), 12, dt);
      card.rotation.z = n > 0 ? Math.sin(t * 6) * 0.06 : 0;
      badge.position.y = 0.5 + Math.sin(t * 2) * 0.05;
    });
    R.makeClickable(env, 'letters · brief & reminders', open);

    R.on('brief', () => { if (R.panelOpen === 'letters from the cat ✉') render(document.querySelector('#panel .pbody')); });
    pollBrief().finally(schedulePoll);
    setInterval(checkReminders, 5000); checkReminders();
  };
})(window.R);
