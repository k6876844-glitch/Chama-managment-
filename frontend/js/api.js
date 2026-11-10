// Thin wrapper around fetch for the Chama API. Stores the login token and turns
// error responses into Error objects with a readable message.
const TOKEN_KEY = 'chama_token';

const api = {
  get token() {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set token(value) {
    try { value ? localStorage.setItem(TOKEN_KEY, value) : localStorage.removeItem(TOKEN_KEY); } catch {}
  },

  async request(method, path, body) {
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    let res;
    try {
      res = await fetch(API_BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch {
      throw new Error('Cannot reach the server. Is the backend running?');
    }

    const data = res.status === 204 ? null : await res.json().catch(() => null);
    if (res.status === 401 && path !== '/auth/login') {
      this.token = null;
      window.dispatchEvent(new Event('chama:logout'));
    }
    if (!res.ok) {
      const err = new Error(firstError(data) || `Request failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return data;
  },

  get(path) { return this.request('GET', path); },
  post(path, body = {}) { return this.request('POST', path, body); },
  put(path, body = {}) { return this.request('PUT', path, body); },
  patch(path, body = {}) { return this.request('PATCH', path, body); },
  delete(path) { return this.request('DELETE', path); },
};

function firstError(data) {
  if (!data) return null;
  if (data.errors) {
    const first = Object.values(data.errors)[0];
    if (first && first.length) return first[0];
  }
  return data.message;
}
