import { html, useState, useEffect, Icon, Card, Tabs, Loader, Empty, ErrorBox, Field, AsyncButton, Badge, Bars, HBars, Donut, useAsync, toast } from '../ui.js';
import { sb, q, CONFIG, num, money, fechaCorta, fechaHora, hoyISO, isoDate, sumarDias, sum, norm, ESTADOS, MOTIVOS } from '../lib.js';

/* ---------- Definición de reportes ---------- */
const FH = (v) => v ? new Date(v).toLocaleString('sv-SE', { timeZone: 'America/Bogota' }).slice(0, 16) : '';
const minEntre = (a, b) => a && b ? Math.round((new Date(b) - new Date(a)) / 60000) : null;
const EST_RUTA = { planeada: 'Por iniciar', en_curso: 'En ruta', terminada: 'Finalizada', cancelada: 'Cancelada' };
const estPedido = (e) => (ESTADOS[e] && ESTADOS[e].label) || e;
const rutaTxt = (x) => x.ruta_id ? 'R-' + x.ruta_id + (x.ruta ? ' · ' + x.ruta : '') : '';
const resultado = (e) => e === 'entregado' ? 'Exitosa' : e === 'no_entregado' ? 'Fallida' : e === 'cancelado' ? 'Cancelada' : 'Pendiente';

