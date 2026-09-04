import { useEffect, useState } from 'react';
import { api } from '../api';
import { EmptyState, Toast } from './Ui';

function today() {
  return new Date().toISOString().slice(0, 10);
}

function readFilesAsDataUrls(fileList) {
  const files = Array.from(fileList || []).filter((f) => f.type.startsWith('image/'));
  return Promise.all(
    files.map(
      (file) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve({ name: file.name, data_url: reader.result });
          reader.onerror = () => reject(new Error(`Falha ao ler ${file.name}`));
          reader.readAsDataURL(file);
        }),
    ),
  );
}

function formatDemandDate(value) {
  if (!value) return '—';
  return new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR');
}

function listTitle(filter) {
  if (filter === 'standby') return 'Tudo em aberto';
  if (filter === 'resolvido') return 'Tudo resolvido';
  return 'Todos os registros';
}

export default function DemandFunnelPanel({ campaignSlug }) {
  const [tree, setTree] = useState([]);
  const [summary, setSummary] = useState(null);
  const [storageInfo, setStorageInfo] = useState(null);
  const [coordinator, setCoordinator] = useState(null);
  const [municipality, setMunicipality] = useState(null);
  const [listFilter, setListFilter] = useState(null);
  const [demands, setDemands] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [toast, setToast] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [addingPrintsId, setAddingPrintsId] = useState(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    occurred_at: today(),
    unresolved_reason: '',
    files: [],
  });

  async function loadTree() {
    const res = await api.getDemandTree(campaignSlug);
    const coords = res.coordinators || [];
    setTree(coords);
    setSummary(res.summary || null);
    setCoordinator((prevCoord) => {
      if (!prevCoord) return null;
      const fresh = coords.find((c) => c.id === prevCoord.id);
      if (!fresh) return prevCoord;
      setMunicipality((prevMuni) => {
        if (!prevMuni) return null;
        return fresh.municipalities.find((m) => m.id === prevMuni.id) || prevMuni;
      });
      return fresh;
    });
  }

  async function loadStorageStatus() {
    try {
      const health = await api.getHealth();
      setStorageInfo(health.storage || null);
    } catch {
      setStorageInfo(null);
    }
  }

  async function loadDemandsForMunicipality(coordId, muniId) {
    const res = await api.getDemands(campaignSlug, {
      coordinator_id: coordId,
      municipality_id: muniId,
    });
    setDemands(res.items || []);
  }

  async function loadDemandsByFilter(filter) {
    setLoadingList(true);
    try {
      const res = await api.getDemands(campaignSlug, {
        status: filter === 'all' ? undefined : filter,
      });
      setDemands(res.items || []);
      if (res.summary) setSummary(res.summary);
    } finally {
      setLoadingList(false);
    }
  }

  async function refreshCurrentView() {
    await loadTree();
    if (listFilter) {
      await loadDemandsByFilter(listFilter);
    } else if (coordinator && municipality) {
      await loadDemandsForMunicipality(coordinator.id, municipality.id);
    }
  }

  useEffect(() => {
    loadTree().catch((err) => setToast(err.message));
    loadStorageStatus();
  }, [campaignSlug]);

  function openCoordinator(coord) {
    setListFilter(null);
    setCoordinator(coord);
    setMunicipality(null);
    setDemands([]);
    setShowForm(false);
  }

  async function openMunicipality(muni) {
    setListFilter(null);
    setMunicipality(muni);
    setShowForm(false);
    try {
      await loadDemandsForMunicipality(coordinator.id, muni.id);
    } catch (err) {
      setToast(err.message);
    }
  }

  function backToCoordinators() {
    setListFilter(null);
    setCoordinator(null);
    setMunicipality(null);
    setDemands([]);
    setShowForm(false);
    loadTree().catch((err) => setToast(err.message));
  }

  function backToMunicipalities() {
    setListFilter(null);
    setMunicipality(null);
    setDemands([]);
    setShowForm(false);
    loadTree().catch((err) => setToast(err.message));
  }

  async function openSummaryList(filter) {
    setListFilter(filter);
    setCoordinator(null);
    setMunicipality(null);
    setShowForm(false);
    setDemands([]);
    try {
      await loadDemandsByFilter(filter);
    } catch (err) {
      setToast(err.message);
    }
  }

  async function onCreate(e) {
    e.preventDefault();
    if (!form.description.trim()) {
      setToast('Descreva o que houve');
      return;
    }
    setBusy(true);
    try {
      const attachments = await readFilesAsDataUrls(form.files);
      await api.createDemand(campaignSlug, {
        coordinator_id: coordinator.id,
        municipality_id: municipality.id,
        title: form.title.trim() || null,
        description: form.description.trim(),
        occurred_at: form.occurred_at || today(),
        unresolved_reason: form.unresolved_reason.trim() || null,
        attachments,
      });
      setForm({
        title: '',
        description: '',
        occurred_at: today(),
        unresolved_reason: '',
        files: [],
      });
      setShowForm(false);
      setToast('Demanda registrada no funil');
      await refreshCurrentView();
    } catch (err) {
      setToast(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function markResolved(demand) {
    const notes = window.prompt('Observação da resolução (opcional):', demand.resolution_notes || '') ?? null;
    if (notes === null) return;
    try {
      await api.updateDemand(campaignSlug, demand.id, {
        status: 'resolvido',
        resolution_notes: notes,
        unresolved_reason: null,
      });
      setToast('Marcado como resolvido');
      await refreshCurrentView();
    } catch (err) {
      setToast(err.message);
    }
  }

  async function keepStandby(demand) {
    const reason = window.prompt(
      'Por que ainda não foi resolvido?',
      demand.unresolved_reason || '',
    );
    if (reason === null) return;
    if (!String(reason).trim()) {
      setToast('Informe o motivo de ainda não estar resolvido');
      return;
    }
    try {
      await api.updateDemand(campaignSlug, demand.id, {
        status: 'standby',
        unresolved_reason: String(reason).trim(),
      });
      setToast('Mantido em aberto');
      await refreshCurrentView();
    } catch (err) {
      setToast(err.message);
    }
  }

  async function reopen(demand) {
    try {
      await api.updateDemand(campaignSlug, demand.id, {
        status: 'standby',
        unresolved_reason: demand.unresolved_reason || 'Reaberta — aguardando situação',
      });
      setToast('Reaberto — ainda em aberto');
      await refreshCurrentView();
    } catch (err) {
      setToast(err.message);
    }
  }

  async function removeDemand(demand) {
    if (!window.confirm('Remover este registro?')) return;
    try {
      await api.deleteDemand(campaignSlug, demand.id);
      setToast('Registro removido');
      await refreshCurrentView();
    } catch (err) {
      setToast(err.message);
    }
  }

  async function addPrints(demand, fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setAddingPrintsId(demand.id);
    try {
      const attachments = await readFilesAsDataUrls(files);
      await api.updateDemand(campaignSlug, demand.id, {
        add_attachments: attachments,
      });
      setToast('Prints adicionados ao relatório');
      await refreshCurrentView();
    } catch (err) {
      setToast(err.message);
    } finally {
      setAddingPrintsId(null);
    }
  }

  function renderDemandCard(demand, { showPlace = false } = {}) {
    return (
      <article
        key={demand.id}
        className={`mission-card demand-item demand-item--${demand.status}`}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div>
            <span className={`badge badge--${demand.status === 'resolvido' ? 'ok' : 'warn'}`}>
              {demand.status === 'resolvido' ? 'Resolvido' : 'Em aberto'}
            </span>
            <h4 style={{ margin: '0.45rem 0 0.2rem' }}>
              {demand.title || 'Sem título'}
            </h4>
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.88rem' }}>
              {formatDemandDate(demand.occurred_at)}
              {demand.created_by ? ` · por ${demand.created_by}` : ''}
            </p>
            {showPlace && (
              <p style={{ margin: '0.25rem 0 0', color: 'var(--muted)', fontSize: '0.88rem' }}>
                {demand.coordinator_name || 'Coordenador'} · {demand.municipality_name || 'Município'}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {demand.status !== 'resolvido' ? (
              <>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => markResolved(demand)}
                >
                  OK · Resolvido
                </button>
                <button
                  type="button"
                  className="btn btn-soft btn-sm"
                  onClick={() => keepStandby(demand)}
                >
                  Atualizar motivo
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn btn-soft btn-sm"
                onClick={() => reopen(demand)}
              >
                Reabrir
              </button>
            )}
            <label className="btn btn-soft btn-sm" style={{ margin: 0, cursor: addingPrintsId === demand.id ? 'wait' : 'pointer' }}>
              {addingPrintsId === demand.id ? 'Enviando…' : 'Reenviar prints'}
              <input
                type="file"
                accept="image/*"
                multiple
                hidden
                disabled={addingPrintsId === demand.id}
                onChange={(e) => {
                  addPrints(demand, e.target.files);
                  e.target.value = '';
                }}
              />
            </label>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => removeDemand(demand)}
            >
              Remover
            </button>
          </div>
        </div>

        <p style={{ whiteSpace: 'pre-wrap', marginTop: '0.75rem' }}>{demand.description}</p>

        {demand.status === 'standby' && demand.unresolved_reason ? (
          <p className="demand-reason">
            <strong>Por que não resolveu:</strong> {demand.unresolved_reason}
          </p>
        ) : null}

        {demand.status === 'resolvido' && demand.resolution_notes ? (
          <p className="demand-reason demand-reason--ok">
            <strong>Resolução:</strong> {demand.resolution_notes}
          </p>
        ) : null}

        {demand.attachments?.length ? (
          <div className="demand-prints">
            {demand.attachments.map((att) => (
              <a
                key={att.url}
                href={att.url}
                target="_blank"
                rel="noreferrer"
                className="demand-print"
                title={att.original_name || 'Print'}
              >
                <img
                  src={att.url}
                  alt={att.original_name || 'Print WhatsApp'}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const fallback = e.currentTarget.nextElementSibling;
                    if (fallback) fallback.hidden = false;
                  }}
                />
                <span className="demand-print__missing" hidden>
                  Print indisponível — use “Reenviar prints”
                </span>
              </a>
            ))}
          </div>
        ) : null}
      </article>
    );
  }

  const showingList = Boolean(listFilter);
  const showingMunicipality = Boolean(coordinator && municipality && !listFilter);
  const showingMunicipalities = Boolean(coordinator && !municipality && !listFilter);
  const showingCoordinators = !coordinator && !listFilter;

  return (
    <section className="panel panel-pad demand-funnel">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <p className="eyebrow">Por cidade</p>
          <h3 style={{ marginTop: 0 }}>Anote o que aconteceu</h3>
          <p>
            Clique no coordenador → cidade → registre o que houve (texto, data e prints do WhatsApp).
            Ou use os números à direita para ver tudo <strong>em aberto</strong>,{' '}
            <strong>resolvido</strong> ou o <strong>total</strong>.
          </p>
        </div>
        {summary && (
          <div className="demand-summary" role="group" aria-label="Filtros dos registros">
            <button
              type="button"
              className={`demand-summary__btn ${listFilter === 'standby' ? 'is-active' : ''}`}
              onClick={() => openSummaryList('standby')}
            >
              <strong>{summary.standby}</strong>
              <span>em aberto</span>
            </button>
            <button
              type="button"
              className={`demand-summary__btn ${listFilter === 'resolvido' ? 'is-active' : ''}`}
              onClick={() => openSummaryList('resolvido')}
            >
              <strong>{summary.resolvido}</strong>
              <span>resolvidos</span>
            </button>
            <button
              type="button"
              className={`demand-summary__btn ${listFilter === 'all' ? 'is-active' : ''}`}
              onClick={() => openSummaryList('all')}
            >
              <strong>{summary.total}</strong>
              <span>total</span>
            </button>
          </div>
        )}
      </div>

      {storageInfo && storageInfo.provider !== 'supabase' && (
        <div className="demand-storage-warn" role="status">
          As fotos dos prints podem sumir se o armazenamento de imagens não estiver configurado.
          O texto do registro continua salvo. Peça à equipe técnica para conferir o Storage no servidor.
        </div>
      )}

      <div className="demand-breadcrumb">
        <button type="button" className={`chip ${showingCoordinators ? 'active' : ''}`} onClick={backToCoordinators}>
          Coordenadores
        </button>
        {showingList && (
          <>
            <span>/</span>
            <span className="chip active">{listTitle(listFilter)}</span>
          </>
        )}
        {coordinator && !showingList && (
          <>
            <span>/</span>
            <button type="button" className="chip active" onClick={backToMunicipalities}>
              {coordinator.name}
            </button>
          </>
        )}
        {municipality && !showingList && (
          <>
            <span>/</span>
            <span className="chip active">{municipality.name}</span>
          </>
        )}
      </div>

      {showingList && (
        <div style={{ marginTop: '1rem' }}>
          <h4 style={{ margin: '0 0 0.75rem' }}>{listTitle(listFilter)}</h4>
          {loadingList ? (
            <EmptyState>Carregando relatórios…</EmptyState>
          ) : (
            <>
              <div className="stack">
                {demands.map((demand) => renderDemandCard(demand, { showPlace: true }))}
              </div>
              {!demands.length && (
                <EmptyState>
                  {listFilter === 'standby'
                    ? 'Nada em aberto no momento.'
                    : listFilter === 'resolvido'
                      ? 'Nada resolvido ainda.'
                      : 'Nenhum registro ainda.'}
                </EmptyState>
              )}
            </>
          )}
        </div>
      )}

      {showingCoordinators && (
        <div className="demand-grid" style={{ marginTop: '1rem' }}>
          {tree.map((coord) => (
            <button
              key={coord.id}
              type="button"
              className="demand-card-btn"
              onClick={() => openCoordinator(coord)}
            >
              <strong>{coord.name}</strong>
              <span>{coord.municipalities.length} cidade(s)</span>
              <span className="demand-card-btn__stats">
                {coord.demands_standby} em aberto · {coord.demands_resolvido} ok
              </span>
            </button>
          ))}
          {!tree.length && (
            <EmptyState>
              Nenhum coordenador cadastrado. Cadastre em Coordenadores / Admin.
            </EmptyState>
          )}
        </div>
      )}

      {showingMunicipalities && (
        <div className="demand-grid" style={{ marginTop: '1rem' }}>
          {coordinator.municipalities.map((muni) => (
            <button
              key={muni.id}
              type="button"
              className="demand-card-btn"
              onClick={() => openMunicipality(muni)}
            >
              <strong>{muni.name}</strong>
              <span className="demand-card-btn__stats">
                {muni.demands_standby} em aberto · {muni.demands_resolvido} ok
              </span>
            </button>
          ))}
          {!coordinator.municipalities.length && (
            <EmptyState>Este coordenador ainda não tem cidades vinculadas.</EmptyState>
          )}
        </div>
      )}

      {showingMunicipality && (
        <div style={{ marginTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div>
              <h4 style={{ margin: 0 }}>
                {municipality.name}
              </h4>
              <p style={{ margin: '0.25rem 0 0', color: 'var(--muted)' }}>
                Coordenador: {coordinator.name}
              </p>
            </div>
            <button
              type="button"
              className="btn btn-accent btn-sm"
              onClick={() => setShowForm((v) => !v)}
            >
              {showForm ? 'Fechar' : 'Novo registro'}
            </button>
          </div>

          {showForm && (
            <form className="form-grid" style={{ marginTop: '1rem' }} onSubmit={onCreate}>
              <label>
                Título (opcional)
                <input
                  className="input"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Ex.: Impasse no grupo de lideranças"
                />
              </label>
              <label>
                Data
                <input
                  className="input"
                  type="date"
                  required
                  value={form.occurred_at}
                  onChange={(e) => setForm({ ...form, occurred_at: e.target.value })}
                />
              </label>
              <label>
                O que aconteceu *
                <textarea
                  className="textarea"
                  required
                  rows={5}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Contexto, o que pediram, o que aconteceu…"
                />
              </label>
              <label>
                Por que ainda não está resolvido? (se já souber)
                <textarea
                  className="textarea"
                  rows={2}
                  value={form.unresolved_reason}
                  onChange={(e) => setForm({ ...form, unresolved_reason: e.target.value })}
                  placeholder="Ex.: Aguardando retorno do coordenador local"
                />
              </label>
              <label>
                Prints do WhatsApp (fotos)
                <input
                  className="input"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => setForm({ ...form, files: e.target.files })}
                />
              </label>
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? 'Salvando…' : 'Salvar registro'}
              </button>
            </form>
          )}

          <div className="stack" style={{ marginTop: '1.1rem' }}>
            {demands.map((demand) => renderDemandCard(demand))}
          </div>

          {!demands.length && (
            <EmptyState>
              Ainda não há registros nesta cidade. Clique em “Novo registro” para começar.
            </EmptyState>
          )}
        </div>
      )}

      <Toast message={toast} onClose={() => setToast('')} />
    </section>
  );
}
