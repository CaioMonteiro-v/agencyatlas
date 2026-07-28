import { useEffect, useState } from 'react';
import { api } from '../api';
import { EmptyState, Toast } from './Ui';

export default function LinksPanel({ campaignSlug }) {
  const [links, setLinks] = useState([]);
  const [filter, setFilter] = useState('');
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const origin = window.location.origin;
    api.getLinks(campaignSlug, origin)
      .then(setLinks)
      .catch((err) => setError(err.message));
  }, [campaignSlug]);

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      setToast('Link copiado');
      setTimeout(() => setToast(''), 2000);
    } catch {
      setToast('Não foi possível copiar');
    }
  }

  const filtered = links.filter((l) => {
    if (!filter) return true;
    return l.type === filter;
  });

  return (
    <section className="panel panel-pad">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <p className="eyebrow">Rastreabilidade</p>
          <h3>Links parametrizados</h3>
          <p>Cada mobilizador possui um link único para identificar a origem dos cadastros.</p>
        </div>
        <div className="chip-group">
          {[
            { value: '', label: 'Todos' },
            { value: 'politica', label: 'Políticas' },
            { value: 'multiplicador', label: 'Multiplicadores' },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`chip ${filter === opt.value ? 'active' : ''}`}
              onClick={() => setFilter(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {error && <EmptyState>{error}</EmptyState>}

      <div className="stack" style={{ marginTop: '1rem' }}>
        {filtered.map((link) => (
          <div key={link.leader_id} className="event-card" style={{ padding: '0.95rem 1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div>
                <strong>{link.name}</strong>
                <div style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>
                  {link.type === 'politica' ? 'Liderança política' : 'Multiplicador'} · {link.registrations_count} cadastros
                </div>
              </div>
              <code style={{ fontSize: '0.8rem' }}>{link.referral_code}</code>
            </div>
            <div className="link-row">
              <code title={link.full_link}>{link.full_link}</code>
              <button type="button" className="btn btn-soft btn-sm" onClick={() => copy(link.full_link)}>
                Copiar
              </button>
              <a
                className="btn btn-soft btn-sm"
                href={`https://wa.me/?text=${encodeURIComponent(`Participe conosco: ${link.full_link}`)}`}
                target="_blank"
                rel="noreferrer"
              >
                WhatsApp
              </a>
            </div>
          </div>
        ))}
        {!filtered.length && <EmptyState>Nenhum link encontrado.</EmptyState>}
      </div>
      <Toast message={toast} onClose={() => setToast('')} />
    </section>
  );
}
