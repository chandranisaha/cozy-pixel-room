// Procedural ambience shared by the window, the bed, the record crate and the cat.
// Each maker returns { gain, stop() } — fade with gain.gain.setTargetAtTime.
(function (R) {
  const S = R.sfx = {};
  let noise;
  function noiseBuf(ac) {
    if (noise) return noise;
    noise = ac.createBuffer(1, ac.sampleRate * 3, ac.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return noise;
  }
  S.noiseBuf = () => noiseBuf(R.ac());

  function out(ac, dest) {
    const g = ac.createGain(); g.gain.value = 0;
    g.connect(dest || ac.destination);
    return g;
  }
  function loopNoise(ac, g, type, freq, q = 0.7, vol = 1) {
    const s = ac.createBufferSource(); s.buffer = noiseBuf(ac); s.loop = true;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const v = ac.createGain(); v.gain.value = vol;
    s.connect(f); f.connect(v); v.connect(g); s.start(0, Math.random() * 2);
    return { s, f, v };
  }
  // runs fn every ~ms (jittered) until stopped
  function every(ms, fn) {
    let alive = true;
    (function loop() { if (!alive) return; fn(); setTimeout(loop, ms * (0.4 + Math.random() * 1.2)); })();
    return () => (alive = false);
  }
  function blip(ac, g, freq, t, dur, vol, type = 'sine', slide = 0) {
    const o = ac.createOscillator(), e = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(vol, t + 0.01); e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(e); e.connect(g); o.start(t); o.stop(t + dur + 0.02);
  }

  S.rain = (dest) => {
    const ac = R.ac(), g = out(ac, dest);
    const a = loopNoise(ac, g, 'lowpass', 1400, 0.5, 0.5);
    const b = loopNoise(ac, g, 'highpass', 5000, 0.3, 0.12);
    const stopDrips = every(90, () => blip(ac, g, 2400 + Math.random() * 2600, ac.currentTime, 0.04, 0.03, 'sine', 0.6));
    return { gain: g, stop: () => { stopDrips(); a.s.stop(); b.s.stop(); } };
  };
  S.thunder = (dest) => {
    const ac = R.ac(), g = out(ac, dest), t = ac.currentTime;
    const s = ac.createBufferSource(); s.buffer = noiseBuf(ac);
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 180;
    const e = ac.createGain(); e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(0.9, t + 0.3); e.gain.exponentialRampToValueAtTime(0.001, t + 3.5);
    s.connect(f); f.connect(e); e.connect(g); s.start(t); s.stop(t + 3.6);
    g.gain.value = 1;
  };
  S.wind = (dest) => {
    const ac = R.ac(), g = out(ac, dest);
    const a = loopNoise(ac, g, 'bandpass', 500, 0.8, 0.6);
    const lfo = ac.createOscillator(), lg = ac.createGain();
    lfo.frequency.value = 0.12; lg.gain.value = 300; lfo.connect(lg); lg.connect(a.f.frequency); lfo.start();
    return { gain: g, stop: () => { a.s.stop(); lfo.stop(); } };
  };
  S.birds = (dest) => {
    const ac = R.ac(), g = out(ac, dest);
    const air = loopNoise(ac, g, 'bandpass', 900, 0.4, 0.06);
    const stop = every(1400, () => {
      const t = ac.currentTime, base = 2400 + Math.random() * 1800, n = 2 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) blip(ac, g, base * (1 + (Math.random() - 0.5) * 0.2), t + i * 0.11, 0.09, 0.05, 'sine', 1.3);
    });
    return { gain: g, stop: () => { stop(); air.s.stop(); } };
  };
  S.crickets = (dest) => {
    const ac = R.ac(), g = out(ac, dest);
    const hum = loopNoise(ac, g, 'lowpass', 220, 0.5, 0.25);          // far-off city
    const stop = every(700, () => {
      const t = ac.currentTime, f = 4200 + Math.random() * 600;
      for (let i = 0; i < 3; i++) blip(ac, g, f, t + i * 0.05, 0.035, 0.02, 'square');
    });
    const cars = every(9000, () => {                                   // a car passing
      const t = ac.currentTime, s = ac.createBufferSource(); s.buffer = noiseBuf(ac);
      const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400;
      const e = ac.createGain(); e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(0.18, t + 1.8); e.gain.linearRampToValueAtTime(0, t + 4);
      s.connect(f); f.connect(e); e.connect(g); s.start(t); s.stop(t + 4.1);
    });
    return { gain: g, stop: () => { stop(); cars(); hum.s.stop(); } };
  };
  // ---------- the tape drawer's ambience loops ----------
  S.fire = (dest) => {
    const ac = R.ac(), g = out(ac, dest);
    const roar = loopNoise(ac, g, 'lowpass', 380, 0.4, 0.55);
    const crackle = every(110, () => { if (Math.random() < 0.7) burst(ac, g, ac.currentTime, 0.012 + Math.random() * 0.03, 'bandpass', 1500 + Math.random() * 3500, 0.12 + Math.random() * 0.25, 1.4); });
    const pops = every(2600, () => { const t = ac.currentTime; burst(ac, g, t, 0.05, 'bandpass', 900, 0.4, 2); burst(ac, g, t + 0.03, 0.12, 'highpass', 3000, 0.08); });
    return { gain: g, stop: () => { crackle(); pops(); roar.s.stop(); } };
  };
  S.cafe = (dest) => {
    const ac = R.ac(), g = out(ac, dest);
    const murmur = loopNoise(ac, g, 'bandpass', 480, 1.1, 0.7);
    const m2 = loopNoise(ac, g, 'bandpass', 900, 1.4, 0.25);
    const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 0.35; lg.gain.value = 0.25; lfo.connect(lg); lg.connect(murmur.v.gain); lfo.start();
    const clinks = every(3200, () => { const t = ac.currentTime, f = 2200 + Math.random() * 1400; blip(ac, g, f, t, 0.35, 0.03, 'triangle'); if (Math.random() < 0.5) blip(ac, g, f * 1.02, t + 0.09, 0.25, 0.02, 'triangle'); });
    return { gain: g, stop: () => { clinks(); lfo.stop(); murmur.s.stop(); m2.s.stop(); } };
  };
  S.keys = (dest) => {
    const ac = R.ac(), g = out(ac, dest);
    let alive = true;
    (function word() {
      if (!alive) return;
      const t = ac.currentTime, n = 3 + Math.floor(Math.random() * 6);
      for (let i = 0; i < n; i++) {
        const at = t + i * (0.07 + Math.random() * 0.06);
        burst(ac, g, at, 0.018, 'bandpass', 2200 + Math.random() * 1600, 0.22, 2.5);
        burst(ac, g, at + 0.004, 0.03, 'lowpass', 500, 0.12);
      }
      if (Math.random() < 0.15) burst(ac, g, t + n * 0.1 + 0.05, 0.05, 'lowpass', 300, 0.3);   // the space bar
      setTimeout(word, n * 100 + 120 + Math.random() * (Math.random() < 0.2 ? 1800 : 300));
    })();
    return { gain: g, stop: () => (alive = false) };
  };
  S.waves = (dest) => {
    const ac = R.ac(), g = out(ac, dest);
    const sea = loopNoise(ac, g, 'lowpass', 650, 0.5, 0.3);
    const fizz = loopNoise(ac, g, 'highpass', 3500, 0.4, 0.05);
    const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 0.09; lg.gain.value = 0.28; lfo.connect(lg); lg.connect(sea.v.gain); lg.connect(fizz.v.gain); lfo.start();
    const lf2 = ac.createOscillator(), l2 = ac.createGain(); lf2.frequency.value = 0.09; l2.gain.value = 350; lf2.connect(l2); l2.connect(sea.f.frequency); lf2.start();
    return { gain: g, stop: () => { lfo.stop(); lf2.stop(); sea.s.stop(); fizz.s.stop(); } };
  };
  S.brown = (dest) => {
    const ac = R.ac(), g = out(ac, dest);
    const a = loopNoise(ac, g, 'lowpass', 300, 0.3, 0.9);
    return { gain: g, stop: () => a.s.stop() };
  };
  S.purr = (dest) => {
    const ac = R.ac(), g = out(ac, dest);
    const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 26;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 160;
    const am = ac.createGain(); am.gain.value = 0.5;
    const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 0.9; lg.gain.value = 0.5;
    lfo.connect(lg); lg.connect(am.gain);
    o.connect(f); f.connect(am); am.connect(g); o.start(); lfo.start();
    return { gain: g, stop: () => { o.stop(); lfo.stop(); } };
  };
  S.pop = (freq = 520) => {
    const ac = R.ac(), g = out(ac); g.gain.value = 1;
    blip(ac, g, freq, ac.currentTime, 0.12, 0.12, 'triangle', 1.6);
  };
  // short filtered-noise burst: the building block for paper, wood and fabric sounds
  function burst(ac, g, at, dur, type, freq, vol, q = 0.8, freqTo = 0) {
    const s = ac.createBufferSource(); s.buffer = noiseBuf(ac);
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, at); f.Q.value = q;
    if (freqTo) f.frequency.exponentialRampToValueAtTime(freqTo, at + dur);
    const e = ac.createGain();
    e.gain.setValueAtTime(0.0001, at); e.gain.linearRampToValueAtTime(vol, at + Math.min(0.02, dur / 3)); e.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    s.connect(f); f.connect(e); e.connect(g); s.start(at, Math.random() * 2); s.stop(at + dur + 0.02);
  }
  const shot = () => { const ac = R.ac(), g = out(ac); g.gain.value = 1; return [ac, g, ac.currentTime]; };

  // a sheet being scrunched up: ~half a second of crackles
  S.crumple = () => {
    const [ac, g, t] = shot();
    for (let i = 0; i < 22; i++) {
      const at = t + i * 0.022 + Math.random() * 0.015;
      burst(ac, g, at, 0.03 + Math.random() * 0.04, 'bandpass', 1800 + Math.random() * 4000, 0.35 + Math.random() * 0.25, 1.2);
    }
    burst(ac, g, t, 0.5, 'highpass', 3000, 0.08);
  };
  // paper ball landing in the basket
  S.thump = () => {
    const [ac, g, t] = shot();
    burst(ac, g, t, 0.12, 'lowpass', 700, 0.5);
    blip(ac, g, 140, t, 0.12, 0.15, 'sine', 0.6);
    for (let i = 0; i < 4; i++) burst(ac, g, t + 0.03 + i * 0.03, 0.03, 'bandpass', 3000, 0.12, 1.2);
  };
  // the window sash sliding in its frame, then knocking into place
  S.sash = open => {
    const [ac, g, t] = shot();
    burst(ac, g, t, 0.7, 'bandpass', open ? 300 : 600, 0.35, 2, open ? 600 : 300);
    for (let i = 0; i < 5; i++) burst(ac, g, t + 0.1 + i * 0.12 + Math.random() * 0.04, 0.05, 'bandpass', 900, 0.12, 3);
    blip(ac, g, 110, t + 0.7, 0.15, 0.25, 'triangle', 0.7);
    burst(ac, g, t + 0.7, 0.08, 'lowpass', 500, 0.4);
  };
  // fabric swish; rings = curtain rings clinking along the rod
  S.swish = (dur = 0.45, vol = 0.3, rings = true) => {
    const [ac, g, t] = shot();
    burst(ac, g, t, dur, 'bandpass', 1500, vol, 0.6, 3500);
    burst(ac, g, t + dur * 0.2, dur * 0.8, 'highpass', 4000, vol * 0.4);
    if (rings) for (let i = 0; i < 4; i++) blip(ac, g, 3200 + Math.random() * 900, t + i * dur / 4, 0.06, 0.03, 'triangle');
  };
  // a magazine page turning: a papery whoosh that rises, then the page settling with a soft slap
  // soft noise that swells in and fades out (no sharp attack): the base of the gentle paper sounds
  function swell(ac, g, at, dur, type, freq, vol, freqTo = 0, peak = 0.4, q = 0.5) {
    const s = ac.createBufferSource(); s.buffer = noiseBuf(ac);
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, at); f.Q.value = q;
    if (freqTo) f.frequency.exponentialRampToValueAtTime(freqTo, at + dur);
    const e = ac.createGain();
    e.gain.setValueAtTime(0.0001, at); e.gain.linearRampToValueAtTime(vol, at + dur * peak); e.gain.linearRampToValueAtTime(0.0001, at + dur);
    s.connect(f); f.connect(e); e.connect(g); s.start(at, Math.random() * 2); s.stop(at + dur + 0.02);
  }
  // a catalogue page turning: a soft airy "fwff" as it sweeps over, then a muffled settle
  S.page = (vol = 1, len = 0.36) => {
    const [ac, g, t] = shot();
    const d = R.clamp(len, 0.25, 1) * (0.92 + Math.random() * 0.16);
    swell(ac, g, t, d, 'lowpass', 1500 + Math.random() * 300, 0.13 * vol, 650, 0.45);
    swell(ac, g, t + d * 0.15, d * 0.6, 'bandpass', 2600, 0.025 * vol, 1800, 0.5, 0.4);
    swell(ac, g, t + d * 0.78, 0.16, 'lowpass', 380, 0.12 * vol, 220, 0.3);
  };
  // a cassette going in / out: two plastic clicks
  S.clack = (vol = 1) => {
    const [ac, g, t] = shot();
    burst(ac, g, t, 0.025, 'bandpass', 2400, 0.3 * vol, 2);
    burst(ac, g, t + 0.06, 0.035, 'bandpass', 1500, 0.35 * vol, 1.6);
    burst(ac, g, t + 0.06, 0.06, 'lowpass', 400, 0.25 * vol);
  };
  // a page corner lifting under your finger: a tiny soft brush
  S.peel = (vol = 1) => {
    const [ac, g, t] = shot();
    swell(ac, g, t, 0.16, 'lowpass', 1800, 0.05 * vol, 900, 0.35);
  };
  // wooden drawer sliding open/shut
  S.drawer = open => {
    const [ac, g, t] = shot();
    burst(ac, g, t, 0.32, 'bandpass', open ? 260 : 420, 0.5, 1.5, open ? 520 : 220);
    for (let i = 0; i < 6; i++) burst(ac, g, t + i * 0.05, 0.03, 'bandpass', 1200, 0.1, 4);
    if (!open) { blip(ac, g, 95, t + 0.32, 0.14, 0.35, 'triangle', 0.6); burst(ac, g, t + 0.32, 0.06, 'lowpass', 400, 0.5); }
  };
  // a tin of treats being shaken
  S.rattle = () => {
    const [ac, g, t] = shot();
    for (let k = 0; k < 3; k++) for (let i = 0; i < 7; i++)
      blip(ac, g, 1800 + Math.random() * 2200, t + k * 0.22 + i * 0.018 + Math.random() * 0.01, 0.03, 0.06, 'square', 0.8);
  };
  S.crunch = () => {
    const [ac, g, t] = shot();
    for (let k = 0; k < 4; k++) for (let i = 0; i < 5; i++)
      burst(ac, g, t + k * 0.28 + i * 0.02, 0.03, 'bandpass', 1500 + Math.random() * 2000, 0.3, 1);
  };
  S.meow = (sleepy = false) => {
    const [ac, g, t] = shot(), d = sleepy ? 0.8 : 0.5;
    const o = ac.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(sleepy ? 420 : 600, t);
    o.frequency.linearRampToValueAtTime(sleepy ? 560 : 900, t + d * 0.35);
    o.frequency.linearRampToValueAtTime(sleepy ? 330 : 520, t + d);
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 3;
    f.frequency.setValueAtTime(800, t); f.frequency.linearRampToValueAtTime(1800, t + d * 0.4); f.frequency.linearRampToValueAtTime(900, t + d);
    const e = ac.createGain(); e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(0.18, t + 0.05); e.gain.linearRampToValueAtTime(0.12, t + d * 0.7); e.gain.linearRampToValueAtTime(0, t + d);
    o.connect(f); f.connect(e); e.connect(g); o.start(t); o.stop(t + d + 0.05);
  };

  // fade helper: R.sfx.fade(node, to, seconds)
  S.fade = (n, to, sec = 0.8) => n && n.gain.gain.setTargetAtTime(to, R.ac().currentTime, sec / 3);

  // Lively plays sound from one screen only, so sounds you cause are replayed on the other
  // screen's copy too (whichever of the two is muted stays silent).
  const ONE_SHOTS = ['pop', 'page', 'peel', 'clack', 'crumple', 'thump', 'sash', 'swish', 'drawer', 'rattle', 'crunch', 'meow'];
  const raw = {};
  ONE_SHOTS.forEach(n => {
    raw[n] = S[n];
    S[n] = (...a) => { if (R.userActive && R.userActive()) R.share('sfx', { n, a }); return raw[n](...a); };
  });
  R.on('remote:sfx', e => { if (raw[e.n]) raw[e.n](...(e.a || [])); });
})(window.R);
