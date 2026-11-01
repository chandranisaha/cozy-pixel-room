// Real weather in the window: location → Open-Meteo → animated pixel sky + room lighting.
(function (R) {
  const CODES = {
    0: ['clear', 'clear sky'], 1: ['clear', 'mostly clear'], 2: ['cloud', 'partly cloudy'], 3: ['cloud', 'overcast'],
    45: ['fog', 'fog'], 48: ['fog', 'freezing fog'],
    51: ['rain', 'light drizzle'], 53: ['rain', 'drizzle'], 55: ['rain', 'heavy drizzle'],
    56: ['rain', 'freezing drizzle'], 57: ['rain', 'freezing drizzle'],
    61: ['rain', 'light rain'], 63: ['rain', 'rain'], 65: ['rain', 'heavy rain'],
    66: ['rain', 'freezing rain'], 67: ['rain', 'freezing rain'],
    71: ['snow', 'light snow'], 73: ['snow', 'snow'], 75: ['snow', 'heavy snow'], 77: ['snow', 'snow grains'],
    80: ['rain', 'rain showers'], 81: ['rain', 'rain showers'], 82: ['rain', 'violent showers'],
    85: ['snow', 'snow showers'], 86: ['snow', 'snow showers'],
    95: ['thunder', 'thunderstorm'], 96: ['thunder', 'thunderstorm + hail'], 99: ['thunder', 'thunderstorm + hail'],
  };
  const CLOUD = { clear: 0.1, cloud: 0.6, fog: 0.9, rain: 0.85, snow: 0.75, thunder: 1 };

  const W = R.weather = {
    kind: 'clear', desc: 'clear sky', temp: null, city: '', code: 0,
    sunrise: 6.0, sunset: 18.5, loaded: false,
  };
  const forced = R.params.get('weather');
  if (forced) { W.kind = forced; W.desc = forced + ' (forced)'; }

  function hoursOf(iso) { const d = new Date(iso); return d.getHours() + d.getMinutes() / 60; }
  R.nowHour = () => {
    const h = R.params.get('hour');
    if (h != null) return parseFloat(h);
    const d = new Date();
    return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
  };

  // ---------- location ----------
  function getJSON(url) {
    return fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
  }
  function browserGeo() {
    return new Promise((ok, no) => {
      if (!navigator.geolocation) return no();
      const t = setTimeout(no, 5000);
      navigator.geolocation.getCurrentPosition(
        p => { clearTimeout(t); ok({ lat: p.coords.latitude, lon: p.coords.longitude }); },
        () => { clearTimeout(t); no(); }, { timeout: 5000, maximumAge: 3600e3 });
    });
  }
  function cityName(loc) {
    return getJSON('https://api.bigdatacloud.net/data/reverse-geocode-client?localityLanguage=en&latitude=' + loc.lat + '&longitude=' + loc.lon)
      .then(j => j.city || j.locality || '');
  }
  async function locate() {
    const lat = parseFloat(R.cfg.lat), lon = parseFloat(R.cfg.lon);
    if (!isNaN(lat) && !isNaN(lon)) return { lat, lon, city: '' };
    // the helper reads Windows location services, which is precise; IP lookups can be country-level
    try { const j = await R.helper.call('/location', 15000); return { lat: j.lat, lon: j.lon, city: '' }; } catch (e) {}
    try { return Object.assign({ city: '' }, await browserGeo()); } catch (e) {}
    try {
      const j = await getJSON('https://get.geojs.io/v1/ip/geo.json');
      return { lat: +j.latitude, lon: +j.longitude, city: j.city || '' };
    } catch (e) {}
    try {
      const j = await getJSON('https://ipwho.is/');
      return { lat: +j.latitude, lon: +j.longitude, city: j.city || '' };
    } catch (e) {}
    return R.store.get('loc', null);
  }

  async function refresh() {
    try {
      const loc = await locate();
      if (!loc) throw new Error('no location');
      R.store.set('loc', loc);
      const unit = +R.cfg.tempUnit === 1 ? 'fahrenheit' : 'celsius';
      const j = await getJSON('https://api.open-meteo.com/v1/forecast?latitude=' + loc.lat + '&longitude=' + loc.lon +
        '&current=temperature_2m,weather_code,is_day&daily=sunrise,sunset&timezone=auto&forecast_days=1&temperature_unit=' + unit);
      W.code = j.current.weather_code;
      const [kind, desc] = CODES[W.code] || ['cloud', 'weather'];
      if (!forced) { W.kind = kind; W.desc = desc; }
      W.temp = Math.round(j.current.temperature_2m) + (unit === 'fahrenheit' ? '°F' : '°C');
      W.sunrise = hoursOf(j.daily.sunrise[0]);
      W.sunset = hoursOf(j.daily.sunset[0]);
      if (!loc.city) loc.city = await cityName(loc).catch(() => '');
      W.city = loc.city || W.city;
      W.loaded = true;
      R.store.set('weather', { code: W.code, temp: W.temp, sunrise: W.sunrise, sunset: W.sunset, city: W.city, at: Date.now() });
    } catch (e) {
      const c = R.store.get('weather', null);
      if (c) {
        Object.assign(W, { code: c.code, temp: c.temp, sunrise: c.sunrise, sunset: c.sunset, city: c.city });
        if (!forced) [W.kind, W.desc] = CODES[c.code] || ['cloud', 'weather'];
      }
      console.warn('weather fetch failed', e);
    }
    R.emit('weather', W);
  }

  // ---------- sky rendering ----------
  const SW = 72, SH = 60;
  let skyTex, ctx, drops = [], flakes = [], glass = [], flash = 0;
  const rnd = R.rng(99);
  const stars = Array.from({ length: 40 }, () => [Math.floor(rnd() * SW), Math.floor(rnd() * SH * 0.6), rnd()]);
  const buildings = [];
  for (let x = 0; x < SW;) {
    const w = 5 + Math.floor(rnd() * 8), h = 8 + Math.floor(rnd() * 16);
    const lit = [];
    for (let wy = SH - h + 2; wy < SH - 1; wy += 3)
      for (let wx = x + 1; wx < x + w - 1; wx += 2) if (rnd() < 0.45) lit.push([wx, wy, rnd()]);
    buildings.push({ x, w, h, lit }); x += w + (rnd() < 0.3 ? 1 : 0);
  }
  const clouds = Array.from({ length: 6 }, (_, i) => ({ x: rnd() * SW, y: 4 + rnd() * 20, w: 10 + rnd() * 14, s: 0.6 + rnd() }));

  const C = (h) => new THREE.Color(h);
  const SKY = {
    night: [C('#0b0d2a'), C('#2b2560')],
    dusk: [C('#3c3478'), C('#f2956a')],
    day: [C('#4f9be0'), C('#bfe4f4')],
  };
  const tmpA = new THREE.Color(), tmpB = new THREE.Color();

  function smooth(e0, e1, x) { const t = R.clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); }

  // 0 = night, 1 = full day; twilight = how close we are to sunrise/sunset
  function sunState(h) {
    const day = smooth(W.sunrise - 0.6, W.sunrise + 0.6, h) * (1 - smooth(W.sunset - 0.6, W.sunset + 0.6, h));
    const tw = Math.max(1 - Math.abs(h - W.sunrise) / 1.0, 1 - Math.abs(h - W.sunset) / 1.0, 0);
    return { day, tw };
  }
  R.sunState = () => sunState(R.nowHour());

  function px(x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), w, h); }

  function drawSky(t) {
    const h = R.nowHour();
    const { day, tw } = sunState(h);
    const cloud = CLOUD[W.kind] ?? 0.3;

    // gradient
    for (let y = 0; y < SH; y += 2) {
      const f = y / SH;
      tmpA.copy(SKY.night[0]).lerp(SKY.night[1], f);
      tmpB.copy(SKY.day[0]).lerp(SKY.day[1], f);
      tmpA.lerp(tmpB, day);
      tmpB.copy(SKY.dusk[0]).lerp(SKY.dusk[1], f);
      tmpA.lerp(tmpB, tw * 0.75);
      const grey = (tmpA.r + tmpA.g + tmpA.b) / 3;
      tmpA.lerp(tmpB.setRGB(grey, grey, grey), cloud * 0.55);
      ctx.fillStyle = '#' + tmpA.getHexString();
      ctx.fillRect(0, y, SW, 2);
    }

    // stars
    if (day < 0.3 && cloud < 0.7)
      for (const [x, y, p] of stars) {
        const a = (0.5 + 0.5 * Math.sin(t * 2 + p * 20)) * (1 - day / 0.3) * (1 - cloud);
        if (a > 0.25) px(x, y, 1, 1, 'rgba(255,248,220,' + a.toFixed(2) + ')');
      }

    // sun / moon on an arc across the window
    const isDay = h > W.sunrise && h < W.sunset;
    const span = isDay ? (h - W.sunrise) / (W.sunset - W.sunrise)
      : ((h - W.sunset + 24) % 24) / (24 - (W.sunset - W.sunrise));
    const bx = 8 + span * (SW - 16), by = 26 - Math.sin(span * Math.PI) * 20;
    if (cloud < 0.95) {
      if (isDay) { px(bx - 3, by - 3, 7, 7, '#ffe7a0'); px(bx - 2, by - 4, 5, 9, '#ffe7a0'); px(bx - 4, by - 2, 9, 5, '#ffe7a0'); px(bx - 2, by - 2, 5, 5, '#fff6d0'); }
      else { px(bx - 3, by - 3, 6, 6, '#f1ecd2'); px(bx - 1, by - 3, 4, 4, tmpA.getStyle()); }
    }

    // clouds
    const cAlpha = 0.25 + cloud * 0.7;
    const cCol = day > 0.5 ? '255,255,255' : (tw > 0.3 ? '250,190,170' : '120,115,170');
    const nC = Math.round(2 + cloud * 4);
    for (let i = 0; i < nC; i++) {
      const c = clouds[i];
      const x = ((c.x + t * c.s * 1.2) % (SW + 30)) - 20;
      ctx.fillStyle = 'rgba(' + cCol + ',' + cAlpha.toFixed(2) + ')';
      ctx.fillRect(Math.round(x), Math.round(c.y), Math.round(c.w), 3);
      ctx.fillRect(Math.round(x + 3), Math.round(c.y - 2), Math.round(c.w * 0.5), 2);
      ctx.fillRect(Math.round(x + 2), Math.round(c.y + 3), Math.round(c.w - 4), 1);
    }

    // skyline with lit windows
    const bCol = day > 0.5 ? '#4a5470' : '#1a1838';
    for (const b of buildings) {
      px(b.x, SH - b.h, b.w, b.h, bCol);
      if (day < 0.6) for (const [wx, wy, p] of b.lit)
        if (Math.sin(t * 0.3 + p * 50) > -0.6) px(wx, wy, 1, 1, p > 0.5 ? '#ffd27a' : '#ffb36b');
    }

    if (W.kind === 'fog') { ctx.fillStyle = 'rgba(200,200,215,0.45)'; ctx.fillRect(0, 0, SW, SH); }

    // precipitation
    if (W.kind === 'rain' || W.kind === 'thunder') {
      while (drops.length < 70) drops.push([rnd() * SW, rnd() * SH, 0.8 + rnd() * 0.6]);
      ctx.fillStyle = 'rgba(190,210,255,0.6)';
      for (const d of drops) {
        d[1] += d[2] * 3; d[0] -= d[2] * 0.6;
        if (d[1] > SH) { d[1] = -3; d[0] = rnd() * (SW + 10); }
        ctx.fillRect(Math.round(d[0]), Math.round(d[1]), 1, 3);
      }
      // droplets sliding on the glass
      while (glass.length < 14) glass.push([rnd() * SW, rnd() * SH, rnd() * 0.15]);
      ctx.fillStyle = 'rgba(220,235,255,0.55)';
      for (const g of glass) {
        g[1] += g[2]; if (g[1] > SH) { g[1] = 0; g[0] = rnd() * SW; }
        ctx.fillRect(Math.round(g[0]), Math.round(g[1]), 1, 2);
      }
    }
    if (W.kind === 'snow') {
      while (flakes.length < 50) flakes.push([rnd() * SW, rnd() * SH, 0.2 + rnd() * 0.4, rnd() * 6]);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (const f of flakes) {
        f[1] += f[2]; f[0] += Math.sin(t + f[3]) * 0.2;
        if (f[1] > SH) { f[1] = -1; f[0] = rnd() * SW; }
        ctx.fillRect(Math.round(f[0]), Math.round(f[1]), 1, 1);
      }
    }
    if (W.kind === 'thunder') {
      if (flash <= 0 && rnd() < 0.006) { flash = 1; R.emit('thunder'); }
      if (flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + (flash * 0.7).toFixed(2) + ')'; ctx.fillRect(0, 0, SW, SH); flash -= 0.08; }
    }
    skyTex.needsUpdate = true;
    return { day, tw, cloud };
  }

  // ---------- lighting ----------
  const moon = C('#7f8fd6'), gold = C('#ffae6e'), noon = C('#fff1d6');
  const hemiNight = C('#6a63b0'), hemiDay = C('#d6cff2');
  // R.curtainK: 0 open … 1 drawn (windowfx.js); R.dimK: 0 … 1 wind-down mode (bed.js)
  function light(s) {
    const d = s.day * (1 - 0.55 * s.cloud);
    const shade = 1 - 0.8 * (R.curtainK || 0), dim = 1 - 0.65 * (R.dimK || 0);
    R.sun.intensity = (0.35 + 3.0 * d + (flash > 0 ? flash * 3 : 0)) * shade * dim;
    R.sun.color.copy(moon).lerp(noon, s.day).lerp(gold, s.tw * 0.7 * (1 - s.cloud));
    R.hemi.intensity = (0.55 + 1.6 * d * (0.55 + 0.45 * shade)) * dim;
    R.ambient.intensity = (0.25 + 0.5 * d * shade) * dim;
    R.hemi.color.copy(hemiNight).lerp(hemiDay, d);
    R.fairyLight.intensity = (3 + 7 * (1 - s.day)) * (1 - 0.4 * (R.dimK || 0));
    R.night = 1 - s.day;
  }

  R.buildWindow = function () {
    const Wr = R.windowRect;
    const [c, g] = R.canvas(SW, SH);
    ctx = g;
    skyTex = R.nearest(new THREE.CanvasTexture(c));
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(Wr.x1 - Wr.x0 + 0.4, Wr.y1 - Wr.y0 + 0.4), new THREE.MeshBasicMaterial({ map: skyTex }));
    plane.position.set((Wr.x0 + Wr.x1) / 2, (Wr.y0 + Wr.y1) / 2, -4.75);
    R.room.add(plane);
    R.windowPlane = plane;     // windowfx.js makes it open/close
    R.makeClickable(plane, 'window', () => {
      R.toast((W.temp ? W.temp + ' · ' : '') + W.desc + (W.city ? ' · ' + W.city : ''));
    });

    let acc = 0, t = 0;
    let s = drawSky(0); light(s);
    R.tick(dt => {
      t += dt; acc += dt;
      if (acc > 0.08) { acc = 0; s = drawSky(t); light(s); }
    });
    refresh();
    setInterval(refresh, 15 * 60 * 1000);
    let deb;
    R.on('cfg', e => {
      if (!['lat', 'lon', 'tempUnit'].includes(e.name)) return;
      clearTimeout(deb); deb = setTimeout(refresh, 1500);
    });
  };
})(window.R);
