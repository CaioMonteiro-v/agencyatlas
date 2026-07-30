import { useEffect, useState } from 'react';
import { api } from '../api';
import { formatDateTime } from '../utils/date';
import { EmptyState } from './Ui';
export default function RegistrationsTable({ campaignSlug }) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    api.getRegistrations(campaignSlug, { page, q: query })
      .then((res) => alive && setData(res))
      .catch((err) => alive && setError(err.message));
    return () => { alive = false; };
  }, [campaignSlug, page, query]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <section className="panel panel-pad">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <p className="eyebrow">Base</p>
          <h3>Registro de cadastros</h3>
          <p>Detalhes de cada inscrição rastreada nesta campanha.</p>
        </div>
        <div className="filters">
          <input
            className="input"
            placeholder="Buscar nome, telefone ou origem"
            value={query}
            onChange={(e) => {
              setPage(1);
              setQuery(e.target.value);
            }}
          />
        </div>
      </div>

      {error && <EmptyState>{error}</EmptyState>}

      <div className="table-wrap" style={{ marginTop: '1rem' }}>
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Telefone</th>
              <th>Data/Hora</th>
              <th>Mobilizador</th>
              <th>Organiz./Coord.</th>
              <th>Total do mobilizador</th>
              <th>Origem</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items || []).map((row) => (
              <tr key={row.id}>
                <td>{row.full_name}</td>
                <td>{row.phone}</td>
                <td>{formatDateTime(row.created_at)}</td>
                <td>
                  {row.leader_name || '—'}
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                    {row.municipality_name || ''}
                  </div>
                </td>
                <td>{row.organizer_name || '—'}</td>
                <td>{row.mobilizer_total}</td>
                <td>
                  <code style={{ fontSize: '0.8rem' }}>{row.source || row.referral_code || 'direto'}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!data?.items?.length && <EmptyState>Nenhum cadastro encontrado.</EmptyState>}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', gap: '0.75rem' }}>
        <span style={{ color: 'var(--muted)' }}>{data?.total || 0} registros</span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-soft btn-sm" type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </button>
          <span style={{ alignSelf: 'center' }}>{page} / {totalPages}</span>
          <button className="btn btn-soft btn-sm" type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Próxima
          </button>
        </div>
      </div>
    </section>
  );
}
