// Room lights follow the music: the genre picks a palette (pop = red/blue, indie/folk =
// warm yellow, lofi = purple…) and the lights pulse on the beat.
// Genre comes from the playing station, or — for Spotify etc. — the artist's genres on
// MusicBrainz (free, no account), cached per artist.
(function (R) {
  const M = R.music;
  const PAL = {
    cozy:       { name: 'cozy',       bulbs: ['#ffd27a', '#ff9e7a', '#ffe9b0', '#ffb3c1'], fill: '#ffb27a', mood: null },
    lofi:       { name: 'lofi',       bulbs: ['#c9a4ff', '#ff9ec7', '#ffd27a', '#9fb7ff'], fill: '#d29aff', mood: ['#9a6bff', '#ff6fae'], k: 0.7 },
    pop:        { name: 'pop',        bulbs: ['#ff3b5c', '#3b7bff', '#ff6fd8', '#4fd0ff'], fill: '#ff5a8a', mood: ['#ff2a4a', '#2a5bff'], k: 1.3, swap: true },
    indie:      { name: 'indie/folk', bulbs: ['#ffd27a', '#ffb45a', '#ffe9b0', '#ffcf8a'], fill: '#ffc46a', mood: ['#ffb347', '#ffd27a'], k: 0.7 },
    jazz:       { name: 'jazz',       bulbs: ['#ffb35a', '#ff8a4a', '#ffd9a0', '#e9a06a'], fill: '#ff9e5a', mood: ['#ff8a3a', '#ffbf6a'], k: 0.6 },
    rock:       { name: 'rock',       bulbs: ['#ff4a2a', '#ff8a2a', '#ffd04a', '#ff6a4a'], fill: '#ff5a3a', mood: ['#ff3a1a', '#ff9a2a'], k: 1.1, swap: true },
    electronic: { name: 'electronic', bulbs: ['#2affea', '#ff2aea', '#7a5aff', '#2a9aff'], fill: '#7a6aff', mood: ['#00e5ff', '#ff00d4'], k: 1.3, swap: true },
    hiphop:     { name: 'hip hop/r&b', bulbs: ['#b06aff', '#ffcf4a', '#ff6a9a', '#8a6aff'], fill: '#b07aff', mood: ['#8a3aff', '#ffc23a'], k: 1.0, swap: true },
    classical:  { name: 'classical',  bulbs: ['#fff2d6', '#ffe2b0', '#f6f0ff', '#ffd9a0'], fill: '#ffe8c4', mood: ['#ffe2b0', '#e8e2ff'], k: 0.4 },
    rain:       { name: 'rain',       bulbs: ['#9fc4ff', '#7fa8e0', '#cfe0ff', '#a0b8ff'], fill: '#8fb0ff', mood: ['#5a8aff', '#9fc4ff'], k: 0.6 },
    ambient:    { name: 'ambient',    bulbs: ['#7affd4', '#9fd0ff', '#c9a4ff', '#a0ffe0'], fill: '#8ae0d0', mood: ['#4ad0c0', '#7a9aff'], k: 0.6 },
  };
  // tag keyword → palette, checked in order (so "indie pop" is indie, not pop)
  const RULES = [
    [/classical|baroque|opera|orchestral|piano solo/, 'classical'],
    [/lo-?fi|chillhop|jazzhop/, 'lofi'],
    [/jazz|blues|swing|bossa/, 'jazz'],
    [/metal|punk|grunge|hard rock|emo/, 'rock'],
    [/indie|folk|acoustic|country|americana/, 'indie'],
    [/hip.?hop|rap|trap|r&b|rnb|soul|funk|grime/, 'hiphop'],
    [/electro|edm|house|techno|trance|dubstep|drum and bass|synthwave|dance/, 'electronic'],
    [/ambient|new age|drone|meditat/, 'ambient'],
    [/rock|alternative/, 'rock'],
    [/pop|bollywood|filmi|k-pop|j-pop|disco/, 'pop'],
  ];
  const V = R.vibe = { pal: PAL.cozy, genre: '', name: '' };

  // ---------- genre lookup ----------
  const cache = R.store.get('genres', {});
  const pending = {};
  // a blend is the kind of its last word: "country pop" is pop, "indie rock" is rock
  const ruleFor = s => { const w = s.split(/[\s\-\/]+/).pop(); return RULES.find(([re]) => re.test(w)) || RULES.find(([re]) => re.test(s)); };
  function classify(tags) {
    const score = {};
    tags.forEach(({ name, count }) => {
      const hit = ruleFor(name.toLowerCase());
      if (hit) score[hit[1]] = (score[hit[1]] || 0) + Math.max(1, count || 1);
    });
    const best = Object.entries(score).sort((a, b) => b[1] - a[1])[0];
    return best ? best[0] : '';
  }
  function getJSON(url) {
    const ctl = new AbortController(); setTimeout(() => ctl.abort(), 8000);
    return fetch(url, { signal: ctl.signal }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
  }
  function lookup(artist) {
    const key = artist.toLowerCase();
    if (key in cache || pending[key]) return;
    pending[key] = true;
    const q = encodeURIComponent('artist:"' + artist.replace(/"/g, '') + '"');
    getJSON('https://musicbrainz.org/ws/2/artist/?fmt=json&limit=1&query=' + q)
      .then(j => {
        const a = j.artists && j.artists[0];
        if (!a) return '';
        return getJSON('https://musicbrainz.org/ws/2/artist/' + a.id + '?fmt=json&inc=genres+tags')
          .then(d => classify(d.genres && d.genres.length ? d.genres : (d.tags || a.tags || [])));
      })
      .then(g => { cache[key] = g || ''; R.store.set('genres', cache); })
      .catch(() => { delete pending[key]; });
  }
  // "Artist A, Artist B feat. C" → "Artist A"
  const mainArtist = s => s.split(/,|&| feat\.? | ft\.? | x | and /i)[0].trim();

  function currentPalette() {
    if (M.playing && M.station) return PAL[M.station.palette] || PAL.cozy;
    if (M.systemAudio() && M.artist) {
      const a = mainArtist(M.artist), g = cache[a.toLowerCase()];
      if (g === undefined) lookup(a);
      return PAL[g] || PAL.cozy;
    }
    return PAL.cozy;
  }

  // ---------- lights ----------
  R.buildVibe = function () {
    const A = new THREE.PointLight('#ffffff', 0, 12, 1.4), B = new THREE.PointLight('#ffffff', 0, 12, 1.4);
    A.position.set(-4.2, 4.2, 1.2); B.position.set(3.4, 4.4, -1.4);
    R.scene.add(A); R.scene.add(B);
    const ca = new THREE.Color(), cb = new THREE.Color(), tmp = new THREE.Color();
    let avg = 0, beat = 0, flip = false, last = '';
    R.tick(dt => {
      const on = R.cfg.vibeLights !== false;
      const pal = on ? currentPalette() : PAL.cozy;
      if (pal !== V.pal) { V.pal = pal; if (pal.name !== 'cozy' && pal.name !== last) R.emit('vibe', pal.name); last = pal.name; }
      V.name = pal === PAL.cozy ? '' : pal.name;

      // beat: bass level jumping above its running average
      const lvl = on ? M.level() : 0;
      avg = R.lerp(avg, lvl, 1 - Math.exp(-dt * 1.5));
      const hit = lvl > avg * 1.25 + 0.03;
      if (hit && beat < 0.3 && pal.swap) flip = !flip;
      beat = Math.max(beat - dt * 3.5, hit ? 1 : 0);
      R.beat = beat * (pal.mood ? 1 : 0.3);

      // fairy bulbs drift to the palette
      R.fairy.forEach((m, i) => m.userData.base.lerp(tmp.set(pal.bulbs[i % pal.bulbs.length]), 1 - Math.exp(-dt * 2)));
      R.fairyLight.color.lerp(tmp.set(pal.fill), 1 - Math.exp(-dt * 2));

      // two coloured mood lights, swapping sides on the beat for the party palettes
      const active = !!pal.mood && (M.playing || M.systemAudio());
      if (pal.mood) { ca.set(pal.mood[flip ? 1 : 0]); cb.set(pal.mood[flip ? 0 : 1]); }
      A.color.lerp(ca, 1 - Math.exp(-dt * 8)); B.color.lerp(cb, 1 - Math.exp(-dt * 8));
      const target = active ? (pal.k || 0.6) * (3 + 9 * beat) * (0.5 + 0.5 * (R.night ?? 1)) : 0;
      A.intensity = R.damp(A.intensity, target, 10, dt);
      B.intensity = R.damp(B.intensity, target, 10, dt);
    });
    R.on('vibe', name => R.toast('lights: ' + name + ' vibe'));
  };
})(window.R);
