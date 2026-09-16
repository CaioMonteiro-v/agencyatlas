import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { api } from '../api';
import { EmptyState, Toast } from '../components/Ui';
import DemandFunnelPanel from '../components/DemandFunnelPanel';
import SystemSimpleGuide from '../components/SystemSimpleGuide';

export default function ReportPage() {
  const { campaign } = useOutletContext();
  const [tab, setTab] = useState('guia');
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
      setToast(
        res.source === 'openai'
          ? 'Texto da reunião pronto'
          : 'Resumo pronto (versão simples do Atlas)',
      );
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
      setToast('Texto copiado');
    } catch (_) {
      setToast('Não foi possível copiar automaticamente');
    }
  }

  const s = report?.summary;

  return (
    <div className="container section report-page" style={{ paddingTop: 0 }}>
      <div className="section__head">
        <p className="eyebrow">Relatório do Sistema</p>
        <h2>Entenda a campanha de forma simples</h2>
        <p>
          Comece por <strong>Como funciona</strong> se você não é da área técnica.
          Depois use as outras abas para anotar o que aconteceu nas cidades e ver o panorama geral.
        </p>
        <div className="chip-group" style={{ marginTop: '0.75rem' }}>
          <button
            type="button"
            className={`chip ${tab === 'guia' ? 'active' : ''}`}
            onClick={() => setTab('guia')}
          >
            Como funciona
          </button>
          <button
            type="button"
            className={`chip ${tab === 'funil' ? 'active' : ''}`}
            onClick={() => setTab('funil')}
          >
            O que aconteceu nas cidades
          </button>
          <button
            type="button"
            className={`chip ${tab === 'executivo' ? 'active' : ''}`}
            onClick={() => setTab('executivo')}
          >
            Panorama da campanha
          </button>
        </div>
      </div>

      {tab === 'guia' && <SystemSimpleGuide campaign={campaign} />}

      {tab === 'funil' && <DemandFunnelPanel campaignSlug={campaign.slug} />}

      {tab === 'executivo' && loadingReport && (
        <EmptyState>Carregando os números…</EmptyState>
      )}

      {tab === 'executivo' && !loadingReport && error && (
        <EmptyState>{error}</EmptyState>
      )}

      {tab === 'executivo' && !loadingReport && !error && report && (
        <>
          <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <button className="btn btn-primary btn-sm" type="button" onClick={() => window.print()}>
              Imprimir / salvar em PDF
            </button>
            <button className="btn btn-accent btn-sm" type="button" disabled={loadingAssistant} onClick={generateAssistant}>
              {loadingAssistant ? 'Preparando…' : 'Gerar texto para reunião'}
            </button>
            <Link className="btn btn-soft btn-sm" to={`/campanha/${campaign.slug}/coordenadores`}>
              Ir para Coordenadores
            </Link>
          </div>

          <section className="panel panel-pad report-hero">
            <p className="eyebrow">Resumo em poucas linhas</p>
            <h3 style={{ marginTop: 0 }}>{campaign.candidate || campaign.name}</h3>
            <p className="report-lead">{report.executive_summary}</p>
            <p className="meta-hint">
              Atualizado em {new Date(report.generated_at).toLocaleString('pt-BR')}
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
              <span>Cidades na operação</span>
            </div>
            <div className="stat">
              <strong>{s.vote_progress_pct != null ? `${s.vote_progress_pct}%` : '—'}</strong>
              <span>% da meta de cadastros</span>
            </div>
            <div className="stat">
              <strong className={s.alarms_critical ? 'stat-alarm' : undefined}>
                {s.alarms_critical}/{s.alarms_attention}
              </strong>
              <span>Urgente / Precisa olhar</span>
            </div>
          </div>

          <div className="layout-split">
            <section className="panel panel-pad">
              <p className="eyebrow">Atenção</p>
              <h3 style={{ marginTop: 0 }}>Onde a operação está atrasada</h3>
              {!report.alarms.length ? (
                <EmptyState>Nada urgente no momento.</EmptyState>
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
              <h3 style={{ marginTop: 0 }}>O que priorizar agora</h3>
              <ul className="report-steps">
                {report.next_steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            </section>
          </div>

          <section className="panel panel-pad" style={{ marginTop: '1.1rem' }}>
            <p className="eyebrow">Para ligar</p>
            <h3 style={{ marginTop: 0 }}>Quem precisa de uma conversa</h3>
            {!report.call_sheet.length ? (
              <EmptyState>Nenhum coordenador precisa de ligação agora.</EmptyState>
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
                    <p className="eyebrow" style={{ marginTop: '0.75rem' }}>O que falar na ligação</p>
                    <ul>
                      {row.talking_points.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                    {!!row.municipalities_in_fail?.length && (
                      <>
                        <p className="eyebrow">Cidades</p>
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
                <p className="eyebrow">Ajuda para reunião</p>
                <h3 style={{ marginTop: 0 }}>Texto pronto para falar com a equipe</h3>
                <p>
                  O Atlas junta cadastros, metas e sinais do Instagram e monta um texto
                  simples do que cobrar ou reforçar com cada coordenador.
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
                Clique em <strong>Gerar texto para reunião</strong> para montar o resumo.
              </EmptyState>
            ) : (
              <div className="briefing-box">
                <p className="meta-hint">
                  {briefing.source === 'openai' ? 'Versão elaborada' : 'Versão simples do Atlas'}
                </p>
                <pre>{briefing.text}</pre>
              </div>
            )}
          </section>

          <section className="panel panel-pad" style={{ marginTop: '1.1rem' }}>
            <p className="eyebrow">Por coordenador</p>
            <h3 style={{ marginTop: 0 }}>Números de cada um</h3>
            <div className="report-coord-table-wrap">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Coordenador</th>
                    <th>Cidades</th>
                    <th>Cadastros</th>
                    <th>Meta de voto</th>
                    <th>Conteúdo visto</th>
                    <th>Comentários IG</th>
                    <th>Situação</th>
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
                      <td>{c.totals.ig_comments}</td>
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
