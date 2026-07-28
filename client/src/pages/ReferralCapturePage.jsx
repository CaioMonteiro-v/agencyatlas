import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { EmptyState, Toast } from '../components/Ui';

export default function ReferralCapturePage() {
  const { slug, code } = useParams();
  const [campaign, setCampaign] = useState(null);
  const [toast, setToast] = useState('');
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({ full_name: '', phone: '', email: '' });

  useEffect(() => {
    api.getCampaign(slug).then(setCampaign).catch(() => {});
  }, [slug]);

  async function onSubmit(e) {
    e.preventDefault();
    try {
      await api.createRegistration(slug, {
        ...form,
        referral_code: code,
      });
      setDone(true);
      setToast('Cadastro realizado');
    } catch (err) {
      setToast(err.message);
    }
  }

  return (
    <div className="public-page">
      <div className="public-card">
        <img src="/logos/atlas-agency-horizontal.png" alt="Atlas Agency" style={{ height: 48, marginBottom: 12 }} />
        <p className="eyebrow">Convite rastreado</p>
        <h1 style={{ fontSize: '1.7rem' }}>{campaign?.name || 'Campanha Atlas'}</h1>
        <p>Você chegou por um link parametrizado de mobilização. Complete seu cadastro com carinho.</p>

        {!done ? (
          <form className="form-grid" onSubmit={onSubmit}>
            <label>
              Nome completo *
              <input className="input" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </label>
            <label>
              Telefone *
              <input className="input" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </label>
            <label>
              E-mail
              <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </label>
            <button className="btn btn-primary" type="submit">Quero participar</button>
          </form>
        ) : (
          <div>
            <h3>Bem-vindo(a)!</h3>
            <p>Seu cadastro foi vinculado à liderança que compartilhou este link.</p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <a className="btn btn-whatsapp" href={campaign?.whatsapp_url || 'https://bit.ly/FalaFabio'} target="_blank" rel="noreferrer">
                Falar no WhatsApp
              </a>
              <Link className="btn btn-soft" to={`/campanha/${slug}`}>Ver campanha</Link>
            </div>
          </div>
        )}

        {!campaign && <EmptyState>Preparando formulário…</EmptyState>}
      </div>
      <Toast message={toast} onClose={() => setToast('')} />
    </div>
  );
}
