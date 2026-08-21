import { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../api';
import { EmptyState, Toast } from '../components/Ui';
import { printGruposDobraDocument } from '../lib/printGruposDobra';

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`Falha ao ler ${file.name}`));
    reader.readAsDataURL(file);
  });
}

const emptyDeputyForm = {
  name: '',
  campaign_coordinator_id: '',
  dobra_coordinator_id: '',
  notes: '',
};

const emptyGroupForm = {
  name: '',
  invite_link: '',
  bitly_url: '',
  members_initial: '13',
  members_current: '13',
  deputy_id: '',
  campaign_coordinator_id: '',
  dobra_coordinator_id: '',
  municipality_id: '',
  opened_at: new Date().toISOString().slice(0, 10),
  notes: '',
  photo_file: null,
  create_bitly: true,
};

function groupFormFrom(g) {
  return {
    name: g.name || '',
    invite_link: g.invite_link || '',
    bitly_url: g.bitly_url || '',
    members_initial: String(g.members_initial ?? 0),
    members_current: String(g.members_current ?? 0),
    deputy_id: g.deputy_id ? String(g.deputy_id) : '',
    campaign_coordinator_id: g.campaign_coordinator_id
      ? String(g.campaign_coordinator_id)
      : (g.coordinator_id ? String(g.coordinator_id) : ''),
    dobra_coordinator_id: g.dobra_coordinator_id ? String(g.dobra_coordinator_id) : '',
    municipality_id: g.municipality_id ? String(g.municipality_id) : '',
    opened_at: g.opened_at ? String(g.opened_at).slice(0, 10) : '',
    notes: g.notes || '',
    photo_file: null,
    create_bitly: !g.bitly_url,
  };
}

function coordOptions(list, preferType) {
  const sorted = (list || []).slice().sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  if (!preferType) return sorted;
  return sorted.slice().sort((a, b) => {
    const aMatch = (a.coord_type || 'regional') === preferType ? 0 : 1;
    const bMatch = (b.coord_type || 'regional') === preferType ? 0 : 1;
    if (aMatch !== bMatch) return aMatch - bMatch;
    return a.name.localeCompare(b.name, 'pt-BR');
  });
}

