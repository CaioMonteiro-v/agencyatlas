import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { Avatar, EmptyState } from './Ui';

function FitBounds({ points, municipalities, locked }) {
  const map = useMap();
  useEffect(() => {
    if (locked) return;
    const coords = [
      ...points.map((p) => [p.lat, p.lng]),
      ...municipalities.map((m) => [m.lat, m.lng]),
    ];
    if (!coords.length) {
      map.setView([-12.6, -55.9], 6);
      return;
    }
    const bounds = L.latLngBounds(coords);
    map.fitBounds(bounds.pad(0.18));
  }, [map, points, municipalities, locked]);
  return null;
}

function FlyToMunicipality({ municipality }) {
  const map = useMap();
  useEffect(() => {
    if (!municipality) return;
    map.flyTo([municipality.lat, municipality.lng], 10, { duration: 1.1 });
  }, [map, municipality]);
  return null;
}

function HeatLayer({ points }) {
  const map = useMap();

  useEffect(() => {
    let layer;
    let cancelled = false;

    async function addHeat() {
      await import('leaflet.heat');
      if (cancelled || !points.length) return;
      const heatPoints = points.map((p) => [p.lat, p.lng, 0.55]);
      layer = L.heatLayer(heatPoints, {
        radius: 28,
        blur: 22,
        maxZoom: 11,
        gradient: {
          0.2: '#9ec0cf',
          0.45: '#8fb5a5',
          0.7: '#d9a7b0',
          1.0: '#c47a88',
        },
      }).addTo(map);
    }

    addHeat();
    return () => {
      cancelled = true;
      if (layer) map.removeLayer(layer);
    };
  }, [map, points]);

  return null;
}

