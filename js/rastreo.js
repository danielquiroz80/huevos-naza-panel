// Ubicación del repartidor durante una ruta en curso.
// Funciona en toda la app (no solo en "Mi ruta"): mientras haya una ruta en curso y la app esté abierta,
// envía la ubicación cada 15 s; al volver a la app (por ejemplo, después de usar Waze) la envía de inmediato.
// Un navegador no permite rastrear con la app cerrada; la oficina ve la última ubicación y hace cuánto llegó.
import { sb } from './lib.js';

let watchId = null, lock = null, ultimo = 0, iniciado = false, enCurso = false;

const enviar = (lat, lng, forzar) => {
  window.dispatchEvent(new CustomEvent('naza-ubicacion', { detail: { lat, lng } }));
  if (!forzar && Date.now() - ultimo < 15000) return;
  ultimo = Date.now();
  sb.rpc('panel_ubicacion', { p_lat: lat, p_lng: lng }).then(() => {}, () => {});
};
const pantalla = () => { if (enCurso && navigator.wakeLock && !document.hidden) navigator.wakeLock.request('screen').then((l) => { lock = l; }, () => {}); };
const ahora = () => navigator.geolocation && navigator.geolocation.getCurrentPosition((p) => enviar(p.coords.latitude, p.coords.longitude, true), () => {}, { enableHighAccuracy: true, timeout: 15000, maximumAge: 20000 });

function encender() {
  if (watchId !== null || !navigator.geolocation) return;
  watchId = navigator.geolocation.watchPosition((p) => enviar(p.coords.latitude, p.coords.longitude, false), () => {}, { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 });
  pantalla(); ahora();
}
function apagar() {
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  if (lock) lock.release().catch(() => {}); lock = null;
}
async function revisar(email) {
  const { data } = await sb.from('rutas').select('id').eq('repartidor', email).eq('estado', 'en_curso').limit(1);
  enCurso = !!(data && data.length);
  if (enCurso) encender(); else apagar();
}

/** Se llama una vez al entrar un repartidor. */
export function iniciarRastreo(email) {
  if (iniciado) return; iniciado = true;
  revisar(email);
  setInterval(() => revisar(email), 60000);
  window.addEventListener('naza-ruta-cambio', () => revisar(email));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { revisar(email); if (enCurso) { pantalla(); ahora(); } } });
}
