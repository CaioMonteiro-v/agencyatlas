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
  members_initial: '13',
  members_current: '13',
  coordinator_id: '',
  municipality_id: '',
  opened_at: new Date().toISOString().slice(0, 10),
  notes: '',
  photo_file: null,
};

export default function GruposDobraPage() {
  const { campaign } = useOutletContext();
  const [groups, setGroups] = useState([]);
  const [summary, setSummary] = useState(null);
  const [bitlyConfigured, setBitlyConfigured] = useState(false);
  const [coordinators, setCoordinators] = useState([]);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [filterCoord, setFilterCoord] = useState('');
  const [showForm, setShowForm] = useState(false);
  const printRef = useRef(null);

  const muniOptions = useMemo(() => {
    if (!form.coordinator_id) {
      const all = [];
      for (const c of coordinators) {
        for (const m of c.municipalities || []) {
          if (!all.some((x) => x.id === m.id)) all.push(m);
        }
      }
      return all.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    }
    const coord = coordinators.find((c) => String(c.id) === String(form.coordinator_id));
    return (coord?.municipalities || []).slice().sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [coordinators, form.coordinator_id]);

  async function load() {
    setLoading(true);
    try {
      const [res, coords] = await Promise.all([
        api.getDobraGroups(campaign.slug, {
          coordinator_id: filterCoord || undefined,
        }),
        api.getCoordinators(campaign.slug),
      ]);
      setGroups(res.groups || []);
      setSummary(res.summary || null);
      setBitlyConfigured(Boolean(res.bitly_configured));
      setCoordinators(coords.coordinators || coords || []);
      setError('');
    } catch (err) {
      setError(err.message || 'Erro ao carregar grupos');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [campaign.slug, filterCoord]);

  async function onSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setToast('Informe o nome do grupo');
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        invite_link: form.invite_link.trim() || null,
        members_initial: Number(form.members_initial) || 0,
        members_current: Number(form.members_current) || Number(form.members_initial) || 0,
        coordinator_id: form.coordinator_id ? Number(form.coordinator_id) : null,
        municipality_id: form.municipality_id ? Number(form.municipality_id) : null,
        opened_at: form.opened_at || null,
        notes: form.notes.trim() || null,
      };
      if (form.photo_file) {
        body.photo_data_url = await readFileAsDataUrl(form.photo_file);
        body.photo_name = form.photo_file.name;
      }
      const res = await api.createDobraGroup(campaign.slug, body);
      setGroups(res.groups || []);
      setSummary(res.summary || null);
      setForm(emptyForm);
      setShowForm(false);
      const bitlyNote = res.group?.bitly_url
        ? ` · Bitly ${res.group.bitly_url}`
        : (res.bitly_error ? ` · Bitly: ${res.bitly_error}` : '');
      setToast(`Grupo cadastrado${bitlyNote}`);
    } catch (err) {
      setToast(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function updateMembers(group, field, value) {
    try {
      const res = await api.updateDobraGroup(campaign.slug, group.id, {
        [field]: Number(value) || 0,
      });
      setGroups(res.groups || []);
      setSummary(res.summary || null);
    } catch (err) {
      setToast(err.message);
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

  async function onPhotoReplace(group, file) {
    if (!file) return;
    try {
      const photo_data_url = await readFileAsDataUrl(file);
      const res = await api.updateDobraGroup(campaign.slug, group.id, {
        photo_data_url,
        photo_name: file.name,
      });
      setGroups(res.groups || []);
      setSummary(res.summary || null);
      setToast('Foto atualizada');
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

  const visible = groups.filter((g) => g.status !== 'arquivado' || filterCoord);

  return (
    <div className="dobra-page">
      <div className="container section" style={{ paddingTop: 0 }}>
        <div className="section__head no-print">
          <p className="eyebrow">Material de mobilização</p>
          <h2>Grupos Dobra</h2>
          <p>
            Cadastre cada grupo WhatsApp criado com a dobra: foto, link de convite (Bitly separado)
            e membros — de 13 para 50, 100, 200. Esse controle entra no relatório final da campanha.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.85rem' }}>
            <button type="button" className="btn btn-accent btn-sm" onClick={() => setShowForm((v) => !v)}>
              {showForm ? 'Fechar formulário' : 'Cadastrar grupo'}
            </button>
            <button type="button" className="btn btn-soft btn-sm" onClick={syncAll} disabled={!bitlyConfigured}>
              Sincronizar cliques Bitly
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={onPrint}>
              Baixar PDF / apresentar
            </button>
          </div>
          {!bitlyConfigured ? (
            <p className="dobra-hint">Bitly ainda não configurado no Render — você pode cadastrar o grupo e gerar o link depois.</p>
          ) : null}
        </div>

        {error && <EmptyState>{error}</EmptyState>}

        {showForm && (
          <form className="panel panel-pad no-print dobra-form" onSubmit={onSubmit}>
            <h3 style={{ marginTop: 0 }}>Novo grupo</h3>
            <div className="dobra-form__grid">
              <label>
                Nome do grupo
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex.: Grupo Dobra · Campo Novo"
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
                Coordenador
                <select
                  className="input"
                  value={form.coordinator_id}
                  onChange={(e) => setForm({ ...form, coordinator_id: e.target.value, municipality_id: '' })}
                >
                  <option value="">—</option>
                  {coordinators.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
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
                Foto do grupo
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
                placeholder="Quem criou, estratégia, etc."
              />
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? 'Salvando…' : 'Salvar grupo'}
              </button>
              <button type="button" className="btn btn-soft" onClick={() => setShowForm(false)}>
                Cancelar
              </button>
            </div>
          </form>
        )}

        <div className="no-print dobra-filters">
          <label>
            Filtrar coordenador
            <select
              className="input"
              value={filterCoord}
              onChange={(e) => setFilterCoord(e.target.value)}
            >
              <option value="">Todos</option>
              {coordinators.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
        </div>

        <div ref={printRef} className="dobra-print-root">
          {summary && (
            <div className="dobra-print-stats">
              <div className="dobra-print-stat">
                <strong>{summary.groups_active}</strong>
                <span>Grupos ativos</span>
              </div>
              <div className="dobra-print-stat">
                <strong>{summary.members_initial}</strong>
                <span>Membros no início</span>
              </div>
              <div className="dobra-print-stat">
                <strong>{summary.members_current}</strong>
                <span>Membros agora</span>
              </div>
              <div className="dobra-print-stat">
                <strong>
                  {summary.growth >= 0 ? '+' : ''}{summary.growth}
                  {summary.multiplier != null ? ` · ${summary.multiplier}x` : ''}
                </strong>
                <span>Crescimento</span>
              </div>
            </div>
          )}

          {loading ? (
            <EmptyState>Carregando grupos…</EmptyState>
          ) : !visible.length ? (
            <EmptyState>
              Ainda não há grupos cadastrados. Crie o primeiro com a foto da dobra e o link de convite.
            </EmptyState>
          ) : (
            <div className="dobra-print-grid dobra-grid">
              {visible.map((g) => (
                <article key={g.id} className="dobra-print-card dobra-card">
                  {g.photo_url ? (
                    <img className="dobra-print-card__photo" src={g.photo_url} alt={g.name} />
                  ) : (
                    <div className="dobra-print-card__photo dobra-print-card__photo--empty">Sem foto</div>
                  )}
                  <div className="dobra-print-card__body">
                    <p className="dobra-print-card__meta">
                      {[g.coordinator_name, g.municipality_name].filter(Boolean).join(' · ') || 'Sem território'}
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
                    ) : null}

                    <div className="dobra-card__actions no-print">
                      <label className="dobra-inline">
                        Agora
                        <input
                          className="input input-sm"
                          type="number"
                          min="0"
                          defaultValue={g.members_current}
                          key={`cur-${g.id}-${g.members_current}`}
                          onBlur={(e) => {
                            if (Number(e.target.value) !== g.members_current) {
                              updateMembers(g, 'members_current', e.target.value);
                            }
                          }}
                        />
                      </label>
                      <label className="btn btn-soft btn-sm">
                        Foto
                        <input
                          type="file"
                          accept="image/*"
                          hidden
                          onChange={(e) => {
                            onPhotoReplace(g, e.target.files?.[0]);
                            e.target.value = '';
                          }}
                        />
                      </label>
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
      {toast ? <Toast onClose={() => setToast('')}>{toast}</Toast> : null}
    </div>
  );
}
