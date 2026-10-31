import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CONFIG } from '../config.js';

export { CONFIG };

export const sb = createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' }
});

/** Ejecuta una consulta de Supabase y lanza un error legible si falla. */
export async function q(builder) {
  const { data, error } = await builder;
  if (error) throw new Error(traducirError(error.message));
  return data;
}

export function traducirError(m) {
  const s = String(m || '');
  if (/row-level security|permission denied/i.test(s)) return 'No tienes permiso para esta acción.';
  if (/JWT|expired/i.test(s)) return 'Tu sesión venció. Vuelve a entrar.';
  if (/Failed to fetch|NetworkError/i.test(s)) return 'Sin conexión. Revisa tu internet.';
  const m2 = /([A-Z_]{6,}): (.+)/.exec(s);
  return m2 ? m2[2] : s;
}

/* ---------- Formatos ---------- */
const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const nf = new Intl.NumberFormat('es-CO');
export const money = (n) => cop.format(Number(n) || 0);
export const num = (n) => nf.format(Math.round((Number(n) || 0) * 10) / 10);
export function moneyShort(n) {
  n = Number(n) || 0;
  const a = Math.abs(n);
  if (a >= 1e6) return '$' + (n / 1e6).toFixed(1).replace(/\.0$/, '').replace('.', ',') + ' M';
  if (a >= 1e3) return '$' + Math.round(n / 1e3) + ' mil';
  return '$' + Math.round(n);
}
export function variacion(actual, anterior) {
  actual = Number(actual) || 0; anterior = Number(anterior) || 0;
  if (!anterior) return null;
  return Math.round(((actual - anterior) / anterior) * 100);
}

export function parseDate(d) {
  if (!d) return null;
  if (d instanceof Date) return d;
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) { const [y, m, dd] = d.split('-').map(Number); return new Date(y, m - 1, dd); }
  const x = new Date(d);
  return isNaN(x) ? null : x;
}
export const fecha = (d, o = { day: 'numeric', month: 'short' }) => { const x = parseDate(d); return x ? x.toLocaleDateString('es-CO', o).replace('.', '') : '—'; };
export const fechaLarga = (d) => fecha(d, { weekday: 'long', day: 'numeric', month: 'long' });
export const fechaCorta = (d) => fecha(d, { weekday: 'short', day: 'numeric', month: 'short' });
export const fechaHora = (d) => { const x = parseDate(d); return x ? x.toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—'; };
export function isoDate(d) { const x = parseDate(d) || new Date(); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }
export const hoyISO = () => isoDate(new Date());
export function sumarDias(d, n) { const x = new Date(parseDate(d)); x.setDate(x.getDate() + n); return x; }
export function diasDesde(d) { const x = parseDate(d); if (!x) return null; const h = parseDate(hoyISO()); return Math.round((h - parseDate(isoDate(x))) / 86400000); }
export function lunesDe(d) { const x = new Date(parseDate(d)); const wd = (x.getDay() + 6) % 7; x.setDate(x.getDate() - wd); return isoDate(x); }
export function saludo() { const h = new Date().getHours(); return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'; }

export const norm = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const sum = (arr, f) => arr.reduce((a, x) => a + (Number(typeof f === 'function' ? f(x) : x[f]) || 0), 0);
export function groupBy(arr, f) { const m = new Map(); for (const x of arr) { const k = f(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); } return m; }

/* ---------- Catálogos ---------- */
export const ESTADOS = {
  pendiente: { label: 'Pendiente', tone: 'amber' },
  confirmado: { label: 'Confirmado', tone: 'blue' },
  preparando: { label: 'Preparando', tone: 'blue' },
  en_camino: { label: 'En camino', tone: 'violet' },
  entregado: { label: 'Entregado', tone: 'green' },
  cancelado: { label: 'Cancelado', tone: 'red' }
};
export const ABIERTOS = ['pendiente', 'confirmado', 'preparando', 'en_camino'];
export const PAGOS = {
  pendiente: { label: 'Sin pagar', tone: 'amber' },
  parcial: { label: 'Pago parcial', tone: 'blue' },
  pagado: { label: 'Pagado', tone: 'green' }
};
export const METODOS = ['efectivo', 'nequi', 'daviplata', 'transferencia', 'llave', 'qr', 'otro'];
export const SOLICITUDES = { queja: 'Queja', cancelacion: 'Cancelación', mayorista: 'Mayorista', zona: 'Zona', pago: 'Pago', otro: 'Otro' };

export function mapsLink(p) {
  const dir = [p.direccion_entrega || p.direccion, p.barrio, p.municipio, 'Antioquia, Colombia'].filter(Boolean).join(', ');
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(dir);
}
export function rutaLink(paradas) {
  const d = paradas.map((p) => [p.direccion_entrega, p.barrio, p.municipio, 'Antioquia'].filter(Boolean).join(', '));
  if (!d.length) return null;
  const destino = d[d.length - 1];
  const intermedias = d.slice(0, -1).slice(0, 9);
  return 'https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=' + encodeURIComponent(destino) +
    (intermedias.length ? '&waypoints=' + encodeURIComponent(intermedias.join('|')) : '');
}

/* ---------- Acciones con aviso al cliente (webhook de n8n) ---------- */
export async function accion(payload) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) throw new Error('Tu sesión venció. Vuelve a entrar.');
  let r;
  try {
    r = await fetch(CONFIG.accionesUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    throw new Error('No se pudo contactar el servidor de acciones.');
  }
  let j = {};
  try { j = await r.json(); } catch (e) { /* sin cuerpo */ }
  if (!r.ok || j.ok === false) throw new Error(j.mensaje || 'La acción no se pudo completar (' + r.status + ').');
  return j;
}
