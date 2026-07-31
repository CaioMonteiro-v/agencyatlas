import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import HeatMapMT from '../components/HeatMapMT';
import RankingPanel from '../components/RankingPanel';
import LinksPanel from '../components/LinksPanel';
import RegistrationsTable from '../components/RegistrationsTable';
import EventsPanel from '../components/EventsPanel';
import MobilizersPanel from '../components/MobilizersPanel';
import MissionsPanel from '../components/MissionsPanel';

export default function MobilizationPage() {
  const { campaign } = useOutletContext();
  const [dbKind, setDbKind] = useState(null);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((h) => setDbKind(h.database || 'unknown'))
      .catch(() => setDbKind('unknown'));
  }, []);

  async function downloadBackup() {
    try {
      const token = localStorage.getItem('atlas_auth_token') || '';
      const res = await fetch(`/api/campaigns/${campaign.slug}/backup`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Falha ao baixar backup');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `atlas-backup-${campaign.slug}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || 'Erro no backup');
    }
  }

  return (
    <div className="container section" style={{ paddingTop: 0 }}>
      <div className="section__head">
        <p className="eyebrow">Mobilização Digital</p>
        <h2>{campaign.candidate} — Mobilização Digital</h2>
        <p>
          Mapa de calor de Mato Grosso, ranking ao vivo, links rastreáveis, cadastros,
          eventos com QR Code e missões com impacto no ranking.
        </p>
        <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap', marginTop: '0.45rem' }}>
          <a
            className="btn btn-whatsapp"
            href={campaign.whatsapp_url || 'https://bit.ly/FalaFabio'}
            target="_blank"
            rel="noreferrer"
          >
            Conversar no WhatsApp · <span style={{ textDecoration: 'underline' }}>bit.ly/FalaFabio</span>
          </a>
          <button className="btn btn-soft btn-sm" type="button" onClick={downloadBackup}>
            Baixar backup dos dados
          </button>
        </div>
      </div>

      {dbKind === 'postgres' ? (
        <div className="persist-banner persist-banner--ok" role="status">
          <strong>Banco conectado:</strong> Supabase/Postgres ativo. Cadastros e eventos
          permanecem após redeploy.
        </div>
      ) : dbKind === 'sqlite' ? (
        <div className="persist-banner" role="status">
          <strong>Persistência:</strong> usando SQLite local. No Render free os dados podem
          sumir no redeploy. Configure <code>DATABASE_URL</code> do Supabase para corrigir.
        </div>
      ) : null}

      <div className="stack">
        <section className="panel panel-pad">
          <p className="eyebrow">Território</p>
          <h3>Mapa de calor interativo — Mato Grosso</h3>
          <p>
            Use o filtro para achar qualquer um dos <strong>142 municípios</strong>.
            Ao selecionar a cidade, o mapa vai até ela e mostra coordenador, cadastros e lideranças.
            O calor representa <strong>quantidade de cadastros</strong> — não o número de lideranças.
          </p>
          <HeatMapMT campaignSlug={campaign.slug} />
        </section>

        <div className="layout-split">
          <RankingPanel campaignSlug={campaign.slug} />
          <LinksPanel campaignSlug={campaign.slug} />
        </div>

        <RegistrationsTable campaignSlug={campaign.slug} />
        <MobilizersPanel campaignSlug={campaign.slug} />
        <EventsPanel campaignSlug={campaign.slug} />
        <MissionsPanel campaignSlug={campaign.slug} />
      </div>
    </div>
  );
}
