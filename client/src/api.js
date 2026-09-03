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
  getHeatmap: (slug, funnel) =>
    request(`/api/campaigns/${slug}/heatmap${funnel && funnel !== 'todos' ? `?funnel=${encodeURIComponent(funnel)}` : ''}`),
  getMunicipality: (slug, id) => request(`/api/campaigns/${slug}/municipalities/${id}`),
  getRanking: (slug, type) => request(`/api/campaigns/${slug}/ranking${type ? `?type=${type}` : ''}`),
  getLeaders: (slug) => request(`/api/campaigns/${slug}/leaders`),
  getLeader: (slug, id) => request(`/api/campaigns/${slug}/leaders/${id}`),
  createLeader: (slug, body) => request(`/api/campaigns/${slug}/leaders`, { method: 'POST', body: JSON.stringify(body) }),
  deleteLeader: (slug, id) =>
    request(`/api/campaigns/${slug}/leaders/${id}`, { method: 'DELETE' }),
  getLeaderQr: (slug, id, origin, size = 1024) =>
    request(`/api/campaigns/${slug}/leaders/${id}/qrcode?origin=${encodeURIComponent(origin)}&size=${size}`),
  getLinks: (slug, origin) => request(`/api/campaigns/${slug}/links?origin=${encodeURIComponent(origin)}`),
  getRegistrations: (slug, { page = 1, q = '', event_id = '' } = {}) => {
    const params = new URLSearchParams({
      page: String(page),
      q: q || '',
    });
    if (event_id) params.set('event_id', String(event_id));
    return request(`/api/campaigns/${slug}/registrations?${params.toString()}`);
  },
  downloadBackup: (slug) => `/api/campaigns/${slug}/backup`,
  createRegistration: (slug, body) =>
    request(`/api/campaigns/${slug}/registrations`, { method: 'POST', body: JSON.stringify(body) }),
  updateRegistration: (slug, id, body) =>
    request(`/api/campaigns/${slug}/registrations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  getEvents: (slug) => request(`/api/campaigns/${slug}/events`),
  getEventsDailyReport: (slug, { date, date_from, date_to, event_id } = {}) => {
    const params = new URLSearchParams();
    if (date_from) params.set('date_from', date_from);
    if (date_to) params.set('date_to', date_to);
    if (date && !date_from && !date_to) params.set('date', date);
    if (event_id) params.set('event_id', String(event_id));
    const q = params.toString();
    return request(`/api/campaigns/${slug}/events/daily-report${q ? `?${q}` : ''}`);
  },
  getPerformanceDaily: (slug, { date, date_from, date_to, event_id } = {}) => {
    const params = new URLSearchParams();
    if (date_from) params.set('date_from', date_from);
    if (date_to) params.set('date_to', date_to);
    if (date && !date_from && !date_to) params.set('date', date);
    if (event_id) params.set('event_id', String(event_id));
    const q = params.toString();
    return request(`/api/campaigns/${slug}/performance-daily${q ? `?${q}` : ''}`);
  },
  createEvent: (slug, body) => request(`/api/campaigns/${slug}/events`, { method: 'POST', body: JSON.stringify(body) }),
  updateEvent: (slug, id, body) =>
    request(`/api/campaigns/${slug}/events/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteEvent: (slug, id) =>
    request(`/api/campaigns/${slug}/events/${id}`, { method: 'DELETE' }),
  getEvent: (eventSlug) => request(`/api/events/${eventSlug}`),
  getEventQr: (eventSlug, origin, size = 1024) =>
    request(`/api/events/${eventSlug}/qrcode?origin=${encodeURIComponent(origin)}&size=${size}`),
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
  getInvestments: (slug, { municipality_id, category, coordinator_id } = {}) => {
    const qs = new URLSearchParams();
    if (municipality_id) qs.set('municipality_id', municipality_id);
    if (category) qs.set('category', category);
    if (coordinator_id) qs.set('coordinator_id', coordinator_id);
    const q = qs.toString();
    return request(`/api/campaigns/${slug}/investments${q ? `?${q}` : ''}`);
  },
  createInvestment: (slug, body) =>
    request(`/api/campaigns/${slug}/investments`, { method: 'POST', body: JSON.stringify(body) }),
  importInvestments: (slug, body) =>
    request(`/api/campaigns/${slug}/investments/import`, { method: 'POST', body: JSON.stringify(body) }),
  importInvestmentsDocx: (slug, body) =>
    request(`/api/campaigns/${slug}/investments/import-docx`, { method: 'POST', body: JSON.stringify(body) }),
  clearInvestments: (slug, body = {}) =>
    request(`/api/campaigns/${slug}/investments/clear`, { method: 'POST', body: JSON.stringify(body) }),
  getDobraGroups: (slug, { coordinator_id, municipality_id, deputy_id, status, q } = {}) => {
    const qs = new URLSearchParams();
    if (coordinator_id) qs.set('coordinator_id', coordinator_id);
    if (municipality_id) qs.set('municipality_id', municipality_id);
    if (deputy_id) qs.set('deputy_id', deputy_id);
    if (status) qs.set('status', status);
    if (q) qs.set('q', q);
    const query = qs.toString();
    return request(`/api/campaigns/${slug}/groups${query ? `?${query}` : ''}`);
  },
  createDobraGroup: (slug, body) =>
    request(`/api/campaigns/${slug}/groups`, { method: 'POST', body: JSON.stringify(body) }),
  updateDobraGroup: (slug, id, body) =>
    request(`/api/campaigns/${slug}/groups/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteDobraGroup: (slug, id) =>
    request(`/api/campaigns/${slug}/groups/${id}`, { method: 'DELETE' }),
  syncDobraGroup: (slug, id) =>
    request(`/api/campaigns/${slug}/groups/${id}/sync`, { method: 'POST', body: '{}' }),
  syncAllDobraGroups: (slug) =>
    request(`/api/campaigns/${slug}/groups/sync`, { method: 'POST', body: '{}' }),
  getDobraBitlyBoard: (slug) =>
    request(`/api/campaigns/${slug}/groups/bitly`),
  bulkCreateDobraBitly: (slug, body = {}) =>
    request(`/api/campaigns/${slug}/groups/bitly/bulk`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getDobraVideos: (slug) =>
    request(`/api/campaigns/${slug}/dobra-videos`),
  createDobraVideo: (slug, body) =>
    request(`/api/campaigns/${slug}/dobra-videos`, { method: 'POST', body: JSON.stringify(body) }),
  getDobraVideo: (slug, id) =>
    request(`/api/campaigns/${slug}/dobra-videos/${id}`),
  updateDobraVideo: (slug, id, body) =>
    request(`/api/campaigns/${slug}/dobra-videos/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteDobraVideo: (slug, id) =>
    request(`/api/campaigns/${slug}/dobra-videos/${id}`, { method: 'DELETE' }),
  generateDobraVideoLinks: (slug, id, body = {}) =>
    request(`/api/campaigns/${slug}/dobra-videos/${id}/generate`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  syncDobraVideoLinks: (slug, id) =>
    request(`/api/campaigns/${slug}/dobra-videos/${id}/sync`, { method: 'POST', body: '{}' }),
  getDobraDeputies: (slug) =>
    request(`/api/campaigns/${slug}/deputies`),
  createDobraDeputy: (slug, body) =>
    request(`/api/campaigns/${slug}/deputies`, { method: 'POST', body: JSON.stringify(body) }),
  updateDobraDeputy: (slug, id, body) =>
    request(`/api/campaigns/${slug}/deputies/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteDobraDeputy: (slug, id) =>
    request(`/api/campaigns/${slug}/deputies/${id}`, { method: 'DELETE' }),
  updateInvestment: (slug, id, body) =>
    request(`/api/campaigns/${slug}/investments/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteInvestment: (slug, id) =>
    request(`/api/campaigns/${slug}/investments/${id}`, { method: 'DELETE' }),
  upsertInvestmentMuniNote: (slug, body) =>
    request(`/api/campaigns/${slug}/investments/municipality-note`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  getHealth: () => request('/api/health'),
  getDemandTree: (slug) => request(`/api/campaigns/${slug}/demands/tree`),
  getDemands: (slug, { coordinator_id, municipality_id, status } = {}) => {
    const qs = new URLSearchParams();
    if (coordinator_id) qs.set('coordinator_id', coordinator_id);
    if (municipality_id) qs.set('municipality_id', municipality_id);
    if (status) qs.set('status', status);
    const q = qs.toString();
    return request(`/api/campaigns/${slug}/demands${q ? `?${q}` : ''}`);
  },
  createDemand: (slug, body) =>
    request(`/api/campaigns/${slug}/demands`, { method: 'POST', body: JSON.stringify(body) }),
  updateDemand: (slug, id, body) =>
    request(`/api/campaigns/${slug}/demands/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteDemand: (slug, id) =>
    request(`/api/campaigns/${slug}/demands/${id}`, { method: 'DELETE' }),
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
  getMobilized: (slug, { coordinator_id, municipality_id } = {}) => {
    const qs = new URLSearchParams();
    if (coordinator_id) qs.set('coordinator_id', coordinator_id);
    if (municipality_id) qs.set('municipality_id', municipality_id);
    const q = qs.toString();
    return request(`/api/campaigns/${slug}/mobilized${q ? `?${q}` : ''}`);
  },
  createMobilized: (slug, body) =>
    request(`/api/campaigns/${slug}/mobilized`, { method: 'POST', body: JSON.stringify(body) }),
  createMobilizedBulk: (slug, body) =>
    request(`/api/campaigns/${slug}/mobilized/bulk`, { method: 'POST', body: JSON.stringify(body) }),
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
