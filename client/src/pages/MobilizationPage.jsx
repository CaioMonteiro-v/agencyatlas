import { useOutletContext } from 'react-router-dom';
import HeatMapMT from '../components/HeatMapMT';
import RankingPanel from '../components/RankingPanel';
import LinksPanel from '../components/LinksPanel';
import RegistrationsTable from '../components/RegistrationsTable';
import EventsPanel from '../components/EventsPanel';
import MissionsPanel from '../components/MissionsPanel';

export default function MobilizationPage() {
  const { campaign } = useOutletContext();

  function downloadBackup() {
    window.location.href = `/api/campaigns/${campaign.slug}/backup`;
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

      <div className="persist-banner" role="status">
        <strong>Atenção (Render free):</strong> cadastros e eventos ficam em SQLite no servidor.
        Em redeploy ou quando o serviço “dorme” e recria o disco, os dados podem sumir
        (ex.: Bianca / eventos de ontem). Use <em>Baixar backup</em> com frequência e,
        para produção, configure disco persistente no Render (plano pago) — veja DEPLOY.md.
      </div>

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
        <EventsPanel campaignSlug={campaign.slug} />
        <MissionsPanel campaignSlug={campaign.slug} />
      </div>
    </div>
  );
}
