import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { api } from '../api';
import { EmptyState, StatusBadge, Toast } from '../components/Ui';

export default function AdminPage() {
  const [summary, setSummary] = useState(null);
  const [municipalities, setMunicipalities] = useState([]);
  const [toast, setToast] = useState('');
  const [campaignForm, setCampaignForm] = useState({
    name: '',
    candidate: '',
    description: '',
    mission: '',
    accent_color: '#7BA3B8',
    whatsapp_url: 'https://bit.ly/FalaFabio',
  });
  const [leaderForm, setLeaderForm] = useState({
    campaign_slug: 'fabio-garcia',
    name: '',
    type: 'multiplicador',
    municipality_id: '',
    phone: '',
  });
  const [coordForm, setCoordForm] = useState({
    municipality_id: '',
    coordinator_name: '',
  });

  async function refresh() {
    const [s, m] = await Promise.all([api.getAgencySummary(), api.getMunicipalities()]);
    setSummary(s);
    setMunicipalities(m);
  }

  useEffect(() => {
    refresh().catch((err) => setToast(err.message));
  }, []);

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
        whatsapp_url: 'https://bit.ly/FalaFabio',
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

  async function saveCoordinator(e) {
    e.preventDefault();
    if (!coordForm.municipality_id) {
      setToast('Selecione o município');
      return;
    }
    try {
      await api.updateMunicipality(coordForm.municipality_id, {
        coordinator_name: coordForm.coordinator_name,
      });
      setToast('Coordenador atualizado');
      setCoordForm({ municipality_id: '', coordinator_name: '' });
      await refresh();
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
          <p>Crie campanhas, lideranças e coordenadores municipais com dados reais.</p>
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
          <h3>Coordenador geral do município</h3>
          <p>Defina quem é o coordenador de cada cidade (aparece no mapa ao clicar no município).</p>
          <form className="form-grid" onSubmit={saveCoordinator} style={{ marginTop: '0.75rem' }}>
            <label>
              Município
              <select
                className="select"
                value={coordForm.municipality_id}
                onChange={(e) => {
                  const id = e.target.value;
                  const muni = municipalities.find((m) => String(m.id) === id);
                  setCoordForm({
                    municipality_id: id,
                    coordinator_name: muni?.coordinator_name || '',
                  });
                }}
              >
                <option value="">Selecionar</option>
                {municipalities.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}{m.coordinator_name ? ` — ${m.coordinator_name}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Nome do coordenador
              <input
                className="input"
                value={coordForm.coordinator_name}
                onChange={(e) => setCoordForm({ ...coordForm, coordinator_name: e.target.value })}
                placeholder="Ex.: Colíder — Ogeda"
              />
            </label>
            <button className="btn btn-primary" type="submit">Salvar coordenador</button>
          </form>
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
                <Link className="btn btn-soft btn-sm" to={`/campanha/${campaign.slug}/mobilizacao`}>
                  Abrir
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
