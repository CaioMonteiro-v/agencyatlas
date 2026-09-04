import { useEffect, useState } from 'react';
import { api } from '../api';
import { formatDate } from '../utils/date';
import { EmptyState, Toast } from './Ui';

function todayISO() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Cuiaba',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function csvEscape(value) {
  const text = value == null ? '' : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export default function PerformanceDailyPanel({ campaignSlug }) {
  const [mode, setMode] = useState('day');
  const [dateFrom, setDateFrom] = useState(todayISO);
  const [dateTo, setDateTo] = useState(todayISO);
  const [eventId, setEventId] = useState('');
  const [events, setEvents] = useState([]);
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    api.getEvents(campaignSlug)
      .then((list) => setEvents(Array.isArray(list) ? list : []))
      .catch(() => setEvents([]));
  }, [campaignSlug]);

  async function generate(e) {
    if (e) e.preventDefault();
    const dayOnly = mode === 'day';
    const rawFrom = dateFrom;
    const rawTo = dayOnly ? dateFrom : dateTo;
    if (!rawFrom || (!dayOnly && !rawTo)) {
      setToast(dayOnly ? 'Escolha o dia' : 'Escolha de e até');
      return;
    }
    const from = rawFrom <= rawTo ? rawFrom : rawTo;
    const to = rawFrom <= rawTo ? rawTo : rawFrom;
    setBusy(true);
    try {
      const res = await api.getPerformanceDaily(campaignSlug, {
        date_from: from,
        date_to: to,
        event_id: eventId || undefined,
      });
      setReport(res);
      const top = res.by_mobilizer?.[0];
      setToast(
        top
          ? `Ranking: 1º ${top.name} (${top.total} cad.)`
          : (res.total
            ? 'Há cadastros, mas nenhum com mobilizador creditado'
            : 'Nenhum cadastro nesse dia/período'),
      );
    } catch (err) {
      setToast(err.message || 'Falha ao gerar desempenho');
      setReport(null);
    } finally {
      setBusy(false);
    }
  }

  function downloadRankingCsv() {
    const rows = report?.by_mobilizer || [];
    if (!rows.length) {
      setToast('Gere o ranking antes');
      return;
    }
    const lines = [['Posição', 'Mobilizador', 'Total'].map(csvEscape).join(',')];
    for (const row of rows) {
      lines.push([row.position, row.name, row.total].map(csvEscape).join(','));
    }
    const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const from = report.date_from || 'inicio';
    const to = report.date_to || 'fim';
    a.download = from === to
      ? `ranking-mobilizadores-${from}.csv`
      : `ranking-mobilizadores-${from}_a_${to}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setToast('Ranking baixado (abre no Excel)');
  }

  const ranking = report?.by_mobilizer || [];
  const topMobilizer = ranking[0];

  return (
    <section className="panel panel-pad" style={{ background: 'rgba(44, 62, 58, 0.03)' }}>
      <div>
        <p className="eyebrow" style={{ marginBottom: 4 }}>Prêmio · Eventos de rua</p>
        <h3 style={{ margin: 0 }}>Ranking de mobilizadores</h3>
        <p style={{ margin: '0.35rem 0 0', color: 'var(--muted)' }}>
          Quem fez mais cadastros nos <strong>QR de eventos de rua</strong>.
          Escolha o dia ou o período — o ranking mostra o total de cada um (00:00–23:59 Cuiabá).
        </p>
      </div>

      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
        <button
          type="button"
          className={`chip ${mode === 'day' ? 'active' : ''}`}
          onClick={() => {
            setMode('day');
            setDateTo(dateFrom);
          }}
        >
          Um dia
        </button>
        <button
          type="button"
          className={`chip ${mode === 'range' ? 'active' : ''}`}
          onClick={() => setMode('range')}
        >
          Período
        </button>
        <button
          type="button"
          className="btn btn-soft btn-sm"
          onClick={() => {
            const today = todayISO();
            setDateFrom(today);
            setDateTo(today);
            setMode('day');
          }}
        >
          Hoje
        </button>
      </div>

      <form className="filters" style={{ marginTop: '0.85rem', alignItems: 'end' }} onSubmit={generate}>
        {mode === 'day' ? (
          <label style={{ minWidth: 160 }}>
            Dia
            <input
              className="input"
              type="date"
              required
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setDateTo(e.target.value);
              }}
            />
          </label>
        ) : (
          <>
            <label style={{ minWidth: 150 }}>
              De
              <input
                className="input"
                type="date"
                required
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </label>
            <label style={{ minWidth: 150 }}>
              Até
              <input
                className="input"
                type="date"
                required
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </label>
          </>
        )}
        <label style={{ flex: '1 1 200px', minWidth: 180 }}>
          Evento (opcional)
          <select
            className="select"
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
          >
            <option value="">Todos os eventos de rua</option>
            {events
              .filter((ev) => ev.organizer_role !== 'coordinator')
              .map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name}
                  {ev.municipality_name ? ` · ${ev.municipality_name}` : ''}
                </option>
              ))}
          </select>
        </label>
        <button className="btn btn-primary btn-sm" type="submit" disabled={busy}>
          {busy ? 'Gerando…' : 'Gerar ranking'}
        </button>
        {ranking.length ? (
          <button className="btn btn-accent btn-sm" type="button" onClick={downloadRankingCsv}>
            Baixar ranking
          </button>
        ) : null}
      </form>

      {report ? (
        <div style={{ marginTop: '0.95rem' }}>
          <p style={{ margin: '0 0 0.55rem', fontSize: '1.25rem', fontWeight: 700 }}>
            {report.total} cadastro{report.total === 1 ? '' : 's'}
            {report.date_from === report.date_to
              ? ` · ${formatDate(report.date_from || report.date)}`
              : ` · ${formatDate(report.date_from)} a ${formatDate(report.date_to)}`}
          </p>
          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginBottom: '0.85rem' }}>
            <span className="badge">00:00–23:59 · Cuiabá</span>
            <span className="badge">Só eventos de rua</span>
            {report.event_name ? <span className="badge">{report.event_name}</span> : null}
            {topMobilizer ? (
              <span className="badge badge--ok">
                1º lugar: {topMobilizer.name} — {topMobilizer.total}
              </span>
            ) : null}
          </div>

          {!ranking.length ? (
            <EmptyState>
              Nenhum mobilizador creditado neste período.
            </EmptyState>
          ) : (
            <div className="table-wrap">
              <h4 style={{ margin: '0 0 0.45rem', fontSize: '1.1rem' }}>
                Ranking — quem fez mais
              </h4>
              <table>
                <thead>
                  <tr>
                    <th>Pos.</th>
                    <th>Mobilizador</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((row) => (
                    <tr key={`${row.position}-${row.name}`}>
                      <td>
                        <strong>
                          {row.position <= 3 ? `${row.position}º ★` : `${row.position}º`}
                        </strong>
                      </td>
                      <td>{row.name}</td>
                      <td><strong>{row.total}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      <Toast message={toast} onClose={() => setToast('')} />
    </section>
  );
}
