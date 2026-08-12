import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { api } from '../api';
import { EmptyState, Toast } from '../components/Ui';
import DemandFunnelPanel from '../components/DemandFunnelPanel';

export default function ReportPage() {
  const { campaign } = useOutletContext();
  const [tab, setTab] = useState('funil');
  const [report, setReport] = useState(null);
  const [briefing, setBriefing] = useState(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [loadingAssistant, setLoadingAssistant] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);

  async function load() {
    setLoadingReport(true);
    setError('');
    try {
      const res = await api.getReport(campaign.slug);
      setReport(res);
    } catch (err) {
      setError(err.message);
      setReport(null);
    } finally {
      setLoadingReport(false);
    }
  }

  useEffect(() => {
    if (tab === 'executivo') {
      load();
    }
  }, [campaign.slug, tab]);

  async function generateAssistant() {
    setLoadingAssistant(true);
    try {
      const res = await api.runAssistant(campaign.slug);
      setBriefing(res);
      setToast(res.source === 'openai' ? 'Briefing gerado com IA' : 'Briefing gerado pela Atlas Assistente');
    } catch (err) {
      setToast(err.message);
    } finally {
      setLoadingAssistant(false);
    }
  }

  async function copyBriefing() {
    const text = briefing?.text || '';
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setToast('Briefing copiado');
    } catch (_) {
      setToast('Não foi possível copiar automaticamente');
    }
  }

  const s = report?.summary;

  return (
    <div className="container section report-page" style={{ paddingTop: 0 }}>
      <div className="section__head">
        <p className="eyebrow">Inteligência de campanha</p>
        <h2>Relatório</h2>
        <p>
          Funil de demandas por coordenador/município e relatório executivo —
          registre o que houve, prints e o que ficou resolvido ou em standby.
        </p>
        <div className="chip-group" style={{ marginTop: '0.75rem' }}>
          <button
            type="button"
            className={`chip ${tab === 'funil' ? 'active' : ''}`}
            onClick={() => setTab('funil')}
          >
            Funil de demandas
          </button>
          <button
            type="button"
            className={`chip ${tab === 'executivo' ? 'active' : ''}`}
            onClick={() => setTab('executivo')}
          >
            Relatório executivo
          </button>
        </div>
      </div>

      {tab === 'funil' && <DemandFunnelPanel campaignSlug={campaign.slug} />}

      {tab === 'executivo' && loadingReport && (
        <EmptyState>Montando relatório…</EmptyState>
      )}

      {tab === 'executivo' && !loadingReport && error && (
        <EmptyState>{error}</EmptyState>
      )}

      {tab === 'executivo' && !loadingReport && !error && report && (
        <>
          <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <button className="btn btn-primary btn-sm" type="button" onClick={() => window.print()}>
              Imprimir / PDF
            </button>
            <button className="btn btn-accent btn-sm" type="button" disabled={loadingAssistant} onClick={generateAssistant}>
              {loadingAssistant ? 'Analisando…' : 'Gerar análise da Atlas Assistente'}
            </button>
            <Link className="btn btn-soft btn-sm" to={`/campanha/${campaign.slug}/coordenadores`}>
              Voltar aos coordenadores
            </Link>
          </div>

          <section className="panel panel-pad report-hero">
            <p className="eyebrow">Resumo executivo</p>
            <h3 style={{ marginTop: 0 }}>{campaign.candidate || campaign.name}</h3>
            <p className="report-lead">{report.executive_summary}</p>
            <p className="meta-hint">
              Gerado em {new Date(report.generated_at).toLocaleString('pt-BR')}
              {report.meta ? ` · Instagram: ${report.meta.mode}` : ''}
            </p>
          </section>

          <div className="stats-row" style={{ margin: '1.1rem 0' }}>
            <div className="stat">
              <strong>{s.total_coordinators}</strong>
              <span>Coordenadores</span>
            </div>
            <div className="stat">
              <strong>{s.municipalities_assigned}</strong>
              <span>Municípios</span>
            </div>
            <div className="stat">
              <strong>{s.vote_progress_pct != null ? `${s.vote_progress_pct}%` : '—'}</strong>
              <span>Expectativa de voto</span>
            </div>
            <div className="stat">
              <strong className={s.alarms_critical ? 'stat-alarm' : undefined}>
                {s.alarms_critical}/{s.alarms_attention}
              </strong>
              <span>Críticos / Atenção</span>
            </div>
          </div>

          <div className="layout-split">
            <section className="panel panel-pad">
              <p className="eyebrow">Alarmes</p>
              <h3 style={{ marginTop: 0 }}>Falhas e conteúdo abaixo da meta</h3>
              {!report.alarms.length ? (
                <EmptyState>Nenhum alarme no momento.</EmptyState>
              ) : (
                <div className="report-alarm-list">
                  {report.alarms.slice(0, 20).map((a, idx) => (
                    <article key={`${a.coordinator_id}-${a.municipality_id}-${a.type}-${idx}`} className={`report-alarm report-alarm--${a.severity}`}>
                      <header>
                        <strong>{a.coordinator_name}</strong>
                        <span>{a.municipality_name}</span>
                      </header>
                      <p>{a.message}</p>
                      {a.action && <p className="report-action">→ {a.action}</p>}
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="panel panel-pad">
              <p className="eyebrow">Próximos passos</p>
              <h3 style={{ marginTop: 0 }}>Prioridades da campanha</h3>
              <ul className="report-steps">
                {report.next_steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            </section>
          </div>

          <section className="panel panel-pad" style={{ marginTop: '1.1rem' }}>
            <p className="eyebrow">Chamada de atenção</p>
            <h3 style={{ marginTop: 0 }}>Folha de ligação dos coordenadores</h3>
            {!report.call_sheet.length ? (
              <EmptyState>Nenhum coordenador precisa de chamada agora.</EmptyState>
            ) : (
              <div className="call-sheet">
                {report.call_sheet.map((row) => (
                  <article key={row.coordinator} className="call-card">
                    <header>
                      <div>
                        <strong>{row.coordinator}</strong>
                        {row.phone && <p>{row.phone}</p>}
                      </div>
                      <span className={`health-pill health-pill--${row.status === 'Com falhas' ? 'critical' : 'attention'}`}>
                        {row.status}
                      </span>
                    </header>
                    <p className="eyebrow" style={{ marginTop: '0.75rem' }}>Pontos da ligação</p>
                    <ul>
                      {row.talking_points.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                    {!!row.municipalities_in_fail?.length && (
                      <>
                        <p className="eyebrow">Municípios</p>
                        <ul>
                          {row.municipalities_in_fail.map((m) => (
                            <li key={m.name}>
                              <strong>{m.name}</strong>: {m.alarms.join('; ')}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="panel panel-pad assistant-panel" style={{ marginTop: '1.1rem' }}>
            <div className="coord-detail__head">
              <div>
                <p className="eyebrow">Atlas Assistente</p>
                <h3 style={{ marginTop: 0 }}>Análise para reunião / ligação</h3>
                <p>
                  A assistente cruza cadastros, expectativa de voto, visualização de conteúdo e sinais do Instagram
                  para sugerir o que falar com cada coordenador.
                </p>
              </div>
              {briefing && (
                <button className="btn btn-soft btn-sm" type="button" onClick={copyBriefing}>
                  Copiar texto
                </button>
              )}
            </div>

            {!briefing ? (
              <EmptyState>
                Clique em <strong>Gerar análise da Atlas Assistente</strong> para montar o briefing.
                Com <code>OPENAI_API_KEY</code> no servidor, o texto fica ainda mais elaborado.
              </EmptyState>
            ) : (
              <div className="briefing-box">
                <p className="meta-hint">
                  Fonte: {briefing.source === 'openai' ? 'OpenAI + Atlas' : 'Atlas local'}
                  {briefing.openai_error ? ` · fallback: ${briefing.openai_error}` : ''}
                </p>
                <pre>{briefing.text}</pre>
              </div>
            )}
          </section>

          <section className="panel panel-pad" style={{ marginTop: '1.1rem' }}>
            <p className="eyebrow">Detalhe por coordenador</p>
            <h3 style={{ marginTop: 0 }}>Totais e proporções</h3>
            <div className="report-coord-table-wrap">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Coordenador</th>
                    <th>Mun.</th>
                    <th>Cadastros</th>
                    <th>Meta voto</th>
                    <th>Conteúdo</th>
                    <th>IG</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {report.coordinators.map((c) => (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td>{c.totals.municipalities}</td>
                      <td>{c.totals.registrations}</td>
                      <td>
                        {c.totals.vote_expectation
                          ? `${c.totals.registrations}/${c.totals.vote_expectation} (${c.totals.vote_progress_pct ?? 0}%)`
                          : '—'}
                      </td>
                      <td>
                        {c.totals.content_views_expected
                          ? `${c.totals.content_views_actual}/${c.totals.content_views_expected} (${c.totals.content_progress_pct ?? 0}%)`
                          : '—'}
                      </td>
                      <td>{c.totals.ig_comments} com.</td>
                      <td>{c.health.label}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <Toast message={toast} onClose={() => setToast('')} />
    </div>
  );
}
