import { html, useState, useMemo, Icon, Card, Kpi, Loader, Empty, ErrorBox, Modal, Field, AsyncButton, SearchBox, useAsync, toast } from '../ui.js';
import { sb, q, money, num, fechaCorta, sum, groupBy, hoyISO, norm } from '../lib.js';

/* Compras y gastos del negocio: canastas, gasolina, alimento para las gallinas, etc.
   (Los huevos se producen en la finca; su entrada al inventario se registra en Productos). */
export const CATEGORIAS = {
  empaques: { l: 'Canastas y empaques', icon: 'box', color: '#F7B016' },
  transporte: { l: 'Gasolina y transporte', icon: 'truck', color: '#3E6FB6' },
  alimento: { l: 'Alimento para gallinas', icon: 'egg', color: '#2E9E6A' },
  salud: { l: 'Salud de las gallinas', icon: 'shield', color: '#E2463C' },
  mantenimiento: { l: 'Mantenimiento y reparaciones', icon: 'settings', color: '#7B5CC4' },
  servicios: { l: 'Servicios (celular, internet, luz)', icon: 'phone', color: '#6E8FD0' },
  personal: { l: 'Pagos a personal', icon: 'users', color: '#B07800' },
  otros: { l: 'Otros', icon: 'more', color: '#8C8698' }
};
const PAGOS = { efectivo: 'Efectivo', transferencia: 'Transferencia', nequi: 'Nequi', daviplata: 'Daviplata', tarjeta: 'Tarjeta' };
const mesDe = (f) => String(f).slice(0, 7);
const nombreMes = (m) => { const t = new Date(m + '-15T12:00:00').toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }); return t.charAt(0).toUpperCase() + t.slice(1); };

