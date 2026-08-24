import { useEffect, useState } from 'react';
import { api } from '../api';
import { formatDateTime } from '../utils/date';
import { EmptyState } from './Ui';

export default function RegistrationsTable({ campaignSlug }) {
  const [query, setQuery] = useState('');
  const [eventId, setEventId] = useState('');
  const [events, setEvents] = useState([]);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    api.getEvents(campaignSlug)
      .then((list) => {
        if (!alive) return;
        setEvents(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (alive) setEvents([]);
      });
    return () => { alive = false; };
  }, [campaignSlug]);

  useEffect(() => {
    let alive = true;
    api.getRegistrations(campaignSlug, {
      page,
      q: query,
      event_id: eventId || undefined,
    })
      .then((res) => alive && setData(res))
      .catch((err) => alive && setError(err.message));
    return () => { alive = false; };
  }, [campaignSlug, page, query, eventId]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const selectedEvent = events.find((e) => String(e.id) === String(eventId));
  const eventPeople = data?.event_filter?.attendees ?? selectedEvent?.attendees ?? null;

  return (
    <section className="panel panel-pad">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <p className="eyebrow">Base</p>
          <h3>Registro de cadastros</h3>
          <p>
            Filtre por <strong>evento</strong> para ver só quem se cadastrou naquele QR
            e o total de pessoas.
          </p>
        </div>
        <div className="filters" style={{ alignItems: 'end' }}>
          <label style={{ minWidth: 200, flex: '1 1 220px' }}>
            Evento
            <select
              className="select"
              value={eventId}
              onChange={(e) => {
                setPage(1);
                setEventId(e.target.value);
              }}
            >
              <option value="">Todos os cadastros</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name}
                  {ev.municipality_name ? ` · ${ev.municipality_name}` : ''}
                  {` (${ev.attendees || 0})`}
                </option>
              ))}
            </select>
          </label>
          <label style={{ minWidth: 180, flex: '1 1 200px' }}>
            Buscar
            <input
              className="input"
              placeholder="Nome, telefone, mobilizador…"
              value={query}
              onChange={(e) => {
                setPage(1);
                setQuery(e.target.value);
              }}
            />
          </label>
        </div>
      </div>

      {eventId ? (
        <div className="event-filter-summary" style={{ marginTop: '0.85rem' }}>
          <span className="badge badge--ok">
            {eventPeople != null ? eventPeople : data?.total || 0} pessoa
            {(eventPeople != null ? eventPeople : data?.total || 0) === 1 ? '' : 's'} neste evento
          </span>
          {selectedEvent ? (
            <span className="badge">
              {selectedEvent.name}
              {selectedEvent.event_date
                ? ` · ${new Date(`${selectedEvent.event_date}T00:00:00`).toLocaleDateString('pt-BR')}`
                : ''}
            </span>
          ) : null}
          <button
            type="button"
            className="btn btn-soft btn-sm"
            onClick={() => {
              setEventId('');
              setPage(1);
            }}
          >
            Ver todos
          </button>
        </div>
      ) : null}

      {error && <EmptyState>{error}</EmptyState>}

      <div className="table-wrap" style={{ marginTop: '1rem' }}>
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Telefone</th>
              <th>Data/Hora</th>
              <th>Mobilizador</th>
              <th>Organiz./Coord.</th>
              <th>Total do mobilizador</th>
              <th>Origem</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items || []).map((row) => (
              <tr key={row.id}>
                <td>{row.full_name}</td>
                <td>{row.phone}</td>
                <td>{formatDateTime(row.created_at)}</td>
                <td>
                  {row.mobilizer_display || row.mobilizer_name || row.leader_name || '—'}
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                    {row.municipality_name || ''}
                  </div>
                </td>
                <td>{row.organizer_name || '—'}</td>
                <td>{row.mobilizer_total}</td>
                <td>
                  <code style={{ fontSize: '0.8rem' }}>{row.source || row.referral_code || 'direto'}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!data?.items?.length && <EmptyState>Nenhum cadastro encontrado.</EmptyState>}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', gap: '0.75rem', flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--muted)' }}>
          {data?.total || 0} registro{(data?.total || 0) === 1 ? '' : 's'}
          {eventId ? ' neste filtro' : ''}
        </span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-soft btn-sm" type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </button>
          <span style={{ alignSelf: 'center' }}>{page} / {totalPages}</span>
          <button className="btn btn-soft btn-sm" type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Próxima
          </button>
        </div>
      </div>
    </section>
  );
}
