import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../api';
import { EmptyState, Toast } from '../components/Ui';

const emptyForm = {
  municipality_id: '',
  category: 'infraestrutura',
  description: '',
  amount: '',
  notes: '',
};

function brl(n) {
  return Number(n || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function MuniCard({ muni, totalCount, defaultOpenCategory = 'infraestrutura' }) {
  const [open, setOpen] = useState(() => {
    const init = {};
    for (const cat of muni.categories || []) {
      init[cat.category] = cat.category === defaultOpenCategory;
    }
    return init;
  });

  function toggle(catId) {
    setOpen((prev) => ({ ...prev, [catId]: !prev[catId] }));
  }

  return (
    <article className="dossier-card">
      <p className="dossier-card__index">
        Município {String(muni.index).padStart(2, '0')} / {String(totalCount).padStart(2, '0')}
      </p>
      <h3 className="dossier-card__title">
        O deputado Federal que mais investiu em{' '}
        <em>{muni.municipality_name}</em>
      </h3>
      <p className="dossier-card__total">
        Total viabilizado no município{' '}
        <strong>{brl(muni.total)}</strong>
      </p>

      <div className="dossier-cats">
        {(muni.categories || []).map((cat) => {
          const isOpen = Boolean(open[cat.category]);
          return (
            <div className="dossier-cat" key={cat.category}>
              <button
                type="button"
                className={`dossier-cat__head ${isOpen ? 'is-open' : ''}`}
                style={{ '--cat-color': cat.category_color }}
                onClick={() => toggle(cat.category)}
                aria-expanded={isOpen}
              >
                <span className="dossier-cat__pill">
                  <span className="dossier-cat__arrow" aria-hidden>{isOpen ? '▾' : '▸'}</span>
                  {String(cat.category_label || '').toUpperCase()}
                </span>
                <span className="dossier-cat__meta">
                  {cat.count} {cat.count === 1 ? 'item' : 'itens'}
                  <strong>{brl(cat.total)}</strong>
                </span>
              </button>
              {isOpen && (
                <ul className="dossier-cat__list">
                  {cat.items.map((item) => (
                    <li key={item.id}>
                      <span>{item.description}</span>
                      <strong>{brl(item.amount)}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {muni.footnote ? (
        <p className="dossier-card__note">{muni.footnote}</p>
      ) : null}
    </article>
  );
}

export default function InvestmentReportPage() {
  const { campaign } = useOutletContext();
  const [mode, setMode] = useState('dossie');
  const [dossier, setDossier] = useState(null);
  const [municipalities, setMunicipalities] = useState([]);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [filterMuni, setFilterMuni] = useState('');

  async function load() {
    try {
      const [res, munis] = await Promise.all([
        api.getInvestments(campaign.slug),
        api.getMunicipalities().catch(() => []),
      ]);
      setDossier(res);
      setMunicipalities(Array.isArray(munis) ? munis : []);
      setError('');
    } catch (err) {
      setError(err.message || 'Erro ao carregar dossiê');
    }
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [campaign.slug]);

  const visibleMunis = useMemo(() => {
    const list = dossier?.municipalities || [];
    if (!filterMuni) return list;
    return list.filter((m) => String(m.municipality_id) === String(filterMuni));
  }, [dossier, filterMuni]);

  const flatItems = dossier?.items || [];

  async function onSubmit(e) {
    e.preventDefault();
    try {
      const payload = {
        ...form,
                    amount: (() => {
                      const s = String(form.amount || '').trim();
                      if (!s) return 0;
                      if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.')) || 0;
                      return Number(s) || 0;
                    })(),
        municipality_id: Number(form.municipality_id),
      };
      if (editingId) {
        await api.updateInvestment(campaign.slug, editingId, payload);
        setToast('Item atualizado');
      } else {
        await api.createInvestment(campaign.slug, payload);
        setToast('Item adicionado ao dossiê');
      }
      setForm(emptyForm);
      setEditingId(null);
      setShowForm(false);
      await load();
    } catch (err) {
      setToast(err.message);
    }
  }

  function startEdit(item) {
    setEditingId(item.id);
    setForm({
      municipality_id: item.municipality_id || '',
      category: item.category || 'infraestrutura',
      description: item.description || '',
      amount: String(item.amount ?? ''),
      notes: item.notes || '',
    });
    setShowForm(true);
    setMode('cadastro');
  }

  async function removeItem(item) {
    try {
      await api.deleteInvestment(campaign.slug, item.id);
      setToast('Item removido');
      await load();
    } catch (err) {
      setToast(err.message);
    }
  }

  const candidate = campaign.candidate || 'Fábio Garcia';
  const totalCount = dossier?.municipality_count || visibleMunis.length || 0;

  return (
    <div className="dossier-page report-page">
      <div className="container section" style={{ paddingTop: 0 }}>
        <div className="section__head no-print">
          <p className="eyebrow">Dossiê regional · MT</p>
          <h2>Investimento</h2>
          <p>
            Levantamento do que o deputado viabilizou por município — infraestrutura, saúde,
            agricultura e regularização. Sem Meta/Instagram: só o relatório.
          </p>
          <div className="chip-group" style={{ marginTop: '0.75rem' }}>
            <button
              type="button"
              className={`chip ${mode === 'dossie' ? 'active' : ''}`}
              onClick={() => setMode('dossie')}
            >
              Dossiê
            </button>
            <button
              type="button"
              className={`chip ${mode === 'cadastro' ? 'active' : ''}`}
              onClick={() => setMode('cadastro')}
            >
              Cadastrar itens
            </button>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.85rem' }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}>
              Imprimir / PDF
            </button>
            {mode === 'cadastro' && (
              <button
                type="button"
                className="btn btn-accent btn-sm"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm);
                  setShowForm((v) => !v);
                }}
              >
                {showForm ? 'Fechar formulário' : 'Novo item'}
              </button>
            )}
          </div>
        </div>

        {error && <EmptyState>{error}</EmptyState>}

        {/* ===== DOSSIÊ ===== */}
        <div className={mode === 'dossie' ? '' : 'dossier-screen-print-only'}>
          <header className="dossier-hero">
            <p className="dossier-hero__eyebrow">
              {dossier?.eyebrow || 'Dossiê regional · Estado de Mato Grosso'}
            </p>
            <h1>{dossier?.title || 'Investimentos por Município'}</h1>
            <p className="dossier-hero__lead">
              {dossier?.subtitle
                || 'Levantamento organizado por município, com o total viabilizado e a lista item a item.'}
            </p>
            {dossier && (
              <p className="dossier-hero__sum">
                <strong>{brl(dossier.grand_total)}</strong>
                <span>
                  · {dossier.municipality_count} município(s) · {dossier.item_count} item(ns)
                  · {candidate}
                </span>
              </p>
            )}
          </header>

          <div className="no-print dossier-filter">
            <label>
              Filtrar município
              <select
                className="select"
                value={filterMuni}
                onChange={(e) => setFilterMuni(e.target.value)}
              >
                <option value="">Todos os do dossiê</option>
                {(dossier?.municipalities || []).map((m) => (
                  <option key={m.municipality_id} value={m.municipality_id}>
                    {m.municipality_name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {visibleMunis.length ? (
            <div className="dossier-grid">
              {visibleMunis.map((muni) => (
                <MuniCard
                  key={muni.municipality_id}
                  muni={muni}
                  totalCount={totalCount}
                />
              ))}
            </div>
          ) : (
            <EmptyState>
              Ainda sem itens no dossiê. Vá em <strong>Cadastrar itens</strong> e lance por município.
            </EmptyState>
          )}
        </div>

        {/* ===== CADASTRO ===== */}
        {mode === 'cadastro' && (
          <div className="no-print" style={{ marginTop: '1.25rem' }}>
            {showForm && (
              <form className="panel panel-pad form-grid" onSubmit={onSubmit} style={{ marginBottom: '1rem' }}>
                <h3 style={{ marginTop: 0 }}>{editingId ? 'Editar item' : 'Novo item do dossiê'}</h3>
                <label>
                  Município *
                  <select
                    className="select"
                    required
                    value={form.municipality_id}
                    onChange={(e) => setForm({ ...form, municipality_id: e.target.value })}
                  >
                    <option value="">Selecione</option>
                    {municipalities.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Categoria *
                  <select
                    className="select"
                    required
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  >
                    {(dossier?.categories || []).map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Valor (R$) *
                  <input
                    className="input"
                    required
                    inputMode="decimal"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder="Ex.: 1700000 ou 1.700.000,00"
                  />
                </label>
                <label style={{ gridColumn: '1 / -1' }}>
                  Descrição do item *
                  <input
                    className="input"
                    required
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Ex.: Ponte de concreto sobre o Ribeirão Gato Preto, MT-481 (60 m)"
                  />
                </label>
                <label style={{ gridColumn: '1 / -1' }}>
                  Observação (opcional)
                  <input
                    className="input"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </label>
                <button className="btn btn-primary" type="submit">
                  {editingId ? 'Salvar' : 'Adicionar ao dossiê'}
                </button>
              </form>
            )}

            <section className="panel panel-pad">
              <h3 style={{ marginTop: 0 }}>Itens cadastrados</h3>
              {flatItems.length ? (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Município</th>
                        <th>Categoria</th>
                        <th>Descrição</th>
                        <th>Valor</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {flatItems.map((item) => (
                        <tr key={item.id}>
                          <td>{item.municipality_name}</td>
                          <td>{item.category_label}</td>
                          <td>{item.description}</td>
                          <td>{brl(item.amount)}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <button type="button" className="btn btn-soft btn-sm" onClick={() => startEdit(item)}>
                              Editar
                            </button>{' '}
                            <button type="button" className="btn btn-danger btn-sm" onClick={() => removeItem(item)}>
                              Remover
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState>Nenhum item ainda.</EmptyState>
              )}
            </section>
          </div>
        )}

        <Toast message={toast} onClose={() => setToast('')} />
      </div>
    </div>
  );
}
