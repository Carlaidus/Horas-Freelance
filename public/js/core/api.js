/* ── Cronoras API client ─────────────────────────────────────── */

window.CronorasApi = {
  async request(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeout || 10000);
    try {
      const r = await fetch(url, { ...options, signal: controller.signal });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || `Error ${r.status}`);
      return data;
    } finally {
      clearTimeout(timer);
    }
  },
  async get(url) {
    return this.request(url);
  },
  async post(url, data) {
    return this.request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  },
  async put(url, data) {
    return this.request(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  },
  async patch(url, data) {
    return this.request(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  },
  async del(url) {
    return this.request(url, { method: 'DELETE' });
  }
};
