import { Link, useOutletContext, useParams } from 'react-router-dom';
import { formatDateTime } from '../utils/date';

export default function CampaignOverview() {
  const { campaign } = useOutletContext();
  const { slug } = useParams();

  return (
    <div className="container section" style={{ paddingTop: 0 }}>
      <div className="layout-split">
        <section className="panel panel-pad">
          <p className="eyebrow">Visão geral</p>
          <h2>{campaign.name}</h2>
          <p>{campaign.description}</p>
          <p><strong>Missão:</strong> {campaign.mission}</p>
          <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', marginTop: '1rem' }}>
            <Link className="btn btn-accent" to={`/campanha/${slug}/mobilizacao`}>
              Ir para Mobilização Digital
            </Link>
            <a
              className="btn btn-whatsapp"
              href={campaign.whatsapp_url || 'https://wa.me/message/PV764OTMN3GEE1'}
              target="_blank"
              rel="noreferrer"
            >
              Falar no WhatsApp
            </a>
          </div>
        </section>

        <aside className="stack">
          <div className="stat">
            <strong>{campaign.stats.registrations}</strong>
            <span>Cadastros</span>
          </div>
          <div className="stat">
            <strong>{campaign.stats.active_leaders}</strong>
            <span>Lideranças ativas</span>
          </div>
          <div className="stat">
            <strong>{campaign.stats.municipalities_reached}</strong>
            <span>Municípios alcançados</span>
          </div>
          <div className="stat">
            <strong>{campaign.stats.events}</strong>
            <span>Eventos</span>
          </div>
        </aside>
      </div>

      <section className="panel panel-pad" style={{ marginTop: '1.25rem' }}>
        <h3>Cadastros recentes</h3>
        <div className="table-wrap" style={{ marginTop: '0.75rem' }}>
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Telefone</th>
                <th>Município</th>
                <th>Liderança</th>
                <th>Quando</th>
              </tr>
            </thead>
            <tbody>
              {(campaign.recent_registrations || []).map((r) => (
                <tr key={r.id}>
                  <td>{r.full_name}</td>
                  <td>{r.phone}</td>
                  <td>{r.municipality_name || '—'}</td>
                  <td>{r.leader_name || '—'}</td>
                  <td>{formatDateTime(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
