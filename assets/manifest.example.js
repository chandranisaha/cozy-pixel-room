// Your room's content. Copy this file to assets/manifest.js and edit that copy
// (manifest.js is git-ignored, so your links and photos stay private).
// After adding images, run:  python tools/embed_assets.py   (lets WebGL use them under Lively's file:// mode)
window.ROOM_ASSETS = {
  // 9 slots on the wall grid (3x3, left→right, top→bottom).
  // type: 'polaroid' | 'photo' | 'note'.  src: image path like 'assets/photos/me.jpg' (blank = placeholder art,
  // or a photo from your Google Photos album if you set one in Customise).
  wall: [
    { type: 'polaroid', src: '', caption: 'summer sunsets' },
    { type: 'note', text: 'drink water\n& stretch :)', color: '#f7e27a' },
    { type: 'photo', src: '', caption: 'mountains' },
    { type: 'photo', src: '', caption: 'night sky' },
    { type: 'polaroid', src: '', caption: 'the cat' },
    { type: 'note', text: 'you got\nthis!', color: '#f6b6c4' },
    { type: 'note', text: 'todo:\nbe kind\nto me', color: '#a9dcc8' },
    { type: 'polaroid', src: '', caption: 'flowers' },
    { type: 'photo', src: '', caption: 'city lights' },
  ],

  // Optional local music (mp3/ogg). Empty = built-in generative lofi.
  music: [
    // 'assets/music/track1.mp3',
  ],

  // Records in the crate that open elsewhere, e.g. your Spotify playlists
  // (Spotify → playlist → Share → Copy link; use the https link or 'spotify:playlist:<id>').
  records: [
    // { title: 'my study mix', url: 'https://open.spotify.com/playlist/37i9dQZF1DX8Uebhn9wzrS', color: '#1db954', label: '#191414' },
  ],

  // Books on the wall shelf, left → right (up to 10). Web links, spotify: links or folders.
  books: [
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
  ],

  // Optional art overrides for later (sprite sheets etc.). Unused for now.
  art: {},
};
