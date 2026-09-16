import { useEffect, useState } from 'react';
import { api } from '../api';
import { EmptyState, Toast } from './Ui';

export default function LinksPanel({ campaignSlug }) {
  const [links, setLinks] = useState([]);
  const [filter, setFilter] = useState('');
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  async function load() {
    const origin = window.location.origin;
    const list = await api.getLinks(campaignSlug, origin);
    setLinks(list);
  }

  useEffect(() => {
    load()
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

  async function removeLink(link) {
    const count = Number(link.registrations_count || 0);
    const msg = count > 0
      ? `Excluir o link/QR de "${link.name}"?\n\nO link fica inativo.\nOs ${count} cadastro(s) continuam no Registro de cadastros.`
      : `Excluir o link/QR de "${link.name}"?\n\nO link fica inativo.`;
    if (!window.confirm(msg)) return;
    setDeletingId(link.leader_id);
    try {
      await api.deleteLeader(campaignSlug, link.leader_id);
      setToast('Link/QR excluído — cadastros mantidos');
      await load();
    } catch (err) {
      setToast(err.message || 'Falha ao excluir');
    } finally {
      setDeletingId(null);
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
          <p>Cada liderança possui um link único. Dá para copiar ou excluir o link/QR (cadastros ficam na Base).</p>
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
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => removeLink(link)}
                disabled={deletingId === link.leader_id}
              >
                {deletingId === link.leader_id ? 'Excluindo…' : 'Excluir'}
              </button>
            </div>
          </div>
        ))}
        {!filtered.length && <EmptyState>Nenhum link encontrado.</EmptyState>}
      </div>
      <Toast message={toast} onClose={() => setToast('')} />
    </section>
  );
}
