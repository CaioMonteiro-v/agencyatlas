const TOKEN_KEY = 'atlas_auth_token';

const API_BASE = '';

function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setAuthToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export function clearAuthToken() {
  setAuthToken('');
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const error = new Error(err.error || 'Erro na requisição');
    error.status = res.status;
    error.can_register = err.can_register;
    throw error;
  }

  return res.json();
}

export const api = {
  login: (body) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  register: (body) => request('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  authStatus: () => request('/api/auth/status'),
  me: () => request('/api/auth/me'),
  getAuthUsers: () => request('/api/auth/users'),
  getAgencySummary: () => request('/api/agency/summary'),
  getCampaigns: () => request('/api/campaigns'),
  getCampaign: (slug) => request(`/api/campaigns/${slug}`),
  getCampaignPublic: (slug) => request(`/api/campaigns/${slug}/public`),
  createCampaign: (body) => request('/api/campaigns', { method: 'POST', body: JSON.stringify(body) }),
  getHeatmap: (slug) => request(`/api/campaigns/${slug}/heatmap`),
  getMunicipality: (slug, id) => request(`/api/campaigns/${slug}/municipalities/${id}`),
  getRanking: (slug, type) => request(`/api/campaigns/${slug}/ranking${type ? `?type=${type}` : ''}`),
  getLeaders: (slug) => request(`/api/campaigns/${slug}/leaders`),
  getLeader: (slug, id) => request(`/api/campaigns/${slug}/leaders/${id}`),
  createLeader: (slug, body) => request(`/api/campaigns/${slug}/leaders`, { method: 'POST', body: JSON.stringify(body) }),
  getLinks: (slug, origin) => request(`/api/campaigns/${slug}/links?origin=${encodeURIComponent(origin)}`),
  getRegistrations: (slug, { page = 1, q = '' } = {}) =>
    request(`/api/campaigns/${slug}/registrations?page=${page}&q=${encodeURIComponent(q)}`),
  downloadBackup: (slug) => `/api/campaigns/${slug}/backup`,
  createRegistration: (slug, body) =>
    request(`/api/campaigns/${slug}/registrations`, { method: 'POST', body: JSON.stringify(body) }),
  getEvents: (slug) => request(`/api/campaigns/${slug}/events`),
  createEvent: (slug, body) => request(`/api/campaigns/${slug}/events`, { method: 'POST', body: JSON.stringify(body) }),
  updateEvent: (slug, id, body) =>
    request(`/api/campaigns/${slug}/events/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  getEvent: (eventSlug) => request(`/api/events/${eventSlug}`),
  getEventQr: (eventSlug, origin) =>
    request(`/api/events/${eventSlug}/qrcode?origin=${encodeURIComponent(origin)}`),
  registerEvent: (eventSlug, body) =>
    request(`/api/events/${eventSlug}/registrations`, { method: 'POST', body: JSON.stringify(body) }),
  getEventAttendees: (slug, eventId) => request(`/api/campaigns/${slug}/events/${eventId}/attendees`),
  getEventRadar: (slug, eventId) => request(`/api/campaigns/${slug}/events/${eventId}/radar`),
  getMissions: (slug) => request(`/api/campaigns/${slug}/missions`),
  createMission: (slug, body) => request(`/api/campaigns/${slug}/missions`, { method: 'POST', body: JSON.stringify(body) }),
  updateMissionProgress: (slug, id, body) =>
    request(`/api/campaigns/${slug}/missions/${id}/progress`, { method: 'PATCH', body: JSON.stringify(body) }),
  getMunicipalities: () => request('/api/municipalities'),
  updateMunicipality: (id, body) =>
    request(`/api/municipalities/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  getCoordinators: (slug) => request(`/api/campaigns/${slug}/coordinators`),
  getCoordinator: (slug, id) => request(`/api/campaigns/${slug}/coordinators/${id}`),
  createCoordinator: (slug, body) =>
    request(`/api/campaigns/${slug}/coordinators`, { method: 'POST', body: JSON.stringify(body) }),
  updateCoordinator: (slug, id, body) =>
    request(`/api/campaigns/${slug}/coordinators/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  setCoordinatorMunicipalities: (slug, id, municipality_ids) =>
    request(`/api/campaigns/${slug}/coordinators/${id}/municipalities`, {
      method: 'PUT',
      body: JSON.stringify({ municipality_ids }),
    }),
  deleteCoordinator: (slug, id) =>
    request(`/api/campaigns/${slug}/coordinators/${id}`, { method: 'DELETE' }),
  updateCoordinatorMunicipalityMetrics: (slug, coordId, muniId, body) =>
    request(`/api/campaigns/${slug}/coordinators/${coordId}/municipalities/${muniId}/metrics`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  getMobilizers: (slug) => request(`/api/campaigns/${slug}/mobilizers`),
  createMobilizer: (slug, body) =>
    request(`/api/campaigns/${slug}/mobilizers`, { method: 'POST', body: JSON.stringify(body) }),
  updateMobilizer: (slug, id, body) =>
    request(`/api/campaigns/${slug}/mobilizers/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteMobilizer: (slug, id) =>
    request(`/api/campaigns/${slug}/mobilizers/${id}`, { method: 'DELETE' }),
  getMobilizerPublic: (slug, code) => request(`/api/m/${slug}/${code}`),
  registerMobilizer: (slug, code, body) =>
    request(`/api/m/${slug}/${code}/registrations`, { method: 'POST', body: JSON.stringify(body) }),
  getReport: (slug) => request(`/api/campaigns/${slug}/report`),
  getContent: (slug) => request(`/api/campaigns/${slug}/content`),
  createContent: (slug, body) =>
    request(`/api/campaigns/${slug}/content`, { method: 'POST', body: JSON.stringify(body) }),
  updateContent: (slug, id, body) =>
    request(`/api/campaigns/${slug}/content/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteContent: (slug, id) =>
    request(`/api/campaigns/${slug}/content/${id}`, { method: 'DELETE' }),
  createContentAssignment: (slug, postId, body) =>
    request(`/api/campaigns/${slug}/content/${postId}/assignments`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateContentAssignment: (slug, postId, assignmentId, body) =>
    request(`/api/campaigns/${slug}/content/${postId}/assignments/${assignmentId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  getMobilized: (slug) => request(`/api/campaigns/${slug}/mobilized`),
  createMobilized: (slug, body) =>
    request(`/api/campaigns/${slug}/mobilized`, { method: 'POST', body: JSON.stringify(body) }),
  updateMobilized: (slug, id, body) =>
    request(`/api/campaigns/${slug}/mobilized/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteMobilized: (slug, id) =>
    request(`/api/campaigns/${slug}/mobilized/${id}`, { method: 'DELETE' }),
  syncMobilized: (slug) =>
    request(`/api/campaigns/${slug}/mobilized/sync`, { method: 'POST', body: '{}' }),
  syncMobilizedOne: (slug, id) =>
    request(`/api/campaigns/${slug}/mobilized/${id}/sync`, { method: 'POST', body: '{}' }),
  addMobilizedChannel: (slug, id, body) =>
    request(`/api/campaigns/${slug}/mobilized/${id}/channels`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateMobilizedChannel: (slug, id, channelId, body) =>
    request(`/api/campaigns/${slug}/mobilized/${id}/channels/${channelId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteMobilizedChannel: (slug, id, channelId) =>
    request(`/api/campaigns/${slug}/mobilized/${id}/channels/${channelId}`, { method: 'DELETE' }),
  runAssistant: (slug) => request(`/api/campaigns/${slug}/assistant`, { method: 'POST', body: '{}' }),
  getMetaStatus: (slug) => request(`/api/campaigns/${slug}/meta/status`),
  syncMeta: (slug) => request(`/api/campaigns/${slug}/meta/sync`, { method: 'POST', body: '{}' }),
  updateMetaConfig: (slug, body) =>
    request(`/api/campaigns/${slug}/meta/config`, { method: 'PUT', body: JSON.stringify(body) }),
};
