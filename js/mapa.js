import L from 'https://esm.sh/leaflet@1.9.4';
import { html, useEffect, useRef } from './ui.js';

export const COLORES_RUTA = ['#3E6FB6', '#7B5CC4', '#2E9E6A', '#E2463C', '#D98A00', '#1F8A9E'];
const pin = (texto, clase, color) => L.divIcon({
  className: 'pin-wrap',
  html: `<div class="pin ${clase || ''}"${color ? ` style="--c:${color}"` : ''}><span>${texto}</span></div>`,
  iconSize: [34, 34], iconAnchor: [17, 17]
});
const camion = (color) => L.divIcon({ className: 'pin-wrap', html: `<div class="pin truck" style="--c:${color}"><span>🚚</span></div>`, iconSize: [38, 38], iconAnchor: [19, 19] });

function useMapa(caja) {
  const mapa = useRef(null), capa = useRef(null);
  useEffect(() => {
    const m = L.map(caja.current, { zoomControl: true, scrollWheelZoom: false, tap: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m);
    m.setView([6.2442, -75.5812], 12);
    capa.current = L.layerGroup().addTo(m);
    mapa.current = m;
    const t = setTimeout(() => m.invalidateSize(), 250);
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(caja.current);
    return () => { clearTimeout(t); ro.disconnect(); m.remove(); };
  }, []);
  return [mapa, capa];
}

/** Una ruta: punto de salida y paradas numeradas en orden. */
export function Mapa({ origen, destino, paradas = [], height = 320, actual, ubicacion }) {
  const caja = useRef(null);
  const [mapa, capa] = useMapa(caja);
  const firma = JSON.stringify([origen && origen.lat, origen && origen.lng, destino && destino.lat, destino && destino.lng, actual, ubicacion, paradas.map((p) => [p.id, p.lat, p.lng, p.estado])]);
  useEffect(() => {
    const m = mapa.current, g = capa.current;
    if (!m) return;
    g.clearLayers();
    const pts = [];
    if (origen && origen.lat) { L.marker([origen.lat, origen.lng], { icon: pin('⌂', 'origen') }).addTo(g).bindTooltip('Punto de salida'); pts.push([origen.lat, origen.lng]); }
    const linea = [];
    if (origen && origen.lat) linea.push([origen.lat, origen.lng]);
    paradas.forEach((p, i) => {
      if (!p.lat || !p.lng) return;
      const clase = p.estado === 'entregado' ? 'ok' : p.estado === 'no_entregado' ? 'no' : p.id === actual ? 'actual' : '';
      L.marker([p.lat, p.lng], { icon: pin(i + 1, clase) }).addTo(g).bindTooltip(`${i + 1}. ${p.cliente || ''}`);
      pts.push([p.lat, p.lng]); linea.push([p.lat, p.lng]);
    });
    const fin = destino && destino.lat ? destino : null;
    if (fin && !(origen && origen.lat === fin.lat && origen.lng === fin.lng)) { L.marker([fin.lat, fin.lng], { icon: pin('⚑', 'origen') }).addTo(g).bindTooltip('Punto final'); pts.push([fin.lat, fin.lng]); }
    if (fin && linea.length) linea.push([fin.lat, fin.lng]);
    if (linea.length > 1) L.polyline(linea, { color: '#F7B016', weight: 4, opacity: 0.85, dashArray: '6 8' }).addTo(g);
    if (ubicacion && ubicacion.lat) { L.marker([ubicacion.lat, ubicacion.lng], { icon: camion('#241F35') }).addTo(g).bindTooltip('Tu ubicación'); pts.push([ubicacion.lat, ubicacion.lng]); }
    if (pts.length) m.fitBounds(pts, { padding: [36, 36], maxZoom: 15 });
  }, [firma]);
  return html`<div ref=${caja} class="mapa" style=${{ height: height + 'px' }}></div>`;
}

/** Varias rutas a la vez (seguimiento del Admin), cada una con su color y la última ubicación del repartidor. */
export function MapaRutas({ rutas = [], height = 380 }) {
  const caja = useRef(null);
  const [mapa, capa] = useMapa(caja);
  const firma = JSON.stringify(rutas.map((r) => [r.id, r.color, r.ultima_lat, r.ultima_lng, r.paradas.map((p) => [p.id, p.estado, p.lat])]));
  useEffect(() => {
    const m = mapa.current, g = capa.current;
    if (!m) return;
    g.clearLayers();
    const pts = [];
    rutas.forEach((r) => {
      const linea = [];
      if (r.origen_lat) linea.push([r.origen_lat, r.origen_lng]);
      r.paradas.forEach((p, i) => {
        if (!p.lat) return;
        const clase = p.estado === 'entregado' ? 'ok' : p.estado === 'no_entregado' ? 'no' : 'color';
        L.marker([p.lat, p.lng], { icon: pin(i + 1, clase, r.color) }).addTo(g).bindTooltip(`${r.nombre} · ${i + 1}. ${p.cliente}`);
        pts.push([p.lat, p.lng]); linea.push([p.lat, p.lng]);
      });
      if (linea.length > 1) L.polyline(linea, { color: r.color, weight: 4, opacity: 0.7 }).addTo(g);
      if (r.ultima_lat) { L.marker([r.ultima_lat, r.ultima_lng], { icon: camion(r.color), zIndexOffset: 1000 }).addTo(g).bindTooltip(r.nombre); pts.push([r.ultima_lat, r.ultima_lng]); }
    });
    if (pts.length) m.fitBounds(pts, { padding: [36, 36], maxZoom: 14 });
  }, [firma]);
  return html`<div ref=${caja} class="mapa" style=${{ height: height + 'px' }}></div>`;
}
