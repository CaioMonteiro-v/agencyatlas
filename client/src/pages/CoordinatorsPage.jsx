import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { api } from '../api';
import CoordinatorLeadersPanel from '../components/CoordinatorLeadersPanel';
import { Avatar, EmptyState, Toast } from '../components/Ui';

function HealthPill({ health }) {
  if (!health) return null;
  return (
    <span className={`health-pill health-pill--${health.status}`}>
      {health.label}
    </span>
  );
}

function AlarmBanner({ alarms }) {
  if (!alarms?.length) return null;
  return (
    <div className="alarm-stack">
      {alarms.map((a, idx) => (
        <div key={`${a.type}-${idx}`} className={`alarm-banner alarm-banner--${a.severity}`}>
          <strong>{a.severity === 'critical' ? 'Alarme' : 'Atenção'}</strong>
          <span>{a.message}</span>
        </div>
      ))}
    </div>
  );
}

export default function CoordinatorsPage() {
  const { campaign } = useOutletContext();
  const [data, setData] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [toast, setToast] = useState('');
  const [editingMuni, setEditingMuni] = useState(null);
  const [metricsForm, setMetricsForm] = useState({
    vote_expectation: 0,
    content_views_expected: 0,
    content_views_actual: 0,
    ig_comments: 0,
    ig_reach: 0,
  });
  const [syncing, setSyncing] = useState(false);

  async function load() {
    const res = await api.getCoordinators(campaign.slug);
    setData(res);
    setSelectedId((prev) => {
      if (prev && res.coordinators.some((c) => c.id === prev)) return prev;
      return res.coordinators[0]?.id ?? null;
    });
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [campaign.slug]);

  const selected = useMemo(
    () => data?.coordinators?.find((c) => c.id === selectedId) || null,
    [data, selectedId],
  );

  const visibleCoordinators = useMemo(() => {
    const list = data?.coordinators || [];
    if (typeFilter === 'all') return list;
    return list.filter((c) => (c.coord_type || 'regional') === typeFilter);
  }, [data, typeFilter]);

  useEffect(() => {
    if (!visibleCoordinators.length) {
      setSelectedId(null);
      return;
    }
    if (!visibleCoordinators.some((c) => c.id === selectedId)) {
      setSelectedId(visibleCoordinators[0].id);
    }
  }, [visibleCoordinators, selectedId]);

  const filteredMunicipalities = useMemo(() => {
    if (!selected) return [];
    if (filter === 'all') return selected.municipalities;
    if (filter === 'fail') {
      return selected.municipalities.filter((m) => m.alarm_level === 'critical');
    }
    if (filter === 'attention') {
      return selected.municipalities.filter((m) => m.alarm_level === 'attention');
    }
    if (filter === 'alarms') {
      return selected.municipalities.filter((m) => m.alarms?.length);
    }
    return selected.municipalities.filter(
      (m) => m.alarm_level === 'ok' || m.alarm_level === 'good',
    );
  }, [selected, filter]);

  function openMetrics(m) {
    setEditingMuni(m.id);
    setMetricsForm({
      vote_expectation: m.vote_expectation || 0,
      content_views_expected: m.content_views_expected || 0,
      content_views_actual: m.content_views_actual || 0,
      ig_comments: m.ig_comments || 0,
      ig_reach: m.ig_reach || 0,
    });
  }

  async function saveMetrics(e) {
    e.preventDefault();
    if (!selected || !editingMuni) return;
    try {
      const updated = await api.updateCoordinatorMunicipalityMetrics(
        campaign.slug,
        selected.id,
        editingMuni,
        metricsForm,
      );
      setData((prev) => ({
        ...prev,
        coordinators: prev.coordinators.map((c) => (c.id === updated.id ? updated : c)),
      }));
      setEditingMuni(null);
      setToast('Metas e métricas atualizadas');
      await load();
    } catch (err) {
      setToast(err.message);
    }
  }

  async function syncMeta() {
    setSyncing(true);
    try {
      const res = await api.syncMeta(campaign.slug);
      const comments = res.totals?.comments ?? res.ig_account?.totals?.comments;
      setToast(
        comments != null
          ? `Instagram sincronizado · ${comments} comentários na conta · ${res.municipalities_updated} municípios (estimativa)`
          : `Instagram sincronizado · ${res.municipalities_updated} municípios atualizados`,
      );
      await load();
    } catch (err) {
      setToast(err.message);
    } finally {
      setSyncing(false);
    }
  }

  if (error) {
    return (
      <div className="container section" style={{ paddingTop: 0 }}>
        <EmptyState>{error}</EmptyState>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container section" style={{ paddingTop: 0 }}>
        <EmptyState>Carregando coordenadores…</EmptyState>
      </div>
    );
  }

  return (
    <div className="container section" style={{ paddingTop: 0 }}>
      <div className="section__head">
        <p className="eyebrow">Coordenação territorial</p>
        <h2>Coordenadores</h2>
        <p>
          Aqui entram os <strong>regionais</strong> e também os de <strong>dobra</strong> (ex.: grupos em Cuiabá).
          Regionais acompanham expectativa de voto e comunicação por município; dobra serve para controle
          dos grupos de mobilização.
        </p>
        <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap', marginTop: '0.55rem' }}>
          <Link className="btn btn-soft btn-sm" to={`/campanha/${campaign.slug}/relatorio`}>
            Abrir Relatório
          </Link>
          <Link className="btn btn-soft btn-sm" to={`/campanha/${campaign.slug}/grupos`}>
            Grupos Dobra
          </Link>
          <Link className="btn btn-soft btn-sm" to="/admin">
            Cadastrar / editar
          </Link>
          <button className="btn btn-accent btn-sm" type="button" disabled={syncing} onClick={syncMeta}>
            {syncing ? 'Sincronizando…' : 'Sincronizar Instagram (Meta)'}
          </button>
        </div>
        {data.meta && (
          <p className="meta-hint">
            Meta API:{' '}
            <strong>
              {data.meta.token_ok === false
                ? 'token expirado/inválido'
                : (data.meta.mode === 'live' ? 'conectada' : 'modo manual')}
            </strong>
            {' — '}
            {data.meta.hint}
          </p>
        )}
      </div>

      {data.ig_account?.totals && (
        <section className="panel panel-pad" style={{ marginBottom: '1rem' }}>
          <p className="eyebrow">Conta Instagram (real)</p>
          <h3 style={{ marginTop: 0 }}>Não confundir com o número por município</h3>
          <p style={{ color: 'var(--muted)' }}>{data.ig_account.note}</p>
          <div className="stats-row">
            <div className="stat">
              <strong>{data.ig_account.totals.followers ?? data.meta?.followers_count ?? '—'}</strong>
              <span>Seguidores</span>
            </div>
            <div className="stat">
              <strong>{data.ig_account.totals.comments ?? 0}</strong>
              <span>Comentários (posts)</span>
            </div>
            <div className="stat">
              <strong>{data.ig_account.totals.likes ?? 0}</strong>
              <span>Likes</span>
            </div>
            <div className="stat">
              <strong>{data.ig_account.totals.reach ?? 0}</strong>
              <span>Reach</span>
            </div>
            <div className="stat">
              <strong>{data.ig_account.totals.saved ?? 0}</strong>
              <span>Salvos</span>
            </div>
            <div className="stat">
              <strong>
                {data.ig_account.last_sync_at
                  ? new Date(data.ig_account.last_sync_at).toLocaleString('pt-BR')
                  : '—'}
              </strong>
              <span>Última sync</span>
            </div>
          </div>
          {data.ig_account.engagement && (
            <p style={{ marginTop: '0.75rem', color: data.ig_account.engagement.tone === 'down' ? '#8a5a64' : 'var(--muted)' }}>
              {data.ig_account.engagement.label}
            </p>
          )}
          {data.meta?.token_ok === false && (
            <p style={{ marginTop: '0.5rem', color: '#8a5a64' }}>
              Token Meta: {data.meta.token_error || 'inválido/expirado'}
            </p>
          )}
        </section>
      )}

      <div className="stats-row" style={{ marginBottom: '1.25rem' }}>
        <div className="stat">
          <strong>{data.summary.total}</strong>
          <span>Coordenadores</span>
        </div>
        <div className="stat">
          <strong>{data.summary.regional ?? data.coordinators.filter((c) => (c.coord_type || 'regional') === 'regional').length}</strong>
          <span>Regionais</span>
        </div>
        <div className="stat">
          <strong>{data.summary.dobra ?? data.coordinators.filter((c) => c.coord_type === 'dobra').length}</strong>
          <span>Dobra</span>
        </div>
        <div className="stat">
          <strong>{data.summary.municipalities_assigned}</strong>
          <span>Municípios</span>
        </div>
        <div className="stat">
          <strong>
            {data.summary.vote_progress_pct != null ? `${data.summary.vote_progress_pct}%` : '—'}
          </strong>
          <span>Norte eleitoral (voto)</span>
        </div>
        <div className="stat">
          <strong className={data.summary.alarms > 0 ? 'stat-alarm' : undefined}>
            {data.summary.alarms || 0}
          </strong>
          <span>Alarmes ativos</span>
        </div>
      </div>

      {!data.coordinators.length ? (
        <section className="panel panel-pad">
          <EmptyState>
            Nenhum coordenador cadastrado ainda. Cadastre em{' '}
            <a href="/admin">/admin</a> e defina expectativa de voto + meta de conteúdo.
          </EmptyState>
        </section>
      ) : (
        <div className="coord-layout">
          <aside className="panel panel-pad coord-list">
            <p className="eyebrow">Equipe</p>
            <h3 style={{ marginTop: 0 }}>Coordenadores</h3>
            <div className="chip-group" style={{ marginBottom: '0.75rem' }}>
              {[
                { id: 'all', label: 'Todos' },
                { id: 'regional', label: 'Regionais' },
                { id: 'dobra', label: 'Dobra' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`chip ${typeFilter === opt.id ? 'active' : ''}`}
                  onClick={() => setTypeFilter(opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="coord-cards">
              {visibleCoordinators.map((coord) => (
                <button
                  key={coord.id}
                  type="button"
                  className={`coord-card ${selectedId === coord.id ? 'is-active' : ''} ${
                    coord.totals.alarms > 0 ? 'has-alarm' : ''
                  }`}
                  onClick={() => {
                    setSelectedId(coord.id);
                    setFilter('all');
                    setEditingMuni(null);
                  }}
                >
                  <Avatar name={coord.name} photo={coord.photo_url} size={44} />
                  <div className="coord-card__body">
                    <strong>
                      {coord.name}
                      {coord.totals.alarms > 0 && <span className="alarm-dot" title="Há alarmes" />}
                    </strong>
                    <span className={`coord-type-pill coord-type-pill--${coord.coord_type === 'dobra' ? 'dobra' : 'regional'}`}>
                      {coord.coord_type === 'dobra' ? 'Dobra' : 'Regional'}
                    </span>
                    <span>
                      {coord.totals.municipalities} mun.
                      {' · '}
                      {coord.totals.registrations} cad.
                      {coord.totals.vote_expectation
                        ? ` · meta voto ${coord.totals.vote_progress_pct ?? 0}%`
                        : ''}
                    </span>
                    <HealthPill health={coord.health} />
                  </div>
                </button>
              ))}
              {!visibleCoordinators.length ? (
                <EmptyState>
                  Nenhum coordenador {typeFilter === 'dobra' ? 'de dobra' : typeFilter === 'regional' ? 'regional' : ''} aqui.
                  Cadastre em <a href="/admin">/admin</a>.
                </EmptyState>
              ) : null}
            </div>
          </aside>

          <section className="panel panel-pad coord-detail">
            {!selected ? (
              <EmptyState>Selecione um coordenador</EmptyState>
            ) : (
              <>
                <div className="coord-detail__head">
                  <div style={{ display: 'flex', gap: '0.9rem', alignItems: 'center' }}>
                    <Avatar name={selected.name} photo={selected.photo_url} size={56} />
                    <div>
                      <p className="eyebrow" style={{ marginBottom: 4 }}>
                        {selected.coord_type === 'dobra' ? 'Coordenador de dobra' : 'Painel do coordenador regional'}
                      </p>
                      <h3 style={{ margin: 0 }}>
                        {selected.name}
                        <span className={`coord-type-pill coord-type-pill--${selected.coord_type === 'dobra' ? 'dobra' : 'regional'}`}>
                          {selected.coord_type === 'dobra' ? 'Dobra' : 'Regional'}
                        </span>
                      </h3>
                      {selected.phone && <p style={{ margin: '0.2rem 0 0' }}>{selected.phone}</p>}
                    </div>
                  </div>
                  <HealthPill health={selected.health} />
                </div>

                <p style={{ marginTop: '0.85rem' }}>{selected.health.detail}</p>

                <div className="coord-mini-stats">
                  <div>
                    <strong>{selected.totals.municipalities}</strong>
                    <span>Municípios</span>
                  </div>
                  <div>
                    <strong>{selected.totals.leaders || 0}</strong>
                    <span>Lideranças</span>
                  </div>
                  <div>
                    <strong>{selected.totals.people_by_leaders || 0}</strong>
                    <span>Mobilizadas (lideranças)</span>
                  </div>
                  <div>
                    <strong>{selected.totals.registrations}</strong>
                    <span>Cadastros no território</span>
                  </div>
                </div>

                <CoordinatorLeadersPanel
                  campaignSlug={campaign.slug}
                  coordinatorName={selected.name}
                  leaders={selected.leaders || []}
                />

                <div className="coord-mini-stats" style={{ marginTop: '0.85rem' }}>
                  <div>
                    <strong>{selected.totals.vote_expectation || 0}</strong>
                    <span>Meta de votos</span>
                  </div>
                  <div>
                    <strong>
                      {selected.totals.vote_expectation
                        ? `${selected.totals.vote_progress_pct ?? 0}%`
                        : '—'}
                    </strong>
                    <span>Expectativa voto</span>
                  </div>
                  <div>
                    <strong>{selected.totals.content_views_actual}/{selected.totals.content_views_expected || 0}</strong>
                    <span>Views conteúdo</span>
                  </div>
                  <div>
                    <strong>
                      {selected.totals.content_views_expected
                        ? `${selected.totals.content_progress_pct ?? 0}%`
                        : '—'}
                    </strong>
                    <span>Conteúdo visto</span>
                  </div>
                </div>

                <div className="coord-mini-stats" style={{ marginTop: 0 }}>
                  <div>
                    <strong>{selected.totals.ig_comments || 0}</strong>
                    <span>Comentários IG</span>
                  </div>
                  <div>
                    <strong>{selected.totals.ig_reach || 0}</strong>
                    <span>Reach IG</span>
                  </div>
                  <div>
                    <strong className={selected.totals.alarms ? 'stat-alarm' : undefined}>
                      {selected.totals.alarms}
                    </strong>
                    <span>Alarmes</span>
                  </div>
                </div>

                <div className="coord-filters">
                  <button type="button" className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-soft'}`} onClick={() => setFilter('all')}>Todos</button>
                  <button type="button" className={`btn btn-sm ${filter === 'alarms' ? 'btn-primary' : 'btn-soft'}`} onClick={() => setFilter('alarms')}>Com alarme</button>
                  <button type="button" className={`btn btn-sm ${filter === 'ok' ? 'btn-primary' : 'btn-soft'}`} onClick={() => setFilter('ok')}>Tranquilos</button>
                  <button type="button" className={`btn btn-sm ${filter === 'attention' ? 'btn-primary' : 'btn-soft'}`} onClick={() => setFilter('attention')}>Atenção</button>
                  <button type="button" className={`btn btn-sm ${filter === 'fail' ? 'btn-primary' : 'btn-soft'}`} onClick={() => setFilter('fail')}>Crítico</button>
                </div>

                {!selected.municipalities.length ? (
                  <EmptyState>Este coordenador ainda não tem municípios. Vincule em /admin.</EmptyState>
                ) : !filteredMunicipalities.length ? (
                  <EmptyState>Nenhum município neste filtro.</EmptyState>
                ) : (
                  <div className="muni-health-list">
                    {filteredMunicipalities.map((m) => (
                      <article key={m.id} className={`muni-health muni-health--${m.alarm_level || m.health.status}`}>
                        <div className="muni-health__top">
                          <div>
                            <strong>
                              {m.name}
                              {m.alarms?.length > 0 && <span className="alarm-dot" />}
                            </strong>
                            <p>{m.health.detail}</p>
                          </div>
                          <HealthPill health={{ status: m.alarm_level || m.health.status, label: m.health.label }} />
                        </div>

                        <AlarmBanner alarms={m.alarms} />

                        <div className="muni-health__meta">
                          <span>{m.registrations_count} cadastros</span>
                          <span>{m.leaders_count} lideranças</span>
                          <span>{m.share_pct}% da coordenação</span>
                          <span>Voto: {m.vote_progress_pct != null ? `${m.vote_progress_pct}%` : 'sem meta'}</span>
                          <span>Conteúdo: {m.content_progress_pct != null ? `${m.content_progress_pct}%` : 'sem meta'}</span>
                          <span>IG: {m.ig_comments} coment. · {m.ig_reach} reach</span>
                        </div>

                        <div className="progress-bar" aria-hidden="true">
                          <span style={{ width: `${Math.min(100, m.content_progress_pct || m.share_pct || 0)}%` }} />
                        </div>

                        {editingMuni === m.id ? (
                          <form className="metrics-form" onSubmit={saveMetrics}>
                            <label>
                              Expectativa de voto (norte)
                              <input
                                className="input"
                                type="number"
                                min="0"
                                value={metricsForm.vote_expectation}
                                onChange={(e) => setMetricsForm({ ...metricsForm, vote_expectation: Number(e.target.value) })}
                              />
                            </label>
                            <label>
                              Meta de views (comunicação)
                              <input
                                className="input"
                                type="number"
                                min="0"
                                value={metricsForm.content_views_expected}
                                onChange={(e) => setMetricsForm({ ...metricsForm, content_views_expected: Number(e.target.value) })}
                              />
                            </label>
                            <label>
                              Views reais (comunicação)
                              <input
                                className="input"
                                type="number"
                                min="0"
                                value={metricsForm.content_views_actual}
                                onChange={(e) => setMetricsForm({ ...metricsForm, content_views_actual: Number(e.target.value) })}
                              />
                            </label>
                            <label>
                              Comentários IG
                              <input
                                className="input"
                                type="number"
                                min="0"
                                value={metricsForm.ig_comments}
                                onChange={(e) => setMetricsForm({ ...metricsForm, ig_comments: Number(e.target.value) })}
                              />
                            </label>
                            <label>
                              Reach IG
                              <input
                                className="input"
                                type="number"
                                min="0"
                                value={metricsForm.ig_reach}
                                onChange={(e) => setMetricsForm({ ...metricsForm, ig_reach: Number(e.target.value) })}
                              />
                            </label>
                            <div style={{ display: 'flex', gap: '0.45rem', gridColumn: '1 / -1' }}>
                              <button className="btn btn-primary btn-sm" type="submit">Salvar metas</button>
                              <button className="btn btn-soft btn-sm" type="button" onClick={() => setEditingMuni(null)}>Cancelar</button>
                            </div>
                          </form>
                        ) : (
                          <button className="btn btn-soft btn-sm" type="button" style={{ marginTop: '0.65rem' }} onClick={() => openMetrics(m)}>
                            Editar expectativa / conteúdo / IG
                          </button>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}
      <Toast message={toast} onClose={() => setToast('')} />
    </div>
  );
}
