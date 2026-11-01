import { html, useState, Icon, Card, Kpi, Contar, Loader, Empty, ErrorBox, Badge, Modal, useAsync } from '../ui.js';
import { sb, q, money, moneyShort, num, fecha, fechaLarga, fechaCorta, saludo, variacion, sum, ABIERTOS, hoyISO, groupBy } from '../lib.js';
import { PedidoItem, PedidoDrawer, EstadoBadge } from './pedidos.js';

async function cargar() {
  const hoy = hoyISO();
  const [semanas, abiertos, inventario, consolidado, pagosPend, solicitudes, zonasNR, habs, diarios] = await Promise.all([
    q(sb.from('v_ventas_semana').select('*').order('semana', { ascending: false }).limit(10)),
    q(sb.from('v_pedidos').select('*').in('estado', ABIERTOS).order('fecha_entrega')),
    q(sb.from('v_inventario').select('*').order('nombre')),
    q(sb.from('v_consolidado').select('*').gte('fecha_entrega', hoy).order('fecha_entrega')),
    q(sb.from('pagos').select('id,pedido_id,monto,created_at').eq('estado', 'pendiente')),
    q(sb.from('v_solicitudes_abiertas').select('id,tipo,cliente,created_at')),
    q(sb.from('zonas_no_reconocidas').select('id', { count: 'exact', head: false }).eq('resuelto', false).limit(200)),
    sb.rpc('panel_habilitaciones', { p_fecha: null }).then((x) => x.data || [], () => []),
    q(sb.from('v_pedidos').select('fecha_entrega,total,canastas,estado').gte('fecha_entrega', isoLunes(-9)).neq('estado', 'cancelado').limit(5000))
  ]);
  return { semanas, abiertos, inventario, consolidado, pagosPend, solicitudes, zonasNR, habs, diarios };
}

