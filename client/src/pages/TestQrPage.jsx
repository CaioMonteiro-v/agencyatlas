import { useOutletContext } from 'react-router-dom';

const TEST_WA_URL =
  'https://wa.me/5561998522334?text=Ol%C3%A1%2C%20queria%20falar%20com%20o%20F%C3%A1bio.';

/**
 * Aba temporária de teste — QR direto pro WhatsApp do Fábio.
 * Remover quando o teste acabar.
 */
export default function TestQrPage() {
  const { campaign } = useOutletContext();

  return (
    <div className="container section">
      <div className="panel panel-pad" style={{ maxWidth: 520, margin: '0 auto' }}>
        <p className="eyebrow" style={{ marginBottom: 4 }}>Temporário</p>
        <h2 style={{ marginTop: 0 }}>Cadastro teste · QR</h2>
        <p style={{ color: 'var(--muted)', marginTop: 0 }}>
          Aba de teste da campanha <strong>{campaign?.name || '—'}</strong>.
          Este QR abre o WhatsApp do Fábio com mensagem pronta. Pode retirar a aba depois.
        </p>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
            padding: '1.25rem 0',
          }}
        >
          <img
            src="/qr-teste-fabio.png"
            alt="QR Code teste — WhatsApp Fábio"
            width={280}
            height={280}
            style={{
              width: 'min(280px, 80vw)',
              height: 'auto',
              background: '#fff',
              borderRadius: 12,
              padding: 12,
              boxShadow: '0 1px 0 rgba(0,0,0,0.06)',
            }}
          />
          <p style={{ margin: 0, textAlign: 'center', fontSize: '0.95rem' }}>
            Destino: WhatsApp <strong>5561998522334</strong>
            <br />
            Mensagem: “Olá, queria falar com o Fábio.”
          </p>
          <a
            className="btn btn-whatsapp"
            href={TEST_WA_URL}
            target="_blank"
            rel="noreferrer"
          >
            Abrir WhatsApp (mesmo link do QR)
          </a>
        </div>
      </div>
    </div>
  );
}
