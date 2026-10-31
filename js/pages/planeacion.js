import { html, useMemo, Icon, Card, Kpi, Loader, ErrorBox, Empty, Badge, useAsync } from '../ui.js';
import { sb, q, num, money, fechaLarga, fechaCorta, sum, groupBy, hoyISO, isoDate, sumarDias, lunesDe, norm } from '../lib.js';

export function Planeacion() {
  const r = useAsync(async () => {
    const hoy = hoyISO();
    const [inv, consolidado, fijos, ventas, espera] = await Promise.all([
      q(sb.from('v_inventario').select('*').eq('activo', true)),
      q(sb.from('v_consolidado').select('*').gte('fecha_entrega', hoy).order('fecha_entrega')),
      q(sb.from('pedidos_fijos').select('items,proxima_fecha,frecuencia_semanas').eq('activo', true).lte('proxima_fecha', isoDate(sumarDias(new Date(), 8)))),
      q(sb.from('v_ventas_producto').select('*').gte('semana', lunesDe(sumarDias(new Date(), -28)))),
      q(sb.from('lista_espera').select('producto_id,cantidad').eq('avisado', false))
    ]);
    return { inv, consolidado, fijos, ventas, espera };
  }, []);
  const d = r.data;

  const plan = useMemo(() => {
    if (!d) return null;
    const fijosPorProd = new Map();
    for (const f of d.fijos) for (const it of f.items || []) {
      const k = norm(it.producto);
      fijosPorProd.set(k, (fijosPorProd.get(k) || 0) + (Number(it.cantidad) || 0));
    }
    const semanaActual = lunesDe(new Date());
    const filas = d.inv.map((p) => {
      const hist = d.ventas.filter((v) => norm(v.producto) === norm(p.nombre) && v.semana < semanaActual);
      const promedio = hist.length ? sum(hist, 'canastas') / 4 : 0;
      const fijos = fijosPorProd.get(norm(p.nombre)) || 0;
      const comprometido = Number(p.comprometido) || 0;
      const espera = sum(d.espera.filter((e) => e.producto_id === p.id), (e) => e.cantidad || 1);
      const demanda = Math.ceil(Math.max(comprometido + fijos, promedio) + espera * 0.5);
      const faltante = Math.max(0, demanda - (Number(p.stock) || 0));
      return { ...p, promedio, fijos, comprometido, espera, demanda, faltante };
    });
    return { filas, porFecha: [...groupBy(d.consolidado, (x) => x.fecha_entrega).entries()], totalFaltante: sum(filas, 'faltante'), totalDemanda: sum(filas, 'demanda') };
  }, [d]);

  return html`<div class="stack">
    <${ErrorBox} error=${r.error} onRetry=${r.reload} />
    ${!plan ? html`<${Loader} rows=${6} />` : html`
      <div class="kpis three">
        <${Kpi} icon="egg" label="Demanda estimada próxima entrega" value=${num(plan.totalDemanda) + ' canastas'} />
        <${Kpi} icon="box" label="Stock actual" value=${num(sum(plan.filas, 'stock'))} tone="blue" />
        <${Kpi} icon=${plan.totalFaltante ? 'alert' : 'check'} label=${plan.totalFaltante ? 'Hay que conseguir' : 'Stock suficiente'} value=${plan.totalFaltante ? num(plan.totalFaltante) + ' canastas' : 'Sí'} tone=${plan.totalFaltante ? 'red' : 'green'} />
      </div>

      <${Card} title="Qué comprar o alistar" icon="calendar" pad=${false}>
        <div class="table-wrap"><table class="table"><thead><tr><th>Producto</th><th class="r">Ya pedido</th><th class="r">Pedidos fijos</th><th class="r">Promedio semanal</th><th class="r">En espera</th><th class="r">Demanda</th><th class="r">Stock</th><th>Sugerencia</th></tr></thead><tbody>
          ${plan.filas.map((p) => html`<tr key=${p.id}><td><b>${p.nombre}</b></td><td class="r">${num(p.comprometido)}</td><td class="r">${num(p.fijos)}</td>
            <td class="r">${num(p.promedio)}</td><td class="r">${num(p.espera)}</td><td class="r"><b>${num(p.demanda)}</b></td><td class="r">${num(p.stock)}</td>
            <td>${p.faltante ? html`<${Badge} tone="red">Conseguir ${num(p.faltante)}<//>` : html`<${Badge} tone="green">Suficiente<//>`}</td></tr>`)}
        </tbody></table></div>
        <p class="muted small pad">La demanda toma lo que ya está pedido más los pedidos fijos de los próximos 8 días, o el promedio de las últimas 4 semanas si es mayor, y suma la mitad de la lista de espera.</p>
      <//>

      <${Card} title="Entregas programadas" icon="truck">
        ${plan.porFecha.length === 0 ? html`<${Empty} icon="truck" title="No hay entregas programadas" />` :
          html`<div class="prep-grid">${plan.porFecha.map(([f, filas]) => html`<div class="prep" key=${f}>
            <div class="prep-head"><b>${fechaLarga(f)}</b><${Badge} tone="amber">${money(sum(filas, 'valor'))}<//></div>
            <div class="prep-items">${filas.map((x) => html`<div class="prep-item" key=${x.producto}><span class="egg-dot"></span><span>${x.producto}</span><b>${num(x.canastas)}</b></div>`)}</div>
            <a class="link" href="#/pedidos"><${Icon} n="pedidos" size=${14} />Ver ${num(sum(filas, 'pedidos'))} pedidos</a>
          </div>`)}</div>`}
      <//>`}
  </div>`;
}
