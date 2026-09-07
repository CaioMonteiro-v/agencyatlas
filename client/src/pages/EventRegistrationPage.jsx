import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import AlreadyRegisteredScreen, {
  FABIO_WHATSAPP_URL,
  firstName,
  normalizeExternalUrl,
  resolveFabioWhatsApp,
} from '../components/AlreadyRegisteredScreen';
import { EmptyState, Toast } from '../components/Ui';

export { FABIO_WHATSAPP_URL };

/** Conta clique no Bitly sem abrir a página. */
function trackBitlyClick(url) {
  const href = normalizeExternalUrl(url);
  if (!href) return;
  try {
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.src = href;
  } catch {
    /* ignore */
  }
  try {
    fetch(href, { mode: 'no-cors', credentials: 'omit', cache: 'no-store' }).catch(() => {});
  } catch {
    /* ignore */
  }
}

export default function EventRegistrationPage() {
  const { eventSlug } = useParams();
  const [event, setEvent] = useState(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [done, setDone] = useState(false);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [busy, setBusy] = useState(false);
  const [openedHint, setOpenedHint] = useState(false);
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

  const fabioHref = resolveFabioWhatsApp(event?.whatsapp_url);
  const bitlyInvite = normalizeExternalUrl(event?.invite_bitly_url);
  const channelInvite = normalizeExternalUrl(event?.channel_link);

  function openFabioWhatsApp(href = fabioHref) {
    if (bitlyInvite) trackBitlyClick(bitlyInvite);
    setOpenedHint(true);
    window.open(href || fabioHref, '_blank', 'noopener,noreferrer');
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!form.full_name.trim()) {
      setToast('Informe seu nome');
      return;
    }
    if (!form.phone.trim()) {
      setToast('Informe seu telefone');
      return;
    }
    setBusy(true);
    try {
      const res = await api.registerEvent(eventSlug, {
        full_name: form.full_name,
        email: form.email.trim() || null,
        phone: form.phone,
        connect_whatsapp: true,
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
    } finally {
      setBusy(false);
    }
  }

  const whenLabel = event
    ? [
        new Date(`${event.event_date}T00:00:00`).toLocaleDateString('pt-BR'),
        event.event_time || null,
        event.municipality_name || event.location || null,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    <div className="public-page">
      <div className="public-card event-qr-card">
        {error && <EmptyState>{error}</EmptyState>}
        {!event && !error && <EmptyState>Carregando…</EmptyState>}

        {event && !done && (
          <>
            <p className="eyebrow">{event.campaign_name || 'Campanha Fábio Garcia'}</p>
            <h1 className="event-qr-card__title">{event.name}</h1>
            {whenLabel ? <p className="event-qr-card__meta">{whenLabel}</p> : null}
            {event.description ? <p className="event-qr-card__desc">{event.description}</p> : null}

            <p className="event-qr-card__intro">
              Preencha seus dados para confirmar presença.
            </p>

            <form className="form-grid event-qr-form" onSubmit={onSubmit}>
              <label>
                Nome completo *
                <input
                  className="input"
                  required
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="Seu nome"
                  autoComplete="name"
                  autoFocus
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
                E-mail{' '}
                <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(opcional)</span>
                <input
                  className="input"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="Opcional"
                  autoComplete="email"
                />
              </label>
              <button className="btn btn-primary event-qr-form__ok" type="submit" disabled={busy}>
                {busy ? 'Salvando…' : 'OK · Confirmar'}
              </button>
            </form>
          </>
        )}

        {event && done && alreadyRegistered ? (
          <AlreadyRegisteredScreen
            fullName={form.full_name}
            whatsappUrl={event.whatsapp_url}
            onOpenWhatsApp={openFabioWhatsApp}
          />
        ) : null}

        {event && done && !alreadyRegistered && (
          <div className="event-done event-qr-done">
            <p className="eyebrow">Tudo certo</p>
            <h2 className="event-qr-done__hello">
              Obrigado, {firstName(form.full_name)}!
            </h2>
            <p className="event-done__lead">
              Sua presença foi confirmada
              {event.municipality_name || event.location
                ? ` em ${event.municipality_name || event.location}`
                : ''}
              .
            </p>

            <div className="event-qr-done__box">
              <h3>Quer falar com o Fábio?</h3>
              <p>Clique no link abaixo e abra a conversa no WhatsApp.</p>
              <a
                className="btn btn-whatsapp event-done__cta"
                href={fabioHref}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => {
                  e.preventDefault();
                  openFabioWhatsApp();
                }}
              >
                Falar com Fábio no WhatsApp
              </a>
              {openedHint ? (
                <p className="meta-hint" style={{ marginBottom: 0 }}>
                  Se o WhatsApp não abriu, toque de novo no botão verde.
                </p>
              ) : null}
            </div>

            {channelInvite ? (
              <p className="event-qr-done__channel">
                Também há convite do canal local:{' '}
                <a href={channelInvite} target="_blank" rel="noreferrer">
                  entrar no grupo
                </a>
              </p>
            ) : null}
          </div>
        )}
      </div>
      <Toast message={toast} onClose={() => setToast('')} />
    </div>
  );
}
