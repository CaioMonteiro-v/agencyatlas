import { useEffect, useState } from 'react';
import { api } from '../api';
import { EmptyState, Toast } from './Ui';

const emptyContent = {
  title: '',
  bitly_url: '',
  destination_url: '',
  clicks: '',
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

function formatWhen(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function Sparkline({ series }) {
  const points = Array.isArray(series) ? series : [];
  if (!points.length) {
    return <div className="bitly-spark bitly-spark--empty">Sem série de cliques ainda</div>;
  }
  const values = points.map((p) => Number(p.clicks) || 0);
  const max = Math.max(...values, 1);
  const w = 280;
  const h = 56;
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const d = values
    .map((v, i) => {
      const x = i * step;
      const y = h - (v / max) * (h - 6) - 3;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div className="bitly-spark" aria-label="Cliques nos últimos dias">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <path d={d} fill="none" stroke="currentColor" strokeWidth="2.5" />
      </svg>
      <div className="bitly-spark__meta">
        <span>Últimos {points.length} dias</span>
        <span>{fmt(values.reduce((s, v) => s + v, 0))} cliques no período</span>
      </div>
    </div>
  );
}

export default function MobilizedContentsPanel({ campaignSlug }) {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [bitly, setBitly] = useState(null);
  const [toast, setToast] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [form, setForm] = useState(emptyContent);
  const [channelForms, setChannelForms] = useState({});
  const [metricsEdit, setMetricsEdit] = useState({});

  async function load() {
    const res = await api.getMobilized(campaignSlug);
    setItems(res.items || []);
    setSummary(res.summary || null);
    setBitly(res.bitly || null);
  }

  useEffect(() => {
    load().catch((err) => setToast(err.message));
  }, [campaignSlug]);

  async function onCreate(e) {
    e.preventDefault();
    try {
      const created = await api.createMobilized(campaignSlug, {
        ...form,
        clicks: Number(form.clicks) || 0,
      });
      setForm(emptyContent);
      setShowForm(false);
      setToast('Conteúdo cadastrado — análise disponível abaixo');
      await load();
      if (bitly?.configured && created?.id) {
        try {
          await api.syncMobilizedOne(campaignSlug, created.id);
          await load();
          setToast('Cliques puxados do Bitly');
        } catch {
          /* manual ok */
        }
      }
    } catch (err) {
      setToast(err.message);
    }
  }

  async function syncAll() {
    setSyncing(true);
    try {
      const res = await api.syncMobilized(campaignSlug);
      setItems(res.items || []);
      setSummary(res.summary || null);
      setBitly(res.bitly || null);
      const ok = (res.sync || []).filter((r) => r.ok).length;
      setToast(`Análise Bitly atualizada · ${ok} link(s)`);
    } catch (err) {
      setToast(err.message);
    } finally {
      setSyncing(false);
    }
  }

  async function syncOne(item) {
    try {
      await api.syncMobilizedOne(campaignSlug, item.id);
      setToast(`Cliques atualizados: ${item.title}`);
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
      });
      setToast('Total de pessoas que clicaram atualizado');
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
      setToast('Grupo/canal adicionado à análise');
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
          <p className="eyebrow">Análise Bitly</p>
          <h3>Conteúdos mobilizados</h3>
          <p>
            A análise do Bitly aqui no painel: quantas pessoas clicaram no link, em quantos
            grupos/canais foi disparado e o total de pessoas nesses grupos.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {bitly?.configured ? (
            <button
              type="button"
              className="btn btn-soft btn-sm"
              disabled={syncing}
              onClick={syncAll}
            >
              {syncing ? 'Sincronizando…' : 'Atualizar do Bitly'}
            </button>
          ) : null}
          <button type="button" className="btn btn-accent btn-sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Fechar' : 'Novo link'}
          </button>
        </div>
      </div>

      {bitly && (
        <p className={`bitly-mode ${bitly.configured ? 'bitly-mode--live' : ''}`}>
          {bitly.configured
            ? 'Modo ao vivo: cliques vêm da API do Bitly.'
            : 'Modo manual: cole o total de cliques do Bitly (ou configure BITLY_ACCESS_TOKEN no Render).'}
        </p>
      )}

      {summary && (
        <div className="bitly-kpis" style={{ marginTop: '1rem' }}>
          <div className="bitly-kpi bitly-kpi--hero">
            <span>Pessoas que clicaram</span>
            <strong>{fmt(summary.people_clicked)}</strong>
            <small>total de cliques nos links Bitly</small>
          </div>
          <div className="bitly-kpi">
            <span>Grupos / canais</span>
            <strong>{fmt(summary.channels)}</strong>
            <small>
              {fmt(summary.groups)} grupos · {fmt(summary.canales)} canais
            </small>
          </div>
          <div className="bitly-kpi">
            <span>Pessoas nos grupos</span>
            <strong>{fmt(summary.audience)}</strong>
            <small>audiência somada dos disparos</small>
          </div>
          <div className="bitly-kpi">
            <span>Taxa de clique</span>
            <strong>{summary.click_rate_pct != null ? `${summary.click_rate_pct}%` : '—'}</strong>
            <small>cliques ÷ pessoas nos grupos</small>
          </div>
          <div className="bitly-kpi">
            <span>Últimos 30 dias</span>
            <strong>{fmt(summary.clicks_30d)}</strong>
            <small>cliques no período</small>
          </div>
          <div className="bitly-kpi">
            <span>Links ativos</span>
            <strong>{fmt(summary.contents)}</strong>
            <small>conteúdos mobilizados</small>
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
              placeholder="https://bit.ly/FalaFabio"
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
          {!bitly?.configured && (
            <label>
              Pessoas que clicaram (Bitly)
              <input
                className="input"
                type="number"
                min="0"
                value={form.clicks}
                onChange={(e) => setForm({ ...form, clicks: e.target.value })}
                placeholder="Total de cliques do Bitly"
              />
            </label>
          )}
          <label>
            Observações
            <input
              className="input"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>
          <button className="btn btn-primary" type="submit">Salvar na análise</button>
        </form>
      )}

      <div className="stack" style={{ marginTop: '1.1rem' }}>
        {items.map((item) => {
          const chForm = channelForms[item.id] || emptyChannel;
          const mDraft = metricsEdit[item.id] || { clicks: item.clicks ?? 0 };
          return (
            <article className="bitly-card" key={item.id}>
              <div className="bitly-card__head">
                <div>
                  <h4>{item.title}</h4>
                  <p className="bitly-card__link">
                    <a href={item.bitly_url} target="_blank" rel="noreferrer">
                      {item.bitly_url}
                    </a>
                  </p>
                  {item.destination_url ? (
                    <p className="bitly-card__dest">→ {item.destination_url}</p>
                  ) : null}
                  {item.bitly_synced_at ? (
                    <p className="bitly-card__sync">
                      Sincronizado {formatWhen(item.bitly_synced_at)}
                    </p>
                  ) : null}
                </div>
                <div className="bitly-card__actions">
                  {bitly?.configured ? (
                    <button type="button" className="btn btn-soft btn-sm" onClick={() => syncOne(item)}>
                      Sync Bitly
                    </button>
                  ) : null}
                  <button type="button" className="btn btn-accent btn-sm" onClick={() => copy(item.bitly_url)}>
                    Copiar
                  </button>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => removeContent(item)}>
                    Remover
                  </button>
                </div>
              </div>

              <div className="bitly-card__stats">
                <div>
                  <span>Clicaram no link</span>
                  <strong>{fmt(item.totals.people_clicked)}</strong>
                </div>
                <div>
                  <span>Grupos/canais</span>
                  <strong>{fmt(item.totals.channels)}</strong>
                </div>
                <div>
                  <span>Pessoas nos grupos</span>
                  <strong>{fmt(item.totals.audience)}</strong>
                </div>
                <div>
                  <span>Taxa de clique</span>
                  <strong>
                    {item.totals.click_rate_pct != null ? `${item.totals.click_rate_pct}%` : '—'}
                  </strong>
                </div>
              </div>

              <Sparkline series={item.clicks_series} />

              {!bitly?.configured && (
                <div className="form-grid" style={{ marginTop: '0.75rem', alignItems: 'end' }}>
                  <label>
                    Atualizar pessoas que clicaram
                    <input
                      className="input"
                      type="number"
                      min="0"
                      value={mDraft.clicks}
                      onChange={(e) =>
                        setMetricsEdit((prev) => ({
                          ...prev,
                          [item.id]: { clicks: e.target.value },
                        }))
                      }
                    />
                  </label>
                  <button type="button" className="btn btn-soft btn-sm" onClick={() => saveMetrics(item)}>
                    Salvar cliques
                  </button>
                </div>
              )}

              <div style={{ marginTop: '1rem' }}>
                <p className="eyebrow" style={{ marginBottom: '0.45rem' }}>
                  Onde foi enviado
                </p>
                {item.channels?.length ? (
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Tipo</th>
                          <th>Nome</th>
                          <th>Pessoas no grupo</th>
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
                    Cadastre os grupos/canais do disparo para cruzar com os cliques do Bitly.
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
          Cadastre um Bitly para ver a análise: cliques, grupos/canais e pessoas.
        </EmptyState>
      )}
      <Toast message={toast} onClose={() => setToast('')} />
    </section>
  );
}
