import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import CoordinatorLeadersPanel from './CoordinatorLeadersPanel';
import { EmptyState, Toast } from './Ui';

const PUBLIC_URL_KEY = 'atlas_public_base_url';

function defaultPublicBase() {
  const saved = localStorage.getItem(PUBLIC_URL_KEY);
  if (saved) return saved.replace(/\/$/, '');
  return window.location.origin;
}

function isLocalUrl(url) {
  try {
    const host = new URL(url).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return false;
  }
}

function emptyForm() {
  return {
    name: '',
    description: '',
    location: '',
    event_date: '',
    event_time: '',
    organizer_role: 'mobilizer',
    organizer_name: '',
    coordinator_id: '',
    channel_link: '',
    channel_name: '',
    invite_bitly_url: '',
    municipality_id: '',
  };
}

function roleLabel(role) {
  return role === 'coordinator' ? 'Coordenador' : 'Mobilizador';
}

export default function EventsPanel({ campaignSlug }) {
  const [events, setEvents] = useState([]);
  const [coordinators, setCoordinators] = useState([]);
  const [municipalities, setMunicipalities] = useState([]);
  const [qrMap, setQrMap] = useState({});
  const [toast, setToast] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [publicBase, setPublicBase] = useState(defaultPublicBase);
  const [attendeesFor, setAttendeesFor] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [loadingAttendees, setLoadingAttendees] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [channelDrafts, setChannelDrafts] = useState({});
  const [filterQ, setFilterQ] = useState('');
  const [filterMuni, setFilterMuni] = useState('');
  const [filterOnlyWithPeople, setFilterOnlyWithPeople] = useState(false);

  async function load(base = publicBase) {
    try {
      setError('');
      const [list, coordsRes, munis] = await Promise.all([
        api.getEvents(campaignSlug),
        api.getCoordinators(campaignSlug).catch(() => ({ coordinators: [] })),
        api.getMunicipalities().catch(() => []),
      ]);
      setEvents(list);
      setCoordinators(coordsRes?.coordinators || []);
      setMunicipalities(Array.isArray(munis) ? munis : []);
      const origin = (base || window.location.origin).replace(/\/$/, '');
      const entries = await Promise.all(
        list.map(async (event) => {
          const qr = await api.getEventQr(event.slug, origin);
          return [event.slug, qr];
        })
      );
      setQrMap(Object.fromEntries(entries));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load(publicBase);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignSlug]);

  function applyPublicBase(e) {
    e.preventDefault();
    const cleaned = publicBase.trim().replace(/\/$/, '');
    setPublicBase(cleaned);
    localStorage.setItem(PUBLIC_URL_KEY, cleaned);
    setToast('QR Codes regenerados com a nova URL');
    load(cleaned);
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      setToast('Link do evento copiado');
    } catch {
      setToast(text);
    }
    setTimeout(() => setToast(''), 2500);
  }

  function downloadQr(event, qr) {
    if (!qr?.qrcode) {
      setToast('QR Code ainda não gerado');
      return;
    }
    const safe = String(event.name || event.slug || 'evento')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9-_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase() || 'evento';
    const a = document.createElement('a');
    a.href = qr.qrcode;
    a.download = `qr-${safe}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setToast('QR Code baixado — pode imprimir ou mandar no WhatsApp');
    setTimeout(() => setToast(''), 2500);
  }

  function setRole(role) {
    setForm((prev) => ({
      ...prev,
      organizer_role: role,
      organizer_name: role === 'mobilizer' ? prev.organizer_name : '',
      coordinator_id: role === 'coordinator' ? prev.coordinator_id : '',
    }));
  }

  async function onCreate(e) {
    e.preventDefault();
    if (form.organizer_role === 'coordinator' && !form.coordinator_id) {
      setToast('Selecione um coordenador cadastrado');
      return;
    }
    if (form.organizer_role === 'mobilizer' && !form.organizer_name.trim()) {
      setToast('Informe o nome do mobilizador');
      return;
    }
    if (!form.municipality_id) {
      setToast('Selecione o município do evento (mapa de calor)');
      return;
    }
    try {
      await api.createEvent(campaignSlug, {
        name: form.name,
        description: form.description,
        location: form.location,
        event_date: form.event_date,
        event_time: form.event_time,
        organizer_role: form.organizer_role,
        organizer_name: form.organizer_name,
        coordinator_id: form.coordinator_id ? Number(form.coordinator_id) : null,
        channel_link: form.channel_link.trim() || null,
        channel_name: form.channel_name.trim() || null,
        invite_bitly_url: form.invite_bitly_url.trim() || null,
        municipality_id: Number(form.municipality_id),
      });
      setShowForm(false);
      setForm(emptyForm());
      setToast('Evento criado');
      load(publicBase);
    } catch (err) {
      setToast(err.message);
    }
  }

  function startEditChannel(event) {
    setEditingId(event.id);
    setChannelDrafts((prev) => ({
      ...prev,
      [event.id]: {
        channel_link: event.channel_link || '',
        channel_name: event.channel_name || '',
        invite_bitly_url: event.invite_bitly_url || '',
        municipality_id: event.municipality_id ? String(event.municipality_id) : '',
      },
    }));
  }

  async function saveChannel(event) {
    const draft = channelDrafts[event.id] || {};
    try {
      await api.updateEvent(campaignSlug, event.id, {
        channel_link: (draft.channel_link || '').trim() || null,
        channel_name: (draft.channel_name || '').trim() || null,
        invite_bitly_url: (draft.invite_bitly_url || '').trim() || null,
        municipality_id: draft.municipality_id ? Number(draft.municipality_id) : null,
      });
      setEditingId(null);
      setToast('Evento atualizado (convites / município)');
      await load(publicBase);
    } catch (err) {
      setToast(err.message);
    }
  }

  async function viewAttendees(event) {
    setAttendeesFor(event);
    setLoadingAttendees(true);
    try {
      const res = await api.getEventAttendees(campaignSlug, event.id);
      setAttendees(res.attendees || []);
    } catch (err) {
      setToast(err.message);
      setAttendees([]);
    } finally {
      setLoadingAttendees(false);
    }
  }

  async function removeEvent(event) {
    const count = Number(event.attendees || 0);
    const msg = count > 0
      ? `Excluir o evento "${event.name}"?\n\nIsso apaga o QR e também os ${count} cadastro(s) deste evento.`
      : `Excluir o evento "${event.name}"?\n\nO QR deixa de funcionar.`;
    if (!window.confirm(msg)) return;
    try {
      await api.deleteEvent(campaignSlug, event.id);
      if (attendeesFor?.id === event.id) {
        setAttendeesFor(null);
        setAttendees([]);
      }
      if (editingId === event.id) setEditingId(null);
      setToast('Evento excluído');
      await load(publicBase);
    } catch (err) {
      setToast(err.message);
    }
  }

  const localWarning = isLocalUrl(publicBase);

  const filteredEvents = useMemo(() => {
    const needle = filterQ.trim().toLowerCase();
    return events.filter((event) => {
      if (filterMuni && String(event.municipality_id || '') !== String(filterMuni)) {
        return false;
      }
      if (filterOnlyWithPeople && !(Number(event.attendees) > 0)) {
        return false;
      }
      if (!needle) return true;
      const hay = [
        event.name,
        event.municipality_name,
        event.location,
        event.organizer_name,
        event.channel_name,
        event.slug,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [events, filterQ, filterMuni, filterOnlyWithPeople]);

  const filteredPeopleTotal = useMemo(
    () => filteredEvents.reduce((sum, e) => sum + Number(e.attendees || 0), 0),
    [filteredEvents],
  );

  return (
    <section className="panel panel-pad">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <p className="eyebrow">Presença</p>
          <h3>Eventos e QR Codes</h3>
          <p>
            Gere QR Codes únicos para inscrição rápida em cada evento. Use o filtro abaixo
            para achar o evento e ver o <strong>total de pessoas</strong> cadastradas.
          </p>
        </div>
        <button type="button" className="btn btn-accent btn-sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Fechar' : 'Novo evento'}
        </button>
      </div>

      <div className="filters event-filters" style={{ marginTop: '1rem' }}>
        <label style={{ flex: '1 1 180px', minWidth: 160 }}>
          Buscar evento
          <input
            className="input"
            placeholder="Nome, cidade, mobilizador…"
            value={filterQ}
            onChange={(e) => setFilterQ(e.target.value)}
          />
        </label>
        <label style={{ flex: '1 1 160px', minWidth: 140 }}>
          Município
          <select
            className="select"
            value={filterMuni}
            onChange={(e) => setFilterMuni(e.target.value)}
          >
            <option value="">Todos</option>
            {municipalities.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </label>
        <label className="check" style={{ alignSelf: 'end', marginBottom: '0.35rem' }}>
          <input
            type="checkbox"
            checked={filterOnlyWithPeople}
            onChange={(e) => setFilterOnlyWithPeople(e.target.checked)}
          />
          Só com inscritos
        </label>
      </div>

      <div className="event-filter-summary" style={{ marginTop: '0.75rem' }}>
        <span className="badge">
          {filteredEvents.length} evento{filteredEvents.length === 1 ? '' : 's'}
        </span>
        <span className="badge badge--ok">
          {filteredPeopleTotal} pessoa{filteredPeopleTotal === 1 ? '' : 's'} no filtro
        </span>
        {(filterQ || filterMuni || filterOnlyWithPeople) && (
          <button
            type="button"
            className="btn btn-soft btn-sm"
            onClick={() => {
              setFilterQ('');
              setFilterMuni('');
              setFilterOnlyWithPeople(false);
            }}
          >
            Limpar filtro
          </button>
        )}
      </div>

      <form className="form-grid" style={{ marginTop: '1rem' }} onSubmit={applyPublicBase}>
        <label>
          URL pública dos QR Codes
          <input
            className="input"
            value={publicBase}
            onChange={(e) => setPublicBase(e.target.value)}
            placeholder="https://seu-app.onrender.com ou http://SEU-IP:5173"
          />
        </label>
        <p style={{ margin: 0, fontSize: '0.9rem', color: localWarning ? '#8a5a64' : 'var(--muted)' }}>
          {localWarning
            ? 'Atenção: URL com localhost NÃO funciona em outro celular. Use o IP da sua rede (ex: http://192.168.0.10:5173) ou a URL do Render depois do deploy.'
            : 'Esta URL é gravada dentro do QR. Celulares precisam alcançar este endereço.'}
        </p>
        <button className="btn btn-soft btn-sm" type="submit" style={{ width: 'fit-content' }}>
          Atualizar QR Codes
        </button>
      </form>

      {showForm && (
        <form className="form-grid" style={{ marginTop: '1rem' }} onSubmit={onCreate}>
          <label>
            Nome do evento
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label>
            Descrição
            <textarea className="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </label>
          <label>
            Município do evento *
            <select
              className="select"
              required
              value={form.municipality_id}
              onChange={(e) => setForm({ ...form, municipality_id: e.target.value })}
            >
              <option value="">Selecione o município</option>
              {municipalities.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </label>
          <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--muted)' }}>
            Quem se cadastrar neste evento entra no mapa de calor deste município,
            no funil <strong>{form.organizer_role === 'coordinator' ? 'Coordenador' : 'Mobilizador'}</strong>.
          </p>

          <label>
            Local / ponto (opcional)
            <input
              className="input"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="Ex.: Praça da Matriz"
            />
          </label>

          <label>
            Convite WhatsApp do canal (opcional)
            <input
              className="input"
              type="url"
              value={form.channel_link}
              onChange={(e) => setForm({ ...form, channel_link: e.target.value })}
              placeholder="https://chat.whatsapp.com/..."
            />
          </label>
          <label>
            Bitly do canal (só para contar cliques)
            <input
              className="input"
              type="url"
              value={form.invite_bitly_url}
              onChange={(e) => setForm({ ...form, invite_bitly_url: e.target.value })}
              placeholder="https://bit.ly/..."
            />
          </label>
          <label>
            Nome do canal (opcional)
            <input
              className="input"
              value={form.channel_name}
              onChange={(e) => setForm({ ...form, channel_name: e.target.value })}
              placeholder="Ex.: Canal Elite Cuiabá"
            />
          </label>
          <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--muted)' }}>
            Depois do QR: a pessoa preenche nome e telefone (e-mail opcional), dá OK e na
            tela seguinte clica para <strong>falar com o Fábio</strong> no WhatsApp
            (wa.me/message/…). O Bitly, se preenchido, só conta o clique em segundo plano.
          </p>

          <div>
            <strong style={{ display: 'block', marginBottom: 8 }}>
              Quem mobilizou este evento (fechado com a campanha)
            </strong>
            <div className="chip-group">
              <button
                type="button"
                className={`chip ${form.organizer_role === 'mobilizer' ? 'active' : ''}`}
                onClick={() => setRole('mobilizer')}
              >
                Mobilizador
              </button>
              <button
                type="button"
                className={`chip ${form.organizer_role === 'coordinator' ? 'active' : ''}`}
                onClick={() => setRole('coordinator')}
              >
                Coordenador
              </button>
            </div>
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.88rem', color: 'var(--muted)' }}>
              {form.organizer_role === 'coordinator'
                ? 'No QR do coordenador o controle é por lideranças do território — não por total de mobilizadores.'
                : (
                  <>
                    Esse nome vai para a coluna <strong>Mobilizador</strong> na Base — é o norte de quem está trazendo gente.
                  </>
                )}
            </p>
          </div>

          {form.organizer_role === 'mobilizer' ? (
            <label>
              Nome do mobilizador
              <input
                className="input"
                required
                value={form.organizer_name}
                onChange={(e) => setForm({ ...form, organizer_name: e.target.value })}
                placeholder="Ex.: Bianca Silvinio Magalhães"
              />
            </label>
          ) : (
            <label>
              Coordenador cadastrado
              <select
                className="select"
                required
                value={form.coordinator_id}
                onChange={(e) => setForm({ ...form, coordinator_id: e.target.value })}
              >
                <option value="">Selecione um coordenador cadastrado</option>
                {coordinators.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
          )}

          {form.organizer_role === 'coordinator' && form.coordinator_id ? (
            <CoordinatorLeadersPanel
              campaignSlug={campaignSlug}
              coordinatorId={form.coordinator_id}
              coordinatorName={coordinators.find((c) => String(c.id) === String(form.coordinator_id))?.name}
              coordType={
                coordinators.find((c) => String(c.id) === String(form.coordinator_id))?.coord_type === 'dobra'
                  ? 'dobra'
                  : 'regional'
              }
              leaders={coordinators.find((c) => String(c.id) === String(form.coordinator_id))?.leaders || []}
              municipalities={
                coordinators.find((c) => String(c.id) === String(form.coordinator_id))?.municipalities || []
              }
              compact
            />
          ) : null}

          {form.organizer_role === 'coordinator' && !coordinators.length && (
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#8a5a64' }}>
              Nenhum coordenador cadastrado. Cadastre na aba{' '}
              <Link to={`/campanha/${campaignSlug}/coordenadores`}>Coordenadores</Link>{' '}
              antes de vincular o evento.
            </p>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <label>
              Data
              <input className="input" type="date" required value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} />
            </label>
            <label>
              Hora
              <input className="input" type="time" value={form.event_time} onChange={(e) => setForm({ ...form, event_time: e.target.value })} />
            </label>
          </div>
          <button className="btn btn-primary" type="submit">Salvar evento</button>
        </form>
      )}

      {error && <EmptyState>{error}</EmptyState>}

      <div className="event-grid" style={{ marginTop: '1.1rem' }}>
        {filteredEvents.map((event) => {
          const qr = qrMap[event.slug];
          return (
            <article className="event-card" key={event.id}>
              <div>
                <h4 style={{ marginBottom: 4 }}>{event.name}</h4>
                <p style={{ marginBottom: 0 }}>
                  {new Date(event.event_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                  {event.event_time ? ` · ${event.event_time}` : ''}
                </p>
                <p style={{ marginBottom: 0 }}>
                  {event.municipality_name || event.location || 'Município não informado'}
                  {event.location && event.municipality_name && event.location !== event.municipality_name
                    ? ` · ${event.location}`
                    : ''}
                </p>
                <p style={{ marginBottom: 0 }}>
                  <strong>Funil:</strong>{' '}
                  {event.organizer_role === 'coordinator' ? 'Coordenador' : 'Mobilizador'}
                </p>
                {event.organizer_role === 'coordinator' ? (
                  <p style={{ marginBottom: 0 }}>
                    <strong>Coordenador:</strong> {event.organizer_name || '—'}
                  </p>
                ) : (
                  event.organizer_name && (
                    <p style={{ marginBottom: 0 }}>
                      <strong>Mobilizador:</strong> {event.organizer_name}
                    </p>
                  )
                )}
                {event.organizer_role === 'coordinator' && event.coordinator_id ? (
                  <CoordinatorLeadersPanel
                    campaignSlug={campaignSlug}
                    coordinatorId={event.coordinator_id}
                    coordinatorName={event.organizer_name}
                    coordType={
                      coordinators.find((c) => Number(c.id) === Number(event.coordinator_id))?.coord_type === 'dobra'
                        ? 'dobra'
                        : 'regional'
                    }
                    leaders={
                      coordinators.find((c) => Number(c.id) === Number(event.coordinator_id))?.leaders || []
                    }
                    municipalities={
                      coordinators.find((c) => Number(c.id) === Number(event.coordinator_id))?.municipalities || []
                    }
                    compact
                  />
                ) : null}
                {(event.channel_link || event.invite_bitly_url) ? (
                  <>
                    {event.channel_link ? (
                      <p style={{ marginBottom: 0 }}>
                        <strong>Convite WhatsApp:</strong>{' '}
                        {event.channel_name ? `${event.channel_name} · ` : ''}
                        <a href={event.channel_link} target="_blank" rel="noreferrer">
                          abrir
                        </a>
                      </p>
                    ) : null}
                    {event.invite_bitly_url ? (
                      <p style={{ marginBottom: 0 }}>
                        <strong>Bitly (contagem):</strong>{' '}
                        <a href={event.invite_bitly_url} target="_blank" rel="noreferrer">
                          {event.invite_bitly_url}
                        </a>
                        <span style={{ color: 'var(--muted)' }}> — pessoa não fica nesta página</span>
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p style={{ marginBottom: 0, color: 'var(--muted)' }}>
                    Sem convite de canal — após o QR, a pessoa fala com o Fábio no WhatsApp
                    (wa.me/message/…).
                  </p>
                )}
                <p style={{ marginBottom: 0, fontSize: '0.85rem', color: 'var(--muted)' }}>
                  Dica: baixe o QR e mande no WhatsApp da campanha para distribuir. O convite do
                  canal é outro passo (links acima).
                </p>
                <p>{event.description}</p>
                <span className="badge badge--ok">{event.attendees || 0} inscritos</span>
              </div>
              {qr && (
                <div className="qr-box">
                  <img src={qr.qrcode} alt={`QR Code ${event.name}`} />
                  <code style={{ fontSize: '0.75rem', wordBreak: 'break-all', textAlign: 'center' }}>{qr.url}</code>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => downloadQr(event, qr)}
                  >
                    Baixar QR (PNG)
                  </button>
                </div>
              )}

              {editingId === event.id ? (
                <form
                  className="form-grid"
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveChannel(event);
                  }}
                >
                  <label>
                    Município (mapa de calor)
                    <select
                      className="select"
                      value={channelDrafts[event.id]?.municipality_id || ''}
                      onChange={(e) =>
                        setChannelDrafts((prev) => ({
                          ...prev,
                          [event.id]: {
                            ...(prev[event.id] || {}),
                            municipality_id: e.target.value,
                          },
                        }))
                      }
                    >
                      <option value="">Selecione</option>
                      {municipalities.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Convite WhatsApp do canal
                    <input
                      className="input"
                      type="url"
                      value={channelDrafts[event.id]?.channel_link || ''}
                      onChange={(e) =>
                        setChannelDrafts((prev) => ({
                          ...prev,
                          [event.id]: {
                            ...(prev[event.id] || {}),
                            channel_link: e.target.value,
                          },
                        }))
                      }
                      placeholder="https://chat.whatsapp.com/..."
                    />
                  </label>
                  <label>
                    Bitly do canal (só conta cliques)
                    <input
                      className="input"
                      type="url"
                      value={channelDrafts[event.id]?.invite_bitly_url || ''}
                      onChange={(e) =>
                        setChannelDrafts((prev) => ({
                          ...prev,
                          [event.id]: {
                            ...(prev[event.id] || {}),
                            invite_bitly_url: e.target.value,
                          },
                        }))
                      }
                      placeholder="https://bit.ly/..."
                    />
                  </label>
                  <label>
                    Nome do canal
                    <input
                      className="input"
                      value={channelDrafts[event.id]?.channel_name || ''}
                      onChange={(e) =>
                        setChannelDrafts((prev) => ({
                          ...prev,
                          [event.id]: {
                            ...(prev[event.id] || {}),
                            channel_name: e.target.value,
                          },
                        }))
                      }
                      placeholder="Ex.: Canal Elite Cuiabá"
                    />
                  </label>
                  <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                    <button className="btn btn-primary btn-sm" type="submit">
                      Salvar
                    </button>
                    <button
                      className="btn btn-soft btn-sm"
                      type="button"
                      onClick={() => setEditingId(null)}
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : null}

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <Link className="btn btn-soft btn-sm" to={`/evento/${event.slug}`}>
                  Página de inscrição
                </Link>
                <Link
                  className="btn btn-primary btn-sm"
                  to={`/campanha/${campaignSlug}/eventos/${event.id}/radar`}
                >
                  Radar ao vivo
                </Link>
                <button type="button" className="btn btn-accent btn-sm" onClick={() => viewAttendees(event)}>
                  Ver inscritos ({event.attendees || 0})
                </button>
                <button type="button" className="btn btn-soft btn-sm" onClick={() => startEditChannel(event)}>
                  {event.channel_link || event.invite_bitly_url || event.municipality_id
                    ? 'Editar convites/município'
                    : 'Vincular convites/município'}
                </button>
                {qr && (
                  <>
                    <button type="button" className="btn btn-soft btn-sm" onClick={() => copy(qr.url)}>
                      Copiar link
                    </button>
                    <button type="button" className="btn btn-accent btn-sm" onClick={() => downloadQr(event, qr)}>
                      Baixar QR
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => removeEvent(event)}
                >
                  Excluir evento
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {attendeesFor && (
        <div className="panel panel-pad" style={{ marginTop: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div>
              <p className="eyebrow">Inscrições do QR Code</p>
              <h3>{attendeesFor.name}</h3>
              <p>Aqui aparecem as pessoas que preencheram o formulário do evento.</p>
            </div>
            <button type="button" className="btn btn-soft btn-sm" onClick={() => setAttendeesFor(null)}>
              Fechar
            </button>
          </div>

          {loadingAttendees && <EmptyState>Carregando inscritos…</EmptyState>}

          {!loadingAttendees && (
            <div className="table-wrap" style={{ marginTop: '0.85rem' }}>
              <table>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>E-mail</th>
                    <th>Telefone</th>
                    <th>Organiz. município</th>
                    <th>WhatsApp?</th>
                    <th>Quando</th>
                  </tr>
                </thead>
                <tbody>
                  {attendees.map((person) => (
                    <tr key={person.id}>
                      <td>{person.full_name}</td>
                      <td>{person.email || '—'}</td>
                      <td>{person.phone || '—'}</td>
                      <td>{person.organizer_name || attendeesFor.organizer_name || '—'}</td>
                      <td>{person.connect_whatsapp ? 'Sim' : 'Não'}</td>
                      <td>{person.created_at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loadingAttendees && !attendees.length && (
            <EmptyState>Nenhuma inscrição ainda neste evento.</EmptyState>
          )}
        </div>
      )}

      {!filteredEvents.length && (
        <EmptyState>
          {events.length
            ? 'Nenhum evento com esse filtro. Limpe o filtro ou ajuste a busca.'
            : 'Nenhum evento cadastrado.'}
        </EmptyState>
      )}
      <Toast message={toast} onClose={() => setToast('')} />
    </section>
  );
}
