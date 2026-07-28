const API_BASE = '';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Erro na requisição');
  }

  return res.json();
}

export const api = {
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
  createRegistration: (slug, body) =>
    request(`/api/campaigns/${slug}/registrations`, { method: 'POST', body: JSON.stringify(body) }),
  getEvents: (slug) => request(`/api/campaigns/${slug}/events`),
  createEvent: (slug, body) => request(`/api/campaigns/${slug}/events`, { method: 'POST', body: JSON.stringify(body) }),
  getEvent: (eventSlug) => request(`/api/events/${eventSlug}`),
  getEventQr: (eventSlug, origin) =>
    request(`/api/events/${eventSlug}/qrcode?origin=${encodeURIComponent(origin)}`),
  registerEvent: (eventSlug, body) =>
    request(`/api/events/${eventSlug}/registrations`, { method: 'POST', body: JSON.stringify(body) }),
  getEventAttendees: (slug, eventId) => request(`/api/campaigns/${slug}/events/${eventId}/attendees`),
  getMissions: (slug) => request(`/api/campaigns/${slug}/missions`),
  createMission: (slug, body) => request(`/api/campaigns/${slug}/missions`, { method: 'POST', body: JSON.stringify(body) }),
  updateMissionProgress: (slug, id, body) =>
    request(`/api/campaigns/${slug}/missions/${id}/progress`, { method: 'PATCH', body: JSON.stringify(body) }),
  getMunicipalities: () => request('/api/municipalities'),
  updateMunicipality: (id, body) =>
    request(`/api/municipalities/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
};
