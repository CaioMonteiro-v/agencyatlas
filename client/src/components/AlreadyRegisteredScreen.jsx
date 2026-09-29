/** WhatsApp oficial da campanha (mensagem pronta / click-to-chat). */
export const FABIO_WHATSAPP_URL = 'https://wa.me/message/PV764OTMN3GEE1';

export function firstName(full) {
  return String(full || '').trim().split(/\s+/)[0] || '';
}

export function normalizeExternalUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

/**
 * Link do Fábio: usa o wa.me/message oficial.
 * Não acrescenta ?text= em links /message/ (quebra o convite).
 */
export function resolveFabioWhatsApp(campaignUrl) {
  const fromCampaign = normalizeExternalUrl(campaignUrl);
  if (/wa\.me\/message\//i.test(fromCampaign)) return fromCampaign;
  return FABIO_WHATSAPP_URL;
}

/**
 * Tela quando a pessoa já tem cadastro (mesmo telefone):
 * não conta de novo — só reapresenta o convite do Fábio.
 */
export default function AlreadyRegisteredScreen({
  fullName,
  whatsappUrl,
  onOpenWhatsApp,
}) {
  const href = resolveFabioWhatsApp(whatsappUrl);
  const name = firstName(fullName) || 'você';

  return (
    <div className="event-done event-qr-done">
      <p className="eyebrow">Cadastro já existe</p>
      <h2 className="event-qr-done__hello">
        {name}, você já tem cadastro!
      </h2>
      <p className="event-done__lead">
        Não precisamos cadastrar de novo. Seu primeiro registro já está no sistema.
      </p>

      <div className="event-qr-done__box">
        <h3>Já falou com o Fábio?</h3>
        <p>Clique no link abaixo e abra a conversa no WhatsApp.</p>
        <a
          className="btn btn-whatsapp event-done__cta"
          href={href}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => {
            if (typeof onOpenWhatsApp === 'function') {
              e.preventDefault();
              onOpenWhatsApp(href);
            }
          }}
        >
          Falar com Fábio no WhatsApp
        </a>
      </div>
    </div>
  );
}
