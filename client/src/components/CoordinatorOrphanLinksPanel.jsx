import { useEffect, useState } from 'react';
import { api } from '../api';
import { formatDate } from '../utils/date';

function csvEscape(value) {
  const text = value == null ? '' : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function rowKey(row) {
  return `${row.referral_code || row.source || ''}|${row.mobilizer_name || ''}|${row.municipality_id || ''}`;
}

/**
 * Cadastros que ficaram na Base após exclusão do QR/link da liderança.
 * Na dobra (sem município) recupera via orphan_coordinator_id + “vincular órfãos”.
 */
export default function CoordinatorOrphanLinksPanel({
  campaignSlug,
  coordinatorId,
  coordinatorName,
  coordType,
  orphanLinks = [],
  totals = {},
  onClaimed,
}) {
  const isDobra = coordType === 'dobra';
  const orphanTotal = Number(totals.orphan_links || 0);
  const people = Number(totals.people_by_leaders || 0);
  const territory = Number(totals.registrations || 0);
  const controlTotal = Number(totals.control_total || people + orphanTotal);
  const fromEvents = Number(totals.from_events || 0);
  const otherLeaders = Number(totals.other_leaders || 0);
  const other = Number(totals.other_unlinked || 0);
  const mathCheck = Number(
    totals.math_check
    || (isDobra
      ? controlTotal
      : people + orphanTotal + fromEvents + otherLeaders + other),
  );
  const gap = isDobra
    ? controlTotal === 0 && people === 0
    : territory - people;

  const [unclaimed, setUnclaimed] = useState([]);
  const [unclaimedTotal, setUnclaimedTotal] = useState(0);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function loadUnclaimed(search = q) {
    if (!campaignSlug) return;
    try {
      const res = await api.getUnclaimedOrphanLinks(campaignSlug, { q: search });
      setUnclaimed(res.orphan_links || []);
      setUnclaimedTotal(Number(res.total || 0));
      setSelected(new Set());
    } catch (err) {
      setMsg(err.message || 'Falha ao listar órfãos');
    }
  }

  useEffect(() => {
    // Dobra zerada (ou qualquer coord sem órfãos atribuídos): oferece recuperação
    if (!campaignSlug) return;
    if (orphanTotal > 0 && !isDobra) return;
    loadUnclaimed('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignSlug, coordinatorId, orphanTotal, isDobra]);

  function toggleRow(row) {
    const key = rowKey(row);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectAllUnclaimed() {
    setSelected(new Set(unclaimed.map(rowKey)));
  }

  async function claimSelected() {
    if (!selected.size) {
      setMsg('Selecione os QR/nomes que eram deste coordenador');
      return;
    }
    const codes = [];
    const names = [];
    for (const row of unclaimed) {
      if (!selected.has(rowKey(row))) continue;
      if (row.referral_code) codes.push(row.referral_code);
      if (row.mobilizer_name) names.push(row.mobilizer_name);
    }
    setBusy(true);
    try {
      const res = await api.claimOrphanLinks(campaignSlug, coordinatorId, {
        referral_codes: codes,
        mobilizer_names: names,
      });
      setMsg(`Vinculados ${res.updated} cadastro(s) a ${coordinatorName || 'este coordenador'}`);
      await loadUnclaimed(q);
      if (onClaimed) onClaimed(res);
    } catch (err) {
      setMsg(err.message || 'Falha ao vincular');
    } finally {
      setBusy(false);
    }
  }

  function downloadCsv() {
    const lines = [
      ['Coordenador', coordinatorName || ''].map(csvEscape).join(','),
      ['Tipo', isDobra ? 'Dobra' : 'Regional'].map(csvEscape).join(','),
      ['Controle (lideranças + QR excluído)', controlTotal].map(csvEscape).join(','),
      ['Cadastros no território', territory].map(csvEscape).join(','),
      ['Mobilizadas (lideranças atuais)', people].map(csvEscape).join(','),
      ['QR excluído (órfãos)', orphanTotal].map(csvEscape).join(','),
      ['Eventos de rua no território', fromEvents].map(csvEscape).join(','),
      ['Outras lideranças no município', otherLeaders].map(csvEscape).join(','),
      ['Outros sem vínculo', other].map(csvEscape).join(','),
      ['Soma', mathCheck].map(csvEscape).join(','),
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

  const showClaim = isDobra || orphanTotal === 0 || unclaimedTotal > 0;
  if (!gap && !orphanTotal && !orphanLinks.length && !showClaim && !unclaimed.length) {
    return null;
  }

  return (
    <section className="panel panel-pad" style={{ marginTop: '1rem', background: 'rgba(180, 90, 40, 0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: 4 }}>Conta do relatório</p>
          <h4 style={{ margin: 0 }}>Cadastros de QR excluído</h4>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.9rem', color: 'var(--muted)' }}>
            {isDobra
              ? 'Na dobra o controle é lideranças + QR excluído (não depende de município). Se você excluiu o QR antes, vincule os órfãos abaixo para a conta voltar neste card.'
              : 'Quando o link/QR da liderança é excluído, os cadastros continuam na Base, mas saem de “Mobilizadas (lideranças)”. Aqui eles aparecem para a matemática fechar.'}
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
          <strong style={{ fontSize: '1.25rem' }}>{isDobra ? controlTotal : territory}</strong>
          <span>{isDobra ? 'Controle da dobra' : 'Território'}</span>
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
            {!isDobra && fromEvents ? ` + ${fromEvents} evt` : ''}
            {!isDobra && otherLeaders ? ` + ${otherLeaders} out.lid` : ''}
            {!isDobra && other ? ` + ${other}` : ''}
            {' = '}
            {mathCheck}
          </strong>
          <span>
            {isDobra
              ? (mathCheck === controlTotal ? 'Controle da dobra' : `Diferença: ${controlTotal - mathCheck}`)
              : (mathCheck === territory
                ? 'Bate com o território'
                : `Diferença vs território: ${territory - mathCheck}`)}
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
                <tr key={rowKey(row)}>
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
      ) : null}

      {showClaim ? (
        <div style={{ marginTop: '1rem' }}>
          <h4 style={{ margin: '0 0 0.35rem', fontSize: '1rem' }}>
            Recuperar QR excluídos (ainda sem dono)
          </h4>
          <p style={{ margin: '0 0 0.65rem', fontSize: '0.88rem', color: 'var(--muted)' }}>
            Os 159 do Fabio Alex / Allan Kardec devem aparecer aqui agrupados por nome ou código.
            Marque os que eram desta dobra e clique em vincular — o card volta a contar.
          </p>
          <form
            className="filters"
            style={{ alignItems: 'end', marginBottom: '0.65rem' }}
            onSubmit={(e) => {
              e.preventDefault();
              loadUnclaimed(q);
            }}
          >
            <label style={{ minWidth: 220, flex: 1 }}>
              Buscar nome ou código
              <input
                className="input"
                value={q}
                placeholder="ex.: fabio, alex, kardec…"
                onChange={(e) => setQ(e.target.value)}
              />
            </label>
            <button className="btn btn-soft btn-sm" type="submit">Buscar</button>
            <button
              className="btn btn-soft btn-sm"
              type="button"
              onClick={() => {
                setQ('');
                loadUnclaimed('');
              }}
            >
              Ver todos
            </button>
            {unclaimed.length ? (
              <>
                <button className="btn btn-soft btn-sm" type="button" onClick={selectAllUnclaimed}>
                  Marcar todos ({unclaimedTotal})
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  type="button"
                  disabled={busy || !selected.size}
                  onClick={claimSelected}
                >
                  {busy ? 'Vinculando…' : `Vincular a esta dobra (${selected.size})`}
                </button>
              </>
            ) : null}
          </form>

          {unclaimed.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th />
                    <th>Nome no cadastro</th>
                    <th>Código</th>
                    <th>Município</th>
                    <th>Cadastros</th>
                  </tr>
                </thead>
                <tbody>
                  {unclaimed.map((row) => {
                    const key = rowKey(row);
                    return (
                      <tr key={key}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selected.has(key)}
                            onChange={() => toggleRow(row)}
                            aria-label={`Selecionar ${row.name}`}
                          />
                        </td>
                        <td><strong>{row.name || row.mobilizer_name || 'QR excluído'}</strong></td>
                        <td>{row.referral_code || '—'}</td>
                        <td>{row.municipality_name || '—'}</td>
                        <td><strong>{row.total}</strong></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--muted)' }}>
              Nenhum órfão sem dono encontrado
              {q ? ` para “${q}”` : ''}. Se os 159 já tiverem município de regional, busque pelo nome do mobilizador.
            </p>
          )}
          {msg ? (
            <p style={{ margin: '0.65rem 0 0', fontSize: '0.9rem' }}>{msg}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
