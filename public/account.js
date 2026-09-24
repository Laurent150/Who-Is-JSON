(() => {
  let session = '', user = null, epoch = 0, syncing = false, timer, blocked = false;
  const store = window.WhoLibraryStore;
  let loginAttempt = null, loginTimer;
  try { session = sessionStorage.getItem('who.account.session') || ''; } catch {}
  const note = text => { $('accountStatus').textContent = text; $('accountStatus').hidden = !text; };
  async function call(route, data = {}) {
    const response = await fetch('/api/account/' + route, { method: 'POST', headers: {
      'Content-Type': 'application/json', 'X-CodeLingo-Token': window.APP_TOKEN, 'X-Who-Session': session
    }, body: JSON.stringify(data), signal: AbortSignal.timeout(20000) });
    const body = await response.json();
    if (!response.ok) { const e = Error(body.error || '账户操作未完成。'); e.status = response.status; throw e; }
    return body;
  }
  function refresh() {
    $('accountSignedIn').hidden = !user; $('accountLogin').hidden = !!user;
    $('accountIdentity').textContent = user?.name || user?.email || '';
    $('accountBtn').title = user ? '账户：' + (user.name || user.email) : '登录账户';
    $('libraryLocation').textContent = user ? '账户收藏：' + (user.name || user.email) + '。修改会同步到云端，包括收藏关联的源码。' : '本地收藏，仅保存在当前浏览器。登录后可使用独立的账户收藏库。';
    if ($('library').open) library();
  }
  function fail(error) {
    blocked = true;
    note(error.name === 'TimeoutError' ? '同步超时，本机修改已保留，可以重试。' : error.message);
    if (error.status === 401) note(user ? '登录已过期。本机修改已保留，请退出后重新登录。' : 'GitHub 登录未完成或已过期，请重新登录。');
  }
  async function sync() {
    if (!user || syncing || blocked) return;
    const currentEpoch = epoch, currentUser = user;
    syncing = true;
    try {
      const snapshot = store.snapshot();
      if (!snapshot.dirty) { note('收藏已同步。'); return; }
      note('正在同步收藏…');
      const result = await call('save', { userId: currentUser.id, revision: snapshot.revision, payload: snapshot.payload });
      if (epoch !== currentEpoch) return;
      store.acknowledged(result.revision, snapshot.sequence, snapshot.payload); note('收藏已同步。');
    } catch (error) { if (epoch === currentEpoch) fail(error); }
    finally {
      if (epoch === currentEpoch) {
        syncing = false;
        try { if (!blocked && store.snapshot().dirty) schedule(); } catch (error) { fail(error); }
      }
    }
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(() => sync(), 500); }
  async function enter() {
    const ticket = ++epoch;
    const remote = await call('library');
    if (ticket !== epoch) return;
    store.activate(remote.user.id, remote); user = remote.user; blocked = false;
    refresh(); note(store.snapshot().dirty ? '本机有待同步修改，正在尝试同步。' : '已登录，收藏已从云端载入。'); schedule();
  }
  async function action(button, work) {
    button.disabled = true;
    try { await work(); } catch (error) { fail(error); }
    finally { button.disabled = false; }
  }
  $('accountBtn').onclick = () => $('account').showModal();
  $('accountClose').onclick = () => $('account').close();
  function stopLogin() {
    const old = loginAttempt; loginAttempt = null; clearTimeout(loginTimer);
    $('accountGithub').disabled = false; $('accountCancel').hidden = true;
    if (old?.ticket) call('github-cancel', { ticket: old.ticket }).catch(() => {});
  }
  async function pollLogin(attempt) {
    if (loginAttempt !== attempt) return;
    try {
      const result = await call('github-poll', { ticket: attempt.ticket });
      if (loginAttempt !== attempt) return;
      if (result.pending) {
        if (Date.now() >= attempt.expires) throw Error('登录等待已超时，请重试。');
        loginTimer = setTimeout(() => pollLogin(attempt), 2000); return;
      }
      loginAttempt = null; $('accountGithub').disabled = false; $('accountCancel').hidden = true;
      session = result.session;
      try { sessionStorage.setItem('who.account.session', session); } catch {}
      await enter();
    } catch (error) { if (loginAttempt === attempt) { stopLogin(); fail(error); } else if (session) fail(error); }
  }
  $('accountGithub').onclick = async () => {
    // Open synchronously with the user's click; keep the editor and in-memory AI configuration intact.
    const popup = window.open('about:blank', '_blank');
    if (!popup) return note('请允许打开登录窗口，然后重试。');
    popup.opener = null;
    const attempt = { expires: Date.now() + 600000 }; loginAttempt = attempt;
    $('accountGithub').disabled = true; $('accountCancel').hidden = false;
    try {
      const result = await call('github-start');
      if (loginAttempt !== attempt) { call('github-cancel', { ticket: result.ticket }).catch(() => {}); popup.close(); return; }
      attempt.ticket = result.ticket; popup.location.href = result.url;
      note('请在新窗口完成 GitHub 登录，完成后回到这里。');
      await pollLogin(attempt);
    } catch (error) { popup.close(); if (loginAttempt === attempt) { stopLogin(); fail(error); } }
  };
  $('accountCancel').onclick = () => { stopLogin(); note('已取消登录，可以继续使用本地收藏。'); };
  $('accountLogout').onclick = () => action($('accountLogout'), async () => {
    const leaving = call('logout');
    epoch++; clearTimeout(timer); user = null; session = ''; blocked = false; syncing = false;
    try { sessionStorage.removeItem('who.account.session'); } catch {}
    store.deactivate(); refresh(); note('已退出账户，回到原来的本地收藏。待同步修改仍保留在本机账户备份中。');
    try { await leaving; } catch {}
  });
  $('accountSync').onclick = () => { blocked = false; sync(); };
  $('accountImport').onclick = () => { try { store.importGuest(); blocked = false; sync(); } catch (error) { fail(error); } };
  $('accountExport').onclick = () => { try { download('Who-Is-JSON-账户收藏备份.json', JSON.stringify(store.snapshot().payload, null, 2)); } catch (e) { fail(e); } };
  $('accountBackup').onclick = () => { try { download('Who-Is-JSON-替换前备份.json', JSON.stringify(store.backup(), null, 2)); } catch (e) { fail(e); } };
  $('accountReload').onclick = () => { $('accountReplace').hidden = false; };
  $('accountReplaceConfirm').onclick = () => action($('accountReplaceConfirm'), async () => {
    if (syncing) throw Error('请等待当前同步结束。');
    blocked = true; clearTimeout(timer);
    const ticket = epoch, before = JSON.stringify(store.snapshot()), remote = await call('library');
    if (ticket !== epoch || remote.user.id !== user?.id) return;
    if (before !== JSON.stringify(store.snapshot())) throw Error('载入期间收藏发生了变化，请导出备份后重试。');
    store.replace(remote); blocked = false; $('accountReplace').hidden = true; refresh(); note('已载入云端版本，之前的本机版本仍保留在备份中。');
  });
  window.addEventListener('who-library-change', schedule);
  // Saving in another tab never silently overwrites this tab's remote revision.
  window.addEventListener('storage', e => { if (user && e.key === 'whoisjson.account-library.v1.' + user.id) refresh(); });
  call('status').then(async result => {
    $('accountGithub').disabled = !result.enabled;
    $('accountGithub').title = result.enabled ? '' : '云服务尚未启用';
    if (!result.enabled) return note('');
    note('');
    if (session) { try { await enter(); } catch (error) { fail(error); } }
  }).catch(fail);
  refresh();
})();
