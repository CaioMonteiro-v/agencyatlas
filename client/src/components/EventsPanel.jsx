import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { EmptyState, Toast } from './Ui';

export default function EventsPanel({ campaignSlug }) {
  const [events, setEvents] = useState([]);
  const [qrMap, setQrMap] = useState({});
  const [toast, setToast] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    location: '',
    event_date: '',
    event_time: '',
  });
  const [error, setError] = useState('');

  async function load() {
    try {
      const list = await api.getEvents(campaignSlug);
      setEvents(list);
      const origin = window.location.origin;
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
    load();
  }, [campaignSlug]);

  async function copy(text) {
    await navigator.clipboard.writeText(text);
    setToast('Link do evento copiado');
    setTimeout(() => setToast(''), 2000);
  }

  async function onCreate(e) {
    e.preventDefault();
    try {
      await api.createEvent(campaignSlug, form);
      setShowForm(false);
      setForm({ name: '', description: '', location: '', event_date: '', event_time: '' });
      setToast('Evento criado');
      load();
    } catch (err) {
      setToast(err.message);
    }
  }

  return (
    <section className="panel panel-pad">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <p className="eyebrow">Presença</p>
          <h3>Eventos e QR Codes</h3>
          <p>Gere QR Codes únicos para inscrição rápida em cada evento.</p>
        </div>
        <button type="button" className="btn btn-accent btn-sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Fechar' : 'Novo evento'}
        </button>
      </div>

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
                <p>{event.description}</p>
                <span className="badge">{event.attendees || 0} inscritos</span>
              </div>
              {qr && (
                <div className="qr-box">
                  <img src={qr.qrcode} alt={`QR Code ${event.name}`} />
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <Link className="btn btn-soft btn-sm" to={`/evento/${event.slug}`}>
                  Página de inscrição
                </Link>
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

      {!events.length && <EmptyState>Nenhum evento cadastrado.</EmptyState>}
      <Toast message={toast} onClose={() => setToast('')} />
    </section>
  );
}