export function Inicio({ perfil }) {
  const r = useAsync(cargar, []);
  const [sel, setSel] = useState(null);
  const [det, setDet] = useState(null);
  const d = r.data;
  const nombre = (perfil?.nombre || '').split(' ')[0];

  if (r.loading && !d) return html`<div class="stack"><div class="hero skeleton-hero"></div><div class="kpis">${[1, 2, 3, 4].map((i) => html`<div class="kpi" key=${i}><${Loader} rows=${2} /></div>`)}</div></div>`;
  if (!d) return html`<${ErrorBox} error=${r.error} onRetry=${r.reload} />`;

  const actual = d.semanas[0] || {};
  const anterior = d.semanas[1] || {};
  const porCobrar = sum(d.abiertos.filter((p) => p.pago_estado !== 'pagado'), 'total');
  const proximas = [...groupBy(d.consolidado, (x) => x.fecha_entrega).entries()];
  const canastasProx = sum(d.consolidado, 'canastas');
  const proxFecha = proximas[0]?.[0];

  const alertas = [];
  for (const p of d.inventario.filter((x) => x.activo)) {
    const disp = (p.stock || 0) - (p.comprometido || 0);
    if (disp < 0) alertas.push({ tone: 'red', icon: 'alert', t: `${p.nombre}: faltan ${Math.abs(disp)} canastas para cubrir los pedidos`, href: '#/planeacion' });
    else if (disp <= 3) alertas.push({ tone: 'amber', icon: 'box', t: `${p.nombre}: quedan ${disp} disponibles`, href: '#/productos' });
    if (p.en_lista_espera > 0 && p.stock > 0) alertas.push({ tone: 'blue', icon: 'bell', t: `${p.en_lista_espera} clientes esperan ${p.nombre}`, href: '#/productos' });
  }
  const habPend = (d.habs || []).filter((x) => x.estado === 'solicitada');
  if (habPend.length) alertas.push({ tone: 'violet', icon: 'idcard', t: `${habPend.length} repartidor(es) piden ser habilitados para repartir`, href: '#/entregas' });
  if (d.pagosPend.length) alertas.push({ tone: 'amber', icon: 'wallet', t: `${d.pagosPend.length} comprobante(s) de pago por verificar`, href: '#/pedidos' });
  if (d.solicitudes.length) alertas.push({ tone: 'violet', icon: 'chat', t: `${d.solicitudes.length} caso(s) de clientes abiertos`, href: '#/negocio' });
  if (d.zonasNR.length) alertas.push({ tone: 'gray', icon: 'pin', t: `${d.zonasNR.length} barrio(s) que el bot no reconoció`, href: '#/negocio' });


  return html`<div class="stack">
    <section class="hero">
      <div class="hero-txt">
        <span class="hero-kicker">${fechaLarga(new Date())}</span>
        <h2>${saludo()}${nombre ? ', ' + nombre : ''} 👋</h2>
        <p>${proxFecha ? html`Próxima entrega <b>${fechaLarga(proxFecha)}</b>: ${num(canastasProx)} canastas por alistar.` : 'No hay entregas programadas todavía.'}</p>
      </div>
      <div class="hero-actions">
        <a class="btn primary" href="#/pedidos"><${Icon} n="pedidos" size=${16} />Ver pedidos</a>
        <a class="btn glass" href="#/planeacion"><${Icon} n="calendar" size=${16} />Planear semana</a>
      </div>
      <img class="hero-logo" src="assets/logo.png" alt="" />
    </section>

    <div class="kpis">
      <${Kpi} icon="wallet" label="Ventas esta semana" value=${moneyShort(actual.ventas)} trend=${variacion(actual.ventas, anterior.ventas)} sub="vs. semana anterior" onClick=${() => setDet('ventas')} />
      <${Kpi} icon="pedidos" label="Pedidos activos" value=${num(d.abiertos.length)} sub=${num(sum(d.abiertos, 'canastas')) + ' canastas'} tone="blue" onClick=${() => setDet('abiertos')} />
      <${Kpi} icon="truck" label="Canastas por entregar" value=${num(canastasProx)} sub=${proxFecha ? 'desde ' + fechaCorta(proxFecha) : 'sin fecha'} tone="violet" onClick=${() => setDet('canastas')} />
      <${Kpi} icon="clock" label="Por cobrar" value=${moneyShort(porCobrar)} sub="en pedidos abiertos" tone="red" onClick=${() => setDet('cobrar')} />
    </div>

    <div class="grid-2">
      <${Card} title="Ventas por semana" icon="calendar" action=${html`<button class="link" onClick=${() => setDet('ventas')}>Ver más semanas</button>`}>
        <${CalendarioVentas} semanas=${d.semanas} diarios=${d.diarios} filas=${3} />
      <//>
      <${Card} title="Pendientes" icon="bell">
        ${alertas.length === 0 ? html`<p class="todo-ok"><${Icon} n="check" size=${16} />Todo al día: no hay nada pendiente.</p>` :
          html`<div class="alerts">${alertas.map((a, i) => html`<a key=${i} class=${'alert-item ' + a.tone} href=${a.href}><span class="alert-ico"><${Icon} n=${a.icon} size=${16} /></span><span>${a.t}</span><${Icon} n="external" size=${14} /></a>`)}</div>`}
      <//>
    </div>

    <div class="grid-2">
      <${Card} title="Por alistar" icon="egg">
        ${proximas.length === 0 ? html`<${Empty} icon="egg" title="Nada por alistar" />` :
          proximas.map(([f, filas]) => html`<div class="prep" key=${f}>
            <div class="prep-head"><b>${fechaLarga(f)}</b><${Badge} tone="amber">${num(sum(filas, 'pedidos'))} pedidos<//></div>
            <div class="prep-items">${filas.map((x) => html`<div class="prep-item" key=${x.producto}><span class="egg-dot"></span><span>${x.producto}</span><b>${num(x.canastas)}</b></div>`)}</div>
          </div>`)}
      <//>
      <${Card} title="Pedidos recientes" icon="pedidos" pad=${false} action=${html`<a class="link" href="#/pedidos">Todos</a>`}>
        ${d.abiertos.length === 0 ? html`<${Empty} icon="pedidos" title="Sin pedidos abiertos" />` :
          html`<div class="list">${[...d.abiertos].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 6)
            .map((p) => html`<${PedidoItem} key=${p.id} p=${p} onClick=${() => setSel(p)} />`)}</div>`}
      <//>
    </div>
    ${det && html`<${DetalleKpi} tipo=${det} d=${d} onClose=${() => setDet(null)} onPedido=${(p) => { setDet(null); setSel(p); }} />`}
    ${sel && html`<${PedidoDrawer} pedido=${sel} onClose=${() => setSel(null)} onChanged=${r.reload} />`}
  </div>`;
}