// t: n = número, m = dinero, d = fecha, dt = fecha y hora, p = porcentaje, s = texto
const TIPOS = {
  pedidos: { label: 'Pedidos', icon: 'pedidos', desc: 'Cada pedido con cliente, productos, valor, estado, ruta y repartidor.', cols: [
    ['id', 'ID pedido', 'n', (x) => x.id], ['creado', 'Fecha de creación', 'dt', (x) => FH(x.creado)], ['fecha_entrega', 'Fecha de entrega', 'd', (x) => x.fecha_entrega],
    ['cliente', 'Cliente', 's', (x) => x.cliente], ['telefono', 'Teléfono', 's', (x) => x.telefono], ['direccion', 'Dirección', 's', (x) => x.direccion],
    ['barrio', 'Barrio', 's', (x) => x.barrio], ['municipio', 'Municipio', 's', (x) => x.municipio], ['productos', 'Productos', 's', (x) => x.productos],
    ['cantidad', 'Canastas', 'n', (x) => x.cantidad], ['total', 'Valor', 'm', (x) => x.total], ['pago', 'Pago', 's', (x) => x.pago_estado],
    ['metodo', 'Método de pago', 's', (x) => x.metodo_pago], ['estado', 'Estado', 's', (x) => estPedido(x.estado)], ['ruta', 'Ruta', 's', rutaTxt],
    ['repartidor', 'Repartidor', 's', (x) => x.repartidor], ['entregado_en', 'Fecha y hora de entrega', 'dt', (x) => FH(x.entregado_en)],
    ['motivo', 'Motivo de no entrega', 's', (x) => MOTIVOS[x.motivo_no_entrega] || x.motivo_no_entrega], ['obs', 'Observación de entrega', 's', (x) => x.entrega_obs],
    ['notas', 'Notas del pedido', 's', (x) => x.notas], ['canal', 'Canal', 's', (x) => x.canal]],
    def: ['id', 'fecha_entrega', 'cliente', 'telefono', 'direccion', 'productos', 'total', 'estado', 'ruta', 'repartidor', 'entregado_en'] },
  entregas: { label: 'Entregas', icon: 'truck', desc: 'Pedidos que pasaron por una ruta: tiempos, resultado y motivos.', cols: [
    ['id', 'ID entrega', 's', (x) => 'E-' + x.id], ['pedido', 'Pedido', 'n', (x) => x.id], ['cliente', 'Destinatario', 's', (x) => x.cliente], ['direccion', 'Dirección', 's', (x) => x.direccion],
    ['barrio', 'Barrio', 's', (x) => x.barrio], ['municipio', 'Municipio', 's', (x) => x.municipio], ['repartidor', 'Repartidor', 's', (x) => x.repartidor], ['ruta', 'Ruta', 's', rutaTxt],
    ['estado', 'Estado de la entrega', 's', (x) => estPedido(x.estado)], ['asignado_en', 'Asignado', 'dt', (x) => FH(x.asignado_en)], ['inicio', 'Inicio de la ruta', 'dt', (x) => FH(x.ruta_iniciada_en)],
    ['entregado_en', 'Entregado', 'dt', (x) => FH(x.entregado_en)], ['min_ruta', 'Minutos desde el inicio de la ruta', 'n', (x) => minEntre(x.ruta_iniciada_en, x.entregado_en)],
    ['min_asig', 'Minutos desde la asignación', 'n', (x) => minEntre(x.asignado_en, x.entregado_en)], ['resultado', 'Resultado', 's', (x) => resultado(x.estado)],
    ['motivo', 'Motivo de entrega fallida', 's', (x) => MOTIVOS[x.motivo_no_entrega] || x.motivo_no_entrega], ['intentos', 'Intentos fallidos', 'n', (x) => x.intentos_fallidos],
    ['foto', 'Foto de evidencia', 's', (x) => x.foto ? 'Sí' : 'No'], ['canastas', 'Canastas', 'n', (x) => x.cantidad]],
    def: ['id', 'pedido', 'cliente', 'direccion', 'repartidor', 'ruta', 'asignado_en', 'entregado_en', 'min_ruta', 'resultado', 'motivo'] },
  rutas: { label: 'Rutas', icon: 'route', desc: 'Cada ruta con repartidor, avance, horarios y resultados.', cols: [
    ['id', 'ID ruta', 's', (x) => 'R-' + x.id], ['nombre', 'Nombre', 's', (x) => x.nombre], ['fecha', 'Fecha', 'd', (x) => x.fecha], ['creada', 'Creada', 'dt', (x) => FH(x.creada)],
    ['repartidor', 'Repartidor', 's', (x) => x.repartidor_nombre || 'Sin tomar'], ['estado', 'Estado', 's', (x) => EST_RUTA[x.estado] || x.estado], ['paradas', 'Pedidos', 'n', (x) => x.paradas],
    ['ok', 'Entregas exitosas', 'n', (x) => x.ok], ['no', 'Entregas fallidas', 'n', (x) => x.no], ['pend', 'Pendientes', 'n', (x) => x.paradas - x.ok - x.no],
    ['progreso', 'Progreso', 'p', (x) => x.paradas ? (x.ok + x.no) / x.paradas : 0], ['inicio', 'Hora de inicio', 'dt', (x) => FH(x.iniciada_en)],
    ['fin', 'Hora de finalización', 'dt', (x) => FH(x.terminada_en)], ['duracion', 'Duración (min)', 'n', (x) => minEntre(x.iniciada_en, x.terminada_en)],
    ['km', 'Distancia estimada (km)', 'n', (x) => x.distancia_km], ['canastas', 'Canastas', 'n', (x) => x.canastas], ['cancelacion', 'Motivo de cancelación', 's', (x) => x.motivo_cancelacion]],
    def: ['id', 'fecha', 'repartidor', 'estado', 'paradas', 'ok', 'no', 'progreso', 'inicio', 'fin', 'duracion'] },
  repartidores: { label: 'Repartidores', icon: 'users', desc: 'Rendimiento de cada repartidor en el periodo.', cols: [
    ['nombre', 'Repartidor', 's', (x) => x.nombre], ['documento', 'Documento', 's', (x) => x.documento], ['telefono', 'Celular', 's', (x) => x.telefono],
    ['cuenta', 'Estado de la cuenta', 's', (x) => x.estado_cuenta], ['disp', 'Disponibilidad', 's', (x) => x.disponibilidad === 'fuera_servicio' ? 'Fuera de servicio' : 'Disponible'],
    ['transporte', 'Transporte', 's', (x) => x.transporte], ['asignados', 'Pedidos asignados', 'n', (x) => x.stats.asignados], ['rutas', 'Rutas realizadas', 'n', (x) => x.stats.rutas_total],
    ['ok', 'Entregas exitosas', 'n', (x) => x.stats.entregados], ['no', 'Entregas fallidas', 'n', (x) => x.stats.fallidos],
    ['efectividad', 'Efectividad', 'p', (x) => x.stats.entregados + x.stats.fallidos ? x.stats.entregados / (x.stats.entregados + x.stats.fallidos) : null],
    ['tiempo', 'Minutos promedio por entrega', 'n', (x) => x.stats.tiempo_promedio_min]],
    def: ['nombre', 'cuenta', 'asignados', 'rutas', 'ok', 'no', 'efectividad', 'tiempo'] },
  general: { label: 'Operación general', icon: 'chart', desc: 'Resumen diario: pedidos, entregas, rutas y efectividad.', cols: [
    ['dia', 'Fecha', 'd', (x) => x.dia], ['pedidos', 'Pedidos', 'n', (x) => x.pedidos], ['pend', 'Pendientes', 'n', (x) => x.pend], ['asig', 'Asignados a ruta', 'n', (x) => x.asig],
    ['ok', 'Entregados', 'n', (x) => x.ok], ['no', 'Con incidencia', 'n', (x) => x.no], ['canc', 'Cancelados', 'n', (x) => x.canc], ['rutas', 'Rutas', 'n', (x) => x.rutas],
    ['rutas_fin', 'Rutas finalizadas', 'n', (x) => x.rutas_fin], ['exito', 'Efectividad', 'p', (x) => x.ok + x.no ? x.ok / (x.ok + x.no) : null], ['ventas', 'Valor entregado', 'm', (x) => x.ventas]],
    def: ['dia', 'pedidos', 'pend', 'asig', 'ok', 'no', 'canc', 'rutas', 'rutas_fin', 'exito', 'ventas'] }
};
const PERIODOS = [['hoy', 'Hoy'], ['ayer', 'Ayer'], ['semana', 'Última semana'], ['mes', 'Último mes'], ['mes_actual', 'Mes actual'], ['rango', 'Rango personalizado']];
function rango(p, d, h) {
  const hoy = hoyISO();
  if (p === 'hoy') return [hoy, hoy];
  if (p === 'ayer') { const a = isoDate(sumarDias(new Date(), -1)); return [a, a]; }
  if (p === 'semana') return [isoDate(sumarDias(new Date(), -6)), hoy];
  if (p === 'mes') return [isoDate(sumarDias(new Date(), -29)), hoy];
  if (p === 'mes_actual') return [hoy.slice(0, 8) + '01', hoy];
  return [d || hoy, h || hoy];
}
const VACIO = { repartidor: '', estado: [], ruta_estado: [], cliente: '', zona: '', producto: '', resultado: '', ruta: '' };

