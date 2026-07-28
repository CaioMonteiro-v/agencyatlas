import { useOutletContext } from 'react-router-dom';
import HeatMapMT from '../components/HeatMapMT';
import RankingPanel from '../components/RankingPanel';
import LinksPanel from '../components/LinksPanel';
import RegistrationsTable from '../components/RegistrationsTable';
import EventsPanel from '../components/EventsPanel';
import MissionsPanel from '../components/MissionsPanel';

export default function MobilizationPage() {
  const { campaign } = useOutletContext();

  return (
    <div className="container section" style={{ paddingTop: 0 }}>
      <div className="section__head">
        <p className="eyebrow">Mobilização Digital</p>
        <h2>{campaign.candidate} — Mobilização Digital</h2>
        <p>
          Mapa de calor de Mato Grosso, ranking ao vivo, links rastreáveis, cadastros,
          eventos com QR Code e missões com impacto no ranking.
        </p>
        <a
          className="btn btn-whatsapp"
          href={campaign.whatsapp_url || 'https://bit.ly/FalaFabio'}
          target="_blank"
          rel="noreferrer"
          style={{ marginTop: '0.35rem' }}
        >
          Conversar no WhatsApp · <span style={{ textDecoration: 'underline' }}>bit.ly/FalaFabio</span>
        </a>
      </div>

      <div className="stack">
        <section className="panel panel-pad">
          <p className="eyebrow">Território</p>
          <h3>Mapa de calor interativo — Mato Grosso</h3>
          <p>Clique em um município para ver coordenação, lideranças e concentração de cadastros.</p>
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
