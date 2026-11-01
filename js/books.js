// Bookshelf links: each book on the wall shelf is one of your bookmarks (assets/manifest.js
// → books). Hover to read the spine, click to pull it out and open the link.
(function (R) {
  const DEFAULT = [
    { title: 'Claude', url: 'https://claude.ai' },
    { title: 'Gmail', url: 'https://mail.google.com' },
    { title: 'Google Calendar', url: 'https://calendar.google.com' },
    { title: 'Outlook', url: 'https://outlook.live.com/mail/' },
    { title: 'Google Drive', url: 'https://drive.google.com' },
    { title: 'YouTube', url: 'https://youtube.com' },
    { title: 'GitHub', url: 'https://github.com' },
    { title: 'Spotify', url: 'spotify:' },
    { title: 'Pinterest', url: 'https://pinterest.com' },
    { title: 'Notion', url: 'https://notion.so' },
  ];

  R.buildBooks = function () {
    const list = (window.ROOM_ASSETS && window.ROOM_ASSETS.books) || DEFAULT;
    R.shelfBooks.forEach((b, i) => {
      const bm = list[i];
      if (!bm) return;
      const home = b.position.clone();
      let pull = 0;
      R.makeClickable(b, '📖 ' + bm.title, () => {
        pull = 1;
        R.sfx.pop(300 + i * 40);
        R.toast('opening ' + bm.title + '…');
        R.openLink(bm.url);
      });
      R.tick(dt => {
        const hover = R.hovered === b ? 1 : 0;
        if (pull > 0) pull = Math.max(0, pull - dt * 0.8);
        // books face into the room (+x): hover tips the top out, a click slides it out
        const out = hover * 0.08 + Math.sin(Math.min(pull, 1) * Math.PI) * 0.35;
        b.position.x = R.damp(b.position.x, home.x + out, 12, dt);
        b.rotation.z = R.damp(b.rotation.z, -hover * 0.12, 10, dt);
      });
    });
  };
})(window.R);
