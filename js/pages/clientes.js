import { html, useState, useMemo, Icon, Card, Kpi, Tabs, SearchBox, Loader, Empty, ErrorBox, Drawer, Badge, useAsync } from '../ui.js';
import { sb, q, money, moneyShort, num, fecha, fechaHora, norm, sum, diasDesde, ABIERTOS } from '../lib.js';
import { PedidoItem, PedidoDrawer } from './pedidos.js';

export function enRiesgo(c) {
  if (!c.pedidos || c.tiene_pedido_abierto) return false;
  const d = diasDesde(c.ultimo_pedido);
  return d != null && d > Math.max(21, (c.frecuencia_dias || 14) * 1.5);
}

function ClienteDrawer({ c, onClose }) {
  const r = useAsync(async () => {
    const [pedidos, cli, fijos, convs] = await Promise.all([
      q(sb.from('v_pedidos').select('*').eq('cliente_id', c.id).order('created_at', { ascending: false })),
      q(sb.from('clientes').select('email,notas,acepta_datos,created_at').eq('id', c.id).maybeSingle()),
      q(sb.from('pedidos_fijos').select('*').eq('cliente_id', c.id).eq('activo', true)),
      q(sb.from('conversaciones').select('id').eq('cliente_id', c.id))
    ]);
    const ids = convs.map((x) => x.id);
    const mensajes = ids.length ? await q(sb.from('mensajes').select('id,rol,contenido,created_at').in('conversacion_id', ids).order('created_at', { ascending: false }).limit(30)) : [];
    return { pedidos, cli, fijos, mensajes: mensajes.reverse() };
  }, [c.id]);
  const [sel, setSel] = useState(null);
  const [verChat, setVerChat] = useState(false);
  const d = r.data;
  const dias = diasDesde(c.ultimo_pedido);

  return html`<${Drawer} title=${c.nombre || 'Cliente'} sub=${[c.barrio, c.municipio].filter(Boolean).join(', ')} onClose=${onClose}>
    <div class="detail-status">
      ${c.tiene_pedido_fijo && html`<${Badge} tone="blue"><${Icon} n="repeat" size=${12} /> Pedido fijo<//>`}
      ${enRiesgo(c) && html`<${Badge} tone="red">No compra hace ${dias} días<//>`}
      ${c.pedidos >= 3 && html`<${Badge} tone="green">Frecuente<//>`}
      ${c.recordatorios_activos === false && html`<${Badge} tone="gray">Sin recordatorios<//>`}
    </div>
    <div class="stat-row">
      <div><span>Pedidos</span><b>${num(c.pedidos)}</b></div>
      <div><span>Total comprado</span><b>${moneyShort(c.total_comprado)}</b></div>
      <div><span>Compra cada</span><b>${c.frecuencia_dias ? c.frecuencia_dias + ' d' : '—'}</b></div>
      <div><span>Último</span><b>${c.ultimo_pedido ? fecha(c.ultimo_pedido) : '—'}</b></div>
    </div>
    <div class="detail-block">
      <div class="detail-title"><${Icon} n="pin" size=${16} />Datos</div>
      <span>${c.direccion || 'Sin dirección guardada'}</span>
      <span class="muted">Escribe por ${c.canal || '—'}${d?.cli?.created_at ? ' · cliente desde ' + fecha(d.cli.created_at, { month: 'long', year: 'numeric' }) : ''}</span>
      ${d?.cli && html`<span class="muted">Autorización de datos: ${d.cli.acepta_datos ? 'sí' : 'no'}</span>`}
      ${c.ultimos_productos && html`<span class="muted">Suele pedir: ${c.ultimos_productos}</span>`}
    </div>
    ${!d ? html`<${Loader} rows=${4} />` : html`
      ${d.fijos.length > 0 && html`<div class="detail-block"><div class="detail-title"><${Icon} n="repeat" size=${16} />Pedido fijo</div>
        ${d.fijos.map((f) => html`<span key=${f.id}>${(f.items || []).map((i) => i.cantidad + '× ' + i.producto).join(', ')} · cada ${f.frecuencia_semanas} semana(s) · próximo ${fecha(f.proxima_fecha)}</span>`)}</div>`}
      <div class="detail-block flush"><div class="detail-title"><${Icon} n="pedidos" size=${16} />Historial de pedidos</div>
        ${d.pedidos.length === 0 ? html`<span class="muted">Sin pedidos.</span>` : html`<div class="list">${d.pedidos.map((p) => html`<${PedidoItem} key=${p.id} p=${p} onClick=${() => setSel(p)} />`)}</div>`}
      </div>
      <div class="detail-block"><div class="detail-title"><${Icon} n="chat" size=${16} />Conversación con el bot</div>
        ${d.mensajes.length === 0 ? html`<span class="muted">Sin mensajes guardados.</span>` : !verChat ?
          html`<button class="btn sm ghost" onClick=${() => setVerChat(true)}>Ver últimos ${d.mensajes.length} mensajes</button>` :
          html`<div class="chat">${d.mensajes.map((m) => html`<div key=${m.id} class=${'msg ' + (m.rol === 'user' ? 'in' : 'out')}><p>${m.contenido}</p><small>${fechaHora(m.created_at)}</small></div>`)}</div>`}
      </div>`}
    ${sel && html`<${PedidoDrawer} pedido=${sel} onClose=${() => setSel(null)} onChanged=${r.reload} />`}
  <//>`;
}

