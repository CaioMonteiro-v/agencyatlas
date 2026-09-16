/**
 * Abre janela limpa só com o dossiê (sem logo, Atlas, header da campanha).
 */
export function printDossierDocument(rootEl) {
  if (!rootEl) return;

  const clone = rootEl.cloneNode(true);

  // Remove tudo marcado como no-print
  clone.querySelectorAll('.no-print').forEach((n) => n.remove());

  // Abre todas as categorias no PDF
  clone.querySelectorAll('details').forEach((d) => {
    d.setAttribute('open', '');
  });

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<title>Dossiê regional · Estado de Mato Grosso — Investimentos por Município</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>
  :root {
    --paper: #EFE8D6;
    --ink: #1C2A20;
    --ink-soft: #4B5346;
    --green: #2F5233;
    --green-deep: #1F3D2B;
    --gold: #A9781F;
    --brick: #8C3B2E;
    --rule: #C9BFA0;
    --white: #FBF8F0;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 28px 24px 40px;
    background: var(--paper);
    background-image: repeating-linear-gradient(
      0deg,
      rgba(0,0,0,0.015) 0px,
      rgba(0,0,0,0.015) 1px,
      transparent 1px,
      transparent 3px
    );
    color: var(--ink);
    font-family: 'IBM Plex Sans', sans-serif;
  }
  .dossier-hero {
    border-bottom: 3px double var(--ink);
    text-align: center;
    max-width: 720px;
    margin: 0 auto 28px;
    padding: 0 8px 22px;
  }
  .dossier-hero__eyebrow {
    margin: 0 0 12px;
    font-family: 'IBM Plex Mono', monospace;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    font-size: 11px;
    color: var(--green-deep);
  }
  .dossier-hero h1 {
    margin: 0 0 10px;
    font-family: 'Fraunces', serif;
    font-weight: 600;
    font-size: 36px;
    letter-spacing: -0.01em;
    line-height: 1.08;
  }
  .dossier-hero__lead {
    margin: 0 auto;
    max-width: 62ch;
    color: var(--ink-soft);
    font-size: 14px;
    line-height: 1.6;
  }
  .dossier-hero__sum { display: none !important; }
  .dossier-grid {
    max-width: 1180px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 22px;
    align-items: start;
  }
  .dossier-card {
    background: var(--white);
    border: 1px solid var(--rule);
    position: relative;
    padding: 22px 20px 18px;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .dossier-card::before {
    content: "";
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 4px;
    background: var(--green);
  }
  .dossier-card__index {
    margin: 0 0 10px;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.14em;
    color: var(--gold);
    text-transform: uppercase;
  }
  .dossier-card__title {
    margin: 0 0 4px;
    font-family: 'Fraunces', serif;
    font-weight: 600;
    font-size: 18px;
    line-height: 1.28;
    color: var(--green-deep);
  }
  .dossier-card__title em {
    font-style: normal;
    color: var(--brick);
  }
  .dossier-card__total {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 12px;
    color: var(--ink-soft);
    margin: 0 0 14px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--rule);
  }
  .dossier-card__total strong {
    display: block;
    margin-top: 2px;
    color: var(--ink);
    font-size: 15px;
  }
  .dossier-cat { margin: 0; }
  .dossier-cat__head {
    list-style: none;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    padding: 8px 0;
    border-bottom: 1px dashed var(--rule);
    font-size: 13px;
  }
  .dossier-cat__head::-webkit-details-marker,
  .dossier-cat__head::marker { display: none; content: ""; }
  .dossier-cat__label {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .dossier-cat__arrow { display: none; }
  .dossier-cat__pill {
    font-size: 9px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 2px 6px;
    border-radius: 2px;
    font-family: 'IBM Plex Mono', monospace;
    color: #fff;
    background: var(--cat-color, var(--green));
  }
  .dossier-cat__count {
    font-size: 11px;
    color: var(--ink-soft);
    font-family: 'IBM Plex Mono', monospace;
  }
  .dossier-cat__value {
    font-family: 'IBM Plex Mono', monospace;
    color: var(--ink);
    font-weight: 600;
    white-space: nowrap;
  }
  .dossier-cat__list {
    list-style: none;
    margin: 2px 0 8px;
    padding: 0 0 0 4px;
  }
  .dossier-cat__list li {
    font-size: 12px;
    line-height: 1.45;
    color: var(--ink-soft);
    padding: 6px 0;
    border-bottom: 1px solid rgba(0,0,0,0.06);
    display: flex;
    justify-content: space-between;
    gap: 12px;
  }
  .dossier-cat__list li:last-child { border-bottom: none; }
  .dossier-cat__list li strong {
    font-family: 'IBM Plex Mono', monospace;
    color: var(--ink);
    white-space: nowrap;
    font-size: 11px;
    font-weight: 500;
  }
  .dossier-card__note {
    margin: 10px 0 0;
    font-size: 11px;
    color: var(--gold);
    font-style: italic;
    line-height: 1.5;
  }
  .dossier-footer-rule { display: none !important; }
  @media print {
    body { padding: 12px; }
    .dossier-grid { gap: 16px; }
  }
  @media (max-width: 800px) {
    .dossier-grid { grid-template-columns: 1fr; }
  }
</style>
</head>
<body>
${clone.innerHTML}
</body>
</html>`;

  const win = window.open('', '_blank', 'noopener,noreferrer,width=1100,height=800');
  if (!win) {
    window.print();
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();

  const trigger = () => {
    try {
      win.focus();
      win.print();
    } catch {
      /* ok */
    }
  };

  // Espera fontes/layout
  if (win.document.fonts?.ready) {
    win.document.fonts.ready.then(trigger).catch(trigger);
  } else {
    setTimeout(trigger, 350);
  }
}
