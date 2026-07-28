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
    want_whatsapp: false,
  });

  useEffect(() => {
    if (!eventSlug) {
      setError('Evento inválido');
      return;
    }
    api.getEvent(eventSlug)
      .then(setEvent)
      .catch((err) => {
        const msg = err.message || 'Erro ao carregar evento';
        if (/failed to fetch|network|load failed/i.test(msg)) {
          setError('Não foi possível conectar à API. Se você abriu pelo QR com localhost, use o IP da rede ou a URL do deploy.');
        } else if (/não encontrado|404/i.test(msg)) {
          setError('Evento não encontrado. Confira se o QR Code está atualizado.');
        } else {
          setError(msg);
        }
      });
  }, [eventSlug]);

  async function onSubmit(e) {
    e.preventDefault();
    if (!form.full_name.trim()) {
      setToast('Nome completo é obrigatório');
      return;
    }
    try {
      const res = await api.registerEvent(eventSlug, {
        full_name: form.full_name,
        email: form.email,
        phone: form.phone,
        connect_whatsapp: form.want_whatsapp,
      });
      setWhatsappUrl(res.whatsapp_url || 'https://bit.ly/FalaFabio');
      setDone(true);
      setToast('Inscrição salva no sistema da campanha');
      // NÃO abre WhatsApp automaticamente — só se a pessoa pedir no botão depois
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
                <h3>Inscrição confirmada</h3>
                <p>
                  Seus dados foram salvos para a equipe da campanha acompanhar.
                  Você não precisa falar no WhatsApp para a inscrição valer.
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {form.want_whatsapp && (
                    <a className="btn btn-whatsapp" href={whatsappUrl} target="_blank" rel="noreferrer">
                      Quero falar no WhatsApp
                    </a>
                  )}
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
                    checked={form.want_whatsapp}
                    onChange={(e) => setForm({ ...form, want_whatsapp: e.target.checked })}
                  />
                  Depois quero também um botão para falar no WhatsApp da campanha
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
