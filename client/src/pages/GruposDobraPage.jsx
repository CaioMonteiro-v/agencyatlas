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

const emptyForm = {
  name: '',
  invite_link: '',
  bitly_url: '',
  members_initial: '13',
  members_current: '13',
  deputy_name: '',
  municipality_id: '',
  opened_at: new Date().toISOString().slice(0, 10),
  notes: '',
  photo_file: null,
  create_bitly: true,
};

function formFromGroup(g) {
  return {
    name: g.name || '',
    invite_link: g.invite_link || '',
    bitly_url: g.bitly_url || '',
    members_initial: String(g.members_initial ?? 0),
    members_current: String(g.members_current ?? 0),
    deputy_name: g.deputy_name || g.coordinator_label || '',
    municipality_id: g.municipality_id ? String(g.municipality_id) : '',
    opened_at: g.opened_at ? String(g.opened_at).slice(0, 10) : '',
    notes: g.notes || '',
    photo_file: null,
    create_bitly: !g.bitly_url,
  };
}

/** Nome do Deputado Estadual da dobra (não coordenador regional). */
function deputyKey(g) {
  return String(g.deputy_name || g.coordinator_label || '').trim() || 'Sem deputado';
}

export default function GruposDobraPage() {
  const { campaign } = useOutletContext();
  const [groups, setGroups] = useState([]);
  const [summary, setSummary] = useState(null);
  const [bitlyConfigured, setBitlyConfigured] = useState(false);
  const [allMunicipalities, setAllMunicipalities] = useState([]);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const printRef = useRef(null);
  const formRef = useRef(null);

  const isEditing = editingId != null;

  const muniOptions = useMemo(
    () => allMunicipalities.slice().sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [allMunicipalities],
  );

  /** Quadradinhos por Deputado Estadual */
  const peopleCards = useMemo(() => {
    const map = new Map();
    for (const g of groups.filter((x) => x.status !== 'arquivado')) {
      const key = deputyKey(g);
      if (!map.has(key)) {
        map.set(key, {
          name: key,
          groups: [],
          members_initial: 0,
          members_current: 0,
          with_bitly: 0,
        });
      }
      const row = map.get(key);
      row.groups.push(g);
      row.members_initial += g.members_initial || 0;
      row.members_current += g.members_current || 0;
      if (g.bitly_url) row.with_bitly += 1;
    }
    return Array.from(map.values())
      .map((row) => ({
        ...row,
        growth: row.members_current - row.members_initial,
        group_count: row.groups.length,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [groups]);

  const personGroups = useMemo(() => {
    if (!selectedPerson) return [];
    return peopleCards.find((p) => p.name === selectedPerson)?.groups || [];
  }, [peopleCards, selectedPerson]);

  async function load() {
    setLoading(true);
    try {
      const [res, munis] = await Promise.all([
        api.getDobraGroups(campaign.slug),
        api.getMunicipalities().catch(() => []),
      ]);
      setGroups(res.groups || []);
      setSummary(res.summary || null);
      setBitlyConfigured(Boolean(res.bitly_configured));
      setAllMunicipalities(Array.isArray(munis) ? munis : (munis.municipalities || []));
      setError('');
    } catch (err) {
      setError(err.message || 'Erro ao carregar grupos');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [campaign.slug]);

  function openCreate(prefillName = '') {
    setEditingId(null);
    setForm({
      ...emptyForm,
      deputy_name: prefillName || selectedPerson || '',
      opened_at: new Date().toISOString().slice(0, 10),
    });
    setShowForm(true);
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function openEdit(group) {
    setEditingId(group.id);
    setForm(formFromGroup(group));
    setShowForm(true);
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setToast('Informe o nome do grupo');
      return;
    }
    if (!form.deputy_name.trim()) {
      setToast('Informe o Deputado Estadual da dobra (aparece no quadradinho)');
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        invite_link: form.invite_link.trim() || null,
        bitly_url: form.bitly_url.trim() || null,
        members_initial: Number(form.members_initial) || 0,
        members_current: Number(form.members_current) || Number(form.members_initial) || 0,
        deputy_name: form.deputy_name.trim() || null,
        municipality_id: form.municipality_id ? Number(form.municipality_id) : null,
        opened_at: form.opened_at || null,
        notes: form.notes.trim() || null,
      };
      if (form.photo_file) {
        body.photo_data_url = await readFileAsDataUrl(form.photo_file);
        body.photo_name = form.photo_file.name;
      }

      let res;
      if (isEditing) {
        if (form.create_bitly && !body.bitly_url && body.invite_link) {
          body.create_bitly = true;
        }
        res = await api.updateDobraGroup(campaign.slug, editingId, body);
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
      if (body.deputy_name) setSelectedPerson(body.deputy_name);
      closeForm();
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
      if (editingId === group.id) closeForm();
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

  const showingPeople = !selectedPerson;
  const printGroups = selectedPerson ? personGroups : groups.filter((g) => g.status !== 'arquivado');

  return (
    <div className="dobra-page">
      <div className="container section" style={{ paddingTop: 0 }}>
        <div className="section__head no-print">
          <p className="eyebrow">Material de mobilização</p>
          <h2>Grupos Dobra</h2>
          <p>
            Na criação, coloca o <strong>Deputado Estadual</strong> da dobra.
            A tela fica em <strong>quadradinhos por deputado</strong> — clica para ver e editar os grupos.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.85rem' }}>
            <button type="button" className="btn btn-accent btn-sm" onClick={() => openCreate()}>
              Cadastrar grupo
            </button>
            <button type="button" className="btn btn-soft btn-sm" onClick={syncAll} disabled={!bitlyConfigured}>
              Sincronizar cliques Bitly
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={onPrint}>
              Baixar PDF / apresentar
            </button>
          </div>
        </div>

        {error && <EmptyState>{error}</EmptyState>}

        {showForm && (
          <form ref={formRef} className="panel panel-pad no-print dobra-form" onSubmit={onSubmit}>
            <h3 style={{ marginTop: 0 }}>{isEditing ? 'Editar grupo' : 'Novo grupo'}</h3>
            <div className="dobra-form__grid">
              <label>
                Deputado Estadual
                <input
                  className="input"
                  value={form.deputy_name}
                  onChange={(e) => setForm({ ...form, deputy_name: e.target.value })}
                  placeholder="Ex.: nome do Deputado Estadual"
                  required
                />
              </label>
              <label>
                Nome do grupo
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex.: Grupo Dobra · Centro"
                  required
                />
              </label>
              <label>
                Link de convite WhatsApp
                <input
                  className="input"
                  value={form.invite_link}
                  onChange={(e) => setForm({ ...form, invite_link: e.target.value })}
                  placeholder="https://chat.whatsapp.com/..."
                />
              </label>
              <label>
                Link Bitly (se já tiver)
                <input
                  className="input"
                  value={form.bitly_url}
                  onChange={(e) => setForm({ ...form, bitly_url: e.target.value })}
                  placeholder="https://bit.ly/..."
                />
              </label>
              <label>
                Membros no início
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={form.members_initial}
                  onChange={(e) => setForm({ ...form, members_initial: e.target.value })}
                />
              </label>
              <label>
                Membros agora
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={form.members_current}
                  onChange={(e) => setForm({ ...form, members_current: e.target.value })}
                />
              </label>
              <label>
                Município
                <select
                  className="input"
                  value={form.municipality_id}
                  onChange={(e) => setForm({ ...form, municipality_id: e.target.value })}
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
                  value={form.opened_at}
                  onChange={(e) => setForm({ ...form, opened_at: e.target.value })}
                />
              </label>
              <label>
                {isEditing ? 'Trocar foto (opcional)' : 'Foto do grupo'}
                <input
                  className="input"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setForm({ ...form, photo_file: e.target.files?.[0] || null })}
                />
              </label>
            </div>
            <label>
              Observações
              <textarea
                className="textarea"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </label>
            {bitlyConfigured && !form.bitly_url.trim() && form.invite_link.trim() ? (
              <label className="dobra-check">
                <input
                  type="checkbox"
                  checked={form.create_bitly}
                  onChange={(e) => setForm({ ...form, create_bitly: e.target.checked })}
                />
                Gerar Bitly automaticamente a partir do convite
              </label>
            ) : null}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? 'Salvando…' : (isEditing ? 'Salvar alterações' : 'Salvar grupo')}
              </button>
              <button type="button" className="btn btn-soft" onClick={closeForm}>
                Cancelar
              </button>
            </div>
          </form>
        )}

        <div className="demand-breadcrumb no-print">
          <button
            type="button"
            className={`chip ${showingPeople ? 'active' : ''}`}
            onClick={() => {
              setSelectedPerson(null);
              closeForm();
            }}
          >
            Deputados
          </button>
          {selectedPerson ? (
            <>
              <span>/</span>
              <span className="chip active">{selectedPerson}</span>
            </>
          ) : null}
        </div>

        {summary && showingPeople ? (
          <div className="dobra-print-stats no-print" style={{ marginTop: '1rem' }}>
            <div className="dobra-print-stat">
              <strong>{peopleCards.length}</strong>
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
        ) : showingPeople ? (
          <div className="demand-grid" style={{ marginTop: '1rem' }}>
            {peopleCards.map((person) => (
              <button
                key={person.name}
                type="button"
                className="demand-card-btn"
                onClick={() => setSelectedPerson(person.name)}
              >
                <strong>{person.name}</strong>
                <span>{person.group_count} grupo(s)</span>
                <span className="demand-card-btn__stats">
                  {person.members_initial} início · {person.members_current} agora
                  {person.growth ? ` · +${person.growth}` : ''}
                </span>
              </button>
            ))}
            {!peopleCards.length ? (
              <EmptyState>
                Ainda não há grupos. Cadastre o primeiro e coloque o Deputado Estadual —
                ele vira o quadradinho.
              </EmptyState>
            ) : null}
          </div>
        ) : (
          <div style={{ marginTop: '1rem' }}>
            <div className="no-print" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              <button type="button" className="btn btn-accent btn-sm" onClick={() => openCreate(selectedPerson)}>
                Novo grupo de {selectedPerson}
              </button>
              <button type="button" className="btn btn-soft btn-sm" onClick={() => setSelectedPerson(null)}>
                Voltar aos deputados
              </button>
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
                  <strong>{selectedPerson}</strong>
                  <span>Dep. Estadual</span>
                </div>
              </div>

              {!personGroups.length ? (
                <EmptyState>Nenhum grupo neste nome ainda.</EmptyState>
              ) : (
                <div className="dobra-print-grid dobra-grid">
                  {personGroups.map((g) => (
                    <article
                      key={g.id}
                      className={`dobra-print-card dobra-card${editingId === g.id ? ' is-editing' : ''}`}
                    >
                      {g.photo_url ? (
                        <img className="dobra-print-card__photo" src={g.photo_url} alt={g.name} />
                      ) : (
                        <div className="dobra-print-card__photo dobra-print-card__photo--empty">Sem foto</div>
                      )}
                      <div className="dobra-print-card__body">
                        <p className="dobra-print-card__meta">
                          Dep. {selectedPerson}
                          {g.municipality_name ? ` · ${g.municipality_name}` : ''}
                          {g.opened_at ? ` · ${g.opened_at}` : ''}
                        </p>
                        <h3>{g.name}</h3>
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
                          <button type="button" className="btn btn-accent btn-sm" onClick={() => openEdit(g)}>
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

        {/* Conteúdo oculto para PDF quando está na visão de nomes (todos os grupos) */}
        {showingPeople ? (
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
                <strong>{peopleCards.length}</strong>
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
                      {(g.deputy_name || g.coordinator_label)
                        ? `Dep. ${g.deputy_name || g.coordinator_label}`
                        : 'Sem deputado'}
                      {g.municipality_name ? ` · ${g.municipality_name}` : ''}
                    </p>
                    <h3>{g.name}</h3>
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
