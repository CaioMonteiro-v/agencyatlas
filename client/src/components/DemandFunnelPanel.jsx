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

export default function DemandFunnelPanel({ campaignSlug }) {
  const [tree, setTree] = useState([]);
  const [summary, setSummary] = useState(null);
  const [coordinator, setCoordinator] = useState(null);
  const [municipality, setMunicipality] = useState(null);
  const [demands, setDemands] = useState([]);
  const [toast, setToast] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
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

  async function loadDemands(coordId, muniId) {
    const res = await api.getDemands(campaignSlug, {
      coordinator_id: coordId,
      municipality_id: muniId,
    });
    setDemands(res.items || []);
  }

  useEffect(() => {
    loadTree().catch((err) => setToast(err.message));
  }, [campaignSlug]);

  function openCoordinator(coord) {
    setCoordinator(coord);
    setMunicipality(null);
    setDemands([]);
    setShowForm(false);
  }

  async function openMunicipality(muni) {
    setMunicipality(muni);
    setShowForm(false);
    try {
      await loadDemands(coordinator.id, muni.id);
    } catch (err) {
      setToast(err.message);
    }
  }

  function backToCoordinators() {
    setCoordinator(null);
    setMunicipality(null);
    setDemands([]);
    setShowForm(false);
    loadTree().catch((err) => setToast(err.message));
  }

  function backToMunicipalities() {
    setMunicipality(null);
    setDemands([]);
    setShowForm(false);
    loadTree().catch((err) => setToast(err.message));
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
      await loadDemands(coordinator.id, municipality.id);
      await loadTree();
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
      setToast('Demanda marcada como resolvida');
      await loadDemands(coordinator.id, municipality.id);
      await loadTree();
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
      setToast('Demanda mantida em standby');
      await loadDemands(coordinator.id, municipality.id);
      await loadTree();
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
      setToast('Demanda reaberta em standby');
      await loadDemands(coordinator.id, municipality.id);
      await loadTree();
    } catch (err) {
      setToast(err.message);
    }
  }

  async function removeDemand(demand) {
    if (!window.confirm('Remover esta demanda do funil?')) return;
    try {
      await api.deleteDemand(campaignSlug, demand.id);
      setToast('Demanda removida');
      await loadDemands(coordinator.id, municipality.id);
      await loadTree();
    } catch (err) {
      setToast(err.message);
    }
  }

  return (
    <section className="panel panel-pad demand-funnel">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <p className="eyebrow">Funil territorial</p>
          <h3 style={{ marginTop: 0 }}>Demandas por coordenador</h3>
          <p>
            Clique no coordenador → município → registre o que houve (texto, data, prints).
            Resolvido vai para OK; se não, fica em standby com o motivo.
          </p>
        </div>
        {summary && (
          <div className="demand-summary">
            <div><strong>{summary.standby}</strong><span>standby</span></div>
            <div><strong>{summary.resolvido}</strong><span>resolvidas</span></div>
            <div><strong>{summary.total}</strong><span>total</span></div>
          </div>
        )}
      </div>

      <div className="demand-breadcrumb">
        <button type="button" className="chip" onClick={backToCoordinators}>
          Coordenadores
        </button>
        {coordinator && (
          <>
            <span>/</span>
            <button type="button" className="chip active" onClick={backToMunicipalities}>
              {coordinator.name}
            </button>
          </>
        )}
        {municipality && (
          <>
            <span>/</span>
            <span className="chip active">{municipality.name}</span>
          </>
        )}
      </div>

      {!coordinator && (
        <div className="demand-grid" style={{ marginTop: '1rem' }}>
          {tree.map((coord) => (
            <button
              key={coord.id}
              type="button"
              className="demand-card-btn"
              onClick={() => openCoordinator(coord)}
            >
              <strong>{coord.name}</strong>
              <span>{coord.municipalities.length} município(s)</span>
              <span className="demand-card-btn__stats">
                {coord.demands_standby} standby · {coord.demands_resolvido} ok
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

      {coordinator && !municipality && (
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
                {muni.demands_standby} standby · {muni.demands_resolvido} ok
              </span>
            </button>
          ))}
          {!coordinator.municipalities.length && (
            <EmptyState>Este coordenador ainda não tem municípios vinculados.</EmptyState>
          )}
        </div>
      )}

      {coordinator && municipality && (
        <div style={{ marginTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div>
              <h4 style={{ margin: 0 }}>
                Funil · {municipality.name}
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
              {showForm ? 'Fechar' : 'Nova demanda (Para)'}
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
                O que houve *
                <textarea
                  className="textarea"
                  required
                  rows={5}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Escreva a demanda como um 'para': contexto, o que pediram, o que aconteceu…"
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
                Prints / prints de WhatsApp
                <input
                  className="input"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => setForm({ ...form, files: e.target.files })}
                />
              </label>
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? 'Salvando…' : 'Registrar no funil'}
              </button>
            </form>
          )}

          <div className="stack" style={{ marginTop: '1.1rem' }}>
            {demands.map((demand) => (
              <article
                key={demand.id}
                className={`mission-card demand-item demand-item--${demand.status}`}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <div>
                    <span className={`badge badge--${demand.status === 'resolvido' ? 'ok' : 'warn'}`}>
                      {demand.status === 'resolvido' ? 'Resolvido' : 'Standby'}
                    </span>
                    <h4 style={{ margin: '0.45rem 0 0.2rem' }}>
                      {demand.title || 'Demanda sem título'}
                    </h4>
                    <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.88rem' }}>
                      {demand.occurred_at
                        ? new Date(`${demand.occurred_at}T00:00:00`).toLocaleDateString('pt-BR')
                        : '—'}
                      {demand.created_by ? ` · por ${demand.created_by}` : ''}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
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
                          Atualizar standby
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
                        <img src={att.url} alt={att.original_name || 'Print WhatsApp'} />
                      </a>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>

          {!demands.length && (
            <EmptyState>
              Nenhuma demanda neste município ainda. Registre a primeira com “Nova demanda (Para)”.
            </EmptyState>
          )}
        </div>
      )}

      <Toast message={toast} onClose={() => setToast('')} />
    </section>
  );
}
