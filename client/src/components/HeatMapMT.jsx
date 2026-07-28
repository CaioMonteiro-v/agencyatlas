import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { Avatar, EmptyState } from './Ui';

function FitBounds({ points, municipalities }) {
  const map = useMap();
  useEffect(() => {
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
  }, [map, points, municipalities]);
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
  const [heatmap, setHeatmap] = useState({ points: [], municipalities: [] });
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    api.getHeatmap(campaignSlug)
      .then((data) => {
        if (alive) setHeatmap(data);
      })
      .catch((err) => alive && setError(err.message));
    return () => { alive = false; };
  }, [campaignSlug]);

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
    [heatmap.municipalities]
  );

  return (
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
        <FitBounds points={heatmap.points} municipalities={heatmap.municipalities} />
        <HeatLayer points={heatmap.points} />
        {heatmap.municipalities.map((m) => {
          const intensity = (m.registrations_count || 0) / maxCount;
          return (
            <CircleMarker
              key={m.id}
              center={[m.lat, m.lng]}
              radius={8 + intensity * 14}
              pathOptions={{
                color: '#5f8a7a',
                fillColor: intensity > 0.6 ? '#c47a88' : intensity > 0.3 ? '#8fb5a5' : '#9ec0cf',
                fillOpacity: 0.75,
                weight: 2,
              }}
              eventHandlers={{
                click: () => setSelected(m),
              }}
            >
              <Popup>
                <strong>{m.name}</strong>
                <br />
                {m.registrations_count} cadastros
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
            <button className="btn btn-soft btn-sm" type="button" onClick={() => setSelected(null)}>
              Fechar
            </button>
          </div>

          {loadingDetail && <EmptyState>Carregando detalhes…</EmptyState>}

          {detail && (
            <>
              <p style={{ marginTop: '0.75rem' }}>
                <strong>Coordenador Geral:</strong>{' '}
                {detail.coordinator ? `${detail.municipality.name} — ${detail.coordinator}` : 'Não informado'}
              </p>
              <p>
                <strong>Total de cadastros:</strong> {detail.registrations_count}
              </p>

              <h4 style={{ marginTop: '1rem', marginBottom: '0.35rem' }}>Lideranças</h4>
              {!detail.leaders.length && <EmptyState>Nenhuma liderança neste município.</EmptyState>}
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
  );
}
