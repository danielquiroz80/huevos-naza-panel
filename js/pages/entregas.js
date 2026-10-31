import { html, useState, useEffect, useRef, Icon, Card, Kpi, Tabs, Loader, Empty, ErrorBox, Modal, Field, AsyncButton, Badge, Meter, Drawer, SearchBox, useAsync, toast } from '../ui.js';
import { sb, q, num, money, fechaLarga, fechaCorta, fechaHora, hoyISO, isoDate, sumarDias, sum, accion, rutaLink, navegarLink, whatsappLink,
  ubicacionActual, comprimirFoto, MOTIVOS, nombreUsuario, norm, ESTADOS } from '../lib.js';
import { Mapa, MapaRutas, COLORES_RUTA } from '../mapa.js';
import { EstadoBadge } from './pedidos.js';

const ABIERTA = ['pendiente', 'confirmado', 'preparando', 'en_camino'];
const ORIGEN_KEY = 'naza_origen';
const leerOrigen = () => { try { return JSON.parse(localStorage.getItem(ORIGEN_KEY) || 'null') || { texto: '', lat: null, lng: null }; } catch (e) { return { texto: '', lat: null, lng: null }; } };
const hace = (t) => { if (!t) return ''; const m = Math.round((Date.now() - new Date(t)) / 60000); return m < 1 ? 'hace un momento' : m < 60 ? 'hace ' + m + ' min' : 'hace ' + Math.round(m / 60) + ' h'; };
const ESTADO_RUTA = { planeada: ['Por iniciar', 'amber'], en_curso: ['En ruta', 'violet'], terminada: ['Finalizada', 'green'], cancelada: ['Cancelada', 'gray'] };
const copiar = (t) => navigator.clipboard && navigator.clipboard.writeText(t).then(() => toast('Dirección copiada'));

/** Dirección grande y clara, con barrio y municipio. */
function Direccion({ p, grande }) {
  return html`<div class=${'dir' + (grande ? ' grande' : '')}>
    <${Icon} n="pin" size=${grande ? 20 : 16} />
    <div><b>${p.direccion_entrega || 'Sin dirección'}</b><span>${[p.barrio, p.municipio].filter(Boolean).join(' · ')}</span></div>
  </div>`;
}

function HojaCarga({ paradas }) {
  const items = new Map();
  for (const p of paradas) for (const it of p.items || []) items.set(it.producto, (items.get(it.producto) || 0) + (Number(it.cantidad) || 0));
  if (!items.size) return html`<span class="muted">Agrega paradas para ver qué cargar.</span>`;
  return html`<div class="carga">${[...items.entries()].sort().map(([k, v]) => html`<div key=${k} class="carga-item"><span class="egg-dot"></span><span>${k}</span><b>${num(v)}</b></div>`)}</div>`;
}

/** Punto de salida y punto final (por defecto el mismo de salida). */
function PuntosRuta({ origen, setOrigen, destino, setDestino, mismo, setMismo, disabled }) {
  const ubicar = (set, texto) => async () => {
    const u = await ubicacionActual();
    if (!u) throw new Error('No pudimos obtener tu ubicación. Revisa el permiso de ubicación del navegador.');
    set({ texto, lat: u.lat, lng: u.lng });
  };
  return html`<div class="puntos">
    <div class="punto"><span class="punto-ico ini"><${Icon} n="home" size=${16} /></span>
      <div class="punto-body"><label>Punto de salida</label>
        <div class="origen"><input class="input" placeholder="Ej.: Carrera 43A # 6 Sur-15, Medellín" value=${origen.texto} disabled=${disabled}
          onInput=${(e) => setOrigen({ texto: e.target.value, lat: null, lng: null })} />
          <${AsyncButton} className="btn" icon="nav" disabled=${disabled} onClick=${ubicar(setOrigen, 'Mi ubicación actual')}>Mi ubicación<//></div></div></div>
    <div class="punto"><span class="punto-ico fin"><${Icon} n="pin" size=${16} /></span>
      <div class="punto-body"><label>Punto final</label>
        <label class="switch small-sw"><input type="checkbox" checked=${mismo} disabled=${disabled} onChange=${(e) => setMismo(e.target.checked)} /><span></span>El mismo punto de salida</label>
        ${!mismo && html`<div class="origen"><input class="input" placeholder="¿Dónde termina el recorrido?" value=${destino.texto} disabled=${disabled}
          onInput=${(e) => setDestino({ texto: e.target.value, lat: null, lng: null })} />
          <${AsyncButton} className="btn" icon="nav" disabled=${disabled} onClick=${ubicar(setDestino, 'Mi ubicación actual')}>Mi ubicación<//></div>`}</div></div>
  </div>`;
}

/** Botón principal para calcular la ruta más rápida. */
function BotonOrdenar({ onClick, disabled, google, texto }) {
  return html`<${AsyncButton} className="btn-ordenar" disabled=${disabled} onClick=${onClick}>
    <span class="bo-ico"><${Icon} n="spark" size=${22} /></span>
    <span class="bo-txt"><b>${texto || 'Ordenar ruta más rápida'}</b><small>${google ? 'Calcula el mejor orden con el tráfico actual' : 'Orden aproximado por distancia (falta la clave de Google Maps)'}</small></span>
  <//>`;
}

const puntoDe = (ruta, campo) => ruta && ruta[campo + '_lat'] ? { texto: ruta[campo + '_texto'] || '', lat: ruta[campo + '_lat'], lng: ruta[campo + '_lng'] } : (ruta && ruta[campo + '_texto'] ? { texto: ruta[campo + '_texto'], lat: null, lng: null } : null);
const VACIO = { texto: '', lat: null, lng: null };

/** Reparte los pedidos entre los repartidores elegidos.
 *  1) Prioridad por orden de llegada: entran primero los pedidos más antiguos hasta llenar la capacidad total.
 *  2) Los que entran se agrupan por zonas (barrido alrededor del punto de salida) sin pasar la capacidad de cada repartidor.
 *  Lo que no cabe queda disponible para otra ruta. */
function repartir(pedidos, reps, centro) {
  const can = (p) => Number(p.canastas) || 1;
  const caps = reps.map((r) => Number(r.capacidad_canastas) || Infinity);
  const capTotal = caps.reduce((a, c) => a + c, 0);
  const fifo = [...pedidos].sort((a, b) => (new Date(a.creado || 0) - new Date(b.creado || 0)) || (a.id - b.id));
  const entran = [], quedan = [];
  let acum = 0;
  for (const p of fifo) { if (acum + can(p) <= capTotal) { entran.push(p); acum += can(p); } else quedan.push(p); }
  // Orden geográfico (barrido angular empezando en el hueco más grande)
  const con = entran.filter((p) => p.lat && p.lng), sin = entran.filter((p) => !(p.lat && p.lng));
  const c = centro && centro.lat ? centro : con.length ? { lat: sum(con, 'lat') / con.length, lng: sum(con, 'lng') / con.length } : null;
  let orden = con;
  if (c && con.length > 1) {
    const ord = con.map((p) => ({ p, a: Math.atan2(p.lat - c.lat, p.lng - c.lng) })).sort((x, y) => x.a - y.a);
    let gap = -1, ini = 0;
    ord.forEach((x, i) => { const sig = i + 1 < ord.length ? ord[i + 1].a : ord[0].a + 2 * Math.PI; if (sig - x.a > gap) { gap = sig - x.a; ini = (i + 1) % ord.length; } });
    orden = ord.slice(ini).concat(ord.slice(0, ini)).map((x) => x.p);
  }
  orden = orden.concat(sin);
  // Metas de carga proporcionales a la capacidad (o partes iguales si no hay capacidad definida)
  const finitas = caps.every((x) => isFinite(x));
  const metas = caps.map((x) => (finitas ? acum * x / capTotal : acum / reps.length));
  const grupos = reps.map(() => []), carga = reps.map(() => 0);
  let k = 0;
  for (const p of orden) {
    const w = can(p);
    while (k < reps.length - 1 && (carga[k] + w > caps[k] || carga[k] >= metas[k] - 1e-9)) k++;
    let j = carga[k] + w <= caps[k] ? k : caps.findIndex((cap, i) => carga[i] + w <= cap);
    if (j < 0) { quedan.push(p); continue; }
    grupos[j].push(p); carga[j] += w;
  }
  return { grupos, quedan: quedan.sort((a, b) => (new Date(a.creado || 0) - new Date(b.creado || 0)) || (a.id - b.id)) };
}

const totales = (ps) => { const m = new Map(); for (const p of ps) for (const it of p.items || []) m.set(it.producto, (m.get(it.producto) || 0) + (Number(it.cantidad) || 0)); return [...m.entries()].sort(); };

/** Estado visible de una ruta del día. */
const estadoRuta = (x) => x.estado === 'en_curso' ? ['En ruta', 'violet'] : x.estado === 'terminada' ? ['Finalizada', 'green'] : x.estado === 'cancelada' ? ['Cancelada', 'gray']
  : !x.repartidor ? ['Disponible', 'amber'] : x.carga_confirmada ? ['Tomada · carga lista', 'blue'] : ['Tomada', 'blue'];

