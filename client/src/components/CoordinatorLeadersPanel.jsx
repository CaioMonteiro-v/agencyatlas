import { Link } from 'react-router-dom';

/**
 * Controle de lideranças do coordenador: total + pessoas mobilizadas por liderança.
 */
export default function CoordinatorLeadersPanel({
  campaignSlug,
  coordinatorName,
  leaders = [],
  compact = false,
}) {
  const totalLeaders = leaders.length;
  const totalPeople = leaders.reduce((sum, l) => sum + Number(l.registrations_count || 0), 0);

  return (
    <div className={`coord-leaders-panel ${compact ? 'coord-leaders-panel--compact' : ''}`}>
      <div className="coord-leaders-panel__head">
        <div>
          <p className="eyebrow" style={{ marginBottom: 0 }}>Controle de lideranças</p>
          <strong>
            {totalLeaders} liderança{totalLeaders === 1 ? '' : 's'}
            {coordinatorName ? ` · ${coordinatorName}` : ''}
          </strong>
        </div>
        <span className="badge badge--ok">
          {totalPeople} pessoa{totalPeople === 1 ? '' : 's'} mobilizada{totalPeople === 1 ? '' : 's'}
        </span>
      </div>

      {!leaders.length ? (
        <p style={{ margin: '0.55rem 0 0', color: 'var(--muted)', fontSize: '0.9rem' }}>
          Nenhuma liderança nos municípios deste coordenador. Cadastre lideranças em Mobilização
          (ou Admin) nas cidades vinculadas a ele.
        </p>
      ) : (
        <div className="table-wrap" style={{ marginTop: '0.65rem' }}>
          <table className="coord-leaders-table">
            <thead>
              <tr>
                <th>Liderança</th>
                <th>Município</th>
                <th>Pessoas mobilizadas</th>
                {!compact ? <th></th> : null}
              </tr>
            </thead>
            <tbody>
              {leaders.map((leader) => (
                <tr key={leader.id}>
                  <td>
                    <strong>{leader.name}</strong>
                    {leader.type ? (
                      <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                        {leader.type === 'politica' ? 'Política' : 'Multiplicador'}
                      </div>
                    ) : null}
                  </td>
                  <td>{leader.municipality_name || '—'}</td>
                  <td>
                    <strong>{Number(leader.registrations_count || 0)}</strong>
                  </td>
                  {!compact && campaignSlug ? (
                    <td>
                      <Link
                        className="btn btn-soft btn-sm"
                        to={`/campanha/${campaignSlug}/lideranca/${leader.id}`}
                      >
                        Ver
                      </Link>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
