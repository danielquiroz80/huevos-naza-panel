import { html, useState, Icon, Card, Kpi, Bars, Loader, Empty, ErrorBox, Badge, useAsync } from '../ui.js';
import { sb, q, money, moneyShort, num, fecha, fechaLarga, fechaCorta, saludo, variacion, sum, ABIERTOS, hoyISO, groupBy } from '../lib.js';
import { PedidoItem, PedidoDrawer } from './pedidos.js';

async function cargar() {
  const hoy = hoyISO();
  const [semanas, abiertos, inventario, consolidado, pagosPend, solicitudes, zonasNR] = await Promise.all([
    q(sb.from('v_ventas_semana').select('*').order('semana', { ascending: false }).limit(10)),
    q(sb.from('v_pedidos').select('*').in('estado', ABIERTOS).order('fecha_entrega')),
    q(sb.from('v_inventario').select('*').order('nombre')),
    q(sb.from('v_consolidado').select('*').gte('fecha_entrega', hoy).order('fecha_entrega')),
    q(sb.from('pagos').select('id,pedido_id,monto,created_at').eq('estado', 'pendiente')),
    q(sb.from('v_solicitudes_abiertas').select('id,tipo,cliente,created_at')),
    q(sb.from('zonas_no_reconocidas').select('id', { count: 'exact', head: false }).eq('resuelto', false).limit(200))
  ]);
  return { semanas, abiertos, inventario, consolidado, pagosPend, solicitudes, zonasNR };
}

export function Inicio({ perfil }) {
  const r = useAsync(cargar, []);
  const [sel, setSel] = useState(null);
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
  if (d.pagosPend.length) alertas.push({ tone: 'amber', icon: 'wallet', t: `${d.pagosPend.length} comprobante(s) de pago por verificar`, href: '#/pedidos' });
  if (d.solicitudes.length) alertas.push({ tone: 'violet', icon: 'chat', t: `${d.solicitudes.length} caso(s) de clientes abiertos`, href: '#/negocio' });
  if (d.zonasNR.length) alertas.push({ tone: 'gray', icon: 'pin', t: `${d.zonasNR.length} barrio(s) que el bot no reconoció`, href: '#/negocio' });

  const barras = [...d.semanas].reverse().slice(-8).map((s, i, arr) => ({
    k: s.semana, label: fecha(s.semana), v: Number(s.ventas) || 0, hl: i === arr.length - 1,
    tip: `Semana del ${fecha(s.semana)} · ${num(s.pedidos)} pedidos`
  }));

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
      <${Kpi} icon="wallet" label="Ventas esta semana" value=${moneyShort(actual.ventas)} trend=${variacion(actual.ventas, anterior.ventas)} sub="vs. semana anterior" />
      <${Kpi} icon="pedidos" label="Pedidos abiertos" value=${num(d.abiertos.length)} sub=${num(sum(d.abiertos, 'canastas')) + ' canastas'} tone="blue" />
      <${Kpi} icon="truck" label="Canastas por entregar" value=${num(canastasProx)} sub=${proxFecha ? 'desde ' + fechaCorta(proxFecha) : 'sin fecha'} tone="violet" />
      <${Kpi} icon="clock" label="Por cobrar" value=${moneyShort(porCobrar)} sub="en pedidos abiertos" tone="red" />
    </div>

    <div class="grid-2">
      <${Card} title="Ventas por semana" icon="chart" action=${html`<a class="link" href="#/estadisticas">Ver más</a>`}>
        <${Bars} data=${barras} />
        <div class="mini-stats">
          <div><span>Ticket promedio</span><b>${money(actual.ticket_promedio)}</b></div>
          <div><span>Canastas</span><b>${num(actual.canastas)}</b></div>
          <div><span>Cancelados</span><b>${num(actual.cancelados)}</b></div>
        </div>
      <//>
      <${Card} title="Pendientes" icon="bell">
        ${alertas.length === 0 ? html`<${Empty} icon="check" title="Todo al día">No hay alertas por ahora.<//>` :
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
    ${sel && html`<${PedidoDrawer} pedido=${sel} onClose=${() => setSel(null)} onChanged=${r.reload} />`}
  </div>`;
}
