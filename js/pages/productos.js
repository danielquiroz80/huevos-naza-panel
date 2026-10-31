import { html, useState, Icon, Card, Loader, Empty, ErrorBox, Modal, Field, AsyncButton, Badge, Meter, useAsync, toast } from '../ui.js';
import { sb, q, money, num, fechaHora, accion } from '../lib.js';

async function cargarProductos() {
  const [inv, prods] = await Promise.all([
    q(sb.from('v_inventario').select('*')),
    q(sb.from('productos').select('id,nombre,descripcion,unidad,precio,stock,activo').order('nombre'))
  ]);
  const m = new Map(inv.map((x) => [x.id, x]));
  return prods.map((p) => ({ ...p, ...(m.get(p.id) || {}), descripcion: p.descripcion, unidad: p.unidad }));
}

/* ---------- Editar / crear producto con confirmación ---------- */
export function ProductoModal({ producto, onClose, onSaved }) {
  const nuevo = !producto;
  const base = producto || { nombre: '', descripcion: '', precio: '', stock: 0, unidad: 'canasta', activo: true };
  const [f, setF] = useState({ ...base });
  const [paso, setPaso] = useState('form');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const campos = ['nombre', 'descripcion', 'precio', 'stock', 'unidad', 'activo'];
  const val = (k, v) => (k === 'precio' || k === 'stock' ? Number(v) : k === 'activo' ? !!v : String(v ?? '').trim());
  const cambios = {};
  for (const k of campos) if (nuevo || val(k, f[k]) !== val(k, base[k])) cambios[k] = val(k, f[k]);

  const avisos = [];
  if ('precio' in cambios && !nuevo && Number(base.precio) > 0) {
    const pc = Math.round(((cambios.precio - base.precio) / base.precio) * 100);
    if (Math.abs(pc) >= 30) avisos.push(`El precio cambia ${pc > 0 ? '+' : ''}${pc}%. Revisa que no falte ni sobre un cero.`);
  }
  if ('stock' in cambios && !nuevo) avisos.push('El stock se reemplaza (no se suma). Para entradas de mercancía usa "Registrar compra".');
  if (cambios.activo === false) avisos.push('El producto deja de ofrecerse en el bot.');

  const errores = [];
  if (!val('nombre', f.nombre)) errores.push('Escribe el nombre.');
  if (!(Number(f.precio) > 0)) errores.push('El precio debe ser mayor a 0.');
  if (!(Number(f.stock) >= 0) || !Number.isInteger(Number(f.stock))) errores.push('El stock debe ser un número entero de 0 o más.');

  const guardar = async () => {
    if (nuevo) await q(sb.from('productos').insert(cambios));
    else await q(sb.from('productos').update(cambios).eq('id', producto.id));
    toast(nuevo ? 'Producto creado' : 'Cambios guardados');
    onSaved(); onClose();
  };
  const etiqueta = { nombre: 'Nombre', descripcion: 'Descripción', precio: 'Precio', stock: 'Stock', unidad: 'Unidad', activo: 'Activo' };
  const fmt = (k, v) => (k === 'precio' ? money(v) : k === 'activo' ? (v ? 'Sí' : 'No') : String(v ?? '') || '—');

  if (paso === 'confirmar') return html`<${Modal} title="Confirma los cambios" onClose=${onClose}
    footer=${html`<button class="btn ghost" onClick=${() => setPaso('form')}>Corregir</button><${AsyncButton} className="btn primary" icon="check" onClick=${guardar}>Confirmar y guardar<//>`}>
    <div class="diff">${Object.keys(cambios).map((k) => html`<div class="diff-row" key=${k}><span>${etiqueta[k]}</span>
      ${!nuevo && html`<s>${fmt(k, base[k])}</s>`}<${Icon} n="external" size=${12} /><b>${fmt(k, cambios[k])}</b></div>`)}</div>
    ${avisos.map((a) => html`<div class="warn"><${Icon} n="alert" size=${16} />${a}</div>`)}
    ${'precio' in cambios && html`<p class="muted">El precio nuevo aplica a los pedidos que se hagan desde ahora.</p>`}
  <//>`;

  return html`<${Modal} title=${nuevo ? 'Nuevo producto' : 'Editar ' + base.nombre} onClose=${onClose}
    footer=${html`<button class="btn ghost" onClick=${onClose}>Cancelar</button>
      <button class="btn primary" disabled=${errores.length > 0 || Object.keys(cambios).length === 0} onClick=${() => setPaso('confirmar')}>Revisar cambios</button>`}>
    <div class="form-grid">
      <${Field} label="Nombre"><input class="input" value=${f.nombre} onInput=${set('nombre')} placeholder="Huevos AA" /><//>
      <${Field} label="Unidad"><input class="input" value=${f.unidad} onInput=${set('unidad')} placeholder="canasta" /><//>
      <${Field} label="Precio por unidad"><input class="input" type="number" min="0" step="500" value=${f.precio} onInput=${set('precio')} /><//>
      <${Field} label="Stock disponible" hint=${nuevo ? '' : 'Para sumar mercancía usa Registrar compra'}><input class="input" type="number" min="0" step="1" value=${f.stock} onInput=${set('stock')} /><//>
    </div>
    <${Field} label="Descripción (la puede usar el bot)"><textarea class="input" rows="2" value=${f.descripcion || ''} onInput=${set('descripcion')}></textarea><//>
    <label class="switch"><input type="checkbox" checked=${!!f.activo} onChange=${set('activo')} /><span></span>Disponible para la venta</label>
    ${errores.length > 0 && html`<p class="muted">${errores.join(' ')}</p>`}
  <//>`;
}