/** Detalle de cada indicador del inicio. */
function DetalleKpi({ tipo, d, onClose, onPedido }) {
  const lista = (ps, valor) => ps.length ? html`<div class="list compacta">${ps.map((p) => html`<button key=${p.id} class="row-item" onClick=${() => onPedido(p)}>
    <div class="ri-main"><b>#${p.id} · ${p.cliente || 'Cliente'}</b><span class="ri-meta">${fechaCorta(p.fecha_entrega)} · ${num(p.canastas)} can. · ${[p.barrio, p.municipio].filter(Boolean).join(', ')}</span></div>
    <div class="row-btns"><b>${valor ? valor(p) : money(p.total)}</b><${EstadoBadge} e=${p.estado} /></div></button>`)}</div>` : html`<${Empty} icon="check" title="No hay pedidos aquí" />`;
  if (tipo === 'ventas') {
    return html`<${Modal} wide title="Ventas por semana" onClose=${onClose}>
      <${CalendarioVentas} semanas=${d.semanas} diarios=${d.diarios} filas=${10} />
      <a class="btn ghost block" href="#/estadisticas" onClick=${onClose}><${Icon} n="chart" size=${16} />Ver estadísticas completas</a>
    <//>`;
  }
  if (tipo === 'abiertos') {
    const grupos = [...groupBy(d.abiertos, (p) => p.estado).entries()];
    return html`<${Modal} wide title=${'Pedidos activos · ' + d.abiertos.length} onClose=${onClose}>
      ${grupos.map(([e, ps]) => html`<div key=${e} class="det-grupo"><div class="section-title"><${EstadoBadge} e=${e} /> ${ps.length} pedido(s) · ${num(sum(ps, 'canastas'))} canastas</div>${lista(ps)}</div>`)}
      ${!grupos.length && html`<${Empty} icon="check" title="No hay pedidos abiertos" />`}
    <//>`;
  }
  if (tipo === 'canastas') {
    const fechas = [...groupBy(d.consolidado, (x) => x.fecha_entrega).entries()];
    return html`<${Modal} title="Canastas por entregar" onClose=${onClose}>
      ${fechas.length ? fechas.map(([f, filas]) => html`<div key=${f} class="prep"><div class="prep-head"><b>${fechaLarga(f)}</b><${Badge} tone="amber">${num(sum(filas, 'canastas'))} canastas<//></div>
        <div class="prep-items">${filas.map((x) => html`<div class="prep-item" key=${x.producto}><span class="egg-dot"></span><span>${x.producto}</span><b>${num(x.canastas)}</b></div>`)}</div></div>`)
        : html`<${Empty} icon="egg" title="Nada por entregar" />`}
      <a class="btn ghost block" href="#/entregas" onClick=${onClose}><${Icon} n="truck" size=${16} />Ir a Entregas</a>
    <//>`;
  }
  const ps = d.abiertos.filter((p) => p.pago_estado !== 'pagado').sort((a, b) => (Number(b.total) || 0) - (Number(a.total) || 0));
  return html`<${Modal} wide title=${'Por cobrar · ' + money(sum(ps, 'total'))} onClose=${onClose}>
    <p class="muted small">Pedidos activos que aún no tienen el pago verificado. Toca uno para registrar el pago.</p>${lista(ps)}<//>`;
}

const corta = (d) => d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }).replace('.', '');
/** "26 oct – 1 nov" a partir del lunes de la semana. */
export function rangoSemana(lunes) {
  const a = new Date(lunes + 'T12:00:00'), b = new Date(a); b.setDate(b.getDate() + 6);
  return corta(a) + ' – ' + corta(b);
}

