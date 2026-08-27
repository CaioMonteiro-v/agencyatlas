import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

/**
 * Hierarquia:
 * Coordenador (regional ou dobra)
 *   → Liderança A — total mobilizado
 *   → Liderança B — total mobilizado
 *
 * Em dobra, muitas lideranças ficam com município Cuiabá, mas são
 * lideranças daquele coordenador de dobra — não do regional.
 */
export default function CoordinatorLeadersPanel({
  campaignSlug,
  coordinatorId,
  coordinatorName,
  coordType = 'regional',
  leaders = [],
  municipalities = [],
  compact = false,
  onChanged,
}) {
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [form, setForm] = useState({
    name: '',
    type: 'politica',
    municipality_id: '',
    phone: '',
  });

  const isDobra = coordType === 'dobra';
  const coordLabel = coordinatorName || 'Coordenador';
  const totalPeople = leaders.reduce((sum, l) => sum + Number(l.registrations_count || 0), 0);
  const muniOptions = municipalities.length
    ? municipalities
    : [...new Map(
      leaders
        .filter((l) => l.municipality_id)
        .map((l) => [l.municipality_id, { id: l.municipality_id, name: l.municipality_name || 'Município' }]),
    ).values()];

  function leaderLink(leader) {
    const path = leader.link_path
      || (leader.referral_code ? `/r/${campaignSlug}/${leader.referral_code}` : '');
    if (!path) return '';
    return `${window.location.origin}${path}`;
  }

  async function copyLink(leader) {
    const link = leaderLink(leader);
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(leader.id);
      setError('');
      window.setTimeout(() => setCopiedId((id) => (id === leader.id ? null : id)), 2000);
    } catch {
      setError('Não foi possível copiar o link');
    }
  }

  async function onCreate(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Informe o nome da liderança');
      return;
    }
    if (!form.municipality_id) {
      setError('Selecione o município da liderança');
      return;
    }
    if (!coordinatorId) {
      setError('Coordenador não identificado');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.createLeader(campaignSlug, {
        name: form.name.trim(),
        type: form.type,
        municipality_id: Number(form.municipality_id),
        phone: form.phone.trim() || null,
        coordinator_id: Number(coordinatorId),
      });
      setForm({
        name: '',
        type: 'politica',
        municipality_id: form.municipality_id,
        phone: '',
      });
      setShowForm(false);
      if (typeof onChanged === 'function') await onChanged();
    } catch (err) {
      setError(err.message || 'Falha ao cadastrar liderança');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`coord-leaders-panel ${compact ? 'coord-leaders-panel--compact' : ''}`}>
      <div className="coord-leaders-panel__head">
        <div>
          <p className="eyebrow" style={{ marginBottom: 0 }}>
            {isDobra ? 'Hierarquia de dobra' : 'Hierarquia de mobilização'}
          </p>
          <strong>
            Coordenador {coordLabel}
            {isDobra ? (
              <span className="coord-type-pill coord-type-pill--dobra" style={{ marginLeft: '0.45rem' }}>
                Dobra
              </span>
            ) : null}
          </strong>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.88rem', color: 'var(--muted)' }}>
            {isDobra
              ? 'Lideranças de dobra podem estar em Cuiabá no cadastro, mas pertencem a este coordenador de dobra — não ao regional. Cada uma tem o próprio link para jogar.'
              : 'Cada liderança tem o próprio link. O coordenador joga o link para ela; ela mobiliza; o total aparece embaixo do coordenador.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="badge badge--ok">
            Total mobilizado: {totalPeople}
          </span>
          {!compact ? (
            <button
              type="button"
              className="btn btn-accent btn-sm"
              onClick={() => setShowForm((v) => !v)}
            >
              {showForm ? 'Fechar' : isDobra ? 'Nova liderança de dobra' : 'Nova liderança'}
            </button>
          ) : null}
        </div>
      </div>

      {showForm && !compact ? (
        <form className="form-grid" style={{ marginTop: '0.85rem' }} onSubmit={onCreate}>
          <label>
            Nome da liderança *
            <input
              className="input"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={isDobra ? 'Ex.: liderança de dobra deste coordenador' : 'Ex.: nome da liderança do coordenador'}
            />
          </label>
          <label>
            Tipo
            <select
              className="select"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <option value="politica">Liderança política</option>
              <option value="multiplicador">Multiplicador</option>
            </select>
          </label>
          <label>
            Município operacional *
            <select
              className="select"
              required
              value={form.municipality_id}
              onChange={(e) => setForm({ ...form, municipality_id: e.target.value })}
            >
              <option value="">Selecione</option>
              {muniOptions.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            {isDobra ? (
              <span style={{ display: 'block', marginTop: '0.35rem', fontSize: '0.82rem', color: 'var(--muted)' }}>
                Em dobra costuma ser Cuiabá — a liderança continua sendo deste coordenador de dobra.
              </span>
            ) : null}
          </label>
          <label>
            Telefone
            <input
              className="input"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="Opcional"
            />
          </label>
          {error ? <p style={{ margin: 0, color: '#8a5a64' }}>{error}</p> : null}
          <button className="btn btn-primary" type="submit" disabled={busy || !muniOptions.length || !coordinatorId}>
            {busy ? 'Salvando…' : isDobra ? 'Cadastrar liderança de dobra e gerar link' : 'Cadastrar liderança e gerar link'}
          </button>
          {!muniOptions.length ? (
            <p style={{ margin: 0, color: '#8a5a64', fontSize: '0.88rem' }}>
              Vincule municípios neste coordenador antes de cadastrar lideranças.
            </p>
          ) : null}
        </form>
      ) : null}

      {!leaders.length ? (
        <p style={{ margin: '0.75rem 0 0', color: 'var(--muted)', fontSize: '0.9rem' }}>
          Ainda sem lideranças{isDobra ? ' de dobra' : ''} sob <strong>{coordLabel}</strong>.
          Cadastre a primeira para gerar o link que o coordenador vai jogar para ela.
        </p>
      ) : (
        <div className="coord-hierarchy" style={{ marginTop: '0.85rem' }}>
          <div className="coord-hierarchy__root">
            <strong>
              Coordenador {coordLabel}
              {isDobra ? ' · Dobra' : ''}
            </strong>
            <span>Total mobilizado: {totalPeople}</span>
          </div>
          <ul className="coord-hierarchy__list">
            {leaders.map((leader) => (
              <li key={leader.id} className="coord-hierarchy__item">
                <div className="coord-hierarchy__main">
                  <div>
                    <strong>
                      {isDobra || leader.is_dobra ? 'Liderança de dobra: ' : 'Liderança: '}
                      {leader.name}
                    </strong>
                    <div style={{ fontSize: '0.84rem', color: 'var(--muted)' }}>
                      {leader.municipality_name || 'Sem município'}
                      {isDobra || leader.is_dobra ? ' · Dobra' : ''}
                      {leader.type === 'multiplicador' ? ' · Multiplicador' : ' · Política'}
                    </div>
                  </div>
                  <div className="coord-hierarchy__total">
                    Total mobilizado: <strong>{Number(leader.registrations_count || 0)}</strong>
                  </div>
                </div>
                <div className="coord-hierarchy__actions">
                  {(leader.referral_code || leader.link_path) ? (
                    <button
                      type="button"
                      className="btn btn-soft btn-sm"
                      onClick={() => copyLink(leader)}
                    >
                      {copiedId === leader.id ? 'Link copiado' : 'Copiar link para jogar'}
                    </button>
                  ) : null}
                  {!compact && campaignSlug ? (
                    <Link
                      className="btn btn-soft btn-sm"
                      to={`/campanha/${campaignSlug}/lideranca/${leader.id}`}
                    >
                      Ver cadastros
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
