import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { api } from '../api';
import { EmptyState, StatusBadge, Toast } from '../components/Ui';

export default function AdminPage() {
  const [summary, setSummary] = useState(null);
  const [municipalities, setMunicipalities] = useState([]);
  const [coordinators, setCoordinators] = useState([]);
  const [toast, setToast] = useState('');
  const [campaignForm, setCampaignForm] = useState({
    name: '',
    candidate: '',
    description: '',
    mission: '',
    accent_color: '#7BA3B8',
    whatsapp_url: 'https://wa.me/message/PV764OTMN3GEE1',
  });
  const [leaderForm, setLeaderForm] = useState({
    campaign_slug: 'fabio-garcia',
    name: '',
    type: 'multiplicador',
    municipality_id: '',
    phone: '',
  });
  const [coordForm, setCoordForm] = useState({
    campaign_slug: 'fabio-garcia',
    name: '',
    phone: '',
    coord_type: 'regional',
    municipality_ids: [],
  });
  const [editingCoordId, setEditingCoordId] = useState(null);
  const [muniSearch, setMuniSearch] = useState('');
  const [coordTypeFilter, setCoordTypeFilter] = useState('all');

  async function refresh() {
    const slug = coordForm.campaign_slug || 'fabio-garcia';
    const [s, m, coords] = await Promise.all([
      api.getAgencySummary(),
      api.getMunicipalities(),
      api.getCoordinators(slug).catch(() => ({ coordinators: [] })),
    ]);
    setSummary(s);
    setMunicipalities(m);
    setCoordinators(coords.coordinators || []);
  }

  useEffect(() => {
    refresh().catch((err) => setToast(err.message));
  }, []);

  const filteredMunicipalities = useMemo(() => {
    const q = muniSearch.trim().toLowerCase();
    if (!q) return municipalities;
    return municipalities.filter((m) => m.name.toLowerCase().includes(q));
  }, [municipalities, muniSearch]);

  async function createCampaign(e) {
    e.preventDefault();
    try {
      const created = await api.createCampaign(campaignForm);
      setToast(`Campanha "${created.name}" criada`);
      setCampaignForm({
        name: '',
        candidate: '',
        description: '',
        mission: '',
        accent_color: '#7BA3B8',
        whatsapp_url: 'https://wa.me/message/PV764OTMN3GEE1',
      });
      await refresh();
    } catch (err) {
      setToast(err.message);
    }
  }

  async function createLeader(e) {
    e.preventDefault();
    try {
      await api.createLeader(leaderForm.campaign_slug, {
        name: leaderForm.name,
        type: leaderForm.type,
        municipality_id: leaderForm.municipality_id ? Number(leaderForm.municipality_id) : null,
        phone: leaderForm.phone,
      });
      setToast('Liderança adicionada');
      setLeaderForm((prev) => ({ ...prev, name: '', phone: '' }));
      await refresh();
    } catch (err) {
      setToast(err.message);
    }
  }

  function toggleMuni(id) {
    setCoordForm((prev) => {
      const has = prev.municipality_ids.includes(id);
      return {
        ...prev,
        municipality_ids: has
          ? prev.municipality_ids.filter((x) => x !== id)
          : [...prev.municipality_ids, id],
      };
    });
  }

  function startEditCoordinator(coord) {
    setEditingCoordId(coord.id);
    setCoordForm({
      campaign_slug: coordForm.campaign_slug,
      name: coord.name,
      phone: coord.phone || '',
      coord_type: coord.coord_type === 'dobra' ? 'dobra' : 'regional',
      municipality_ids: (coord.municipalities || []).map((m) => m.id),
    });
  }

  function resetCoordForm() {
    setEditingCoordId(null);
    setCoordForm((prev) => ({
      ...prev,
      name: '',
      phone: '',
      coord_type: 'regional',
      municipality_ids: [],
    }));
    setMuniSearch('');
  }

  async function saveCoordinator(e) {
    e.preventDefault();
    if (!coordForm.name.trim()) {
      setToast('Informe o nome do coordenador');
      return;
    }
    try {
      const payload = {
        name: coordForm.name.trim(),
        phone: coordForm.phone,
        coord_type: coordForm.coord_type === 'dobra' ? 'dobra' : 'regional',
        municipality_ids: coordForm.municipality_ids,
      };
      if (editingCoordId) {
        await api.updateCoordinator(coordForm.campaign_slug, editingCoordId, payload);
        setToast('Coordenador atualizado');
      } else {
        await api.createCoordinator(coordForm.campaign_slug, payload);
        setToast(
          payload.coord_type === 'dobra'
            ? 'Coordenador de dobra cadastrado'
            : 'Coordenador regional cadastrado',
        );
      }
      resetCoordForm();
      await refresh();
    } catch (err) {
      setToast(err.message);
    }
  }

  async function removeCoordinator(coord) {
    try {
      await api.deleteCoordinator(coordForm.campaign_slug, coord.id);
      setToast(`Coordenador ${coord.name} removido`);
      if (editingCoordId === coord.id) resetCoordForm();
      await refresh();
    } catch (err) {
      setToast(err.message);
    }
  }

  async function changeCoordCampaign(slug) {
    setCoordForm((prev) => ({ ...prev, campaign_slug: slug }));
    setLeaderForm((prev) => ({ ...prev, campaign_slug: slug }));
    try {
      const coords = await api.getCoordinators(slug);
      setCoordinators(coords.coordinators || []);
      resetCoordForm();
      setCoordForm((prev) => ({ ...prev, campaign_slug: slug }));
    } catch (err) {
      setToast(err.message);
    }
  }

  return (
    <>
      <Header />
      <main className="container section">
        <div className="section__head">
          <p className="eyebrow">Administração</p>
          <h1>Gestão Atlas Agency</h1>
          <p>Crie campanhas, lideranças e coordenadores territoriais com dados reais.</p>
        </div>

        <div className="layout-split">
          <section className="panel panel-pad">
            <h3>Nova campanha</h3>
            <form className="form-grid" onSubmit={createCampaign}>
              <label>
                Nome
                <input className="input" required value={campaignForm.name} onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })} />
              </label>
              <label>
                Candidato / Projeto
                <input className="input" value={campaignForm.candidate} onChange={(e) => setCampaignForm({ ...campaignForm, candidate: e.target.value })} />
              </label>
              <label>
                Descrição
                <textarea className="textarea" value={campaignForm.description} onChange={(e) => setCampaignForm({ ...campaignForm, description: e.target.value })} />
              </label>
              <label>
                Missão
                <textarea className="textarea" value={campaignForm.mission} onChange={(e) => setCampaignForm({ ...campaignForm, mission: e.target.value })} />
              </label>
              <label>
                Cor de destaque
                <input className="input" type="color" value={campaignForm.accent_color} onChange={(e) => setCampaignForm({ ...campaignForm, accent_color: e.target.value })} />
              </label>
              <label>
                WhatsApp
                <input className="input" value={campaignForm.whatsapp_url} onChange={(e) => setCampaignForm({ ...campaignForm, whatsapp_url: e.target.value })} />
              </label>
              <button className="btn btn-primary" type="submit">Criar campanha</button>
            </form>
          </section>

          <section className="panel panel-pad">
            <h3>Nova liderança</h3>
            <form className="form-grid" onSubmit={createLeader}>
              <label>
                Campanha
                <select
                  className="select"
                  value={leaderForm.campaign_slug}
                  onChange={(e) => setLeaderForm({ ...leaderForm, campaign_slug: e.target.value })}
                >
                  {(summary?.campaigns || []).map((c) => (
                    <option key={c.id} value={c.slug}>{c.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Nome
                <input className="input" required value={leaderForm.name} onChange={(e) => setLeaderForm({ ...leaderForm, name: e.target.value })} />
              </label>
              <label>
                Tipo
                <select className="select" value={leaderForm.type} onChange={(e) => setLeaderForm({ ...leaderForm, type: e.target.value })}>
                  <option value="politica">Liderança política</option>
                  <option value="multiplicador">Multiplicador</option>
                </select>
              </label>
              <label>
                Município
                <select className="select" value={leaderForm.municipality_id} onChange={(e) => setLeaderForm({ ...leaderForm, municipality_id: e.target.value })}>
                  <option value="">Selecionar</option>
                  {municipalities.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Telefone
                <input className="input" value={leaderForm.phone} onChange={(e) => setLeaderForm({ ...leaderForm, phone: e.target.value })} />
              </label>
              <button className="btn btn-accent" type="submit">Adicionar liderança</button>
            </form>
          </section>
        </div>

        <section className="panel panel-pad" style={{ marginTop: '1.25rem' }}>
          <div className="section__head" style={{ marginBottom: '0.85rem' }}>
            <p className="eyebrow">Território</p>
            <h3 style={{ margin: 0 }}>Coordenadores (regionais + dobra)</h3>
            <p style={{ margin: '0.35rem 0 0' }}>
              Cadastre coordenadores <strong>regionais</strong> (território) e também os de{' '}
              <strong>dobra</strong> (ex.: grupos em Cuiabá). Depois use na aba Coordenadores e em Grupos Dobra.
            </p>
          </div>

          <form className="form-grid" onSubmit={saveCoordinator}>
            <label>
              Campanha
              <select
                className="select"
                value={coordForm.campaign_slug}
                onChange={(e) => changeCoordCampaign(e.target.value)}
              >
                {(summary?.campaigns || []).map((c) => (
                  <option key={c.id} value={c.slug}>{c.name}</option>
                ))}
              </select>
            </label>
            <label>
              Tipo
              <select
                className="select"
                value={coordForm.coord_type}
                onChange={(e) => setCoordForm({ ...coordForm, coord_type: e.target.value })}
              >
                <option value="regional">Regional (território)</option>
                <option value="dobra">Dobra (ex.: Cuiabá / grupos)</option>
              </select>
            </label>
            <label>
              Nome do coordenador
              <input
                className="input"
                required
                value={coordForm.name}
                onChange={(e) => setCoordForm({ ...coordForm, name: e.target.value })}
                placeholder={coordForm.coord_type === 'dobra' ? 'Ex.: Coordenador dobra Cuiabá' : 'Ex.: Ogeda'}
              />
            </label>
            <label>
              Telefone
              <input
                className="input"
                value={coordForm.phone}
                onChange={(e) => setCoordForm({ ...coordForm, phone: e.target.value })}
                placeholder="Opcional"
              />
            </label>

            <div>
              <label style={{ display: 'block', marginBottom: '0.45rem' }}>
                Municípios deste coordenador ({coordForm.municipality_ids.length} selecionados)
                {coordForm.coord_type === 'dobra' ? (
                  <span style={{ display: 'block', fontWeight: 400, color: 'var(--muted)', marginTop: 4 }}>
                    Opcional para dobra — pode marcar Cuiabá sem tirar do regional.
                  </span>
                ) : null}
              </label>
              <input
                className="input"
                value={muniSearch}
                onChange={(e) => setMuniSearch(e.target.value)}
                placeholder="Buscar município…"
                style={{ marginBottom: '0.55rem' }}
              />
              <div className="muni-check-grid">
                {filteredMunicipalities.map((m) => {
                  const checked = coordForm.municipality_ids.includes(m.id);
                  return (
                    <label key={m.id} className={`muni-check ${checked ? 'is-checked' : ''}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleMuni(m.id)}
                      />
                      <span>{m.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" type="submit">
                {editingCoordId ? 'Salvar alterações' : 'Cadastrar coordenador'}
              </button>
              {editingCoordId && (
                <button className="btn btn-soft" type="button" onClick={resetCoordForm}>
                  Cancelar edição
                </button>
              )}
            </div>
          </form>

          <div className="admin-coord-list" style={{ marginTop: '1.25rem' }}>
            <h4 style={{ marginBottom: '0.65rem' }}>Já cadastrados</h4>
            <div className="chip-group" style={{ marginBottom: '0.75rem' }}>
              {[
                { id: 'all', label: 'Todos' },
                { id: 'regional', label: 'Regionais' },
                { id: 'dobra', label: 'Dobra' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`chip ${coordTypeFilter === opt.id ? 'active' : ''}`}
                  onClick={() => setCoordTypeFilter(opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {!coordinators.length && (
              <EmptyState>Nenhum coordenador nesta campanha ainda.</EmptyState>
            )}
            {coordinators
              .filter((c) => coordTypeFilter === 'all' || (c.coord_type || 'regional') === coordTypeFilter)
              .map((coord) => (
              <div className="admin-coord-row" key={coord.id}>
                <div>
                  <strong>
                    {coord.name}
                    <span className={`coord-type-pill coord-type-pill--${coord.coord_type === 'dobra' ? 'dobra' : 'regional'}`}>
                      {coord.coord_type === 'dobra' ? 'Dobra' : 'Regional'}
                    </span>
                  </strong>
                  <p style={{ margin: '0.2rem 0 0' }}>
                    {coord.totals.municipalities} município(s) · {coord.totals.registrations} cadastro(s)
                    {coord.health?.label ? ` · ${coord.health.label}` : ''}
                  </p>
                  {!!coord.municipalities?.length && (
                    <p className="admin-coord-munis">
                      {coord.municipalities.map((m) => m.name).join(', ')}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                  <button className="btn btn-soft btn-sm" type="button" onClick={() => startEditCoordinator(coord)}>
                    Editar
                  </button>
                  <Link
                    className="btn btn-accent btn-sm"
                    to={`/campanha/${coordForm.campaign_slug}/coordenadores`}
                  >
                    Ver painel
                  </Link>
                  <button className="btn btn-sm btn-warn-soft" type="button" onClick={() => removeCoordinator(coord)}>
                    Remover
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel panel-pad" style={{ marginTop: '1.25rem' }}>
          <h3>Campanhas</h3>
          {!summary && <EmptyState>Carregando…</EmptyState>}
          <div className="campaign-list" style={{ marginTop: '0.85rem' }}>
            {(summary?.campaigns || []).map((campaign) => (
              <div className="campaign-row" key={campaign.id}>
                <img src={campaign.logo_url || '/logos/atlas-agency.png'} alt="" />
                <div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <strong>{campaign.name}</strong>
                    <StatusBadge status={campaign.status} />
                  </div>
                  <p style={{ marginBottom: 0 }}>{campaign.description}</p>
                </div>
                <Link className="btn btn-soft btn-sm" to={`/campanha/${campaign.slug}/coordenadores`}>
                  Coordenadores
                </Link>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
      <Toast message={toast} onClose={() => setToast('')} />
    </>
  );
}
