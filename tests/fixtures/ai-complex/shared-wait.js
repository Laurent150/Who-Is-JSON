// Self-authored static acceptance input. Do not execute or import.
const pending = new Map();

function waitForShared(task, signal) {
  if (!signal) return task;
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(signal.reason); return; }
    const onAbort = () => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
    task.then(
      value => { signal.removeEventListener('abort', onAbort); resolve(value); },
      error => { signal.removeEventListener('abort', onAbort); reject(error); }
    );
  });
}

async function readDocument(id) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const response = await fetch(`/documents/${encodeURIComponent(id)}`, {
      signal: AbortSignal.timeout(4000)
    });
    if (response.ok) return response.json();
    if (response.status < 500 || attempt === 2) throw new Error(`HTTP ${response.status}`);
  }
}

function documentFor(id, signal) {
  let task = pending.get(id);
  if (!task) {
    task = readDocument(id);
    pending.set(id, task);
    const remove = () => {
      if (pending.get(id) === task) pending.delete(id);
    };
    task.then(remove, remove);
  }
  return waitForShared(task, signal);
}

async function readAll(ids, signal) {
  return Promise.all(ids.map(id => documentFor(id, signal)));
}
