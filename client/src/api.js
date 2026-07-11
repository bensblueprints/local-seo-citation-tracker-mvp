async function req(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...options,
    body: options.body != null ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  me: () => req('/api/me'),
  login: (password) => req('/api/login', { method: 'POST', body: { password } }),
  logout: () => req('/api/logout', { method: 'POST' }),

  businesses: () => req('/api/businesses'),
  business: (id) => req(`/api/businesses/${id}`),
  createBusiness: (body) => req('/api/businesses', { method: 'POST', body }),
  updateBusiness: (id, body) => req(`/api/businesses/${id}`, { method: 'PUT', body }),
  deleteBusiness: (id) => req(`/api/businesses/${id}`, { method: 'DELETE' }),

  directories: () => req('/api/directories'),
  createDirectory: (body) => req('/api/directories', { method: 'POST', body }),
  deleteDirectory: (id) => req(`/api/directories/${id}`, { method: 'DELETE' }),

  listings: (businessId) => req(`/api/businesses/${businessId}/listings`),
  saveListing: (businessId, directoryId, body) =>
    req(`/api/businesses/${businessId}/listings/${directoryId}`, { method: 'PUT', body }),
  diff: (businessId) => req(`/api/businesses/${businessId}/diff`),

  tasks: (businessId) => req(`/api/businesses/${businessId}/tasks`),
  toggleTask: (id) => req(`/api/tasks/${id}/toggle`, { method: 'POST' }),

  placesStatus: () => req('/api/places/status'),
  placesPull: (businessId, query) =>
    req(`/api/businesses/${businessId}/places-pull`, { method: 'POST', body: { query } })
};

export function timeAgo(ms) {
  if (!ms) return 'never';
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
