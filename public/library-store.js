(function(root) {
  const fields = { 'whoisjson.knowledge.v1': 'knowledge', 'codelingo.cards': 'cards' };
  let owner = null;
  const key = id => 'whoisjson.account-library.v1.' + id;
  function read(id = owner) {
    const raw = localStorage.getItem(key(id));
    const data = raw && JSON.parse(raw);
    if (!data || !Array.isArray(data.payload?.knowledge) || !Array.isArray(data.payload?.cards) || !Number.isSafeInteger(data.revision) || data.revision < 0 || !Number.isSafeInteger(data.sequence)) throw Error('账户收藏暂时无法读取，原数据已保留。');
    return data;
  }
  function write(data, id = owner) { localStorage.setItem(key(id), JSON.stringify(data)); }
  const store = {
    getItem(name) { return owner && fields[name] ? JSON.stringify(read().payload[fields[name]]) : localStorage.getItem(name); },
    setItem(name, value) {
      if (!owner || !fields[name]) return localStorage.setItem(name, value);
      const data = read(); data.payload[fields[name]] = JSON.parse(value); data.dirty = true; data.sequence++;
      write(data); root.dispatchEvent(new Event('who-library-change'));
    },
    activate(id, remote) {
      const existing = localStorage.getItem(key(id));
      if (!existing || !read(id).dirty) write({ payload: remote.payload, revision: remote.revision, dirty: false, sequence: 0 }, id);
      else read(id); // Validate before switching; never overwrite unsynced data on login.
      owner = id;
    },
    deactivate() { owner = null; },
    snapshot() { return read(); },
    acknowledged(revision, sequence, payload) {
      const data = read(); data.revision = Math.max(data.revision, revision);
      if (data.sequence === sequence && JSON.stringify(data.payload) === JSON.stringify(payload)) data.dirty = false;
      write(data);
    },
    replace(remote) {
      // Keep a recoverable local copy before a user-requested conflict reset.
      const previous = read();
      localStorage.setItem(key(owner) + '.backup', JSON.stringify(previous));
      write({ payload: remote.payload, revision: remote.revision, dirty: false, sequence: previous.sequence + 1 });
    },
    backup() {
      const raw = localStorage.getItem(key(owner) + '.backup');
      if (!raw) throw Error('还没有替换前的备份。');
      return JSON.parse(raw).payload;
    },
    importGuest() {
      const data = read();
      for (const [name,field] of Object.entries(fields)) {
        const guest = JSON.parse(localStorage.getItem(name) || '[]');
        if (!Array.isArray(guest)) throw Error('本地收藏格式不正确，未上传。');
        const combined = new Map(guest.map(x => [String(x.id), x]));
        for (const item of data.payload[field]) combined.set(String(item.id), item);
        data.payload[field] = [...combined.values()];
      }
      data.dirty = true; data.sequence++; write(data); root.dispatchEvent(new Event('who-library-change'));
    }
  };
  root.WhoLibraryStore = store;
})(window);
