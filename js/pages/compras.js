import { html, useState, useMemo, Icon, Card, Kpi, Bars, Loader, Empty, ErrorBox, useAsync } from '../ui.js';
import { sb, q, money, moneyShort, num, fecha, fechaHora, sum, lunesDe, groupBy, isoDate, sumarDias } from '../lib.js';
import { CompraModal, cargarProductos } from './productos.js';

export function Compras() {
  const r = useAsync(async () => {
    const [compras, productos] = await Promise.all([
      q(sb.from('compras').select('*').order('created_at', { ascending: false }).limit(1000)),
      cargarProductos()
    ]);
    return { compras, productos };
  }, []);
  const [nueva, setNueva] = useState(false);
  const d = r.data;

  const calc = useMemo(() => {
    if (!d) return null;
    const nombre = (id) => d.productos.find((p) => p.id === id)?.nombre || '#' + id;
    const total = (c) => (Number(c.costo_unitario) || 0) * (c.cantidad || 0);
    const ahora = new Date();
    const mes = d.compras.filter((c) => { const x = new Date(c.created_at); return x.getMonth() === ahora.getMonth() && x.getFullYear() === ahora.getFullYear(); });
    const conCosto = d.compras.filter((c) => Number(c.costo_unitario) > 0);
    const porSemana = groupBy(d.compras, (c) => lunesDe(c.created_at));
    const semanas = [];
    for (let i = 11; i >= 0; i--) {
      const k = lunesDe(sumarDias(new Date(), -7 * i));
      const filas = porSemana.get(k) || [];
      semanas.push({ k, label: fecha(k), v: sum(filas, total), tip: `Semana del ${fecha(k)} · ${num(sum(filas, 'cantidad'))} unidades`, hl: i === 0 });
    }
    const porProveedor = [...groupBy(d.compras, (c) => c.proveedor || 'Sin proveedor').entries()]
      .map(([k, v]) => ({ k, unidades: sum(v, 'cantidad'), valor: sum(v, total) })).sort((a, b) => b.valor - a.valor);
    return {
      nombre, total, semanas, porProveedor,
      invertidoMes: sum(mes, total), unidadesMes: sum(mes, 'cantidad'),
      costoProm: sum(conCosto, 'cantidad') ? sum(conCosto, total) / sum(conCosto, 'cantidad') : 0
    };
  }, [d]);

  return html`<div class="stack">
    <div class="toolbar end"><button class="btn primary" onClick=${() => setNueva(true)} disabled=${!d}><${Icon} n="plus" size=${16} />Registrar compra</button></div>
    <${ErrorBox} error=${r.error} onRetry=${r.reload} />
    ${!calc ? html`<${Loader} rows=${5} />` : html`
      <div class="kpis three">
        <${Kpi} icon="wallet" label="Invertido este mes" value=${moneyShort(calc.invertidoMes)} />
        <${Kpi} icon="box" label="Unidades compradas (mes)" value=${num(calc.unidadesMes)} tone="blue" />
        <${Kpi} icon="egg" label="Costo promedio por unidad" value=${money(calc.costoProm)} sub="histórico" tone="violet" />
      </div>
      <div class="grid-2">
        <${Card} title="Compras por semana" icon="chart"><${Bars} data=${calc.semanas} color="var(--ink-2)" /><//>
        <${Card} title="Por proveedor" icon="store">
          ${calc.porProveedor.length === 0 ? html`<${Empty} icon="store" title="Sin compras registradas" />` :
            html`<div class="lines">${calc.porProveedor.map((p) => html`<div class="line" key=${p.k}><span>${p.k}<br /><small class="muted">${num(p.unidades)} unidades</small></span><b>${money(p.valor)}</b></div>`)}</div>`}
        <//>
      </div>
      <${Card} title="Historial de compras" icon="history" pad=${false}>
        ${d.compras.length === 0 ? html`<${Empty} icon="cart" title="Todavía no hay compras">Registra cada entrada de mercancía con su costo para ver el margen real.<//>` :
          html`<div class="table-wrap"><table class="table"><thead><tr><th>Fecha</th><th>Producto</th><th class="r">Cantidad</th><th class="r">Costo/u</th><th class="r">Total</th><th>Proveedor</th></tr></thead><tbody>
            ${d.compras.map((c) => html`<tr key=${c.id}><td>${fechaHora(c.created_at)}</td><td>${calc.nombre(c.producto_id)}</td><td class="r">${num(c.cantidad)}</td>
              <td class="r">${c.costo_unitario ? money(c.costo_unitario) : '—'}</td><td class="r"><b>${c.costo_unitario ? money(calc.total(c)) : '—'}</b></td><td class="muted">${c.proveedor || '—'}</td></tr>`)}
          </tbody></table></div>`}
      <//>`}
    ${nueva && d && html`<${CompraModal} productos=${d.productos.filter((p) => p.activo)} onClose=${() => setNueva(false)} onSaved=${r.reload} />`}
  </div>`;
}
