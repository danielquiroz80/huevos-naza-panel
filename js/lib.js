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
  if (/row-level security|permission denied/i.test(s)) return 'No tienes permiso para hacer esto.';
  if (/JWT|expired/i.test(s)) return 'Tu sesión terminó. Vuelve a entrar, por favor.';
  if (/Failed to fetch|NetworkError/i.test(s)) return 'Parece que no hay conexión. Revisa tu internet e inténtalo de nuevo.';
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
  no_entregado: { label: 'No entregado', tone: 'red' },
  cancelado: { label: 'Cancelado', tone: 'gray' }
};
export const ROLES = { dueno: 'Admin', operador: 'Operador', repartidor: 'Repartidor' };
export const MOTIVOS = {
  cliente_ausente: 'No había nadie',
  direccion: 'Dirección incorrecta o no encontrada',
  rechazado: 'El cliente lo rechazó',
  sin_tiempo: 'No alcanzó el tiempo',
  otro: 'Otro'
};
export const DOMINIO_USUARIOS = 'huevosdelanaza.app';
/** "carlos" -> "carlos@huevosdelanaza.app"; un correo se deja igual. */
export function usuarioAEmail(u) {
  const t = String(u || '').trim().toLowerCase();
  return t.includes('@') ? t : t + '@' + DOMINIO_USUARIOS;
}
export const nombreUsuario = (email) => String(email || '').endsWith('@' + DOMINIO_USUARIOS) ? email.split('@')[0] : email;

/** Reglas de contraseña: mínimo 6, letras y números, una mayúscula y un carácter especial. */
export function claveInvalida(c) {
  c = String(c || '');
  if (c.length < 6) return 'La contraseña debe tener al menos 6 caracteres.';
  if (!/[A-Z]/.test(c)) return 'Agrega al menos una letra mayúscula.';
  if (!/[a-zA-Z]/.test(c) || !/[0-9]/.test(c)) return 'Usa letras y números.';
  if (!/[^A-Za-z0-9]/.test(c)) return 'Agrega al menos un carácter especial, por ejemplo * # ! @';
  return null;
}
export const REGLAS_CLAVE = [
  { t: 'Mínimo 6 caracteres', f: (c) => c.length >= 6 },
  { t: 'Una letra mayúscula', f: (c) => /[A-Z]/.test(c) },
  { t: 'Letras y números', f: (c) => /[a-zA-Z]/.test(c) && /[0-9]/.test(c) },
  { t: 'Un carácter especial (* # ! @)', f: (c) => /[^A-Za-z0-9]/.test(c) }
];
export function sugerirClave() {
  const may = 'ABCDEFGHJKLMNPQRSTUVWXYZ', min = 'abcdefghjkmnpqrstuvwxyz', num = '23456789', esp = '*#!@$%';
  const r = (s) => s[crypto.getRandomValues(new Uint32Array(1))[0] % s.length];
  return r(may) + r(min) + r(min) + r(min) + r(num) + r(num) + r(esp) + r(min);
}
export const dispositivo = () => {
  const u = navigator.userAgent;
  const so = /Android/i.test(u) ? 'Android' : /iPhone|iPad/i.test(u) ? 'iPhone/iPad' : /Windows/i.test(u) ? 'Windows' : /Mac/i.test(u) ? 'Mac' : 'Otro';
  const nav = /Edg\//.test(u) ? 'Edge' : /Chrome\//.test(u) ? 'Chrome' : /Safari\//.test(u) ? 'Safari' : /Firefox\//.test(u) ? 'Firefox' : 'Navegador';
  return so + ' · ' + nav + (matchMedia('(display-mode: standalone)').matches ? ' · app instalada' : '');
};
export async function registrarEvento(evento) {
  try { await sb.rpc('panel_registrar_ingreso', { p_evento: evento, p_dispositivo: dispositivo() }); } catch (e) { /* no bloquea */ }
}
export async function salir() {
  await registrarEvento('salida');
  sessionStorage.removeItem('naza_desbloqueado');
  await sb.auth.signOut();
  location.replace(location.pathname + '#/'); location.reload(); // carga siempre la versión más reciente
}

/** Gestión de usuarios (función segura de Supabase, solo Admin). */
export async function usuarios(payload) {
  const { data, error } = await sb.functions.invoke('admin-usuarios', { body: payload });
  if (error) {
    let m = error.message;
    try { const j = await error.context.json(); m = j.mensaje || m; } catch (e) { /* sin cuerpo */ }
    throw new Error(m);
  }
  if (data && data.ok === false) throw new Error(data.mensaje);
  return data;
}

/** Ubicación actual del teléfono (o null si no se puede). */
export function ubicacionActual(timeout = 9000) {
  return new Promise((res) => {
    if (!navigator.geolocation) return res(null);
    navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lng: p.coords.longitude, precision: p.coords.accuracy }),
      () => res(null), { enableHighAccuracy: true, timeout, maximumAge: 60000 });
  });
}

/** Reduce una foto a ~1280 px en JPEG antes de subirla. */
export async function comprimirFoto(file, max = 1280, calidad = 0.72) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(img.src);
  return await new Promise((res) => c.toBlob(res, 'image/jpeg', calidad));
}

export function navegarLink(p, app = 'google') {
  const dir = [p.direccion_entrega, p.barrio, p.municipio, 'Antioquia, Colombia'].filter(Boolean).join(', ');
  if (app === 'waze') return p.lat ? `https://waze.com/ul?ll=${p.lat},${p.lng}&navigate=yes` : `https://waze.com/ul?q=${encodeURIComponent(dir)}&navigate=yes`;
  return 'https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=' + encodeURIComponent(p.lat ? p.lat + ',' + p.lng : dir);
}
export function whatsappLink(tel, texto = '') {
  let t = String(tel || '').replace(/\D/g, '');
  if (t.length === 10) t = '57' + t;
  return 'https://wa.me/' + t + (texto ? '?text=' + encodeURIComponent(texto) : '');
}
export const ABIERTOS = ['pendiente', 'confirmado', 'preparando', 'en_camino', 'no_entregado'];
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
export function rutaLink(paradas, origen) {
  const d = paradas.map((p) => p.lat ? p.lat + ',' + p.lng : [p.direccion_entrega, p.barrio, p.municipio, 'Antioquia'].filter(Boolean).join(', '));
  if (!d.length) return null;
  const destino = d[d.length - 1];
  const intermedias = d.slice(0, -1).slice(0, 9);
  return 'https://www.google.com/maps/dir/?api=1&travelmode=driving' + (origen && origen.lat ? '&origin=' + origen.lat + ',' + origen.lng : '') + '&destination=' + encodeURIComponent(destino) +
    (intermedias.length ? '&waypoints=' + encodeURIComponent(intermedias.join('|')) : '');
}

/* ---------- Acciones con aviso al cliente (webhook de n8n) ---------- */
export async function accion(payload) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) throw new Error('Tu sesión terminó. Vuelve a entrar, por favor.');
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