export default function HeatMapMT({ campaignSlug }) {
  const [heatmap, setHeatmap] = useState({ points: [], municipalities: [], funnel_totals: null });
  const [funnel, setFunnel] = useState('todos');
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState(null);
  const [filterQuery, setFilterQuery] = useState('');
  const [filterId, setFilterId] = useState('');

  useEffect(() => {
    let alive = true;
    api.getHeatmap(campaignSlug, funnel)
      .then((data) => {
        if (alive) setHeatmap(data);
      })
      .catch((err) => alive && setError(err.message));
    return () => { alive = false; };
  }, [campaignSlug, funnel]);

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }
    let alive = true;
    setLoadingDetail(true);
    api.getMunicipality(campaignSlug, selected.id)
      .then((data) => {
        if (alive) setDetail(data);
      })
      .catch((err) => alive && setError(err.message))
      .finally(() => alive && setLoadingDetail(false));
    return () => { alive = false; };
  }, [campaignSlug, selected]);

  const maxCount = useMemo(
    () => Math.max(1, ...heatmap.municipalities.map((m) => m.registrations_count || 0)),
    [heatmap.municipalities],
  );

  const filteredMunicipalities = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    const list = [...heatmap.municipalities].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    if (!q) return list;
    return list.filter((m) => m.name.toLowerCase().includes(q));
  }, [heatmap.municipalities, filterQuery]);

  function selectMunicipality(m) {
    if (!m) {
      setSelected(null);
      setFilterId('');
      return;
    }
    setSelected(m);
    setFilterId(String(m.id));
  }

  function onFilterChange(e) {
    const id = e.target.value;
    setFilterId(id);
    if (!id) {
      setSelected(null);
      return;
    }
    const muni = heatmap.municipalities.find((m) => String(m.id) === id);
    if (muni) selectMunicipality(muni);
  }

  return (
    <div className="map-block">
      <div className="chip-group" style={{ marginBottom: '0.75rem' }}>
        <button
          type="button"
          className={`chip ${funnel === 'todos' ? 'active' : ''}`}
          onClick={() => setFunnel('todos')}
        >
          Todos ({heatmap.funnel_totals?.total ?? heatmap.points?.length ?? 0})
        </button>
        <button
          type="button"
          className={`chip ${funnel === 'coordenador' ? 'active' : ''}`}
          onClick={() => setFunnel('coordenador')}
        >
          Coordenador ({heatmap.funnel_totals?.coordenador ?? 0})
        </button>
        <button
          type="button"
          className={`chip ${funnel === 'mobilizador' ? 'active' : ''}`}
          onClick={() => setFunnel('mobilizador')}
        >
          Mobilizador ({heatmap.funnel_totals?.mobilizador ?? 0})
        </button>
      </div>

      <div className="map-toolbar">
        <label className="map-filter">
          <span>Localizar município (142)</span>
          <input
            className="input"
            list="mt-muni-list"
            placeholder="Digite para buscar… ex.: Colíder"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
          />
          <datalist id="mt-muni-list">
            {filteredMunicipalities.map((m) => (
              <option key={m.id} value={m.name} />
            ))}
          </datalist>
        </label>

        <label className="map-filter">
          <span>Ir para a cidade</span>
          <select className="select" value={filterId} onChange={onFilterChange}>
            <option value="">Todas / visão geral</option>
            {filteredMunicipalities.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.coordinator_name ? ` — ${m.coordinator_name}` : ''}
                {` (${m.registrations_count || 0} cad.)`}
              </option>
            ))}
          </select>
        </label>

        {filterQuery && (
          <button
            type="button"
            className="btn btn-soft btn-sm"
            onClick={() => {
              const exact = heatmap.municipalities.find(
                (m) => m.name.toLowerCase() === filterQuery.trim().toLowerCase(),
              );
              const first = exact || filteredMunicipalities[0];
              if (first) selectMunicipality(first);
            }}
          >
            Ir no mapa
          </button>
        )}
      </div>

      <p className="map-legend">
        O calor vem dos <strong>cadastros</strong> (pessoas), não das lideranças.
        Use os funis: <strong>Coordenador</strong> (território / link de liderança e eventos de coordenador)
        e <strong>Mobilizador</strong> (eventos, reuniões e códigos pessoais de mobilizador).
        Eventos precisam ter município vinculado para aparecer no mapa.
      </p>

      <div className="map-wrap">
        {error && <EmptyState>{error}</EmptyState>}
        <MapContainer
          center={[-12.6, -55.9]}
          zoom={6}
          scrollWheelZoom
          style={{ height: '100%', minHeight: 480 }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds
            points={heatmap.points}
            municipalities={heatmap.municipalities}
            locked={Boolean(selected)}
          />
          <FlyToMunicipality municipality={selected} />
          <HeatLayer points={heatmap.points} />
          {heatmap.municipalities.map((m) => {
            const intensity = (m.registrations_count || 0) / maxCount;
            const isSelected = selected?.id === m.id;
            return (
              <CircleMarker
                key={m.id}
                center={[m.lat, m.lng]}
                radius={isSelected ? 18 + intensity * 10 : 8 + intensity * 14}
                pathOptions={{
                  color: isSelected ? '#2C3E3A' : '#5f8a7a',
                  fillColor: isSelected
                    ? '#c47a88'
                    : intensity > 0.6
                      ? '#c47a88'
                      : intensity > 0.3
                        ? '#8fb5a5'
                        : '#9ec0cf',
                  fillOpacity: isSelected ? 0.95 : 0.75,
                  weight: isSelected ? 3 : 2,
                }}
                eventHandlers={{
                  click: () => selectMunicipality(m),
                }}
              >
                <Popup>
                  <strong>{m.name}</strong>
                  <br />
                  {m.registrations_count || 0} cadastros
                  <br />
                  {m.leaders_count || 0} lideranças
                  {m.coordinator_name ? (
                    <>
                      <br />
                      Coord.: {m.coordinator_name}
                    </>
                  ) : null}
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>

        {selected && (
          <aside className="side-panel" aria-live="polite">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
              <div>
                <p className="eyebrow" style={{ marginBottom: 4 }}>Município</p>
                <h3>{selected.name}</h3>
              </div>
              <button
                className="btn btn-soft btn-sm"
                type="button"
                onClick={() => selectMunicipality(null)}
              >
                Fechar
              </button>
            </div>

            {loadingDetail && <EmptyState>Carregando detalhes…</EmptyState>}

            {detail && (
              <>
                <p style={{ marginTop: '0.75rem' }}>
                  <strong>Coordenador:</strong>{' '}
                  {detail.coordinator || 'Não informado'}
                </p>
                <p>
                  <strong>Total de cadastros:</strong> {detail.registrations_count}
                </p>
                <p>
                  <strong>Lideranças:</strong> {detail.leaders?.length || 0}
                </p>

                <h4 style={{ marginTop: '1rem', marginBottom: '0.35rem' }}>Lideranças</h4>
                {!detail.leaders.length && (
                  <EmptyState>Nenhuma liderança neste município.</EmptyState>
                )}
                {detail.leaders.map((leader) => (
                  <div className="leader-item" key={leader.id}>
                    <Avatar name={leader.name} photo={leader.photo_url} />
                    <div>
                      <strong>{leader.name}</strong>
                      <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                        {leader.type === 'politica' ? 'Liderança política' : 'Multiplicador'} · {leader.activity_label}
                      </div>
                    </div>
                    <Link
                      className="btn btn-soft btn-sm"
                      to={`/campanha/${campaignSlug}/lideranca/${leader.id}`}
                    >
                      Perfil
                    </Link>
                  </div>
                ))}
              </>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