/* =================== Página =================== */
export function Reportes({ perfil }) {
  const [vista, setVista] = useState('nuevo');
  return html`<div class="stack">
    <div class="page-head"><div><h2>Reportes</h2><p class="muted">Analiza la operación y genera informes en Google Sheets.</p></div></div>
    <${Tabs} value=${vista} onChange=${setVista} items=${[{ v: 'nuevo', label: 'Nuevo reporte' }, { v: 'historial', label: 'Historial' }]} />
    ${vista === 'nuevo' ? html`<${NuevoReporte} perfil=${perfil} onHistorial=${() => setVista('historial')} />` : html`<${Historial} />`}
  </div>`;
}

function NuevoReporte({ onHistorial }) {
  const [tipo, setTipo] = useState('pedidos');
  const [per, setPer] = useState('semana');
  const [d1, setD1] = useState(isoDate(sumarDias(new Date(), -6)));
  const [d2, setD2] = useState(hoyISO());
  const [f, setF] = useState(VACIO);
  const [cols, setCols] = useState(TIPOS.pedidos.def);
  const [paso, setPaso] = useState('filtros');
  const [hecho, setHecho] = useState(null);
  const [desde, hasta] = rango(per, d1, d2);
  const T = TIPOS[tipo];
  useEffect(() => { setCols(TIPOS[tipo].def); setF(VACIO); setHecho(null); }, [tipo]);

  const datos = useAsync(async () => {
    if (hasta < desde) throw new Error('La fecha final no puede ser anterior a la inicial.');
    if (tipo === 'general') {
      const [ped, rut] = await Promise.all([q(sb.rpc('reporte_datos', { p_tipo: 'pedidos', p_desde: desde, p_hasta: hasta })), q(sb.rpc('reporte_datos', { p_tipo: 'rutas', p_desde: desde, p_hasta: hasta }))]);
      return { ped, rut };
    }
    return { filas: await q(sb.rpc('reporte_datos', { p_tipo: tipo === 'entregas' ? 'entregas' : tipo, p_desde: desde, p_hasta: hasta })) };
  }, [tipo, desde, hasta]);

  // Opciones de filtros a partir de los datos reales del periodo
  const base = datos.data ? (tipo === 'general' ? datos.data.ped : datos.data.filas) : [];
  const opc = {
    repartidores: [...new Set(base.map((x) => tipo === 'rutas' ? x.repartidor_nombre : tipo === 'repartidores' ? x.nombre : x.repartidor).filter(Boolean))].sort(),
    zonas: [...new Set(base.map((x) => x.municipio || x.barrio).filter(Boolean))].sort(),
    productos: [...new Set(base.flatMap((x) => (x.items || []).map((i) => i.producto)))].sort(),
    rutas: [...new Set(base.map((x) => tipo === 'rutas' ? 'R-' + x.id : x.ruta_id ? 'R-' + x.ruta_id : null).filter(Boolean))].sort()
  };
  const filtrar = (x) => {
    const rep = tipo === 'rutas' ? x.repartidor_nombre : tipo === 'repartidores' ? x.nombre : x.repartidor;
    if (f.repartidor && rep !== f.repartidor) return false;
    if (f.estado.length && !f.estado.includes(x.estado)) return false;
    if (f.ruta_estado.length && !f.ruta_estado.includes(tipo === 'rutas' ? x.estado : x.ruta_estado)) return false;
    if (f.cliente && !norm(x.cliente).includes(norm(f.cliente))) return false;
    if (f.zona && x.municipio !== f.zona && x.barrio !== f.zona) return false;
    if (f.producto && !(x.items || []).some((i) => i.producto === f.producto)) return false;
    if (f.resultado && resultado(x.estado) !== f.resultado) return false;
    if (f.ruta && (tipo === 'rutas' ? 'R-' + x.id : 'R-' + x.ruta_id) !== f.ruta) return false;
    return true;
  };
  let filas = [];
  if (datos.data) {
    if (tipo === 'general') filas = porDia(datos.data.ped.filter(filtrar), datos.data.rut.filter((r) => (!f.repartidor || r.repartidor_nombre === f.repartidor) && (!f.ruta || 'R-' + r.id === f.ruta)), desde, hasta);
    else filas = datos.data.filas.filter(filtrar);
  }
  const colDefs = T.cols.filter((c) => cols.includes(c[0]));
  const est = estadisticas(tipo, filas, datos.data);
  const filtrosTxt = descripcionFiltros(f);
  const nfiltros = filtrosTxt.length;

  const generar = async () => {
    if (!filas.length) throw new Error('No hay registros con estos filtros.');
    if (!colDefs.length) throw new Error('Elige al menos una columna.');
    const { data: s } = await sb.auth.getSession();
    const token = s && s.session && s.session.access_token;
    if (!token) throw new Error('Tu sesión terminó. Vuelve a entrar.');
    const nombre = 'Reporte de ' + T.label.toLowerCase() + ' · ' + (desde === hasta ? fechaCorta(desde) : fechaCorta(desde) + ' a ' + fechaCorta(hasta));
    const payload = {
      nombre, categoria: tipo, desde, hasta, periodo: (PERIODOS.find((p) => p[0] === per) || [])[1], filtros: filtrosTxt,
      columnas: colDefs.map(([k, l, t]) => ({ k, l, t })), filas: filas.map((x) => colDefs.map((c) => { const v = c[3](x); return v == null || v === '' ? '' : v; })),
      resumen: est.kpis.map((k) => ({ l: k.l, v: k.v, t: k.t || 'n' })), tablas: est.tablas.map((t) => ({ titulo: t.titulo, enc: t.enc, filas: t.filas, grafico: t.grafico, t: t.t || 'n' }))
    };
    const r = await fetch(CONFIG.reportesUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(payload) });
    let j = {}; try { j = await r.json(); } catch (e) { /* sin cuerpo */ }
    if (!r.ok || !j.ok || !j.url) throw new Error(j.mensaje || 'No pudimos generar el reporte en Google Sheets. Inténtalo de nuevo.');
    setHecho({ url: j.url, nombre, filas: filas.length, repetido: j.repetido });
    toast(j.repetido ? 'Ya habías generado este mismo reporte hace un momento; te mostramos ese.' : 'Reporte generado en Google Sheets');
  };

  return html`<div class="reporte">
    <div class="tipos">${Object.entries(TIPOS).map(([k, t]) => html`<button key=${k} class=${'tipo' + (tipo === k ? ' on' : '')} onClick=${() => setTipo(k)}>
      <span class="tipo-ico"><${Icon} n=${t.icon} size=${20} /></span><b>${t.label}</b><small>${t.desc}</small></button>`)}</div>

    <div class="rep-layout">
      <aside class="rep-panel">
        <${Card} title="Periodo" icon="calendar">
          <div class="chips">${PERIODOS.map(([k, l]) => html`<button key=${k} class=${'chip-b' + (per === k ? ' on' : '')} onClick=${() => setPer(k)}>${l}</button>`)}</div>
          ${per === 'rango' && html`<div class="form-grid"><${Field} label="Desde"><input class="input" type="date" value=${d1} max=${d2} onInput=${(e) => setD1(e.target.value)} /><//>
            <${Field} label="Hasta"><input class="input" type="date" value=${d2} min=${d1} onInput=${(e) => setD2(e.target.value)} /><//></div>`}
          <p class="muted small">${fechaCorta(desde)}${desde !== hasta ? ' — ' + fechaCorta(hasta) : ''} · por fecha de entrega</p>
        <//>
        <${Card} title=${'Filtros' + (nfiltros ? ' · ' + nfiltros : '')} icon="filter" action=${nfiltros > 0 && html`<button class="link" onClick=${() => setF(VACIO)}>Limpiar</button>`}>
          <${Filtros} tipo=${tipo} f=${f} setF=${setF} opc=${opc} />
        <//>
        <${Card} title=${'Columnas · ' + cols.length + '/' + T.cols.length} icon="columns"
          action=${html`<button class="link" onClick=${() => setCols(cols.length === T.cols.length ? T.def : T.cols.map((c) => c[0]))}>${cols.length === T.cols.length ? 'Predeterminadas' : 'Todas'}</button>`}>
          <div class="chips">${T.cols.map(([k, l]) => html`<button key=${k} class=${'chip-b' + (cols.includes(k) ? ' on' : '')} onClick=${() => setCols(cols.includes(k) ? cols.filter((x) => x !== k) : T.cols.map((c) => c[0]).filter((x) => x === k || cols.includes(x)))}>
            ${cols.includes(k) && html`<${Icon} n="check" size=${12} />`}${l}</button>`)}</div>
        <//>
      </aside>

      <section class="rep-main">
        <${ErrorBox} error=${datos.error} onRetry=${datos.reload} />
        ${!datos.data ? html`<${Card}><${Loader} rows=${6} /><//>` : html`
          <div class="rep-bar">
            <div><b>${num(filas.length)} ${tipo === 'general' ? 'días' : 'registros'}</b><span class="muted small">${nfiltros ? filtrosTxt.join(' · ') : 'Sin filtros adicionales'}</span></div>
            <${Tabs} value=${paso} onChange=${setPaso} items=${[{ v: 'filtros', label: 'Estadísticas' }, { v: 'vista', label: 'Vista previa' }]} />
          </div>
          ${paso === 'filtros' ? html`<${Resumen} est=${est} vacio=${!filas.length} />` : html`<${Vista} filas=${filas} cols=${colDefs} />`}
          <div class="gen-box">
            ${hecho ? html`<div class="gen-ok"><span class="gen-ico"><${Icon} n="check" size=${22} /></span><div><b>${hecho.nombre}</b><span class="muted small">${num(hecho.filas)} registros · Resumen, Datos y Estadísticas</span></div>
              <a class="btn primary" href=${hecho.url} target="_blank" rel="noopener"><${Icon} n="external" size=${16} />Abrir en Google Sheets</a>
              <button class="btn ghost" onClick=${() => setHecho(null)}>Nuevo</button></div>`
            : html`<div class="gen-txt"><b>Generar Google Sheets</b><span class="muted small">Se crea un documento con 3 hojas: Resumen, Datos (${num(filas.length)} filas · ${colDefs.length} columnas) y Estadísticas con gráficos.</span></div>
              <${AsyncButton} className="btn primary big" icon="sheet" disabled=${!filas.length || !colDefs.length} onClick=${generar}>Generar Google Sheets<//>`}
          </div>
          <button class="link center-link" onClick=${onHistorial}><${Icon} n="history" size=${14} />Ver reportes generados</button>`}
      </section>
    </div>
  </div>`;
}