/** Rutas del día (disponibles, tomadas, en recorrido) y creación de paquetes según los repartidores que salen. */
function Paquetes({ dia, origen, admin, perfil, bloqueado, onListo }) {
  const r = useAsync(async () => {
    if (!dia) return null;
    const [reps, pedidos, rutas] = await Promise.all([q(sb.rpc('panel_repartidores', { p_fecha: dia })), q(sb.rpc('panel_pedidos_disponibles', { p_fecha: dia })), q(sb.rpc('panel_paquetes', { p_fecha: dia }))]);
    return { reps, pedidos: pedidos.filter((p) => !p.repartidor), rutas };
  }, [dia]);
  const [sel, setSel] = useState(null);
  const [plan, setPlan] = useState(null);
  const [quedan, setQuedan] = useState([]);
  const [abierto, setAbierto] = useState(null);
  const [crear, setCrear] = useState(false);
  const [dlg, setDlg] = useState(null);
  useEffect(() => { if (r.data) setSel(r.data.reps.filter((x) => !x.ruta_estado).map((x) => x.email)); setPlan(null); }, [r.data]);
  useEffect(() => { if (!admin || !dia) return; const t = setInterval(() => r.reload(), 30000); return () => clearInterval(t); }, [dia]);
  if (!dia) return null;
  if (r.error) return html`<${ErrorBox} error=${r.error} onRetry=${r.reload} />`;
  if (!r.data || !sel) return html`<${Card}><${Loader} rows=${3} /><//>`;
  const { reps, pedidos, rutas } = r.data;
  const nombre = (x) => x.nombre || x.usuario;
  const disponibles = rutas.filter((x) => !x.repartidor && x.estado === 'planeada');
  const tengo = bloqueado || perfil && rutas.some((x) => x.repartidor === perfil.email && ['planeada', 'en_curso'].includes(x.estado));
  const libresReps = reps.filter((x) => !x.ruta_estado);
  const elegidos = libresReps.filter((x) => sel.includes(x.email));
  const toggle = (e) => { setPlan(null); setSel(sel.includes(e) ? sel.filter((x) => x !== e) : [...sel, e]); };
  const sugerir = () => {
    if (!elegidos.length) return toast('Elige al menos un repartidor', 'error');
    const { grupos, quedan: q2 } = repartir(pedidos, elegidos, origen);
    setPlan(elegidos.map((x, i) => ({ rep: x, ids: grupos[i].map((p) => p.id) }))); setQuedan(q2); setAbierto(null);
  };
  const mover = (id, de, a) => setPlan(plan.map((g, i) => i === de ? { ...g, ids: g.ids.filter((x) => x !== id) } : i === a ? { ...g, ids: [...g.ids, id] } : g));
  const publicar = async () => {
    const paquetes = plan.filter((g) => g.ids.length).map((g, i) => ({ nombre: 'Ruta ' + (i + 1), sugerido: g.rep.email, ids: g.ids }));
    if (!paquetes.length) throw new Error('No hay pedidos para repartir.');
    await q(sb.rpc('panel_repartir', { p_fecha: dia, p_paquetes: paquetes, p_origen_texto: origen && origen.texto || null, p_origen_lat: origen && origen.lat || null, p_origen_lng: origen && origen.lng || null }));
    toast(paquetes.length + ' ruta(s) publicadas. Cada repartidor toma la suya en "Mi ruta".');
    setPlan(null); setCrear(false); r.reload();
  };
  const tomar = async (x) => { await q(sb.rpc('panel_tomar_ruta', { p_ruta: x.id })); toast('¡Ruta tomada! Ahora confirma tu carga.'); onListo && onListo(); };
  const liberar = async () => {
    await q(sb.rpc('panel_liberar_ruta', { p_ruta: dlg.x.id, p_disolver: dlg.t === 'deshacer' }));
    toast(dlg.t === 'deshacer' ? 'Ruta deshecha: sus pedidos quedaron libres' : 'Ruta liberada: vuelve a estar disponible'); setDlg(null); r.reload(); onListo && admin && onListo();
  };
  const reiniciar = async () => { const n = await q(sb.rpc('panel_reiniciar_reparto', { p_fecha: dia })); toast('Reparto reiniciado: ' + n + ' pedido(s) quedaron libres'); setDlg(null); r.reload(); onListo && onListo(); };
  const porId = new Map(pedidos.map((p) => [p.id, p]));
  const total = sum(pedidos, 'canastas');
  const verCrear = admin; // solo el Admin reparte pedidos entre repartidores

  return html`<div class="stack">
    <${Card} title=${'Rutas del ' + fechaCorta(dia)} icon="truck" pad=${false}
      action=${admin && rutas.some((x) => x.estado === 'planeada') && html`<button class="btn sm danger-ghost" onClick=${() => setDlg({ t: 'reiniciar' })}><${Icon} n="refresh" size=${14} />Empezar de nuevo</button>`}>
      ${!rutas.length ? html`<${Empty} icon="truck" title="Aún no hay rutas">${!admin ? 'El Admin aún no ha publicado rutas para este día.' + (pedidos.length ? ' Puedes armar tu propia ruta con los pedidos libres.' : '') : pedidos.length ? 'Elige quiénes salen hoy y sugiere los paquetes.' : 'No hay pedidos por repartir.'}<//>` :
      html`<div class="list">${rutas.map((x) => {
        const [et, tone] = estadoRuta(x), mia = perfil && x.repartidor === perfil.email, sugeridaMia = perfil && x.sugerido_para === perfil.email;
        return html`<div key=${x.id} class=${'row-item static wrap ruta-item' + (sugeridaMia && !x.repartidor ? ' destacada' : '')}>
          <div class="ri-main"><b>${x.nombre || 'Ruta'}${x.repartidor ? ' · ' + (x.repartidor_nombre || nombreUsuario(x.repartidor)) : ''}${mia ? ' (tú)' : ''}</b>
            <span class="ri-meta">${x.paradas} pedidos · ${num(x.canastas)} canastas${(x.zonas || []).length ? ' · ' + x.zonas.slice(0, 4).join(', ') : ''}</span>
            ${!x.repartidor && x.sugerido_nombre && html`<span class="ri-meta">Sugerida para ${x.sugerido_nombre}${sugeridaMia ? ' (tú)' : ''}</span>`}
            <div class="pa-items mini">${(x.productos || []).map((it) => html`<span key=${it.producto} class="chip"><b>${num(it.cantidad)}</b> ${it.producto}</span>`)}</div></div>
          <div class="row-btns"><${Badge} tone=${tone}>${et}<//>
            ${perfil && perfil.rol === 'repartidor' && !x.repartidor && !tengo && html`<${AsyncButton} className="btn sm primary" icon="check" onClick=${() => tomar(x)}>Tomar ruta<//>`}
            ${(admin || mia) && x.repartidor && x.estado === 'planeada' && html`<button class="btn sm ghost" onClick=${() => setDlg({ t: 'liberar', x })}><${Icon} n="lock" size=${14} />Liberar</button>`}
            ${admin && !x.repartidor && x.estado === 'planeada' && html`<button class="btn sm danger-ghost" onClick=${() => setDlg({ t: 'deshacer', x })}>Deshacer</button>`}</div>
        </div>`;
      })}</div>`}
      ${admin && !verCrear && pedidos.length > 0 && html`<div class="card-body"><button class="link" onClick=${() => setCrear(true)}><${Icon} n="spark" size=${14} />Rehacer los paquetes disponibles</button></div>`}
    <//>

    ${verCrear && pedidos.length > 0 && html`<${Card} title="Repartir pedidos" icon="users">
      <p class="muted small">${pedidos.length} pedidos · ${num(total)} canastas sin ruta tomada. ¿Quiénes salen a repartir?</p>
      <div class="rep-chips">${reps.map((x) => {
        const ocu = !!x.ruta_estado, on = sel.includes(x.email) && !ocu;
        return html`<button key=${x.email} class=${'rep-chip' + (on ? ' on' : '')} disabled=${ocu} onClick=${() => toggle(x.email)}>
          <span class="rc-check"><${Icon} n=${on ? 'check' : 'plus'} size=${14} /></span>
          <span><b>${nombre(x)}${perfil && x.email === perfil.email ? ' (tú)' : ''}</b><small>${ocu ? (x.ruta_estado === 'en_curso' ? 'En recorrido' : 'Ya tiene ruta asignada') : x.capacidad_canastas ? 'Hasta ' + x.capacidad_canastas + ' canastas' : 'Sin capacidad definida'}</small></span></button>`;
      })}</div>
      <div class="auto-pie">
        <span>${elegidos.length === 0 ? 'Ningún repartidor elegido' : elegidos.length === 1 ? html`<b>1 repartidor</b>: una sola ruta hasta llenar su capacidad` : html`<b>${elegidos.length} repartidores</b>: ${elegidos.length} rutas equilibradas por zona y capacidad`}
          · capacidad ${elegidos.some((x) => !x.capacidad_canastas) ? 'sin límite definido' : num(sum(elegidos, 'capacidad_canastas')) + ' canastas'} · primero los pedidos más antiguos</span>
        <button class="btn violet" disabled=${!elegidos.length} onClick=${sugerir}><${Icon} n="spark" size=${16} />${plan ? 'Volver a sugerir' : 'Sugerir rutas'}</button>
      </div>
      ${plan && html`<div class="paquetes">${plan.map((g, i) => {
        const ps = g.ids.map((id) => porId.get(id)).filter(Boolean), can = sum(ps, 'canastas'), cap = Number(g.rep.capacidad_canastas) || 0;
        const barrios = [...new Set(ps.map((p) => p.barrio || p.municipio).filter(Boolean))];
        return html`<section key=${g.rep.email} class="paquete" style=${{ '--c': COLORES_RUTA[i % COLORES_RUTA.length] }}>
          <header><span class="rep-avatar">${i + 1}</span>
            <div><b>Ruta ${i + 1}</b><span>Sugerida para ${nombre(g.rep)} · ${ps.length} pedidos · ${num(can)} can.${cap ? ' de ' + cap : ''}</span></div>
            ${cap && can > cap ? html`<${Badge} tone="red">Supera capacidad<//>` : null}</header>
          <div class="rep-prog"><div style=${{ width: (total ? Math.round((can / total) * 100) : 0) + '%' }}></div></div>
          <div class="pa-items">${totales(ps).map(([k, v]) => html`<span key=${k} class="chip"><b>${num(v)}</b> ${k}</span>`)}</div>
          ${barrios.length > 0 && html`<p class="muted small">Zonas: ${barrios.slice(0, 5).join(', ')}${barrios.length > 5 ? '…' : ''}</p>`}
          <button class="link" onClick=${() => setAbierto(abierto === i ? null : i)}>${abierto === i ? 'Ocultar pedidos' : 'Ver o mover pedidos'}</button>
          ${abierto === i && html`<ol class="paradas compacta">${ps.map((p) => html`<li key=${p.id} class="parada">
            <div class="ri-main"><b class="dir-main">${p.direccion_entrega}</b><span class="ri-meta">${[p.barrio, p.municipio].filter(Boolean).join(' · ')} · ${num(p.canastas)} can.</span></div>
            ${plan.length > 1 && html`<select class="input mini" value="" onChange=${(e) => e.target.value !== '' && mover(p.id, i, Number(e.target.value))} aria-label="Pasar a otra ruta">
              <option value="">Pasar a…</option>${plan.map((o, k) => k !== i && html`<option value=${k}>Ruta ${k + 1}</option>`)}</select>`}
          </li>`)}</ol>`}
        </section>`;
      })}</div>
      ${quedan.length > 0 && html`<div class="warn"><${Icon} n="alert" size=${16} /><span><b>${quedan.length} pedido(s) · ${num(sum(quedan, 'canastas'))} canastas no caben</b> en la capacidad de los repartidores elegidos.
        Se priorizaron los pedidos que llegaron primero; estos quedan disponibles para otra ruta: ${quedan.slice(0, 8).map((p) => '#' + p.id).join(', ')}${quedan.length > 8 ? '…' : ''}.</span></div>`}
      <${AsyncButton} className="btn primary big block" icon="check" onClick=${publicar}>Publicar ${plan.filter((g) => g.ids.length).length} ruta(s)<//>
      <p class="muted small center">Las rutas quedan disponibles. Cuando un repartidor toma una, se bloquea para los demás; si la libera, vuelve a estar disponible.</p>`}
    <//>`}

    ${dlg && html`<${Modal} title=${dlg.t === 'reiniciar' ? 'Empezar de nuevo el reparto' : dlg.t === 'deshacer' ? 'Deshacer ' + (dlg.x.nombre || 'ruta') : 'Liberar ' + (dlg.x.nombre || 'ruta')} onClose=${() => setDlg(null)}
      footer=${html`<button class="btn ghost" onClick=${() => setDlg(null)}>Volver</button>
        <${AsyncButton} className=${'btn ' + (dlg.t === 'liberar' ? 'primary' : 'danger')} icon="check" onClick=${dlg.t === 'reiniciar' ? reiniciar : liberar}>Sí, continuar<//>`}>
      <p>${dlg.t === 'reiniciar' ? 'Se deshacen todas las rutas del día que no han iniciado (disponibles y tomadas). Los pedidos quedan libres para volver a elegir repartidores y sugerir rutas. Las rutas en recorrido no se tocan.'
        : dlg.t === 'deshacer' ? 'La ruta desaparece y sus pedidos quedan libres para repartirlos de nuevo.'
        : 'La ruta deja de estar asignada y vuelve a quedar disponible para que cualquier repartidor la tome.'}</p>
    <//>`}
  </div>`;
}

/* =================== Huevos dañados y canastas extra =================== */
const TIPO_DANO = { quebrado: 'Quebrados', danado: 'Rajados o dañados', sucio: 'Sucios', otro: 'Otro' };
const MOMENTO = { carga: 'Al cargar', ruta: 'En el camino', entrega: 'En la entrega', bodega: 'En bodega' };
let productosCache = null;
const cargarProductos = async () => productosCache || (productosCache = await q(sb.rpc('panel_productos_lista')));
const totalExtras = (ruta) => sum(ruta && ruta.extras || [], 'canastas');

/** Registro rápido de huevos quebrados o dañados (repartidor o Admin). */
function ReportarDano({ ruta, paradas = [], pedidoId, onClose, onListo }) {
  const prods = useAsync(cargarProductos, []);
  const [f, setF] = useState({ producto: null, unidades: 1, tipo: 'quebrado', repuesto: totalExtras(ruta) > 0, pedido: pedidoId || '', nota: '' });
  const [foto, setFoto] = useState(null);
  useEffect(() => {
    if (prods.data && !f.producto) {
      const ped = paradas.find((p) => p.id === Number(f.pedido));
      const nom = ped && ped.items && ped.items[0] && ped.items[0].producto;
      const pr = prods.data.find((x) => x.nombre === nom) || prods.data[0];
      if (pr) setF((x) => ({ ...x, producto: pr.id }));
    }
  }, [prods.data]);
  const pr = prods.data && prods.data.find((x) => x.id === f.producto);
  const valor = pr ? Math.round((Number(pr.precio) || 0) * f.unidades / 30) : 0;
  const set = (k, v) => setF({ ...f, [k]: v });
  const guardar = async () => {
    if (!f.producto) throw new Error('Elige el producto.');
    if (!(f.unidades > 0)) throw new Error('Indica cuántos huevos.');
    if (f.tipo === 'otro' && !f.nota.trim()) throw new Error('Cuéntanos qué pasó.');
    let path = null;
    if (foto) {
      const blob = await comprimirFoto(foto);
      path = 'novedades/' + (ruta ? ruta.fecha + '/R' + ruta.id : 'bodega') + '-' + Date.now() + '.jpg';
      const { error } = await sb.storage.from('entregas').upload(path, blob, { contentType: 'image/jpeg' });
      if (error) { path = null; toast('No se pudo subir la foto; se guarda el reporte sin foto.', 'error'); }
    }
    await q(sb.rpc('panel_reportar_novedad', { p_ruta: ruta ? ruta.id : null, p_pedido: f.pedido ? Number(f.pedido) : null, p_producto: f.producto, p_unidades: f.unidades,
      p_tipo: f.tipo, p_repuesto: !!f.repuesto, p_nota: f.nota || null, p_foto: path }));
    toast(f.unidades + ' huevo(s) reportados' + (f.repuesto ? ' y repuestos con los extra' : ''));
    if (navigator.vibrate) navigator.vibrate(40);
    onListo && onListo();
  };
  return html`<${Modal} title="Reportar huevos dañados" onClose=${onClose}
    footer=${html`<button class="btn ghost" onClick=${onClose}>Cancelar</button><${AsyncButton} className="btn primary" icon="check" onClick=${guardar}>Guardar reporte<//>`}>
    <div class="dano">
      <div class="field"><span class="field-label">¿Qué pasó?</span>
        <div class="seg-grande">${Object.entries(TIPO_DANO).map(([k, l]) => html`<button key=${k} class=${f.tipo === k ? 'on' : ''} onClick=${() => set('tipo', k)}>${l}</button>`)}</div></div>
      <div class="field"><span class="field-label">Producto</span>
        ${!prods.data ? html`<${Loader} rows=${1} />` : html`<div class="chips">${prods.data.map((x) => html`<button key=${x.id} class=${'chip-b' + (f.producto === x.id ? ' on' : '')} onClick=${() => set('producto', x.id)}>${x.nombre}</button>`)}</div>`}</div>
      <div class="field"><span class="field-label">¿Cuántos huevos?</span>
        <div class="stepper">
          <button aria-label="Menos" onClick=${() => set('unidades', Math.max(1, f.unidades - 1))}>−</button>
          <input type="number" inputmode="numeric" min="1" value=${f.unidades} onInput=${(e) => set('unidades', Math.max(1, Math.min(3000, parseInt(e.target.value || '1', 10) || 1)))} />
          <button aria-label="Más" onClick=${() => set('unidades', f.unidades + 1)}>+</button>
        </div>
        <div class="chips rapido">${[[6, '6'], [12, '12'], [15, '½ canasta'], [30, '1 canasta']].map(([n, l]) => html`<button key=${n} class="chip-b" onClick=${() => set('unidades', n)}>${l}</button>`)}</div>
        ${valor > 0 && html`<span class="muted small">Pérdida aproximada: ${money(valor)}</span>`}</div>
      ${ruta && html`<label class=${'toggle-fila' + (f.repuesto ? ' on' : '')}><input type="checkbox" checked=${f.repuesto} onChange=${(e) => set('repuesto', e.target.checked)} />
        <span><b>Los repuse con huevos extra</b><small>${totalExtras(ruta) ? 'Llevas ' + totalExtras(ruta) + ' canasta(s) extra en esta ruta.' : 'No registraste canastas extra para esta ruta.'}</small></span></label>`}
      ${paradas.length > 0 && html`<${Field} label="¿Afectó un pedido? (opcional)"><select class="input" value=${f.pedido} onChange=${(e) => set('pedido', e.target.value)}>
        <option value="">No, fue en la carga o en el camino</option>${paradas.map((p) => html`<option value=${p.id}>#${p.id} · ${p.direccion_entrega}</option>`)}</select><//>`}
      <${Field} label=${f.tipo === 'otro' ? 'Cuéntanos qué pasó' : 'Comentario (opcional)'}><input class="input" value=${f.nota} onInput=${(e) => set('nota', e.target.value)} placeholder="Ej.: se cayó la canasta en un hueco" /><//>
      <label class="foto-mini"><${Icon} n="camera" size=${18} /><span>${foto ? 'Foto lista ✓' : 'Agregar foto (opcional)'}</span><input type="file" accept="image/*" capture="environment" onChange=${(e) => setFoto(e.target.files && e.target.files[0])} /></label>
    </div>
  <//>`;
}

/** Canastas extra que lleva el repartidor para reponer daños. */
function ExtrasRuta({ ruta, editable, onCambio }) {
  const prods = useAsync(cargarProductos, []);
  const [ex, setEx] = useState(() => Object.fromEntries((ruta.extras || []).map((e) => [e.producto_id, e.canastas])));
  const [sucio, setSucio] = useState(false);
  const cambiar = (id, d) => { setEx({ ...ex, [id]: Math.max(0, Math.min(50, (ex[id] || 0) + d)) }); setSucio(true); };
  const guardar = async () => { await q(sb.rpc('panel_extras_ruta', { p_ruta: ruta.id, p_extras: Object.entries(ex).map(([producto_id, canastas]) => ({ producto_id: Number(producto_id), canastas })) })); setSucio(false); toast('Canastas extra guardadas'); onCambio && onCambio(); };
  if (!prods.data) return null;
  const total = Object.values(ex).reduce((a, b) => a + b, 0);
  return html`<div class="extras">
    <div class="extras-head"><span><${Icon} n="box" size=${15} /><b>Canastas extra</b> <span class="muted small">para reponer huevos dañados (opcional)</span></span>${total > 0 && html`<${Badge} tone="blue">${total} extra<//>`}</div>
    ${editable ? html`<div class="extras-lista">${prods.data.map((x) => html`<div key=${x.id} class="extra-fila"><span>${x.nombre}</span>
        <div class="stepper sm"><button onClick=${() => cambiar(x.id, -1)} aria-label=${'Menos ' + x.nombre}>−</button><b>${ex[x.id] || 0}</b><button onClick=${() => cambiar(x.id, 1)} aria-label=${'Más ' + x.nombre}>+</button></div></div>`)}</div>
      ${sucio && html`<${AsyncButton} className="btn sm primary" icon="check" onClick=${guardar}>Guardar extras<//>`}`
      : html`<span class="muted small">${(ruta.extras || []).length ? ruta.extras.map((e) => e.canastas + ' ' + e.producto).join(' · ') : 'No lleva canastas extra.'}</span>`}
  </div>`;
}

/** Lista de daños reportados en una ruta. */
function DanosRuta({ ruta, admin, version, onCambio }) {
  const r = useAsync(() => q(sb.from('novedades_huevos').select('*').eq('ruta_id', ruta.id).eq('anulada', false).order('creado_en', { ascending: false })), [ruta.id, version]);
  const d = r.data || [];
  const anular = async (id) => { await q(sb.rpc('panel_anular_novedad', { p_id: id })); toast('Reporte anulado'); r.reload(); onCambio && onCambio(); };
  const usados = sum(d.filter((x) => x.repuesto), 'unidades');
  return html`<div class="stack">
    <div class="mini-kpis"><div class="no"><b>${num(sum(d, 'unidades'))}</b><span>Huevos dañados</span></div><div><b>${money(sum(d, 'valor_estimado'))}</b><span>Pérdida aprox.</span></div>
      <div><b>${totalExtras(ruta)}</b><span>Canastas extra</span></div><div class="ok"><b>${num(usados)}</b><span>Repuestos con extra</span></div></div>
    ${!d.length ? html`<${Empty} icon="egg" title="Sin daños reportados" />` : html`<div class="list">${d.map((x) => html`<div key=${x.id} class="row-item static">
      <div class="ri-main"><b>${x.unidades} ${x.producto} · ${TIPO_DANO[x.tipo]}</b><span class="ri-meta">${MOMENTO[x.momento]}${x.pedido_id ? ' · pedido #' + x.pedido_id : ''} · ${fechaHora(x.creado_en)}${x.repuesto ? ' · repuesto con extra' : ''}</span>
        ${x.nota && html`<span class="ri-meta">“${x.nota}”</span>`}</div>
      <div class="row-btns">${x.foto_path && html`<${AsyncButton} className="btn sm ghost" icon="external" onClick=${async () => { const { data } = await sb.storage.from('entregas').createSignedUrl(x.foto_path, 300); if (data) window.open(data.signedUrl, '_blank', 'noopener'); }}>Foto<//>`}
        ${admin && html`<${AsyncButton} className="btn sm danger-ghost" onClick=${() => anular(x.id)}>Anular<//>`}</div></div>`)}</div>`}
  </div>`;
}

/* =================== Entregas (Admin y Operador) =================== */
export function Entregas({ perfil }) {
  const [tab, setTab] = useState('panel');
  const [verRuta, setVerRuta] = useState(null);
  const [detalle, setDetalle] = useState(null);
  if (verRuta) return html`<div class="stack"><button class="btn ghost back" onClick=${() => setVerRuta(null)}><${Icon} n="down2" size=${16} />Volver</button>
    <${MiRuta} perfil=${perfil} rutaId=${verRuta} /></div>`;
  return html`<div class="stack">
    <div class="toolbar sticky-tabs"><${Tabs} value=${tab} onChange=${setTab} items=${[{ v: 'panel', label: 'Panel' }, { v: 'rutas', label: 'Rutas' }, { v: 'pedidos', label: 'Pedidos' }, { v: 'planear', label: 'Planear' }]} /></div>
    ${tab === 'panel' && html`<${EnVivo} onVer=${setDetalle} onPlanear=${() => setTab('planear')} onPedidos=${() => setTab('pedidos')} onRutas=${() => setTab('rutas')} />`}
    ${tab === 'rutas' && html`<${RutasLista} onVer=${setDetalle} />`}
    ${tab === 'pedidos' && html`<${PedidosEstado} onRuta=${setDetalle} onPlanear=${() => setTab('planear')} />`}
    ${tab === 'planear' && html`<${Planear} onVer=${setVerRuta} />`}
    ${detalle && html`<${RutaDetalle} id=${detalle} onClose=${() => setDetalle(null)} onAbrir=${(id) => { setDetalle(null); setVerRuta(id); }} />`}
  </div>`;
}

/* ---------- Rutas: listado con estado y progreso ---------- */
const PERIODO_RUTAS = { hoy: 'Hoy', manana: 'Mañana', semana: 'Últimos 7 días', mes: 'Últimos 30 días' };
function RutasLista({ onVer }) {
  const [per, setPer] = useState('hoy');
  const [est, setEst] = useState('todas');
  const [buscar, setBuscar] = useState('');
  const [desde, hasta] = per === 'hoy' ? [hoyISO(), hoyISO()] : per === 'manana' ? [isoDate(sumarDias(new Date(), 1)), isoDate(sumarDias(new Date(), 1))]
    : [isoDate(sumarDias(new Date(), per === 'semana' ? -6 : -29)), isoDate(sumarDias(new Date(), 1))];
  const r = useAsync(() => q(sb.rpc('panel_rutas', { p_desde: desde, p_hasta: hasta })), [desde, hasta]);
  useEffect(() => { const t = setInterval(() => { if (!document.hidden) r.reload(); }, 20000); return () => clearInterval(t); }, [desde, hasta]);
  const clave = (x) => x.estado === 'planeada' ? (x.repartidor ? 'tomada' : 'disponible') : x.estado;
  const ESTS = [['todas', 'Todas'], ['disponible', 'Disponibles'], ['tomada', 'Tomadas'], ['en_curso', 'En ruta'], ['terminada', 'Finalizadas'], ['cancelada', 'Canceladas']];
  const todas = r.data || [];
  const lista = todas.filter((x) => (est === 'todas' ? x.estado !== 'cancelada' : clave(x) === est) && (!buscar || norm(['R-' + x.id, x.nombre, x.repartidor_nombre].join(' ')).includes(norm(buscar))));
  return html`<div class="stack">
    <div class="toolbar wrap-mobile">
      <select class="input auto" value=${per} onChange=${(e) => setPer(e.target.value)} aria-label="Periodo">${Object.entries(PERIODO_RUTAS).map(([k, l]) => html`<option value=${k}>${l}</option>`)}</select>
      <${SearchBox} value=${buscar} onInput=${setBuscar} placeholder="Buscar ruta o repartidor" />
    </div>
    <div class="chips scroll-x">${ESTS.map(([k, l]) => html`<button key=${k} class=${'chip-b' + (est === k ? ' on' : '')} onClick=${() => setEst(k)}>${l}<span class="chip-n">${k === 'todas' ? todas.filter((x) => x.estado !== 'cancelada').length : todas.filter((x) => clave(x) === k).length}</span></button>`)}</div>
    <${ErrorBox} error=${r.error} onRetry=${r.reload} />
    ${!r.data ? html`<${Loader} rows=${5} />` : !lista.length ? html`<${Card}><${Empty} icon="route" title="No hay rutas con este filtro">Crea rutas en la pestaña "Planear".<//><//>` :
      html`<div class="rutas-tabla">
        <div class="rt-head"><span>Ruta</span><span>Repartidor</span><span>Creada</span><span>Inicio</span><span>Fin</span><span>Pedidos</span><span>Progreso</span><span>Estado</span></div>
        ${lista.map((x) => { const [et, tone] = estadoRuta(x), hechos = x.ok + x.no, pct = x.paradas ? Math.round((hechos / x.paradas) * 100) : 0;
          return html`<button key=${x.id} class="rt-row" onClick=${() => onVer(x.id)}>
            <span class="rt-id"><b>R-${x.id}</b><small>${x.nombre || ''} · ${fechaCorta(x.fecha)}</small></span>
            <span class="rt-rep">${x.repartidor ? x.repartidor_nombre : html`<i class="muted">Sin tomar</i>`}</span>
            <span class="rt-c" data-l="Creada">${fechaHora(x.creada)}</span>
            <span class="rt-c" data-l="Inicio">${x.iniciada_en ? fechaHora(x.iniciada_en) : '—'}</span>
            <span class="rt-c" data-l="Fin">${x.terminada_en ? fechaHora(x.terminada_en) : x.cancelada_en ? fechaHora(x.cancelada_en) : '—'}</span>
            <span class="rt-c" data-l="Pedidos"><b>${x.paradas}</b> · ${num(x.canastas)} can.</span>
            <span class="rt-prog"><span class="bar-mini"><i style=${{ width: pct + '%' }}></i></span><small>${hechos}/${x.paradas}${x.no ? ' · ' + x.no + ' fallidas' : ''}</small></span>
            <span class="rt-est"><${Badge} tone=${tone}>${et}<//></span>
          </button>`; })}
      </div>`}
  </div>`;
}

/* ---------- Detalle de una ruta ---------- */
const EVENTOS = { creada: 'Ruta creada', tomada: 'Tomada por', liberada: 'Liberada', reasignada: 'Reasignada a', iniciada: 'Recorrido iniciado', finalizada: 'Ruta finalizada', cancelada: 'Ruta cancelada',
  carga_confirmada: 'Carga confirmada', carga_sin_confirmar: 'Carga sin confirmar', pedido_agregado: 'Pedido agregado', pedido_retirado: 'Pedido retirado',
  pedido_en_camino: 'En camino a', pedido_entregado: 'Entregado', pedido_no_entregado: 'No entregado', pedido_confirmado: 'Pedido vuelve a confirmado', pedido_cancelado: 'Pedido cancelado',
  pedido_pendiente: 'Pedido vuelve a pendiente', pedido_preparando: 'Pedido en preparación', novedad_huevos: 'Huevos dañados reportados', extras: 'Canastas extra actualizadas' };
function RutaDetalle({ id, onClose, onAbrir }) {
  const [tab, setTab] = useState('paradas');
  const [dlg, setDlg] = useState(null);
  const r = useAsync(async () => {
    const [ruta, paradas, eventos] = await Promise.all([
      q(sb.from('rutas').select('*').eq('id', id).maybeSingle()),
      q(sb.from('v_entregas').select('id,estado,cliente,telefono,direccion_entrega,barrio,municipio,indicaciones,notas,lat,lng,orden_manual,canastas,items,entregado_en,motivo_no_entrega,entrega_obs,foto_entrega,total,pago_estado').eq('ruta_id', id).order('orden_manual', { nullsFirst: false })),
      q(sb.from('rutas_eventos').select('*').eq('ruta_id', id).order('creado_en', { ascending: false }).limit(300))
    ]);
    let rep = null;
    if (ruta && ruta.repartidor) rep = await q(sb.from('administradores').select('email,nombre,usuario,telefono').eq('email', ruta.repartidor).maybeSingle());
    return { ruta, paradas, eventos, rep };
  }, [id]);
  const verFoto = async (path) => { const { data, error } = await sb.storage.from('entregas').createSignedUrl(path, 300); if (error) throw new Error(error.message); window.open(data.signedUrl, '_blank', 'noopener'); };
  const d = r.data;
  if (!d) return html`<${Drawer} title=${'Ruta R-' + id} onClose=${onClose}>${r.error ? html`<${ErrorBox} error=${r.error} onRetry=${r.reload} />` : html`<${Loader} rows=${6} />`}<//>`;
  if (!d.ruta) return html`<${Drawer} title=${'Ruta R-' + id} onClose=${onClose}><${Empty} icon="route" title="Esta ruta ya no existe">Pudo deshacerse para volver a repartir sus pedidos.<//><//>`;
  const ru = d.ruta, [et, tone] = estadoRuta({ ...ru, carga_confirmada: !!ru.carga_confirmada_en });
  const ok = d.paradas.filter((p) => p.estado === 'entregado').length, no = d.paradas.filter((p) => p.estado === 'no_entregado').length;
  const repNombre = d.rep ? d.rep.nombre || d.rep.usuario : null;
  const accionRuta = async () => {
    if (dlg.t === 'cancelar') { const n = await q(sb.rpc('panel_cancelar_ruta', { p_ruta: ru.id, p_motivo: dlg.motivo })); toast('Ruta cancelada: ' + n + ' pedido(s) quedaron disponibles'); }
    else if (dlg.t === 'liberar') { await q(sb.rpc('panel_liberar_ruta', { p_ruta: ru.id, p_disolver: false })); toast('Ruta liberada: vuelve a estar disponible'); }
    else if (dlg.t === 'finalizar') { await q(sb.rpc('panel_finalizar_ruta', { p_ruta: ru.id })); toast('Ruta finalizada'); }
    setDlg(null); r.reload();
  };
  const pendientes = d.paradas.filter((p) => ABIERTA.includes(p.estado)).length;
  return html`<${Drawer} title=${'Ruta R-' + ru.id + (ru.nombre ? ' · ' + ru.nombre : '')} sub=${fechaLarga(ru.fecha)} onClose=${onClose}
    footer=${html`<div class="drawer-acts">
      ${ru.estado === 'planeada' && ru.repartidor && html`<button class="btn ghost" onClick=${() => setDlg({ t: 'liberar' })}><${Icon} n="lock" size=${15} />Liberar</button>`}
      ${ru.estado === 'en_curso' && !pendientes && html`<button class="btn" onClick=${() => setDlg({ t: 'finalizar' })}><${Icon} n="check" size=${15} />Finalizar</button>`}
      ${['planeada', 'en_curso'].includes(ru.estado) && html`<button class="btn danger-ghost" onClick=${() => setDlg({ t: 'cancelar', motivo: '' })}><${Icon} n="x" size=${15} />Cancelar ruta</button>`}
      <button class="btn primary" onClick=${() => onAbrir(ru.id)}><${Icon} n="pin" size=${15} />Abrir ruta</button></div>`}>
    <div class="rd-head">
      <${Badge} tone=${tone}>${et}<//>
      <div class="rd-rep">${repNombre ? html`<${Icon} n="user" size=${15} /><b>${repNombre}</b>${d.rep.telefono && html`<a class="link" href=${'tel:' + d.rep.telefono}>${d.rep.telefono}</a>`}` : html`<span class="muted">Disponible: ningún repartidor la ha tomado</span>`}</div>
    </div>
    <div class="mini-kpis">
      <div><b>${d.paradas.length}</b><span>Pedidos</span></div><div class="ok"><b>${ok}</b><span>Entregados</span></div><div class="no"><b>${no}</b><span>Incidencias</span></div>
      <div><b>${fechaHora(ru.created_at)}</b><span>Creada</span></div><div><b>${ru.iniciada_en ? fechaHora(ru.iniciada_en) : '—'}</b><span>Inicio</span></div>
      <div><b>${ru.terminada_en ? fechaHora(ru.terminada_en) : ru.cancelada_en ? fechaHora(ru.cancelada_en) : '—'}</b><span>${ru.cancelada_en ? 'Cancelada' : 'Fin'}</span></div>
    </div>
    ${ru.motivo_cancelacion && html`<div class="warn"><${Icon} n="alert" size=${15} />Motivo de cancelación: ${ru.motivo_cancelacion}</div>`}
    <div class="rd-mapa"><${Mapa} origen=${{ lat: ru.origen_lat, lng: ru.origen_lng }} paradas=${d.paradas} actual=${(d.paradas.find((p) => p.estado === 'en_camino') || {}).id}
      ubicacion=${ru.estado === 'en_curso' && ru.ultima_lat ? { lat: ru.ultima_lat, lng: ru.ultima_lng } : null} height=${260} /></div>
    <${Tabs} value=${tab} onChange=${setTab} items=${[{ v: 'paradas', label: 'Paradas', n: d.paradas.length }, { v: 'incidencias', label: 'Incidencias', n: no }, { v: 'danos', label: 'Huevos dañados' }, { v: 'historial', label: 'Historial', n: d.eventos.length }]} />
    ${tab === 'danos' && html`<div class="stack"><${ExtrasRuta} ruta=${ru} editable=${['planeada', 'en_curso'].includes(ru.estado)} onCambio=${r.reload} />
      <button class="btn" onClick=${() => setDlg({ t: 'dano' })}><${Icon} n="egg" size=${15} />Reportar huevos dañados</button>
      <${DanosRuta} ruta=${ru} admin=${true} version=${d.eventos.length} onCambio=${r.reload} /></div>`}
    ${tab === 'paradas' && html`<ol class="paradas detalle">${d.paradas.map((p, i) => html`<li key=${p.id} class=${'parada ' + p.estado}>
      <span class="num">${p.estado === 'entregado' ? '✓' : p.estado === 'no_entregado' ? '!' : i + 1}</span>
      <div class="ri-main"><b class="dir-main">${p.direccion_entrega}</b><span class="dir-sub">${[p.barrio, p.municipio].filter(Boolean).join(' · ')}</span>
        <span class="ri-meta">#${p.id} · ${p.cliente}${p.telefono ? ' · ' + p.telefono : ''} · ${(p.items || []).map((it) => it.cantidad + ' ' + it.producto).join(', ')}</span>
        ${p.indicaciones && html`<span class="ri-meta">📝 ${p.indicaciones}</span>`}
        ${p.entregado_en && html`<span class="ri-meta">${p.estado === 'entregado' ? 'Entregado' : 'Intento'} ${fechaHora(p.entregado_en)}${p.entrega_obs ? ' · ' + p.entrega_obs : ''}</span>`}</div>
      <div class="row-btns">${p.foto_entrega && html`<${AsyncButton} className="btn sm ghost" icon="external" onClick=${() => verFoto(p.foto_entrega)}>Foto<//>`}<${EstadoBadge} e=${p.estado} /></div>
    </li>`)}</ol>`}
    ${tab === 'incidencias' && (no ? html`<div class="list">${d.paradas.filter((p) => p.estado === 'no_entregado').map((p) => html`<div key=${p.id} class="row-item static">
      <div class="ri-main"><b>#${p.id} · ${p.direccion_entrega}</b><span class="neg small">${MOTIVOS[p.motivo_no_entrega] || 'Sin motivo'}${p.entrega_obs ? ': ' + p.entrega_obs : ''}</span>
        <span class="ri-meta">${p.cliente}${p.entregado_en ? ' · ' + fechaHora(p.entregado_en) : ''}</span></div></div>`)}</div>`
      : html`<${Empty} icon="check" title="Sin incidencias en esta ruta" />`)}
    ${tab === 'historial' && html`<div class="timeline">${d.eventos.map((e) => html`<div key=${e.id} class=${'tl ' + (e.evento.includes('no_entregado') || e.evento === 'cancelada' ? 'no' : e.evento.includes('entregado') || e.evento === 'finalizada' ? 'ok' : '')}>
      <span class="tl-dot"></span><div><b>${EVENTOS[e.evento] || e.evento}${e.pedido_id ? ' #' + e.pedido_id : ''}${e.evento === 'tomada' || e.evento === 'reasignada' ? ' ' + nombreUsuario(e.detalle.ahora) : ''}</b>
        <span class="muted small">${fechaHora(e.creado_en)} · ${e.usuario === 'sistema' ? 'Sistema' : nombreUsuario(e.usuario)}${e.detalle && e.detalle.motivo ? ' · ' + (MOTIVOS[e.detalle.motivo] || e.detalle.motivo) : ''}</span></div></div>`)}
      ${!d.eventos.length && html`<${Empty} icon="history" title="Sin cambios registrados todavía" />`}</div>`}
    ${dlg && dlg.t === 'dano' && html`<${ReportarDano} ruta=${ru} paradas=${d.paradas} onClose=${() => setDlg(null)} onListo=${() => { setDlg(null); r.reload(); }} />`}
    ${dlg && dlg.t !== 'dano' && html`<${Modal} title=${dlg.t === 'cancelar' ? 'Cancelar ruta R-' + ru.id : dlg.t === 'liberar' ? 'Liberar ruta R-' + ru.id : 'Finalizar ruta R-' + ru.id} onClose=${() => setDlg(null)}
      footer=${html`<button class="btn ghost" onClick=${() => setDlg(null)}>Volver</button><${AsyncButton} className=${'btn ' + (dlg.t === 'cancelar' ? 'danger' : 'primary')} icon="check" onClick=${accionRuta}>Sí, continuar<//>`}>
      <p>${dlg.t === 'cancelar' ? 'Los pedidos que aún no se han entregado vuelven a quedar disponibles para otra ruta. Los entregados y los no entregados conservan su historial en esta ruta.'
        : dlg.t === 'liberar' ? 'La ruta deja de estar asignada a ' + (repNombre || 'el repartidor') + ' y vuelve a quedar disponible para que otro la tome.' : 'Todas las paradas tienen resultado. La ruta quedará como finalizada.'}</p>
      ${dlg.t === 'cancelar' && html`<${Field} label="Motivo (opcional)"><input class="input" value=${dlg.motivo} onInput=${(e) => setDlg({ ...dlg, motivo: e.target.value })} /><//>`}
    <//>`}
  <//>`;
}

/* ---------- Pedidos por estado de asignación ---------- */
const GRUPOS = [
  ['disponibles', 'Disponibles', 'green', 'Sin ruta: se pueden usar para planear rutas.'],
  ['asignados', 'Asignados', 'blue', 'En una ruta que aún no sale.'],
  ['proceso', 'En proceso', 'violet', 'En una ruta en recorrido.'],
  ['incidencias', 'Incidencias', 'red', 'No se pudieron entregar: reprográmalos o cancélalos.'],
  ['finalizados', 'Finalizados', 'gray', 'Entregados o cancelados.']
];
function PedidosEstado({ onRuta, onPlanear }) {
  const [dia, setDia] = useState(hoyISO());
  const [g, setG] = useState('disponibles');
  const [buscar, setBuscar] = useState('');
  const [sel, setSel] = useState([]);
  const [dlg, setDlg] = useState(null);
  const r = useAsync(async () => {
    const [pedidos, rutas, reps] = await Promise.all([
      q(sb.from('v_entregas').select('id,estado,cliente,direccion_entrega,barrio,municipio,canastas,items,ruta_id,repartidor,entregado_en,motivo_no_entrega,lat,lng').eq('fecha_entrega', dia).order('id')),
      q(sb.from('rutas').select('id,nombre,estado,repartidor').eq('fecha', dia)),
      q(sb.from('administradores').select('email,nombre,usuario,capacidad_canastas').eq('rol', 'repartidor').eq('activo', true).order('usuario'))
    ]);
    return { pedidos, rutas, reps };
  }, [dia]);
  const grupo = (p, rutas) => {
    const ru = p.ruta_id && rutas.find((x) => x.id === p.ruta_id);
    if (p.estado === 'no_entregado') return 'incidencias';
    if (['entregado', 'cancelado'].includes(p.estado)) return 'finalizados';
    if (!p.ruta_id) return 'disponibles';
    return ru && ru.estado === 'en_curso' ? 'proceso' : 'asignados';
  };
  const d = r.data;
  const todos = d ? d.pedidos.map((p) => ({ ...p, grupo: grupo(p, d.rutas), ruta: d.rutas.find((x) => x.id === p.ruta_id) })) : [];
  const lista = todos.filter((p) => p.grupo === g && (!buscar || norm([p.id, p.cliente, p.direccion_entrega, p.barrio].join(' ')).includes(norm(buscar))));
  const repNombre = (e) => { const a = d && d.reps.find((x) => x.email === e); return a ? a.nombre || a.usuario : nombreUsuario(e); };
  const crear = async () => {
    const ps = todos.filter((p) => sel.includes(p.id));
    const id = await q(sb.rpc('panel_guardar_ruta', { p_ruta: null, p_fecha: dia, p_repartidor: dlg.rep || null, p_origen_texto: leerOrigen().texto || null, p_origen_lat: leerOrigen().lat || null,
      p_origen_lng: leerOrigen().lng || null, p_volver: true, p_paradas: ps.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, minutos: null })) }));
    toast('Ruta R-' + id + ' creada ' + (dlg.rep ? 'y asignada a ' + repNombre(dlg.rep) : 'como disponible') + ' con ' + ps.length + ' pedido(s)');
    setDlg(null); setSel([]); r.reload();
  };
  useEffect(() => setSel([]), [g, dia]);
  return html`<div class="stack">
    <div class="toolbar wrap-mobile">
      <input class="input auto" type="date" value=${dia} onInput=${(e) => setDia(e.target.value)} aria-label="Día de entrega" />
      <${SearchBox} value=${buscar} onInput=${setBuscar} placeholder="Buscar pedido, cliente o dirección" />
    </div>
    <div class="grupos">${GRUPOS.map(([k, l, tone]) => html`<button key=${k} class=${'grupo ' + tone + (g === k ? ' on' : '')} onClick=${() => setG(k)}><b>${todos.filter((p) => p.grupo === k).length}</b><span>${l}</span></button>`)}</div>
    <p class="muted small">${(GRUPOS.find((x) => x[0] === g) || [])[3]}</p>
    <${ErrorBox} error=${r.error} onRetry=${r.reload} />
    ${g === 'incidencias' ? html`<${NoEntregados} />` : !d ? html`<${Loader} rows=${5} />` : !lista.length ? html`<${Card}><${Empty} icon="pedidos" title="No hay pedidos en este grupo" /><//>` : html`
      <${Card} pad=${false}>
        ${g === 'disponibles' && html`<div class="sel-bar"><label class="chk"><input type="checkbox" checked=${sel.length === lista.length} onChange=${() => setSel(sel.length === lista.length ? [] : lista.map((p) => p.id))} />Elegir todos</label>
          <span class="muted small">${sel.length} elegido(s) · ${num(sum(todos.filter((p) => sel.includes(p.id)), 'canastas'))} canastas</span>
          <button class="btn sm primary" disabled=${!sel.length} onClick=${() => setDlg({ rep: '' })}><${Icon} n="route" size=${14} />Crear ruta</button>
          <button class="btn sm ghost" onClick=${onPlanear}><${Icon} n="spark" size=${14} />Repartir entre repartidores</button></div>`}
        <div class="list">${lista.map((p) => html`<div key=${p.id} class=${'row-item static ped-row ' + p.grupo}>
          ${g === 'disponibles' && html`<input type="checkbox" class="chk-big" checked=${sel.includes(p.id)} onChange=${() => setSel(sel.includes(p.id) ? sel.filter((x) => x !== p.id) : [...sel, p.id])} aria-label=${'Elegir pedido ' + p.id} />`}
          <div class="ri-main"><b class="dir-main">#${p.id} · ${p.direccion_entrega}</b><span class="dir-sub">${[p.barrio, p.municipio].filter(Boolean).join(' · ')}</span>
            <span class="ri-meta">${p.cliente} · ${(p.items || []).map((it) => it.cantidad + ' ' + it.producto).join(', ')}</span></div>
          <div class="row-btns">
            ${p.ruta ? html`<button class="btn sm ghost" onClick=${() => onRuta(p.ruta.id)}><${Icon} n="route" size=${13} />R-${p.ruta.id} · ${p.ruta.repartidor ? repNombre(p.ruta.repartidor) : 'disponible'}</button>` : g === 'disponibles' ? html`<${Badge} tone="green">Disponible<//>` : null}
            <${EstadoBadge} e=${p.estado} /></div>
        </div>`)}</div>
      <//>`}
    ${dlg && html`<${Modal} title=${'Crear ruta con ' + sel.length + ' pedido(s)'} onClose=${() => setDlg(null)}
      footer=${html`<button class="btn ghost" onClick=${() => setDlg(null)}>Cancelar</button><${AsyncButton} className="btn primary" icon="check" onClick=${crear}>Crear ruta<//>`}>
      <${Field} label="Repartidor" hint="Si la dejas disponible, cualquier repartidor podrá tomarla desde su celular.">
        <select class="input" value=${dlg.rep} onChange=${(e) => setDlg({ ...dlg, rep: e.target.value })}><option value="">Disponible (sin repartidor)</option>
          ${d.reps.map((x) => { const otra = d.rutas.find((ru) => ru.repartidor === x.email && ['planeada', 'en_curso'].includes(ru.estado));
            return html`<option value=${x.email} disabled=${!!otra}>${x.nombre || x.usuario}${otra ? ' · ya tiene R-' + otra.id : ''}</option>`; })}</select><//>
      <p class="muted small">Después puedes ordenarla en "Planear" o el repartidor la ordena desde su celular.</p>
    <//>`}
  </div>`;
}

/* ---------- Panel de control en vivo ---------- */
const senal = (ru) => {
  if (ru.estado !== 'en_curso') return null;
  if (!ru.ultima_ubicacion_en) return ['no', 'Sin ubicación: pídele abrir la app'];
  const m = Math.round((Date.now() - new Date(ru.ultima_ubicacion_en)) / 60000);
  return m <= 2 ? ['ok', 'En vivo'] : m <= 5 ? ['medio', 'Señal de hace ' + m + ' min'] : ['no', 'Sin señal hace ' + (m < 60 ? m + ' min' : Math.round(m / 60) + ' h')];
};

function EnVivo({ onVer, onPlanear, onPedidos, onRutas }) {
  const [dia, setDia] = useState(hoyISO());
  const [foco, setFoco] = useState(null);
  const [act, setAct] = useState(null);
  const r = useAsync(async () => {
    const [rutas, admins, sinRuta] = await Promise.all([
      q(sb.from('rutas').select('*').eq('fecha', dia).neq('estado', 'cancelada').order('id')),
      q(sb.from('administradores').select('email,nombre,usuario,telefono,capacidad_canastas').eq('rol', 'repartidor')),
      q(sb.from('v_entregas').select('id').eq('fecha_entrega', dia).is('ruta_id', null).in('estado', ['pendiente', 'confirmado', 'preparando']))
    ]);
    const ids = rutas.map((x) => x.id);
    const paradas = ids.length ? await q(sb.from('v_entregas').select('id,ruta_id,estado,cliente,direccion_entrega,barrio,municipio,orden_manual,canastas,lat,lng,entregado_en,motivo_no_entrega,foto_entrega,entrega_obs').in('ruta_id', ids)) : [];
    setAct(new Date());
    return { rutas, admins, paradas, sinRuta: sinRuta.length };
  }, [dia]);
  useEffect(() => { const t = setInterval(() => { if (!document.hidden) r.reload(); }, 10000); return () => clearInterval(t); }, [dia]);
  const verFoto = async (path) => { const { data, error } = await sb.storage.from('entregas').createSignedUrl(path, 300); if (error) throw new Error(error.message); window.open(data.signedUrl, '_blank', 'noopener'); };

  const d = r.data;
  const rutas = d ? d.rutas.map((ru, i) => {
    const a = d.admins.find((x) => x.email === ru.repartidor);
    const ps = d.paradas.filter((p) => p.ruta_id === ru.id).sort((x, y) => (x.orden_manual ?? 99) - (y.orden_manual ?? 99));
    const hechos = ps.filter((p) => ['entregado', 'no_entregado'].includes(p.estado));
    const actual = ps.find((p) => p.estado === 'en_camino') || ps.find((p) => ABIERTA.includes(p.estado));
    const ultima = hechos.map((p) => p.entregado_en).filter(Boolean).sort().pop();
    return { ...ru, color: COLORES_RUTA[i % COLORES_RUTA.length], nombre: a ? (a.nombre || a.usuario) : (ru.nombre || 'Ruta') + ' · disponible', telefono: a && a.telefono,
      paradas: ps, hechos, actual, ultima, ok: ps.filter((p) => p.estado === 'entregado').length, no: ps.filter((p) => p.estado === 'no_entregado').length };
  }) : [];
  const total = sum(rutas, (x) => x.paradas.length), hechos = sum(rutas, (x) => x.hechos.length);
  const enCurso = rutas.filter((x) => x.estado === 'en_curso');
  const alertas = d ? [
    ...enCurso.filter((x) => (senal(x) || [])[0] === 'no').map((x) => ({ t: 'red', i: 'nav', m: x.nombre + ': ' + senal(x)[1].toLowerCase(), id: x.id })),
    ...(sum(rutas, 'no') ? [{ t: 'red', i: 'alert', m: sum(rutas, 'no') + ' pedido(s) no entregados por reprogramar' }] : []),
    ...rutas.filter((x) => x.estado === 'planeada' && !x.repartidor).map((x) => ({ t: 'amber', i: 'truck', m: (x.nombre || 'Una ruta') + ' sigue disponible: nadie la ha tomado', id: x.id })),
    ...rutas.filter((x) => x.estado === 'planeada' && x.repartidor && !x.carga_confirmada_en).map((x) => ({ t: 'amber', i: 'box', m: x.nombre + ' aún no confirma su carga', id: x.id })),
    ...(d.sinRuta ? [{ t: 'amber', i: 'pedidos', m: d.sinRuta + ' pedido(s) sin ruta para este día', planear: true }] : [])
  ] : [];
  const actividad = d ? d.paradas.filter((p) => p.entregado_en && ['entregado', 'no_entregado'].includes(p.estado)).sort((x, y) => new Date(y.entregado_en) - new Date(x.entregado_en)).slice(0, 12) : [];

  return html`<div class="ctrl">
    <div class="ctrl-top">
      <input class="input auto" type="date" value=${dia} onInput=${(e) => { setDia(e.target.value); setFoco(null); }} aria-label="Día" />
      <span class="live-dot"><${Icon} n="live" size=${16} />En vivo${act ? ' · ' + act.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', second: '2-digit' }) : ''}</span>
      <button class="btn sm ghost" onClick=${onPlanear}><${Icon} n="truck" size=${15} />Planear rutas</button>
    </div>
    <${ErrorBox} error=${r.error} onRetry=${r.reload} />
    ${!d ? html`<${Loader} rows=${6} />` : html`
    <div class="ctrl-kpis six">
      <button class="ck" onClick=${onPedidos}><span>Disponibles para asignar</span><b>${num(d.sinRuta)}</b><small>pedidos sin ruta</small></button>
      <button class="ck" onClick=${onPedidos}><span>Pedidos asignados</span><b>${num(sum(rutas, (x) => x.paradas.filter((p) => ABIERTA.includes(p.estado)).length))}</b><small>por entregar en rutas</small></button>
      <button class="ck" onClick=${onRutas}><span>Rutas tomadas</span><b>${rutas.filter((x) => x.estado === 'planeada' && x.repartidor).length}</b><small>${rutas.filter((x) => x.estado === 'planeada' && !x.repartidor).length} disponibles sin tomar</small></button>
      <button class="ck violet" onClick=${onRutas}><span>Rutas en curso</span><b>${enCurso.length}</b><small>${total ? Math.round((hechos / total) * 100) : 0}% del día completado</small></button>
      <button class="ck ok" onClick=${onRutas}><span>Rutas finalizadas</span><b>${rutas.filter((x) => x.estado === 'terminada').length}</b><small>${num(sum(rutas, 'ok'))} entregas exitosas</small></button>
      <button class="ck no" onClick=${onPedidos}><span>Entregas con inconvenientes</span><b>${num(sum(rutas, 'no'))}</b><small>por reprogramar</small></button>
    </div>
    <div class="ctrl-main">
      <div class="ctrl-map">
        <${MapaRutas} rutas=${rutas} height="100%" foco=${foco} onFoco=${setFoco} />
        <div class="map-leyenda">${rutas.map((ru) => html`<button key=${ru.id} class=${foco === ru.id ? 'on' : ''} onClick=${() => setFoco(ru.id)}><i style=${{ background: ru.color }}></i>${ru.nombre.split(' · ')[0]}</button>`)}</div>
        ${!rutas.length && html`<div class="map-vacio"><b>No hay rutas para el ${fechaCorta(dia)}</b><button class="btn primary sm" onClick=${onPlanear}>Planear rutas</button></div>`}
      </div>
      <aside class="ctrl-side">
        ${alertas.length > 0 && html`<div class="alertas">${alertas.map((x, k) => html`<button key=${k} class=${'alerta ' + x.t} onClick=${() => x.planear ? onPlanear() : x.id && setFoco(x.id)}><${Icon} n=${x.i} size=${15} /><span>${x.m}</span></button>`)}</div>`}
        ${rutas.map((ru) => {
          const [et, tone] = estadoRuta({ ...ru, carga_confirmada: !!ru.carga_confirmada_en }), sg = senal(ru);
          const pct = ru.paradas.length ? Math.round((ru.hechos.length / ru.paradas.length) * 100) : 0;
          return html`<section key=${ru.id} class=${'rep-card ctl' + (foco === ru.id ? ' foco' : '')} style=${{ '--c': ru.color }} onClick=${() => setFoco(ru.id)}>
            <header>
              <div class="rep-avatar">${ru.nombre.slice(0, 1).toUpperCase()}${sg && html`<i class=${'sg ' + sg[0]}></i>`}</div>
              <div class="rep-info"><b>${ru.nombre}</b><span>${ru.hechos.length}/${ru.paradas.length} entregas · ${num(sum(ru.paradas, 'canastas'))} can.</span></div>
              <${Badge} tone=${tone}>${et}<//>
            </header>
            <div class="rep-prog"><div style=${{ width: pct + '%' }}></div></div>
            ${ru.estado === 'en_curso' && ru.actual && html`<div class="rep-actual"><span class="hero-kicker">${ru.actual.estado === 'en_camino' ? 'Va hacia' : 'Siguiente'} · parada ${ru.paradas.indexOf(ru.actual) + 1}</span>
              <b>${ru.actual.direccion_entrega}</b><span class="muted small">${[ru.actual.barrio, ru.actual.cliente].filter(Boolean).join(' · ')}</span></div>`}
            <div class="rep-meta">
              ${sg && html`<span class=${'sg-txt ' + sg[0]}><${Icon} n="nav" size=${13} />${sg[1]}</span>`}
              ${ru.iniciada_en && html`<span><${Icon} n="play" size=${13} />Salió ${fechaHora(ru.iniciada_en)}</span>`}
              ${ru.ultima && html`<span><${Icon} n="check" size=${13} />Última entrega ${hace(ru.ultima)}</span>`}
            </div>
            ${foco === ru.id && html`<ol class="paradas compacta">${ru.paradas.map((p, i) => html`<li key=${p.id} class=${'parada ' + p.estado}>
              <span class="num">${p.estado === 'entregado' ? '✓' : p.estado === 'no_entregado' ? '!' : i + 1}</span>
              <div class="ri-main"><b>${p.direccion_entrega}</b><span class="muted">${p.cliente}${p.estado === 'no_entregado' ? ' · ' + (MOTIVOS[p.motivo_no_entrega] || '') : ''}${p.entregado_en ? ' · ' + fechaHora(p.entregado_en) : ''}</span></div>
              ${p.foto_entrega ? html`<${AsyncButton} className="btn sm ghost" icon="external" onClick=${() => verFoto(p.foto_entrega)}>Foto<//>` : html`<${EstadoBadge} e=${p.estado} />`}
            </li>`)}</ol>`}
            <div class="rep-btns" onClick=${(e) => e.stopPropagation()}>
              <button class="btn sm" onClick=${() => onVer(ru.id)}><${Icon} n="pin" size=${15} />Abrir ruta</button>
              ${ru.telefono && html`<a class="btn sm ghost" href=${'tel:' + ru.telefono}><${Icon} n="phone" size=${15} />Llamar</a>`}
              ${ru.telefono && html`<a class="btn sm ghost" href=${whatsappLink(ru.telefono)} target="_blank" rel="noopener"><${Icon} n="chat" size=${15} />WhatsApp</a>`}
            </div>
          </section>`;
        })}
      </aside>
    </div>
    ${actividad.length > 0 && html`<${Card} title="Actividad reciente" icon="live" pad=${false}><div class="actividad">${actividad.map((p) => html`<div key=${p.id} class="act-item">
      <span class=${'act-dot ' + (p.estado === 'entregado' ? 'ok' : 'no')}></span><span class="act-hora">${new Date(p.entregado_en).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })}</span>
      <span class="act-txt"><b>${p.estado === 'entregado' ? 'Entregado' : 'No entregado'}</b> · ${p.direccion_entrega} · ${(rutas.find((x) => x.id === p.ruta_id) || {}).nombre || ''}</span></div>`)}</div><//>`}
    `}
  </div>`;
}

/* ---------- Planear rutas ---------- */
function Planear({ onVer }) {
  const fechas = useAsync(async () => {
    const r = await q(sb.from('v_entregas').select('fecha_entrega,estado').gte('fecha_entrega', isoDate(sumarDias(new Date(), -1))).limit(2000));
    return [...new Set(r.filter((x) => ABIERTA.includes(x.estado)).map((x) => x.fecha_entrega))].sort();
  }, []);
  const [dia, setDia] = useState('');
  useEffect(() => { if (!dia && fechas.data && fechas.data.length) setDia(fechas.data.includes(hoyISO()) ? hoyISO() : fechas.data[0]); }, [fechas.data]);
  const [rutaSel, setRutaSel] = useState(null);
  const [rep, setRep] = useState('');
  const [origen, setOrigen] = useState(leerOrigen());
  const [volver, setVolver] = useState(true);
  const [destino, setDestino] = useState(VACIO);
  const [lista, setLista] = useState(null);
  const [info, setInfo] = useState(null);

  const d = useAsync(async () => {
    if (!dia) return null;
    const [pedidos, rutas, reps, secretos] = await Promise.all([
      q(sb.from('v_entregas').select('*').eq('fecha_entrega', dia).order('orden_manual', { nullsFirst: false })),
      q(sb.from('rutas').select('*').eq('fecha', dia).neq('estado', 'cancelada').order('id')),
      q(sb.from('administradores').select('email,nombre,usuario,capacidad_canastas,activo,rol').eq('rol', 'repartidor').eq('activo', true).order('usuario')),
      q(sb.rpc('panel_secretos_configurados'))
    ]);
    return { pedidos, rutas, reps, google: (secretos || []).includes('google_maps_key') };
  }, [dia]);
  useEffect(() => {
    if (!d.data) return;
    if (rutaSel === null || (rutaSel !== 'nueva' && !d.data.rutas.some((x) => x.id === rutaSel))) {
      const p = d.data.rutas.find((x) => x.estado === 'planeada') || d.data.rutas[0];
      setRutaSel(p ? p.id : 'nueva');
    }
  }, [d.data]);

  const ruta = d.data && rutaSel && rutaSel !== 'nueva' ? d.data.rutas.find((x) => x.id === rutaSel) : null;
  useEffect(() => {
    setInfo(null);
    if (!d.data || rutaSel === null) return setLista(null);
    setRep(ruta ? ruta.repartidor || '' : '');
    const enRuta = ruta ? d.data.pedidos.filter((p) => p.ruta_id === ruta.id).sort((a, b) => (a.orden_manual ?? 99) - (b.orden_manual ?? 99)) : [];
    setLista(enRuta.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, minutos: p.minutos_tramo })));
    if (ruta && ruta.origen_texto) setOrigen({ texto: ruta.origen_texto, lat: ruta.origen_lat, lng: ruta.origen_lng });
    if (ruta) { setVolver(ruta.volver_origen !== false); setDestino(puntoDe(ruta, 'destino') || VACIO); }
  }, [d.data, rutaSel]);

  if (fechas.loading && !fechas.data) return html`<${Loader} rows=${5} />`;
  if (fechas.data && !fechas.data.length) return html`<${Card}><${Empty} icon="truck" title="No hay pedidos por entregar">Cuando haya pedidos con fecha de entrega aparecerán aquí.<//><//>`;

  const pedidos = d.data ? d.data.pedidos : [];
  const porId = new Map(pedidos.map((p) => [p.id, p]));
  const filas = (lista || []).map((x) => ({ ...porId.get(x.id), ...x })).filter((x) => x.cliente !== undefined);
  const enLista = new Set(filas.map((p) => p.id));
  const sinRuta = pedidos.filter((p) => !p.ruta_id && ['pendiente', 'confirmado', 'preparando'].includes(p.estado) && !enLista.has(p.id)).sort((a, b) => a.id - b.id); // primero los que llegaron antes
  const repSel = d.data ? d.data.reps.find((x) => x.email === rep) : null;
  const canastas = sum(filas, 'canastas');
  const guardadas = ruta ? pedidos.filter((p) => p.ruta_id === ruta.id).sort((a, b) => (a.orden_manual ?? 99) - (b.orden_manual ?? 99)).map((p) => p.id) : [];
  const cambiado = JSON.stringify(filas.map((p) => p.id)) !== JSON.stringify(guardadas) || !!info || (!!ruta && (ruta.repartidor || '') !== rep);
  const editable = !ruta || ruta.estado === 'planeada';
  const pendientesRuta = filas.filter((p) => ABIERTA.includes(p.estado)).length;

  const mover = (i, dlt) => { const l = [...lista]; const [x] = l.splice(i, 1); l.splice(i + dlt, 0, x); setLista(l); };
  const quitar = (id) => setLista(lista.filter((x) => x.id !== id));
  const agregar = (ps) => setLista([...(lista || []), ...ps.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, minutos: null }))]);
  const optimizar = async () => {
    if (!filas.length) throw new Error('Primero agrega pedidos a la ruta.');
    if (!origen.texto && !origen.lat) throw new Error('Escribe el punto de salida o usa tu ubicación.');
    if (!volver && !destino.texto && !destino.lat) throw new Error('Escribe el punto final o marca "El mismo punto de salida".');
    const x = (await accion({ accion: 'ruta_optimizar', fecha: dia, ids: filas.map((p) => p.id), origen, volver, destino: volver ? null : destino }));
    const data = x.data;
    setLista(data.paradas.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, minutos: p.minutos })));
    if (data.origen && data.origen.lat) setOrigen({ ...origen, lat: data.origen.lat, lng: data.origen.lng });
    if (!volver && data.destino && data.destino.lat) setDestino({ ...destino, lat: data.destino.lat, lng: data.destino.lng });
    setInfo(data);
    toast(x.mensaje);
  };
  const guardar = async (silencioso) => {
    const id = await q(sb.rpc('panel_guardar_ruta', {
      p_ruta: ruta ? ruta.id : null, p_fecha: dia, p_repartidor: rep || null, p_origen_texto: origen.texto || null, p_origen_lat: origen.lat || null, p_origen_lng: origen.lng || null,
      p_volver: volver, p_paradas: filas.map((p) => ({ id: p.id, lat: p.lat || null, lng: p.lng || null, minutos: p.minutos ?? null })),
      p_distancia_km: info ? info.distancia_km : null, p_duracion_min: info ? info.duracion_min : null,
      p_destino_texto: volver ? null : destino.texto || null, p_destino_lat: volver ? null : destino.lat || null, p_destino_lng: volver ? null : destino.lng || null
    }));
    localStorage.setItem(ORIGEN_KEY, JSON.stringify(origen));
    setInfo(null);
    if (!silencioso) toast('Ruta R-' + id + ' guardada' + (repSel ? ' y asignada a ' + (repSel.nombre || repSel.usuario) : ' como disponible'));
    setRutaSel(id); d.reload();
    return id;
  };
  const iniciar = async () => {
    let id = ruta && ruta.id;
    if (!id || cambiado) id = await guardar(true);
    const x = await accion({ accion: 'ruta_iniciar', ruta_id: id });
    toast(x.mensaje); d.reload();
  };

  return html`
    <div class="plan-top">
      <${Field} label="Día de entrega"><select class="input" value=${dia} onChange=${(e) => { setDia(e.target.value); setRutaSel(null); }}>
        ${(fechas.data || []).map((f) => html`<option value=${f}>${fechaLarga(f)}${f === hoyISO() ? ' (hoy)' : ''}</option>`)}</select><//>
    </div>
    <${ErrorBox} error=${d.error} onRetry=${d.reload} />
    ${!d.data || lista === null ? html`<${Loader} rows=${5} />` : html`
    <${Paquetes} key=${dia} dia=${dia} origen=${origen} admin=${true} onListo=${() => { setRutaSel(null); d.reload(); }} />
    <div class="section-title">Armar o ajustar una ruta a mano</div>
    <div class="ruta-chips">${d.data.rutas.map((x) => { const [et, tone] = estadoRuta({ ...x, carga_confirmada: !!x.carga_confirmada_en }); const a = d.data.reps.find((r) => r.email === x.repartidor);
      return html`<button key=${x.id} class=${'ruta-chip' + (rutaSel === x.id ? ' on' : '')} onClick=${() => setRutaSel(x.id)}><b>R-${x.id}</b><span>${a ? a.nombre || a.usuario : 'Disponible'}</span><i class=${'dot ' + tone}></i>${et}</button>`; })}
      <button class=${'ruta-chip nueva' + (rutaSel === 'nueva' ? ' on' : '')} onClick=${() => setRutaSel('nueva')}><${Icon} n="plus" size=${14} /><b>Nueva ruta</b></button></div>
    <div class="plan-top">
      <${Field} label="Repartidor de esta ruta" hint="Déjala disponible para que un repartidor la tome desde su celular, o asígnala directamente.">
        <select class="input" value=${rep} disabled=${!editable} onChange=${(e) => setRep(e.target.value)}>
          <option value="">Disponible (sin repartidor)</option>
          ${d.data.reps.map((x) => { const otra = d.data.rutas.find((r) => r.repartidor === x.email && ['planeada', 'en_curso'].includes(r.estado) && (!ruta || r.id !== ruta.id));
            return html`<option value=${x.email} disabled=${!!otra}>${x.nombre || x.usuario}${x.capacidad_canastas ? ' · hasta ' + x.capacidad_canastas + ' canastas' : ''}${otra ? ' · ya tiene R-' + otra.id : ''}</option>`; })}
        </select><//>
    </div>
    <div class="grid-2 planner">
      <div class="stack">
        <${Card} title="Puntos del recorrido" icon="home" action=${ruta && html`<${Badge} tone=${(ESTADO_RUTA[ruta.estado] || [])[1]}>${(ESTADO_RUTA[ruta.estado] || [])[0]}<//>`}>
          <${PuntosRuta} origen=${origen} setOrigen=${setOrigen} destino=${destino} setDestino=${setDestino} mismo=${volver} setMismo=${setVolver} disabled=${!editable} />
        <//>

        <${Card} title=${'Ruta · ' + filas.length + ' paradas · ' + num(canastas) + ' canastas'} icon="truck" pad=${false}
