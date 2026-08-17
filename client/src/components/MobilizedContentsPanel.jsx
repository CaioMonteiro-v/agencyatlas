import { useEffect, useState } from 'react';
import { api } from '../api';
import { EmptyState, Toast } from './Ui';

const emptyContent = {
  title: '',
  bitly_url: '',
  destination_url: '',
  clicks: '',
  notes: '',
  coordinator_id: '',
  municipality_id: '',
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
  const [showBulk, setShowBulk] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [form, setForm] = useState(emptyContent);
  const [bulkForm, setBulkForm] = useState({ title_prefix: '', urls: '' });
  const [channelForms, setChannelForms] = useState({});
  const [metricsEdit, setMetricsEdit] = useState({});
  const [coordinators, setCoordinators] = useState([]);
  const [municipalities, setMunicipalities] = useState([]);
  const [filter, setFilter] = useState({ coordinator_id: '', municipality_id: '' });

  async function load(nextFilter = filter) {
    const [res, coordsRes, munis] = await Promise.all([
      api.getMobilized(campaignSlug, {
        coordinator_id: nextFilter.coordinator_id || undefined,
        municipality_id: nextFilter.municipality_id || undefined,
      }),
      api.getCoordinators(campaignSlug).catch(() => ({ coordinators: [] })),
      api.getMunicipalities().catch(() => []),
    ]);
    setItems(res.items || []);
    setSummary(res.summary || null);
    setBitly(res.bitly || null);
    setCoordinators(coordsRes?.coordinators || []);
    setMunicipalities(Array.isArray(munis) ? munis : []);
  }

  useEffect(() => {
    load().catch((err) => setToast(err.message));
  }, [campaignSlug]);

  const muniOptions = (() => {
    const cid = Number(form.coordinator_id || filter.coordinator_id);
    if (!cid) return municipalities;
    const coord = coordinators.find((c) => c.id === cid);
    return coord?.municipalities?.length ? coord.municipalities : municipalities;
  })();

  async function onCreate(e) {
    e.preventDefault();
    try {
      const created = await api.createMobilized(campaignSlug, {
        ...form,
        bitly_url: form.bitly_url.trim() || undefined,
        destination_url: form.destination_url.trim() || undefined,
        coordinator_id: form.coordinator_id || null,
        municipality_id: form.municipality_id || null,
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

  async function onBulkCreate(e) {
    e.preventDefault();
    if (!bulkForm.urls.trim()) {
      setToast('Cole as URLs (uma por linha)');
      return;
    }
    setBulkBusy(true);
    try {
      const res = await api.createMobilizedBulk(campaignSlug, {
        title_prefix: bulkForm.title_prefix.trim() || undefined,
        urls: bulkForm.urls,
        coordinator_id: form.coordinator_id || filter.coordinator_id || undefined,
        municipality_id: form.municipality_id || filter.municipality_id || undefined,
      });
      setBulkForm({ title_prefix: '', urls: '' });
      setShowBulk(false);
      await load();
      const errN = res.error_count || 0;
      setToast(
        errN
          ? `${res.created_count} link(s) criados · ${errN} falha(s)`
          : `${res.created_count} link(s) Bitly criados em massa`,
      );
    } catch (err) {
      setToast(err.message);
    } finally {
      setBulkBusy(false);
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

  async function copyAllLinks() {
    const links = items.map((i) => i.bitly_url).filter(Boolean);
    if (!links.length) {
      setToast('Nenhum link para copiar');
      return;
    }
    await copy(links.join('\n'));
    setToast(`${links.length} links copiados`);
  }

  function exportCsv() {
    const header = ['titulo', 'bitly', 'destino', 'cliques', 'cliques_30d', 'coordenador', 'municipio', 'grupos', 'audiencia'];
    const lines = [header.join(',')];
    for (const item of items) {
      const row = [
        item.title,
        item.bitly_url,
        item.destination_url || '',
        item.totals?.people_clicked ?? 0,
        item.totals?.clicks_30d ?? 0,
        item.coordinator_name || '',
        item.municipality_name || '',
        item.totals?.channels ?? 0,
        item.totals?.audience ?? 0,
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
      lines.push(row.join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `bitly-atlas-${campaignSlug}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    setToast('CSV exportado');
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
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              setShowBulk((v) => !v);
              setShowForm(false);
            }}
          >
            {showBulk ? 'Fechar massa' : 'Criar links em massa'}
          </button>
          <button
            type="button"
            className="btn btn-accent btn-sm"
            onClick={() => {
              setShowForm((v) => !v);
              setShowBulk(false);
            }}
          >
            {showForm ? 'Fechar' : 'Novo link'}
          </button>
        </div>
      </div>

      {bitly && (
        <div className={`bitly-ready ${bitly.ready || bitly.token_ok ? 'bitly-ready--ok' : (bitly.configured ? 'bitly-ready--warn' : 'bitly-ready--wait')}`}>
          <strong>{bitly.ready || bitly.token_ok ? 'Bitly pronto' : (bitly.configured ? 'Token Bitly com problema' : 'Aguardando token Bitly')}</strong>
          <span>{bitly.hint}</span>
          {bitly.login ? <span>Conta Bitly: {bitly.login}</span> : null}
        </div>
      )}

      <div className="bitly-filters" style={{ marginTop: '0.85rem', display: 'flex', gap: '0.55rem', flexWrap: 'wrap', alignItems: 'end' }}>
        <label style={{ minWidth: 160 }}>
          Filtrar coordenador
          <select
            className="select"
            value={filter.coordinator_id}
            onChange={(e) => {
              const next = { ...filter, coordinator_id: e.target.value, municipality_id: '' };
              setFilter(next);
              load(next).catch((err) => setToast(err.message));
            }}
          >
            <option value="">Todos</option>
            {coordinators.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label style={{ minWidth: 160 }}>
          Filtrar município
          <select
            className="select"
            value={filter.municipality_id}
            onChange={(e) => {
              const next = { ...filter, municipality_id: e.target.value };
              setFilter(next);
              load(next).catch((err) => setToast(err.message));
            }}
          >
            <option value="">Todos</option>
            {muniOptions.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </label>
        <button type="button" className="btn btn-soft btn-sm" onClick={copyAllLinks}>Copiar todos os links</button>
        <button type="button" className="btn btn-soft btn-sm" onClick={exportCsv}>Exportar CSV</button>
      </div>

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
            <span>Delta desde sync</span>
            <strong>
              {summary.clicks_delta > 0 ? '+' : ''}
              {fmt(summary.clicks_delta)}
            </strong>
            <small>novos cliques capturados</small>
          </div>
          <div className="bitly-kpi">
            <span>Links ativos</span>
            <strong>{fmt(summary.contents)}</strong>
            <small>
              {fmt(summary.with_territory || 0)} com território
            </small>
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
            Link Bitly {bitly?.configured ? '(opcional se tiver destino)' : '*'}
            <input
              className="input"
              required={!bitly?.configured}
              value={form.bitly_url}
              onChange={(e) => setForm({ ...form, bitly_url: e.target.value })}
              placeholder="https://bit.ly/FalaFabio"
            />
          </label>
          <label>
            URL de destino {bitly?.configured ? '*' : '(opcional)'}
            <input
              className="input"
              required={Boolean(bitly?.configured) && !form.bitly_url}
              value={form.destination_url}
              onChange={(e) => setForm({ ...form, destination_url: e.target.value })}
              placeholder="https://instagram.com/reel/... ou drive/youtube"
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
          <label>
            Coordenador (território)
            <select
              className="select"
              value={form.coordinator_id}
              onChange={(e) => setForm({ ...form, coordinator_id: e.target.value, municipality_id: '' })}
            >
              <option value="">Sem vínculo</option>
              {coordinators.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label>
            Município
            <select
              className="select"
              value={form.municipality_id}
              onChange={(e) => setForm({ ...form, municipality_id: e.target.value })}
            >
              <option value="">Sem vínculo</option>
              {muniOptions.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </label>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.88rem' }}>
            Com token Bitly: basta a URL de destino — o Atlas cria o bit.ly. Sem token: cole um Bitly já pronto.
          </p>
          <button className="btn btn-primary" type="submit">Salvar na análise</button>
        </form>
      )}

      {showBulk && (
        <form className="form-grid" style={{ marginTop: '1rem' }} onSubmit={onBulkCreate}>
          <h4 style={{ margin: 0 }}>Criar links Bitly em massa</h4>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.9rem' }}>
            Cole uma URL longa por linha. Opcional: <code>https://...|Título do conteúdo</code>.
            Requer <code>BITLY_ACCESS_TOKEN</code> no Render (plano com criação de links).
          </p>
          <label>
            Prefixo do título (opcional)
            <input
              className="input"
              value={bulkForm.title_prefix}
              onChange={(e) => setBulkForm({ ...bulkForm, title_prefix: e.target.value })}
              placeholder="Ex.: Reel semana 12"
            />
          </label>
          <label>
            URLs *
            <textarea
              className="textarea"
              required
              rows={8}
              value={bulkForm.urls}
              onChange={(e) => setBulkForm({ ...bulkForm, urls: e.target.value })}
              placeholder={'https://instagram.com/reel/...\nhttps://youtube.com/...\nhttps://drive.google.com/...|Vídeo Cuiabá'}
            />
          </label>
          <label>
            Coordenador padrão (opcional)
            <select
              className="select"
              value={form.coordinator_id}
              onChange={(e) => setForm({ ...form, coordinator_id: e.target.value, municipality_id: '' })}
            >
              <option value="">Sem vínculo</option>
              {coordinators.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label>
            Município padrão (opcional)
            <select
              className="select"
              value={form.municipality_id}
              onChange={(e) => setForm({ ...form, municipality_id: e.target.value })}
            >
              <option value="">Sem vínculo</option>
              {muniOptions.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </label>
          <button className="btn btn-primary" type="submit" disabled={bulkBusy || !bitly?.configured}>
            {bulkBusy ? 'Criando…' : 'Criar bitlinks'}
          </button>
          {!bitly?.configured && (
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.88rem' }}>
              Sem token Bitly no Render, a criação em massa fica desabilitada.
            </p>
          )}
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
                  {(item.coordinator_name || item.municipality_name) ? (
                    <p className="bitly-card__sync">
                      Território: {item.coordinator_name || '—'}
                      {item.municipality_name ? ` · ${item.municipality_name}` : ''}
                    </p>
                  ) : null}
                  {item.bitly_synced_at ? (
                    <p className="bitly-card__sync">
                      Sincronizado {formatWhen(item.bitly_synced_at)}
                      {item.totals?.clicks_delta
                        ? ` · ${item.totals.clicks_delta > 0 ? '+' : ''}${item.totals.clicks_delta} desde a sync anterior`
                        : ''}
                    </p>
                  ) : null}
                  {item.bitly_last_error ? (
                    <p className="bitly-card__sync" style={{ color: '#8a5a64' }}>
                      Bitly: {item.bitly_last_error}
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
