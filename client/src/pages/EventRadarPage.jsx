import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { formatDateTime } from '../utils/date';
import { EmptyState } from '../components/Ui';

export default function EventRadarPage() {
  const { slug, eventId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await api.getEventRadar(slug, eventId);
        if (alive) {
          setData(res);
          setError('');
        }
      } catch (err) {
        if (alive) setError(err.message);
      }
    }
    load();
    const id = window.setInterval(load, 2500);
    const pulse = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => {
      alive = false;
      window.clearInterval(id);
      window.clearInterval(pulse);
    };
  }, [slug, eventId]);

  if (error) {
    return (
      <div className="container section">
        <EmptyState>{error}</EmptyState>
        <Link className="btn btn-soft" to={`/campanha/${slug}/mobilizacao`}>Voltar</Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container section">
        <EmptyState>Abrindo radar…</EmptyState>
      </div>
    );
  }

  const { event, total, whatsapp_clicks, recent_pace, recent } = data;
  const waPct = total ? Math.round((whatsapp_clicks / total) * 100) : 0;

  return (
    <div className="radar-page">
      <div className="radar-page__top">
        <div>
          <p className="eyebrow">Radar ao vivo</p>
          <h1>{event.name}</h1>
          <p>
            {event.location || 'Sem local'} · atualiza a cada 2,5s
            <span className="radar-pulse" aria-hidden="true" data-tick={tick} />
          </p>
        </div>
        <Link className="btn btn-soft" to={`/campanha/${slug}/mobilizacao`}>
          Voltar à mobilização
        </Link>
      </div>

      <div className="radar-stats">
        <article>
          <strong>{total}</strong>
          <span>Cadastros</span>
        </article>
        <article>
          <strong>{recent_pace}</strong>
          <span>Últimos 2 min</span>
        </article>
        <article>
          <strong>{waPct}%</strong>
          <span>Foram ao WhatsApp</span>
        </article>
      </div>

      <section className="panel panel-pad radar-feed">
        <h3 style={{ marginTop: 0 }}>Entrando agora</h3>
        {!recent.length && <EmptyState>Aguardando primeiros cadastros do QR…</EmptyState>}
        <ul className="radar-list">
          {recent.map((person) => (
            <li key={person.id}>
              <div>
                <strong>{person.full_name}</strong>
                <span>{person.organizer_name ? ` · ${person.organizer_name}` : ''}</span>
              </div>
              <time>{formatDateTime(person.created_at)}</time>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
