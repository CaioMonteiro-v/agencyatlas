import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
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
  };
}

function roleLabel(role) {
  return role === 'coordinator' ? 'Coordenador' : 'Mobilizador';
}

export default function EventsPanel({ campaignSlug }) {
  const [events, setEvents] = useState([]);
  const [coordinators, setCoordinators] = useState([]);
  const [qrMap, setQrMap] = useState({});
  const [toast, setToast] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [publicBase, setPublicBase] = useState(defaultPublicBase);
  const [attendeesFor, setAttendeesFor] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [loadingAttendees, setLoadingAttendees] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  async function load(base = publicBase) {
    try {
      setError('');
      const [list, coordsRes] = await Promise.all([
        api.getEvents(campaignSlug),
        api.getCoordinators(campaignSlug).catch(() => ({ coordinators: [] })),
      ]);
      setEvents(list);
      setCoordinators(coordsRes?.coordinators || []);
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
      });
      setShowForm(false);
      setForm(emptyForm());
      setToast('Evento criado');
      load(publicBase);
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

  const localWarning = isLocalUrl(publicBase);

  return (
    <section className="panel panel-pad">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <p className="eyebrow">Presença</p>
          <h3>Eventos e QR Codes</h3>
          <p>Gere QR Codes únicos para inscrição rápida em cada evento. As pessoas só veem o formulário e a confirmação — sem acesso ao painel. Os dados aparecem em <strong>Ver inscritos</strong> e também em <strong>Registro de cadastros</strong>.</p>
        </div>
        <button type="button" className="btn btn-accent btn-sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Fechar' : 'Novo evento'}
        </button>
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
            Local
            <input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </label>

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
              Esse nome vai para a coluna <strong>Mobilizador</strong> na Base — é o norte de quem está trazendo gente.
              Organiz./Coord. do município a pessoa preenche na inscrição do QR.
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
              Coordenador cadastrado (também conta como mobilizador do evento)
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

          {form.organizer_role === 'coordinator' && !coordinators.length && (
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#8a5a64' }}>
              Nenhum coordenador cadastrado. Cadastre em{' '}
              <Link to="/admin">Admin</Link> antes de vincular o evento.
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
        {events.map((event) => {
          const qr = qrMap[event.slug];
          return (
            <article className="event-card" key={event.id}>
              <div>
                <h4 style={{ marginBottom: 4 }}>{event.name}</h4>
                <p style={{ marginBottom: 0 }}>
                  {new Date(event.event_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                  {event.event_time ? ` · ${event.event_time}` : ''}
                </p>
                <p style={{ marginBottom: 0 }}>{event.location}</p>
                {event.organizer_name && (
                  <p style={{ marginBottom: 0 }}>
                    <strong>Mobilizador ({roleLabel(event.organizer_role).toLowerCase()}):</strong>{' '}
                    {event.organizer_name}
                    {event.organizer_role === 'coordinator' ? ' · vinculado' : ''}
                  </p>
                )}
                <p>{event.description}</p>
                <span className="badge">{event.attendees || 0} inscritos</span>
              </div>
              {qr && (
                <div className="qr-box">
                  <img src={qr.qrcode} alt={`QR Code ${event.name}`} />
                  <code style={{ fontSize: '0.75rem', wordBreak: 'break-all', textAlign: 'center' }}>{qr.url}</code>
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <Link className="btn btn-soft btn-sm" to={`/evento/${event.slug}`}>
                  Página de inscrição
                </Link>
                <button type="button" className="btn btn-accent btn-sm" onClick={() => viewAttendees(event)}>
                  Ver inscritos ({event.attendees || 0})
                </button>
                {qr && (
                  <button type="button" className="btn btn-soft btn-sm" onClick={() => copy(qr.url)}>
                    Copiar link
                  </button>
                )}
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

      {!events.length && <EmptyState>Nenhum evento cadastrado.</EmptyState>}
      <Toast message={toast} onClose={() => setToast('')} />
    </section>
  );
}
