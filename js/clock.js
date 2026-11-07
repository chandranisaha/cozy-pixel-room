// Wall clock on the left wall, real local time.
(function (R) {
  R.buildClock = function () {
    const g = R.group(-5.97, 4.55, -0.3, R.room);    // centred over the bookshelf, in the row with the poster and calendar
    g.rotation.y = Math.PI / 2;

    const face = R.canvasTex(32, 32, (c, w, h) => {
      const r = 15;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const d = Math.hypot(x - 15.5, y - 15.5);
        if (d < r) { c.fillStyle = d > r - 2 ? '#3a3560' : '#f4ead6'; c.fillRect(x, y, 1, 1); }
      }
      c.fillStyle = '#3a3560';
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2;
        const L = i % 3 === 0 ? 2 : 1;
        for (let k = 0; k < L; k++)
          c.fillRect(Math.round(15.5 + Math.sin(a) * (11 - k)), Math.round(15.5 - Math.cos(a) * (11 - k)), 1, 1);
      }
    });
    const faceMat = new THREE.MeshLambertMaterial({ map: face, transparent: true, alphaTest: 0.5 });
    const disc = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), faceMat);
    g.add(disc);

    const hand = (len, wid, color, z) => {
      const pivot = R.group(0, 0, z, g);
      const m = new THREE.Mesh(new THREE.BoxGeometry(wid, len, 0.02), R.mat(color));
      m.position.y = len / 2 - 0.05;
      pivot.add(m);
      return pivot;
    };
    const hourH = hand(0.32, 0.07, '#3a3560', 0.02);
    const minH = hand(0.48, 0.05, '#3a3560', 0.035);
    const secH = hand(0.5, 0.02, '#d0565b', 0.05);
    R.box(0.08, 0.08, 0.04, R.mat('#d0565b'), 0, 0, 0.06, g);

    R.tick(() => {
      const d = new Date();
      const s = d.getSeconds() + d.getMilliseconds() / 1000;
      const m = d.getMinutes() + s / 60;
      const h = (d.getHours() % 12) + m / 60;
      secH.rotation.z = -Math.floor(s) / 60 * Math.PI * 2;  // ticks, doesn't sweep
      minH.rotation.z = -m / 60 * Math.PI * 2;
      hourH.rotation.z = -h / 12 * Math.PI * 2;
    });
    R.makeClickable(disc, 'clock', () => R.toast(new Date().toLocaleString([], { weekday: 'long', hour: '2-digit', minute: '2-digit' })));
  };
})(window.R);
