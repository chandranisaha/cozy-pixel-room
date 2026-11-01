// Photos from a Google Photos shared album (Customise → photos album link). The helper
// downloads them; they fill the empty photo slots on the wall and the memories drawer.
(function (R) {
  const P = R.photos = { list: [], loading: false, error: '' };

  // same order all day, a new shuffle tomorrow
  function dailyShuffle(a) {
    const d = new Date(), rnd = R.rng(d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate());
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  P.load = function () {
    const url = (R.cfg.photosAlbum || '').trim();
    if (!url) { P.list = []; P.error = ''; R.emit('photos'); return; }
    P.loading = true;
    R.helper.call(R.helper.q('/photos', { url }), 120000)
      .then(j => { P.list = dailyShuffle(j.photos || []); P.error = P.list.length ? '' : 'the album looks empty'; })
      .catch(e => { P.error = String(e.message || e); })
      .finally(() => { P.loading = false; R.emit('photos'); });
  };

  R.on('cfg', ({ name }) => { if (name === 'photosAlbum') P.load(); });
  setTimeout(P.load, 2000);
  setInterval(P.load, 6 * 3600e3);
})(window.R);
