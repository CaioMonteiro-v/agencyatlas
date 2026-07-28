import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { api } from '../api';
import { Avatar, EmptyState, StatusBadge, Toast } from '../components/Ui';

export default function LeaderProfilePage() {
  const { slug, leaderId } = useParams();
  const [leader, setLeader] = useState(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => {
    api.getLeader(slug, leaderId)
      .then(setLeader)
      .catch((err) => setError(err.message));
  }, [slug, leaderId]);

  async function copyLink() {
    if (!leader) return;
    const link = `${window.location.origin}${leader.link_path}`;
    await navigator.clipboard.writeText(link);
    setToast('Link parametrizado copiado');
    setTimeout(() => setToast(''), 2000);
  }

  return (
    <>
      <Header compact />
      <div className="container section">
        {error && <EmptyState>{error}</EmptyState>}
        {!leader && !error && <EmptyState>Carregando perfil…</EmptyState>}
        {leader && (
          <div className="layout-split">
            <section className="panel panel-pad">
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <Avatar name={leader.name} photo={leader.photo_url} size={72} />
                <div>
                  <p className="eyebrow">Perfil da liderança</p>
                  <h2 style={{ marginBottom: 6 }}>{leader.name}</h2>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <StatusBadge status={leader.status} />
                    <span className="badge badge-info">
                      {leader.type === 'politica' ? 'Liderança política' : 'Multiplicador'}
                    </span>
                  </div>
                </div>
              </div>
              <p style={{ marginTop: '1rem' }}>{leader.bio}</p>
              <p><strong>Município:</strong> {leader.municipality_name || '—'}</p>
              <p><strong>Cadastros:</strong> {leader.registrations_count}</p>
              <p><strong>Bônus de missões:</strong> {leader.mission_bonus}</p>

              <div className="link-row" style={{ marginTop: '1rem' }}>
                <code>{`${window.location.origin}${leader.link_path}`}</code>
                <button type="button" className="btn btn-soft btn-sm" onClick={copyLink}>Copiar link</button>
              </div>

              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <Link className="btn btn-accent" to={`/campanha/${slug}/mobilizacao`}>Voltar à mobilização</Link>
                <a className="btn btn-whatsapp" href="https://bit.ly/FalaFabio" target="_blank" rel="noreferrer">
                  WhatsApp
                </a>
              </div>
            </section>

            <section className="panel panel-pad">
              <h3>Cadastros recentes</h3>
              {(leader.recent_registrations || []).map((r) => (
                <div key={r.id} className="leader-item">
                  <Avatar name={r.full_name} />
                  <div>
                    <strong>{r.full_name}</strong>
                    <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>{r.phone}</div>
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                    {new Date(r.created_at.replace(' ', 'T') + 'Z').toLocaleDateString('pt-BR')}
                  </span>
                </div>
              ))}
              {!leader.recent_registrations?.length && <EmptyState>Ainda sem cadastros.</EmptyState>}
            </section>
          </div>
        )}
      </div>
      <Footer />
      <Toast message={toast} onClose={() => setToast('')} />
    </>
  );
}
