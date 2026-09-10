import { useState } from 'react';
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

function dayLabel(isoDay) {
  if (!isoDay || isoDay.length < 10) return isoDay || '—';
  const [y, m, d] = isoDay.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Análise/planilha diária dos QR de liderança sob um coordenador.
 * Separado do desempenho de eventos de rua.
 */
export default function CoordinatorLeadersPerformancePanel({
  campaignSlug,
  coordinatorId,
  coordinatorName,
}) {
  const [mode, setMode] = useState('day');
  const [dateFrom, setDateFrom] = useState(todayISO);
  const [dateTo, setDateTo] = useState(todayISO);
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');

  async function generate(e) {
    if (e) e.preventDefault();
    if (!coordinatorId) {
      setToast('Selecione um coordenador');
      return;
    }
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
      const res = await api.getCoordinatorLeadersPerformance(campaignSlug, coordinatorId, {
        date_from: from,
        date_to: to,
      });
      setReport(res);
      setToast(
        res.total
          ? `Desempenho: ${res.total} cadastro(s) · ${res.by_leader?.length || 0} liderança(s)`
          : 'Nenhum cadastro das lideranças nesse dia/período',
      );
    } catch (err) {
      setToast(err.message || 'Falha ao gerar desempenho');
      setReport(null);
    } finally {
      setBusy(false);
    }
  }

  function downloadDailyCsv() {
    if (!report) {
      setToast('Gere o desempenho antes');
      return;
    }
    const days = report.by_day_leader || [];
    const lines = [
      ['Coordenador', report.coordinator_name || ''].map(csvEscape).join(','),
      ['Turma começou em', report.team_started_day ? dayLabel(report.team_started_day) : '—'].map(csvEscape).join(','),
      ['Total no período', report.total].map(csvEscape).join(','),
      ['', ''].map(csvEscape).join(','),
      ['Dia', 'Total do dia', 'Liderança', 'Município', 'Cadastros'].map(csvEscape).join(','),
    ];
    if (!days.length) {
      lines.push([dayLabel(report.date_from), 0, '', '', 0].map(csvEscape).join(','));
    }
    for (const dayRow of days) {
      const label = dayLabel(dayRow.day);
      const leaders = dayRow.leaders || [];
      if (!leaders.length) {
        lines.push([label, dayRow.total, '', '', 0].map(csvEscape).join(','));
        continue;
      }
      for (const row of leaders) {
        lines.push([
          label,
          dayRow.total,
          row.name,
          row.municipality_name || '',
          row.total,
        ].map(csvEscape).join(','));
      }
    }
    const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const from = report.date_from || 'inicio';
    const to = report.date_to || 'fim';
    const coord = String(report.coordinator_name || 'coordenador')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9-_]+/g, '-')
      .toLowerCase();
    a.download = from === to
      ? `desempenho-liderancas-${coord}-${from}.csv`
      : `desempenho-liderancas-${coord}-${from}_a_${to}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setToast('Planilha diária baixada');
  }

  function downloadRankingCsv() {
    if (!report?.by_leader?.length) {
      setToast('Gere o desempenho com cadastros antes');
      return;
    }
    const lines = [
      ['Posição', 'Liderança', 'Município', 'Começou em', 'Total no período'].map(csvEscape).join(','),
    ];
    for (const row of report.by_leader) {
      lines.push([
        row.position,
        row.name,
        row.municipality_name || '',
        row.started_day ? dayLabel(row.started_day) : '—',
        row.total,
      ].map(csvEscape).join(','));
    }
    const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const from = report.date_from || 'inicio';
    const to = report.date_to || 'fim';
    a.download = from === to
      ? `ranking-liderancas-${from}.csv`
      : `ranking-liderancas-${from}_a_${to}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setToast('Ranking baixado');
  }

  const ranking = report?.by_leader || [];
  const daySheets = report?.by_day_leader || [];
  const isSingleDay = report && report.date_from === report.date_to;
  const top = ranking[0];

  return (
    <section className="panel panel-pad" style={{ marginTop: '1rem', background: 'rgba(44, 62, 58, 0.03)' }}>
      <div>
        <p className="eyebrow" style={{ marginBottom: 4 }}>QR de lideranças</p>
        <h4 style={{ margin: 0 }}>
          Desempenho diário — {coordinatorName || 'coordenador'}
        </h4>
        <p style={{ margin: '0.35rem 0 0', fontSize: '0.9rem', color: 'var(--muted)' }}>
          Planilha dos cadastros pelos <strong>links/QR das lideranças</strong> deste coordenador
          (separado dos eventos de rua). Mostra total do dia, quanto cada liderança fez e
          desde quando a turma começou a puxar.
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
        <button className="btn btn-primary btn-sm" type="submit" disabled={busy || !coordinatorId}>
          {busy ? 'Gerando…' : 'Gerar desempenho'}
        </button>
        {report ? (
          <>
            <button className="btn btn-accent btn-sm" type="button" onClick={downloadDailyCsv}>
              Baixar planilha diária
            </button>
            {ranking.length ? (
              <button className="btn btn-soft btn-sm" type="button" onClick={downloadRankingCsv}>
                Baixar ranking
              </button>
            ) : null}
          </>
        ) : null}
      </form>

      {report ? (
        <div style={{ marginTop: '0.95rem' }}>
          <div className="coord-mini-stats" style={{ marginBottom: '0.85rem' }}>
            <div>
              <strong style={{ fontSize: '1.4rem' }}>{report.total}</strong>
              <span>{isSingleDay ? 'Cadastrados no dia' : 'Cadastrados no período'}</span>
            </div>
            <div>
              <strong style={{ fontSize: '1.4rem' }}>{ranking.length}</strong>
              <span>Lideranças com cadastro</span>
            </div>
            <div>
              <strong style={{ fontSize: '1.05rem' }}>
                {report.team_started_day ? dayLabel(report.team_started_day) : '—'}
              </strong>
              <span>Turma começou em</span>
            </div>
            <div>
              <strong style={{ fontSize: '1.05rem' }}>
                {top ? top.total : '—'}
              </strong>
              <span>{top ? `1º: ${top.name}` : 'Sem 1º no período'}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginBottom: '0.85rem' }}>
            <span className="badge">
              {isSingleDay
                ? formatDate(report.date_from || report.date)
                : `${formatDate(report.date_from)} a ${formatDate(report.date_to)}`}
            </span>
            <span className="badge">00:00–23:59 · Cuiabá</span>
            <span className="badge">Só links/QR de liderança</span>
          </div>

          {report.leaders_overview?.length ? (
            <div className="table-wrap" style={{ marginBottom: '1rem' }}>
              <h4 style={{ margin: '0 0 0.4rem', fontSize: '1rem' }}>
                Lideranças — total no período e desde quando puxam
              </h4>
              <table>
                <thead>
                  <tr>
                    <th>Liderança</th>
                    <th>Município</th>
                    <th>Começou em</th>
                    <th>No período</th>
                    <th>Total geral</th>
                  </tr>
                </thead>
                <tbody>
                  {report.leaders_overview.map((row) => (
                    <tr key={row.leader_id}>
                      <td>{row.name}</td>
                      <td>{row.municipality_name || '—'}</td>
                      <td>{row.started_day ? dayLabel(row.started_day) : 'Ainda sem cadastro'}</td>
                      <td><strong>{row.period_total}</strong></td>
                      <td>{row.lifetime_total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState>Este coordenador ainda não tem lideranças com link/QR.</EmptyState>
          )}

          {ranking.length ? (
            <div className="table-wrap" style={{ marginBottom: '1rem' }}>
              <h4 style={{ margin: '0 0 0.4rem', fontSize: '1rem' }}>
                Ranking no período — quem fez mais
              </h4>
              <table>
                <thead>
                  <tr>
                    <th>Pos.</th>
                    <th>Liderança</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((row) => (
                    <tr key={`${row.position}-${row.leader_id}`}>
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
          ) : null}

          {daySheets.length ? (
            <div className="stack" style={{ gap: '0.75rem' }}>
              <h4 style={{ margin: 0, fontSize: '1rem' }}>Por dia</h4>
              {daySheets.map((dayRow) => (
                <div key={dayRow.day} className="table-wrap">
                  <h4 style={{ margin: '0 0 0.35rem', fontSize: '0.95rem' }}>
                    {dayLabel(dayRow.day)} — total {dayRow.total}
                  </h4>
                  <table>
                    <thead>
                      <tr>
                        <th>Liderança</th>
                        <th>Cadastros</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(dayRow.leaders || []).map((row) => (
                        <tr key={`${dayRow.day}-${row.leader_id}`}>
                          <td>{row.name}</td>
                          <td><strong>{row.total}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          ) : (
            report.leaders_overview?.length ? (
              <EmptyState>Nenhum cadastro das lideranças nesse dia/período.</EmptyState>
            ) : null
          )}
        </div>
      ) : null}

      <Toast message={toast} onClose={() => setToast('')} />
    </section>
  );
}
