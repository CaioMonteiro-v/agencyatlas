import { useEffect, useState } from 'react';
import { api } from '../api';
import { EmptyState, StatusBadge, Toast } from './Ui';

export default function MissionsPanel({ campaignSlug }) {
  const [missions, setMissions] = useState([]);
  const [leaders, setLeaders] = useState([]);
  const [municipalities, setMunicipalities] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState('');
  const [form, setForm] = useState({
    title: '',
    description: '',
    target: 100,
    municipality_id: '',
    leader_ids: [],
  });

  async function load() {
    const [m, l, munis] = await Promise.all([
      api.getMissions(campaignSlug),
      api.getLeaders(campaignSlug),
      api.getMunicipalities(),
    ]);
    setMissions(m);
    setLeaders(l);
    setMunicipalities(munis);
  }

  useEffect(() => {
    load().catch((err) => setToast(err.message));
  }, [campaignSlug]);

  async function onCreate(e) {
    e.preventDefault();
    try {
      await api.createMission(campaignSlug, {
        ...form,
        target: Number(form.target),
        municipality_id: form.municipality_id ? Number(form.municipality_id) : null,
        leader_ids: form.leader_ids.map(Number),
      });
      setShowForm(false);
      setForm({ title: '', description: '', target: 100, municipality_id: '', leader_ids: [] });
      setToast('Missão criada');
      await load();
    } catch (err) {
      setToast(err.message);
    }
  }

  async function bumpProgress(mission, delta) {
    const progress = Math.max(0, mission.progress + delta);
    await api.updateMissionProgress(campaignSlug, mission.id, { progress });
    setToast(progress >= mission.target ? 'Missão concluída! Ranking atualizado.' : 'Progresso atualizado');
    await load();
  }

  function toggleLeader(id) {
    setForm((prev) => ({
      ...prev,
      leader_ids: prev.leader_ids.includes(String(id))
        ? prev.leader_ids.filter((x) => x !== String(id))
        : [...prev.leader_ids, String(id)],
    }));
  }

  return (
    <section className="panel panel-pad">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <p className="eyebrow">Metas</p>
          <h3>Missões e metas</h3>
          <p>Acompanhe o progresso e recompense quem mais mobiliza no ranking.</p>
        </div>
        <button type="button" className="btn btn-accent btn-sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Fechar' : 'Nova missão'}
        </button>
      </div>

      {showForm && (
        <form className="form-grid" style={{ marginTop: '1rem' }} onSubmit={onCreate}>
          <label>
            Título
            <input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </label>
          <label>
            Descrição
            <textarea className="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <label>
              Meta
              <input className="input" type="number" min="1" required value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} />
            </label>
            <label>
              Município
              <select className="select" value={form.municipality_id} onChange={(e) => setForm({ ...form, municipality_id: e.target.value })}>
                <option value="">Geral</option>
                {municipalities.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </label>
          </div>
          <div>
            <strong style={{ display: 'block', marginBottom: 8 }}>Atribuir lideranças</strong>
            <div className="chip-group">
              {leaders.slice(0, 16).map((leader) => (
                <button
                  key={leader.id}
                  type="button"
                  className={`chip ${form.leader_ids.includes(String(leader.id)) ? 'active' : ''}`}
                  onClick={() => toggleLeader(leader.id)}
                >
                  {leader.name}
                </button>
              ))}
            </div>
          </div>
          <button className="btn btn-primary" type="submit">Criar missão</button>
        </form>
      )}

      <div className="stack" style={{ marginTop: '1.1rem' }}>
        {missions.map((mission) => (
          <article className="mission-card" key={mission.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div>
                <h4>{mission.title}</h4>
                <p style={{ marginBottom: 0 }}>{mission.description}</p>
                <p style={{ marginBottom: 0, color: 'var(--muted)' }}>
                  {mission.municipality_name || 'Campanha geral'}
                </p>
              </div>
              <StatusBadge status={mission.status} />
            </div>
            <div className="progress" aria-label="Progresso da missão">
              <span style={{ width: `${mission.percent}%` }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
              <strong>{mission.progress} / {mission.target} ({mission.percent}%)</strong>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button type="button" className="btn btn-soft btn-sm" onClick={() => bumpProgress(mission, 5)}>+5</button>
                <button type="button" className="btn btn-soft btn-sm" onClick={() => bumpProgress(mission, 10)}>+10</button>
              </div>
            </div>
            {!!mission.assignments?.length && (
              <div style={{ marginTop: '0.75rem' }}>
                <strong style={{ fontSize: '0.9rem' }}>Equipe</strong>
                <div className="chip-group" style={{ marginTop: 8 }}>
                  {mission.assignments.map((a) => (
                    <span className="chip" key={a.id}>
                      {a.leader_name} · {a.contribution}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </article>
        ))}
      </div>

      {!missions.length && <EmptyState>Nenhuma missão criada ainda.</EmptyState>}
      <Toast message={toast} onClose={() => setToast('')} />
    </section>
  );
}
