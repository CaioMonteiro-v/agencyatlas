import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { api } from '../api';
import { EmptyState, Toast } from '../components/Ui';

const emptyVideo = {
  title: '',
  destination_url: '',
  posted_at: new Date().toISOString().slice(0, 10),
  notes: '',
};

export default function BitlyGruposPage() {
  const { campaign } = useOutletContext();
  const [videos, setVideos] = useState([]);
  const [videoSummary, setVideoSummary] = useState(null);
  const [groupsActive, setGroupsActive] = useState(0);
  const [bitly, setBitly] = useState({});
  const [inviteBoard, setInviteBoard] = useState(null);

  const [selectedVideoId, setSelectedVideoId] = useState(null);
  const [links, setLinks] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyVideo);
  const [mode, setMode] = useState('videos'); // videos | invites

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  async function loadBoard() {
    setLoading(true);
    try {
      const [vidRes, board] = await Promise.all([
        api.getDobraVideos(campaign.slug),
        api.getDobraBitlyBoard(campaign.slug).catch(() => null),
      ]);
      setVideos(vidRes.videos || []);
      setVideoSummary(vidRes.summary || null);
      setGroupsActive(vidRes.groups_active || vidRes.summary?.groups_active || 0);
      setBitly(vidRes.bitly || board?.bitly || {});
      setInviteBoard(board);
      setError('');
    } catch (err) {
      setError(err.message || 'Erro ao carregar Bitly');
    } finally {
      setLoading(false);
    }
  }

  async function openVideo(id) {
    setSelectedVideoId(id);
    setBusy(true);
    try {
      const res = await api.getDobraVideo(campaign.slug, id);
      setSelectedVideo(res.video);
      setLinks(res.links || []);
      setBitly(res.bitly || bitly);
    } catch (err) {
      setToast(err.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    loadBoard().catch((err) => setError(err.message));
  }, [campaign.slug]);

  const pendingForSelected = useMemo(() => {
    if (!selectedVideo) return 0;
    return Math.max(0, (groupsActive || 0) - (selectedVideo.links_ok || links.filter((l) => l.bitly_url).length));
  }, [selectedVideo, groupsActive, links]);

  async function onCreateVideo(e) {
    e.preventDefault();
    if (!form.title.trim() || !form.destination_url.trim()) {
      setToast('Informe título e URL do vídeo');
      return;
    }
    setBusy(true);
    try {
      const res = await api.createDobraVideo(campaign.slug, {
        title: form.title.trim(),
        destination_url: form.destination_url.trim(),
        posted_at: form.posted_at || null,
        notes: form.notes.trim() || null,
      });
      setVideos(res.videos || []);
      setVideoSummary(res.summary || null);
      setGroupsActive(res.groups_active || res.summary?.groups_active || groupsActive);
      setShowForm(false);
      setForm(emptyVideo);
      setToast('Vídeo cadastrado — agora gere 1 Bitly por grupo');
      if (res.video?.id) await openVideo(res.video.id);
    } catch (err) {
      setToast(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function generateAll() {
    if (!selectedVideoId) return;
    if (!bitly.configured) {
      setToast('Configure BITLY_ACCESS_TOKEN no Render');
      return;
    }
    const n = pendingForSelected || groupsActive;
    if (!window.confirm(
      `Gerar Bitly automático para até ${n} grupo(s)?\n\n1 vídeo = 1 link por grupo (ex.: 150 grupos → 150 links).`,
    )) return;
    setBusy(true);
    try {
      const res = await api.generateDobraVideoLinks(campaign.slug, selectedVideoId, { limit: 200 });
      setSelectedVideo(res.video);
      setLinks(res.links || []);
      setVideos(res.videos || videos);
      setVideoSummary(res.summary || videoSummary);
      setToast(
        `Links criados: ${res.created} ok`
        + (res.failed ? `, ${res.failed} falha(s)` : '')
        + (res.remaining ? ` · faltam ${res.remaining}` : ''),
      );
    } catch (err) {
      setToast(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function syncSelected() {
    if (!selectedVideoId) return;
    setBusy(true);
    try {
      const res = await api.syncDobraVideoLinks(campaign.slug, selectedVideoId);
      setSelectedVideo(res.video);
      setLinks(res.links || []);
      setVideos(res.videos || videos);
      setVideoSummary(res.summary || videoSummary);
      setToast(`Cliques sync: ${res.synced} ok${res.failed ? `, ${res.failed} falha(s)` : ''}`);
    } catch (err) {
      setToast(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeVideo(video) {
    if (!window.confirm(`Remover o vídeo "${video.title}" e todos os Bitlys dele?`)) return;
    try {
      const res = await api.deleteDobraVideo(campaign.slug, video.id);
      setVideos(res.videos || []);
      setVideoSummary(res.summary || null);
      if (Number(selectedVideoId) === Number(video.id)) {
        setSelectedVideoId(null);
        setSelectedVideo(null);
        setLinks([]);
      }
      setToast('Vídeo removido');
    } catch (err) {
      setToast(err.message);
    }
  }

  async function createInviteBitlys() {
    if (!bitly.configured) {
      setToast('Configure BITLY_ACCESS_TOKEN no Render');
      return;
    }
    const pending = inviteBoard?.summary?.pending_bitly || 0;
    if (!pending) {
      setToast('Nenhum convite de grupo pendente de Bitly');
      return;
    }
    if (!window.confirm(`Criar Bitly de convite WhatsApp para ${pending} grupo(s)?`)) return;
    setBusy(true);
    try {
      const res = await api.bulkCreateDobraBitly(campaign.slug, { only_missing: true });
      const board = await api.getDobraBitlyBoard(campaign.slug);
      setInviteBoard(board);
      setToast(`Convites: ${res.created} Bitly ok${res.failed ? `, ${res.failed} falha(s)` : ''}`);
    } catch (err) {
      setToast(err.message);
    } finally {
      setBusy(false);
    }
  }

  const showingList = !selectedVideoId;

  return (
    <div className="container section" style={{ paddingTop: 0 }}>
      <div className="section__head no-print">
        <p className="eyebrow">Controle de distribuição</p>
        <h2>Bitly · Vídeo × Grupos</h2>
        <p>
          Cada <strong>vídeo</strong> gera <strong>1 Bitly por grupo</strong>
          {groupsActive ? ` (hoje: ${groupsActive} grupos → ${groupsActive} links por vídeo)` : ''}.
          Vários vídeos = vários “pacotes” de links — aqui você controla cliques por vídeo e por grupo.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.85rem' }}>
          <button
            type="button"
            className="btn btn-accent btn-sm"
            onClick={() => {
              setShowForm(true);
              setMode('videos');
              setSelectedVideoId(null);
            }}
          >
            Novo vídeo
          </button>
          <Link className="btn btn-soft btn-sm" to={`/campanha/${campaign.slug}/grupos`}>
            Grupos Dobra
          </Link>
          <a className="btn btn-soft btn-sm" href="https://app.bitly.com/" target="_blank" rel="noreferrer">
            Abrir Bitly
          </a>
        </div>
      </div>

      {error ? <EmptyState>{error}</EmptyState> : null}

      <div className="demand-breadcrumb no-print">
        <button
          type="button"
          className={`chip ${mode === 'videos' ? 'active' : ''}`}
          onClick={() => {
            setMode('videos');
            setSelectedVideoId(null);
          }}
        >
          Vídeos
        </button>
        <button
          type="button"
          className={`chip ${mode === 'invites' ? 'active' : ''}`}
          onClick={() => {
            setMode('invites');
            setSelectedVideoId(null);
          }}
        >
          Convites dos grupos
        </button>
        {selectedVideo ? (
          <>
            <span>/</span>
            <span className="chip active">{selectedVideo.title}</span>
          </>
        ) : null}
      </div>

      {showForm && mode === 'videos' ? (
        <form className="panel panel-pad dobra-form" onSubmit={onCreateVideo} style={{ marginTop: '1rem' }}>
          <h3 style={{ marginTop: 0 }}>Novo vídeo / conteúdo</h3>
          <p style={{ marginTop: 0, fontSize: '0.92rem' }}>
            Cadastre a URL do vídeo. Depois clique em <strong>Gerar Bitly para todos os grupos</strong>.
          </p>
          <div className="dobra-form__grid">
            <label>
              Título
              <input
                className="input"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ex.: Vídeo dobra · 21/08"
                required
              />
            </label>
            <label>
              URL do vídeo
              <input
                className="input"
                value={form.destination_url}
                onChange={(e) => setForm({ ...form, destination_url: e.target.value })}
                placeholder="https://instagram.com/reel/..."
                required
              />
            </label>
            <label>
              Data
              <input
                className="input"
                type="date"
                value={form.posted_at}
                onChange={(e) => setForm({ ...form, posted_at: e.target.value })}
              />
            </label>
          </div>
          <label>
            Observações
            <textarea
              className="textarea"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? 'Salvando…' : 'Salvar vídeo'}
            </button>
            <button type="button" className="btn btn-soft" onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </form>
      ) : null}

      <div className="dobra-print-stats" style={{ marginTop: '1rem' }}>
        {mode === 'videos' ? (
          <>
            <div className="dobra-print-stat">
              <strong>{videoSummary?.videos || videos.length}</strong>
              <span>Vídeos</span>
            </div>
            <div className="dobra-print-stat">
              <strong>{groupsActive}</strong>
              <span>Grupos</span>
            </div>
            <div className="dobra-print-stat">
              <strong>{videoSummary?.links_total || 0}</strong>
              <span>Links gerados</span>
            </div>
            <div className="dobra-print-stat">
              <strong>{videoSummary?.clicks_total || 0}</strong>
              <span>Cliques</span>
            </div>
          </>
        ) : (
          <>
            <div className="dobra-print-stat">
              <strong>{inviteBoard?.summary?.groups || 0}</strong>
              <span>Grupos</span>
            </div>
            <div className="dobra-print-stat">
              <strong>{inviteBoard?.summary?.with_bitly || 0}</strong>
              <span>Convite com Bitly</span>
            </div>
            <div className="dobra-print-stat">
              <strong>{inviteBoard?.summary?.pending_bitly || 0}</strong>
              <span>Pendentes</span>
            </div>
            <div className="dobra-print-stat">
              <strong>{inviteBoard?.summary?.clicks_total || 0}</strong>
              <span>Cliques convite</span>
            </div>
          </>
        )}
      </div>

      <div className="panel panel-pad" style={{ marginTop: '1rem' }}>
        <p style={{ margin: 0, fontSize: '0.92rem' }}>
          Status Bitly:{' '}
          <strong>{bitly.configured ? (bitly.ready === false ? 'Token com problema' : 'Pronto') : 'Sem token'}</strong>
          {bitly.hint ? ` — ${bitly.hint}` : ''}
        </p>
      </div>

      {loading ? (
        <EmptyState>Carregando…</EmptyState>
      ) : mode === 'invites' ? (
        <div style={{ marginTop: '1rem' }}>
          <button
            type="button"
            className="btn btn-accent btn-sm"
            onClick={createInviteBitlys}
            disabled={busy || !bitly.configured}
          >
            Gerar Bitly dos convites pendentes
          </button>
          <p style={{ fontSize: '0.9rem', marginTop: '0.75rem' }}>
            Isso é o link de <strong>entrada no grupo WhatsApp</strong> (diferente do link do vídeo).
          </p>
        </div>
      ) : showingList ? (
        <div className="demand-grid" style={{ marginTop: '1rem' }}>
          {videos.map((v) => (
            <button
              key={v.id}
              type="button"
              className="demand-card-btn"
              onClick={() => openVideo(v.id)}
            >
              <strong>{v.title}</strong>
              <span>{v.posted_at || 'sem data'}</span>
              <span className="demand-card-btn__stats">
                {v.links_ok || 0}/{groupsActive || '—'} links · {v.clicks_total || 0} cliques
              </span>
              <span className="demand-card-btn__stats" style={{ wordBreak: 'break-all' }}>
                {v.destination_url}
              </span>
            </button>
          ))}
          {!videos.length ? (
            <EmptyState>
              Cadastre o vídeo do dia. Depois gere automaticamente 1 Bitly para cada grupo cadastrado.
            </EmptyState>
          ) : null}
        </div>
      ) : (
        <div style={{ marginTop: '1rem' }}>
          <div className="panel panel-pad" style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                <p className="eyebrow" style={{ marginBottom: 4 }}>Vídeo</p>
                <h3 style={{ margin: 0 }}>{selectedVideo?.title}</h3>
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', wordBreak: 'break-all' }}>
                  Destino:{' '}
                  <a href={selectedVideo?.destination_url} target="_blank" rel="noreferrer">
                    {selectedVideo?.destination_url}
                  </a>
                </p>
                <p style={{ margin: '0.35rem 0 0', fontSize: '0.9rem' }}>
                  Links: <strong>{selectedVideo?.links_ok || 0}</strong> de {groupsActive}
                  {' · '}
                  Cliques: <strong>{selectedVideo?.clicks_total || 0}</strong>
                  {pendingForSelected ? ` · faltam ${pendingForSelected}` : ''}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <button
                  type="button"
                  className="btn btn-accent btn-sm"
                  onClick={generateAll}
                  disabled={busy || !bitly.configured}
                >
                  {busy ? 'Gerando…' : `Gerar Bitly p/ todos os grupos (${pendingForSelected || groupsActive})`}
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={syncSelected}
                  disabled={busy || !bitly.configured || !(selectedVideo?.links_ok)}
                >
                  Sync cliques
                </button>
                <button type="button" className="btn btn-soft btn-sm" onClick={() => setSelectedVideoId(null)}>
                  Voltar aos vídeos
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => selectedVideo && removeVideo(selectedVideo)}
                >
                  Remover vídeo
                </button>
              </div>
            </div>
          </div>

          {!links.length ? (
            <EmptyState>
              Ainda sem links. Clique em <strong>Gerar Bitly para todos os grupos</strong>
              — cada grupo recebe o próprio rastreio deste vídeo.
            </EmptyState>
          ) : (
            <div className="panel panel-pad" style={{ overflowX: 'auto' }}>
              <table className="report-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th align="left">Grupo</th>
                    <th align="left">Deputado</th>
                    <th align="left">Bitly</th>
                    <th align="right">Cliques</th>
                    <th align="right">30d</th>
                  </tr>
                </thead>
                <tbody>
                  {links.map((l) => (
                    <tr key={l.id}>
                      <td>{l.group_name}</td>
                      <td>{l.deputy_name || '—'}</td>
                      <td>
                        {l.bitly_url ? (
                          <a href={l.bitly_url} target="_blank" rel="noreferrer">{l.bitly_url}</a>
                        ) : '—'}
                      </td>
                      <td align="right">{l.clicks ?? 0}</td>
                      <td align="right">{l.clicks_30d ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {toast ? <Toast onClose={() => setToast('')}>{toast}</Toast> : null}
    </div>
  );
}
