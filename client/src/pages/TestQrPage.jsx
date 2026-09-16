import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../api';
import { EmptyState, Toast } from '../components/Ui';

const TEST_MOB_NAME = 'teste';
const TEST_MOB_CODE = 'teste';

/**
 * Aba temporária: mobilizador "teste" + QR de cadastro real.
 * Quem lê o QR preenche nome/telefone → cai na Base creditado em "teste".
 */
export default function TestQrPage() {
  const { campaign } = useOutletContext();
  const [mobilizer, setMobilizer] = useState(null);
  const [qr, setQr] = useState(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let alive = true;
    async function setup() {
      setBusy(true);
      setError('');
      try {
        const list = await api.getMobilizers(campaign.slug);
        let mob = (list || []).find(
          (m) => String(m.code).toLowerCase() === TEST_MOB_CODE
            || String(m.name).toLowerCase() === TEST_MOB_NAME,
        );
        if (!mob) {
          mob = await api.createMobilizer(campaign.slug, {
            name: TEST_MOB_NAME,
            code: TEST_MOB_CODE,
            notes: 'Mobilizador temporário da aba Teste',
          });
        }
        const origin = window.location.origin.replace(/\/$/, '');
        const qrRes = await api.getMobilizerQrcode(campaign.slug, mob.id, origin, 1024);
        if (!alive) return;
        setMobilizer({
          ...mob,
          registrations: mob.registrations ?? 0,
          link_path: mob.link_path || `/m/${campaign.slug}/${mob.code}`,
        });
        setQr(qrRes);
        // Atualiza contagem
        const refreshed = await api.getMobilizers(campaign.slug);
        const current = (refreshed || []).find((m) => m.id === mob.id);
        if (alive && current) setMobilizer(current);
      } catch (err) {
        if (alive) setError(err.message || 'Falha ao preparar QR de teste');
      } finally {
        if (alive) setBusy(false);
      }
    }
    setup();
    return () => { alive = false; };
  }, [campaign.slug]);

  async function copyLink() {
    const url = qr?.url || (mobilizer ? `${window.location.origin}${mobilizer.link_path}` : '');
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setToast('Link de cadastro copiado');
    } catch {
      setToast(url);
    }
  }

  const fullLink = qr?.url
    || (mobilizer ? `${window.location.origin.replace(/\/$/, '')}${mobilizer.link_path}` : '');

  return (
    <div className="container section">
      <div className="panel panel-pad" style={{ maxWidth: 560, margin: '0 auto' }}>
        <p className="eyebrow" style={{ marginBottom: 4 }}>Temporário</p>
        <h2 style={{ marginTop: 0 }}>Teste · mobilizador teste</h2>
        <p style={{ color: 'var(--muted)', marginTop: 0 }}>
          QR de <strong>cadastro real</strong>. Quem ler preenche nome e telefone;
          o cadastro entra na Base creditado no mobilizador <strong>teste</strong>
          (e depois pode falar com o Fábio no WhatsApp).
        </p>

        {error ? <EmptyState>{error}</EmptyState> : null}
        {busy && !qr ? <EmptyState>Preparando mobilizador teste e QR…</EmptyState> : null}

        {mobilizer && qr?.qrcode ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.85rem',
              padding: '1rem 0',
            }}
          >
            <div className="coord-mini-stats" style={{ width: '100%', marginBottom: '0.25rem' }}>
              <div>
                <strong>{mobilizer.name}</strong>
                <span>Mobilizador</span>
              </div>
              <div>
                <strong>{mobilizer.registrations ?? 0}</strong>
                <span>Cadastros neste QR</span>
              </div>
              <div>
                <strong><code>{mobilizer.code}</code></strong>
                <span>Código</span>
              </div>
            </div>

            <img
              src={qr.qrcode}
              alt="QR Code cadastro mobilizador teste"
              width={280}
              height={280}
              style={{
                width: 'min(280px, 80vw)',
                height: 'auto',
                background: '#fff',
                borderRadius: 12,
                padding: 12,
              }}
            />

            <p style={{ margin: 0, textAlign: 'center', fontSize: '0.9rem', wordBreak: 'break-all' }}>
              {fullLink}
            </p>
            {qr.warning ? (
              <p className="meta-hint" style={{ margin: 0, textAlign: 'center' }}>{qr.warning}</p>
            ) : null}

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button type="button" className="btn btn-soft btn-sm" onClick={copyLink}>
                Copiar link
              </button>
              <a className="btn btn-primary btn-sm" href={fullLink} target="_blank" rel="noreferrer">
                Abrir formulário de cadastro
              </a>
            </div>
          </div>
        ) : null}
      </div>
      <Toast message={toast} onClose={() => setToast('')} />
    </div>
  );
}
