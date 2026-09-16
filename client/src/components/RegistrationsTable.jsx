import { useEffect, useState } from 'react';
import { api } from '../api';
import { formatDateTime } from '../utils/date';
import { EmptyState, Toast } from './Ui';

export default function RegistrationsTable({ campaignSlug }) {
  const [query, setQuery] = useState('');
  const [eventId, setEventId] = useState('');
  const [events, setEvents] = useState([]);
  const [municipalities, setMunicipalities] = useState([]);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      api.getEvents(campaignSlug).catch(() => []),
      api.getMunicipalities().catch(() => []),
    ]).then(([list, munis]) => {
      if (!alive) return;
      setEvents(Array.isArray(list) ? list : []);
      setMunicipalities(Array.isArray(munis) ? munis : []);
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

  async function changeMunicipality(row, nextMuniId) {
    const value = nextMuniId === '' || nextMuniId == null ? null : Number(nextMuniId);
    const current = row.municipality_id == null ? null : Number(row.municipality_id);
    if (value === current) return;

    setSavingId(row.id);
    try {
      const updated = await api.updateRegistration(campaignSlug, row.id, {
        municipality_id: value,
      });
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((item) => (
            item.id === row.id
              ? {
                  ...item,
                  municipality_id: updated.municipality_id,
                  municipality_name: updated.municipality_name || null,
                  lat: updated.lat,
                  lng: updated.lng,
                }
              : item
          )),
        };
      });
      setToast(
        updated.municipality_name
          ? `Município atualizado: ${updated.municipality_name}`
          : 'Município removido do cadastro',
      );
    } catch (err) {
      setToast(err.message || 'Não foi possível alterar o município');
    } finally {
      setSavingId(null);
    }
  }

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
            Filtre por <strong>evento</strong> para ver quem veio daquele QR.
            Se a pessoa entrou pelo QR de uma cidade mas mora em outra, altere o{' '}
            <strong>município</strong> na coluna ao lado — o mapa acompanha.
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
              <th>Município</th>
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
                <td style={{ minWidth: 170 }}>
                  <select
                    className="select"
                    style={{ minWidth: 160, fontSize: '0.88rem' }}
                    value={row.municipality_id != null ? String(row.municipality_id) : ''}
                    disabled={savingId === row.id}
                    onChange={(e) => changeMunicipality(row, e.target.value)}
                    aria-label={`Município de ${row.full_name}`}
                  >
                    <option value="">Sem município</option>
                    {municipalities.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </td>
                <td>
                  {row.mobilizer_display || row.mobilizer_name || row.leader_name || '—'}
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

      <Toast message={toast} onClose={() => setToast('')} />
    </section>
  );
}