export function Compras() {
  const r = useAsync(() => q(sb.from('gastos').select('*').order('fecha', { ascending: false }).order('id', { ascending: false }).limit(3000)), []);
  const [mes, setMes] = useState(mesDe(hoyISO()));
  const [cat, setCat] = useState('');
  const [texto, setTexto] = useState('');
  const [editar, setEditar] = useState(null);
  const todos = r.data || [];

  const meses = useMemo(() => [...new Set([mesDe(hoyISO()), ...todos.map((g) => mesDe(g.fecha))])].sort().reverse(), [todos]);
  const delMes = todos.filter((g) => mesDe(g.fecha) === mes);
  const mesAnt = (() => { const d = new Date(mes + '-15T12:00:00'); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7); })();
  const totalAnt = sum(todos.filter((g) => mesDe(g.fecha) === mesAnt), 'total');
  const total = sum(delMes, 'total');
  const cambio = totalAnt ? Math.round(((total - totalAnt) / totalAnt) * 100) : null;
  const porCat = [...groupBy(delMes, (g) => g.categoria).entries()].map(([k, v]) => ({ k, v: sum(v, 'total'), n: v.length })).sort((a, b) => b.v - a.v);
  const t = norm(texto.trim());
  const lista = delMes.filter((g) => (!cat || g.categoria === cat) && (!t || norm([g.descripcion, g.proveedor, g.notas].join(' ')).includes(t)));

  return html`<div class="stack">
    <div class="page-head"><div><h2>Compras y gastos</h2><p class="muted">Todo lo que compras para el negocio: canastas, gasolina, alimento para las gallinas y más.</p></div>
      <button class="btn primary" onClick=${() => setEditar({})}><${Icon} n="plus" size=${16} />Registrar compra</button></div>
    <${ErrorBox} error=${r.error} onRetry=${r.reload} />
    ${!r.data ? html`<${Loader} rows=${5} />` : html`
      <div class="filtro-dias"><span class="fd-tit">Mes</span>
        <div class="chips scroll-x">${meses.map((m) => html`<button key=${m} class=${'chip-b' + (mes === m ? ' on' : '')} onClick=${() => { setMes(m); setCat(''); }}>${nombreMes(m)}</button>`)}</div></div>

      <div class="kpis three">
        <${Kpi} icon="wallet" label=${'Gastado en ' + nombreMes(mes).split(' ')[0].toLowerCase()} value=${money(total)} sub=${cambio == null ? num(delMes.length) + ' compras' : cambio === 0 ? 'Igual que el mes anterior' : Math.abs(cambio) + '% ' + (cambio > 0 ? 'más' : 'menos') + ' que el mes anterior'} />
        <${Kpi} icon="egg" label="Mayor gasto" value=${porCat[0] ? CATEGORIAS[porCat[0].k].l : '—'} sub=${porCat[0] ? money(porCat[0].v) : ''} tone="blue" />
        <${Kpi} icon="calendar" label="Compras registradas" value=${num(delMes.length)} sub="en el mes" tone="violet" />
      </div>

      <${Card} title="¿En qué se fue el dinero?" icon="chart">
        ${!porCat.length ? html`<${Empty} icon="cart" title="Sin compras este mes">Registra lo que compras para ver en qué se va el dinero.<//>` : html`
          <div class="gcat">${porCat.map((c) => { const x = CATEGORIAS[c.k] || CATEGORIAS.otros; return html`<button key=${c.k} class=${'gcat-fila' + (cat === c.k ? ' on' : '')} onClick=${() => setCat(cat === c.k ? '' : c.k)}>
            <span class="gcat-ico" style=${{ background: x.color }}><${Icon} n=${x.icon} size=${16} /></span>
            <span class="gcat-txt"><b>${x.l}</b><small>${num(c.n)} compra(s) · ${Math.round((c.v / total) * 100)}%</small>
              <span class="gcat-barra"><i style=${{ width: (c.v / porCat[0].v) * 100 + '%', background: x.color }}></i></span></span>
            <b class="gcat-val">${money(c.v)}</b></button>`; })}</div>
          <p class="muted small">Toca una categoría para ver solo esas compras.</p>`}
      <//>

      <${Card} title=${cat ? CATEGORIAS[cat].l : 'Compras del mes'} icon="history" pad=${false}
        action=${cat && html`<button class="link" onClick=${() => setCat('')}>Ver todas</button>`}>
        <div class="card-body"><${SearchBox} value=${texto} onInput=${setTexto} placeholder="Buscar por descripción o proveedor" /></div>
        ${!lista.length ? html`<${Empty} icon="cart" title="No hay compras para mostrar" />` : html`<div class="list">${lista.map((g) => { const x = CATEGORIAS[g.categoria] || CATEGORIAS.otros;
          return html`<button key=${g.id} class="row-item" onClick=${() => setEditar(g)}>
            <span class="gcat-ico sm" style=${{ background: x.color }}><${Icon} n=${x.icon} size=${14} /></span>
            <div class="ri-main"><b>${g.descripcion}</b><span class="ri-meta">${fechaCorta(g.fecha)}${g.cantidad ? ' · ' + num(g.cantidad) + ' ' + (g.unidad || '') : ''}${g.proveedor ? ' · ' + g.proveedor : ''}</span></div>
            <b>${money(g.total)}</b></button>`; })}</div>`}
      <//>
      <div class="info"><${Icon} n="egg" size=${16} /><span>Los huevos que produce la finca no se registran aquí: súmalos al inventario en <b>Productos → Entrada</b>.</span></div>`}
    ${editar && html`<${GastoModal} g=${editar} onClose=${() => setEditar(null)} onSaved=${() => { setEditar(null); r.reload(); }} />`}
  </div>`;
}