>
          ${editable && filas.length > 1 && html`<div class="card-body bo-wrap"><${BotonOrdenar} google=${d.data.google} onClick=${optimizar} /></div>`}
          ${info && html`<div class="info m"><${Icon} n="spark" size=${16} /><span>${info.metodo === 'google' ? 'Ordenada con Google Maps' : 'Orden aproximado'}${info.distancia_km ? ' · ' + num(info.distancia_km) + ' km' : ''}${info.duracion_min ? ' · ' + num(info.duracion_min) + ' min de manejo' : ''}. Revisa y guarda.${(info.avisos || []).length ? ' ' + info.avisos.join(' ') : ''}</span></div>`}
          ${repSel && repSel.capacidad_canastas && canastas > repSel.capacidad_canastas && html`<div class="warn m"><${Icon} n="alert" size=${16} />Son ${num(canastas)} canastas y la capacidad de ${repSel.nombre || repSel.usuario} es ${repSel.capacidad_canastas}.</div>`}
          ${!filas.length ? html`<${Empty} icon="truck" title="La ruta está vacía">Toca los pedidos de la lista "Por asignar" para agregarlos.<//>` :
            html`<ol class="paradas">${filas.map((p, i) => html`<li key=${p.id} class=${'parada ' + p.estado}>
              <span class="num">${p.estado === 'entregado' ? '✓' : p.estado === 'no_entregado' ? '!' : i + 1}</span>
              <div class="ri-main">
                <b class="dir-main">${p.direccion_entrega || 'Sin dirección'}</b>
                <span class="dir-sub">${[p.barrio, p.municipio].filter(Boolean).join(' · ')}</span>
                <span class="ri-meta">${p.cliente} · #${p.id} · ${num(p.canastas)} can.${p.minutos != null ? ' · ' + p.minutos + ' min' : ''}${!p.lat ? html` · <span class="warn-t">sin ubicación</span>` : ''}</span></div>
              ${editable ? html`<div class="mini-actions">
                <button class="icon-btn" aria-label="Subir" disabled=${i === 0} onClick=${() => mover(i, -1)}><${Icon} n="up2" size=${18} /></button>
                <button class="icon-btn" aria-label="Bajar" disabled=${i === filas.length - 1} onClick=${() => mover(i, 1)}><${Icon} n="down2" size=${18} /></button>
                <button class="icon-btn danger" aria-label="Quitar de la ruta" onClick=${() => quitar(p.id)}><${Icon} n="x" size=${16} /></button></div>` : html`<${EstadoBadge} e=${p.estado} />`}
            </li>`)}</ol>`}
          ${filas.length > 0 && html`<div class="card-body links-row">
            <a class="link" href=${rutaLink(filas, origen)} target="_blank" rel="noopener"><${Icon} n="external" size=${14} />Ver ruta en Google Maps</a>
            ${ruta && html`<button class="link" onClick=${() => onVer(ruta.id)}><${Icon} n="pin" size=${14} />Ver como repartidor</button>`}</div>`}
        <//>

        ${editable && sinRuta.length > 0 && html`<${Card} title=${'Por asignar · ' + sinRuta.length} icon="pedidos" pad=${false}
          action=${html`<button class="btn sm ghost" onClick=${() => agregar(sinRuta)}><${Icon} n="plus" size=${14} />Agregar todos</button>`}>
          <div class="list">${sinRuta.map((p) => html`<button key=${p.id} class="row-item" onClick=${() => agregar([p])}>
            <span class="add-ico"><${Icon} n="plus" size=${16} /></span>
            <div class="ri-main"><b class="dir-main">${p.direccion_entrega || 'Sin dirección'}</b><span class="dir-sub">${[p.barrio, p.municipio].filter(Boolean).join(' · ')}</span>
              <span class="ri-meta">${p.cliente} · #${p.id} · ${num(p.canastas)} can.</span></div></button>`)}</div>
        <//>`}
      </div>

      <div class="stack sticky-col">
        <${Card} title="Mapa" icon="pin" pad=${false}><${Mapa} origen=${origen} destino=${volver ? null : destino} paradas=${filas} height=${340} /><//>
        <${Card} title="Hoja de carga" icon="box"><${HojaCarga} paradas=${filas} /><//>
      </div>
    </div>
    <div class="action-bar">
      <div class="ab-info"><b>${filas.length} paradas · ${num(canastas)} canastas</b><span>${repSel ? (repSel.nombre || repSel.usuario) : 'Sin repartidor'}${cambiado && editable ? ' · cambios sin guardar' : ruta ? ' · ' + (ESTADO_RUTA[ruta.estado] || [])[0] : ''}</span></div>
      ${editable && html`<${AsyncButton} className="btn" icon="check" disabled=${!filas.length && !ruta} onClick=${() => guardar(false)}>Guardar<//>`}
      ${ruta && ruta.estado !== 'terminada' && pendientesRuta > 0 && rep ? html`<${AsyncButton} className="btn violet" icon="play" onClick=${iniciar}>${ruta.estado === 'en_curso' ? 'Reenviar avisos' : 'Iniciar recorrido'}<//>` :
        !ruta && filas.length > 0 && rep ? html`<${AsyncButton} className="btn violet" icon="play" onClick=${iniciar}>Guardar e iniciar<//>` : null}
    </div>`}
  `;
}

