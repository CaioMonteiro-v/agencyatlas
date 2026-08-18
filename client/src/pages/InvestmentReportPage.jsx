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

function MuniCard({ muni, totalCount, defaultOpenCategory = 'infraestrutura', onAddItem }) {
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
      <div className="dossier-card__top">
        <p className="dossier-card__index">
          Município {String(muni.index).padStart(2, '0')} / {String(totalCount).padStart(2, '0')}
        </p>
        {onAddItem ? (
          <button type="button" className="btn btn-soft btn-sm no-print" onClick={onAddItem}>
            + Item
          </button>
        ) : null}
      </div>
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

  function parseAmount(raw) {
    const s = String(raw || '').trim();
    if (!s) return 0;
    if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.')) || 0;
    return Number(s) || 0;
  }

  function goLaunch(municipalityId = '') {
    setEditingId(null);
    setForm({
      ...emptyForm,
      municipality_id: municipalityId ? String(municipalityId) : '',
    });
    setMode('cadastro');
  }

  async function onSubmit(e) {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        amount: parseAmount(form.amount),
        municipality_id: Number(form.municipality_id),
      };
      if (editingId) {
        await api.updateInvestment(campaign.slug, editingId, payload);
        setToast('Item atualizado');
        setEditingId(null);
        setForm({ ...emptyForm, municipality_id: form.municipality_id, category: form.category });
      } else {
        await api.createInvestment(campaign.slug, payload);
        setToast('Item lançado no dossiê');
        // Mantém município/categoria para lançar o próximo rápido
        setForm({
          ...emptyForm,
          municipality_id: form.municipality_id,
          category: form.category,
        });
      }
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
            Aqui a equipe <strong>lança manualmente</strong> cada obra/emenda/viabilização por município.
            O dossiê monta sozinho os cards e os totais.
          </p>
          <div className="chip-group" style={{ marginTop: '0.75rem' }}>
            <button
              type="button"
              className={`chip ${mode === 'dossie' ? 'active' : ''}`}
              onClick={() => setMode('dossie')}
            >
              Ver dossiê
            </button>
            <button
              type="button"
              className={`chip ${mode === 'cadastro' ? 'active' : ''}`}
              onClick={() => goLaunch()}
            >
              Lançar itens
            </button>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.85rem' }}>
            <button type="button" className="btn btn-accent btn-sm" onClick={() => goLaunch()}>
              + Lançar item
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}>
              Imprimir / PDF
            </button>
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
                  onAddItem={() => goLaunch(muni.municipality_id)}
                />
              ))}
            </div>
          ) : (
            <EmptyState>
              Ainda sem itens. Clique em <strong>+ Lançar item</strong> e registre município, categoria, descrição e valor.
            </EmptyState>
          )}
        </div>

        {/* ===== CADASTRO ===== */}
        {mode === 'cadastro' && (
          <div className="no-print" style={{ marginTop: '0.5rem' }}>
            <div className="panel panel-pad dossier-howto" style={{ marginBottom: '1rem' }}>
              <h3 style={{ marginTop: 0 }}>Como lançar</h3>
              <ol className="dossier-howto__steps">
                <li>Escolha o <strong>município</strong> (ex.: Alto Araguaia).</li>
                <li>Escolha a <strong>categoria</strong>: Infraestrutura, Saúde, Agricultura ou Regularização.</li>
                <li>Escreva a <strong>descrição</strong> do item (obra, doação, emenda…).</li>
                <li>Informe o <strong>valor em R$</strong> e clique em <strong>Adicionar ao dossiê</strong>.</li>
              </ol>
              <p style={{ margin: '0.5rem 0 0', color: 'var(--muted)', fontSize: '0.9rem' }}>
                Depois de salvar, o formulário fica pronto para o próximo item do mesmo município.
                Volte em <strong>Ver dossiê</strong> para conferir o card atualizado.
              </p>
            </div>

            <form className="panel panel-pad form-grid" onSubmit={onSubmit} style={{ marginBottom: '1rem' }}>
              <h3 style={{ marginTop: 0 }}>{editingId ? 'Editar item' : 'Lançar item no dossiê'}</h3>
              <label>
                Município *
                <select
                  className="select"
                  required
                  value={form.municipality_id}
                  onChange={(e) => setForm({ ...form, municipality_id: e.target.value })}
                >
                  <option value="">Selecione o município</option>
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
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button className="btn btn-primary" type="submit">
                  {editingId ? 'Salvar alteração' : 'Adicionar ao dossiê'}
                </button>
                {editingId && (
                  <button
                    type="button"
                    className="btn btn-soft"
                    onClick={() => {
                      setEditingId(null);
                      setForm(emptyForm);
                    }}
                  >
                    Cancelar edição
                  </button>
                )}
                <button type="button" className="btn btn-soft" onClick={() => setMode('dossie')}>
                  Ver dossiê
                </button>
              </div>
            </form>

            <section className="panel panel-pad">
              <h3 style={{ marginTop: 0 }}>Itens já lançados ({flatItems.length})</h3>
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
                <EmptyState>Nenhum item ainda — use o formulário acima.</EmptyState>
              )}
            </section>
          </div>
        )}

        <Toast message={toast} onClose={() => setToast('')} />
      </div>
    </div>
  );
}
