import { NavLink, Outlet, Link, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { api } from '../api';
import { EmptyState } from '../components/Ui';

export default function CampaignLayout() {
  const { slug } = useParams();
  const [campaign, setCampaign] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getCampaign(slug)
      .then(setCampaign)
      .catch((err) => setError(err.message));
  }, [slug]);

  if (error) {
    return (
      <>
        <Header compact />
        <div className="container section"><EmptyState>{error}</EmptyState></div>
      </>
    );
  }

  if (!campaign) {
    return (
      <>
        <Header compact />
        <div className="container section"><EmptyState>Carregando campanha…</EmptyState></div>
      </>
    );
  }

  return (
    <div className="campaign-shell" style={{ '--campaign-accent': campaign.accent_color }}>
      <Header compact />
      <div className="container campaign-top">
        <div className="campaign-top__row">
          <div className="campaign-brand">
            <img src={campaign.logo_url || '/logos/fabio-garcia.png'} alt={campaign.name} />
            <div>
              <p className="eyebrow" style={{ marginBottom: 4 }}>Campanha Atlas</p>
              <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', marginBottom: 4 }}>{campaign.name}</h1>
              <p style={{ margin: 0 }}>{campaign.candidate}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <a
              className="btn btn-whatsapp"
              href={campaign.whatsapp_url || 'https://bit.ly/FalaFabio'}
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp · bit.ly/FalaFabio
            </a>
            <Link className="btn btn-soft" to="/">Voltar à Atlas</Link>
          </div>
        </div>

        <nav className="tabs" aria-label="Abas da campanha">
          <NavLink to={`/campanha/${slug}`} end>Visão Geral</NavLink>
          <NavLink to={`/campanha/${slug}/mobilizacao`}>Mobilização</NavLink>
          <NavLink to={`/campanha/${slug}/coordenadores`}>Coordenadores</NavLink>
          <NavLink to={`/campanha/${slug}/relatorio`}>Relatório</NavLink>
          <NavLink to={`/campanha/${slug}/midia`}>Mídia</NavLink>
          <NavLink to={`/campanha/${slug}/conteudo`}>Conteúdo</NavLink>
        </nav>
      </div>

      <Outlet context={{ campaign }} />
      <Footer />
    </div>
  );
}
