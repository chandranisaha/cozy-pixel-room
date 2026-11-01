// Paper bin: every finished task crumples into a paper ball that flies from the desk into the
// bin. Click the bin to see what you got done.
(function (R) {
  const LOG_DAYS = 7;
  const log = R.store.get('doneLog', []).filter(e => Date.now() - e.at < LOG_DAYS * 864e5);
  const dayKey = d => new Date(d).toDateString();

  R.buildBin = function () {
    const pos = new THREE.Vector3(0.5, 0, -3.35);
    const bin = R.group(pos.x, 0, pos.z, R.room);
    const wick = R.mat('#b98a5a'), wickD = R.mat('#8f6440');
    // an open-topped basket: 4 walls + floor, slightly flared
    R.box(0.62, 0.05, 0.62, wickD, 0, 0.025, 0, bin);
    [[0, 0.3], [0, -0.3], [0.3, 0], [-0.3, 0]].forEach(([x, z], i) => {
      const w = R.box(i < 2 ? 0.66 : 0.06, 0.62, i < 2 ? 0.06 : 0.66, i % 2 ? wick : wickD, x, 0.31, z, bin);
      if (i < 2) w.rotation.x = z > 0 ? 0.08 : -0.08; else w.rotation.z = x > 0 ? -0.08 : 0.08;
    });
    const rim = R.mat('#d8a86a');
    [[0, 0.33, 0.72, 0.06], [0, -0.33, 0.72, 0.06], [0.33, 0, 0.06, 0.72], [-0.33, 0, 0.06, 0.72]].forEach(([x, z, w, d]) => R.box(w, 0.06, d, rim, x, 0.62, z, bin));

    const paper = R.mat('#f4efe4');
    const balls = [];
    function ball() { const m = R.box(0.22, 0.2, 0.22, paper, 0, 0, 0, R.room); m.castShadow = true; m.rotation.set(Math.random(), Math.random(), Math.random()); return m; }
    // balls already in the bin from today
    const today = log.filter(e => dayKey(e.at) === dayKey(Date.now()));
    function settle(m, i) { m.position.set(pos.x + ((i * 37) % 5 - 2) * 0.07, 0.5 + Math.min(i, 8) * 0.05, pos.z + ((i * 53) % 5 - 2) * 0.07); }
    today.slice(0, 10).forEach((e, i) => { const m = ball(); settle(m, i); balls.push(m); });

    R.store.watch('doneLog', v => {
      log.splice(0, log.length, ...(v || []));
      const n = log.filter(e => dayKey(e.at) === dayKey(Date.now())).length - balls.length - flying.length;
      for (let k = 0; k < n && balls.length < 10; k++) { const m = ball(); settle(m, balls.length); balls.push(m); }
    });
    const flying = [];
    const SHEET_AT = new THREE.Vector3(-1.45, 1.65, -3.35), CRUMPLE_S = 0.5, FLIGHT_S = 1.2;
    R.on('task:done', task => {
      log.push({ text: task.text, at: Date.now() });
      R.store.set('doneLog', log.slice(-200));
      R.sfx.crumple();
      const m = ball();
      m.position.copy(SHEET_AT); m.rotation.set(0, 0.3, 0); m.scale.set(2.4, 0.15, 3);
      flying.push({ m, t: -CRUMPLE_S, from: SHEET_AT.clone().setY(SHEET_AT.y + 0.25), n: balls.length });
    });

    R.tick(dt => {
      for (let k = flying.length - 1; k >= 0; k--) {
        const f = flying[k];
        f.t += dt;
        if (f.t < 0) {   // a flat sheet scrunching up into a ball on the desk
          const c = 1 + f.t / CRUMPLE_S, jit = Math.sin(f.t * 60) * 0.08 * (1 - c);
          f.m.scale.set(2.4 - 1.4 * c + jit, 0.15 + 0.85 * c, 3 - 2 * c - jit);
          f.m.position.y = SHEET_AT.y + 0.25 * c;
          f.m.rotation.y += dt * 4 * c;
          continue;
        }
        f.m.scale.set(1, 1, 1);
        const p = Math.min(1, f.t / FLIGHT_S);
        const to = new THREE.Vector3(pos.x, 0.5 + Math.min(f.n, 8) * 0.05, pos.z);
        f.m.position.lerpVectors(f.from, to, p);
        f.m.position.y += Math.sin(p * Math.PI) * 1.8;
        f.m.rotation.x += dt * 9; f.m.rotation.z += dt * 7;
        if (p >= 1) {
          settle(f.m, f.n); balls.push(f.m); flying.splice(k, 1);
          R.sfx.thump();
          bin.userData.wob = 0.5;
        }
      }
      if (bin.userData.wob > 0) { bin.userData.wob -= dt; bin.rotation.z = Math.sin(bin.userData.wob * 40) * bin.userData.wob * 0.12; }
      else bin.rotation.z = 0;
    });

    R.makeClickable(bin, 'paper bin · what you finished', () => {
      R.panel('done ✓', body => {
        const byDay = {};
        log.forEach(e => (byDay[dayKey(e.at)] = byDay[dayKey(e.at)] || []).push(e));
        const days = Object.keys(byDay).sort((a, b) => new Date(b) - new Date(a));
        if (!days.length) { body.append(R.el('p', { cls: 'dim', text: 'nothing crumpled yet. tick off a task and watch it fly in here.' })); return; }
        body.append(R.el('p', { text: log.length + ' tasks in the last ' + LOG_DAYS + ' days · ' + R.prod.focus + ' focus sessions today' }));
        days.forEach(d => {
          const label = d === dayKey(Date.now()) ? 'today' : new Date(d).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' });
          body.append(R.el('h4', { text: label + ' · ' + byDay[d].length }),
            R.el('ul', { cls: 'agenda' }, byDay[d].map(e => R.el('li', {}, R.el('b', { text: new Date(e.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }), ' ' + e.text))));
        });
        body.append(R.el('div', { cls: 'prow' }, R.el('button', {
          text: 'empty the bin', onclick: () => { balls.forEach(b => R.room.remove(b)); balls.length = 0; R.toast('bin emptied'); R.closePanel(); },
        })));
      });
    });
  };
})(window.R);
