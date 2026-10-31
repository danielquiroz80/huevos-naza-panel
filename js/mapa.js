import L from 'https://esm.sh/leaflet@1.9.4';
import { html, useEffect, useRef } from './ui.js';

const pin = (texto, clase) => L.divIcon({ className: '', html: `<div class="pin ${clase || ''}">${texto}</div>`, iconSize: [32, 32], iconAnchor: [16, 16] });

/** Mapa (OpenStreetMap) con el punto de salida y las paradas numeradas en orden. */
export function Mapa({ origen, paradas = [], height = 320, actual }) {
  const caja = useRef(null);
  const mapa = useRef(null);
  const capa = useRef(null);

  useEffect(() => {
    const m = L.map(caja.current, { zoomControl: true, scrollWheelZoom: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m);
    m.setView([6.2442, -75.5812], 12);
    capa.current = L.layerGroup().addTo(m);
    mapa.current = m;
    const t = setTimeout(() => m.invalidateSize(), 250);
    return () => { clearTimeout(t); m.remove(); };
  }, []);

  const firma = JSON.stringify([origen && origen.lat, origen && origen.lng, actual, paradas.map((p) => [p.id, p.lat, p.lng, p.estado])]);
  useEffect(() => {
    const m = mapa.current, g = capa.current;
    if (!m) return;
    g.clearLayers();
    const pts = [];
    if (origen && origen.lat) {
      L.marker([origen.lat, origen.lng], { icon: pin('⌂', 'origen') }).addTo(g).bindTooltip('Punto de salida');
      pts.push([origen.lat, origen.lng]);
    }
    paradas.forEach((p, i) => {
      if (!p.lat || !p.lng) return;
      const clase = p.estado === 'entregado' ? 'ok' : p.estado === 'no_entregado' ? 'no' : p.id === actual ? 'actual' : '';
      L.marker([p.lat, p.lng], { icon: pin(i + 1, clase) }).addTo(g).bindTooltip(`${i + 1}. ${p.cliente || ''}`);
      pts.push([p.lat, p.lng]);
    });
    if (pts.length > 1) L.polyline(pts, { color: '#F7B016', weight: 4, opacity: 0.85, dashArray: '6 8' }).addTo(g);
    if (pts.length) m.fitBounds(pts, { padding: [36, 36], maxZoom: 15 });
  }, [firma]);

  return html`<div ref=${caja} class="mapa" style=${{ height: height + 'px' }}></div>`;
}
