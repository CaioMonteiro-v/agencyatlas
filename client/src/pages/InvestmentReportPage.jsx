import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../api';
import { EmptyState, Toast } from '../components/Ui';

const emptyForm = {
  invested_at: new Date().toISOString().slice(0, 10),
  coordinator_id: '',
  municipality_id: '',
  category: 'combustivel',
  description: '',
  amount: '',
  receipt_ref: '',
  notes: '',
};

function brl(n) {
  return Number(n || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export default function InvestmentReportPage() {
  const { campaign } = useOutletContext();
  const [mode, setMode] = useState('relatorio');
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [categories, setCategories] = useState([]);
  const [coordinators, setCoordinators] = useState([]);
  const [municipalities, setMunicipalities] = useState([]);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [filter, setFilter] = useState({
    coordinator_id: '',
    category: '',
    from: '',
    to: '',
  });
  const [editingId, setEditingId] = useState(null);

  async function load(nextFilter = filter) {
    try {
      const [res, coordsRes, munis] = await Promise.all([
        api.getInvestments(campaign.slug, {
          coordinator_id: nextFilter.coordinator_id || undefined,
          category: nextFilter.category || undefined,
          from: nextFilter.from || undefined,
          to: nextFilter.to || undefined,
        }),
        api.getCoordinators(campaign.slug).catch(() => ({ coordinators: [] })),
        api.getMunicipalities().catch(() => []),
      ]);
      setItems(res.items || []);
      setSummary(res.summary || null);
      setCategories(res.categories || []);
      setCoordinators(coordsRes?.coordinators || []);
      setMunicipalities(Array.isArray(munis) ? munis : []);
      setError('');
    } catch (err) {
      setError(err.message || 'Erro ao carregar investimentos');
    }
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [campaign.slug]);

  const muniOptions = useMemo(() => {
    const cid = Number(form.coordinator_id);
    if (!cid) return municipalities;
    const coord = coordinators.find((c) => c.id === cid);
    return coord?.municipalities?.length ? coord.municipalities : municipalities;
  }, [form.coordinator_id, coordinators, municipalities]);

  const periodLabel = useMemo(() => {
    if (filter.from && filter.to) return `${fmtDate(filter.from)} — ${fmtDate(filter.to)}`;
    if (filter.from) return `a partir de ${fmtDate(filter.from)}`;
    if (filter.to) return `até ${fmtDate(filter.to)}`;
    if (!items.length) return 'Sem lançamentos ainda';
    const dates = items.map((i) => i.invested_at).filter(Boolean).sort();
    if (!dates.length) return 'Período livre';
    return `${fmtDate(dates[0])} — ${fmtDate(dates[dates.length - 1])}`;
  }, [filter, items]);

  async function onSubmit(e) {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        amount: Number(String(form.amount).replace(',', '.')) || 0,
        coordinator_id: form.coordinator_id || null,
        municipality_id: form.municipality_id || null,
      };
      if (editingId) {
        await api.updateInvestment(campaign.slug, editingId, payload);
        setToast('Lançamento atualizado');
      } else {
        await api.createInvestment(campaign.slug, payload);
        setToast('Investimento lançado');
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
      invested_at: item.invested_at || new Date().toISOString().slice(0, 10),
      coordinator_id: item.coordinator_id || '',
      municipality_id: item.municipality_id || '',
      category: item.category || 'outros',
      description: item.description || '',
      amount: String(item.amount ?? ''),
      receipt_ref: item.receipt_ref || '',
      notes: item.notes || '',
    });
    setShowForm(true);
    setMode('cadastro');
  }

  async function removeItem(item) {
    try {
      await api.deleteInvestment(campaign.slug, item.id);
      setToast('Lançamento removido');
      await load();
    } catch (err) {
      setToast(err.message);
    }
  }

  function applyFilter(next) {
    setFilter(next);
    load(next).catch((err) => setToast(err.message));
  }

  return (
    <div className="container section invest-page report-page" style={{ paddingTop: 0 }}>
      <div className="section__head no-print">
        <p className="eyebrow">Finanças da campanha</p>
        <h2>Investimento</h2>
        <p>
          Guarda o que foi investido com cada coordenador — relatório interno da campanha,
          sem vínculo com Instagram ou Meta.
        </p>
        <div className="chip-group" style={{ marginTop: '0.75rem' }}>
          <button
            type="button"
            className={`chip ${mode === 'relatorio' ? 'active' : ''}`}
            onClick={() => setMode('relatorio')}
          >
            Relatório
          </button>
          <button
            type="button"
            className={`chip ${mode === 'cadastro' ? 'active' : ''}`}
            onClick={() => setMode('cadastro')}
          >
            Lançamentos
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
              {showForm ? 'Fechar formulário' : 'Novo lançamento'}
            </button>
          )}
        </div>
      </div>

      {error && <EmptyState>{error}</EmptyState>}

      {/* Filters — show in both modes but hide on print */}
      <div className="invest-filters no-print panel panel-pad" style={{ marginBottom: '1rem' }}>
        <div className="form-grid" style={{ margin: 0 }}>
          <label>
            Coordenador
            <select
              className="select"
              value={filter.coordinator_id}
              onChange={(e) => applyFilter({ ...filter, coordinator_id: e.target.value })}
            >
              <option value="">Todos</option>
              {coordinators.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label>
            Categoria
            <select
              className="select"
              value={filter.category}
              onChange={(e) => applyFilter({ ...filter, category: e.target.value })}
            >
              <option value="">Todas</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </label>
          <label>
            De
            <input
              className="input"
              type="date"
              value={filter.from}
              onChange={(e) => applyFilter({ ...filter, from: e.target.value })}
            />
          </label>
          <label>
            Até
            <input
              className="input"
              type="date"
              value={filter.to}
              onChange={(e) => applyFilter({ ...filter, to: e.target.value })}
            />
          </label>
        </div>
      </div>

      {/* Relatório imprimível — visível na aba Relatório; no print sempre sai */}
      <article className={`invest-doc ${mode !== 'relatorio' ? 'invest-doc--screen-only-print' : ''}`}>
          <header className="invest-doc__head">
            <div className="invest-doc__brand">
              <img
                src={campaign.logo_url || '/logos/fabio-garcia.png'}
                alt={campaign.candidate || campaign.name}
              />
              <div>
                <p className="invest-doc__eyebrow">Atlas Agency · Campanha</p>
                <h1>{campaign.candidate || campaign.name}</h1>
                <p className="invest-doc__sub">{campaign.name}</p>
              </div>
            </div>
            <div className="invest-doc__meta">
              <strong>Relatório de investimento</strong>
              <span>Período: {periodLabel}</span>
              <span>Gerado em {new Date().toLocaleString('pt-BR')}</span>
            </div>
          </header>

          {summary && (
            <section className="invest-kpis">
              <div className="invest-kpi invest-kpi--hero">
                <span>Total investido</span>
                <strong>{brl(summary.total)}</strong>
              </div>
              <div className="invest-kpi">
                <span>Lançamentos</span>
                <strong>{summary.count}</strong>
              </div>
              <div className="invest-kpi">
                <span>Coordenadores</span>
                <strong>{summary.coordinators_with_spend}</strong>
              </div>
              <div className="invest-kpi">
                <span>Média por lançamento</span>
                <strong>{brl(summary.average_per_entry)}</strong>
              </div>
            </section>
          )}

          {summary?.by_coordinator?.length > 0 && (
            <section className="invest-section">
              <h2>Por coordenador</h2>
              <div className="invest-bars">
                {summary.by_coordinator.map((row) => (
                  <div className="invest-bar" key={row.coordinator_id || 'geral'}>
                    <div className="invest-bar__top">
                      <strong>{row.coordinator_name}</strong>
                      <span>{brl(row.total)} · {row.pct}% · {row.count} lanç.</span>
                    </div>
                    <div className="invest-bar__track">
                      <div
                        className="invest-bar__fill"
                        style={{ width: `${Math.max(2, row.pct)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {summary?.by_category?.length > 0 && (
            <section className="invest-section">
              <h2>Por categoria</h2>
              <div className="invest-cats">
                {summary.by_category.map((row) => (
                  <div className="invest-cat" key={row.category}>
                    <div>
                      <strong>{row.category_label}</strong>
                      <span>{row.count} lançamento(s)</span>
                    </div>
                    <div className="invest-cat__right">
                      <strong>{brl(row.total)}</strong>
                      <span>{row.pct}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="invest-section">
            <h2>Detalhamento</h2>
            {items.length ? (
              <div className="table-wrap">
                <table className="table invest-table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Coordenador</th>
                      <th>Município</th>
                      <th>Categoria</th>
                      <th>Descrição</th>
                      <th>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td>{fmtDate(item.invested_at)}</td>
                        <td>{item.coordinator_name || '—'}</td>
                        <td>{item.municipality_name || '—'}</td>
                        <td>{item.category_label}</td>
                        <td>
                          {item.description}
                          {item.receipt_ref ? (
                            <small className="invest-ref"> · Ref: {item.receipt_ref}</small>
                          ) : null}
                        </td>
                        <td className="invest-amount">{brl(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={5}>Total</td>
                      <td className="invest-amount">{brl(summary?.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <EmptyState>
                Ainda sem lançamentos. Vá em <strong>Lançamentos</strong> e registre o que foi investido.
              </EmptyState>
            )}
          </section>

          <footer className="invest-doc__foot">
            <p>Documento interno · Atlas Agency · {campaign.candidate || campaign.name}</p>
            <p>Valores lançados manualmente pela equipe — não há integração bancária automática.</p>
          </footer>
        </article>

      {/* ========== CADASTRO ========== */}
      {mode === 'cadastro' && (
        <div className="no-print" style={{ marginTop: '1.25rem' }}>
          {showForm && (
            <form className="panel panel-pad form-grid" onSubmit={onSubmit} style={{ marginBottom: '1rem' }}>
              <h3 style={{ marginTop: 0 }}>{editingId ? 'Editar lançamento' : 'Novo lançamento'}</h3>
              <label>
                Data *
                <input
                  className="input"
                  type="date"
                  required
                  value={form.invested_at}
                  onChange={(e) => setForm({ ...form, invested_at: e.target.value })}
                />
              </label>
              <label>
                Valor (R$) *
                <input
                  className="input"
                  required
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="Ex.: 1500,00"
                />
              </label>
              <label>
                Coordenador
                <select
                  className="select"
                  value={form.coordinator_id}
                  onChange={(e) => setForm({ ...form, coordinator_id: e.target.value, municipality_id: '' })}
                >
                  <option value="">Campanha (sem coordenador)</option>
                  {coordinators.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Município
                <select
                  className="select"
                  value={form.municipality_id}
                  onChange={(e) => setForm({ ...form, municipality_id: e.target.value })}
                >
                  <option value="">Sem município</option>
                  {muniOptions.map((m) => (
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
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Descrição *
                <input
                  className="input"
                  required
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Ex.: Combustível rota Cuiabá–Rondonópolis"
                />
              </label>
              <label>
                Ref. comprovante
                <input
                  className="input"
                  value={form.receipt_ref}
                  onChange={(e) => setForm({ ...form, receipt_ref: e.target.value })}
                  placeholder="Nº nota / PIX / protocolo"
                />
              </label>
              <label>
                Observações
                <input
                  className="input"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </label>
              <button className="btn btn-primary" type="submit">
                {editingId ? 'Salvar alterações' : 'Registrar investimento'}
              </button>
            </form>
          )}

          <section className="panel panel-pad">
            <h3 style={{ marginTop: 0 }}>Todos os lançamentos</h3>
            {items.length ? (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Coordenador</th>
                      <th>Categoria</th>
                      <th>Descrição</th>
                      <th>Valor</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td>{fmtDate(item.invested_at)}</td>
                        <td>{item.coordinator_name || '—'}</td>
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
              <EmptyState>Nenhum lançamento ainda.</EmptyState>
            )}
          </section>
        </div>
      )}

      <Toast message={toast} onClose={() => setToast('')} />
    </div>
  );
}
