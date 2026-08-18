import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../api';
import { EmptyState, Toast } from '../components/Ui';

function brl(n, unknown = false) {
  if (unknown || n === null || n === undefined) return 'não informado';
  return `R$ ${Number(n || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function MuniCard({ muni, totalCount }) {
  const [open, setOpen] = useState(() => {
    const init = {};
    (muni.categories || []).forEach((cat, i) => {
      init[cat.category] = i === 0;
    });
    return init;
  });

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
        Total viabilizado no município
        <strong>{brl(muni.total)}</strong>
      </p>

      <div className="dossier-cats">
        {(muni.categories || []).map((cat) => {
          const isOpen = Boolean(open[cat.category]);
          return (
            <details
              key={cat.category}
              className="dossier-cat"
              open={isOpen}
              onToggle={(e) => {
                setOpen((prev) => ({ ...prev, [cat.category]: e.target.open }));
              }}
            >
              <summary className="dossier-cat__head" style={{ '--cat-color': cat.category_color }}>
                <span className="dossier-cat__label">
                  <span className="dossier-cat__arrow" aria-hidden>▸</span>
                  <span className="dossier-cat__pill">{String(cat.category_label || '').toUpperCase()}</span>
                  <span className="dossier-cat__count">
                    {cat.count} {cat.count === 1 ? 'item' : 'itens'}
                  </span>
                </span>
                <span className="dossier-cat__value">{brl(cat.total)}</span>
              </summary>
              <ul className="dossier-cat__list">
                {cat.items.map((item) => (
                  <li key={item.id}>
                    <span>{item.description}</span>
                    <strong>{brl(item.amount, item.amount_unknown)}</strong>
                  </li>
                ))}
              </ul>
            </details>
          );
        })}
      </div>

      {muni.footnote ? <p className="dossier-card__note">* {muni.footnote}</p> : null}
    </article>
  );
}

const PASTE_PLACEHOLDER = `Cole aqui o array do dossiê, por exemplo:

const municipios = [
  {
    nome: "Alto Araguaia",
    grupos: [
      { tag: "infra", label: "Infraestrutura", itens: [
        { d: "Ponte de concreto...", v: 9163754.43 },
      ]},
      { tag: "saude", label: "Saúde", itens: [
        { d: "Custeio da saúde", v: 500000 },
      ]},
    ],
  },
];

Também aceita a página HTML inteira ou um JSON.`;

export default function InvestmentReportPage() {
  const { campaign } = useOutletContext();
  const [mode, setMode] = useState('dossie');
  const [dossier, setDossier] = useState(null);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [paste, setPaste] = useState('');
  const [importing, setImporting] = useState(false);
  const [filterMuni, setFilterMuni] = useState('');
  const [lastImport, setLastImport] = useState(null);

  async function load() {
    try {
      const res = await api.getInvestments(campaign.slug);
      setDossier(res);
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

  async function runImport(body) {
    setImporting(true);
    try {
      const res = await api.importInvestments(campaign.slug, body);
      setDossier(res.dossier);
      setLastImport(res);
      setPaste('');
      setMode('dossie');
      const miss = res.municipalities_missing?.length
        ? ` · ${res.municipalities_missing.length} nome(s) não encontrados`
        : '';
      setToast(
        `Dossiê gerado: ${res.municipalities_imported} município(s), ${res.items_inserted} item(ns)${miss}`,
      );
    } catch (err) {
      setToast(err.message);
    } finally {
      setImporting(false);
    }
  }

  async function onPasteImport(e) {
    e.preventDefault();
    if (!paste.trim()) {
      setToast('Cole o texto do dossiê primeiro');
      return;
    }
    await runImport({ text: paste });
  }

  async function loadOfficial() {
    if (!window.confirm('Isso substitui o dossiê atual pelos 14 municípios oficiais. Continuar?')) {
      return;
    }
    await runImport({ use_official_seed: true });
  }

  const totalCount = dossier?.municipality_count || visibleMunis.length || 0;

  return (
    <div className="dossier-page report-page">
      <div className="container section" style={{ paddingTop: 0 }}>
        <div className="section__head no-print">
          <p className="eyebrow">Dossiê regional · MT</p>
          <h2>Investimento</h2>
          <p>
            Cole o texto (array <code>municipios</code> ou o HTML) e o Atlas monta o relatório sozinho —
            cards, totais e categorias.
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
              className={`chip ${mode === 'importar' ? 'active' : ''}`}
              onClick={() => setMode('importar')}
            >
              Colar texto / gerar
            </button>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.85rem' }}>
            <button type="button" className="btn btn-accent btn-sm" onClick={() => setMode('importar')}>
              Colar texto e gerar
            </button>
            <button type="button" className="btn btn-soft btn-sm" onClick={loadOfficial} disabled={importing}>
              Carregar dossiê oficial (14 mun.)
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}>
              Imprimir / PDF
            </button>
          </div>
        </div>

        {error && <EmptyState>{error}</EmptyState>}

        {mode === 'importar' && (
          <form className="no-print panel panel-pad dossier-import" onSubmit={onPasteImport}>
            <h3 style={{ marginTop: 0 }}>Gerar dossiê a partir do texto</h3>
            <p style={{ marginTop: 0, color: 'var(--muted)' }}>
              1) Cole o array <code>municipios = [...]</code> do seu HTML (ou a página inteira / JSON).
              2) Clique em <strong>Gerar relatório</strong>. O sistema apaga o dossiê anterior e cria os cards.
            </p>
            <label>
              Texto do dossiê
              <textarea
                className="textarea dossier-import__area"
                rows={16}
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                placeholder={PASTE_PLACEHOLDER}
              />
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" type="submit" disabled={importing}>
                {importing ? 'Gerando…' : 'Gerar relatório'}
              </button>
              <button type="button" className="btn btn-soft" onClick={loadOfficial} disabled={importing}>
                Usar dossiê oficial (14 municípios)
              </button>
              <button type="button" className="btn btn-soft" onClick={() => setMode('dossie')}>
                Voltar ao dossiê
              </button>
            </div>
            {lastImport?.municipalities_missing?.length ? (
              <p className="dossier-import__warn">
                Municípios não encontrados na base: {lastImport.municipalities_missing.join(', ')}
              </p>
            ) : null}
          </form>
        )}

        <div className={mode === 'dossie' ? '' : 'dossier-screen-print-only'}>
          <header className="dossier-hero">
            <p className="dossier-hero__eyebrow">
              {dossier?.eyebrow || 'Dossiê regional · Estado de Mato Grosso'}
            </p>
            <h1>{dossier?.title || 'Investimentos por Município'}</h1>
            <p className="dossier-hero__lead">
              {dossier?.subtitle
                || 'Levantamento organizado por município, com o total viabilizado e a relação item a item de cada categoria.'}
            </p>
            {dossier && (
              <p className="dossier-hero__sum">
                <strong>{brl(dossier.grand_total)}</strong>
                <span>
                  · {dossier.municipality_count} município(s) · {dossier.item_count} item(ns)
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
                <option value="">Todos</option>
                {(dossier?.municipalities || []).map((m) => (
                  <option key={m.municipality_id} value={m.municipality_id}>
                    {m.municipality_name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {visibleMunis.length ? (
            <>
              <div className="dossier-grid">
                {visibleMunis.map((muni) => (
                  <MuniCard key={muni.municipality_id} muni={muni} totalCount={totalCount} />
                ))}
              </div>
              <p className="dossier-footer-rule">
                Fim do dossiê — {totalCount} município{totalCount === 1 ? '' : 's'} listado{totalCount === 1 ? '' : 's'}
              </p>
            </>
          ) : (
            <EmptyState>
              Ainda sem dossiê. Clique em <strong>Colar texto / gerar</strong> ou{' '}
              <strong>Carregar dossiê oficial (14 mun.)</strong>.
            </EmptyState>
          )}
        </div>

        <Toast message={toast} onClose={() => setToast('')} />
      </div>
    </div>
  );
}