/* ---------- Registrar compra (entrada de mercancía) ---------- */
export function CompraModal({ productos, productoId, onClose, onSaved }) {
  const [f, setF] = useState({ producto_id: productoId || productos[0]?.id || '', cantidad: '', costo_unitario: '', proveedor: '', notas: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const p = productos.find((x) => String(x.id) === String(f.producto_id));
  const ok = p && Number(f.cantidad) > 0 && Number.isInteger(Number(f.cantidad));
  const guardar = async () => {
    await q(sb.from('compras').insert({
      producto_id: Number(f.producto_id), cantidad: Number(f.cantidad),
      costo_unitario: f.costo_unitario ? Number(f.costo_unitario) : null,
      proveedor: f.proveedor.trim() || null, notas: f.notas.trim() || null
    }));
    toast(`Compra registrada: +${f.cantidad} ${p.nombre}`);
    if (p.en_lista_espera > 0) {
      try { await accion({ accion: 'lista_espera' }); toast('Se avisará a los clientes en lista de espera'); } catch (e) { /* la tarea diaria lo cubre */ }
    }
    onSaved(); onClose();
  };
  return html`<${Modal} title="Registrar compra" onClose=${onClose}
    footer=${html`<button class="btn ghost" onClick=${onClose}>Cancelar</button>
      <${AsyncButton} className="btn primary" icon="plus" disabled=${!ok} onClick=${guardar}>Sumar ${f.cantidad || 0} al stock<//>`}>
    <div class="form-grid">
      <${Field} label="Producto"><select class="input" value=${f.producto_id} onChange=${set('producto_id')}>
        ${productos.map((x) => html`<option value=${x.id}>${x.nombre}</option>`)}</select><//>
      <${Field} label="Cantidad"><input class="input" type="number" min="1" step="1" value=${f.cantidad} onInput=${set('cantidad')} /><//>
      <${Field} label="Costo por unidad" hint="Sirve para calcular el margen"><input class="input" type="number" min="0" step="100" value=${f.costo_unitario} onInput=${set('costo_unitario')} /><//>
      <${Field} label="Proveedor"><input class="input" value=${f.proveedor} onInput=${set('proveedor')} placeholder="Finca, galpón…" /><//>
    </div>
    <${Field} label="Notas"><input class="input" value=${f.notas} onInput=${set('notas')} /><//>
    ${p && Number(f.cantidad) > 0 && html`<div class="info"><${Icon} n="box" size=${16} />Stock de ${p.nombre}: ${num(p.stock)} → <b>${num(Number(p.stock) + Number(f.cantidad))}</b>
      ${Number(f.costo_unitario) > 0 ? ` · Total ${money(Number(f.cantidad) * Number(f.costo_unitario))}` : ''}</div>`}
  <//>`;
}

export function Productos() {
  const r = useAsync(cargarProductos, []);
  const mov = useAsync(() => q(sb.from('movimientos_inventario').select('*').order('created_at', { ascending: false }).limit(40)), []);
  const [edit, setEdit] = useState(null);
  const [compra, setCompra] = useState(null);
  const prods = r.data || [];
  const nombre = (id) => prods.find((p) => p.id === id)?.nombre || '#' + id;
  const recargar = () => { r.reload(); mov.reload(); };

  return html`<div class="stack">
    <div class="toolbar end">
      <button class="btn" onClick=${() => setCompra({})} disabled=${!prods.length}><${Icon} n="cart" size=${16} />Registrar compra</button>
      <button class="btn primary" onClick=${() => setEdit({ nuevo: true })}><${Icon} n="plus" size=${16} />Nuevo producto</button>
    </div>
    <${ErrorBox} error=${r.error} onRetry=${r.reload} />
    ${r.loading && !r.data ? html`<${Loader} rows=${4} />` : prods.length === 0 ? html`<${Empty} icon="box" title="Sin productos" />` : html`
    <div class="product-grid">
      ${prods.map((p) => {
        const disp = (p.stock || 0) - (p.comprometido || 0);
        const costo = Number(p.costo_promedio_90d) || 0;
        const margen = costo && p.precio ? Math.round(((p.precio - costo) / p.precio) * 100) : null;
        return html`<article class=${'product' + (p.activo ? '' : ' off')} key=${p.id}>
          <div class="product-head">
            <div class="product-egg"><${Icon} n="egg" size=${22} /></div>
            <div><h4>${p.nombre}</h4><span class="muted">${p.unidad || 'canasta'}${p.activo ? '' : ' · inactivo'}</span></div>
            <b class="product-price">${money(p.precio)}</b>
          </div>
          ${p.descripcion && html`<p class="muted small">${p.descripcion}</p>`}
          <div class="product-stock">
            <div class="ps-top"><span>Disponible</span><b class=${disp < 0 ? 'neg' : disp <= 3 ? 'warn-t' : ''}>${num(disp)}</b></div>
            <${Meter} value=${Math.max(disp, 0)} max=${Math.max(p.stock || 0, 1)} tone=${disp <= 3 ? 'red' : 'amber'} />
            <div class="ps-grid">
              <div><span>Stock</span><b>${num(p.stock)}</b></div>
              <div><span>En pedidos</span><b>${num(p.comprometido)}</b></div>
              <div><span>En espera</span><b>${num(p.en_lista_espera)}</b></div>
              <div><span>Margen</span><b>${margen == null ? '—' : margen + '%'}</b></div>
            </div>
            ${costo > 0 && html`<small class="muted">Costo promedio 90 días: ${money(costo)}</small>`}
          </div>
          <div class="product-actions">
            <button class="btn sm ghost" onClick=${() => setEdit(p)}><${Icon} n="edit" size=${14} />Editar</button>
            <button class="btn sm" onClick=${() => setCompra({ id: p.id })}><${Icon} n="plus" size=${14} />Compra</button>
          </div>
        </article>`;
      })}
    </div>`}

    <${Card} title="Movimientos de inventario" icon="history" pad=${false}>
      ${mov.loading && !mov.data ? html`<div class="card-body"><${Loader} /></div>` : (mov.data || []).length === 0 ? html`<${Empty} icon="history" title="Sin movimientos" />` :
        html`<div class="table-wrap"><table class="table"><thead><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th class="r">Cantidad</th><th class="r">Stock</th><th>Detalle</th></tr></thead><tbody>
          ${mov.data.map((m) => html`<tr key=${m.id}><td>${fechaHora(m.created_at)}</td><td>${nombre(m.producto_id)}</td>
            <td><${Badge} tone=${m.cantidad > 0 ? 'green' : 'gray'}>${m.tipo}<//></td>
            <td class=${'r ' + (m.cantidad > 0 ? 'pos' : 'neg')}>${m.cantidad > 0 ? '+' : ''}${m.cantidad}</td><td class="r">${m.stock_resultante ?? '—'}</td>
            <td class="muted">${m.pedido_id ? 'Pedido #' + m.pedido_id : m.compra_id ? 'Compra #' + m.compra_id : m.notas || ''}</td></tr>`)}
        </tbody></table></div>`}
    <//>
    ${edit && html`<${ProductoModal} producto=${edit.nuevo ? null : edit} onClose=${() => setEdit(null)} onSaved=${recargar} />`}
    ${compra && html`<${CompraModal} productos=${prods.filter((p) => p.activo)} productoId=${compra.id} onClose=${() => setCompra(null)} onSaved=${recargar} />`}
  </div>`;
}

export { cargarProductos };