function Filtros({ tipo, f, setF, opc }) {
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const multi = (k, v) => setF({ ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] });
  const pedidoEst = ['pendiente', 'confirmado', 'preparando', 'en_camino', 'entregado', 'no_entregado', 'cancelado'];
  const usa = { pedidos: ['repartidor', 'estado', 'ruta_estado', 'cliente', 'zona', 'producto', 'ruta'], entregas: ['repartidor', 'resultado', 'ruta_estado', 'cliente', 'zona', 'producto', 'ruta'],
    rutas: ['repartidor', 'ruta_estado', 'ruta'], repartidores: ['repartidor'], general: ['repartidor', 'zona', 'producto', 'ruta'] }[tipo];
  return html`<div class="filtros">
    ${usa.includes('repartidor') && html`<${Field} label="Repartidor"><select class="input" value=${f.repartidor} onChange=${set('repartidor')}><option value="">Todos</option>${opc.repartidores.map((x) => html`<option>${x}</option>`)}</select><//>`}
    ${usa.includes('estado') && html`<div class="field"><span class="field-label">Estado del pedido</span><div class="chips">${pedidoEst.map((e) => html`<button key=${e} class=${'chip-b' + (f.estado.includes(e) ? ' on' : '')} onClick=${() => multi('estado', e)}>${estPedido(e)}</button>`)}</div></div>`}
    ${usa.includes('resultado') && html`<${Field} label="Resultado de la entrega"><select class="input" value=${f.resultado} onChange=${set('resultado')}><option value="">Todos</option>${['Exitosa', 'Fallida', 'Pendiente', 'Cancelada'].map((x) => html`<option>${x}</option>`)}</select><//>`}
    ${usa.includes('ruta_estado') && html`<div class="field"><span class="field-label">Estado de la ruta</span><div class="chips">${Object.entries(EST_RUTA).map(([k, l]) => html`<button key=${k} class=${'chip-b' + (f.ruta_estado.includes(k) ? ' on' : '')} onClick=${() => multi('ruta_estado', k)}>${l}</button>`)}</div></div>`}
    ${usa.includes('cliente') && html`<${Field} label="Cliente o destinatario"><input class="input" value=${f.cliente} onInput=${set('cliente')} placeholder="Nombre" /><//>`}
    ${usa.includes('zona') && html`<${Field} label="Ciudad o zona"><select class="input" value=${f.zona} onChange=${set('zona')}><option value="">Todas</option>${opc.zonas.map((x) => html`<option>${x}</option>`)}</select><//>`}
    ${usa.includes('producto') && html`<${Field} label="Producto"><select class="input" value=${f.producto} onChange=${set('producto')}><option value="">Todos</option>${opc.productos.map((x) => html`<option>${x}</option>`)}</select><//>`}
    ${usa.includes('ruta') && html`<${Field} label="Ruta"><select class="input" value=${f.ruta} onChange=${set('ruta')}><option value="">Todas</option>${opc.rutas.map((x) => html`<option>${x}</option>`)}</select><//>`}
    <p class="muted small">Tipo de entrega: hoy todas las entregas son a domicilio, por eso no hay filtro por tipo.</p>
  </div>`;
}

function descripcionFiltros(f) {
  const out = [];
  if (f.repartidor) out.push('Repartidor: ' + f.repartidor);
  if (f.estado.length) out.push('Estado: ' + f.estado.map(estPedido).join(', '));
  if (f.ruta_estado.length) out.push('Estado de ruta: ' + f.ruta_estado.map((x) => EST_RUTA[x]).join(', '));
  if (f.resultado) out.push('Resultado: ' + f.resultado);
  if (f.cliente) out.push('Cliente: ' + f.cliente);
  if (f.zona) out.push('Zona: ' + f.zona);
  if (f.producto) out.push('Producto: ' + f.producto);
  if (f.ruta) out.push('Ruta: ' + f.ruta);
  return out;
}

/* ---------- Estadísticas (siempre sobre los datos filtrados) ---------- */
function contar(arr, fk) { const m = new Map(); for (const x of arr) { const k = fk(x) || 'Sin dato'; m.set(k, (m.get(k) || 0) + 1); } return [...m.entries()].sort((a, b) => b[1] - a[1]); }
function porDia(ped, rut, desde, hasta) {
  const out = [];
  for (let d = new Date(desde + 'T12:00'); isoDate(d) <= hasta; d.setDate(d.getDate() + 1)) {
    const k = isoDate(d), p = ped.filter((x) => x.fecha_entrega === k), r = rut.filter((x) => x.fecha === k);
    out.push({ dia: k, pedidos: p.length, pend: p.filter((x) => ['pendiente', 'confirmado', 'preparando'].includes(x.estado) && !x.ruta_id).length,
      asig: p.filter((x) => x.ruta_id && ['pendiente', 'confirmado', 'preparando', 'en_camino'].includes(x.estado)).length,
      ok: p.filter((x) => x.estado === 'entregado').length, no: p.filter((x) => x.estado === 'no_entregado').length, canc: p.filter((x) => x.estado === 'cancelado').length,
      rutas: r.filter((x) => x.estado !== 'cancelada').length, rutas_fin: r.filter((x) => x.estado === 'terminada').length,
      ventas: sum(p.filter((x) => x.estado === 'entregado'), 'total') });
  }
  return out;
}
const pct = (a, b) => b ? Math.round((a / b) * 1000) / 10 : null;

function estadisticas(tipo, filas, data) {
  const kpis = [], tablas = [];
  if (!data) return { kpis, tablas };
  if (tipo === 'pedidos' || tipo === 'entregas') {
    const ok = filas.filter((x) => x.estado === 'entregado').length, no = filas.filter((x) => x.estado === 'no_entregado').length;
    kpis.push({ l: tipo === 'pedidos' ? 'Pedidos' : 'Entregas', v: filas.length }, { l: 'Entregados', v: ok }, { l: 'Con incidencia', v: no });
    if (tipo === 'pedidos') kpis.push({ l: 'Valor total', v: sum(filas.filter((x) => x.estado !== 'cancelado'), 'total'), t: 'm' }, { l: 'Canastas', v: sum(filas, 'cantidad') });
    if (ok + no) kpis.push({ l: 'Entregas exitosas', v: pct(ok, ok + no) / 100, t: 'p' });
    const tiempos = filas.map((x) => minEntre(x.ruta_iniciada_en, x.entregado_en)).filter((m) => m != null && m >= 0 && m < 600);
    if (tipo === 'entregas' && tiempos.length) kpis.push({ l: 'Minutos promedio desde el inicio de la ruta', v: Math.round(sum(tiempos, (m) => m) / tiempos.length) });
    tablas.push({ titulo: 'Por estado', enc: ['Estado', 'Cantidad'], filas: contar(filas, (x) => estPedido(x.estado)), grafico: 'pie' });
    const dias = contar(filas, (x) => x.fecha_entrega).sort((a, b) => a[0] < b[0] ? -1 : 1);
    tablas.push({ titulo: 'Por día de entrega', enc: ['Fecha', 'Cantidad'], filas: dias, grafico: 'col' });
    const reps = contar(filas.filter((x) => x.repartidor), (x) => x.repartidor);
    if (reps.length) tablas.push({ titulo: 'Por repartidor', enc: ['Repartidor', 'Pedidos', 'Entregados', 'Fallidos', 'Efectividad'], t: 'mix',
      filas: reps.map(([r, n]) => { const a = filas.filter((x) => x.repartidor === r), o = a.filter((x) => x.estado === 'entregado').length, f = a.filter((x) => x.estado === 'no_entregado').length; return [r, n, o, f, o + f ? o / (o + f) : '']; }), grafico: 'bar' });
    tablas.push({ titulo: 'Por zona', enc: ['Zona', 'Cantidad'], filas: contar(filas, (x) => x.municipio || x.barrio).slice(0, 15), grafico: 'bar' });
    if (no) tablas.push({ titulo: 'Motivos de entrega fallida', enc: ['Motivo', 'Cantidad'], filas: contar(filas.filter((x) => x.estado === 'no_entregado'), (x) => MOTIVOS[x.motivo_no_entrega] || 'Sin motivo'), grafico: 'pie' });
  } else if (tipo === 'rutas') {
    const fin = filas.filter((x) => x.estado === 'terminada'), dur = fin.map((x) => minEntre(x.iniciada_en, x.terminada_en)).filter((m) => m != null);
    const ok = sum(filas, 'ok'), no = sum(filas, 'no');
    kpis.push({ l: 'Rutas', v: filas.length }, { l: 'Activas', v: filas.filter((x) => ['planeada', 'en_curso'].includes(x.estado)).length }, { l: 'Finalizadas', v: fin.length },
      { l: 'Pedidos en rutas', v: sum(filas, 'paradas') }, { l: 'Entregas exitosas', v: ok }, { l: 'Entregas fallidas', v: no });
    if (ok + no) kpis.push({ l: 'Efectividad', v: pct(ok, ok + no) / 100, t: 'p' });
    if (dur.length) kpis.push({ l: 'Duración promedio (min)', v: Math.round(sum(dur, (m) => m) / dur.length) });
    tablas.push({ titulo: 'Rutas por estado', enc: ['Estado', 'Rutas'], filas: contar(filas, (x) => EST_RUTA[x.estado]), grafico: 'pie' });
    const reps = contar(filas, (x) => x.repartidor_nombre || 'Sin tomar');
    tablas.push({ titulo: 'Por repartidor', enc: ['Repartidor', 'Rutas', 'Entregas exitosas', 'Fallidas'], filas: reps.map(([r, n]) => { const a = filas.filter((x) => (x.repartidor_nombre || 'Sin tomar') === r); return [r, n, sum(a, 'ok'), sum(a, 'no')]; }), grafico: 'bar' });
    if (dur.length) tablas.push({ titulo: 'Duración de rutas finalizadas', enc: ['Ruta', 'Minutos'], filas: fin.filter((x) => x.iniciada_en && x.terminada_en).map((x) => ['R-' + x.id, minEntre(x.iniciada_en, x.terminada_en)]), grafico: 'col' });
  } else if (tipo === 'repartidores') {
    const ok = sum(filas, (x) => x.stats.entregados), no = sum(filas, (x) => x.stats.fallidos);
    kpis.push({ l: 'Repartidores', v: filas.length }, { l: 'Activos', v: filas.filter((x) => x.estado_cuenta === 'activo').length }, { l: 'Entregas exitosas', v: ok }, { l: 'Entregas fallidas', v: no });
    if (ok + no) kpis.push({ l: 'Efectividad general', v: pct(ok, ok + no) / 100, t: 'p' });
    tablas.push({ titulo: 'Comparación de rendimiento', enc: ['Repartidor', 'Entregados', 'Fallidos', 'Rutas'], filas: filas.map((x) => [x.nombre, x.stats.entregados, x.stats.fallidos, x.stats.rutas_total]), grafico: 'bar' });
    const ef = filas.filter((x) => x.stats.entregados + x.stats.fallidos);
    if (ef.length) tablas.push({ titulo: 'Efectividad por repartidor', enc: ['Repartidor', 'Efectividad'], t: 'p', filas: ef.map((x) => [x.nombre, x.stats.entregados / (x.stats.entregados + x.stats.fallidos)]), grafico: 'bar' });
  } else if (tipo === 'general') {
    const t = (k) => sum(filas, k), ok = t('ok'), no = t('no');
    kpis.push({ l: 'Total de pedidos', v: t('pedidos') }, { l: 'Pendientes de asignar', v: t('pend') }, { l: 'Asignados a ruta', v: t('asig') }, { l: 'Entregados', v: ok },
      { l: 'Con incidencia', v: no }, { l: 'Cancelados', v: t('canc') }, { l: 'Rutas', v: t('rutas') }, { l: 'Rutas finalizadas', v: t('rutas_fin') }, { l: 'Valor entregado', v: t('ventas'), t: 'm' });
    if (ok + no) kpis.push({ l: 'Efectividad', v: pct(ok, ok + no) / 100, t: 'p' });
    tablas.push({ titulo: 'Evolución de entregas', enc: ['Fecha', 'Entregados', 'Con incidencia'], filas: filas.map((x) => [x.dia, x.ok, x.no]), grafico: 'line' });
    const rut = data.rut || [];
    const reps = contar(rut.filter((x) => x.repartidor_nombre), (x) => x.repartidor_nombre);
    if (reps.length) tablas.push({ titulo: 'Rendimiento de repartidores', enc: ['Repartidor', 'Rutas', 'Entregados', 'Fallidos'], filas: reps.map(([r, n]) => { const a = rut.filter((x) => x.repartidor_nombre === r); return [r, n, sum(a, 'ok'), sum(a, 'no')]; }), grafico: 'bar' });
    tablas.push({ titulo: 'Pedidos por estado', enc: ['Estado', 'Cantidad'], filas: contar(data.ped, (x) => estPedido(x.estado)), grafico: 'pie' });
  }
  return { kpis, tablas };
}

const fmtV = (v, t) => v == null || v === '' ? '—' : t === 'm' ? money(v) : t === 'p' ? Math.round(v * 1000) / 10 + '%' : typeof v === 'number' ? num(v) : v;
const COL = ['var(--amber)', 'var(--green)', 'var(--red)', 'var(--blue)', 'var(--violet)', '#1F8A9E', '#D98A00', '#8A8597'];

function Resumen({ est, vacio }) {
  if (vacio) return html`<${Card}><${Empty} icon="chart" title="No hay registros con estos filtros">Cambia el periodo o limpia los filtros.<//><//>`;
  return html`<div class="stack">
    <div class="mini-kpis">${est.kpis.map((k) => html`<div key=${k.l}><b>${fmtV(k.v, k.t)}</b><span>${k.l}</span></div>`)}</div>
    <div class="grid-2">${est.tablas.map((t) => html`<${Card} key=${t.titulo} title=${t.titulo} icon="chart">
      ${t.grafico === 'pie' ? html`<${Donut} data=${t.filas.slice(0, 8).map((r, i) => ({ label: r[0], v: r[1], color: COL[i % COL.length] }))} />`
        : t.grafico === 'col' || t.grafico === 'line' ? html`<${Bars} data=${t.filas.map((r) => ({ k: r[0], label: String(r[0]).length === 10 ? new Date(r[0] + 'T12:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) : r[0], v: Number(r[1]) || 0, tip: r[2] != null ? ' · ' + r[2] + ' con incidencia' : '' }))} fmt=${num} />`
        : html`<${HBars} data=${t.filas.slice(0, 10).map((r) => ({ label: r[0], v: Number(r[1]) || 0, sub: r.length > 2 ? t.enc.slice(2).map((e, i) => e + ': ' + fmtV(r[i + 2], t.t === 'mix' && i === 2 ? 'p' : t.t === 'p' ? 'p' : 'n')).join(' · ') : '' }))} fmt=${(v) => t.t === 'p' ? fmtV(v, 'p') : num(v)} />`}
    <//>`)}</div>
  </div>`;
}

function Vista({ filas, cols }) {
  const muestra = filas.slice(0, 50);
  if (!filas.length) return html`<${Card}><${Empty} icon="file" title="No hay registros con estos filtros" /><//>`;
  return html`<${Card} pad=${false} title=${'Vista previa · primeras ' + muestra.length + ' de ' + num(filas.length)} icon="file">
    <div class="tabla-wrap"><table class="tabla"><thead><tr>${cols.map((c) => html`<th key=${c[0]}>${c[1]}</th>`)}</tr></thead>
      <tbody>${muestra.map((x, i) => html`<tr key=${i}>${cols.map((c) => html`<td key=${c[0]} class=${['n', 'm', 'p'].includes(c[2]) ? 'num' : ''}>${fmtV(c[3](x), c[2])}</td>`)}</tr>`)}</tbody></table></div>
    <div class="tabla-cards">${muestra.map((x, i) => html`<div key=${i} class="tc">${cols.slice(0, 6).map((c) => html`<div key=${c[0]}><span>${c[1]}</span><b>${fmtV(c[3](x), c[2])}</b></div>`)}</div>`)}</div>
    <p class="muted small card-body">El documento de Google Sheets incluirá los ${num(filas.length)} registros.</p>
  <//>`;
}