function GastoModal({ g, onClose, onSaved }) {
  const nuevo = !g.id;
  const [f, setF] = useState({ fecha: g.fecha || hoyISO(), categoria: g.categoria || 'empaques', descripcion: g.descripcion || '', cantidad: g.cantidad ?? '', unidad: g.unidad || '',
    total: g.total ?? '', proveedor: g.proveedor || '', metodo_pago: g.metodo_pago || 'efectivo', notas: g.notas === 'DATO_PRUEBA' ? '' : (g.notas || '') });
  const [borrar, setBorrar] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const ok = f.descripcion.trim() && Number(f.total) > 0 && f.fecha;
  const guardar = async () => {
    const datos = { fecha: f.fecha, categoria: f.categoria, descripcion: f.descripcion.trim(), cantidad: f.cantidad === '' ? null : Number(f.cantidad), unidad: f.unidad.trim() || null,
      total: Number(f.total), proveedor: f.proveedor.trim() || null, metodo_pago: f.metodo_pago, notas: f.notas.trim() || (g.notas === 'DATO_PRUEBA' ? 'DATO_PRUEBA' : null) };
    if (nuevo) await q(sb.from('gastos').insert(datos)); else await q(sb.from('gastos').update(datos).eq('id', g.id));
    toast(nuevo ? 'Compra registrada' : 'Compra actualizada'); onSaved();
  };
  const eliminar = async () => { await q(sb.from('gastos').delete().eq('id', g.id)); toast('Compra eliminada'); onSaved(); };
  const sugerencias = { empaques: 'Ej.: Canastas de cartón para 30 huevos', transporte: 'Ej.: Gasolina de la moto', alimento: 'Ej.: Concentrado para gallinas', salud: 'Ej.: Vacunas', mantenimiento: 'Ej.: Cambio de aceite de la moto', servicios: 'Ej.: Plan de celular', personal: 'Ej.: Pago de ayudante', otros: 'Describe la compra' };
  return html`<${Modal} title=${nuevo ? 'Registrar compra' : 'Editar compra'} onClose=${onClose}
    footer=${borrar ? html`<button class="btn ghost" onClick=${() => setBorrar(false)}>No, volver</button><${AsyncButton} className="btn danger" icon="x" onClick=${eliminar}>Sí, eliminar<//>`
      : html`${!nuevo && html`<button class="btn danger-ghost" onClick=${() => setBorrar(true)}>Eliminar</button>`}<button class="btn ghost" onClick=${onClose}>Cancelar</button>
        <${AsyncButton} className="btn primary" icon="check" disabled=${!ok} onClick=${guardar}>Guardar<//>`}>
    ${borrar ? html`<p>¿Eliminar <b>${g.descripcion}</b> por ${money(g.total)}? Esta acción no se puede deshacer.</p>` : html`
      <div class="field"><span class="field-label">¿Qué compraste?</span>
        <div class="gcat-pick">${Object.entries(CATEGORIAS).map(([k, x]) => html`<button key=${k} class=${'chip-b' + (f.categoria === k ? ' on' : '')} onClick=${() => setF({ ...f, categoria: k })}><${Icon} n=${x.icon} size=${13} />${x.l}</button>`)}</div></div>
      <${Field} label="Descripción"><input class="input" value=${f.descripcion} maxlength="120" onInput=${set('descripcion')} placeholder=${sugerencias[f.categoria]} /><//>
      <div class="form-grid">
        <${Field} label="Valor total pagado"><input class="input" type="number" inputmode="numeric" min="0" step="100" value=${f.total} onInput=${set('total')} placeholder="$" /><//>
        <${Field} label="Fecha"><input class="input" type="date" value=${f.fecha} max=${hoyISO()} onInput=${set('fecha')} /><//>
        <${Field} label="Cantidad (opcional)"><input class="input" type="number" min="0" step="any" value=${f.cantidad} onInput=${set('cantidad')} /><//>
        <${Field} label="Unidad (opcional)"><input class="input" value=${f.unidad} onInput=${set('unidad')} placeholder="unidades, galones, bultos…" /><//>
        <${Field} label="Proveedor (opcional)"><input class="input" value=${f.proveedor} onInput=${set('proveedor')} placeholder="¿A quién se lo compraste?" /><//>
        <${Field} label="Cómo pagaste"><select class="input" value=${f.metodo_pago} onChange=${set('metodo_pago')}>${Object.entries(PAGOS).map(([k, l]) => html`<option value=${k}>${l}</option>`)}</select><//>
      </div>
      <${Field} label="Notas (opcional)"><input class="input" value=${f.notas} onInput=${set('notas')} /><//>
      ${Number(f.cantidad) > 0 && Number(f.total) > 0 && html`<p class="muted small">Precio por ${f.unidad || 'unidad'}: <b>${money(Math.round(Number(f.total) / Number(f.cantidad)))}</b></p>`}`}
  <//>`;
}
