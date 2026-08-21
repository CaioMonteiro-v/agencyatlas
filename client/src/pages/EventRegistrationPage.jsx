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

function normalizeExternalUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

export default function EventRegistrationPage() {
  const { eventSlug } = useParams();
  const [event, setEvent] = useState(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [done, setDone] = useState(false);
  const [waOpened, setWaOpened] = useState(false);
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
      .then((ev) => setEvent(ev))
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

  const hasChannel = Boolean(String(event?.channel_link || '').trim());
  const channelHref = hasChannel ? normalizeExternalUrl(event.channel_link) : '';
  const municipio = String(event?.municipality_name || event?.location || '').trim() || 'Mato Grosso';
  const channelLabel = String(event?.channel_name || '').trim() || 'nosso grupo de elite';

  const waMessage = event
    ? `Olá, Fábio! Sou ${firstName(form.full_name) || 'de Mato Grosso'} e acabei de me cadastrar no evento "${event.name}". Quero apoiar a campanha a deputado federal.`
    : '';

  const fabioHref = buildWhatsAppLink(event?.whatsapp_url, waMessage);
  const ctaHref = hasChannel ? channelHref : fabioHref;

  function openCta() {
    setWaOpened(true);
    window.open(ctaHref, '_blank', 'noopener,noreferrer');
  }

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
        email: form.email.trim() || null,
        phone: form.phone,
        connect_whatsapp: true,
      });
      setDone(true);
      setToast('Presença confirmada');

      const href = hasChannel
        ? normalizeExternalUrl(event.channel_link)
        : buildWhatsAppLink(
          event?.whatsapp_url,
          `Olá, Fábio! Sou ${firstName(form.full_name) || 'de Mato Grosso'} e acabei de me cadastrar no evento "${event?.name || ''}". Quero apoiar a campanha a deputado federal.`,
        );

      // Abre o destino na sequência do cadastro (melhor no celular)
      window.setTimeout(() => {
        try {
          window.location.href = href;
          setWaOpened(true);
        } catch {
          /* usuário usa o botão abaixo */
        }
      }, 450);
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
              {event.municipality_name || event.location
                ? ` · ${event.municipality_name || event.location}`
                : ''}
            </p>
            <p>{event.description}</p>

            {done ? (
              <div className="event-done">
                <h3>Presença confirmada</h3>
                <p>
                  Obrigado, {firstName(form.full_name)}! Seu cadastro foi registrado.
                </p>

                {hasChannel ? (
                  <>
                    <p className="event-done__lead">
                      Você acabou de fazer parte da nossa história em {municipio}.
                      Quero te convidar para o nosso grupo de elite, {channelLabel} —
                      aqui só entra quem realmente faz parte da mudança.
                    </p>
                    <a
                      className="btn btn-whatsapp event-done__cta"
                      href={ctaHref}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => setWaOpened(true)}
                    >
                      Entrar no canal
                    </a>
                    <button type="button" className="btn btn-soft" onClick={openCta}>
                      Abrir de novo
                    </button>
                    <p style={{ fontSize: '0.88rem', color: 'var(--muted)', marginBottom: 0 }}>
                      {waOpened
                        ? 'Se o WhatsApp não abriu, toque no botão verde acima.'
                        : 'Convite exclusivo do canal municipal deste evento.'}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="event-done__lead">
                      Agora leve o contato do Fábio Garcia no WhatsApp — assim você sai do evento já conectado à campanha a deputado federal.
                    </p>
                    <a
                      className="btn btn-whatsapp event-done__cta"
                      href={fabioHref}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => setWaOpened(true)}
                    >
                      Falar com Fábio no WhatsApp
                    </a>
                    <button type="button" className="btn btn-soft" onClick={openCta}>
                      Abrir de novo
                    </button>
                    <p style={{ fontSize: '0.88rem', color: 'var(--muted)', marginBottom: 0 }}>
                      {waOpened
                        ? 'Se o WhatsApp não abriu, toque no botão verde acima.'
                        : 'Link: bit.ly/FalaFabio · mensagem pronta se o app permitir.'}
                    </p>
                  </>
                )}
              </div>
            ) : (
              <>
                <p style={{ fontSize: '0.92rem' }}>
                  {hasChannel
                    ? 'Confirme sua presença. Em seguida você recebe o convite do canal municipal.'
                    : 'Confirme sua presença. Em seguida você já pode falar com o Fábio no WhatsApp.'}
                </p>
                <form className="form-grid" onSubmit={onSubmit}>
                  <label>
                    Nome completo *
                    <input
                      className="input"
                      required
                      value={form.full_name}
                      onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                      autoComplete="name"
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
                      autoComplete="tel"
                      inputMode="tel"
                    />
                  </label>
                  <label>
                    E-mail <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(opcional)</span>
                    <input
                      className="input"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="Se quiser receber novidades da campanha"
                      autoComplete="email"
                    />
                  </label>
                  <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--muted)' }}>
                    E-mail não é obrigatório — mas se colocar, ajuda bastante na comunicação.
                  </p>
                  <button className="btn btn-primary" type="submit">
                    {hasChannel ? 'Confirmar presença' : 'Confirmar e falar com o Fábio'}
                  </button>
                </form>
              </>
            )}
          </>
        )}
      </div>
      <Toast message={toast} onClose={() => setToast('')} />
    </div>
  );
}
