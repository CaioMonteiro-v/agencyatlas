import { useEffect, useState } from 'react';
import { api } from '../api';
import { EmptyState, Toast } from './Ui';

const emptyContent = {
  title: '',
  bitly_url: '',
  destination_url: '',
  clicks: '',
  views: '',
  notes: '',
};

const emptyChannel = {
  channel_type: 'grupo',
  channel_name: '',
  members_count: '',
  sent_at: '',
  notes: '',
};

function fmt(n) {
  return Number(n || 0).toLocaleString('pt-BR');
}

export default function MobilizedContentsPanel({ campaignSlug }) {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [toast, setToast] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyContent);
  const [channelForms, setChannelForms] = useState({});
  const [metricsEdit, setMetricsEdit] = useState({});

  async function load() {
    const res = await api.getMobilized(campaignSlug);
    setItems(res.items || []);
    setSummary(res.summary || null);
  }

  useEffect(() => {
    load().catch((err) => setToast(err.message));
  }, [campaignSlug]);

  async function onCreate(e) {
    e.preventDefault();
    try {
      await api.createMobilized(campaignSlug, {
        ...form,
        clicks: Number(form.clicks) || 0,
        views: Number(form.views) || 0,
      });
      setForm(emptyContent);
      setShowForm(false);
      setToast('Conteúdo mobilizado registrado');
      await load();
    } catch (err) {
      setToast(err.message);
    }
  }

  async function saveMetrics(item) {
    const draft = metricsEdit[item.id] || {};
    try {
      await api.updateMobilized(campaignSlug, item.id, {
        clicks: draft.clicks !== undefined ? Number(draft.clicks) || 0 : item.clicks,
        views: draft.views !== undefined ? Number(draft.views) || 0 : item.views,
      });
      setToast('Métricas atualizadas (cliques / visualizações)');
      await load();
    } catch (err) {
      setToast(err.message);
    }
  }

  async function addChannel(item, e) {
    e.preventDefault();
    const draft = channelForms[item.id] || emptyChannel;
    try {
      await api.addMobilizedChannel(campaignSlug, item.id, {
        ...draft,
        members_count: Number(draft.members_count) || 0,
      });
      setChannelForms((prev) => ({ ...prev, [item.id]: { ...emptyChannel } }));
      setToast('Grupo/canal adicionado');
      await load();
    } catch (err) {
      setToast(err.message);
    }
  }

  async function removeChannel(item, channel) {
    try {
      await api.deleteMobilizedChannel(campaignSlug, item.id, channel.id);
      setToast('Grupo/canal removido');
      await load();
    } catch (err) {
      setToast(err.message);
    }
  }

  async function removeContent(item) {
    try {
      await api.deleteMobilized(campaignSlug, item.id);
      setToast('Conteúdo removido');
      await load();
    } catch (err) {
      setToast(err.message);
    }
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      setToast('Link Bitly copiado');
    } catch {
      setToast(text);
    }
    setTimeout(() => setToast(''), 2200);
  }

  function setChannelField(itemId, key, value) {
    setChannelForms((prev) => ({
      ...prev,
      [itemId]: { ...(prev[itemId] || emptyChannel), [key]: value },
    }));
  }

  return (
    <section className="panel panel-pad">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <p className="eyebrow">Disparo</p>
          <h3>Conteúdos mobilizados</h3>
          <p>
            Registre o link Bitly de cada conteúdo, os grupos/canais onde foi enviado e a
            quantidade de pessoas em cada um. Atualize cliques e visualizações pela análise do Bitly.
          </p>
        </div>
        <button type="button" className="btn btn-accent btn-sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Fechar' : 'Novo conteúdo'}
        </button>
      </div>

      {summary && (
        <div className="mobilized-summary" style={{ marginTop: '1rem' }}>
          <div>
            <strong>{fmt(summary.contents)}</strong>
            <span>conteúdos</span>
          </div>
          <div>
            <strong>{fmt(summary.channels)}</strong>
            <span>grupos/canais</span>
          </div>
          <div>
            <strong>{fmt(summary.audience)}</strong>
            <span>pessoas alcançáveis</span>
          </div>
          <div>
            <strong>{fmt(summary.clicks)}</strong>
            <span>cliques Bitly</span>
          </div>
          <div>
            <strong>{fmt(summary.views)}</strong>
            <span>visualizações</span>
          </div>
          <div>
            <strong>{summary.watch_rate_pct != null ? `${summary.watch_rate_pct}%` : '—'}</strong>
            <span>taxa s/ audiência</span>
          </div>
        </div>
      )}

      {showForm && (
        <form className="form-grid" style={{ marginTop: '1rem' }} onSubmit={onCreate}>
          <label>
            Título do conteúdo *
            <input
              className="input"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Ex.: Vídeo Fala Fábio — semana 12"
            />
          </label>
          <label>
            Link Bitly *
            <input
              className="input"
              required
              value={form.bitly_url}
              onChange={(e) => setForm({ ...form, bitly_url: e.target.value })}
              placeholder="https://bit.ly/..."
            />
          </label>
          <label>
            Destino (opcional)
            <input
              className="input"
              value={form.destination_url}
              onChange={(e) => setForm({ ...form, destination_url: e.target.value })}
              placeholder="URL completa do vídeo/post"
            />
          </label>
          <label>
            Cliques Bitly
            <input
              className="input"
              type="number"
              min="0"
              value={form.clicks}
              onChange={(e) => setForm({ ...form, clicks: e.target.value })}
            />
          </label>
          <label>
            Visualizações / assistiram
            <input
              className="input"
              type="number"
              min="0"
              value={form.views}
              onChange={(e) => setForm({ ...form, views: e.target.value })}
            />
          </label>
          <label>
            Observações
            <input
              className="input"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>
          <button className="btn btn-primary" type="submit">Salvar conteúdo</button>
        </form>
      )}

      <div className="stack" style={{ marginTop: '1.1rem' }}>
        {items.map((item) => {
          const chForm = channelForms[item.id] || emptyChannel;
          const mDraft = metricsEdit[item.id] || {
            clicks: item.clicks ?? 0,
            views: item.views ?? 0,
          };
          return (
            <article className="mission-card" key={item.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div>
                  <h4 style={{ marginBottom: 4 }}>{item.title}</h4>
                  <p style={{ marginBottom: 0 }}>
                    <a href={item.bitly_url} target="_blank" rel="noreferrer">
                      {item.bitly_url}
                    </a>
                  </p>
                  {item.destination_url ? (
                    <p style={{ marginBottom: 0, color: 'var(--muted)', fontSize: '0.9rem' }}>
                      Destino: {item.destination_url}
                    </p>
                  ) : null}
                  <p style={{ marginBottom: 0, color: 'var(--muted)' }}>
                    {fmt(item.totals.channels)} grupo(s)/canal(is) ·{' '}
                    {fmt(item.totals.audience)} pessoas ·{' '}
                    {fmt(item.totals.clicks)} cliques ·{' '}
                    {fmt(item.totals.views)} assistiram
                    {item.totals.watch_rate_pct != null
                      ? ` · ${item.totals.watch_rate_pct}% da audiência`
                      : ''}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-accent btn-sm" onClick={() => copy(item.bitly_url)}>
                    Copiar Bitly
                  </button>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => removeContent(item)}>
                    Remover
                  </button>
                </div>
              </div>

              <div className="form-grid" style={{ marginTop: '0.85rem', alignItems: 'end' }}>
                <label>
                  Atualizar cliques
                  <input
                    className="input"
                    type="number"
                    min="0"
                    value={mDraft.clicks}
                    onChange={(e) =>
                      setMetricsEdit((prev) => ({
                        ...prev,
                        [item.id]: { ...mDraft, clicks: e.target.value },
                      }))
                    }
                  />
                </label>
                <label>
                  Atualizar visualizações
                  <input
                    className="input"
                    type="number"
                    min="0"
                    value={mDraft.views}
                    onChange={(e) =>
                      setMetricsEdit((prev) => ({
                        ...prev,
                        [item.id]: { ...mDraft, views: e.target.value },
                      }))
                    }
                  />
                </label>
                <button type="button" className="btn btn-soft btn-sm" onClick={() => saveMetrics(item)}>
                  Salvar métricas
                </button>
              </div>

              <div style={{ marginTop: '1rem' }}>
                <p className="eyebrow" style={{ marginBottom: '0.45rem' }}>Grupos e canais enviados</p>
                {item.channels?.length ? (
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Tipo</th>
                          <th>Nome</th>
                          <th>Pessoas</th>
                          <th>Enviado em</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {item.channels.map((ch) => (
                          <tr key={ch.id}>
                            <td>{ch.channel_type === 'canal' ? 'Canal' : 'Grupo'}</td>
                            <td>{ch.channel_name}</td>
                            <td>{fmt(ch.members_count)}</td>
                            <td>{ch.sent_at || '—'}</td>
                            <td>
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => removeChannel(item, ch)}
                              >
                                Remover
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p style={{ color: 'var(--muted)', margin: '0 0 0.6rem' }}>
                    Nenhum grupo/canal cadastrado neste conteúdo.
                  </p>
                )}

                <form className="form-grid" style={{ marginTop: '0.65rem' }} onSubmit={(e) => addChannel(item, e)}>
                  <label>
                    Tipo
                    <select
                      className="input"
                      value={chForm.channel_type}
                      onChange={(e) => setChannelField(item.id, 'channel_type', e.target.value)}
                    >
                      <option value="grupo">Grupo</option>
                      <option value="canal">Canal</option>
                    </select>
                  </label>
                  <label>
                    Nome *
                    <input
                      className="input"
                      required
                      value={chForm.channel_name}
                      onChange={(e) => setChannelField(item.id, 'channel_name', e.target.value)}
                      placeholder="Ex.: Grupo Cuiabá Centro"
                    />
                  </label>
                  <label>
                    Qtde. de pessoas *
                    <input
                      className="input"
                      type="number"
                      min="0"
                      required
                      value={chForm.members_count}
                      onChange={(e) => setChannelField(item.id, 'members_count', e.target.value)}
                    />
                  </label>
                  <label>
                    Data do envio
                    <input
                      className="input"
                      type="date"
                      value={chForm.sent_at}
                      onChange={(e) => setChannelField(item.id, 'sent_at', e.target.value)}
                    />
                  </label>
                  <button className="btn btn-primary btn-sm" type="submit">
                    Adicionar grupo/canal
                  </button>
                </form>
              </div>
            </article>
          );
        })}
      </div>

      {!items.length && (
        <EmptyState>
          Nenhum conteúdo mobilizado ainda. Cadastre o Bitly e os grupos onde foi disparado.
        </EmptyState>
      )}
      <Toast message={toast} onClose={() => setToast('')} />
    </section>
  );
}
