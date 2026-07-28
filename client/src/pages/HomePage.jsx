import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { StatusBadge, EmptyState } from '../components/Ui';
import { api } from '../api';

export default function HomePage() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getAgencySummary()
      .then(setSummary)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <>
      <Header />
      <main>
        <section className="hero">
          <div className="hero__bg" aria-hidden="true" />
          <div className="container hero__content">
            <div className="hero__brand">
              <img src="/logos/atlas-agency-horizontal.png" alt="Atlas Agency" />
            </div>
            <h1>Atlas Agency</h1>
            <p className="hero__lead">
              Uma casa digital delicada para cuidar de campanhas, lideranças e mobilização —
              com clareza, afeto e presença em todo o território.
            </p>
            <div className="hero__actions">
              <a className="btn btn-primary" href="#campanhas">Ver campanhas</a>
              <Link className="btn btn-soft" to="/campanha/fabio-garcia/mobilizacao">
                Abrir mobilização
              </Link>
            </div>
          </div>
        </section>

        <section className="section" id="servicos">
          <div className="container">
            <div className="section__head">
              <p className="eyebrow">Missão</p>
              <h2>Mobilizar com cuidado e inteligência</h2>
              <p>
                A Atlas Agency desenvolve plataformas amigáveis para gestão de múltiplas campanhas,
                acompanhamento de mídia e tráfego, e ferramentas de mobilização digital com rastreabilidade.
              </p>
            </div>
            <div className="services">
              <article className="service">
                <h3>Campanhas</h3>
                <p>Espaços dedicados para cada projeto político, com identidade própria e visão geral clara.</p>
              </article>
              <article className="service">
                <h3>Mobilização</h3>
                <p>Mapas, rankings, links parametrizados, eventos com QR Code e missões com metas reais.</p>
              </article>
              <article className="service">
                <h3>Mídia & Conteúdo</h3>
                <p>Ambientes preparados para tráfego pago e criação de conteúdo — em expansão contínua.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="section" id="dashboard" style={{ paddingTop: 0 }}>
          <div className="container">
            <div className="section__head">
              <p className="eyebrow">Dashboard geral</p>
              <h2>Resumo das campanhas ativas</h2>
            </div>
            {error && <EmptyState>{error}</EmptyState>}
            {summary && (
              <div className="stats-row">
                <div className="stat">
                  <strong>{summary.totals.active_campaigns}</strong>
                  <span>Campanhas ativas</span>
                </div>
                <div className="stat">
                  <strong>{summary.totals.registrations}</strong>
                  <span>Cadastros</span>
                </div>
                <div className="stat">
                  <strong>{summary.totals.leaders}</strong>
                  <span>Lideranças</span>
                </div>
                <div className="stat">
                  <strong>{summary.totals.active_missions}</strong>
                  <span>Missões ativas</span>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="section" id="campanhas" style={{ paddingTop: 0 }}>
          <div className="container">
            <div className="section__head">
              <p className="eyebrow">Projetos</p>
              <h2>Campanhas sob o cuidado da Atlas</h2>
            </div>
            <div className="campaign-list">
              {(summary?.campaigns || []).map((campaign) => (
                <Link key={campaign.id} to={`/campanha/${campaign.slug}`} className="campaign-row">
                  <img src={campaign.logo_url || '/logos/atlas-agency.png'} alt="" />
                  <div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: 4 }}>
                      <h3 style={{ margin: 0 }}>{campaign.name}</h3>
                      <StatusBadge status={campaign.status} />
                    </div>
                    <p style={{ marginBottom: 0 }}>{campaign.description}</p>
                    <p style={{ marginBottom: 0, marginTop: 8, color: 'var(--muted)', fontSize: '0.9rem' }}>
                      {campaign.stats.registrations} cadastros · {campaign.stats.leaders} lideranças · {campaign.stats.missions} missões
                    </p>
                  </div>
                  <span className="btn btn-soft btn-sm">Abrir</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
