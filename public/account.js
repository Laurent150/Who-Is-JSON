(() => {
  let session = '', user = null, epoch = 0, syncing = false, timer, blocked = false;
  const store = window.WhoLibraryStore;
  let loginAttempt = null, loginTimer, syncWork, toastTimer;
  try { window.WhoTrialOptOut = sessionStorage.getItem('who.trial.off') === '1'; } catch {}
  function trialActive() { return typeof effectiveConfig === 'function' ? effectiveConfig().provider === 'platform' : window.WhoTrial.enabled && !window.WhoTrialOptOut; }
  function trialView() {
    const active = trialActive();
    $('accountUseTrial').textContent = active ? '取消 AI 试用' : '使用 AI 试用';
    $('accountUseTrial').disabled = !active && !window.WhoTrial.enabled;
    if (active) $('accountTrial').textContent = '正在使用 DeepSeek AI 试用';
    else if (window.WhoTrial.enabled) $('accountTrial').textContent = '可使用 AI 试用，也可自行配置服务。';
  }
  function setTrial(on) {
    window.WhoTrialOptOut = !on;
    try { sessionStorage.setItem('who.trial.off', on ? '0' : '1'); } catch {}
    if (typeof config !== 'undefined') config = {};
    if (typeof analysisAbort !== 'undefined') analysisAbort?.abort();
    if (typeof studioReset === 'function') studioReset();
    if (typeof resetTalk === 'function') resetTalk();
    if (typeof connection === 'function') connection();
    trialView();
  }
  window.WhoAccountSession = () => session;
  window.WhoTrial = { enabled: false };
  async function trialQuota() {
    const at = epoch;
    try {
      const q = await call('trial-quota');
      if (at !== epoch || !user) return;
      if (![q.remaining,q.poolRemaining,q.held].every(x => Number.isSafeInteger(x) && x >= 0)) throw Error('额度数据异常');
      window.WhoTrial = { enabled: q.enabled === true && q.remaining > 0 && q.poolRemaining > 0 };
      $('accountTrial').textContent = window.WhoTrial.enabled ? '可使用 AI 试用，也可自行配置服务。' : '试用已结束或暂不可用，可配置自己的 AI。';
    } catch {
      if (at !== epoch) return;
      window.WhoTrial = { enabled: false };
      $('accountTrial').textContent = '平台试用暂不可用，仍可自行配置 AI。';
    }
    trialView();
    if (typeof connection === 'function') connection();
  }
  $('accountUseTrial').onclick = () => {
    setTrial(!trialActive());
  };
  window.WhoRefreshTrial = () => { if (user) return trialQuota(); };
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
  function sync() {
    if (syncing) return syncWork;
    if (!user || blocked) return Promise.resolve(false);
    const currentEpoch = epoch, currentUser = user;
    syncing = true;
    syncWork = (async () => {
    try {
      const snapshot = store.snapshot();
      if (!snapshot.dirty) return true;
      const result = await call('save', { userId: currentUser.id, revision: snapshot.revision, payload: snapshot.payload });
      if (epoch !== currentEpoch) return false;
      store.acknowledged(result.revision, snapshot.sequence, snapshot.payload); note(''); return true;
    } catch (error) { if (epoch === currentEpoch) { fail(error); if (error.status === 409) $('accountReplace').hidden = false; } return false; }
    finally {
      if (epoch === currentEpoch) {
        syncing = false;
        try { if (!blocked && store.snapshot().dirty) schedule(); } catch (error) { fail(error); }
      }
    }
    })();
    return syncWork;
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(() => sync(), 500); }
  async function enter() {
    const ticket = ++epoch;
    const remote = await call('library');
    if (ticket !== epoch) return;
    store.activate(remote.user.id, remote); user = remote.user; blocked = false;
    refresh(); note(''); schedule();
    try {
      const promptKey = 'who.guest.prompted.' + user.id;
      const hasGuest = ['whoisjson.knowledge.v1','codelingo.cards'].some(k => JSON.parse(localStorage.getItem(k) || '[]').length > 0);
      $('accountGuest').hidden = !hasGuest || localStorage.getItem(promptKey) === '1';
      localStorage.setItem(promptKey, '1');
      localStorage.setItem('who.welcome.seen', '1');
    } catch { $('accountGuest').hidden = true; }
    void trialQuota();
  }
  async function action(button, work) {
    button.disabled = true;
    try { await work(); } catch (error) { fail(error); }
    finally { button.disabled = false; }
  }
  const dismiss = () => { try { localStorage.setItem('who.welcome.seen', '1'); } catch {} $('account').close(); };
  $('accountBtn').onclick = () => { trialView(); $('account').showModal(); };
  $('accountClose').onclick = dismiss;
  $('accountSkip').onclick = dismiss;
  $('account').oncancel = () => { try { localStorage.setItem('who.welcome.seen', '1'); } catch {} };
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
      window.WhoTrialOptOut = false;
      try { sessionStorage.setItem('who.trial.off', '0'); } catch {}
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
    window.WhoTrial = { enabled: false };
    if (typeof connection === 'function') connection();
    try { sessionStorage.removeItem('who.account.session'); } catch {}
    store.deactivate(); refresh(); note(''); $('accountReplace').hidden = true; $('accountGuest').hidden = true;
    try { await leaving; } catch {}
  });
  function syncedToast() { clearTimeout(toastTimer); $('accountSyncToast').hidden = false; toastTimer = setTimeout(() => { $('accountSyncToast').hidden = true; }, 2400); }
  $('accountSync').onclick = () => action($('accountSync'), async () => {
    const ticket = epoch;
    blocked = false;
    if (!await sync() || ticket !== epoch || !user) return;
    clearTimeout(timer);
    const before = JSON.stringify(store.snapshot());
    if (store.snapshot().dirty) throw Error('刷新期间收藏发生了变化，本机修改已保留，请再刷新一次。');
    const remote = await call('library');
    if (ticket !== epoch || remote.user.id !== user?.id) return;
    if (before !== JSON.stringify(store.snapshot())) throw Error('刷新期间收藏发生了变化，本机修改已保留，请再刷新一次。');
    store.replace(remote); $('accountReplace').hidden = true; refresh(); note(''); syncedToast();
  });
  $('accountImport').onclick = () => { try { store.importGuest(); $('accountGuest').hidden = true; blocked = false; sync(); } catch (error) { fail(error); } };
  $('accountGuestSkip').onclick = () => { $('accountGuest').hidden = true; };
  $('accountExport').onclick = () => { try { download('Who-Is-JSON-账户收藏备份.json', JSON.stringify(store.snapshot().payload, null, 2)); } catch (e) { fail(e); } };
  $('accountKeepLocal').onclick = () => { $('accountReplace').hidden = true; };
  $('accountReplaceConfirm').onclick = () => action($('accountReplaceConfirm'), async () => {
    if (syncing) throw Error('请等待当前同步结束。');
    blocked = true; clearTimeout(timer);
    const ticket = epoch, before = JSON.stringify(store.snapshot()), remote = await call('library');
    if (ticket !== epoch || remote.user.id !== user?.id) return;
    if (before !== JSON.stringify(store.snapshot())) throw Error('载入期间收藏发生了变化，请导出备份后重试。');
    store.replace(remote); blocked = false; $('accountReplace').hidden = true; refresh(); note(''); syncedToast();
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
    else { try { if (!localStorage.getItem('who.welcome.seen')) $('account').showModal(); } catch {} }
  }).catch(fail);
  refresh();
})();
