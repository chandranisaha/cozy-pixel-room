// Wind-down: click the bed and the room settles for the night — lights dim, the lamp goes
// off, music fades, soft brown noise plays, the cat curls up, and a card shows tomorrow's
// first event. Click the bed again (or "wake up") to come back.
(function (R) {
  R.sleeping = false;
  let noise = null;

  function firstTomorrow() {
    const C = R.calendar;
    if (!C || !C.loaded) return null;
    const tom = new Date(); tom.setDate(tom.getDate() + 1);
    return C.eventsOn(tom).find(e => !e.allDay) || C.eventsOn(tom)[0] || null;
  }

  function card() {
    R.panel('good night 🌙', body => {
      const ev = firstTomorrow();
      body.append(
        R.el('p', { text: 'today: ' + R.prod.focus + ' focus sessions · ' + R.prod.tasks + ' tasks done' }),
        ev ? R.el('p', {}, 'tomorrow starts with ', R.el('b', { text: ev.title }), ' at ' + R.calendar.fmtTime(ev))
           : R.el('p', { cls: 'dim', text: R.calendar.feeds().length ? 'nothing on the calendar tomorrow morning' : 'add your calendar link in Customise to see tomorrow here' }),
        R.el('div', { cls: 'prow' }, R.el('button', { text: '☀ wake up', onclick: () => set(false) })));
    });
  }

  function set(on) {
    if (on === R.sleeping) return;
    R.sleeping = on;
    if (on) {
      if (R.music.playing) R.music.stop();
      if (R.lamp.on) { R.lamp.on = false; lampOff(); }
      noise = R.sfx.brown(); R.sfx.fade(noise, 0.35 * (R.cfg.musicVolume / 100 + 0.2), 3);
      card();
    } else {
      if (noise) { const n = noise; R.sfx.fade(n, 0, 1); setTimeout(() => n.stop(), 2500); noise = null; }
      if (R.panelOpen === 'good night 🌙') R.closePanel();
      R.toast('good morning ☀');
    }
    R.emit('sleep', on);
  }
  function lampOff() { R.lamp.on = false; R.lamp.light.visible = false; R.lamp.bulb.material.color.set('#5a5560'); R.store.set('lampOn', false); }
  R.setSleep = set;

  R.buildBed = function () {
    const bed = R.bedGroup;
    R.makeClickable(bed, 'bed · wind down', () => set(!R.sleeping));
    // a soft glowing crescent over the bed while winding down
    const moonTex = R.canvasTex(16, 16, g => {
      g.fillStyle = '#fff3c4';
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        if (Math.hypot(x - 7.5, y - 7.5) < 6.5 && Math.hypot(x - 10.5, y - 5.5) > 5) g.fillRect(x, y, 1, 1);
      }
    });
    const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, transparent: true, opacity: 0 }));
    moon.scale.set(0.5, 0.5, 1); moon.position.set(0, 2.6, -0.6); bed.add(moon);
    let t = 0;
    R.tick(dt => {
      t += dt;
      R.dimK = R.damp(R.dimK || 0, R.sleeping ? 1 : 0, 0.8, dt);
      moon.material.opacity = R.dimK * (0.75 + 0.25 * Math.sin(t * 1.5));
      moon.visible = moon.material.opacity > 0.02;
      moon.position.y = 2.6 + Math.sin(t * 0.8) * 0.08;
    });
  };
})(window.R);
