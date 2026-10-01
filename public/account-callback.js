// Remove the one-time authorization code from the visible address/history.
history.replaceState(null, '', '/auth/callback');
document.documentElement.lang = WhoI18n.locale;
document.title = WhoI18n.t('GitHub 登录');
for (const node of document.querySelectorAll('main h1, main p')) node.textContent = WhoI18n.t(node.textContent);
