import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { EmptyState, Toast } from '../components/Ui';

export default function EventRegistrationPage() {
  const { eventSlug } = useParams();
  const [event, setEvent] = useState(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [done, setDone] = useState(false);
  const [whatsappUrl, setWhatsappUrl] = useState('https://bit.ly/FalaFabio');
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    connect_whatsapp: true,
  });

  useEffect(() => {
    api.getEvent(eventSlug)
      .then(setEvent)
      .catch((err) => setError(err.message));
  }, [eventSlug]);

  async function onSubmit(e) {
    e.preventDefault();
    if (!form.full_name.trim()) {
      setToast('Nome completo é obrigatório');
      return;
    }
    try {
      const res = await api.registerEvent(eventSlug, form);
      setWhatsappUrl(res.whatsapp_url || 'https://bit.ly/FalaFabio');
      setDone(true);
      setToast('Inscrição registrada com carinho');
      if (form.connect_whatsapp && form.phone) {
        window.open(res.whatsapp_url || 'https://bit.ly/FalaFabio', '_blank');
      }
    } catch (err) {
      setToast(err.message);
    }
  }

  return (
    <div className="public-page">
      <div className="public-card">
        {error && <EmptyState>{error}</EmptyState>}
        {!event && !error && <EmptyState>Carregando evento…</EmptyState>}
        {event && (
          <>
            <p className="eyebrow">{event.campaign_name}</p>
            <h1 style={{ fontSize: '1.8rem' }}>{event.name}</h1>
            <p>
              {new Date(event.event_date + 'T00:00:00').toLocaleDateString('pt-BR')}
              {event.event_time ? ` · ${event.event_time}` : ''}
              {event.location ? ` · ${event.location}` : ''}
            </p>
            <p>{event.description}</p>

            {done ? (
              <div>
                <h3>Obrigado por se inscrever</h3>
                <p>
                  Seus dados foram armazenados com segurança.
                  {!form.connect_whatsapp && ' Você optou por não conectar o WhatsApp agora — nome e e-mail ficam disponíveis para a equipe.'}
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <a className="btn btn-whatsapp" href={whatsappUrl} target="_blank" rel="noreferrer">
                    Abrir WhatsApp · bit.ly/FalaFabio
                  </a>
                  <Link className="btn btn-soft" to={`/campanha/${event.campaign_slug}`}>
                    Ir à campanha
                  </Link>
                </div>
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
                  E-mail
                  <input
                    className="input"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="Para comunicação e tráfego"
                  />
                </label>
                <label>
                  Telefone
                  <input
                    className="input"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="(65) 9xxxx-xxxx"
                  />
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={form.connect_whatsapp}
                    onChange={(e) => setForm({ ...form, connect_whatsapp: e.target.checked })}
                  />
                  Conectar telefone ao WhatsApp (bit.ly/FalaFabio)
                </label>
                <button className="btn btn-primary" type="submit">Confirmar inscrição</button>
              </form>
            )}
          </>
        )}
      </div>
      <Toast message={toast} onClose={() => setToast('')} />
    </div>
  );
}
