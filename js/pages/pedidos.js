import { html, useState, useMemo, Icon, Badge, Card, Tabs, SearchBox, Loader, Empty, ErrorBox, Drawer, Modal, Field, AsyncButton, useAsync, toast } from '../ui.js';
import { sb, q, money, num, fecha, fechaCorta, fechaHora, fechaLarga, ESTADOS, PAGOS, ABIERTOS, METODOS, MOTIVOS, norm, sum, mapsLink, rutaLink, accion, hoyISO, isoDate, sumarDias } from '../lib.js';

export function EstadoBadge({ e }) { const x = ESTADOS[e] || { label: e, tone: 'gray' }; return html`<${Badge} tone=${x.tone}>${x.label}<//>`; }
export function PagoBadge({ e }) { const x = PAGOS[e] || { label: e || '—', tone: 'gray' }; return html`<${Badge} tone=${x.tone}>${x.label}<//>`; }

export function PedidoItem({ p, onClick }) {
  return html`<button class="row-item" onClick=${onClick}>
    <div class="ri-id">#${p.id}</div>
    <div class="ri-main">
      <b>${p.cliente || 'Cliente'}</b>
      <span class="muted">${p.productos || '—'}</span>
      <span class="ri-meta"><${Icon} n="calendar" size=${13} />${fechaCorta(p.fecha_entrega)}<span class="dot"></span><${Icon} n="pin" size=${13} />${[p.barrio, p.municipio].filter(Boolean).join(', ') || 'Sin barrio'}</span>
    </div>
    <div class="ri-side">
      <b>${money(p.total)}</b>
      <div class="ri-badges"><${EstadoBadge} e=${p.estado} /><${PagoBadge} e=${p.pago_estado} /></div>
    </div>
  </button>`;
}