export default function GruposDobraPage() {
  const { campaign } = useOutletContext();
  const [deputies, setDeputies] = useState([]);
  const [coordinators, setCoordinators] = useState([]);
  const [groups, setGroups] = useState([]);
  const [summary, setSummary] = useState(null);
  const [bitlyConfigured, setBitlyConfigured] = useState(false);
  const [allMunicipalities, setAllMunicipalities] = useState([]);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedDeputyId, setSelectedDeputyId] = useState(null);
  const [showDeputyForm, setShowDeputyForm] = useState(false);
  const [editingDeputyId, setEditingDeputyId] = useState(null);
  const [deputyForm, setDeputyForm] = useState(emptyDeputyForm);

  const [showGroupForm, setShowGroupForm] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [groupForm, setGroupForm] = useState(emptyGroupForm);

  const printRef = useRef(null);
  const formRef = useRef(null);

  const muniOptions = useMemo(
    () => allMunicipalities.slice().sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [allMunicipalities],
  );

  const selectedDeputy = useMemo(
    () => deputies.find((d) => d.id === Number(selectedDeputyId)) || null,
    [deputies, selectedDeputyId],
  );

  const personGroups = useMemo(() => {
    if (!selectedDeputy) return [];
    return groups.filter(
      (g) => g.status !== 'arquivado' && Number(g.deputy_id) === Number(selectedDeputy.id),
    );
  }, [groups, selectedDeputy]);

  const campaignCoords = useMemo(
    () => coordOptions(coordinators, 'regional'),
    [coordinators],
  );
  const dobraCoords = useMemo(
    () => coordOptions(coordinators, 'dobra'),
    [coordinators],
  );

  async function load() {
    setLoading(true);
    try {
      const [depRes, grpRes, munis] = await Promise.all([
        api.getDobraDeputies(campaign.slug),
        api.getDobraGroups(campaign.slug),
        api.getMunicipalities().catch(() => []),
      ]);
      setDeputies(depRes.deputies || []);
      setCoordinators(depRes.coordinators || []);
      setGroups(grpRes.groups || []);
      setSummary(grpRes.summary || null);
      setBitlyConfigured(Boolean(grpRes.bitly_configured));
      setAllMunicipalities(Array.isArray(munis) ? munis : (munis.municipalities || []));
      setError('');
    } catch (err) {
      setError(err.message || 'Erro ao carregar grupos dobra');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [campaign.slug]);

  function openCreateDeputy() {
    setEditingDeputyId(null);
    setDeputyForm(emptyDeputyForm);
    setShowDeputyForm(true);
    setShowGroupForm(false);
  }

  function openEditDeputy(dep) {
    setEditingDeputyId(dep.id);
    setDeputyForm({
      name: dep.name || '',
      campaign_coordinator_id: dep.campaign_coordinator_id ? String(dep.campaign_coordinator_id) : '',
      dobra_coordinator_id: dep.dobra_coordinator_id ? String(dep.dobra_coordinator_id) : '',
      notes: dep.notes || '',
    });
    setShowDeputyForm(true);
    setShowGroupForm(false);
  }

  function closeDeputyForm() {
    setShowDeputyForm(false);
    setEditingDeputyId(null);
    setDeputyForm(emptyDeputyForm);
  }

  async function onSubmitDeputy(e) {
    e.preventDefault();
    if (!deputyForm.name.trim()) {
      setToast('Informe o nome do Deputado Estadual');
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: deputyForm.name.trim(),
        campaign_coordinator_id: deputyForm.campaign_coordinator_id
          ? Number(deputyForm.campaign_coordinator_id)
          : null,
        dobra_coordinator_id: deputyForm.dobra_coordinator_id
          ? Number(deputyForm.dobra_coordinator_id)
          : null,
        notes: deputyForm.notes.trim() || null,
      };
      const res = editingDeputyId
        ? await api.updateDobraDeputy(campaign.slug, editingDeputyId, body)
        : await api.createDobraDeputy(campaign.slug, body);
      setDeputies(res.deputies || []);
      setToast(editingDeputyId ? 'Card do deputado atualizado' : 'Card do Deputado Estadual criado');
      closeDeputyForm();
      if (!editingDeputyId && res.deputy?.id) setSelectedDeputyId(res.deputy.id);
    } catch (err) {
      setToast(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeDeputy(dep) {
    if (!window.confirm(`Remover o card do deputado "${dep.name}"?`)) return;
    try {
      const res = await api.deleteDobraDeputy(campaign.slug, dep.id);
      setDeputies(res.deputies || []);
      if (Number(selectedDeputyId) === Number(dep.id)) setSelectedDeputyId(null);
      setToast('Card removido');
    } catch (err) {
      setToast(err.message);
    }
  }

  function applyDeputyDefaults(deputyId, prev = emptyGroupForm) {
    const dep = deputies.find((d) => d.id === Number(deputyId));
    return {
      ...prev,
      deputy_id: deputyId ? String(deputyId) : '',
      campaign_coordinator_id: dep?.campaign_coordinator_id
        ? String(dep.campaign_coordinator_id)
        : prev.campaign_coordinator_id,
      dobra_coordinator_id: dep?.dobra_coordinator_id
        ? String(dep.dobra_coordinator_id)
        : prev.dobra_coordinator_id,
    };
  }

  function openCreateGroup() {
    if (!deputies.length) {
      setToast('Cadastre primeiro o card do Deputado Estadual');
      openCreateDeputy();
      return;
    }
    setEditingGroupId(null);
    setGroupForm(applyDeputyDefaults(
      selectedDeputyId || deputies[0].id,
      { ...emptyGroupForm, opened_at: new Date().toISOString().slice(0, 10) },
    ));
    setShowGroupForm(true);
    setShowDeputyForm(false);
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function openEditGroup(group) {
    setEditingGroupId(group.id);
    setGroupForm(groupFormFrom(group));
    setShowGroupForm(true);
    setShowDeputyForm(false);
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function closeGroupForm() {
    setShowGroupForm(false);
    setEditingGroupId(null);
    setGroupForm(emptyGroupForm);
  }

  async function onSubmitGroup(e) {
    e.preventDefault();
    if (!groupForm.name.trim()) {
      setToast('Informe o nome do grupo');
      return;
    }
    if (!groupForm.deputy_id) {
      setToast('Selecione o Deputado Estadual');
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: groupForm.name.trim(),
        invite_link: groupForm.invite_link.trim() || null,
        bitly_url: groupForm.bitly_url.trim() || null,
        members_initial: Number(groupForm.members_initial) || 0,
        members_current: Number(groupForm.members_current) || Number(groupForm.members_initial) || 0,
        deputy_id: Number(groupForm.deputy_id),
        campaign_coordinator_id: groupForm.campaign_coordinator_id
          ? Number(groupForm.campaign_coordinator_id)
          : null,
        dobra_coordinator_id: groupForm.dobra_coordinator_id
          ? Number(groupForm.dobra_coordinator_id)
          : null,
        municipality_id: groupForm.municipality_id ? Number(groupForm.municipality_id) : null,
        opened_at: groupForm.opened_at || null,
        notes: groupForm.notes.trim() || null,
      };
      if (groupForm.photo_file) {
        body.photo_data_url = await readFileAsDataUrl(groupForm.photo_file);
        body.photo_name = groupForm.photo_file.name;
      }

      let res;
      if (editingGroupId) {
        if (groupForm.create_bitly && !body.bitly_url && body.invite_link) body.create_bitly = true;
        res = await api.updateDobraGroup(campaign.slug, editingGroupId, body);
        setToast(`Grupo atualizado · ${res.group?.members_current ?? body.members_current} pessoas agora`);
      } else {
        res = await api.createDobraGroup(campaign.slug, body);
        const bitlyNote = res.group?.bitly_url
          ? ` · Bitly ${res.group.bitly_url}`
          : (res.bitly_error ? ` · Bitly: ${res.bitly_error}` : '');
        setToast(`Grupo cadastrado${bitlyNote}`);
      }

      setGroups(res.groups || []);
      setSummary(res.summary || null);
      const depRes = await api.getDobraDeputies(campaign.slug).catch(() => null);
      if (depRes) {
        setDeputies(depRes.deputies || []);
        setCoordinators(depRes.coordinators || []);
      }
      if (body.deputy_id) setSelectedDeputyId(body.deputy_id);
      closeGroupForm();
    } catch (err) {
      setToast(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function createBitly(group) {
    try {
      const res = await api.updateDobraGroup(campaign.slug, group.id, { create_bitly: true });
      setGroups(res.groups || []);
      setSummary(res.summary || null);
      setToast(res.group?.bitly_url ? `Bitly criado: ${res.group.bitly_url}` : 'Bitly atualizado');
    } catch (err) {
      setToast(err.message);
    }
  }

  async function syncOne(group) {
    try {
      await api.syncDobraGroup(campaign.slug, group.id);
      await load();
      setToast(`Cliques sincronizados: ${group.name}`);
    } catch (err) {
      setToast(err.message);
    }
  }

  async function syncAll() {
    try {
      const res = await api.syncAllDobraGroups(campaign.slug);
      setGroups(res.groups || []);
      setSummary(res.summary || null);
      setToast(`Bitly: ${res.synced} ok${res.failed ? `, ${res.failed} falha(s)` : ''}`);
    } catch (err) {
      setToast(err.message);
    }
  }

  async function removeGroup(group) {
    if (!window.confirm(`Remover o grupo "${group.name}"?`)) return;
    try {
      const res = await api.deleteDobraGroup(campaign.slug, group.id);
      setGroups(res.groups || []);
      setSummary(res.summary || null);
      if (editingGroupId === group.id) closeGroupForm();
      const depRes = await api.getDobraDeputies(campaign.slug).catch(() => null);
      if (depRes) setDeputies(depRes.deputies || []);
      setToast('Grupo removido');
    } catch (err) {
      setToast(err.message);
    }
  }

  function onPrint() {
    printGruposDobraDocument(printRef.current, {
      campaign: campaign.name,
      candidate: campaign.candidate,
    });
  }

  const showingDeputies = !selectedDeputy;
  const printGroups = selectedDeputy
    ? personGroups
    : groups.filter((g) => g.status !== 'arquivado');

  return (
    <div className="dobra-page">
      <div className="container section" style={{ paddingTop: 0 }}>
        <div className="section__head no-print">
          <p className="eyebrow">Material de mobilização</p>
          <h2>Grupos Dobra</h2>
          <p>
            1) Crie o <strong>Deputado Estadual</strong> (só o nome).
            2) Ao cadastrar o grupo, <strong>seleciona</strong> o deputado na lista.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.85rem' }}>
            <button type="button" className="btn btn-accent btn-sm" onClick={openCreateDeputy}>
              Novo Deputado Estadual
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={openCreateGroup}>
              Cadastrar grupo
            </button>
            <button type="button" className="btn btn-soft btn-sm" onClick={syncAll} disabled={!bitlyConfigured}>
              Sincronizar cliques Bitly
            </button>
            <button type="button" className="btn btn-soft btn-sm" onClick={onPrint}>
              Baixar PDF / apresentar
            </button>
          </div>
        </div>

        {error && <EmptyState>{error}</EmptyState>}

        {showDeputyForm && (
          <form className="panel panel-pad no-print dobra-form" onSubmit={onSubmitDeputy}>
            <h3 style={{ marginTop: 0 }}>
              {editingDeputyId ? 'Editar Deputado Estadual' : 'Novo Deputado Estadual'}
            </h3>
            <div className="dobra-form__grid">
              <label>
                Nome do Deputado Estadual
                <input
                  className="input"
                  value={deputyForm.name}
                  onChange={(e) => setDeputyForm({ ...deputyForm, name: e.target.value })}
                  placeholder="Ex.: Beto Dois a Um"
                  required
                />
              </label>
              {editingDeputyId ? (
                <>
                  <label>
                    Nosso coordenador (Atlas / campanha)
                    <select
                      className="input"
                      value={deputyForm.campaign_coordinator_id}
                      onChange={(e) => setDeputyForm({ ...deputyForm, campaign_coordinator_id: e.target.value })}
                    >
                      <option value="">— opcional —</option>
                      {campaignCoords.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                          {c.coord_type === 'dobra' ? ' · dobra' : ' · regional'}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Coordenador das dobras
                    <select
                      className="input"
                      value={deputyForm.dobra_coordinator_id}
                      onChange={(e) => setDeputyForm({ ...deputyForm, dobra_coordinator_id: e.target.value })}
                    >
                      <option value="">— opcional —</option>
                      {dobraCoords.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                          {c.coord_type === 'dobra' ? ' · dobra' : ' · regional'}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : null}
            </div>
            {editingDeputyId ? (
              <label>
                Observações
                <textarea
                  className="textarea"
                  rows={2}
                  value={deputyForm.notes}
                  onChange={(e) => setDeputyForm({ ...deputyForm, notes: e.target.value })}
                />
              </label>
            ) : null}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? 'Salvando…' : (editingDeputyId ? 'Salvar' : 'Criar deputado')}
              </button>
              <button type="button" className="btn btn-soft" onClick={closeDeputyForm}>Cancelar</button>
            </div>
          </form>
        )}

        {showGroupForm && (
          <form ref={formRef} className="panel panel-pad no-print dobra-form" onSubmit={onSubmitGroup}>
            <h3 style={{ marginTop: 0 }}>{editingGroupId ? 'Editar grupo' : 'Novo grupo'}</h3>
            <div className="dobra-form__grid">
              <label>
                Deputado Estadual
                <select
                  className="input"
                  value={groupForm.deputy_id}
                  onChange={(e) => setGroupForm((prev) => applyDeputyDefaults(e.target.value, prev))}
                  required
                >
                  <option value="">— selecione o deputado criado —</option>
                  {deputies.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Nome do grupo
                <input
                  className="input"
                  value={groupForm.name}
                  onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                  placeholder="Ex.: BETO DOIS A UM · Centro"
                  required
                />
              </label>
              <label>
                Nosso coordenador (Atlas) — opcional
                <select
                  className="input"
                  value={groupForm.campaign_coordinator_id}
                  onChange={(e) => setGroupForm({ ...groupForm, campaign_coordinator_id: e.target.value })}
                >
                  <option value="">—</option>
                  {campaignCoords.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Coordenador das dobras — opcional
                <select
                  className="input"
                  value={groupForm.dobra_coordinator_id}
                  onChange={(e) => setGroupForm({ ...groupForm, dobra_coordinator_id: e.target.value })}
                >
                  <option value="">—</option>
                  {dobraCoords.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Link de convite WhatsApp
                <input
                  className="input"
                  value={groupForm.invite_link}
                  onChange={(e) => setGroupForm({ ...groupForm, invite_link: e.target.value })}
                  placeholder="https://chat.whatsapp.com/..."
                />
              </label>
              <label>
                Link Bitly (se já tiver)
                <input
                  className="input"
                  value={groupForm.bitly_url}
                  onChange={(e) => setGroupForm({ ...groupForm, bitly_url: e.target.value })}
                  placeholder="https://bit.ly/..."
                />
              </label>
              <label>
                Membros no início
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={groupForm.members_initial}
                  onChange={(e) => setGroupForm({ ...groupForm, members_initial: e.target.value })}
                />
              </label>
              <label>
                Membros agora
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={groupForm.members_current}
                  onChange={(e) => setGroupForm({ ...groupForm, members_current: e.target.value })}
                />
              </label>
              <label>
                Município
                <select
                  className="input"
                  value={groupForm.municipality_id}
                  onChange={(e) => setGroupForm({ ...groupForm, municipality_id: e.target.value })}
                >
                  <option value="">—</option>
                  {muniOptions.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Data de criação
                <input
                  className="input"
                  type="date"
                  value={groupForm.opened_at}
                  onChange={(e) => setGroupForm({ ...groupForm, opened_at: e.target.value })}
                />
              </label>
              <label>
                {editingGroupId ? 'Trocar foto (opcional)' : 'Foto do grupo'}
                <input
                  className="input"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setGroupForm({ ...groupForm, photo_file: e.target.files?.[0] || null })}
                />
              </label>
            </div>
            <label>
              Observações
              <textarea
                className="textarea"
                rows={2}
                value={groupForm.notes}
                onChange={(e) => setGroupForm({ ...groupForm, notes: e.target.value })}
              />
            </label>
            {bitlyConfigured && !groupForm.bitly_url.trim() && groupForm.invite_link.trim() ? (
              <label className="dobra-check">
                <input
                  type="checkbox"
                  checked={groupForm.create_bitly}
                  onChange={(e) => setGroupForm({ ...groupForm, create_bitly: e.target.checked })}
                />
                Gerar Bitly automaticamente a partir do convite
              </label>
            ) : null}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? 'Salvando…' : (editingGroupId ? 'Salvar alterações' : 'Salvar grupo')}
              </button>
              <button type="button" className="btn btn-soft" onClick={closeGroupForm}>Cancelar</button>
            </div>
          </form>
        )}

        <div className="demand-breadcrumb no-print">
          <button
            type="button"
            className={`chip ${showingDeputies ? 'active' : ''}`}
            onClick={() => {
              setSelectedDeputyId(null);
              closeGroupForm();
              closeDeputyForm();
            }}
          >
            Deputados
          </button>
          {selectedDeputy ? (
            <>
              <span>/</span>
              <span className="chip active">{selectedDeputy.name}</span>
            </>
          ) : null}
        </div>

        {summary && showingDeputies ? (
          <div className="dobra-print-stats no-print" style={{ marginTop: '1rem' }}>
            <div className="dobra-print-stat">
              <strong>{deputies.length}</strong>
              <span>Deputados</span>
            </div>
            <div className="dobra-print-stat">
              <strong>{summary.groups_active}</strong>
              <span>Grupos</span>
            </div>
            <div className="dobra-print-stat">
              <strong>{summary.members_current}</strong>
              <span>Membros agora</span>
            </div>
            <div className="dobra-print-stat">
              <strong>
                {summary.growth >= 0 ? '+' : ''}{summary.growth}
              </strong>
              <span>Crescimento</span>
            </div>
          </div>
        ) : null}

        {loading ? (
          <EmptyState>Carregando…</EmptyState>
        ) : showingDeputies ? (
          <div className="demand-grid" style={{ marginTop: '1rem' }}>
            {deputies.map((dep) => (
              <button
                key={dep.id}
                type="button"
                className="demand-card-btn"
                onClick={() => setSelectedDeputyId(dep.id)}
              >
                <strong>{dep.name}</strong>
                <span>{dep.group_count || 0} grupo(s)</span>
                {(dep.campaign_coordinator_name || dep.dobra_coordinator_name) ? (
                  <>
                    <span className="demand-card-btn__stats">
                      Nosso: {dep.campaign_coordinator_name || '—'}
                    </span>
                    <span className="demand-card-btn__stats">
                      Dobra: {dep.dobra_coordinator_name || '—'}
                    </span>
                  </>
                ) : null}
                <span className="demand-card-btn__stats">
                  {dep.members_initial || 0} início · {dep.members_current || 0} agora
                </span>
              </button>
            ))}
            {!deputies.length ? (
              <EmptyState>
                Crie o Deputado Estadual pelo nome (ex.: Beto Dois a Um). Depois, em Cadastrar grupo, só seleciona.
              </EmptyState>
            ) : null}
          </div>
        ) : (
          <div style={{ marginTop: '1rem' }}>
            <div className="panel panel-pad no-print" style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div>
                  <p className="eyebrow" style={{ marginBottom: 4 }}>Deputado Estadual</p>
                  <h3 style={{ margin: 0 }}>{selectedDeputy.name}</h3>
                  <p style={{ margin: '0.55rem 0 0', fontSize: '0.92rem' }}>
                    <strong>Nosso coordenador:</strong>{' '}
                    {selectedDeputy.campaign_coordinator_name || '— não definido'}
                    <br />
                    <strong>Coordenador das dobras:</strong>{' '}
                    {selectedDeputy.dobra_coordinator_name || '— não definido'}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <button type="button" className="btn btn-accent btn-sm" onClick={openCreateGroup}>
                    Novo grupo
                  </button>
                  <button type="button" className="btn btn-soft btn-sm" onClick={() => openEditDeputy(selectedDeputy)}>
                    Editar hierarquia
                  </button>
                  <button type="button" className="btn btn-soft btn-sm" onClick={() => setSelectedDeputyId(null)}>
                    Voltar aos deputados
                  </button>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => removeDeputy(selectedDeputy)}>
                    Remover card
                  </button>
                </div>
              </div>
            </div>

            <div ref={printRef} className="dobra-print-root">
              <div className="dobra-print-stats">
                <div className="dobra-print-stat">
                  <strong>{personGroups.length}</strong>
                  <span>Grupos</span>
                </div>
                <div className="dobra-print-stat">
                  <strong>{personGroups.reduce((s, g) => s + g.members_initial, 0)}</strong>
                  <span>Início</span>
                </div>
                <div className="dobra-print-stat">
                  <strong>{personGroups.reduce((s, g) => s + g.members_current, 0)}</strong>
                  <span>Agora</span>
                </div>
                <div className="dobra-print-stat">
                  <strong>{selectedDeputy.name}</strong>
                  <span>Dep. Estadual</span>
                </div>
              </div>

              {!personGroups.length ? (
                <EmptyState>Nenhum grupo neste deputado ainda — cadastre o primeiro.</EmptyState>
              ) : (
                <div className="dobra-print-grid dobra-grid">
                  {personGroups.map((g) => (
                    <article
                      key={g.id}
                      className={`dobra-print-card dobra-card${editingGroupId === g.id ? ' is-editing' : ''}`}
                    >
                      {g.photo_url ? (
                        <img className="dobra-print-card__photo" src={g.photo_url} alt={g.name} />
                      ) : (
                        <div className="dobra-print-card__photo dobra-print-card__photo--empty">Sem foto</div>
                      )}
                      <div className="dobra-print-card__body">
                        <p className="dobra-print-card__meta">
                          Dep. {selectedDeputy.name}
                          {g.municipality_name ? ` · ${g.municipality_name}` : ''}
                          {g.opened_at ? ` · ${g.opened_at}` : ''}
                        </p>
                        <h3>{g.name}</h3>
                        <p className="dobra-print-link" style={{ marginBottom: 8 }}>
                          Nosso: {g.campaign_coordinator_name || '—'}
                          {' · '}
                          Dobra: {g.dobra_coordinator_name || '—'}
                        </p>
                        <div className="dobra-print-metrics">
                          <div>
                            <strong>{g.members_initial}</strong>
                            <span>Início</span>
                          </div>
                          <div>
                            <strong>{g.members_current}</strong>
                            <span>Agora</span>
                          </div>
                          <div>
                            <strong>
                              {g.growth >= 0 ? '+' : ''}{g.growth}
                              {g.multiplier != null ? ` (${g.multiplier}x)` : ''}
                            </strong>
                            <span>Crescimento</span>
                          </div>
                        </div>
                        {g.bitly_url ? (
                          <p className="dobra-print-link">
                            Bitly: {g.bitly_url}
                            {g.clicks != null ? ` · ${g.clicks} clique(s)` : ''}
                          </p>
                        ) : g.invite_link ? (
                          <p className="dobra-print-link">Convite: {g.invite_link}</p>
                        ) : (
                          <p className="dobra-print-link dobra-print-link--warn">Sem link — edite para colocar</p>
                        )}

                        <div className="dobra-card__actions no-print">
                          <button type="button" className="btn btn-accent btn-sm" onClick={() => openEditGroup(g)}>
                            Editar
                          </button>
                          {!g.bitly_url && g.invite_link ? (
                            <button type="button" className="btn btn-soft btn-sm" onClick={() => createBitly(g)}>
                              Criar Bitly
                            </button>
                          ) : null}
                          {g.bitly_url ? (
                            <button type="button" className="btn btn-soft btn-sm" onClick={() => syncOne(g)}>
                              Sync cliques
                            </button>
                          ) : null}
                          <button type="button" className="btn btn-danger btn-sm" onClick={() => removeGroup(g)}>
                            Remover
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {showingDeputies ? (
          <div ref={printRef} className="dobra-print-root dobra-screen-print-only" aria-hidden>
            <div className="dobra-print-stats">
              <div className="dobra-print-stat">
                <strong>{summary?.groups_active || 0}</strong>
                <span>Grupos</span>
              </div>
              <div className="dobra-print-stat">
                <strong>{summary?.members_initial || 0}</strong>
                <span>Início</span>
              </div>
              <div className="dobra-print-stat">
                <strong>{summary?.members_current || 0}</strong>
                <span>Agora</span>
              </div>
              <div className="dobra-print-stat">
                <strong>{deputies.length}</strong>
                <span>Deputados</span>
              </div>
            </div>
            <div className="dobra-print-grid">
              {printGroups.map((g) => (
                <article key={g.id} className="dobra-print-card">
                  {g.photo_url ? (
                    <img className="dobra-print-card__photo" src={g.photo_url} alt={g.name} />
                  ) : (
                    <div className="dobra-print-card__photo dobra-print-card__photo--empty">Sem foto</div>
                  )}
                  <div className="dobra-print-card__body">
                    <p className="dobra-print-card__meta">
                      {g.deputy_name ? `Dep. ${g.deputy_name}` : 'Sem deputado'}
                      {g.municipality_name ? ` · ${g.municipality_name}` : ''}
                    </p>
                    <h3>{g.name}</h3>
                    <p className="dobra-print-link">
                      Nosso: {g.campaign_coordinator_name || '—'}
                      {' · '}
                      Dobra: {g.dobra_coordinator_name || '—'}
                    </p>
                    <div className="dobra-print-metrics">
                      <div>
                        <strong>{g.members_initial}</strong>
                        <span>Início</span>
                      </div>
                      <div>
                        <strong>{g.members_current}</strong>
                        <span>Agora</span>
                      </div>
                      <div>
                        <strong>{g.growth >= 0 ? '+' : ''}{g.growth}</strong>
                        <span>Crescimento</span>
                      </div>
                    </div>
                    {g.bitly_url ? <p className="dobra-print-link">Bitly: {g.bitly_url}</p> : null}
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      {toast ? <Toast onClose={() => setToast('')}>{toast}</Toast> : null}
    </div>
  );
}