export function Clientes() {
  const r = useAsync(() => q(sb.from('v_clientes').select('*').order('total_comprado', { ascending: false, nullsFirst: false })), []);
  const [tab, setTab] = useState('todos');
  const [texto, setTexto] = useState('');
  const [sel, setSel] = useState(null);
  const todos = r.data || [];

  const seg = useMemo(() => ({
    todos,
    frecuentes: todos.filter((c) => c.pedidos >= 3),
    riesgo: todos.filter(enRiesgo).sort((a, b) => (b.total_comprado || 0) - (a.total_comprado || 0)),
    nuevos: todos.filter((c) => (c.pedidos || 0) <= 1),
    fijos: todos.filter((c) => c.tiene_pedido_fijo)
  }), [todos]);

  const filas = useMemo(() => {
    const t = norm(texto.trim());
    const x = seg[tab] || [];
    return t ? x.filter((c) => norm([c.nombre, c.barrio, c.municipio, c.direccion, c.ultimos_productos].join(' ')).includes(t)) : x;
  }, [seg, tab, texto]);

  const compradores = todos.filter((c) => c.pedidos > 0);
  const recurrentes = todos.filter((c) => c.pedidos >= 2).length;

  return html`<div class="stack">
    ${r.loading && !r.data ? html`<${Loader} rows=${4} />` : html`
    <div class="kpis">
      <${Kpi} icon="users" label="Clientes" value=${num(todos.length)} sub=${num(compradores.length) + ' han comprado'} />
      <${Kpi} icon="repeat" label="Vuelven a comprar" value=${compradores.length ? Math.round((recurrentes / compradores.length) * 100) + '%' : '—'} sub=${num(recurrentes) + ' con 2+ pedidos'} tone="green" />
      <${Kpi} icon="alert" label="Dejaron de comprar" value=${num(seg.riesgo.length)} sub="para recordarles" tone="red" />
      <${Kpi} icon="wallet" label="Valor por cliente" value=${moneyShort(compradores.length ? sum(compradores, 'total_comprado') / compradores.length : 0)} sub="promedio histórico" tone="violet" />
    </div>`}
    <div class="toolbar">
      <${Tabs} value=${tab} onChange=${setTab} items=${[
        { v: 'todos', label: 'Todos', n: seg.todos.length }, { v: 'frecuentes', label: 'Frecuentes', n: seg.frecuentes.length },
        { v: 'riesgo', label: 'Dejaron de comprar', n: seg.riesgo.length }, { v: 'nuevos', label: 'Nuevos', n: seg.nuevos.length },
        { v: 'fijos', label: 'Pedido fijo', n: seg.fijos.length }]} />
    </div>
    <div class="toolbar"><${SearchBox} value=${texto} onInput=${setTexto} placeholder="Buscar por nombre, barrio o producto" /></div>
    <${ErrorBox} error=${r.error} onRetry=${r.reload} />
    <${Card} pad=${false}>
      ${filas.length === 0 && !r.loading ? html`<${Empty} icon="users" title="Sin clientes en este grupo" />` :
        html`<div class="list">${filas.map((c) => html`<button key=${c.id} class="row-item" onClick=${() => setSel(c)}>
          <div class="avatar soft">${(c.nombre || '?').slice(0, 1).toUpperCase()}</div>
          <div class="ri-main"><b>${c.nombre || 'Sin nombre'}</b>
            <span class="muted">${[c.barrio, c.municipio].filter(Boolean).join(', ') || 'Sin barrio'}${c.ultimos_productos ? ' · ' + c.ultimos_productos : ''}</span>
            <span class="ri-meta">${c.pedidos || 0} pedidos<span class="dot"></span>${c.ultimo_pedido ? 'último ' + fecha(c.ultimo_pedido) : 'sin compras'}</span></div>
          <div class="ri-side"><b>${money(c.total_comprado)}</b>
            <div class="ri-badges">${enRiesgo(c) ? html`<${Badge} tone="red">${diasDesde(c.ultimo_pedido)} días sin comprar<//>` : c.tiene_pedido_abierto ? html`<${Badge} tone="blue">Pedido abierto<//>` : null}</div></div>
        </button>`)}</div>`}
    <//>
    ${sel && html`<${ClienteDrawer} c=${sel} onClose=${() => setSel(null)} />`}
  </div>`;
}
