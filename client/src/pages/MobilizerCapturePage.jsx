import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import { EmptyState, Toast } from '../components/Ui';

function firstName(full) {
  return String(full || '').trim().split(/\s+/)[0] || '';
}

function buildWhatsAppLink(baseUrl, text) {
  const fallback = (baseUrl || 'https://bit.ly/FalaFabio').trim();
  try {
    const u = new URL(fallback);
    if (/wa\.me|api\.whatsapp\.com|whatsapp\.com/i.test(u.hostname)) {
      u.searchParams.set('text', text);
      return u.toString();
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

export default function MobilizerCapturePage() {
  const { slug, code } = useParams();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    organizer_name: '',
  });

  useEffect(() => {
    api.getMobilizerPublic(slug, code)
      .then(setInfo)
      .catch((err) => setError(err.message || 'Link inválido'));
  }, [slug, code]);

  const waHref = info
    ? buildWhatsAppLink(
      info.campaign.whatsapp_url,
      `Olá, Fábio! Sou ${firstName(form.full_name) || 'de Mato Grosso'} e me cadastrei com ${info.mobilizer.name}. Quero apoiar a campanha a deputado federal.`,
    )
    : 'https://bit.ly/FalaFabio';

  async function onSubmit(e) {
    e.preventDefault();
    if (!form.full_name.trim() || !form.phone.trim()) {
      setToast('Nome e telefone são obrigatórios');
      return;
    }
    try {
      await api.registerMobilizer(slug, code, form);
      setDone(true);
      setToast('Cadastro confirmado');
      window.setTimeout(() => {
        try {
          window.location.href = waHref;
        } catch {
          /* ignore */
        }
      }, 400);
    } catch (err) {
      setToast(err.message);
    }
  }

  return (
    <div className="public-page">
      <div className="public-card">
        {info?.campaign?.logo_url && (
          <img src={info.campaign.logo_url} alt="" style={{ height: 56, marginBottom: 12, objectFit: 'contain' }} />
        )}
        {error && <EmptyState>{error}</EmptyState>}
        {!info && !error && <EmptyState>Preparando formulário…</EmptyState>}

        {info && (
          <>
            <p className="eyebrow">{info.campaign.name}</p>
            <h1 style={{ fontSize: '1.7rem' }}>Cadastro com {info.mobilizer.name}</h1>
            <p>
              Confirme seus dados. O crédito deste cadastro fica com <strong>{info.mobilizer.name}</strong>.
              Em seguida você pode falar com o Fábio no WhatsApp.
            </p>

            {done ? (
              <div className="event-done">
                <h3>Cadastro confirmado</h3>
                <p>Obrigado, {firstName(form.full_name)}! Agora leve o contato do Fábio.</p>
                <a className="btn btn-whatsapp event-done__cta" href={waHref} target="_blank" rel="noreferrer">
                  Falar com Fábio no WhatsApp
                </a>
              </div>
            ) : (
              <form className="form-grid" onSubmit={onSubmit}>
                <label>
                  Nome completo *
                  <input
                    className="input"
                    required
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  />
                </label>
                <label>
                  Telefone *
                  <input
                    className="input"
                    required
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="(65) 9xxxx-xxxx"
                  />
                </label>
                <label>
                  Organizador / coordenador do município
                  <input
                    className="input"
                    value={form.organizer_name}
                    onChange={(e) => setForm({ ...form, organizer_name: e.target.value })}
                    placeholder="Referência local (opcional)"
                  />
                </label>
                <label>
                  E-mail
                  <input
                    className="input"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </label>
                <button className="btn btn-primary" type="submit">
                  Confirmar e falar com o Fábio
                </button>
              </form>
            )}
          </>
        )}
      </div>
      <Toast message={toast} onClose={() => setToast('')} />
    </div>
  );
}
