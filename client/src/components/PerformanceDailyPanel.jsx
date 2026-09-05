import { useEffect, useMemo, useState } from 'react';
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
      setToast(
        res.total
          ? `Análise pronta: ${res.total} cadastrado(s) · ${res.by_mobilizer?.length || 0} mobilizador(es)`
          : 'Nenhum cadastro nesse dia/período (eventos de rua)',
      );
    } catch (err) {
      setToast(err.message || 'Falha ao gerar análise');
      setReport(null);
    } finally {
      setBusy(false);
    }
  }

  function downloadCsv() {
    const rows = report?.by_mobilizer || [];
    if (!report) {
      setToast('Gere a análise antes');
      return;
    }
    const lines = [
      ['Total cadastrados', report.total].map(csvEscape).join(','),
      ['', ''].map(csvEscape).join(','),
      ['Posição', 'Mobilizador', 'Quantos fez'].map(csvEscape).join(','),
    ];
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
      ? `analise-desempenho-${from}.csv`
      : `analise-desempenho-${from}_a_${to}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setToast('Análise baixada (abre no Excel)');
  }

  const ranking = report?.by_mobilizer || [];
  const topMobilizer = ranking[0];
  const credited = useMemo(
    () => ranking.reduce((sum, row) => sum + Number(row.total || 0), 0),
    [ranking],
  );
  const withoutMobilizer = report ? Math.max(0, Number(report.total || 0) - credited) : 0;
  const isSingleDay = report && report.date_from === report.date_to;
  const periodLabel = report
    ? (isSingleDay
      ? formatDate(report.date_from || report.date)
      : `${formatDate(report.date_from)} a ${formatDate(report.date_to)}`)
    : '';

  return (
    <section className="panel panel-pad" style={{ background: 'rgba(44, 62, 58, 0.03)' }}>
      <div>
        <p className="eyebrow" style={{ marginBottom: 4 }}>Prêmio · Eventos de rua</p>
        <h3 style={{ margin: 0 }}>Análise e desempenho</h3>
        <p style={{ margin: '0.35rem 0 0', color: 'var(--muted)' }}>
          Total cadastrado no dia/período + quanto cada mobilizador fez nos{' '}
          <strong>QR de eventos de rua</strong> (00:00–23:59 Cuiabá). Não mistura coordenador/liderança.
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
          {busy ? 'Gerando…' : 'Gerar análise'}
        </button>
        {report ? (
          <button className="btn btn-accent btn-sm" type="button" onClick={downloadCsv}>
            Baixar planilha
          </button>
        ) : null}
      </form>

      {report ? (
        <div style={{ marginTop: '0.95rem' }}>
          <div className="coord-mini-stats" style={{ marginBottom: '0.9rem' }}>
            <div>
              <strong style={{ fontSize: '1.45rem' }}>{report.total}</strong>
              <span>
                {isSingleDay ? 'Total cadastrados no dia' : 'Total cadastrados no período'}
              </span>
            </div>
            <div>
              <strong style={{ fontSize: '1.45rem' }}>{ranking.length}</strong>
              <span>Mobilizadores com cadastro</span>
            </div>
            <div>
              <strong style={{ fontSize: '1.15rem' }}>
                {topMobilizer ? `${topMobilizer.total}` : '—'}
              </strong>
              <span>
                {topMobilizer ? `1º: ${topMobilizer.name}` : 'Ainda sem 1º lugar'}
              </span>
            </div>
            {withoutMobilizer > 0 ? (
              <div>
                <strong style={{ fontSize: '1.15rem' }}>{withoutMobilizer}</strong>
                <span>Sem mobilizador no cadastro</span>
              </div>
            ) : null}
          </div>

          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginBottom: '0.85rem' }}>
            <span className="badge">{periodLabel}</span>
            <span className="badge">00:00–23:59 · Cuiabá</span>
            <span className="badge">Só eventos de rua</span>
            {report.event_name ? <span className="badge">{report.event_name}</span> : null}
          </div>

          {!ranking.length ? (
            <EmptyState>
              {report.total
                ? 'Há cadastros no dia, mas nenhum com mobilizador preenchido.'
                : 'Nenhum cadastro neste dia/período.'}
            </EmptyState>
          ) : (
            <div className="table-wrap">
              <h4 style={{ margin: '0 0 0.45rem', fontSize: '1.1rem' }}>
                Desempenho — quanto cada um fez
              </h4>
              <p style={{ margin: '0 0 0.55rem', fontSize: '0.9rem', color: 'var(--muted)' }}>
                Ordenado de quem fez mais para quem fez menos (ranking do prêmio).
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Pos.</th>
                    <th>Mobilizador</th>
                    <th>Quantos fez</th>
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
