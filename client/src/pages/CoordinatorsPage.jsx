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
  const [municipalities, setMunicipalities] = useState([]);
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
  const [showForm, setShowForm] = useState(false);
  const [editingCoordId, setEditingCoordId] = useState(null);
  const [muniSearch, setMuniSearch] = useState('');
  const [busySave, setBusySave] = useState(false);
  const [coordForm, setCoordForm] = useState({
    name: '',
    phone: '',
    coord_type: 'regional',
    municipality_ids: [],
  });

  async function load() {
    const [res, munis] = await Promise.all([
      api.getCoordinators(campaign.slug),
      api.getMunicipalities().catch(() => []),
    ]);
    setData(res);
    setMunicipalities(Array.isArray(munis) ? munis : []);
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

  const filteredMuniOptions = useMemo(() => {
    const q = muniSearch.trim().toLowerCase();
    if (!q) return municipalities;
    return municipalities.filter((m) => String(m.name || '').toLowerCase().includes(q));
  }, [municipalities, muniSearch]);

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

  function resetCoordForm() {
    setEditingCoordId(null);
    setCoordForm({
      name: '',
      phone: '',
      coord_type: 'regional',
      municipality_ids: [],
    });
    setMuniSearch('');
  }

  function openCreateForm() {
    resetCoordForm();
    setShowForm(true);
  }

  function startEditCoordinator(coord) {
    setEditingCoordId(coord.id);
    setCoordForm({
      name: coord.name || '',
      phone: coord.phone || '',
      coord_type: coord.coord_type === 'dobra' ? 'dobra' : 'regional',
      municipality_ids: (coord.municipalities || []).map((m) => m.id),
    });
    setShowForm(true);
  }

  function toggleMuni(id) {
    setCoordForm((prev) => {
      const has = prev.municipality_ids.includes(id);
      return {
        ...prev,
        municipality_ids: has
          ? prev.municipality_ids.filter((x) => x !== id)
          : [...prev.municipality_ids, id],
      };
    });
  }

  async function saveCoordinator(e) {
    e.preventDefault();
    if (!coordForm.name.trim()) {
      setToast('Informe o nome do coordenador');
      return;
    }
    setBusySave(true);
    try {
      const payload = {
        name: coordForm.name.trim(),
        phone: coordForm.phone,
        coord_type: coordForm.coord_type === 'dobra' ? 'dobra' : 'regional',
        municipality_ids: coordForm.municipality_ids,
      };
      let saved;
      if (editingCoordId) {
        saved = await api.updateCoordinator(campaign.slug, editingCoordId, payload);
        setToast('Coordenador atualizado');
      } else {
        saved = await api.createCoordinator(campaign.slug, payload);
        setToast(
          payload.coord_type === 'dobra'
            ? 'Coordenador de dobra cadastrado'
            : 'Coordenador cadastrado',
        );
      }
      resetCoordForm();
      setShowForm(false);
      await load();
      if (saved?.id) setSelectedId(saved.id);
    } catch (err) {
      setToast(err.message);
    } finally {
      setBusySave(false);
    }
  }

  async function removeCoordinator(coord) {
    if (!window.confirm(`Remover o coordenador "${coord.name}"?`)) return;
    try {
      await api.deleteCoordinator(campaign.slug, coord.id);
      setToast(`Coordenador ${coord.name} removido`);
      if (editingCoordId === coord.id) {
        resetCoordForm();
        setShowForm(false);
      }
      await load();
    } catch (err) {
      setToast(err.message);
    }
  }

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
          Cadastre aqui os vários coordenadores (regionais e de dobra), vincule municípios
          e acompanhe as lideranças de cada um. Não precisa passar pelo Admin.
        </p>
        <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap', marginTop: '0.55rem' }}>
          <button className="btn btn-primary btn-sm" type="button" onClick={openCreateForm}>
            Novo coordenador
          </button>
          <Link className="btn btn-soft btn-sm" to={`/campanha/${campaign.slug}/relatorio`}>
            Abrir Relatório
          </Link>
          <Link className="btn btn-soft btn-sm" to={`/campanha/${campaign.slug}/grupos`}>
            Grupos Dobra
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

      {showForm && (
        <section className="panel panel-pad" style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div>
              <p className="eyebrow">{editingCoordId ? 'Editar' : 'Novo'}</p>
              <h3 style={{ marginTop: 0 }}>
                {editingCoordId ? 'Atualizar coordenador' : 'Cadastrar coordenador'}
              </h3>
              <p style={{ margin: 0 }}>
                Dá para cadastrar vários. Depois use no QR de evento e no controle de lideranças.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-soft btn-sm"
              onClick={() => {
                setShowForm(false);
                resetCoordForm();
              }}
            >
              Fechar
            </button>
          </div>

          <form className="form-grid" style={{ marginTop: '1rem' }} onSubmit={saveCoordinator}>
            <label>
              Tipo
              <select
                className="select"
                value={coordForm.coord_type}
                onChange={(e) => setCoordForm({ ...coordForm, coord_type: e.target.value })}
              >
                <option value="regional">Regional (território)</option>
                <option value="dobra">Dobra (grupos)</option>
              </select>
            </label>
            <label>
              Nome do coordenador *
              <input
                className="input"
                required
                value={coordForm.name}
                onChange={(e) => setCoordForm({ ...coordForm, name: e.target.value })}
                placeholder="Ex.: Nome do coordenador"
              />
            </label>
            <label>
              Telefone
              <input
                className="input"
                value={coordForm.phone}
                onChange={(e) => setCoordForm({ ...coordForm, phone: e.target.value })}
                placeholder="Opcional"
              />
            </label>

            <div>
              <label style={{ display: 'block', marginBottom: '0.45rem' }}>
                Municípios ({coordForm.municipality_ids.length} selecionados)
              </label>
              <input
                className="input"
                value={muniSearch}
                onChange={(e) => setMuniSearch(e.target.value)}
                placeholder="Buscar município…"
                style={{ marginBottom: '0.55rem' }}
              />
              <div className="muni-check-grid">
                {filteredMuniOptions.map((m) => {
                  const checked = coordForm.municipality_ids.includes(m.id);
                  return (
                    <label key={m.id} className={`muni-check ${checked ? 'is-checked' : ''}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleMuni(m.id)}
                      />
                      <span>{m.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" type="submit" disabled={busySave}>
                {busySave
                  ? 'Salvando…'
                  : editingCoordId
                    ? 'Salvar alterações'
                    : 'Cadastrar coordenador'}
              </button>
              {editingCoordId ? (
                <button
                  className="btn btn-soft"
                  type="button"
                  onClick={() => {
                    resetCoordForm();
                    setShowForm(true);
                  }}
                >
                  Limpar / novo
                </button>
              ) : null}
            </div>
          </form>
        </section>
      )}

      {!data.coordinators.length ? (
        <section className="panel panel-pad">
          <EmptyState>
            Nenhum coordenador cadastrado ainda.{' '}
            <button type="button" className="btn btn-primary btn-sm" onClick={openCreateForm}>
              Cadastrar o primeiro
            </button>
          </EmptyState>
        </section>
      ) : (
        <div className="coord-layout">
          <aside className="panel panel-pad coord-list">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <p className="eyebrow">Equipe</p>
                <h3 style={{ marginTop: 0 }}>Coordenadores</h3>
              </div>
              <button type="button" className="btn btn-accent btn-sm" onClick={openCreateForm}>
                Novo
              </button>
            </div>
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
                  Use <strong>Novo</strong> para cadastrar.
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
                  <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <HealthPill health={selected.health} />
                    <button
                      type="button"
                      className="btn btn-soft btn-sm"
                      onClick={() => startEditCoordinator(selected)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => removeCoordinator(selected)}
                    >
                      Remover
                    </button>
                  </div>
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
