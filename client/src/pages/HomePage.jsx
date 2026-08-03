import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { StatusBadge, EmptyState } from '../components/Ui';
import { api } from '../api';
import { useAuth } from '../auth';

export default function HomePage() {
  const { isAuthenticated, loading } = useAuth();
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      setSummary(null);
      return;
    }
    api.getAgencySummary()
      .then(setSummary)
      .catch((err) => setError(err.message));
  }, [isAuthenticated]);

  return (
    <>
      <Header />
      <main>
        <section className="hero">
          <div className="hero__bg" aria-hidden="true" />
          <div className="hero__visual" aria-hidden="true">
            <img src="/logos/atlas-agency.png" alt="" />
          </div>
          <div className="container hero__content">
            <div className="hero__brand">
              <img src="/logos/atlas-agency-mark.png" alt="Atlas Agency" />
            </div>
            <h1>Atlas Agency</h1>
            <p className="hero__lead">
              Sistema interno de mobilização da equipe — painel, radar de eventos e códigos pessoais.
            </p>
            <div className="hero__actions">
              {isAuthenticated ? (
                <Link className="btn btn-primary" to="/campanha/fabio-garcia/mobilizacao">
                  Abrir mobilização
                </Link>
              ) : (
                <Link className="btn btn-primary" to="/login">
                  Entrar na equipe
                </Link>
              )}
              <a className="btn btn-soft" href="#como-usar">Como usar</a>
            </div>
          </div>
        </section>

        <section className="section" id="como-usar">
          <div className="container">
            <div className="section__head">
              <p className="eyebrow">Operação</p>
              <h2>Feito para a equipe de mobilização</h2>
              <p>
                Login só para o painel. QR de evento e link pessoal do mobilizador continuam públicos
                para captar no campo e mandar a pessoa ao WhatsApp do Fábio.
              </p>
            </div>
            <div className="services">
              <article className="service">
                <h3>Painel com login</h3>
                <p>Base, mapa, coordenadores, eventos e metas — só quem está na equipe.</p>
              </article>
              <article className="service">
                <h3>Código do mobilizador</h3>
                <p>Link curto por pessoa. Cada cadastro já nasce creditado na Base.</p>
              </article>
              <article className="service">
                <h3>Radar ao vivo</h3>
                <p>Durante o evento, veja cadastros entrando em tempo real no celular.</p>
              </article>
            </div>
          </div>
        </section>

        {isAuthenticated && (
          <section className="section" id="dashboard" style={{ paddingTop: 0 }}>
            <div className="container">
              <div className="section__head">
                <p className="eyebrow">Dashboard geral</p>
                <h2>Resumo das campanhas ativas</h2>
              </div>
              {error && <EmptyState>{error}</EmptyState>}
              {summary && (
                <div className="stats-row">
                  <article className="stat"><strong>{summary.totals.active_campaigns}</strong><span>Campanhas</span></article>
                  <article className="stat"><strong>{summary.totals.leaders}</strong><span>Lideranças</span></article>
                  <article className="stat"><strong>{summary.totals.registrations}</strong><span>Cadastros</span></article>
                  <article className="stat"><strong>{summary.totals.events}</strong><span>Eventos</span></article>
                </div>
              )}
              {summary?.campaigns?.length > 0 && (
                <div className="campaign-list" style={{ marginTop: '1.25rem' }}>
                  {summary.campaigns.map((c) => (
                    <article key={c.id} className="panel panel-pad campaign-home-card" style={{ marginBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                        <div className="campaign-home-card__brand">
                          <img
                            src={c.logo_url || '/logos/fabio-garcia.png'}
                            alt={c.candidate || c.name}
                          />
                          <div>
                            <h3 style={{ marginBottom: 4 }}>{c.name}</h3>
                            <p style={{ margin: 0 }}>{c.candidate}</p>
                          </div>
                        </div>
                        <StatusBadge status={c.status} />
                      </div>
                      <Link className="btn btn-primary btn-sm" style={{ marginTop: '0.75rem' }} to={`/campanha/${c.slug}/mobilizacao`}>
                        Abrir
                      </Link>
                    </article>
                  ))}
                </div>
              )}
              {!summary && !error && !loading && <EmptyState>Carregando…</EmptyState>}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