/* ---------- No entregados ---------- */
function NoEntregados() {
  const r = useAsync(() => q(sb.from('v_entregas').select('*').eq('estado', 'no_entregado').order('fecha_entrega', { ascending: false })), []);
  const [dlg, setDlg] = useState(null);
  const reprogramar = async () => {
    await q(sb.rpc('panel_reprogramar', { p_pedido: dlg.p.id, p_fecha: dlg.fecha }));
    toast('Pedido #' + dlg.p.id + ' reprogramado para el ' + fechaCorta(dlg.fecha)); setDlg(null); r.reload();
  };
  const cancelar = async () => {
    const x = await accion({ accion: 'cancelar', pedido_id: dlg.p.id, motivo: dlg.motivo });
    toast(x.mensaje || 'Pedido cancelado'); setDlg(null); r.reload();
  };
  return html`<${Card} title="Pedidos que no se pudieron entregar" icon="alert" pad=${false}>
    <${ErrorBox} error=${r.error} onRetry=${r.reload} />
    ${r.loading && !r.data ? html`<div class="card-body"><${Loader} /></div>` : (r.data || []).length === 0 ? html`<${Empty} icon="check" title="Todo al día">No hay pedidos pendientes por reprogramar.<//>` :
      html`<div class="list">${r.data.map((p) => html`<div class="row-item static wrap" key=${p.id}>
        <div class="ri-main"><b class="dir-main">${p.direccion_entrega}</b><span class="dir-sub">${[p.barrio, p.municipio].filter(Boolean).join(' · ')}</span>
          <span class="ri-meta">${p.cliente} · #${p.id} · ${fechaCorta(p.fecha_entrega)} · ${num(p.canastas)} can.</span>
          <span class="neg small">${MOTIVOS[p.motivo_no_entrega] || 'Sin motivo'}${p.entrega_obs ? ': ' + p.entrega_obs : ''}</span></div>
        <div class="row-btns">
          <button class="btn sm primary" onClick=${() => setDlg({ t: 'rep', p, fecha: isoDate(sumarDias(new Date(), 1)) })}><${Icon} n="calendar" size=${14} />Reprogramar</button>
          <button class="btn sm danger-ghost" onClick=${() => setDlg({ t: 'can', p, motivo: '' })}>Cancelar</button></div>
      </div>`)}</div>`}
    ${dlg && dlg.t === 'rep' && html`<${Modal} title=${'Reprogramar pedido #' + dlg.p.id} onClose=${() => setDlg(null)}
      footer=${html`<button class="btn ghost" onClick=${() => setDlg(null)}>Volver</button><${AsyncButton} className="btn primary" icon="calendar" onClick=${reprogramar}>Reprogramar<//>`}>
      <${Field} label="Nueva fecha de entrega"><input class="input" type="date" min=${hoyISO()} value=${dlg.fecha} onInput=${(e) => setDlg({ ...dlg, fecha: e.target.value })} /><//>
      <p class="muted">El pedido vuelve a quedar confirmado y listo para agregarlo a la ruta de ese día.</p><//>`}
    ${dlg && dlg.t === 'can' && html`<${Modal} title=${'Cancelar pedido #' + dlg.p.id} onClose=${() => setDlg(null)}
      footer=${html`<button class="btn ghost" onClick=${() => setDlg(null)}>Volver</button><${AsyncButton} className="btn danger" icon="x" onClick=${cancelar}>Sí, cancelar<//>`}>
      <p>Las canastas vuelven al inventario y le avisamos al cliente.</p>
      <${Field} label="Motivo (opcional, lo verá el cliente)"><textarea class="input" rows="2" value=${dlg.motivo} onInput=${(e) => setDlg({ ...dlg, motivo: e.target.value })}></textarea><//><//>`}
  <//>`;
}

/* =================== Vista del repartidor =================== */
function RutaActiva({ perfil, rutaId, onDisponibles }) {
  const gestor = perfil.rol !== 'repartidor';
  const r = useAsync(async () => {
    let ruta;
    if (rutaId) ruta = await q(sb.from('rutas').select('*').eq('id', rutaId).maybeSingle());
    else {
      const rs = await q(sb.from('rutas').select('*').eq('repartidor', perfil.email).in('estado', ['planeada', 'en_curso']).order('fecha'));
      ruta = rs.find((x) => x.estado === 'en_curso') || rs.find((x) => x.fecha >= hoyISO()) || rs[rs.length - 1] || null;
    }
    if (!ruta) return { ruta: null, paradas: [] };
    const paradas = await q(sb.from('v_entregas').select('*').eq('ruta_id', ruta.id).order('orden_manual', { nullsFirst: false }));
    return { ruta, paradas };
  }, [rutaId]);
  const [dlg, setDlg] = useState(null);
  const [verMapa, setVerMapa] = useState(false);
  const [nueva, setNueva] = useState(false);
  const [editarPedidos, setEditarPedidos] = useState(false);
  const [yo, setYo] = useState(null);
  const [verDanos, setVerDanos] = useState(0);

  // Mientras la ruta está en curso, el repartidor comparte su ubicación (solo con la app abierta).
  const enCurso = r.data && r.data.ruta && r.data.ruta.estado === 'en_curso' && !gestor;
  const ultimoEnvio = useRef(0);
  useEffect(() => {
    if (!enCurso || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition((p) => {
      const u = { lat: p.coords.latitude, lng: p.coords.longitude };
      setYo(u);
      if (Date.now() - ultimoEnvio.current > 15000) { ultimoEnvio.current = Date.now(); sb.rpc('panel_ubicacion', { p_lat: u.lat, p_lng: u.lng }).then(() => {}, () => {}); }
    }, () => {}, { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 });
    // Mantiene la pantalla encendida durante el recorrido para que la ubicación siga llegando.
    let lock = null;
    const pedir = () => { if (navigator.wakeLock && !document.hidden) navigator.wakeLock.request('screen').then((l) => { lock = l; }, () => {}); };
    pedir(); document.addEventListener('visibilitychange', pedir);
    return () => { navigator.geolocation.clearWatch(id); document.removeEventListener('visibilitychange', pedir); if (lock) lock.release().catch(() => {}); };
  }, [enCurso]);

  if (r.loading && !r.data) return html`<${Loader} rows=${6} />`;
  if (r.error && !r.data) return html`<${ErrorBox} error=${r.error} onRetry=${r.reload} />`;
  const { ruta, paradas } = r.data;
  if (!ruta && gestor) return html`<${Card}><${Empty} icon="truck" title="No encontramos la ruta">Puede que se haya eliminado.<//><//>`;
  if (!ruta) return html`<${Card}><${Empty} icon="route" title="No tienes una ruta activa">Toma una de las rutas disponibles o arma la tuya con pedidos libres.<//>
    <div class="center"><button class="btn primary" onClick=${onDisponibles}><${Icon} n="truck" size=${16} />Ver rutas disponibles</button></div><//>`;
  if (!gestor && editarPedidos) return html`<${TomarPedidos} perfil=${perfil} ruta=${ruta} actuales=${paradas.filter((p) => ABIERTA.includes(p.estado))}
    onListo=${() => { setEditarPedidos(false); r.reload(); }} onCancelar=${() => setEditarPedidos(false)} />`;

  const pendientes = paradas.filter((p) => ABIERTA.includes(p.estado));
  const actual = pendientes.find((p) => p.estado === 'en_camino') || pendientes[0] || null;
  const hechos = paradas.filter((p) => ['entregado', 'no_entregado'].includes(p.estado));
  const ok = paradas.filter((p) => p.estado === 'entregado').length;
  const pct = paradas.length ? Math.round((hechos.length / paradas.length) * 100) : 0;
  const origen = { lat: ruta.origen_lat, lng: ruta.origen_lng };
  const puedeMarcar = ruta.estado === 'en_curso' || gestor;
  const destino = ruta.volver_origen === false ? puntoDe(ruta, 'destino') : null;
  const registrar = async (payload) => {
    const x = await accion({ accion: 'entrega', ...payload });
    toast(x.mensaje); setDlg(null); r.reload();
    if (navigator.vibrate) navigator.vibrate(60);
  };

  return html`<div class=${'stack ruta-view' + (actual && puedeMarcar ? ' con-barra' : '')}>
    <section class="ruta-head">
      <div><span class="hero-kicker">${fechaLarga(ruta.fecha)}${gestor && ruta.repartidor ? ' · ' + nombreUsuario(ruta.repartidor) : ''}</span>
        <h2>${ruta.estado === 'terminada' ? 'Ruta terminada' : ruta.estado === 'en_curso' ? 'En recorrido' : 'Tu ruta está lista'}</h2>
        <span>${hechos.length} de ${paradas.length} paradas · ${num(sum(pendientes, 'canastas'))} canastas por entregar</span>
        ${['planeada', 'en_curso'].includes(ruta.estado) && html`<button class="btn-dano" onClick=${() => setDlg({ t: 'dano', pedido: actual && ruta.estado === 'en_curso' ? actual.id : '' })}><${Icon} n="egg" size=${16} />Huevos dañados</button>`}</div>
      <div class="ruta-ring" style=${{ '--p': pct }}><b>${pct}%</b></div>
    </section>

    ${ruta.estado === 'planeada' && pendientes.length > 0 && html`<${PrepararRuta} ruta=${ruta} pendientes=${pendientes} gestor=${gestor} onCambio=${r.reload} onPedidos=${gestor ? null : () => setEditarPedidos(true)} />`}

    ${actual ? html`<section class="parada-actual">
      <div class="pa-top"><span class="pa-num">${paradas.indexOf(actual) + 1}</span>
        <div><span class="hero-kicker">${actual.estado === 'en_camino' ? 'Vas hacia' : 'Próxima parada'}</span><h3>${actual.cliente}</h3></div>
        <${EstadoBadge} e=${actual.estado} /></div>
      <div class="pa-dirbox">
        <${Direccion} p=${actual} grande=${true} />
        <button class="icon-btn" aria-label="Copiar dirección" onClick=${() => copiar([actual.direccion_entrega, actual.barrio, actual.municipio].filter(Boolean).join(', '))}><${Icon} n="copy" /></button>
      </div>
      ${(actual.indicaciones || actual.notas) && html`<div class="pa-nota"><${Icon} n="chat" size=${16} /><span>${[actual.indicaciones, actual.notas && actual.notas !== 'PEDIDO DE PRUEBA' ? actual.notas : null].filter(Boolean).join(' · ') || actual.notas}</span></div>`}
      <div class="pa-items">${(actual.items || []).map((it) => html`<span key=${it.producto} class="chip"><b>${it.cantidad}</b> ${it.producto}</span>`)}
        ${actual.pago_estado === 'pagado' ? html`<${Badge} tone="green">Ya pagó<//>` : html`<${Badge} tone="gray">El pago lo gestiona la oficina<//>`}</div>
      <div class="pa-nav">
        <a class="btn primary" href=${navegarLink(actual)} target="_blank" rel="noopener"><${Icon} n="nav" size=${16} />Cómo llegar</a>
        <a class="btn" href=${navegarLink(actual, 'waze')} target="_blank" rel="noopener"><${Icon} n="truck" size=${16} />Waze</a>
        ${actual.telefono && html`<a class="btn" href=${'tel:' + actual.telefono}><${Icon} n="phone" size=${16} />Llamar</a>`}
        ${actual.telefono && html`<a class="btn" href=${whatsappLink(actual.telefono, 'Hola, soy el repartidor de Huevos de la Naza. Ya voy llegando con tu pedido.')} target="_blank" rel="noopener"><${Icon} n="chat" size=${16} />WhatsApp</a>`}
        <button class="btn ghost" onClick=${() => setDlg({ t: 'nota', p: actual, texto: actual.indicaciones || '' })}><${Icon} n="edit" size=${16} />Indicaciones</button>
      </div>
      ${!puedeMarcar && html`<p class="muted small center">Confirma tu carga e inicia el recorrido para poder marcar las entregas.</p>`}
    </section>` : html`<section class="fin-ruta">
      <div class="empty-ico big"><${Icon} n="check" size=${34} /></div>
      <h3>${ruta.estado === 'planeada' ? 'Ruta sin pedidos' : '¡Recorrido completo!'}</h3>
      <p>${ok} entregados${paradas.length - ok ? ' · ' + (paradas.length - ok) + ' no entregados' : ''}${ruta.iniciada_en && ruta.terminada_en ? ' · ' + Math.round((new Date(ruta.terminada_en) - new Date(ruta.iniciada_en)) / 60000) + ' min en ruta' : ''}</p>
      <p class="muted">${ruta.estado === 'planeada' ? 'Tu ruta no tiene pedidos todavía.' : '¡Buen trabajo! 🥚'}</p>
      ${ruta.estado === 'en_curso' && html`<${AsyncButton} className="btn primary" icon="check" onClick=${async () => { await q(sb.rpc('panel_finalizar_ruta', { p_ruta: ruta.id })); toast('Ruta finalizada. ¡Buen trabajo!'); r.reload(); }}>Finalizar ruta<//>`}
      ${!gestor && ruta.estado === 'planeada' && html`<button class="btn primary" onClick=${() => setEditarPedidos(true)}><${Icon} n="plus" size=${16} />Elegir pedidos</button>`}
    </section>`}

    <${Card} title="Mapa" icon="pin" pad=${false} action=${html`<button class="btn sm ghost" onClick=${() => setVerMapa(!verMapa)}>${verMapa ? 'Ocultar' : 'Mostrar'}</button>`}>
      ${verMapa && html`<${Mapa} origen=${origen} destino=${destino} paradas=${paradas} actual=${actual && actual.id} ubicacion=${yo} height=${300} />`}
    <//>

    <${Card} title=${'Paradas · ' + paradas.length} icon="pedidos" pad=${false}>
      <ol class="paradas">${paradas.map((p, i) => html`<li key=${p.id} class=${'parada ' + p.estado + (actual && p.id === actual.id ? ' actual' : '')}>
        <span class="num">${p.estado === 'entregado' ? '✓' : p.estado === 'no_entregado' ? '!' : i + 1}</span>
        <div class="ri-main"><b class="dir-main">${p.direccion_entrega || ''}</b><span class="dir-sub">${[p.barrio, p.municipio].filter(Boolean).join(' · ')}</span>
          <span class="ri-meta">${p.cliente} · ${num(p.canastas)} can.${p.estado === 'no_entregado' ? html` · <span class="neg">${MOTIVOS[p.motivo_no_entrega] || ''}</span>` : ''}</span></div>
        <${EstadoBadge} e=${p.estado} />
      </li>`)}</ol>
    <//>

    ${actual && puedeMarcar && html`<div class="entrega-bar">
      <button class="btn danger-ghost" onClick=${() => setDlg({ t: 'no', p: actual, motivo: '', detalle: '' })}><${Icon} n="x" size=${18} />No entregado</button>
      <button class="btn green" onClick=${() => setDlg({ t: 'ok', p: actual })}><${Icon} n="check" size=${18} />Entregado</button>
    </div>`}

    ${dlg && dlg.t === 'dano' && html`<${ReportarDano} ruta=${ruta} paradas=${pendientes} pedidoId=${dlg.pedido} onClose=${() => setDlg(null)} onListo=${() => { setDlg(null); setVerDanos(verDanos + 1); r.reload(); }} />`}
    ${['planeada', 'en_curso', 'terminada'].includes(ruta.estado) && html`<details class="card danos-card" open=${verDanos > 0}><summary><${Icon} n="egg" size=${16} />Huevos dañados y canastas extra</summary>
      <div class="card-body stack">${ruta.estado === 'en_curso' && html`<${ExtrasRuta} ruta=${ruta} editable=${true} onCambio=${r.reload} />`}<${DanosRuta} ruta=${ruta} admin=${gestor} version=${verDanos} /></div></details>`}
    ${dlg && dlg.t === 'ok' && html`<${EntregarModal} p=${dlg.p} ruta=${ruta} onClose=${() => setDlg(null)} onSend=${registrar} />`}
    ${dlg && dlg.t === 'no' && html`<${Modal} title="¿Qué pasó con la entrega?" onClose=${() => setDlg(null)}
      footer=${html`<button class="btn ghost" onClick=${() => setDlg(null)}>Volver</button>
        <${AsyncButton} className="btn danger" icon="x" disabled=${!dlg.motivo || (dlg.motivo === 'otro' && !dlg.detalle.trim())}
          onClick=${() => registrar({ pedido_id: dlg.p.id, resultado: 'no_entregado', motivo: dlg.motivo, detalle: dlg.detalle })}>Registrar<//>`}>
      <p class="muted">${dlg.p.cliente} · ${dlg.p.direccion_entrega}</p>
      <div class="radio-list">${Object.entries(MOTIVOS).map(([k, v]) => html`<label key=${k} class=${'radio' + (dlg.motivo === k ? ' on' : '')}>
        <input type="radio" name="motivo" checked=${dlg.motivo === k} onChange=${() => setDlg({ ...dlg, motivo: k })} />${v}</label>`)}</div>
      <${Field} label=${dlg.motivo === 'otro' ? 'Cuéntanos qué pasó' : 'Comentario (opcional)'}><textarea class="input" rows="2" value=${dlg.detalle} onInput=${(e) => setDlg({ ...dlg, detalle: e.target.value })}></textarea><//>
      <p class="muted small">Le avisamos al cliente y a la oficina, y seguimos con la siguiente parada.</p>
    <//>`}
    ${dlg && dlg.t === 'nota' && html`<${Modal} title="Indicaciones de entrega" onClose=${() => setDlg(null)}
      footer=${html`<button class="btn ghost" onClick=${() => setDlg(null)}>Cancelar</button>
        <${AsyncButton} className="btn primary" icon="check" onClick=${async () => { await q(sb.rpc('panel_indicaciones', { p_cliente: dlg.p.cliente_id, p_texto: dlg.texto })); toast('Indicaciones guardadas'); setDlg(null); r.reload(); }}>Guardar<//>`}>
      <p class="muted">${dlg.p.cliente} · ${dlg.p.direccion_entrega}</p>
      <${Field} label="Para la próxima entrega" hint="Ej.: portería de la torre 2, timbre 301."><textarea class="input" rows="3" value=${dlg.texto} onInput=${(e) => setDlg({ ...dlg, texto: e.target.value })}></textarea><//>
    <//>`}
  </div>`;
}

/* ---------- Inicio del repartidor: Mi ruta · Disponibles · Historial ---------- */
export function MiRuta({ perfil, rutaId }) {
  const [tab, setTab] = useState('ruta');
  const [k, setK] = useState(0);
  if (rutaId) return html`<${RutaActiva} perfil=${perfil} rutaId=${rutaId} />`;
  return html`<div class="stack">
    <div class="toolbar sticky-tabs"><${Tabs} value=${tab} onChange=${setTab} items=${[{ v: 'ruta', label: 'Mi ruta' }, { v: 'disponibles', label: 'Disponibles' }, { v: 'historial', label: 'Historial' }]} /></div>
    ${tab === 'ruta' && html`<${RutaActiva} key=${k} perfil=${perfil} onDisponibles=${() => setTab('disponibles')} />`}
    ${tab === 'disponibles' && html`<${TomarPedidos} perfil=${perfil} onListo=${() => { setK(k + 1); setTab('ruta'); }} />`}
    ${tab === 'historial' && html`<${HistorialRepartidor} perfil=${perfil} />`}
  </div>`;
}

function HistorialRepartidor({ perfil }) {
  const r = useAsync(() => q(sb.rpc('panel_repartidor_stats', { p_email: perfil.email, p_desde: isoDate(sumarDias(new Date(), -59)), p_hasta: hoyISO() })), []);
  const d = r.data;
  const exito = d && d.entregados + d.fallidos ? Math.round((d.entregados / (d.entregados + d.fallidos)) * 100) : null;
  return html`<div class="stack">
    <${ErrorBox} error=${r.error} onRetry=${r.reload} />
    ${!d ? html`<${Loader} rows=${4} />` : html`
      <div class="mini-kpis"><div class="ok"><b>${num(d.entregados)}</b><span>Entregados</span></div><div class="no"><b>${num(d.fallidos)}</b><span>No entregados</span></div>
        <div><b>${exito == null ? '—' : exito + '%'}</b><span>Éxito</span></div><div><b>${num(d.rutas_total)}</b><span>Rutas</span></div></div>
      <p class="muted small">Últimos 60 días.</p>
      <${Card} title="Mis rutas" icon="route" pad=${false}>${!d.rutas.length ? html`<${Empty} icon="route" title="Aún no tienes rutas" />` :
        html`<div class="list">${d.rutas.map((x) => html`<div key=${x.id} class="row-item static">
          <div class="ri-main"><b>R-${x.id} · ${fechaCorta(x.fecha)}</b><span class="ri-meta">${x.paradas} pedidos · ${x.ok} entregados${x.no ? ' · ' + x.no + ' no entregados' : ''}${x.iniciada_en && x.terminada_en ? ' · ' + Math.round((new Date(x.terminada_en) - new Date(x.iniciada_en)) / 60000) + ' min' : ''}</span></div>
          <${Badge} tone=${(ESTADO_RUTA[x.estado] || [])[1]}>${(ESTADO_RUTA[x.estado] || [])[0]}<//></div>`)}</div>`}<//>`}
  </div>`;
}

/** Antes de salir: confirmar la carga, elegir inicio y final, ordenar la ruta e iniciar. */
function PrepararRuta({ ruta, pendientes, gestor, onCambio, onPedidos }) {
  const [liberando, setLiberando] = useState(false);
  const liberar = async () => { await q(sb.rpc('panel_liberar_ruta', { p_ruta: ruta.id, p_disolver: false })); toast('Ruta liberada: vuelve a estar disponible'); setLiberando(false); onCambio(); };
  const items = new Map();
  for (const p of pendientes) for (const it of p.items || []) items.set(it.producto, (items.get(it.producto) || 0) + (Number(it.cantidad) || 0));
  const productos = [...items.entries()].sort();
  const [marcados, setMarcados] = useState(() => ruta.carga_confirmada_en ? productos.map(([k]) => k) : []);
  const [origen, setOrigen] = useState(puntoDe(ruta, 'origen') || leerOrigen());
  const [mismo, setMismo] = useState(ruta.volver_origen !== false);
  const [destino, setDestino] = useState(puntoDe(ruta, 'destino') || VACIO);
  const [google, setGoogle] = useState(true);
  const [info, setInfo] = useState(null);
  useEffect(() => { sb.rpc('panel_secretos_configurados').then(({ data }) => setGoogle((data || []).includes('google_maps_key')), () => {}); }, []);
  const cargada = !!ruta.carga_confirmada_en;
  const todo = productos.every(([k]) => marcados.includes(k));
  const marcar = (k) => setMarcados(marcados.includes(k) ? marcados.filter((x) => x !== k) : [...marcados, k]);

  const confirmar = async (si) => { await q(sb.rpc('panel_confirmar_carga', { p_ruta: ruta.id, p_confirmada: si })); if (!si) setMarcados([]); toast(si ? 'Carga confirmada' : 'Carga sin confirmar'); onCambio(); };
  const ordenar = async () => {
    if (!origen.texto && !origen.lat) throw new Error('Escribe el punto de salida o usa tu ubicación.');
    if (!mismo && !destino.texto && !destino.lat) throw new Error('Escribe el punto final o marca "El mismo punto de salida".');
    const x = await accion({ accion: 'ruta_optimizar', fecha: ruta.fecha, ids: pendientes.map((p) => p.id), origen, volver: mismo, destino: mismo ? null : destino });
    const d = x.data, o = d.origen && d.origen.lat ? { ...origen, lat: d.origen.lat, lng: d.origen.lng } : origen;
    const f = !mismo && d.destino && d.destino.lat ? { ...destino, lat: d.destino.lat, lng: d.destino.lng } : destino;
    await q(sb.rpc('panel_guardar_ruta', { p_ruta: ruta.id, p_fecha: ruta.fecha, p_repartidor: ruta.repartidor, p_origen_texto: o.texto || null, p_origen_lat: o.lat || null, p_origen_lng: o.lng || null,
      p_volver: mismo, p_paradas: d.paradas.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, minutos: p.minutos })), p_distancia_km: d.distancia_km, p_duracion_min: d.duracion_min,
      p_destino_texto: mismo ? null : f.texto || null, p_destino_lat: mismo ? null : f.lat || null, p_destino_lng: mismo ? null : f.lng || null }));
    localStorage.setItem(ORIGEN_KEY, JSON.stringify(o));
    setInfo(d); toast(x.mensaje); onCambio();
  };
  const iniciar = async () => { const x = await accion({ accion: 'ruta_iniciar', ruta_id: ruta.id }); toast(x.mensaje); onCambio(); };
  const puedeIniciar = cargada || gestor;

  return html`<section class="preparar">
    <div class=${'paso' + (cargada ? ' hecho' : ' activo')}>
      <div class="paso-head"><span class="paso-num">${cargada ? html`<${Icon} n="check" size=${16} />` : '1'}</span><div><b>Confirma tu carga</b><span>${pendientes.length} pedidos · revisa que llevas todos los productos.</span></div>
        ${onPedidos && !cargada && html`<button class="btn sm ghost paso-act" onClick=${onPedidos}><${Icon} n="edit" size=${14} />Pedidos</button>`}</div>
      ${cargada ? html`<div class="paso-ok"><span>Carga confirmada · ${num(sum(pendientes, 'canastas'))} canastas</span><button class="link" onClick=${() => confirmar(false).catch((e) => toast(e.message, 'error'))}>Deshacer</button></div>` : html`
        <div class="checklist">${productos.map(([k, v]) => html`<label key=${k} class=${'check-item' + (marcados.includes(k) ? ' on' : '')}>
          <input type="checkbox" checked=${marcados.includes(k)} onChange=${() => marcar(k)} /><span class="ci-box"><${Icon} n="check" size=${14} /></span>
          <span class="ci-txt">${k}</span><b>${num(v)}</b></label>`)}</div>
        <${ExtrasRuta} ruta=${ruta} editable=${true} onCambio=${onCambio} />
        <${AsyncButton} className="btn green block" icon="check" disabled=${!todo} onClick=${() => confirmar(true)}>${todo ? 'Confirmo que llevo todo' : 'Marca cada producto (' + marcados.length + '/' + productos.length + ')'}<//>`}
      ${cargada && totalExtras(ruta) > 0 && html`<span class="muted small">Llevas ${totalExtras(ruta)} canasta(s) extra para reponer daños.</span>`}
    </div>

    <div class="paso activo">
      <div class="paso-head"><span class="paso-num">2</span><div><b>Arma tu ruta</b><span>Elige de dónde sales y dónde terminas.</span></div></div>
      <${PuntosRuta} origen=${origen} setOrigen=${setOrigen} destino=${destino} setDestino=${setDestino} mismo=${mismo} setMismo=${setMismo} />
      <${BotonOrdenar} google=${google} onClick=${ordenar} />
      ${(info || ruta.duracion_min) && html`<div class="info"><${Icon} n="spark" size=${16} /><span>${info ? (info.metodo === 'google' ? 'Calculada con el tráfico actual' : 'Orden aproximado') : 'Ruta guardada'}
        ${(info || ruta).distancia_km ? ' · ' + num((info || ruta).distancia_km) + ' km' : ''}${(info || ruta).duracion_min ? ' · unos ' + num((info || ruta).duracion_min) + ' min de manejo' : ''}${info && (info.avisos || []).length ? '. ' + info.avisos.join(' ') : ''}</span></div>`}
    </div>

    <div class=${'paso' + (puedeIniciar ? ' activo' : ' bloqueado')}>
      <div class="paso-head"><span class="paso-num">3</span><div><b>¡A rodar!</b><span>Al iniciar, cada cliente recibe su turno y la hora aproximada de llegada.</span></div></div>
      <${AsyncButton} className="btn violet big block" icon="play" disabled=${!puedeIniciar} onClick=${iniciar}>${puedeIniciar ? 'Iniciar recorrido' : 'Primero confirma tu carga'}<//>
    </div>
    ${ruta.repartidor && html`<button class="btn ghost block" onClick=${() => setLiberando(true)}><${Icon} n="lock" size=${16} />Liberar esta ruta</button>`}
    ${liberando && html`<${Modal} title="Liberar ruta" onClose=${() => setLiberando(false)}
      footer=${html`<button class="btn ghost" onClick=${() => setLiberando(false)}>Volver</button><${AsyncButton} className="btn primary" icon="check" onClick=${liberar}>Sí, liberar<//>`}>
      <p>La ruta deja de estar a tu nombre y vuelve a quedar disponible para que la tome otro repartidor (o tú de nuevo). Podrás volver a elegir.</p><//>`}
  </section>`;
}

/** El repartidor elige los pedidos disponibles para crear o ajustar su propia ruta. */
function TomarPedidos({ perfil, ruta, actuales = [], onListo, onCancelar }) {
  const r = useAsync(() => q(sb.rpc('panel_pedidos_disponibles', { p_fecha: null })), []);
  const mia = useAsync(() => ruta || perfil.rol !== 'repartidor' ? Promise.resolve(null) : q(sb.from('rutas').select('id,fecha,estado').eq('repartidor', perfil.email).in('estado', ['planeada', 'en_curso']).limit(1)).then((x) => x[0] || null), []);
  const bloqueado = !ruta && !!mia.data;
  const fechas = r.data ? [...new Set(r.data.map((p) => p.fecha_entrega).concat(ruta ? [ruta.fecha] : []))].sort() : [];
  const [dia, setDia] = useState(ruta ? ruta.fecha : '');
  useEffect(() => { if (!dia && fechas.length) setDia(fechas.includes(hoyISO()) ? hoyISO() : fechas[0]); }, [r.data]);
  const [sel, setSel] = useState(() => actuales.map((p) => p.id));
  const lista = actuales.concat((r.data || []).filter((p) => p.fecha_entrega === dia && !p.repartidor && !p.ruta_id && !actuales.some((a) => a.id === p.id)));
  const elegidos = lista.filter((p) => sel.includes(p.id));
  const canastas = sum(elegidos, 'canastas'), cap = Number(perfil.capacidad_canastas) || 0;
  const toggle = (id) => setSel(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);
  const disponibles = lista.filter((p) => !actuales.some((a) => a.id === p.id));
  const guardar = async () => {
    if (!elegidos.length && !ruta) throw new Error('Elige al menos un pedido.');
    const o = (ruta && puntoDe(ruta, 'origen')) || leerOrigen();
    const orden = actuales.filter((p) => sel.includes(p.id)).concat(disponibles.filter((p) => sel.includes(p.id)));
    await q(sb.rpc('panel_guardar_ruta', { p_ruta: ruta ? ruta.id : null, p_fecha: ruta ? ruta.fecha : dia, p_repartidor: perfil.email, p_origen_texto: o.texto || null, p_origen_lat: o.lat || null, p_origen_lng: o.lng || null,
      p_volver: ruta ? ruta.volver_origen !== false : true, p_paradas: orden.map((p) => ({ id: p.id, lat: p.lat || null, lng: p.lng || null, minutos: null })),
      p_destino_texto: ruta ? ruta.destino_texto : null, p_destino_lat: ruta ? ruta.destino_lat : null, p_destino_lng: ruta ? ruta.destino_lng : null }));
    toast(ruta ? 'Pedidos de tu ruta actualizados' : '¡Ruta creada! Ahora confirma tu carga y ordénala.');
    onListo();
  };

  return html`<div class=${'stack ruta-view' + (bloqueado ? '' : ' con-barra')}>
    <section class="ruta-head"><div><span class="hero-kicker">${ruta ? fechaLarga(ruta.fecha) : 'Rutas disponibles'}</span>
      <h2>${ruta ? 'Pedidos de tu ruta' : 'Toma o arma tu ruta'}</h2><span>${ruta ? 'Elige los pedidos que vas a entregar.' : 'Las rutas que toma otro repartidor dejan de aparecer aquí.'}</span></div></section>
    ${bloqueado && html`<div class="info"><${Icon} n="route" size=${16} /><span>Ya tienes la ruta R-${mia.data.id} (${mia.data.estado === 'en_curso' ? 'en recorrido' : 'por iniciar'}). Para tomar otra, libérala primero en "Mi ruta".</span></div>`}
    <${ErrorBox} error=${r.error} onRetry=${r.reload} />
    ${!r.data ? html`<${Loader} rows=${5} />` : !lista.length && !fechas.length ? html`<${Card}><${Empty} icon="check" title="No hay pedidos por entregar">Cuando lleguen pedidos sin repartidor aparecerán aquí.<//>
        <div class="center"><button class="btn" onClick=${r.reload}><${Icon} n="refresh" size=${16} />Revisar de nuevo</button></div><//>` : html`
      ${!ruta && html`<${Field} label="Día de entrega"><select class="input" value=${dia} onChange=${(e) => { setDia(e.target.value); setSel([]); }}>
        ${fechas.map((f) => html`<option value=${f}>${fechaLarga(f)}${f === hoyISO() ? ' (hoy)' : ''}</option>`)}</select><//>`}
      ${!ruta && dia && html`<${Paquetes} key=${dia} dia=${dia} origen=${leerOrigen()} perfil=${perfil} bloqueado=${bloqueado} onListo=${onListo} />
        ${lista.length > 0 && !bloqueado && html`<div class="section-title">O arma tu ruta eligiendo pedidos libres</div>`}`}
      ${!bloqueado && html`<${Card} title=${lista.length + ' pedido(s) libres'} icon="pedidos" pad=${false}
        action=${lista.length > 0 && html`<button class="btn sm ghost" onClick=${() => setSel(sel.length === lista.length ? [] : lista.map((p) => p.id))}>${sel.length === lista.length ? 'Quitar todos' : 'Elegir todos'}</button>`}>
        ${!lista.length ? html`<${Empty} icon="check" title="No hay pedidos libres ese día" />` :
        html`<div class="checklist pad">${lista.map((p) => html`<label key=${p.id} class=${'check-item' + (sel.includes(p.id) ? ' on' : '')}>
          <input type="checkbox" checked=${sel.includes(p.id)} onChange=${() => toggle(p.id)} /><span class="ci-box"><${Icon} n="check" size=${14} /></span>
          <span class="ci-txt"><b class="dir-main">${p.direccion_entrega || 'Sin dirección'}</b><span class="dir-sub">${[p.barrio, p.municipio].filter(Boolean).join(' · ')}</span>
            <span class="ri-meta">${p.cliente} · #${p.id}${(p.items || []).length ? ' · ' + p.items.map((it) => it.cantidad + ' ' + it.producto).join(', ') : ''}</span></span>
          <b>${num(p.canastas)}<small class="muted"> can.</small></b></label>`)}</div>`}
      <//>`}`}
    ${!bloqueado && html`<div class="entrega-bar">
      ${onCancelar ? html`<button class="btn ghost" onClick=${onCancelar}>Cancelar</button>` : html`<div class="ab-info dark"><b>${elegidos.length} pedidos</b><span>${num(canastas)}${cap ? ' de ' + cap : ''} canastas</span></div>`}
      <${AsyncButton} className="btn primary" icon="check" disabled=${!r.data || (!ruta && !elegidos.length) || (cap > 0 && canastas > cap)} onClick=${guardar}>
        ${ruta ? 'Guardar (' + elegidos.length + ')' : 'Crear mi ruta (' + elegidos.length + ')'}<//>
    </div>`}
    ${cap > 0 && canastas > cap && html`<div class="warn"><${Icon} n="alert" size=${16} />Elegiste ${num(canastas)} canastas y tu capacidad es de ${cap}. Quita algunos pedidos para continuar.</div>`}
  </div>`;
}

function EntregarModal({ p, ruta, onClose, onSend }) {
  const [foto, setFoto] = useState(null);
  const [prev, setPrev] = useState('');
  const [detalle, setDetalle] = useState('');
  const elegir = (e) => { const f = e.target.files && e.target.files[0]; if (!f) return; setFoto(f); setPrev(URL.createObjectURL(f)); };
  const enviar = async () => {
    const [ubic, path] = await Promise.all([
      ubicacionActual(7000),
      (async () => {
        if (!foto) return null;
        const blob = await comprimirFoto(foto);
        const ruta_ = `${ruta.fecha}/${p.id}-${Date.now()}.jpg`;
        const { error } = await sb.storage.from('entregas').upload(ruta_, blob, { contentType: 'image/jpeg', upsert: false });
        if (error) throw new Error('No pudimos subir la foto. Inténtalo de nuevo o confirma sin foto.');
        return ruta_;
      })()
    ]);
    await onSend({ pedido_id: p.id, resultado: 'entregado', lat: ubic && ubic.precision < 200 ? ubic.lat : null, lng: ubic && ubic.precision < 200 ? ubic.lng : null, foto: path, detalle });
  };
  return html`<${Modal} title="Confirmar entrega" onClose=${onClose}
    footer=${html`<button class="btn ghost" onClick=${onClose}>Volver</button><${AsyncButton} className="btn green" icon="check" onClick=${enviar}>Confirmar entrega<//>`}>
    <div class="conf-head"><b>${p.cliente}</b><span class="muted">${p.direccion_entrega}</span></div>
    <div class="pa-items">${(p.items || []).map((it) => html`<span key=${it.producto} class="chip"><b>${it.cantidad}</b> ${it.producto}</span>`)}</div>
    <label class="foto-input">
      ${prev ? html`<img src=${prev} alt="Foto de la entrega" />` : html`<span><${Icon} n="download" size=${22} />Tomar foto de evidencia (opcional)</span>`}
      <input type="file" accept="image/*" capture="environment" onChange=${elegir} />
    </label>
    <${Field} label="Comentario (opcional)"><input class="input" value=${detalle} onInput=${(e) => setDetalle(e.target.value)} placeholder="Ej.: lo recibió el portero" /><//>
  <//>`;
}
