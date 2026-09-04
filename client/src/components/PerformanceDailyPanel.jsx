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

/** DD/MM a partir de YYYY-MM-DD (sem fuso). */
function dayLabel(isoDay) {
  if (!isoDay || isoDay.length < 10) return isoDay || '';
  const [y, m, d] = isoDay.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
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
          ? `1º mobilizador: ${top.name} (${top.total} cad.)`
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

  /** Planilha: Dia | Total do dia | Mobilizador | Total do mobilizador */
  function downloadCsv() {
    const days = report?.by_day_mobilizer || [];
    const hasRows = days.some((d) => (d.mobilizers || []).length > 0);
    if (!hasRows) {
      setToast('Gere o relatório com mobilizadores antes');
      return;
    }
    const lines = [['Dia', 'Total do dia', 'Mobilizador', 'Total do mobilizador'].map(csvEscape).join(',')];
    for (const dayRow of days) {
      const label = dayLabel(dayRow.day);
      const mobs = dayRow.mobilizers || [];
      if (!mobs.length) {
        lines.push([label, dayRow.total, '', 0].map(csvEscape).join(','));
        continue;
      }
      for (const mob of mobs) {
        lines.push([label, dayRow.total, mob.name, mob.total].map(csvEscape).join(','));
      }
    }
    const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const from = report.date_from || 'inicio';
    const to = report.date_to || 'fim';
    a.download = from === to
      ? `planilha-diaria-mobilizadores-${from}.csv`
      : `planilha-diaria-mobilizadores-${from}_a_${to}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setToast('Planilha diária baixada (abre no Excel)');
  }

  const ranking = report?.by_mobilizer || [];
  const daySheets = report?.by_day_mobilizer || [];
  const topMobilizer = ranking[0];
  const canDownload = daySheets.some((d) => (d.mobilizers || []).length > 0);

  return (
    <section className="panel panel-pad" style={{ background: 'rgba(44, 62, 58, 0.03)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.85rem', flexWrap: 'wrap' }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: 4 }}>Prêmio</p>
          <h3 style={{ margin: 0 }}>Desempenho diário — mobilizadores</h3>
          <p style={{ margin: '0.35rem 0 0', color: 'var(--muted)' }}>
            No <strong>período</strong>, gera planilha dia a dia: data, total do dia e cada mobilizador com o total.
            Horário 00:00–23:59 Cuiabá.
          </p>
        </div>
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
            <option value="">Toda a Base</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name}
                {ev.municipality_name ? ` · ${ev.municipality_name}` : ''}
              </option>
            ))}
          </select>
        </label>
        <button className="btn btn-primary btn-sm" type="submit" disabled={busy}>
          {busy ? 'Gerando…' : 'Gerar desempenho'}
        </button>
        {canDownload ? (
          <button className="btn btn-accent btn-sm" type="button" onClick={downloadCsv}>
            Baixar planilha diária
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
            {report.event_name ? <span className="badge">{report.event_name}</span> : (
              <span className="badge">Toda a Base</span>
            )}
            {topMobilizer ? (
              <span className="badge badge--ok">
                1º no período: {topMobilizer.name} ({topMobilizer.total})
              </span>
            ) : null}
          </div>

          {!daySheets.length ? (
            <EmptyState>
              Nenhum cadastro neste período.
            </EmptyState>
          ) : (
            <div className="stack" style={{ gap: '0.85rem' }}>
              {daySheets.map((dayRow) => (
                <div key={dayRow.day} className="table-wrap">
                  <h4 style={{ margin: '0 0 0.4rem', fontSize: '1rem' }}>
                    {dayLabel(dayRow.day)} — total {dayRow.total}
                  </h4>
                  {!(dayRow.mobilizers || []).length ? (
                    <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.9rem' }}>
                      Sem mobilizador creditado neste dia.
                    </p>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th>Mobilizador</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dayRow.mobilizers.map((mob) => (
                          <tr key={`${dayRow.day}-${mob.name}`}>
                            <td>{mob.name}</td>
                            <td><strong>{mob.total}</strong></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <Toast message={toast} onClose={() => setToast('')} />
    </section>
  );
}
