/**
 * PDF / impressão elegante dos grupos dobra (apresentação de campanha).
 */
export function printGruposDobraDocument(rootEl, meta = {}) {
  if (!rootEl) return;

  const clone = rootEl.cloneNode(true);
  clone.querySelectorAll('.no-print').forEach((n) => n.remove());

  const title = meta.title || 'Grupos Dobra · Material de mobilização';
  const campaign = meta.campaign || 'Campanha';
  const candidate = meta.candidate || '';

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
<style>
  :root {
    --ink: #14201a;
    --ink-soft: #3d4f44;
    --forest: #1a3d2e;
    --leaf: #2d6a4f;
    --sand: #f3efe6;
    --line: #d4cfc2;
    --white: #fbfaf7;
    --accent: #c45c26;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 32px 28px 48px;
    background: var(--sand);
    color: var(--ink);
    font-family: 'DM Sans', sans-serif;
  }
  .dobra-print-hero {
    text-align: center;
    border-bottom: 2px solid var(--forest);
    padding: 0 8px 24px;
    margin: 0 auto 28px;
    max-width: 820px;
  }
  .dobra-print-hero__eyebrow {
    margin: 0 0 10px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--leaf);
  }
  .dobra-print-hero h1 {
    margin: 0 0 8px;
    font-family: 'Instrument Serif', Georgia, serif;
    font-weight: 400;
    font-size: 42px;
    line-height: 1.05;
    color: var(--forest);
  }
  .dobra-print-hero__lead {
    margin: 0 auto;
    max-width: 52ch;
    color: var(--ink-soft);
    font-size: 14px;
    line-height: 1.55;
  }
  .dobra-print-stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    max-width: 820px;
    margin: 0 auto 32px;
  }
  .dobra-print-stat {
    background: var(--white);
    border: 1px solid var(--line);
    padding: 14px 12px;
    text-align: center;
  }
  .dobra-print-stat strong {
    display: block;
    font-family: 'JetBrains Mono', monospace;
    font-size: 22px;
    color: var(--forest);
    margin-bottom: 4px;
  }
  .dobra-print-stat span {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--ink-soft);
  }
  .dobra-print-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 18px;
    max-width: 820px;
    margin: 0 auto;
  }
  .dobra-print-card {
    background: var(--white);
    border: 1px solid var(--line);
    overflow: hidden;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .dobra-print-card__photo {
    width: 100%;
    aspect-ratio: 16 / 10;
    object-fit: cover;
    display: block;
    background: #e8e4da;
  }
  .dobra-print-card__photo--empty {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--ink-soft);
    font-size: 12px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .dobra-print-card__body {
    padding: 14px 16px 16px;
  }
  .dobra-print-card__meta {
    margin: 0 0 6px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--leaf);
  }
  .dobra-print-card h3 {
    margin: 0 0 10px;
    font-family: 'Instrument Serif', Georgia, serif;
    font-size: 22px;
    font-weight: 400;
    line-height: 1.15;
  }
  .dobra-print-metrics {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-bottom: 10px;
  }
  .dobra-print-metrics div {
    border-top: 1px solid var(--line);
    padding-top: 8px;
  }
  .dobra-print-metrics strong {
    display: block;
    font-family: 'JetBrains Mono', monospace;
    font-size: 15px;
  }
  .dobra-print-metrics span {
    font-size: 10px;
    color: var(--ink-soft);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .dobra-print-link {
    margin: 0;
    font-size: 11px;
    color: var(--ink-soft);
    word-break: break-all;
  }
  .dobra-print-footer {
    max-width: 820px;
    margin: 36px auto 0;
    padding-top: 16px;
    border-top: 1px solid var(--line);
    text-align: center;
    font-size: 11px;
    color: var(--ink-soft);
    font-family: 'JetBrains Mono', monospace;
    letter-spacing: 0.06em;
  }
  @media print {
    body { padding: 12px; background: white; }
    .dobra-print-card { break-inside: avoid; }
  }
  @page { margin: 14mm; }
</style>
</head>
<body>
  <header class="dobra-print-hero">
    <p class="dobra-print-hero__eyebrow">${escapeHtml(campaign)}${candidate ? ` · ${escapeHtml(candidate)}` : ''}</p>
    <h1>Grupos Dobra</h1>
    <p class="dobra-print-hero__lead">
      Rede de grupos WhatsApp criados com material de mobilização — entrada rastreada por link e crescimento de membros.
    </p>
  </header>
  ${clone.innerHTML}
  <footer class="dobra-print-footer">
    Levantamento de grupos · ${escapeHtml(new Date().toLocaleDateString('pt-BR'))}
  </footer>
</body>
</html>`;

  const win = window.open('', '_blank', 'noopener,noreferrer,width=980,height=900');
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
      /* ignore */
    }
  };
  if (win.document.readyState === 'complete') {
    setTimeout(trigger, 350);
  } else {
    win.addEventListener('load', () => setTimeout(trigger, 350));
  }
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
