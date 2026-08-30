import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import { EmptyState, Toast } from '../components/Ui';

export default function ReferralCapturePage() {
  const { slug, code } = useParams();
  const [campaign, setCampaign] = useState(null);
  const [toast, setToast] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ full_name: '', phone: '', email: '' });

  useEffect(() => {
    api.getCampaignPublic(slug)
      .then(setCampaign)
      .catch((err) => setError(err.message || 'Campanha não encontrada'));
  }, [slug]);

  async function onSubmit(e) {
    e.preventDefault();
    if (!form.full_name.trim() || !form.phone.trim()) {
      setToast('Nome e telefone são obrigatórios');
      return;
    }
    try {
      await api.createRegistration(slug, {
        ...form,
        referral_code: code,
      });
      setDone(true);
      setToast('Cadastro confirmado');
    } catch (err) {
      setToast(err.message);
    }
  }

  return (
    <div className="public-page">
      <div className="public-card">
        {campaign?.logo_url && (
          <img src={campaign.logo_url} alt="" style={{ height: 56, marginBottom: 12, objectFit: 'contain' }} />
        )}
        <p className="eyebrow">Cadastro de presença</p>
        <h1 style={{ fontSize: '1.7rem' }}>{campaign?.name || 'Campanha'}</h1>
        <p>Preencha seus dados para confirmar.</p>

        {error && <EmptyState>{error}</EmptyState>}

        {!done && !error && (
          <form className="form-grid" onSubmit={onSubmit}>
            <label>
              Nome completo *
              <input className="input" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </label>
            <label>
              Telefone *
              <input className="input" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} autoComplete="tel" inputMode="tel" />
            </label>
            <label>
              E-mail <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(opcional)</span>
              <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Opcional — se quiser receber novidades da campanha" autoComplete="email" />
            </label>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--muted)' }}>
              E-mail não é obrigatório — mas se colocar, ajuda bastante na comunicação.
            </p>
            <button className="btn btn-primary" type="submit">Confirmar cadastro</button>
          </form>
        )}

        {done && (
          <div>
            <h3>Cadastro confirmado</h3>
            <p>
              Obrigado! Sua presença foi registrada com sucesso.
              Você já pode fechar esta página.
            </p>
          </div>
        )}

        {!campaign && !error && <EmptyState>Preparando formulário…</EmptyState>}
      </div>
      <Toast message={toast} onClose={() => setToast('')} />
    </div>
  );
}
