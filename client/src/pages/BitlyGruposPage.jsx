import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { api } from '../api';
import { EmptyState, Toast } from '../components/Ui';

export default function BitlyGruposPage() {
  const { campaign } = useOutletContext();
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // all | pending | ready | noinvite
  const [lastRun, setLastRun] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const res = await api.getDobraBitlyBoard(campaign.slug);
      setBoard(res);
      setError('');
    } catch (err) {
      setError(err.message || 'Erro ao carregar Bitly dos grupos');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [campaign.slug]);

  const groups = board?.groups || [];
  const summary = board?.summary || {};
  const bitly = board?.bitly || {};

  const visible = useMemo(() => {
    if (filter === 'pending') {
      return groups.filter((g) => !g.bitly_url && (g.invite_link || g.destination_url));
    }
    if (filter === 'ready') return groups.filter((g) => g.bitly_url);
    if (filter === 'noinvite') {
      return groups.filter((g) => !g.bitly_url && !(g.invite_link || g.destination_url));
    }
    return groups;
  }, [groups, filter]);

  async function createAll() {
    if (!bitly.configured) {
      setToast('Configure BITLY_ACCESS_TOKEN no Render');
      return;
    }
    const pending = summary.pending_bitly || 0;
    if (!pending) {
      setToast('Nenhum grupo pendente com convite WhatsApp');
      return;
    }
    if (!window.confirm(`Criar Bitly automático para ${pending} grupo(s)? Cada grupo ganha o próprio link.`)) {
      return;
    }
    setBusy(true);
    try {
      const res = await api.bulkCreateDobraBitly(campaign.slug, { only_missing: true });
      setLastRun({ type: 'create', ...res });
      setBoard((prev) => ({
        ...prev,
        groups: res.groups || prev?.groups || [],
        summary: {
          groups: (res.groups || []).filter((g) => g.status !== 'arquivado').length,
          with_bitly: (res.groups || []).filter((g) => g.status !== 'arquivado' && g.bitly_url).length,
          pending_bitly: (res.groups || []).filter(
            (g) => g.status !== 'arquivado' && !g.bitly_url && (g.invite_link || g.destination_url),
          ).length,
          missing_invite: (res.groups || []).filter(
            (g) => g.status !== 'arquivado' && !g.bitly_url && !(g.invite_link || g.destination_url),
          ).length,
          clicks_total: (res.groups || []).reduce((s, g) => s + (g.clicks || 0), 0),
        },
        bitly: res.bitly || prev?.bitly,
      }));
      setToast(`Bitly criado: ${res.created} ok${res.failed ? `, ${res.failed} falha(s)` : ''}`);
    } catch (err) {
      setToast(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function syncAll() {
    if (!bitly.configured) {
      setToast('Configure BITLY_ACCESS_TOKEN no Render');
      return;
    }
    setBusy(true);
    try {
      const res = await api.syncAllDobraGroups(campaign.slug);
      setLastRun({ type: 'sync', ...res });
      setBoard((prev) => ({
        ...prev,
        groups: res.groups || prev?.groups || [],
        summary: {
          ...(prev?.summary || {}),
          with_bitly: (res.groups || []).filter((g) => g.status !== 'arquivado' && g.bitly_url).length,
          clicks_total: (res.groups || []).reduce((s, g) => s + (g.clicks || 0), 0),
        },
      }));
      setToast(`Cliques sincronizados: ${res.synced} ok${res.failed ? `, ${res.failed} falha(s)` : ''}`);
    } catch (err) {
      setToast(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container section" style={{ paddingTop: 0 }}>
      <div className="section__head no-print">
        <p className="eyebrow">Links rastreados</p>
        <h2>Bitly · Grupos Dobra</h2>
        <p>
          Cada grupo WhatsApp tem o <strong>próprio Bitly</strong>.
          Aqui você gera em massa (automático) e sincroniza os cliques —
          sem colar link por link.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.85rem' }}>
          <button
            type="button"
            className="btn btn-accent btn-sm"
            onClick={createAll}
            disabled={busy || !bitly.configured}
          >
            {busy ? 'Processando…' : `Gerar Bitly em massa (${summary.pending_bitly || 0})`}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={syncAll}
            disabled={busy || !bitly.configured}
          >
            Sincronizar cliques
          </button>
          <Link className="btn btn-soft btn-sm" to={`/campanha/${campaign.slug}/grupos`}>
            Ir para Grupos Dobra
          </Link>
          <a
            className="btn btn-soft btn-sm"
            href="https://app.bitly.com/"
            target="_blank"
            rel="noreferrer"
          >
            Abrir Bitly
          </a>
        </div>
      </div>

      {error ? <EmptyState>{error}</EmptyState> : null}

      <div className="dobra-print-stats" style={{ marginTop: '1rem' }}>
        <div className="dobra-print-stat">
          <strong>{summary.groups || 0}</strong>
          <span>Grupos</span>
        </div>
        <div className="dobra-print-stat">
          <strong>{summary.with_bitly || 0}</strong>
          <span>Com Bitly</span>
        </div>
        <div className="dobra-print-stat">
          <strong>{summary.pending_bitly || 0}</strong>
          <span>Pendentes</span>
        </div>
        <div className="dobra-print-stat">
          <strong>{summary.clicks_total || 0}</strong>
          <span>Cliques</span>
        </div>
      </div>

      <div className="panel panel-pad" style={{ marginTop: '1rem' }}>
        <p style={{ margin: 0, fontSize: '0.92rem' }}>
          Status Bitly:{' '}
          <strong>{bitly.configured ? (bitly.ready === false ? 'Token com problema' : 'Pronto') : 'Sem token'}</strong>
          {bitly.hint ? ` — ${bitly.hint}` : ''}
        </p>
        {lastRun ? (
          <p style={{ margin: '0.55rem 0 0', fontSize: '0.88rem', color: 'var(--ink-soft, #556)' }}>
            Última ação: {lastRun.type === 'create' ? 'criação' : 'sync'} ·
            {' '}ok {lastRun.created ?? lastRun.synced ?? 0}
            {(lastRun.failed ? ` · falhas ${lastRun.failed}` : '')}
          </p>
        ) : null}
      </div>

      <div className="demand-breadcrumb no-print" style={{ marginTop: '1rem' }}>
        {[
          { id: 'all', label: 'Todos' },
          { id: 'pending', label: 'Pendentes' },
          { id: 'ready', label: 'Com Bitly' },
          { id: 'noinvite', label: 'Sem convite' },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            className={`chip ${filter === f.id ? 'active' : ''}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <EmptyState>Carregando…</EmptyState>
      ) : !visible.length ? (
        <EmptyState>
          {filter === 'pending'
            ? 'Nada pendente — coloque o convite WhatsApp no grupo ou gere Bitly nos que faltam.'
            : 'Nenhum grupo nesta lista.'}
        </EmptyState>
      ) : (
        <div className="panel panel-pad" style={{ marginTop: '1rem', overflowX: 'auto' }}>
          <table className="report-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th align="left">Grupo</th>
                <th align="left">Deputado</th>
                <th align="left">Bitly</th>
                <th align="right">Cliques</th>
                <th align="left">Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((g) => (
                <tr key={g.id}>
                  <td>{g.name}</td>
                  <td>{g.deputy_name || '—'}</td>
                  <td>
                    {g.bitly_url ? (
                      <a href={g.bitly_url} target="_blank" rel="noreferrer">{g.bitly_url}</a>
                    ) : (g.invite_link || g.destination_url) ? (
                      <span style={{ color: '#a15c00' }}>Pendente · tem convite</span>
                    ) : (
                      <span style={{ color: '#888' }}>Sem convite</span>
                    )}
                  </td>
                  <td align="right">{g.bitly_url ? (g.clicks ?? 0) : '—'}</td>
                  <td>
                    {g.bitly_last_error
                      ? <span style={{ color: '#b42318' }}>{g.bitly_last_error}</span>
                      : (g.bitly_url ? 'ok' : '—')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {toast ? <Toast onClose={() => setToast('')}>{toast}</Toast> : null}
    </div>
  );
}