function isoLunes(semanas) {
  const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + semanas * 7);
  return d.toISOString().slice(0, 10);
}
const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const mayus = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const iso = (d) => d.toISOString().slice(0, 10);
const masDias = (f, n) => { const d = new Date(f + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); };

/** Ventas por semana: cada tarjeta es una semana (lunes a domingo) con su total y lo que se vendió cada día. */
function CalendarioVentas({ semanas, diarios, filas = 3 }) {
  const porDia = new Map();
  for (const p of diarios || []) { const x = porDia.get(p.fecha_entrega) || { v: 0, n: 0, c: 0 }; x.v += Number(p.total) || 0; x.n += 1; x.c += Number(p.canastas) || 0; porDia.set(p.fecha_entrega, x); }
  const porSem = new Map((semanas || []).map((s) => [s.semana, s]));
  const lunesHoy = isoLunes(0), hoy = iso(new Date(new Date().setHours(12, 0, 0, 0)));
  const lista = Array.from({ length: filas }, (_, i) => masDias(lunesHoy, -7 * i));
  const max = Math.max(1, ...lista.map((l) => Number((porSem.get(l) || {}).ventas) || 0));
  const [abierta, setAbierta] = useState(lunesHoy);
  return html`<div class="semanas">${lista.map((l, i) => {
    const s = porSem.get(l), ant = porSem.get(masDias(l, -7));
    const total = Number(s && s.ventas) || 0, t = s && ant ? variacion(s.ventas, ant.ventas) : null;
    const dias = Array.from({ length: 7 }, (_, j) => masDias(l, j));
    const conVenta = dias.filter((f) => porDia.get(f));
    const open = abierta === l;
    return html`<div key=${l} class=${'semana' + (i === 0 ? ' actual' : '') + (open ? ' abierta' : '')}>
      <button class="sem-cab" onClick=${() => setAbierta(open ? null : l)} aria-expanded=${open}>
        <span class="sem-fechas"><b>${i === 0 ? 'Esta semana' : i === 1 ? 'Semana pasada' : rangoSemana(l)}</b>${i < 2 ? html`<small>${rangoSemana(l)}</small>` : null}</span>
        <span class="sem-der"><b class="sem-valor"><${Contar} value=${money(total)} /></b>
          ${t != null ? html`<em class=${t >= 0 ? 'up' : 'down'}><${Icon} n=${t >= 0 ? 'up' : 'down'} size=${12} />${Math.abs(t)}%</em>` : html`<small>${total ? '' : 'sin ventas'}</small>`}</span>
      </button>
      <div class="sem-barra"><i style=${{ width: Math.max(total ? 3 : 0, (total / max) * 100) + '%' }}></i></div>
      <div class="sem-semana" aria-hidden="true">${dias.map((f, j) => html`<span key=${f} class=${(porDia.get(f) ? 'con' : '') + (f === hoy ? ' hoy' : '')}><small>${DIAS[j]}</small>${Number(f.slice(8))}</span>`)}</div>
      ${open && html`<div class="sem-dias">
        ${conVenta.length ? conVenta.map((f) => { const x = porDia.get(f); return html`<div key=${f} class="sem-dia">
          <span class="sd-dia">${mayus(new Date(f + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'short' }).replace('.', ''))}</span>
          <span class="sd-val">${money(x.v)}</span><span class="sd-meta">${num(x.n)} pedidos · ${num(x.c)} canastas</span></div>`; })
          : html`<p class="muted small">No hubo entregas esta semana.</p>`}
        ${s && html`<div class="sem-meta"><span><b>${num(s.pedidos)}</b> pedidos</span><span><b>${num(s.canastas)}</b> canastas</span><span>En promedio <b>${money(s.ticket_promedio)}</b> por pedido</span>${Number(s.cancelados) > 0 ? html`<span class="rojo"><b>${num(s.cancelados)}</b> ${Number(s.cancelados) === 1 ? 'cancelado' : 'cancelados'}</span>` : null}</div>`}
      </div>`}
    </div>`; })}
    <p class="cal-ayuda">Toca una semana para ver cuánto se vendió cada día.</p>
  </div>`;
}
