import { html, useState, useMemo, Card, Kpi, Bars, HBars, Donut, Loader, ErrorBox, Tabs, useAsync } from '../ui.js';
import { sb, q, money, moneyShort, num, fecha, sum, groupBy, lunesDe, sumarDias, isoDate, parseDate } from '../lib.js';

const COLORES = { pendiente: '#F7B016', confirmado: '#3E6FB6', preparando: '#6E8FD0', en_camino: '#7B5CC4', entregado: '#2E9E6A', cancelado: '#E2463C' };
const ETQ = { pendiente: 'Pendiente', confirmado: 'Confirmado', preparando: 'Preparando', en_camino: 'En camino', entregado: 'Entregado', cancelado: 'Cancelado' };

export function Estadisticas() {
  const [rango, setRango] = useState(8);
  const r = useAsync(async () => {
    const [semanas, prod, zonas, pedidos, clientes] = await Promise.all([
      q(sb.from('v_ventas_semana').select('*').order('semana', { ascending: false }).limit(60)),
      q(sb.from('v_ventas_producto').select('*').order('semana', { ascending: false }).limit(2000)),
      q(sb.from('v_ventas_zona').select('*').order('ventas', { ascending: false }).limit(300)),
      q(sb.from('pedidos').select('id,estado,fecha_entrega,created_at,total,municipio').order('created_at', { ascending: false }).limit(5000)),
      q(sb.from('clientes').select('id,created_at').limit(5000))
    ]);
    return { semanas, prod, zonas, pedidos, clientes };
  }, []);
  const d = r.data;

  const c = useMemo(() => {
    if (!d) return null;
    const desde = lunesDe(sumarDias(new Date(), -7 * (rango - 1)));
    const sem = d.semanas.filter((s) => s.semana >= desde).reverse();
    const prod = d.prod.filter((s) => s.semana >= desde);
    const ped = d.pedidos.filter((p) => isoDate(p.created_at) >= desde);
    const ventas = sum(sem, 'ventas');
    const entregados = sum(sem, 'pedidos_entregados');
    const totalPed = sum(sem, 'pedidos');
    const cancel = sum(sem, 'cancelados');

    const porProd = [...groupBy(prod, (x) => x.producto).entries()].map(([k, v]) => {
      const vt = sum(v, 'ventas'), mg = sum(v, 'margen_estimado');
      return { label: k, canastas: sum(v, 'canastas'), ventas: vt, margen: mg, pm: vt ? Math.round((mg / vt) * 100) : null };
    }).sort((a, b) => b.ventas - a.ventas);

    const porMunicipio = [...groupBy(d.zonas, (z) => z.municipio || 'Sin municipio').entries()].map(([k, v]) => ({ label: k, v: sum(v, 'ventas'), sub: num(sum(v, 'pedidos')) + ' pedidos · ' + num(sum(v, 'clientes')) + ' clientes' })).sort((a, b) => b.v - a.v);
    const porBarrio = d.zonas.filter((z) => z.barrio).slice(0, 8).map((z) => ({ label: z.barrio + (z.municipio ? ' · ' + z.municipio : ''), v: Number(z.ventas) || 0, sub: num(z.pedidos) + ' pedidos' }));

    const estados = Object.keys(ETQ).map((k) => ({ label: ETQ[k], v: ped.filter((p) => p.estado === k).length, color: COLORES[k] }));
    const dias = [...groupBy(ped.filter((p) => p.fecha_entrega && p.estado !== 'cancelado'), (p) => parseDate(p.fecha_entrega).toLocaleDateString('es-CO', { weekday: 'long' })).entries()]
      .map(([k, v]) => ({ k, label: k.charAt(0).toUpperCase() + k.slice(1), v: v.length, tip: money(sum(v, 'total')) }));

    const nuevosPorSemana = groupBy(d.clientes, (x) => lunesDe(x.created_at));
    const nuevos = [];
    for (let i = rango - 1; i >= 0; i--) { const k = lunesDe(sumarDias(new Date(), -7 * i)); nuevos.push({ k, label: fecha(k), v: (nuevosPorSemana.get(k) || []).length, hl: i === 0 }); }

    return {
      ventas, entregados, totalPed, cancel,
      ticket: entregados ? ventas / Math.max(totalPed - cancel, 1) : (sem.length ? sum(sem, 'ticket_promedio') / sem.length : 0),
      canastas: sum(sem, 'canastas'),
      barrasVentas: sem.map((s, i) => ({ k: s.semana, label: fecha(s.semana), v: Number(s.ventas) || 0, hl: i === sem.length - 1, tip: `${num(s.pedidos)} pedidos · ${num(s.canastas)} canastas` })),
      porProd, porMunicipio, porBarrio, estados, dias, nuevos
    };
  }, [d, rango]);

  return html`<div class="stack">
    <div class="toolbar">
      <${Tabs} value=${rango} onChange=${setRango} items=${[{ v: 4, label: '4 semanas' }, { v: 8, label: '8 semanas' }, { v: 12, label: '3 meses' }, { v: 26, label: '6 meses' }, { v: 52, label: '1 año' }]} />
    </div>
    <${ErrorBox} error=${r.error} onRetry=${r.reload} />
    ${!c ? html`<${Loader} rows=${6} />` : html`
      <div class="kpis">
        <${Kpi} icon="wallet" label="Ventas" value=${moneyShort(c.ventas)} sub=${'últimas ' + rango + ' semanas'} />
        <${Kpi} icon="egg" label="Canastas vendidas" value=${num(c.canastas)} tone="blue" />
        <${Kpi} icon="pedidos" label="Ticket promedio" value=${money(c.ticket)} tone="violet" />
        <${Kpi} icon="x" label="Cancelación" value=${c.totalPed ? Math.round((c.cancel / c.totalPed) * 100) + '%' : '—'} sub=${num(c.cancel) + ' de ' + num(c.totalPed)} tone="red" />
      </div>
      <${Card} title="Ventas por semana" icon="chart"><${Bars} data=${c.barrasVentas} height=${220} /><//>
      <div class="grid-2">
        <${Card} title="Productos más vendidos" icon="egg">
          <${HBars} data=${c.porProd.map((p) => ({ label: p.label, v: p.ventas, sub: num(p.canastas) + ' canastas' + (p.pm != null ? ' · margen ' + p.pm + '%' : '') }))} />
        <//>
        <${Card} title="Margen estimado por producto" icon="wallet">
          <${HBars} data=${c.porProd.map((p) => ({ label: p.label, v: p.margen, color: 'var(--green)', sub: p.pm != null ? p.pm + '% sobre la venta' : 'Registra compras con costo para calcularlo' }))} />
        <//>
      </div>
      <div class="grid-2">
        <${Card} title="Ventas por municipio" icon="pin"><${HBars} data=${c.porMunicipio} /><//>
        <${Card} title="Barrios que más compran" icon="pin"><${HBars} data=${c.porBarrio} color="var(--blue)" /><//>
      </div>
      <div class="grid-3">
        <${Card} title="Estado de los pedidos" icon="pedidos"><${Donut} data=${c.estados} center=${{ v: sum(c.estados, 'v'), l: 'pedidos' }} /><//>
        <${Card} title="Pedidos por día de entrega" icon="calendar"><${Bars} data=${c.dias} fmt=${(v) => num(v) + ' pedidos'} color="var(--violet)" height=${170} /><//>
        <${Card} title="Clientes nuevos por semana" icon="users"><${Bars} data=${c.nuevos} fmt=${(v) => num(v) + ' clientes'} color="var(--blue)" height=${170} /><//>
      </div>`}
  </div>`;
}
