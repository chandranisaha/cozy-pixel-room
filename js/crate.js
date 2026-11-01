// Record crate next to the turntable: flip through records to pick what plays.
// Built-in stations play in the room; records with a link (Spotify playlists etc., listed in
// assets/manifest.js → records) open in their app.
(function (R) {
  const M = R.music;

  function sleeveCanvas(r, i) {
    const [c, g] = R.canvas(24, 24);
    g.fillStyle = r.color; g.fillRect(0, 0, 24, 24);
    g.fillStyle = r.label;
    const rnd = R.rng(7 + i * 13);
    const style = i % 3;
    if (style === 0) { for (let y = 3; y < 24; y += 5) g.fillRect(0, y, 24, 2); }
    else if (style === 1) { for (let d = 0; d < 9; d++) g.fillRect(12 - d, 12 - d, d * 2, 1); g.fillRect(4, 18, 16, 2); }
    else { for (let k = 0; k < 12; k++) g.fillRect(Math.floor(rnd() * 22), Math.floor(rnd() * 22), 2, 2); }
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 22, 24, 2);
    return c;
  }

  function openCrate() {
    const all = M.stations.concat(M.links);
    R.panel('record crate', body => {
      // what Spotify (app or browser) is playing, with its controls
      const now = R.el('div', { cls: 'nowplaying' });
      const drawNow = () => {
        now.textContent = '';
        const m = M.media;
        if (!R.helper.ok) return now.append(R.el('small', { cls: 'dim', text: 'start the helper to control Spotify from here' }));
        if (!m.active) return now.append(R.el('small', { cls: 'dim', text: 'play something on Spotify (the app or open.spotify.com) and control it from here' }));
        const cmd = w => () => M.mediaCmd(w).then(drawNow).catch(e => R.toast(String(e.message || e)));
        now.append(R.el('div', { cls: 'np-title', text: (m.playing ? '♪ ' : '❚❚ ') + (m.title || 'something') + (m.artist ? ' — ' + m.artist : '') }),
          R.el('div', { cls: 'prow' },
            R.el('button', { text: '⏮', title: 'previous', onclick: cmd('prev') }),
            R.el('button', { text: m.playing ? '❚❚' : '▶', title: 'play / pause', onclick: cmd('toggle') }),
            R.el('button', { text: '⏭', title: 'next', onclick: cmd('next') }),
            R.el('small', { cls: 'dim', text: /spotify/i.test(m.app) ? 'spotify' : 'via ' + (m.app.split(/[\\!.]/).filter(Boolean).pop() || 'browser') })));
      };
      drawNow(); M.pollMedia().then(drawNow);
      body.append(now);
      const grid = R.el('div', { cls: 'crate' });
      all.forEach((r, i) => {
        const cv = sleeveCanvas(r, i); cv.className = 'sleeve-art';
        const playing = M.playing && M.station && M.station.id === r.id;
        grid.append(R.el('button', {
          cls: 'sleeve' + (playing ? ' on' : ''),
          title: r.kind === 'link' ? 'opens ' + r.url : 'play in the room',
          onclick: () => {
            if (r.kind === 'link') { M.stop(); R.openLink(r.url); R.emit('record:link', r); R.toast('opening ' + r.title + '…'); }
            else { M.play(r.id); R.toast('♪ ' + r.title); }
            R.sfx.pop(420);
            R.closePanel();
          },
        }, cv, R.el('span', { text: r.title }), r.kind === 'link' ? R.el('small', { text: '↗ ' + (r.url.startsWith('spotify') ? 'spotify' : 'link') }) : null));
      });
      body.append(grid);
      const row = R.el('div', { cls: 'prow' });
      if (M.playing) row.append(R.el('button', { text: '■ stop', onclick: () => { M.stop(); R.closePanel(); } }));
      if (!M.links.length) row.append(R.el('small', { cls: 'dim', text: 'add your Spotify playlists in assets/manifest.js → records' }));
      body.append(row);
    });
  }

  R.buildCrate = function () {
    const crate = R.group(-5.25, 0, 1.55, R.room);
    const wood = R.mat('#9a6a44'), dark = R.mat('#6a4a30');
    R.box(0.8, 0.08, 0.95, dark, 0, 0.04, 0, crate);
    R.box(0.06, 0.55, 0.95, wood, -0.37, 0.3, 0, crate);
    R.box(0.06, 0.55, 0.95, wood, 0.37, 0.3, 0, crate);
    R.box(0.8, 0.45, 0.06, wood, 0, 0.25, -0.45, crate);
    R.box(0.8, 0.3, 0.06, wood, 0, 0.18, 0.45, crate);
    const recs = M.stations.concat(M.links);
    const sleeves = [];
    const n = Math.max(5, recs.length);
    for (let i = 0; i < n; i++) {
      const r = recs[i % recs.length];
      const tex = R.nearest(new THREE.CanvasTexture(sleeveCanvas(r, i % recs.length)));
      const s = R.box(0.62, 0.62, 0.03, [R.mat(r.color), R.mat(r.color), R.mat(r.color), R.mat(r.color), R.texMat(tex), R.mat(r.color)], 0, 0.42, 0.33 - i * 0.14, crate);
      s.rotation.x = -0.18;
      s.userData.base = s.position.clone();
      sleeves.push(s);
    }
    // flip animation on hover: records lean forward one after another
    let t = 0;
    R.tick(dt => {
      t += dt;
      const hot = R.hovered === crate;
      sleeves.forEach((s, i) => {
        const lean = hot ? -0.18 + 0.45 * Math.max(0, Math.sin(t * 3 - i * 0.7)) : -0.18;
        s.rotation.x = R.damp(s.rotation.x, lean, 8, dt);
        s.position.y = R.damp(s.position.y, s.userData.base.y + (hot && i === Math.floor(t * 0.48) % n ? 0.12 : 0), 8, dt);
      });
    });
    R.makeClickable(crate, 'record crate · pick music', openCrate);
  };
})(window.R);