function Historial() {
  const r = useAsync(() => q(sb.from('reportes').select('*').order('creado_en', { ascending: false }).limit(200)), []);
  const EST = { listo: ['Listo', 'green'], error: ['Error', 'red'], generando: ['Generando', 'amber'] };
  return html`<${Card} pad=${false}>
    <${ErrorBox} error=${r.error} onRetry=${r.reload} />
    ${!r.data ? html`<div class="card-body"><${Loader} /></div>` : !r.data.length ? html`<${Empty} icon="history" title="Aún no has generado reportes" />` :
      html`<div class="list">${r.data.map((x) => html`<div key=${x.id} class="row-item static wrap">
        <div class="ri-main"><b>${x.nombre}</b>
          <span class="ri-meta">${fechaHora(x.creado_en)} · ${x.usuario || ''} · ${x.filas != null ? num(x.filas) + ' registros' : ''}</span>
          ${(x.filtros && x.filtros.length) ? html`<span class="ri-meta">${x.filtros.join(' · ')}</span>` : null}
          ${x.error && html`<span class="neg small">${x.error}</span>`}</div>
        <div class="row-btns"><${Badge} tone=${(EST[x.estado] || [])[1]}>${(EST[x.estado] || [])[0]}<//>
          ${x.url && html`<a class="btn sm" href=${x.url} target="_blank" rel="noopener"><${Icon} n="external" size=${14} />Abrir</a>`}</div>
      </div>`)}</div>`}
  <//>`;
}
