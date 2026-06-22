export function createStorage(key) {
  return {
    save(data) { localStorage.setItem(key, JSON.stringify(data)); },
    load()     { const r = localStorage.getItem(key); return r ? JSON.parse(r) : null; }
  };
}