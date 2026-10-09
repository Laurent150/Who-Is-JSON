var uiText = globalThis.WhoI18n?.t || ((text,...values)=>text.replace(/\{(\d+)\}/g,(m,n)=>n<values.length?String(values[n]):m));
var uiError = globalThis.WhoI18n?.error || (error=>uiText(error?.message || String(error || '请求未完成。')));
(() => {
  let session = '', user = null, epoch = 0, syncing = false, timer, blocked = false;
  const store = window.WhoLibraryStore;
  let capabilities = { libraryEnabled: true };
  let quotaState = null, quotaRequest = 0, quotaError = '', quotaChecking = false;
  const cloudBase = () => capabilities.provider === 'cloudbase';
  let loginAttempt = null, loginTimer, syncWork, toastTimer;
  try { window.WhoTrialOptOut = sessionStorage.getItem('who.trial.off') === '1'; } catch {}
  function trialActive() { return typeof effectiveConfig === 'function' ? effectiveConfig().provider === 'platform' : window.WhoTrial.enabled && !window.WhoTrialOptOut; }
  function trialView() {
    $('accountRetryQuota').hidden = !user || !cloudBase() || !capabilities.trialEnabled || !quotaError;
    $('accountRetryQuota').disabled = quotaChecking;
    $('accountRetryQuota').textContent = uiText(quotaChecking ? '正在查询额度…' : '重新查询额度');
    $('accountQuota').hidden = !user || !cloudBase() || !quotaState || !capabilities.trialEnabled;
    if (!$('accountQuota').hidden) {
      const percent = Math.min(100, Math.max(0, quotaState.remaining / quotaState.grant * 100));
      $('accountQuotaLabel').textContent = uiText('剩余试用额度');
      $('accountQuotaPercent').textContent = percent > 0 && percent < 1 ? '<1%' : Math.floor(percent) + '%';
      $('accountQuotaBar').value = percent;
    }
    if (cloudBase() && !capabilities.trialEnabled) {
      $('accountTrial').textContent = uiText('CloudBase 账户试用尚未启用，请在 AI 设置中连接自己的服务。');
      $('accountUseTrial').disabled = true; $('accountUseTrial').hidden = true; return;
    }
    const active = trialActive();
    $('accountUseTrial').hidden = false;
    $('accountUseTrial').textContent = active ? uiText("取消 AI 试用") : uiText("使用 AI 试用");
    $('accountUseTrial').disabled = !active && !window.WhoTrial.enabled;
    if (active) $('accountTrial').textContent = uiText("正在使用 DeepSeek AI 试用");
    else if (window.WhoTrial.enabled) $('accountTrial').textContent = uiText("可使用 AI 试用，也可自行配置服务。");
    else if (user?.trialEligible === false) $('accountTrial').textContent = uiText("邮箱账户可同步收藏，请在 AI 设置中连接自己的服务。");
    if (cloudBase() && quotaState) {
      if (!quotaState.enabled) $('accountTrial').textContent = uiText('平台试用已暂停。');
      else if (quotaState.held > 0) $('accountTrial').textContent = uiText('上一笔调用仍在处理或待核对。');
      else if (quotaState.remaining === 0) $('accountTrial').textContent = uiText('试用已结束或暂不可用，可配置自己的 AI。');
    }
    if (quotaError) $('accountTrial').textContent = uiText(quotaError);
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
    const at = epoch, request = ++quotaRequest;
    quotaChecking = true; trialView();
    try {
      const q = await call('trial-quota');
      if (at !== epoch || request !== quotaRequest || !user) return;
      const unlimited = cloudBase() && q.unlimitedPool === true && q.poolRemaining === null;
      if (![q.remaining,q.held,...(unlimited ? [] : [q.poolRemaining])].every(x => Number.isSafeInteger(x) && x >= 0)) throw Error(uiText("额度数据异常"));
      if (cloudBase() && capabilities.trialEnabled && (q.grant !== 2000000 || q.unit !== 1000000 || q.currency !== 'CNY' || q.remaining + q.held > q.grant)) throw Error(uiText("额度数据异常"));
      quotaState = cloudBase() && capabilities.trialEnabled ? q : null;
      quotaError = '';
      window.WhoTrial = { enabled: q.enabled === true && q.remaining > 0 && q.held === 0 && (unlimited || q.poolRemaining > 0) };
      $('accountTrial').textContent = window.WhoTrial.enabled ? uiText("可使用 AI 试用，也可自行配置服务。") : uiText("试用已结束或暂不可用，可配置自己的 AI。");
    } catch (error) {
      if (at !== epoch || request !== quotaRequest) return;
      quotaState = null;
      window.WhoTrial = { enabled: false };
      const reasons = ['请先登录。', '登录已过期，请重新登录。', '未能确认邮箱身份。', '暂时无法验证登录。', '平台试用尚未启用。', '额度服务暂时不可用。', '额度数据异常'];
      const reason = reasons.find(text => error.message === text || error.message === uiText(text));
      quotaError = cloudBase() ? (error.name === 'TimeoutError' || error.name === 'AbortError'
        ? '额度查询超时，尚未确认剩余额度。请重新查询。'
        : reason || '额度查询失败，尚未确认剩余额度。请重新查询。')
        : '平台试用暂不可用，仍可自行配置 AI。';
    }
    quotaChecking = false;
    trialView();
    if (typeof connection === 'function') connection();
  }
  $('accountRetryQuota').onclick = () => { if (user && !quotaChecking) return trialQuota(); };
  $('accountUseTrial').onclick = () => {
    setTrial(!trialActive());
  };
  window.WhoRefreshTrial = () => { if (user) return trialQuota(); };
  try { session = sessionStorage.getItem('who.account.session') || ''; } catch {}
  let notice = '';
  const note = text => {
    notice = text ? Object.keys(globalThis.WhoEnglish || {}).find(key => globalThis.WhoEnglish[key] === text) || text : '';
    $('accountStatus').textContent = uiText(notice); $('accountStatus').hidden = !notice;
  };
  async function call(route, data = {}) {
    const response = await fetch('/api/account/' + route, { method: 'POST', headers: {
      'Content-Type': 'application/json', 'X-CodeLingo-Token': window.APP_TOKEN, 'X-Who-Session': session
    }, body: JSON.stringify(data), signal: AbortSignal.timeout(route==='trial-quota'?40000:20000) });
    const body = await response.json();
    if (!response.ok) { const e = Error(body.error || uiText("账户操作未完成。")); e.status = response.status; throw e; }
    return body;
  }
  function refresh() {
    $('accountSignedIn').hidden = !user; $('accountLogin').hidden = !!user;
    $('accountIdentity').textContent = user?.name || user?.email || '';
    $('accountBtn').title = user ? uiText("账户：") + (user.name || user.email) : uiText("登录账户");
    $('accountSync').hidden = !capabilities.libraryEnabled;
    $('accountLoginTitle').textContent = uiText(cloudBase() ? '登录 FIMI 账户' : '登录后，直接用 AI 读代码');
    $('accountCloudbaseNotice').hidden = !cloudBase();
    $('accountCloudbaseNotice').textContent = uiText(capabilities.trialEnabled ? '登录赠送AI试用额度，也可自行配置服务' : 'CloudBase 邮箱登录测试。试用额度尚未启用，可连接自己的 AI 服务。');
    $('accountGithubIntro').hidden = cloudBase();
    $('accountLegacyHint').hidden = cloudBase();
    $('accountEmailHint').hidden = cloudBase();
    $('accountSyncHint').hidden = !capabilities.libraryEnabled;
    $('accountLocalHint').hidden = capabilities.libraryEnabled;
    $('accountLocalHint').textContent = uiText('当前仅测试账户登录，收藏仍保存在本机，尚未同步到 CloudBase。');
    $('libraryLocation').textContent = user && capabilities.libraryEnabled ? uiText("账户收藏：") + (user.name || user.email) + uiText("。修改会同步到云端，包括收藏关联的源码。") : uiText("本地收藏，仅保存在当前浏览器。登录后可使用独立的账户收藏库。");
    if ($('library').open) library();
    if (typeof refreshExplanationSaves === 'function') refreshExplanationSaves();
  }
  function fail(error) {
    blocked = true;
    note(error.name === 'TimeoutError' ? uiText("同步超时，本机修改已保留，可以重试。") : uiError(error));
    if (error.status === 401 && user) note(uiText("登录已过期。本机修改已保留，请退出后重新登录。"));
  }
  function sync() {
    if (syncing) return syncWork;
    if (!user || blocked || !capabilities.libraryEnabled) return Promise.resolve(false);
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
    if (!capabilities.libraryEnabled) {
      const remote = await call('me');
      if (ticket !== epoch) return;
      store.deactivate(); user = remote.user; blocked = false;
      $('accountGuest').hidden = true; $('accountReplace').hidden = true;
      refresh(); note(''); void trialQuota(); return;
    }
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
  const dismiss = () => { stopEmail(); try { localStorage.setItem('who.welcome.seen', '1'); } catch {} $('account').close(); };
  $('accountBtn').onclick = () => {
    trialView(); $('account').showModal();
    if (user) void trialQuota();
  };
  $('accountClose').onclick = dismiss;
  $('account').oncancel = () => { stopEmail(); try { localStorage.setItem('who.welcome.seen', '1'); } catch {} };
  let emailAttempt = null;
  function stopEmail() {
    const old = emailAttempt; emailAttempt = null;
    $('accountEmailCode').value = ''; $('accountEmailVerify').hidden = true;
    $('accountEmailAddress').disabled = false;
    if (old?.ticket) call('email-cancel', { ticket:old.ticket }).catch(() => {});
  }
  async function acceptLogin(result) {
    session = result.session;
    try { sessionStorage.setItem('who.account.session', session); } catch {}
    window.WhoTrialOptOut = false;
    try { sessionStorage.setItem('who.trial.off', '0'); } catch {}
    await enter();
  }
  $('accountEmailSend').onclick = () => action($('accountEmailSend'), async () => {
    stopLogin(); stopEmail();
    const email = $('accountEmailAddress').value.trim();
    const attempt = {}; emailAttempt = attempt;
    $('accountEmailAddress').disabled = true;
    try {
      const result = await call('email-start', { email, locale: globalThis.WhoI18n?.locale || 'en' });
      if (emailAttempt !== attempt) { call('email-cancel', { ticket:result.ticket }).catch(() => {}); return; }
      attempt.ticket = result.ticket;
      $('accountEmailVerify').hidden = false;
      note(uiText('验证码已发送，请在此输入；未收到可在一分钟后重试。'));
    } catch (error) { if (emailAttempt === attempt) { stopEmail(); throw error; } }
  });
  $('accountEmailConfirm').onclick = () => action($('accountEmailConfirm'), async () => {
    const attempt = emailAttempt;
    if (!attempt?.ticket) return;
    const code = $('accountEmailCode').value.trim(); $('accountEmailCode').value = '';
    try {
      const result = await call('email-verify', { ticket:attempt.ticket, code });
      if (emailAttempt !== attempt) {
        fetch('/api/account/logout', { method:'POST', headers:{'Content-Type':'application/json','X-CodeLingo-Token':window.APP_TOKEN,'X-Who-Session':result.session}, body:'{}' }).catch(() => {});
        return;
      }
      stopEmail(); await acceptLogin(result);
    } catch (error) {
      if (emailAttempt === attempt) { if (error.status !== 400) stopEmail(); throw error; }
      if (session) throw error;
    }
  });
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
        if (Date.now() >= attempt.expires) throw Error(uiText("登录等待已超时，请重试。"));
        loginTimer = setTimeout(() => pollLogin(attempt), 2000); return;
      }
      loginAttempt = null; $('accountGithub').disabled = false; $('accountCancel').hidden = true;
      await acceptLogin(result);
    } catch (error) { if (loginAttempt === attempt) { stopLogin(); fail(error); } else if (session) fail(error); }
  }
  $('accountGithub').onclick = async () => {
    stopEmail();
    // Open synchronously with the user's click; keep the editor and in-memory AI configuration intact.
    const popup = window.open('about:blank', '_blank');
    if (!popup) return note(uiText("请允许打开登录窗口，然后重试。"));
    popup.opener = null;
    const attempt = { expires: Date.now() + 600000 }; loginAttempt = attempt;
    $('accountGithub').disabled = true; $('accountCancel').hidden = false;
    try {
      const result = await call('github-start');
      if (loginAttempt !== attempt) { call('github-cancel', { ticket: result.ticket }).catch(() => {}); popup.close(); return; }
      attempt.ticket = result.ticket; popup.location.href = result.url;
      note(uiText("请在新窗口完成 GitHub 登录，完成后回到这里。"));
      await pollLogin(attempt);
    } catch (error) { popup.close(); if (loginAttempt === attempt) { stopLogin(); fail(error); } }
  };
  $('accountCancel').onclick = () => { stopLogin(); note(uiText("已取消登录，可以继续使用本地收藏。")); };
  $('accountLogout').onclick = () => action($('accountLogout'), async () => {
    const leaving = call('logout');
    epoch++; clearTimeout(timer); user = null; session = ''; blocked = false; syncing = false; quotaState = null; quotaError = ''; quotaChecking = false;
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
    if (store.snapshot().dirty) throw Error(uiText("刷新期间收藏发生了变化，本机修改已保留，请再刷新一次。"));
    const remote = await call('library');
    if (ticket !== epoch || remote.user.id !== user?.id) return;
    if (before !== JSON.stringify(store.snapshot())) throw Error(uiText("刷新期间收藏发生了变化，本机修改已保留，请再刷新一次。"));
    store.replace(remote); $('accountReplace').hidden = true; refresh(); note(''); syncedToast();
  });
  $('accountImport').onclick = () => { try { store.importGuest(); $('accountGuest').hidden = true; blocked = false; sync(); } catch (error) { fail(error); } };
  $('accountGuestSkip').onclick = () => { $('accountGuest').hidden = true; };
  $('accountExport').onclick = () => { try { download(uiText("Who-Is-JSON-账户收藏备份.json"), JSON.stringify(store.snapshot().payload, null, 2)); } catch (e) { fail(e); } };
  $('accountKeepLocal').onclick = () => { $('accountReplace').hidden = true; };
  $('accountReplaceConfirm').onclick = () => action($('accountReplaceConfirm'), async () => {
    if (syncing) throw Error(uiText("请等待当前同步结束。"));
    blocked = true; clearTimeout(timer);
    const ticket = epoch, before = JSON.stringify(store.snapshot()), remote = await call('library');
    if (ticket !== epoch || remote.user.id !== user?.id) return;
    if (before !== JSON.stringify(store.snapshot())) throw Error(uiText("载入期间收藏发生了变化，请导出备份后重试。"));
    store.replace(remote); blocked = false; $('accountReplace').hidden = true; refresh(); note(''); syncedToast();
  });
  window.addEventListener('who-library-change', schedule);
  window.addEventListener('who-language-change', () => { trialView(); refresh(); note(notice); });
  // Saving in another tab never silently overwrites this tab's remote revision.
  window.addEventListener('storage', e => { if (user && e.key === 'whoisjson.account-library.v1.' + user.id) refresh(); });
  call('status').then(async result => {
    capabilities = { ...result, libraryEnabled: result.libraryEnabled !== false };
    $('accountGithub').hidden = result.githubEnabled === false;
    refresh();
    $('accountEmailLogin').hidden = !result.emailEnabled;
    $('accountGithub').disabled = !result.enabled;
    $('accountGithub').title = result.enabled ? '' : uiText("云服务尚未启用");
    if (!result.enabled) return note('');
    note('');
    if (session) { try { await enter(); } catch (error) { fail(error); if (!user) $('account').showModal(); } }
    else $('account').showModal();
  }).catch(fail);
  refresh();
})();
