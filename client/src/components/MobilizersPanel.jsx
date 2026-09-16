import { useEffect, useState } from 'react';
import { api } from '../api';
import { EmptyState, Toast } from './Ui';

export default function MobilizersPanel({ campaignSlug }) {
  const [items, setItems] = useState([]);
  const [toast, setToast] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', code: '' });
  const origin = window.location.origin.replace(/\/$/, '');

  async function load() {
    const list = await api.getMobilizers(campaignSlug);
    setItems(list);
  }

  useEffect(() => {
    load().catch((err) => setToast(err.message));
  }, [campaignSlug]);

  async function onCreate(e) {
    e.preventDefault();
    try {
      await api.createMobilizer(campaignSlug, form);
      setForm({ name: '', phone: '', code: '' });
      setShowForm(false);
      setToast('Mobilizador criado com código pessoal');
      await load();
    } catch (err) {
      setToast(err.message);
    }
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      setToast('Link copiado');
    } catch {
      setToast(text);
    }
    setTimeout(() => setToast(''), 2200);
  }

  async function remove(item) {
    try {
      await api.deleteMobilizer(campaignSlug, item.id);
      setToast(`${item.name} removido`);
      await load();
    } catch (err) {
      setToast(err.message);
    }
  }

  return (
    <section className="panel panel-pad">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <p className="eyebrow">Equipe de campo</p>
          <h3>Códigos pessoais de mobilizador</h3>
          <p>
            Cada pessoa da equipe ganha um link curto. Tudo que entrar por ele já nasce creditado
            na coluna Mobilizador da Base.
          </p>
        </div>
        <button type="button" className="btn btn-accent btn-sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Fechar' : 'Novo mobilizador'}
        </button>
      </div>

      {showForm && (
        <form className="form-grid" style={{ marginTop: '1rem' }} onSubmit={onCreate}>
          <label>
            Nome *
            <input
              className="input"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex.: Bianca Silvinio"
            />
          </label>
          <label>
            Código do link (opcional)
            <input
              className="input"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="Ex.: bianca"
            />
          </label>
          <label>
            Telefone
            <input
              className="input"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </label>
          <button className="btn btn-primary" type="submit">Criar código</button>
        </form>
      )}

      <div className="stack" style={{ marginTop: '1.1rem' }}>
        {items.map((item) => {
          const url = `${origin}${item.link_path}`;
          return (
            <article className="mission-card" key={item.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div>
                  <h4 style={{ marginBottom: 4 }}>{item.name}</h4>
                  <p style={{ marginBottom: 0 }}>
                    <code>/m/{campaignSlug}/{item.code}</code>
                  </p>
                  <p style={{ marginBottom: 0, color: 'var(--muted)' }}>
                    {item.registrations} cadastro(s) creditados
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-accent btn-sm" onClick={() => copy(url)}>
                    Copiar link
                  </button>
                  <a className="btn btn-soft btn-sm" href={url} target="_blank" rel="noreferrer">
                    Abrir
                  </a>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => remove(item)}>
                    Remover
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {!items.length && <EmptyState>Nenhum código pessoal ainda. Crie o da equipe.</EmptyState>}
      <Toast message={toast} onClose={() => setToast('')} />
    </section>
  );
}
