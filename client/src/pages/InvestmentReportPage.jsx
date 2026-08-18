import { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../api';
import { EmptyState, Toast } from '../components/Ui';
import { printDossierDocument } from '../lib/printDossier';

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

  const coordLabel = (muni.coordinators || [])
    .map((c) => c.name)
    .filter(Boolean)
    .join(' · ') || muni.coordinator_name;

  return (
    <article className="dossier-card">
      <p className="dossier-card__index">
        Município {String(muni.index).padStart(2, '0')} / {String(totalCount).padStart(2, '0')}
        {coordLabel ? ` · Coord. ${coordLabel}` : ''}
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

const PASTE_PLACEHOLDER = `Cole o texto assim (sem código):

Alto Araguaia

Infraestrutura
Doação de maquinários — R$ 1.030.556,00
Ponte de concreto sobre o Ribeirão Gato Preto — R$ 9.163.754,43

Saúde
Custeio da saúde — R$ 500.000,00

Alto Garças

Infraestrutura
Construção de praça — R$ 1.500.000,00
`;

export default function InvestmentReportPage() {
  const { campaign } = useOutletContext();
  const [mode, setMode] = useState('dossie');
  const [dossier, setDossier] = useState(null);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [paste, setPaste] = useState('');
  const [importing, setImporting] = useState(false);
  const [filterMuni, setFilterMuni] = useState('');
  const [filterCoord, setFilterCoord] = useState('');
  const [lastImport, setLastImport] = useState(null);
  const printRootRef = useRef(null);

  async function load(coordinatorId = filterCoord) {
    try {
      const res = await api.getInvestments(campaign.slug, {
        coordinator_id: coordinatorId || undefined,
      });
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

  async function onSelectCoordinator(value) {
    setFilterCoord(value);
    setFilterMuni('');
    await load(value);
  }

  async function runImport(body) {
    setImporting(true);
    try {
      const res = await api.importInvestments(campaign.slug, body);
      setLastImport(res);
      setPaste('');
      setFilterCoord('');
      setFilterMuni('');
      setMode('dossie');
      await load('');
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

  async function clearSelected() {
    const coord = (dossier?.coordinators || []).find((c) => String(c.id) === String(filterCoord));
    const label = coord?.name || 'selecionado';
    if (!filterCoord) {
      setToast('Selecione o coordenador (ex.: Valmir) para zerar só o dossiê dele');
      return;
    }
    if (!window.confirm(`Zerar o dossiê de ${label}? Os municípios dele saem do relatório.`)) {
      return;
    }
    try {
      const res = await api.clearInvestments(campaign.slug, { coordinator_id: Number(filterCoord) });
      setDossier(res.dossier);
      setToast(`Zerade: ${res.deleted_items} item(ns) de ${label}`);
      await load(filterCoord);
    } catch (err) {
      setToast(err.message);
    }
  }

  async function clearAll() {
    if (!window.confirm('Zerar o dossiê INTEIRO da campanha? Isso apaga todos os municípios/itens.')) {
      return;
    }
    try {
      const res = await api.clearInvestments(campaign.slug, {});
      setFilterCoord('');
      setFilterMuni('');
      setDossier(res.dossier);
      setToast(`Dossiê zerado: ${res.deleted_items} item(ns) removidos`);
    } catch (err) {
      setToast(err.message);
    }
  }

  function onPrint() {
    // Garante que o bloco do dossiê está visível mesmo se estiver na aba importar
    if (mode !== 'dossie') setMode('dossie');
    requestAnimationFrame(() => {
      printDossierDocument(printRootRef.current);
    });
  }

  const totalCount = dossier?.municipality_count || visibleMunis.length || 0;

  return (
    <div className="dossier-page report-page">
      <div className="container section" style={{ paddingTop: 0 }}>
        <div className="section__head no-print">
          <p className="eyebrow">Dossiê regional · MT</p>
          <h2>Investimento</h2>
          <p>
            Cola o texto normal (município, categoria, itens e valores) — o Atlas monta o dossiê.
            Depois escolha o <strong>coordenador</strong> já cadastrado para puxar o dossiê completo dele.
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
            <button type="button" className="btn btn-danger btn-sm" onClick={clearSelected}>
              Zerar coordenador
            </button>
            <button type="button" className="btn btn-danger btn-sm" onClick={clearAll}>
              Zerar tudo
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={onPrint}>
              Imprimir / PDF
            </button>
          </div>
        </div>

        {error && <EmptyState>{error}</EmptyState>}

        {mode === 'importar' && (
          <form className="no-print panel panel-pad dossier-import" onSubmit={onPasteImport}>
            <h3 style={{ marginTop: 0 }}>Colar texto e gerar dossiê</h3>
            <p style={{ marginTop: 0, color: 'var(--muted)' }}>
              Não precisa de código. Escreve ou cola: <strong>município</strong>, depois a{' '}
              <strong>categoria</strong> (Infraestrutura, Saúde, Agricultura…) e cada item com o valor em R$.
              O Atlas monta os cards e liga no coordenador já cadastrado.
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

        <div
          ref={printRootRef}
          className={`dossier-print-root ${mode === 'dossie' ? '' : 'dossier-screen-print-only'}`}
        >
          <header className="dossier-hero">
            <p className="dossier-hero__eyebrow">
              Dossiê regional · Estado de Mato Grosso
            </p>
            <h1>Investimentos por Município</h1>
            <p className="dossier-hero__lead">
              Levantamento organizado por município, com o total viabilizado e a relação item a item
              de cada categoria de investimento (infraestrutura, saúde, agricultura e regularização fundiária).
            </p>
            {dossier && (
              <p className="dossier-hero__sum no-print">
                <strong>{brl(dossier.grand_total)}</strong>
                <span>
                  · {dossier.municipality_count} município(s) · {dossier.item_count} item(ns)
                  {dossier.filter_coordinator ? ` · ${dossier.filter_coordinator.name}` : ''}
                </span>
              </p>
            )}
          </header>

          <div className="no-print dossier-filters">
            <label>
              Coordenador (dossiê dele)
              <select
                className="select"
                value={filterCoord}
                onChange={(e) => onSelectCoordinator(e.target.value).catch((err) => setToast(err.message))}
              >
                <option value="">Todos os municípios do dossiê</option>
                {(dossier?.coordinators || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.dossier_municipality_count
                      ? ` · ${c.dossier_municipality_count} mun. no dossiê`
                      : ' · sem mun. no dossiê ainda'}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Filtrar município
              <select
                className="select"
                value={filterMuni}
                onChange={(e) => setFilterMuni(e.target.value)}
              >
                <option value="">Todos desta visão</option>
                {(dossier?.municipalities || []).map((m) => (
                  <option key={m.municipality_id} value={m.municipality_id}>
                    {m.municipality_name}
                    {m.coordinator_name ? ` · ${m.coordinator_name}` : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {dossier?.filter_coordinator && (
            <p className="no-print dossier-coord-banner">
              Dossiê de <strong>{dossier.filter_coordinator.name}</strong>
              {' — '}
              {dossier.municipality_count} município(s)
              {' · '}
              {brl(dossier.grand_total)}
              {' · '}
              {dossier.filter_coordinator.municipalities_assigned} mun. cadastrado(s) no Atlas
            </p>
          )}
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
              {filterCoord
                ? 'Esse coordenador ainda não tem município do dossiê vinculado. Confira em Coordenadores se os municípios dele estão cadastrados, e se o texto importado usa os mesmos nomes.'
                : (
                  <>
                    Ainda sem dossiê. Clique em <strong>Colar texto / gerar</strong> ou{' '}
                    <strong>Carregar dossiê oficial (14 mun.)</strong>.
                  </>
                )}
            </EmptyState>
          )}
        </div>

        <Toast message={toast} onClose={() => setToast('')} />
      </div>
    </div>
  );
}
