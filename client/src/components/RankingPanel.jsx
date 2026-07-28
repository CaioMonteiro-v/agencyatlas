import { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePolling } from '../hooks/usePolling';
import { api } from '../api';
import { Avatar, EmptyState, StatusBadge } from './Ui';

export default function RankingPanel({ campaignSlug }) {
  const [type, setType] = useState('');
  const { data, loading, error } = usePolling(
    () => api.getRanking(campaignSlug, type || undefined),
    6000,
    [campaignSlug, type]
  );

  return (
    <section className="panel panel-pad">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <p className="eyebrow">Tempo real</p>
          <h3>Ranking de lideranças</h3>
          <p style={{ marginBottom: 0 }}>Cadastros + participação em missões.</p>
        </div>
        <div className="chip-group">
          {[
            { value: '', label: 'Todos' },
            { value: 'politica', label: 'Políticas' },
            { value: 'multiplicador', label: 'Multiplicadores' },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`chip ${type === opt.value ? 'active' : ''}`}
              onClick={() => setType(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading && !data && <EmptyState>Atualizando ranking…</EmptyState>}
      {error && <EmptyState>{error}</EmptyState>}

      <div className="rank-list" style={{ marginTop: '1rem' }}>
        {(data?.ranking || []).slice(0, 12).map((item) => (
          <div className={`rank-item ${item.position <= 3 ? 'top' : ''}`} key={item.id}>
            <div className="rank-pos">{item.position}º</div>
            <Avatar name={item.name} photo={item.photo_url} />
            <div>
              <strong>{item.name}</strong>
              <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                {item.municipality_name || 'Sem município'} ·{' '}
                {item.type === 'politica' ? 'Política' : 'Multiplicador'}
              </div>
              <StatusBadge status={item.status} />
            </div>
            <div style={{ textAlign: 'right' }}>
              <strong>{item.score}</strong>
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                {item.registrations_count} cad. · +{item.mission_bonus} missão
              </div>
              <Link
                to={`/campanha/${campaignSlug}/lideranca/${item.id}`}
                className="btn btn-soft btn-sm"
                style={{ marginTop: 6 }}
              >
                Ver
              </Link>
            </div>
          </div>
        ))}
      </div>

      {data?.updated_at && (
        <p style={{ marginTop: '0.85rem', marginBottom: 0, fontSize: '0.85rem' }}>
          Atualizado em {new Date(data.updated_at).toLocaleTimeString('pt-BR')}
        </p>
      )}
    </section>
  );
}
