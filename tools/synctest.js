// Two-screen sync test. Run a test helper (cozy-helper.ps1 -Port 38999 -Data <tmp> -Test), then
// load index.html?sync&helperPort=38999&synctest=b in one headless browser and, a moment later,
// ?...&synctest=a in another. "a" acts like the screen you're using; "b" is the other screen
// and logs "SYNCTEST ..." lines about what it picked up.
(async function (R) {
  const role = R.params.get('synctest');
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const log = s => console.log('SYNCTEST ' + role + ' ' + s);
  const find = re => R.clickable.find(o => re.test(o.userData.label || ''));
  await wait(1500);
  if (role === 'a') {
    R.lastInput = Date.now();
    R.windowPlane.userData.onClick();                         // open the window
    const cur = find(/^curtain/); cur.userData.onDragStart(); cur.userData.onDragEnd(false);   // draw curtains
    find(/^desk lamp/).userData.onClick();                    // lamp
    R.pomo.startFocus();
    R.tasks.add('synced task');
    log('acted · lamp=' + R.lamp.on + ' pomo=' + R.pomo.mode);
    return;
  }
  const before = { open: R.windowState.open, curtain: R.curtainK, lamp: R.lamp.on, pomo: R.pomo.mode };
  let sfx = 0, toasts = 0, girl = [];
  R.on('remote:sfx', e => sfx++);
  R.on('focus:start', () => girl.push('focus:start'));
  const toast = document.getElementById('toast');
  new MutationObserver(() => { if (!toast.hidden) toasts++; }).observe(toast, { attributes: true, childList: true });
  log('start ' + JSON.stringify(before));
  for (let i = 0; i < 20 && !(R.tasks.list.some(t => t.text === 'synced task') && R.pomo.mode === 'focus'); i++) await wait(500);
  await wait(1500);
  log('window ' + (R.windowState.open !== before.open ? 'changed' : 'same') + ' open=' + R.windowState.open);
  log('curtain ' + before.curtain + ' -> ' + R.curtainK.toFixed(2));
  log('lamp ' + before.lamp + ' -> ' + R.lamp.on);
  log('pomo ' + before.pomo + ' -> ' + R.pomo.mode + ' events=' + girl.join(','));
  log('tasks ' + JSON.stringify(R.tasks.list.map(t => t.text)));
  log('remote sounds=' + sfx + ' toasts shown=' + toasts);
})(window.R);
