// Self-authored acceptance input. Read statically; do not execute.
const inFlight = new Map();
const cache = new Map();
const TTL_MS = 30000;

function pause(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(signal.reason);
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function fetchOrders(customerId, signal) {
  for (let attempt = 0; attempt < 3; attempt++) {
    signal?.throwIfAborted();
    let response;
    try {
      response = await fetch(`/orders?customer=${encodeURIComponent(customerId)}`, { signal });
    } catch (error) {
      if (signal?.aborted || attempt === 2) throw error;
      await pause(100 * 2 ** attempt, signal);
      continue;
    }
    if (response.status === 404) return [];
    if (response.ok) {
      const rows = await response.json();
      if (!Array.isArray(rows)) throw new TypeError("Expected an array");
      return rows;
    }
    if (response.status < 500 || attempt === 2) {
      throw new Error(`HTTP ${response.status}`);
    }
    await pause(100 * 2 ** attempt, signal);
  }
}

async function loadOrders(customerId, { signal, now = Date.now } = {}) {
  signal?.throwIfAborted();
  const cached = cache.get(customerId);
  if (cached && now() - cached.savedAt < TTL_MS) return cached.rows;
  if (inFlight.has(customerId)) return inFlight.get(customerId);
  const task = fetchOrders(customerId, signal);
  inFlight.set(customerId, task);
  try {
    const rows = await task;
    cache.set(customerId, { rows, savedAt: now() });
    return rows;
  } finally {
    if (inFlight.get(customerId) === task) inFlight.delete(customerId);
  }
}

function summarize(rows) {
  const seen = new Set();
  return rows.reduce((total, row) => {
    if (row.status !== "paid" || seen.has(row.id)) return total;
    if (!Number.isInteger(row.amountCents) || row.amountCents < 0) return total;
    seen.add(row.id);
    total.count += 1;
    total.cents += row.amountCents;
    return total;
  }, { count: 0, cents: 0 });
}

async function buildReport(customerIds, signal) {
  const uniqueIds = [...new Set(customerIds)];
  const results = await Promise.allSettled(uniqueIds.map(id => loadOrders(id, { signal })));
  return results.map((result, index) => result.status === "fulfilled"
    ? { customerId: uniqueIds[index], ok: true, ...summarize(result.value) }
    : { customerId: uniqueIds[index], ok: false, error: String(result.reason) });
}
