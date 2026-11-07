// Music: built-in generative stations (lofi, jazz, rain), your own files/stream, and
// links to Spotify playlists from the record crate. The vinyl spins only while something
// actually plays — our own audio, or any system audio (e.g. Spotify) reported by Lively.
(function (R) {
  const M = R.music = { playing: false, station: null, sysLevel: 0, sysBass: 0, sysHeld: -1e9, nowPlaying: '', artist: '' };

  // ---------- Lively hooks ----------
  window.livelyAudioListener = function (arr) {
    let s = 0, b = 0;
    const n = arr.length, nb = Math.max(1, Math.floor(n / 12));
    for (let i = 0; i < n; i++) { s += arr[i]; if (i < nb) b += arr[i]; }
    M.sysLevel = s / Math.max(1, n);
    M.sysBass = b / nb;
    if (M.sysLevel > 0.004) M.sysHeld = performance.now();
  };
  window.livelyCurrentTrack = function (data) {
    try {
      const o = data ? JSON.parse(data) : null;
      M.nowPlaying = o && o.Title ? o.Title + (o.Artist ? ' — ' + o.Artist : '') : '';
      M.artist = (o && o.Artist) || '';
    } catch (e) { M.nowPlaying = ''; M.artist = ''; }
    trackAt = performance.now();
    R.emit('track', M.nowPlaying);
  };
  M.systemAudio = () => performance.now() - M.sysHeld < 1500;

  // ---------- Spotify (app or browser) through Windows' media controls, via the helper ----------
  M.media = { active: false };
  let trackAt = -1e9;     // when Lively last told us the track
  function gotMedia(j) {
    M.media = j || { active: false };
    if (performance.now() - trackAt > 10000) {
      const np = M.media.active && M.media.title ? M.media.title + (M.media.artist ? ' — ' + M.media.artist : '') : '';
      if (np !== M.nowPlaying) { M.nowPlaying = np; M.artist = M.media.artist || ''; R.emit('track', np); }
    }
    R.emit('media', M.media);
  }
  M.pollMedia = () => R.helper.call('/media', 6000).then(gotMedia).catch(() => {});
  M.mediaCmd = what => R.helper.call('/media/' + what, 8000).then(j => { gotMedia(j); return j; });
  setInterval(M.pollMedia, 4000);
  // a Spotify record: the helper opens it in the app and presses its Play button (replacing
  // whatever was playing there). Anything else that's a link just opens.
  const spotifyUri = url => {
    const m = /^spotify:(playlist|album|artist):([A-Za-z0-9]{22})$/.exec(url) || /open\.spotify\.com\/(playlist|album|artist)\/([A-Za-z0-9]{22})/.exec(url);
    return m ? 'spotify:' + m[1] + ':' + m[2] : null;
  };
  // The amp's click-to-mute turns Spotify itself down to 0 in the Windows mixer, and that sticks
  // after the room reloads, so a record picked later played silently. Picking a record un-mutes it.
  const unmuteSpotify = () => R.helper.call(R.helper.q('/volume', { app: 'spotify' }), 3000)
    .then(j => {
      if (!(j && j.volume < 0.05)) return;
      return R.helper.call(R.helper.q('/volume', { app: 'spotify', v: '0.600' }), 3000)
        .then(() => { R.emit('spotify:unmuted', 0.6); R.toast('Spotify was muted · turned it back up to 60%'); });
    })
    .catch(() => {});
  // One record at a time: a second pick while Spotify is still starting the first waits for it,
  // and only the latest pick is played after that.
  let starting = null, queued = null;
  M.playLink = r => {
    const uri = spotifyUri(r.url);
    if (!uri) { R.openLink(r.url); return Promise.resolve(); }
    if (starting) { queued = r; R.toast('next up: ' + r.title); return starting.then(() => {}, () => {}); }
    R.toast('starting ' + r.title + ' on Spotify…');
    const attempt = () => R.helper.call(R.helper.q('/media/play', { uri, name: r.title }), 40000);
    starting = attempt()
      .catch(e => /busy|fetch|network/i.test(String(e.message || e)) ? new Promise(ok => setTimeout(ok, 1500)).then(attempt) : Promise.reject(e))
      .then(gotMedia)
      .then(unmuteSpotify)
      .catch(e => { R.toast(String(e.message || e)); throw e; })
      .finally(() => {
        starting = null;
        if (queued) { const n = queued; queued = null; M.playLink(n); }
      });
    return starting;
  };
  // play/pause for whatever is playing: Spotify (or any app) through Windows, else the room's own music
  M.playPause = () => {
    if (M.media.active) {
      M.media.playing = !M.media.playing; R.emit('media', M.media);      // feels instant; the poll confirms
      return M.mediaCmd('toggle').catch(e => R.toast(String(e.message || e)));
    }
    if (M.playing) return M.stop();
    if (M.links.length && M.lastRecord && M.lastRecord.startsWith('link')) { const r = M.links.find(x => x.id === M.lastRecord); if (r) return M.playLink(r); }
    M.play(R.store.get('station', 'lofi'));
  };
  M.next = () => M.media.active ? M.mediaCmd('next').catch(e => R.toast(String(e.message || e))) : null;
  M.pauseSpotify = () => {
    if (M.media.active && M.media.playing && /spotify/i.test(M.media.app || '')) M.mediaCmd('toggle').catch(() => {});
  };
  M.swap = (r, done) => done();   // replaced by the turntable's record-change animation
  M.spinning = () => M.playing || M.systemAudio() || !!(M.media.active && M.media.playing);

  // ---------- stations ----------
  // palette: which light mood (vibe.js) the station sets
  const files = () => (R.cfg.streamUrl ? [R.cfg.streamUrl] : ((window.ROOM_ASSETS && window.ROOM_ASSETS.music) || []));
  M.stations = [
    { id: 'lofi', title: 'lofi beats', color: '#e57b5f', label: '#f7c86b', palette: 'lofi', kind: 'synth',
      bpm: 72, chords: [[50, 53, 57, 60, 64], [55, 59, 62, 65, 69], [48, 52, 55, 59, 62], [45, 48, 52, 55, 60]], lead: [69, 72, 74, 76, 79, 81], drums: 'lofi', cutoff: 1600 },
    { id: 'jazz', title: 'late-night jazz', color: '#3c5a8a', label: '#e9c46a', palette: 'jazz', kind: 'synth',
      bpm: 92, chords: [[50, 53, 57, 60, 64], [43, 47, 53, 57, 62], [48, 52, 55, 59, 64], [45, 49, 52, 55, 61]], lead: [62, 65, 67, 69, 72, 74], drums: 'brush', cutoff: 2200, walk: true },
    { id: 'rain', title: 'rain on the window', color: '#5d7fa8', label: '#bcd3ea', palette: 'rain', kind: 'rain' },
  ];
  if (files().length) M.stations.unshift({ id: 'mine', title: 'my music', color: '#7f6bb0', label: '#f6b6c4', palette: 'cozy', kind: 'file' });
  // records that open elsewhere (Spotify playlists etc.), from assets/manifest.js
  M.links = ((window.ROOM_ASSETS && window.ROOM_ASSETS.records) || []).map((r, i) => Object.assign({ id: 'link' + i, kind: 'link', color: '#5e8c5a', label: '#a9dcc8' }, r));

  // ---------- audio graph ----------
  let master, analyser, freqData, lp;
  function graph() {
    if (master) return;
    const ac = R.ac();
    lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1600; lp.Q.value = 0.4;
    master = ac.createGain(); master.gain.value = 0;
    analyser = ac.createAnalyser(); analyser.fftSize = 256; analyser.smoothingTimeConstant = 0.6;
    freqData = new Uint8Array(analyser.frequencyBinCount);
    master.connect(lp); lp.connect(analyser); analyser.connect(ac.destination);
    // vinyl crackle bed
    const crackleBuf = ac.createBuffer(1, ac.sampleRate * 3, ac.sampleRate);
    const cd = crackleBuf.getChannelData(0);
    for (let i = 0; i < cd.length; i++) cd[i] = Math.random() < 0.0009 ? (Math.random() * 2 - 1) : (Math.random() * 2 - 1) * 0.015;
    const cr = ac.createBufferSource(); cr.buffer = crackleBuf; cr.loop = true;
    const cg = ac.createGain(); cg.gain.value = 0.35; cr.connect(cg); cg.connect(master); cr.start();
  }
  // 0..1 bass energy of whatever is playing (ours, or system audio via Lively)
  M.level = () => {
    if (M.playing && analyser) {
      analyser.getByteFrequencyData(freqData);
      let b = 0; for (let i = 1; i < 8; i++) b += freqData[i];
      return b / 7 / 255;
    }
    return M.systemAudio() ? R.clamp(M.sysBass * 1.4, 0, 1) : 0;
  };

  // ---------- generative synth ----------
  let timer, nextT = 0, step = 0, st;
  const hz = n => 440 * Math.pow(2, (n - 69) / 12);
  function note(freq, t, dur, vol, type = 'sine') {
    const ac = R.ac(), o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = freq; o.detune.value = (Math.random() - 0.5) * 12;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.03);
    g.gain.exponentialRampToValueAtTime(vol * 0.4, t + 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(t, dur, vol, freq, type) {
    const ac = R.ac(), s = ac.createBufferSource(); s.buffer = R.sfx.noiseBuf();
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + dur);
  }
  function kick(t, vol = 0.5) {
    const ac = R.ac(), o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.25);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.4);
  }
  function schedule() {
    const ac = R.ac(), STEP = 60 / st.bpm / 2;
    while (nextT < ac.currentTime + 0.25) {
      const s = step % 16, bar = Math.floor(step / 16) % 4;
      const swing = (s % 2) ? STEP * (st.drums === 'brush' ? 0.3 : 0.18) : 0;
      const t = nextT + swing, ch = st.chords[bar];
      if (s === 0) ch.forEach((n, i) => note(hz(n), t + i * 0.012, STEP * 15, 0.05, i ? 'sine' : 'triangle'));
      if (st.walk) { if (s % 4 === 0) note(hz(ch[(s / 4) % ch.length] - 24 + (s === 12 ? 2 : 0)), t, STEP * 3.5, 0.13, 'triangle'); }
      else {
        if (s === 0) note(hz(ch[0] - 12), t, STEP * 7, 0.12, 'sine');
        if (s === 8) note(hz(ch[0] - 12), t, STEP * 6, 0.1, 'sine');
      }
      if (st.drums === 'lofi') {
        if (s === 0 || s === 7 || s === 10) kick(t);
        if (s === 4 || s === 12) noise(t, 0.18, 0.12, 1800, 'bandpass');
        if (s % 2 === 0) noise(t, 0.04, 0.03, 7000, 'highpass');
      } else {
        if (s === 0 || s === 8) kick(t, 0.25);
        if (s % 2 === 0) noise(t, 0.22, 0.035, 4500, 'bandpass');       // brushes
        if (s === 4 || s === 12) noise(t, 0.1, 0.05, 2500, 'bandpass');
      }
      if (s % 4 === 2 && Math.random() < 0.35) note(hz(st.lead[Math.floor(Math.random() * st.lead.length)]), t, STEP * 3, 0.035, 'triangle');
      nextT += STEP; step++;
    }
  }

  // ---------- file / stream player ----------
  let audio, idx = 0, ambient;
  function fileStart() {
    const list = files();
    if (!audio) {
      audio = new Audio();
      audio.addEventListener('ended', () => { idx = (idx + 1) % list.length; audio.src = R.asset(list[idx]); audio.play(); });
    }
    audio.volume = R.cfg.musicVolume / 100;
    if (!audio.src) audio.src = R.asset(list[idx]);
    audio.play().catch(() => { stop(); R.toast('could not play ' + list[idx]); });
  }

  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
    if (master) master.gain.setTargetAtTime(0, R.ac().currentTime, 0.3);
    if (audio) audio.pause();
    if (ambient) { const a = ambient; R.sfx.fade(a, 0, 0.6); setTimeout(() => a.stop(), 1200); ambient = null; }
    M.playing = false;
  }
  M.play = function (id) {
    const s = M.stations.find(x => x.id === id) || M.stations[0];
    stop();
    graph();
    const ac = R.ac(), vol = R.cfg.musicVolume / 100 * 0.8;
    M.station = s;
    if (s.kind === 'synth') {
      st = s; lp.frequency.value = s.cutoff;
      nextT = ac.currentTime + 0.1; step = 0;
      master.gain.setTargetAtTime(vol, ac.currentTime, 0.4);
      timer = setInterval(schedule, 60);
    } else if (s.kind === 'rain') {
      ambient = R.sfx.rain(master);
      ambient.gain.gain.value = 1;
      master.gain.setTargetAtTime(vol, ac.currentTime, 0.4);
    } else if (s.kind === 'file') fileStart();
    M.playing = true;
    R.store.set('station', s.id);
    R.emit('music', true);
    if (R.userActive()) R.share('music', { playing: true, station: s.id });
  };
  M.stop = () => { stop(); R.emit('music', false); if (R.userActive()) R.share('music', { playing: false }); };
  // music started on the other screen plays here too (only one screen has sound)
  R.on('remote:music', e => (e.playing ? M.play(e.station) : M.playing && M.stop()));
  M.toggle = () => (M.playing ? M.stop() : M.play(R.store.get('station', 'lofi')));

  R.on('cfg', e => {
    if (e.name !== 'musicVolume') return;
    if (audio) audio.volume = e.val / 100;
    if (master && M.playing) master.gain.setTargetAtTime(e.val / 100 * 0.8, R.ac().currentTime, 0.2);
  });

  // ---------- the turntable ----------
  function labelTex(col, mid) {
    return R.canvasTex(32, 32, (g) => {
      for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
        const d = Math.hypot(x - 15.5, y - 15.5);
        let c = '#141018';
        if (d < 15 && Math.floor(d) % 3 === 0) c = '#221c28';
        if (d < 6) c = col;
        if (d < 6 && x > 15) c = mid;
        if (d < 1.2) c = '#141018';
        g.fillStyle = c; g.fillRect(x, y, 1, 1);
      }
    });
  }
  R.buildVinyl = function () {
    const top = 1.3;
    const tt = R.group(-5.4, top, -0.3, R.room);
    R.box(0.95, 0.16, 1.15, R.mat('#3b2b2b'), 0, 0.08, 0, tt);
    R.box(0.9, 0.02, 1.1, R.mat('#2a1f22'), 0, 0.17, 0, tt);

    const labels = {};
    const labelFor = s => {
      if (labels[s.id]) return labels[s.id];
      const tex = labels[s.id] = labelTex(s.color, s.label);
      const src = s.cover && R.asset(s.cover);
      if (src && String(src).startsWith('data:')) {     // WebGL under file:// only takes embedded images
        const im = new Image();
        im.onload = () => {
          const g = tex.userData.ctx;
          g.save(); g.beginPath(); g.arc(16, 16, 8, 0, Math.PI * 2); g.clip();
          g.imageSmoothingEnabled = true; g.drawImage(im, 8, 8, 16, 16); g.restore();
          g.fillStyle = '#141018'; g.fillRect(15, 15, 2, 2);
          tex.needsUpdate = true;
        };
        im.src = src;
      }
      return tex;
    };
    const topMat = R.texMat(labelFor(M.stations.find(s => s.id === 'lofi')));
    const rec = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.03, 28), [R.mat('#141018'), topMat, R.mat('#141018')]);
    rec.position.set(0, 0.2, 0.08);
    rec.castShadow = true;
    tt.add(rec);
    let current = M.stations.find(s => s.id === 'lofi');
    const setLabel = r => { current = r; topMat.map = labelFor(r); topMat.needsUpdate = true; };
    R.on('music', on => { if (on && M.station && !swap) setLabel(M.station); });
    R.on('record:link', r => { if (!swap) setLabel(r); });

    // changing records: arm lifts, the old record flies back to the crate, the new one comes
    // out of it and drops onto the platter, the arm goes down, then it plays
    let swap = null;
    M.swap = (r, done) => {
      if (swap) { swap.done = done; swap.r = r; return; }
      if (current && current.id === r.id && M.spinning()) return done();
      swap = { t: 0, r, done, swapped: false };
      R.sfx.swish && R.sfx.swish();
    };
    const ease = x => x * x * (3 - 2 * x), c01 = x => Math.max(0, Math.min(1, x));
    function swapTick(dt) {
      swap.t += dt;
      const T = swap.t;
      const k = T < 1.15 ? ease(c01((T - 0.45) / 0.7)) : 1 - ease(c01((T - 1.15) / 0.7));
      if (T >= 1.15 && !swap.swapped) { swap.swapped = true; setLabel(swap.r); }
      rec.position.set(0.15 * k, 0.2 + Math.sin(k * Math.PI) * 0.7 - 0.9 * k, 0.08 + 1.75 * k);
      rec.rotation.x = 1.3 * k;
      rec.scale.setScalar(1 - 0.25 * k);
      if (T >= 1.85 && !swap.landed) { swap.landed = true; R.sfx.thump && R.sfx.thump(); }
      if (T >= 2.15) {
        rec.position.set(0, 0.2, 0.08); rec.rotation.x = 0; rec.scale.setScalar(1);
        const d = swap.done; swap = null; d();
      }
    }

    // tonearm pivots from the back corner
    const armPivot = R.group(0.3, 0.22, -0.42, tt);
    R.box(0.1, 0.1, 0.1, R.mat('#b8b2c4'), 0, 0, 0, armPivot);
    const arm = R.box(0.04, 0.04, 0.62, R.mat('#cfc8da'), 0, 0.03, 0.3, armPivot);
    R.box(0.07, 0.05, 0.1, R.mat('#2c2a3a'), 0, 0.01, 0.62, armPivot);
    arm.castShadow = false;
    const REST = 0.15, PLAY = -0.45;
    armPivot.rotation.y = REST;

    const led = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), R.glow('#552222'));
    led.position.set(0.4, 0.12, 0.55); tt.add(led);

    // ---------- volume (the slider in the corner box) ----------
    // Turns the room's own music, or Spotify / the browser when that's what is playing.
    const V = { app: null, appVal: {}, sendT: 0 };
    const target = () => {
      if (M.playing || !M.media.active) return null;
      const a = String(M.media.app || '').toLowerCase();
      return /spotify/.test(a) ? 'spotify' : (a.split(/[\\!._\s]/).filter(Boolean).pop() || '').replace(/[^a-z0-9]/g, '') || null;
    };
    const shown = () => (V.app ? (V.appVal[V.app] ?? 1) : R.cfg.musicVolume / 100);
    const sendApp = (app, v, now) => {
      clearTimeout(V.sendT);
      const go = () => R.helper.call(R.helper.q('/volume', { app, v: v.toFixed(3) }), 3000).catch(e => R.toast(String(e.message || e)));
      if (now) go(); else V.sendT = setTimeout(go, 90);
    };
    function setVol(v, now) {
      v = R.clamp(v, 0, 1);
      if (V.app) { V.appVal[V.app] = v; sendApp(V.app, v, now); R.emit('volume', v); return; }
      R.cfg.musicVolume = Math.round(v * 100);
      R.store.set('cfg', R.cfg);
      R.emit('cfg', { name: 'musicVolume', val: R.cfg.musicVolume });
      R.emit('volume', v);
    }
    const grab = () => {
      V.app = target();
      if (V.app && !(V.app in V.appVal)) R.helper.call(R.helper.q('/volume', { app: V.app }), 3000).then(j => { V.appVal[V.app] = j.volume; R.emit('volume', j.volume); }).catch(() => {});
      R.emit('volume', shown());
    };
    R.on('media', grab);
    R.on('music', grab);
    R.on('spotify:unmuted', v => { V.appVal.spotify = v; R.emit('volume', shown()); });
    M.volume = { get: shown, set: setVol, app: () => V.app };

    // floating music notes
    const noteTex = R.canvasTex(8, 8, (g) => {
      g.fillStyle = '#fff3d6';
      g.fillRect(5, 0, 1, 6); g.fillRect(6, 0, 2, 1); g.fillRect(7, 1, 1, 1);
      g.fillRect(2, 5, 4, 2); g.fillRect(3, 4, 2, 1); g.fillRect(3, 7, 2, 1);
    });
    const notes = Array.from({ length: 4 }, (_, i) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: noteTex, transparent: true, opacity: 0 }));
      s.scale.set(0.25, 0.25, 1);
      s.userData.phase = i / 4;
      tt.add(s);
      return s;
    });

    let speed = 0, nt = 0;
    R.tick(dt => {
      if (swap) swapTick(dt);
      const on = !swap && M.spinning();
      speed = R.damp(speed, on ? 3.5 : 0, 2.5, dt);   // spin up / wind down
      rec.rotation.y -= speed * dt;
      armPivot.rotation.y = R.damp(armPivot.rotation.y, on ? PLAY : REST, 3, dt);
      led.material.color.set(on ? '#ff5a5a' : '#552222');
      nt += dt * (speed / 3.5);
      notes.forEach(s => {
        const p = (nt * 0.35 + s.userData.phase) % 1;
        s.position.set(0.2 + Math.sin(p * 6 + s.userData.phase * 9) * 0.25, 0.4 + p * 1.6, 0.1 + p * 0.5);
        s.material.opacity = speed > 0.3 ? Math.sin(p * Math.PI) * 0.9 : 0;
        s.visible = s.material.opacity > 0.01;   // invisible sprites shouldn't catch clicks
      });
    });
    R.makeClickable(tt, 'record player', () => {
      // Spotify is on (or paused) and the room's own music isn't: the turntable is its remote.
      // Only Spotify: a paused YouTube tab in the browser used to swallow the click, so lofi never started.
      if (!M.playing && M.media.active && /spotify/i.test(M.media.app || '')) {
        M.mediaCmd('toggle').then(j => R.toast((j.playing ? '♪ ' : '❚❚ ') + (j.title || 'Spotify'))).catch(e => R.toast(String(e.message || e)));
        return;
      }
      M.toggle();
      R.toast(M.playing ? '♪ ' + M.station.title : 'music paused');
    });
  };
})(window.R);
