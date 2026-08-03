import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { api } from '../api';
import { EmptyState, Toast } from '../components/Ui';

function HealthPill({ health }) {
  if (!health) return null;
  return (
    <span className={`health-pill health-pill--${health.status}`}>
      {health.label}
    </span>
  );
}

export default function ContentPage() {
  const { campaign } = useOutletContext();
  const [data, setData] = useState(null);
  const [coordinators, setCoordinators] = useState([]);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [form, setForm] = useState({
    title: '',
    caption: '',
    permalink: '',
    posted_at: new Date().toISOString().slice(0, 10),
    assign_all_for_coordinator_id: '',
    default_target_views: 500,
  });
  const [assignForms, setAssignForms] = useState({});
  const [editForms, setEditForms] = useState({});

  async function load() {
    const [week, coords] = await Promise.all([
      api.getContent(campaign.slug),
      api.getCoordinators(campaign.slug).catch(() => ({ coordinators: [] })),
    ]);
    setData(week);
    setCoordinators(coords.coordinators || []);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [campaign.slug]);

  const selectedCoordMunnis = useMemo(() => {
    const id = Number(form.assign_all_for_coordinator_id);
    if (!id) return [];
    return coordinators.find((c) => c.id === id)?.municipalities || [];
  }, [form.assign_all_for_coordinator_id, coordinators]);

  async function onCreate(e) {
    e.preventDefault();
    try {
      await api.createContent(campaign.slug, {
        title: form.title,
        caption: form.caption,
        permalink: form.permalink,
        posted_at: form.posted_at,
        assign_all_for_coordinator_id: form.assign_all_for_coordinator_id
          ? Number(form.assign_all_for_coordinator_id)
          : null,
        default_target_views: Number(form.default_target_views) || 500,
      });
      setShowForm(false);
      setForm({
        title: '',
        caption: '',
        permalink: '',
        posted_at: new Date().toISOString().slice(0, 10),
        assign_all_for_coordinator_id: '',
        default_target_views: 500,
      });
      setToast('Conteúdo da semana cadastrado');
      await load();
    } catch (err) {
      setToast(err.message);
    }
  }

  async function addAssignment(postId, e) {
    e.preventDefault();
    const f = assignForms[postId] || {};
    if (!f.coordinator_id) {
      setToast('Selecione o coordenador');
      return;
    }
    try {
      await api.createContentAssignment(campaign.slug, postId, {
        coordinator_id: Number(f.coordinator_id),
        municipality_id: f.municipality_id ? Number(f.municipality_id) : null,
        target_views: Number(f.target_views) || 0,
        notes: f.notes || '',
      });
      setAssignForms((prev) => ({ ...prev, [postId]: { coordinator_id: '', municipality_id: '', target_views: 500, notes: '' } }));
      setToast('Cobrança territorial adicionada');
      await load();
    } catch (err) {
      setToast(err.message);
    }
  }

  async function saveAssignment(postId, assignmentId, e) {
    e.preventDefault();
    const f = editForms[assignmentId];
    if (!f) return;
    try {
      await api.updateContentAssignment(campaign.slug, postId, assignmentId, {
        actual_views: Number(f.actual_views) || 0,
        actual_comments: Number(f.actual_comments) || 0,
        status: f.status,
        notes: f.notes,
      });
      setToast('Resultado atualizado');
      setEditForms((prev) => {
        const next = { ...prev };
        delete next[assignmentId];
        return next;
      });
      await load();
    } catch (err) {
      setToast(err.message);
    }
  }

  async function removePost(id) {
    try {
      await api.deleteContent(campaign.slug, id);
      setToast('Conteúdo removido');
      await load();
    } catch (err) {
      setToast(err.message);
    }
  }

  async function syncMeta() {
    setSyncing(true);
    try {
      const res = await api.syncMeta(campaign.slug);
      setToast(`Instagram sync: ${res.content_posts || 0} posts · ${res.municipalities_updated || 0} municípios`);
      await load();
    } catch (err) {
      setToast(err.message || 'API Meta ainda não conectada — use cadastro manual');
    } finally {
      setSyncing(false);
    }
  }

  function munisForCoord(coordId) {
    return coordinators.find((c) => String(c.id) === String(coordId))?.municipalities || [];
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
        <EmptyState>Carregando conteúdo da semana…</EmptyState>
      </div>
    );
  }

  return (
    <div className="container section" style={{ paddingTop: 0 }}>
      <div className="section__head">
        <p className="eyebrow">Comunicação com dono</p>
        <h2>Conteúdo da semana</h2>
        <p>
          Cadastre o post, escolha quem deve dobrar em quais cidades e acompanhe se virou resultado.
          Funciona <strong>sem API do Instagram</strong> — a Meta só automatiza os números depois.
        </p>
        <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Fechar' : 'Novo conteúdo'}
          </button>
          <button type="button" className="btn btn-accent btn-sm" disabled={syncing} onClick={syncMeta}>
            {syncing ? 'Sincronizando…' : 'Sincronizar Instagram (opcional)'}
          </button>
          <Link className="btn btn-soft btn-sm" to={`/campanha/${campaign.slug}/coordenadores`}>
            Ver coordenadores
          </Link>
        </div>
        {data.meta && (
          <p className="meta-hint" style={{ marginTop: '0.75rem' }}>
            Meta API: <strong>{data.meta.mode === 'live' ? 'conectada' : 'modo manual'}</strong>
            {' · '}
            {data.meta.hint}
          </p>
        )}
      </div>

      <div className="radar-stats" style={{ marginBottom: '1.1rem' }}>
        <article>
          <strong>{data.summary.posts}</strong>
          <span>Conteúdos</span>
        </article>
        <article>
          <strong>{data.summary.critical}</strong>
          <span>Alarmes críticos</span>
        </article>
        <article>
          <strong>{data.summary.actual_views}/{data.summary.target_views || 0}</strong>
          <span>Views cobradas</span>
        </article>
      </div>

      {!!data.alarms?.length && (
        <section className="panel panel-pad" style={{ marginBottom: '1rem' }}>
          <h3 style={{ marginTop: 0 }}>Cobrança agora</h3>
          <div className="alarm-stack">
            {data.alarms.slice(0, 12).map((a) => (
              <div key={`${a.assignment_id}-${a.severity}`} className={`alarm-banner alarm-banner--${a.severity}`}>
                <strong>{a.content_title}</strong>
                <span>{a.message}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {showForm && (
        <form className="panel panel-pad form-grid" style={{ marginBottom: '1rem' }} onSubmit={onCreate}>
          <h3 style={{ marginTop: 0 }}>Novo conteúdo para cobrar</h3>
          <label>
            Título *
            <input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Reel visita Água Boa" />
          </label>
          <label>
            Link do post (Instagram / Reels)
            <input className="input" value={form.permalink} onChange={(e) => setForm({ ...form, permalink: e.target.value })} placeholder="https://instagram.com/p/..." />
          </label>
          <label>
            Legenda / briefing
            <textarea className="textarea" value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} placeholder="O que a equipe deve dobrar e com que mensagem" />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <label>
              Data
              <input className="input" type="date" value={form.posted_at} onChange={(e) => setForm({ ...form, posted_at: e.target.value })} />
            </label>
            <label>
              Meta padrão de views por município
              <input className="input" type="number" min="0" value={form.default_target_views} onChange={(e) => setForm({ ...form, default_target_views: e.target.value })} />
            </label>
          </div>
          <label>
            Já cobrar todos os municípios deste coordenador
            <select
              className="select"
              value={form.assign_all_for_coordinator_id}
              onChange={(e) => setForm({ ...form, assign_all_for_coordinator_id: e.target.value })}
            >
              <option value="">Depois eu atribuo</option>
              {coordinators.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.totals.municipalities} mun.)</option>
              ))}
            </select>
          </label>
          {!!selectedCoordMunnis.length && (
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.9rem' }}>
              Vai criar {selectedCoordMunnis.length} cobrança(s): {selectedCoordMunnis.map((m) => m.name).slice(0, 6).join(', ')}
              {selectedCoordMunnis.length > 6 ? '…' : ''}.
            </p>
          )}
          <button className="btn btn-primary" type="submit">Salvar conteúdo</button>
        </form>
      )}

      <div className="stack">
        {data.posts.map((post) => {
          const af = assignForms[post.id] || { coordinator_id: '', municipality_id: '', target_views: 500, notes: '' };
          return (
            <article className="panel panel-pad content-card" key={post.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div>
                  <p className="eyebrow">{post.source === 'meta' ? 'Via Instagram' : 'Manual'} · {post.posted_at || '—'}</p>
                  <h3 style={{ marginBottom: 4 }}>{post.title}</h3>
                  <p style={{ marginBottom: 0 }}>{post.caption || 'Sem briefing'}</p>
                  {post.permalink && (
                    <p style={{ marginBottom: 0 }}>
                      <a href={post.permalink} target="_blank" rel="noreferrer">Abrir post</a>
                    </p>
                  )}
                  <p style={{ marginBottom: 0, color: 'var(--muted)' }}>
                    {post.totals.assignments} cobrança(s) · {post.totals.actual_views}/{post.totals.target_views} views · {post.totals.critical} crítico(s)
                  </p>
                </div>
                <button type="button" className="btn btn-danger btn-sm" onClick={() => removePost(post.id)}>Remover</button>
              </div>

              <div className="stack" style={{ marginTop: '0.9rem' }}>
                {post.assignments.map((a) => {
                  const editing = editForms[a.id];
                  return (
                    <div className="content-assignment" key={a.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <div>
                          <strong>{a.coordinator_name || 'Sem coordenador'}</strong>
                          <span style={{ color: 'var(--muted)' }}>
                            {' · '}{a.municipality_name || 'Geral'}
                          </span>
                          <div style={{ marginTop: 4 }}>
                            <HealthPill health={a.health} />
                            <span style={{ marginLeft: 8, fontSize: '0.9rem' }}>
                              {a.actual_views}/{a.target_views} views
                              {a.progress_pct != null ? ` (${a.progress_pct}%)` : ''}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-soft btn-sm"
                          onClick={() => setEditForms((prev) => ({
                            ...prev,
                            [a.id]: {
                              actual_views: a.actual_views || 0,
                              actual_comments: a.actual_comments || 0,
                              status: a.status || 'pendente',
                              notes: a.notes || '',
                            },
                          }))}
                        >
                          Atualizar resultado
                        </button>
                      </div>
                      {editing && (
                        <form className="form-grid" style={{ marginTop: '0.75rem' }} onSubmit={(e) => saveAssignment(post.id, a.id, e)}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.6rem' }}>
                            <label>
                              Views reais
                              <input className="input" type="number" min="0" value={editing.actual_views} onChange={(e) => setEditForms((prev) => ({ ...prev, [a.id]: { ...editing, actual_views: e.target.value } }))} />
                            </label>
                            <label>
                              Comentários
                              <input className="input" type="number" min="0" value={editing.actual_comments} onChange={(e) => setEditForms((prev) => ({ ...prev, [a.id]: { ...editing, actual_comments: e.target.value } }))} />
                            </label>
                            <label>
                              Status
                              <select className="select" value={editing.status} onChange={(e) => setEditForms((prev) => ({ ...prev, [a.id]: { ...editing, status: e.target.value } }))}>
                                <option value="pendente">Pendente</option>
                                <option value="em_andamento">Em andamento</option>
                                <option value="feito">Feito</option>
                                <option value="falhou">Falhou</option>
                              </select>
                            </label>
                          </div>
                          <label>
                            Nota de cobrança
                            <input className="input" value={editing.notes} onChange={(e) => setEditForms((prev) => ({ ...prev, [a.id]: { ...editing, notes: e.target.value } }))} />
                          </label>
                          <button className="btn btn-primary btn-sm" type="submit">Salvar</button>
                        </form>
                      )}
                    </div>
                  );
                })}
              </div>

              <form className="form-grid" style={{ marginTop: '0.9rem' }} onSubmit={(e) => addAssignment(post.id, e)}>
                <strong>Nova cobrança neste conteúdo</strong>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.6rem' }}>
                  <label>
                    Coordenador
                    <select
                      className="select"
                      required
                      value={af.coordinator_id}
                      onChange={(e) => setAssignForms((prev) => ({
                        ...prev,
                        [post.id]: { ...af, coordinator_id: e.target.value, municipality_id: '' },
                      }))}
                    >
                      <option value="">Selecione</option>
                      {coordinators.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Município
                    <select
                      className="select"
                      value={af.municipality_id}
                      onChange={(e) => setAssignForms((prev) => ({
                        ...prev,
                        [post.id]: { ...af, municipality_id: e.target.value },
                      }))}
                    >
                      <option value="">Geral do coordenador</option>
                      {munisForCoord(af.coordinator_id).map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Meta de views
                    <input
                      className="input"
                      type="number"
                      min="0"
                      value={af.target_views}
                      onChange={(e) => setAssignForms((prev) => ({
                        ...prev,
                        [post.id]: { ...af, target_views: e.target.value },
                      }))}
                    />
                  </label>
                </div>
                <button className="btn btn-soft btn-sm" type="submit">Adicionar cobrança</button>
              </form>
            </article>
          );
        })}
      </div>

      {!data.posts.length && (
        <EmptyState>
          Nenhum conteúdo na semana ainda. Cadastre o post e atribua municípios para cobrar a dobra.
        </EmptyState>
      )}

      <Toast message={toast} onClose={() => setToast('')} />
    </div>
  );
}
