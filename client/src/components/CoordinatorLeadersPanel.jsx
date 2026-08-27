import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

/**
 * Controle de lideranças do coordenador:
 * cadastrar liderança, copiar link e ver pessoas mobilizadas.
 */
export default function CoordinatorLeadersPanel({
  campaignSlug,
  coordinatorName,
  leaders = [],
  municipalities = [],
  compact = false,
  onChanged,
}) {
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    type: 'politica',
    municipality_id: '',
    phone: '',
  });

  const totalLeaders = leaders.length;
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
      setError('');
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
    setBusy(true);
    setError('');
    try {
      await api.createLeader(campaignSlug, {
        name: form.name.trim(),
        type: form.type,
        municipality_id: Number(form.municipality_id),
        phone: form.phone.trim() || null,
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
          <p className="eyebrow" style={{ marginBottom: 0 }}>Controle de lideranças</p>
          <strong>
            {totalLeaders} liderança{totalLeaders === 1 ? '' : 's'}
            {coordinatorName ? ` · ${coordinatorName}` : ''}
          </strong>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.88rem', color: 'var(--muted)' }}>
            Cadastre a liderança aqui → copie o link → ela compartilha → o total sobe nesta lista.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="badge badge--ok">
            {totalPeople} pessoa{totalPeople === 1 ? '' : 's'} mobilizada{totalPeople === 1 ? '' : 's'}
          </span>
          {!compact ? (
            <button
              type="button"
              className="btn btn-accent btn-sm"
              onClick={() => setShowForm((v) => !v)}
            >
              {showForm ? 'Fechar' : 'Nova liderança'}
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
              placeholder="Quem o coordenador está trazendo"
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
            Município *
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
          <button className="btn btn-primary" type="submit" disabled={busy || !muniOptions.length}>
            {busy ? 'Salvando…' : 'Cadastrar e gerar link'}
          </button>
          {!muniOptions.length ? (
            <p style={{ margin: 0, color: '#8a5a64', fontSize: '0.88rem' }}>
              Este coordenador ainda não tem municípios. Edite o coordenador e vincule as cidades antes.
            </p>
          ) : null}
        </form>
      ) : null}

      {!leaders.length ? (
        <p style={{ margin: '0.55rem 0 0', color: 'var(--muted)', fontSize: '0.9rem' }}>
          Nenhuma liderança ainda. Clique em <strong>Nova liderança</strong> para o coordenador
          passar o nome e já gerar o link de mobilização.
        </p>
      ) : (
        <div className="table-wrap" style={{ marginTop: '0.65rem' }}>
          <table className="coord-leaders-table">
            <thead>
              <tr>
                <th>Liderança</th>
                <th>Município</th>
                <th>Pessoas mobilizadas</th>
                <th>Link</th>
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
                  <td>
                    {leader.referral_code || leader.link_path ? (
                      <button
                        type="button"
                        className="btn btn-soft btn-sm"
                        onClick={() => copyLink(leader)}
                      >
                        Copiar link
                      </button>
                    ) : '—'}
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
