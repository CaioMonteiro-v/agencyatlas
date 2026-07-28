import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../api';
import { Avatar, EmptyState } from '../components/Ui';

function HealthPill({ health }) {
  if (!health) return null;
  return (
    <span className={`health-pill health-pill--${health.status}`}>
      {health.label}
    </span>
  );
}

export default function CoordinatorsPage() {
  const { campaign } = useOutletContext();
  const [data, setData] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

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

  const filteredMunicipalities = useMemo(() => {
    if (!selected) return [];
    if (filter === 'all') return selected.municipalities;
    if (filter === 'fail') {
      return selected.municipalities.filter((m) => m.health.status === 'critical');
    }
    if (filter === 'attention') {
      return selected.municipalities.filter((m) => m.health.status === 'attention');
    }
    return selected.municipalities.filter(
      (m) => m.health.status === 'ok' || m.health.status === 'good',
    );
  }, [selected, filter]);

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
          Clique em um coordenador para ver os municípios, a proporção de cadastros
          e se a recepção está tranquila ou com falha.
        </p>
      </div>

      <div className="stats-row" style={{ marginBottom: '1.25rem' }}>
        <div className="stat">
          <strong>{data.summary.total}</strong>
          <span>Coordenadores</span>
        </div>
        <div className="stat">
          <strong>{data.summary.municipalities_assigned}</strong>
          <span>Municípios vinculados</span>
        </div>
        <div className="stat">
          <strong>{data.summary.registrations}</strong>
          <span>Cadastros na coordenação</span>
        </div>
        <div className="stat">
          <strong>{data.summary.with_failures}</strong>
          <span>Com falhas</span>
        </div>
      </div>

      {!data.coordinators.length ? (
        <section className="panel panel-pad">
          <EmptyState>
            Nenhum coordenador cadastrado ainda. Cadastre em{' '}
            <a href="/admin">/admin</a> (ex.: Ogeda, Jurandir, Barbara) e vincule os municípios.
          </EmptyState>
        </section>
      ) : (
        <div className="coord-layout">
          <aside className="panel panel-pad coord-list">
            <p className="eyebrow">Equipe</p>
            <h3 style={{ marginTop: 0 }}>Coordenadores</h3>
            <div className="coord-cards">
              {data.coordinators.map((coord) => (
                <button
                  key={coord.id}
                  type="button"
                  className={`coord-card ${selectedId === coord.id ? 'is-active' : ''}`}
                  onClick={() => {
                    setSelectedId(coord.id);
                    setFilter('all');
                  }}
                >
                  <Avatar name={coord.name} photo={coord.photo_url} size={44} />
                  <div className="coord-card__body">
                    <strong>{coord.name}</strong>
                    <span>
                      {coord.totals.municipalities} município{coord.totals.municipalities === 1 ? '' : 's'}
                      {' · '}
                      {coord.totals.registrations} cadastro{coord.totals.registrations === 1 ? '' : 's'}
                    </span>
                    <HealthPill health={coord.health} />
                  </div>
                </button>
              ))}
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
                      <p className="eyebrow" style={{ marginBottom: 4 }}>Painel do coordenador</p>
                      <h3 style={{ margin: 0 }}>{selected.name}</h3>
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
                    <strong>{selected.totals.registrations}</strong>
                    <span>Cadastros</span>
                  </div>
                  <div>
                    <strong>{selected.totals.leaders}</strong>
                    <span>Lideranças</span>
                  </div>
                  <div>
                    <strong>{selected.totals.critical}</strong>
                    <span>Em falha</span>
                  </div>
                </div>

                <div className="coord-filters">
                  <button
                    type="button"
                    className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-soft'}`}
                    onClick={() => setFilter('all')}
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${filter === 'ok' ? 'btn-primary' : 'btn-soft'}`}
                    onClick={() => setFilter('ok')}
                  >
                    Tranquilos
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${filter === 'attention' ? 'btn-primary' : 'btn-soft'}`}
                    onClick={() => setFilter('attention')}
                  >
                    Atenção
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${filter === 'fail' ? 'btn-primary' : 'btn-soft'}`}
                    onClick={() => setFilter('fail')}
                  >
                    Com falha
                  </button>
                </div>

                {!selected.municipalities.length ? (
                  <EmptyState>
                    Este coordenador ainda não tem municípios. Vincule em /admin.
                  </EmptyState>
                ) : !filteredMunicipalities.length ? (
                  <EmptyState>Nenhum município neste filtro.</EmptyState>
                ) : (
                  <div className="muni-health-list">
                    {filteredMunicipalities.map((m) => (
                      <article key={m.id} className={`muni-health muni-health--${m.health.status}`}>
                        <div className="muni-health__top">
                          <div>
                            <strong>{m.name}</strong>
                            <p>{m.health.detail}</p>
                          </div>
                          <HealthPill health={m.health} />
                        </div>

                        <div className="muni-health__meta">
                          <span>{m.registrations_count} cadastros</span>
                          <span>{m.leaders_count} lideranças</span>
                          <span>{m.share_pct}% da coordenação</span>
                        </div>

                        <div className="progress-bar" aria-hidden="true">
                          <span style={{ width: `${Math.min(100, m.share_pct || 0)}%` }} />
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
