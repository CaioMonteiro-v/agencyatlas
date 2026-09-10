import { formatDate } from '../utils/date';

function csvEscape(value) {
  const text = value == null ? '' : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/**
 * Cadastros que ficaram na Base após exclusão do QR/link da liderança.
 * Explica o buraco entre "Mobilizadas (lideranças)" e "Cadastros no território".
 */
export default function CoordinatorOrphanLinksPanel({
  coordinatorName,
  orphanLinks = [],
  totals = {},
}) {
  const orphanTotal = Number(totals.orphan_links || 0);
  const people = Number(totals.people_by_leaders || 0);
  const territory = Number(totals.registrations || 0);
  const fromEvents = Number(totals.from_events || 0);
  const otherLeaders = Number(totals.other_leaders || 0);
  const other = Number(totals.other_unlinked || 0);
  const mathCheck = Number(
    totals.math_check || people + orphanTotal + fromEvents + otherLeaders + other,
  );
  const gap = territory - people;

  function downloadCsv() {
    const lines = [
      ['Coordenador', coordinatorName || ''].map(csvEscape).join(','),
      ['Cadastros no território', territory].map(csvEscape).join(','),
      ['Mobilizadas (lideranças atuais)', people].map(csvEscape).join(','),
      ['QR excluído (órfãos)', orphanTotal].map(csvEscape).join(','),
      ['Eventos de rua no território', fromEvents].map(csvEscape).join(','),
      ['Outras lideranças no município', otherLeaders].map(csvEscape).join(','),
      ['Outros sem vínculo', other].map(csvEscape).join(','),
      ['Soma (deve ≈ território)', mathCheck].map(csvEscape).join(','),
      ['', ''].map(csvEscape).join(','),
      ['Liderança / QR', 'Código', 'Município', 'Cadastros', 'Primeiro', 'Último'].map(csvEscape).join(','),
    ];
    for (const row of orphanLinks) {
      lines.push([
        row.name || row.mobilizer_name || 'QR excluído',
        row.referral_code || '',
        row.municipality_name || '',
        row.total,
        row.first_at ? String(row.first_at).slice(0, 10) : '',
        row.last_at ? String(row.last_at).slice(0, 10) : '',
      ].map(csvEscape).join(','));
    }
    const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safe = String(coordinatorName || 'coordenador')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9-_]+/g, '-')
      .toLowerCase();
    a.download = `qr-excluidos-${safe}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  if (!gap && !orphanTotal && !orphanLinks.length) return null;

  return (
    <section className="panel panel-pad" style={{ marginTop: '1rem', background: 'rgba(180, 90, 40, 0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: 4 }}>Conta do relatório</p>
          <h4 style={{ margin: 0 }}>Cadastros de QR excluído</h4>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.9rem', color: 'var(--muted)' }}>
            Quando o link/QR da liderança é excluído, os cadastros continuam na Base do território,
            mas saem da coluna “Mobilizadas (lideranças)”. Aqui eles aparecem para a matemática fechar.
          </p>
        </div>
        {orphanLinks.length ? (
          <button type="button" className="btn btn-soft btn-sm" onClick={downloadCsv}>
            Baixar planilha dos órfãos
          </button>
        ) : null}
      </div>

      <div className="coord-mini-stats" style={{ marginTop: '0.85rem' }}>
        <div>
          <strong style={{ fontSize: '1.25rem' }}>{territory}</strong>
          <span>Território</span>
        </div>
        <div>
          <strong style={{ fontSize: '1.25rem' }}>{people}</strong>
          <span>Lideranças atuais</span>
        </div>
        <div>
          <strong style={{ fontSize: '1.25rem' }}>{orphanTotal}</strong>
          <span>QR excluído</span>
        </div>
        <div>
          <strong style={{ fontSize: '1.05rem' }}>
            {people} + {orphanTotal}
            {fromEvents ? ` + ${fromEvents} evt` : ''}
            {otherLeaders ? ` + ${otherLeaders} out.lid` : ''}
            {other ? ` + ${other}` : ''}
            {' = '}
            {mathCheck}
          </strong>
          <span>
            {mathCheck === territory
              ? 'Bate com o território'
              : `Diferença vs território: ${territory - mathCheck}`}
          </span>
        </div>
      </div>

      {orphanLinks.length ? (
        <div className="table-wrap" style={{ marginTop: '0.85rem' }}>
          <table>
            <thead>
              <tr>
                <th>Liderança / QR (nome gravado)</th>
                <th>Código do link</th>
                <th>Município</th>
                <th>Cadastros</th>
                <th>Primeiro</th>
                <th>Último</th>
              </tr>
            </thead>
            <tbody>
              {orphanLinks.map((row) => (
                <tr key={`${row.referral_code || row.source}-${row.municipality_id}-${row.mobilizer_name}`}>
                  <td><strong>{row.name || row.mobilizer_name || 'QR excluído'}</strong></td>
                  <td>{row.referral_code || '—'}</td>
                  <td>{row.municipality_name || '—'}</td>
                  <td><strong>{row.total}</strong></td>
                  <td>{row.first_at ? formatDate(String(row.first_at).slice(0, 10)) : '—'}</td>
                  <td>{row.last_at ? formatDate(String(row.last_at).slice(0, 10)) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p style={{ marginTop: '0.75rem', fontSize: '0.9rem', color: 'var(--muted)' }}>
          Há {gap} cadastro(s) no território fora das lideranças atuais, mas nenhum com
          origem de link/QR órfão detectado
          {fromEvents ? ` (${fromEvents} de evento)` : ''}
          {other ? ` (${other} outros)` : ''}.
        </p>
      )}
    </section>
  );
}
