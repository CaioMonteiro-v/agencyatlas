import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import { EmptyState, Toast } from '../components/Ui';

export default function EventRegistrationPage() {
  const { eventSlug } = useParams();
  const [event, setEvent] = useState(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
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
          setError('Não foi possível conectar à API. Confira se a URL do QR está correta (não use localhost).');
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
    if (!form.phone.trim()) {
      setToast('Telefone é obrigatório');
      return;
    }
    try {
      await api.registerEvent(eventSlug, {
        full_name: form.full_name,
        email: form.email,
        phone: form.phone,
        connect_whatsapp: false,
      });
      setDone(true);
      setToast('Presença confirmada');
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
            <p style={{ fontSize: '0.92rem' }}>
              Esta página é apenas para confirmar presença. Não há acesso ao painel da campanha.
            </p>

            {done ? (
              <div>
                <h3>Presença confirmada</h3>
                <p>
                  Obrigado, {form.full_name.split(' ')[0]}! Seu cadastro foi registrado.
                  Você já pode fechar esta página.
                </p>
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
                  E-mail
                  <input
                    className="input"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="Para comunicação e tráfego"
                  />
                </label>
                <button className="btn btn-primary" type="submit">Confirmar presença</button>
              </form>
            )}
          </>
        )}
      </div>
      <Toast message={toast} onClose={() => setToast('')} />
    </div>
  );
}