/* ---------- Detalle de pedido con acciones ---------- */
export function PedidoDrawer({ pedido, onClose, onChanged }) {
  const p = pedido;
  const pagos = useAsync(() => q(sb.from('pagos').select('*').eq('pedido_id', p.id).order('created_at', { ascending: false })), [p.id]);
  const [dlg, setDlg] = useState(null);
  const items = Array.isArray(p.items) ? p.items : [];
  const pagado = sum((pagos.data || []).filter((x) => x.estado === 'verificado'), 'monto');
  const pendientesComprobante = (pagos.data || []).filter((x) => x.estado === 'pendiente');
  const abierto = ABIERTOS.includes(p.estado);

  const ejecutar = async (payload, okMsg) => {
    const r = await accion(payload);
    toast(r.mensaje || okMsg);
    setDlg(null);
    onChanged && onChanged();
    onClose();
  };

  return html`<${Drawer} title=${'Pedido #' + p.id} sub=${'Creado ' + fechaHora(p.created_at)} onClose=${onClose}
    footer=${abierto || p.pago_estado !== 'pagado' ? html`<div class="actions-grid">
      ${['pendiente', 'confirmado', 'preparando'].includes(p.estado) && html`<button class="btn violet" onClick=${() => setDlg({ t: 'encamino' })}><${Icon} n="truck" size=${16} />En camino</button>`}
      ${p.estado === 'en_camino' && html`<button class="btn green" onClick=${() => setDlg({ t: 'entregado' })}><${Icon} n="check" size=${16} />Entregado</button>`}
      ${p.estado === 'no_entregado' && html`<button class="btn primary" onClick=${() => setDlg({ t: 'reprogramar', fecha: isoDate(sumarDias(new Date(), 1)) })}><${Icon} n="calendar" size=${16} />Reprogramar</button>`}
      ${p.estado !== 'cancelado' && p.pago_estado !== 'pagado' && html`<button class="btn" onClick=${() => setDlg({ t: 'pago', monto: Math.max(0, (Number(p.total) || 0) - pagado), metodo: p.metodo_pago && METODOS.includes(p.metodo_pago) ? p.metodo_pago : 'efectivo' })}><${Icon} n="wallet" size=${16} />Registrar pago</button>`}
      ${abierto && html`<button class="btn danger-ghost" onClick=${() => setDlg({ t: 'cancelar', motivo: '' })}><${Icon} n="x" size=${16} />Cancelar</button>`}
    </div>` : null}>

    <div class="detail-status"><${EstadoBadge} e=${p.estado} /><${PagoBadge} e=${p.pago_estado} />
      ${p.origen === 'pedido_fijo' && html`<${Badge} tone="gray"><${Icon} n="repeat" size=${12} /> Pedido fijo<//>`}
      ${p.puede_modificar && html`<${Badge} tone="gray">Modificable hasta ${fechaHora(p.limite_modificacion)}<//>`}
      <button class="btn sm ghost cambiar-estado" onClick=${() => setDlg({ t: 'estado', estado: '', nota: '' })}><${Icon} n="edit" size=${14} />Cambiar estado</button>
    </div>

    ${p.estado === 'no_entregado' && html`<div class="warn"><${Icon} n="alert" size=${16} />No se entregó: ${MOTIVOS[p.motivo_no_entrega] || 'sin motivo'}. Reprográmalo o cancélalo.</div>`}
    <div class="detail-block">
      <div class="detail-title"><${Icon} n="users" size=${16} />Cliente</div>
      <b>${p.cliente || '—'}</b>
      <span class="muted">${p.canal_contacto ? 'Escribe por ' + p.canal_contacto : ''}</span>
    </div>

    <div class="detail-block">
      <div class="detail-title"><${Icon} n="pin" size=${16} />Entrega</div>
      <b>${fechaLarga(p.fecha_entrega)}</b>
      <span>${p.direccion_entrega || 'Sin dirección'}</span>
      <span class="muted">${[p.barrio, p.municipio].filter(Boolean).join(', ')}</span>
      <a class="link" href=${mapsLink(p)} target="_blank" rel="noopener"><${Icon} n="external" size=${14} />Abrir en Google Maps</a>
    </div>

    <div class="detail-block">
      <div class="detail-title"><${Icon} n="egg" size=${16} />Productos</div>
      <div class="lines">
        ${items.map((it, i) => html`<div class="line" key=${i}><span><b>${it.cantidad}×</b> ${it.producto}</span></div>`)}
        <div class="line sep"><span>Productos</span><span>${money(p.subtotal_productos)}</span></div>
        <div class="line"><span>Domicilio</span><span>${Number(p.costo_domicilio) ? money(p.costo_domicilio) : 'Sin costo'}</span></div>
        <div class="line total"><span>Total</span><span>${money(p.total)}</span></div>
      </div>
      ${p.notas && html`<p class="note"><${Icon} n="chat" size=${14} />${p.notas}</p>`}
    </div>

    <div class="detail-block">
      <div class="detail-title"><${Icon} n="wallet" size=${16} />Pagos ${p.metodo_pago && html`<span class="muted">· prefiere ${p.metodo_pago}</span>`}</div>
      ${pagos.loading && !pagos.data ? html`<${Loader} rows=${2} />` : (pagos.data || []).length === 0 ? html`<span class="muted">Sin pagos registrados.</span>` :
        html`<div class="lines">${pagos.data.map((x) => html`<div class="line" key=${x.id}>
          <span><b>${money(x.monto)}</b> · ${x.metodo}<br /><small class="muted">${fechaHora(x.created_at)}${x.comprobante_file_id ? ' · con comprobante' : ''}</small></span>
          <${Badge} tone=${x.estado === 'verificado' ? 'green' : x.estado === 'pendiente' ? 'amber' : 'red'}>${x.estado}<//>
        </div>`)}</div>`}
      ${pendientesComprobante.length > 0 && html`<button class="btn sm block" onClick=${() => setDlg({ t: 'verificar' })}><${Icon} n="check" size=${15} />Verificar comprobante pendiente</button>`}
    </div>

    ${dlg && dlg.t === 'estado' && html`<${Modal} title=${'Cambiar estado del pedido #' + p.id} onClose=${() => setDlg(null)}
      footer=${html`<button class="btn ghost" onClick=${() => setDlg(null)}>Volver</button>
      <${AsyncButton} className="btn primary" icon="check" disabled=${!dlg.estado} onClick=${async () => {
        await q(sb.rpc('panel_cambiar_estado', { p_pedido: p.id, p_estado: dlg.estado, p_nota: dlg.nota || null }));
        toast('Pedido #' + p.id + ' ahora está ' + (ESTADOS[dlg.estado] || {}).label.toLowerCase()); setDlg(null); onChanged && onChanged(); onClose();
      }}>Guardar estado<//>`}>
      <p class="muted small">Estado actual: <${EstadoBadge} e=${p.estado} />. Úsalo para corregir errores. Este cambio <b>no le avisa al cliente</b>; para avisarle usa los botones de abajo (En camino, Entregado, Cancelar).</p>
      <div class="estado-opciones">${Object.entries(ESTADOS).filter(([k]) => k !== p.estado).map(([k, x]) => html`<button key=${k} class=${'estado-op ' + x.tone + (dlg.estado === k ? ' on' : '')} onClick=${() => setDlg({ ...dlg, estado: k })}>${x.label}</button>`)}</div>
      ${dlg.estado === 'cancelado' && html`<p class="warn small">Las canastas vuelven al inventario.</p>`}
      ${p.estado === 'cancelado' && dlg.estado && html`<p class="info small">Al reactivarlo se vuelven a descontar las canastas del inventario.</p>`}
      ${['pendiente', 'confirmado', 'preparando'].includes(dlg.estado) && html`<p class="muted small">Si su ruta ya terminó o fue cancelada, el pedido queda disponible para planear otra ruta.</p>`}
      <${Field} label="Nota (opcional)"><input class="input" value=${dlg.nota} onInput=${(e) => setDlg({ ...dlg, nota: e.target.value })} placeholder="Ej.: se marcó entregado por error" /><//>
    <//>`}

    ${dlg && dlg.t === 'encamino' && html`<${Modal} title="¿Marcar en camino?" onClose=${() => setDlg(null)}
      footer=${html`<button class="btn ghost" onClick=${() => setDlg(null)}>Volver</button>
      <${AsyncButton} className="btn violet" icon="truck" onClick=${() => ejecutar({ accion: 'encamino', pedido_id: p.id }, 'Pedido en camino')}>Sí, en camino<//>`}>
      <p>Se le avisa a <b>${p.cliente}</b> que su pedido va en camino.</p><//>`}

    ${dlg && dlg.t === 'entregado' && html`<${Modal} title="¿Marcar entregado?" onClose=${() => setDlg(null)}
      footer=${html`<button class="btn ghost" onClick=${() => setDlg(null)}>Volver</button>
      <${AsyncButton} className="btn green" icon="check" onClick=${() => ejecutar({ accion: 'entregado', pedido_id: p.id }, 'Pedido entregado')}>Sí, entregado<//>`}>
      <p>Se marca como entregado y se avisa al siguiente cliente de la ruta.</p><//>`}

    ${dlg && dlg.t === 'cancelar' && html`<${Modal} title=${'Cancelar pedido #' + p.id} onClose=${() => setDlg(null)}
      footer=${html`<button class="btn ghost" onClick=${() => setDlg(null)}>Volver</button>
      <${AsyncButton} className="btn danger" icon="x" onClick=${() => ejecutar({ accion: 'cancelar', pedido_id: p.id, motivo: dlg.motivo }, 'Pedido cancelado')}>Cancelar pedido<//>`}>
      <p>El stock vuelve al inventario y se le avisa al cliente.</p>
      <${Field} label="Motivo (opcional, lo ve el cliente)"><textarea class="input" rows="3" value=${dlg.motivo} onInput=${(e) => setDlg({ ...dlg, motivo: e.target.value })}></textarea><//><//>`}

    ${dlg && dlg.t === 'reprogramar' && html`<${Modal} title=${'Reprogramar pedido #' + p.id} onClose=${() => setDlg(null)}
      footer=${html`<button class="btn ghost" onClick=${() => setDlg(null)}>Volver</button>
      <${AsyncButton} className="btn primary" icon="calendar" onClick=${async () => { await q(sb.rpc('panel_reprogramar', { p_pedido: p.id, p_fecha: dlg.fecha })); toast('Pedido reprogramado'); setDlg(null); onChanged && onChanged(); onClose(); }}>Reprogramar<//>`}>
      <${Field} label="Nueva fecha de entrega"><input class="input" type="date" min=${hoyISO()} value=${dlg.fecha} onInput=${(e) => setDlg({ ...dlg, fecha: e.target.value })} /><//><//>`}

    ${dlg && dlg.t === 'verificar' && html`<${Modal} title="Verificar comprobante" onClose=${() => setDlg(null)}
      footer=${html`<button class="btn ghost" onClick=${() => setDlg(null)}>Volver</button>
      <${AsyncButton} className="btn green" icon="check" onClick=${() => ejecutar({ accion: 'pago_verificar', pedido_id: p.id }, 'Pago verificado')}>Confirmar que llegó el dinero<//>`}>
      <p>Confirma solo si ya viste el dinero en la cuenta. El comprobante llegó por el chat del bot.</p><//>`}

    ${dlg && dlg.t === 'pago' && html`<${Modal} title=${'Registrar pago · pedido #' + p.id} onClose=${() => setDlg(null)}
      footer=${html`<button class="btn ghost" onClick=${() => setDlg(null)}>Volver</button>
      <${AsyncButton} className="btn primary" icon="wallet" disabled=${!(Number(dlg.monto) > 0)}
        onClick=${() => ejecutar({ accion: 'pago_registrar', pedido_id: p.id, monto: Math.round(Number(dlg.monto)), metodo: dlg.metodo }, 'Pago registrado')}>Registrar ${money(dlg.monto)}<//>`}>
      <div class="form-grid">
        <${Field} label="Monto recibido"><input class="input" type="number" min="0" step="500" value=${dlg.monto} onInput=${(e) => setDlg({ ...dlg, monto: e.target.value })} /><//>
        <${Field} label="Método"><select class="input" value=${dlg.metodo} onChange=${(e) => setDlg({ ...dlg, metodo: e.target.value })}>
          ${METODOS.map((m) => html`<option value=${m}>${m}</option>`)}</select><//>
      </div>
      <p class="muted">Total del pedido ${money(p.total)} · ya verificado ${money(pagado)}</p><//>`}
  <//>`;
}

/* ---------- Página ---------- */
export function Pedidos() {
  const [tab, setTab] = useState('abiertos');
  const [texto, setTexto] = useState('');
  const [dia, setDia] = useState('');
  const [sel, setSel] = useState(null);
  const r = useAsync(() => q(sb.from('v_pedidos').select('*').order('created_at', { ascending: false }).limit(1000)), []);
  const todos = r.data || [];

  const cuenta = useMemo(() => ({
    abiertos: todos.filter((p) => ABIERTOS.includes(p.estado)).length,
    por_cobrar: todos.filter((p) => p.estado !== 'cancelado' && p.pago_estado !== 'pagado').length,
    entregados: todos.filter((p) => p.estado === 'entregado').length,
    cancelados: todos.filter((p) => p.estado === 'cancelado').length,
    todos: todos.length
  }), [todos]);

  const fechas = useMemo(() => [...new Set(todos.filter((p) => ABIERTOS.includes(p.estado) && p.fecha_entrega).map((p) => p.fecha_entrega))].sort(), [todos]);

  const filas = useMemo(() => {
    let x = todos;
    if (tab === 'abiertos') x = x.filter((p) => ABIERTOS.includes(p.estado));
    else if (tab === 'por_cobrar') x = x.filter((p) => p.estado !== 'cancelado' && p.pago_estado !== 'pagado');
    else if (tab === 'entregados') x = x.filter((p) => p.estado === 'entregado');
    else if (tab === 'cancelados') x = x.filter((p) => p.estado === 'cancelado');
    if (dia) x = x.filter((p) => p.fecha_entrega === dia);
    const t = norm(texto.trim());
    if (t) x = x.filter((p) => norm([p.id, p.cliente, p.productos, p.barrio, p.municipio, p.direccion_entrega].join(' ')).includes(t));
    if (tab === 'abiertos') x = [...x].sort((a, b) => String(a.fecha_entrega).localeCompare(String(b.fecha_entrega)) || (a.orden_manual ?? 999) - (b.orden_manual ?? 999));
    return x;
  }, [todos, tab, dia, texto]);

  const ruta = useAsync(() => dia ? q(sb.from('v_ruta').select('orden,id,direccion_entrega,barrio,municipio,estado').eq('fecha_entrega', dia).order('orden')) : Promise.resolve([]), [dia]);
  const linkRuta = dia && ruta.data ? rutaLink(ruta.data.filter((p) => ['confirmado', 'preparando', 'en_camino', 'pendiente'].includes(p.estado))) : null;

  return html`<div class="stack">
    <div class="toolbar">
      <${Tabs} value=${tab} onChange=${setTab} items=${[
        { v: 'abiertos', label: 'Abiertos', n: cuenta.abiertos },
        { v: 'por_cobrar', label: 'Por cobrar', n: cuenta.por_cobrar },
        { v: 'entregados', label: 'Entregados', n: cuenta.entregados },
        { v: 'cancelados', label: 'Cancelados', n: cuenta.cancelados },
        { v: 'todos', label: 'Todos', n: cuenta.todos }]} />
    </div>
    <div class="toolbar">
      <${SearchBox} value=${texto} onInput=${setTexto} placeholder="Buscar por cliente, número, barrio o producto" />
      <select class="input auto" value=${dia} onChange=${(e) => setDia(e.target.value)} aria-label="Día de entrega">
        <option value="">Todas las entregas</option>
        ${fechas.map((f) => html`<option value=${f}>${fechaCorta(f)}${f === hoyISO() ? ' (hoy)' : ''}</option>`)}
      </select>
      ${linkRuta && html`<a class="btn" href=${linkRuta} target="_blank" rel="noopener"><${Icon} n="truck" size=${16} />Ruta en Maps</a>`}
    </div>

    <div class="summary-strip">
      <div><span>Pedidos</span><b>${num(filas.length)}</b></div>
      <div><span>Canastas</span><b>${num(sum(filas, 'canastas'))}</b></div>
      <div><span>Valor</span><b>${money(sum(filas, 'total'))}</b></div>
    </div>

    <${ErrorBox} error=${r.error} onRetry=${r.reload} />
    <${Card} pad=${false}>
      ${r.loading && !r.data ? html`<div class="card-body"><${Loader} rows=${5} /></div>` :
        filas.length === 0 ? html`<${Empty} icon="pedidos" title="No hay pedidos aquí">Cuando los clientes pidan por el bot, aparecerán en esta lista.<//>` :
        html`<div class="list">${filas.map((p) => html`<${PedidoItem} key=${p.id} p=${p} onClick=${() => setSel(p)} />`)}</div>`}
    <//>
    ${sel && html`<${PedidoDrawer} pedido=${sel} onClose=${() => setSel(null)} onChanged=${r.reload} />`}
  </div>`;
}
