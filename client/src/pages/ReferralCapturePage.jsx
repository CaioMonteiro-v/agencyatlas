import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import AlreadyRegisteredScreen, {
  firstName,
  resolveFabioWhatsApp,
} from '../components/AlreadyRegisteredScreen';
import { EmptyState, Toast } from '../components/Ui';

export default function ReferralCapturePage() {
  const { slug, code } = useParams();
  const [campaign, setCampaign] = useState(null);
  const [toast, setToast] = useState('');
  const [done, setDone] = useState(false);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ full_name: '', phone: '', email: '' });

  useEffect(() => {
    api.getCampaignPublic(slug)
      .then(setCampaign)
      .catch((err) => setError(err.message || 'Campanha não encontrada'));
  }, [slug]);

  const fabioHref = resolveFabioWhatsApp(campaign?.whatsapp_url);

  async function onSubmit(e) {
    e.preventDefault();
    if (!form.full_name.trim() || !form.phone.trim()) {
      setToast('Nome e telefone são obrigatórios');
      return;
    }
    try {
      const res = await api.createRegistration(slug, {
        full_name: form.full_name,
        phone: form.phone,
        email: form.email,
        referral_code: code,
      });
      if (res?.already_registered) {
        if (res.full_name) setForm((prev) => ({ ...prev, full_name: res.full_name }));
        setAlreadyRegistered(true);
        setDone(true);
        setToast('Você já tem cadastro');
      } else {
        setAlreadyRegistered(false);
        setDone(true);
        setToast('Cadastro confirmado');
      }
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
        {!done ? <p>Preencha seus dados para confirmar.</p> : null}

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

        {done && alreadyRegistered ? (
          <AlreadyRegisteredScreen
            fullName={form.full_name}
            whatsappUrl={campaign?.whatsapp_url}
          />
        ) : null}

        {done && !alreadyRegistered && (
          <div className="event-done event-qr-done">
            <p className="eyebrow">Tudo certo</p>
            <h2 className="event-qr-done__hello">
              Obrigado, {firstName(form.full_name)}!
            </h2>
            <p className="event-done__lead">
              Seu cadastro foi registrado com sucesso.
            </p>
            <div className="event-qr-done__box">
              <h3>Quer falar com o Fábio?</h3>
              <p>Clique no link abaixo e abra a conversa no WhatsApp.</p>
              <a
                className="btn btn-whatsapp event-done__cta"
                href={fabioHref}
                target="_blank"
                rel="noreferrer"
              >
                Falar com Fábio no WhatsApp
              </a>
            </div>
          </div>
        )}

        {!campaign && !error && <EmptyState>Preparando formulário…</EmptyState>}
      </div>
      <Toast message={toast} onClose={() => setToast('')} />
    </div>
  );
}
