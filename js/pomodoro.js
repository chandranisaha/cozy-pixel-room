// Pomodoro focus timer + productivity log. Drives the girl, plant and cat via events:
//   focus:start  focus:resume  focus:done  break:start  break:done  pomo:stop  task:done
(function (R) {
  const P = R.pomo = Object.assign({ mode: 'idle', endsAt: 0, pausedLeft: 0 }, R.store.get('pomo', {}));
  const save = () => R.store.set('pomo', { mode: P.mode, endsAt: P.endsAt, pausedLeft: P.pausedLeft });

  // ---------- productivity log ----------
  const today = () => new Date().toDateString();
  R.prod = Object.assign({ last: Date.now(), day: today(), focus: 0, tasks: 0 }, R.store.get('prod', {}));
  if (R.prod.day !== today()) Object.assign(R.prod, { day: today(), focus: 0, tasks: 0 });
  R.markProductive = (kind) => {
    if (R.prod.day !== today()) Object.assign(R.prod, { day: today(), focus: 0, tasks: 0 });
    R.prod.last = Date.now();
    if (kind) R.prod[kind]++;
    R.store.set('prod', R.prod);
  };

  R.store.watch('prod', v => Object.assign(R.prod, v));
  R.store.watch('pomo', v => {
    const was = P.mode, wasPaused = !!P.pausedLeft;
    Object.assign(P, v);
    if (P.mode !== was) R.emit(P.mode === 'focus' ? 'focus:start' : P.mode === 'break' ? 'break:start' : 'pomo:stop');
    else if (!!P.pausedLeft !== wasPaused) R.emit('pomo:pause', !!P.pausedLeft);
  });

  P.left = () => P.pausedLeft > 0 ? P.pausedLeft : Math.max(0, P.endsAt - Date.now());
  P.running = () => (P.mode === 'focus' || P.mode === 'break') && !P.pausedLeft;
  P.total = () => R.min(P.mode === 'break' ? +R.cfg.breakMin : +R.cfg.focusMin);

  P.startFocus = () => {
    P.mode = 'focus'; P.endsAt = Date.now() + R.min(+R.cfg.focusMin); P.pausedLeft = 0; save();
    R.emit('focus:start');
  };
  P.startBreak = () => {
    P.mode = 'break'; P.endsAt = Date.now() + R.min(+R.cfg.breakMin); P.pausedLeft = 0; save();
    R.emit('break:start');
  };
  P.pause = () => {
    if (P.mode === 'idle') return;
    if (P.pausedLeft) { P.endsAt = Date.now() + P.pausedLeft; P.pausedLeft = 0; }
    else P.pausedLeft = P.left();
    save(); R.emit('pomo:pause', !!P.pausedLeft);
  };
  P.stop = () => { P.mode = 'idle'; P.endsAt = 0; P.pausedLeft = 0; save(); R.emit('pomo:stop'); };
  P.primary = () => {
    if (P.mode === 'idle') P.startFocus();
    else P.pause();
  };

  function check() {
    if (!P.running() || P.left() > 0) return;
    if (P.mode === 'focus') {
      R.markProductive('focus');
      R.emit('focus:done');
      R.toast('focus session done — plant watered 🌱');
      chime();
      P.startBreak();
    } else {
      R.emit('break:done');
      R.toast('break over');
      chime();
      P.stop();
    }
  }

  function chime() {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      [880, 1175, 1568].forEach((f, i) => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.frequency.value = f; o.type = 'triangle';
        const t = ac.currentTime + i * 0.15;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.15, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
        o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 0.7);
      });
      setTimeout(() => ac.close(), 1500);
    } catch (e) {}
  }

  const fmt = ms => {
    const s = Math.ceil(ms / (R.debug ? 1000 / 60 : 1000));
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  };
  P.fmt = fmt;

  // ---------- desk props: tomato timer + laptop ----------
  R.buildPomodoro = function () {
    const tom = R.group(-3.0, 1.61, -3.35, R.room);
    R.box(0.32, 0.26, 0.32, R.mat('#d9534f'), 0, 0.13, 0, tom);
    R.box(0.26, 0.04, 0.26, R.mat('#c4433f'), 0, 0.28, 0, tom);
    R.box(0.08, 0.08, 0.08, R.mat('#5e8c5a'), 0, 0.33, 0, tom);
    R.box(0.2, 0.03, 0.06, R.mat('#6fa55f'), 0.06, 0.31, 0, tom);
    const dial = R.box(0.04, 0.12, 0.02, R.mat('#fff3d6'), 0, 0.14, 0.17, tom);
    R.makeClickable(tom, 'focus timer', () => {
      const wasIdle = P.mode === 'idle';
      P.primary();
      R.toast(wasIdle ? 'focus started (' + R.cfg.focusMin + ' min)' : (P.pausedLeft ? 'paused' : 'resumed'));
    });

    // laptop with a screen that mirrors the timer / tasks
    const lap = R.group(-2.0, 1.61, -3.85, R.room);
    R.box(1.0, 0.05, 0.7, R.mat('#c9c4d6'), 0, 0.025, 0.1, lap);
    const lid = R.group(0, 0.05, -0.25, lap);
    lid.rotation.x = -0.25;
    R.box(1.0, 0.68, 0.04, R.mat('#c9c4d6'), 0, 0.34, 0, lid);
    const [sc, sg] = R.canvas(48, 32);
    const screenTex = R.nearest(new THREE.CanvasTexture(sc));
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), new THREE.MeshBasicMaterial({ map: screenTex }));
    screen.position.set(0, 0.34, 0.025); lid.add(screen);
    const glow = new THREE.PointLight('#8fb6ff', 1.2, 2.5, 2);
    glow.position.set(0, 0.4, 0.4); lid.add(glow);
    R.laptopScreen = screen;
    R.makeClickable(lap, 'laptop · tasks', () => R.emit('hud:toggle'));

    function drawScreen() {
      const focus = P.mode === 'focus', brk = P.mode === 'break';
      sg.fillStyle = focus ? '#2a2456' : brk ? '#24463a' : '#1d2440'; sg.fillRect(0, 0, 48, 32);
      sg.fillStyle = '#ffffff22'; sg.fillRect(0, 0, 48, 4);
      sg.fillStyle = '#ff7a7a'; sg.fillRect(1, 1, 2, 2);
      sg.fillStyle = '#f7c86b'; sg.fillRect(4, 1, 2, 2);
      sg.fillStyle = '#fff3d6';
      sg.font = 'bold 10px monospace';
      if (focus || brk) {
        sg.fillText(fmt(P.left()), 6, 18);
        sg.font = '6px monospace';
        sg.fillText(P.pausedLeft ? 'paused' : focus ? 'focus' : 'break', 6, 27);
        const f = 1 - P.left() / P.total();
        sg.fillStyle = '#f7c86b'; sg.fillRect(30, 26, Math.round(f * 15), 2);
      } else {
        const open = (R.tasks ? R.tasks.list.filter(t => !t.done).length : 0);
        sg.font = '6px monospace';
        sg.fillText(open + ' tasks left', 4, 14);
        sg.fillText('focus x' + R.prod.focus, 4, 22);
        sg.fillText('done x' + R.prod.tasks, 4, 29);
      }
      screenTex.needsUpdate = true;
      glow.intensity = focus ? 1.6 : 0.8;
    }

    let acc = 1;
    R.tick(dt => {
      acc += dt;
      if (P.mode !== 'idle') dial.parent.rotation.y = -(1 - P.left() / P.total()) * Math.PI * 2;
      else dial.parent.rotation.y = R.damp(dial.parent.rotation.y, 0, 4, dt);
      if (acc > 0.25) { acc = 0; check(); drawScreen(); R.emit('pomo:tick'); }
    });

    // resume a session that was running before a reload
    if (P.mode === 'focus' || P.mode === 'break') {
      if (P.left() <= 0 && !P.pausedLeft) { if (P.mode === 'focus') check(); else P.stop(); }
      else setTimeout(() => R.emit(P.mode === 'focus' ? 'focus:resume' : 'break:start'), 0);
    }
  };
})(window.R);
