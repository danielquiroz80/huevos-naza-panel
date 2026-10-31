import { html, useState, useMemo, useEffect, Icon, Card, Kpi, Tabs, Loader, Empty, ErrorBox, Modal, Field, AsyncButton, Badge, Meter, useAsync, toast } from '../ui.js';
import { sb, q, money, num, fecha, fechaLarga, fechaCorta, fechaHora, hoyISO, isoDate, sumarDias, sum, groupBy, accion, rutaLink, navegarLink, whatsappLink,
  ubicacionActual, comprimirFoto, MOTIVOS, nombreUsuario } from '../lib.js';
import { Mapa } from '../mapa.js';
import { EstadoBadge } from './pedidos.js';

const ABIERTA = ['pendiente', 'confirmado', 'preparando', 'en_camino'];
const ORIGEN_KEY = 'naza_origen';
const leerOrigen = () => { try { return JSON.parse(localStorage.getItem(ORIGEN_KEY) || 'null') || { texto: '', lat: null, lng: null }; } catch (e) { return { texto: '', lat: null, lng: null }; } };

function HojaCarga({ paradas }) {
  const items = new Map();
  for (const p of paradas) for (const it of p.items || []) items.set(it.producto, (items.get(it.producto) || 0) + (Number(it.cantidad) || 0));
  if (!items.size) return null;
  return html`<div class="carga">${[...items.entries()].sort().map(([k, v]) => html`<div key=${k} class="carga-item"><span class="egg-dot"></span><span>${k}</span><b>${num(v)}</b></div>`)}</div>`;
}

/* =================== Administración de entregas =================== */
export function Entregas({ perfil }) {
  const [tab, setTab] = useState('planear');
  const [verRuta, setVerRuta] = useState(null);
  if (verRuta) return html`<div class="stack"><button class="btn ghost back" onClick=${() => setVerRuta(null)}><${Icon} n="x" size=${16} />Volver a entregas</button>
    <${MiRuta} perfil=${perfil} rutaId=${verRuta} /></div>`;
  return html`<div class="stack">
    <div class="toolbar"><${Tabs} value=${tab} onChange=${setTab} items=${[{ v: 'planear', label: 'Planear ruta' }, { v: 'seguimiento', label: 'Seguimiento' }, { v: 'no', label: 'No entregados' }]} /></div>
    ${tab === 'planear' && html`<${Planear} perfil=${perfil} onVer=${setVerRuta} />`}
    ${tab === 'seguimiento' && html`<${Seguimiento} onVer=${setVerRuta} />`}
    ${tab === 'no' && html`<${NoEntregados} />`}
  </div>`;
}

function Planear({ perfil, onVer }) {
  const fechas = useAsync(async () => {
    const r = await q(sb.from('v_entregas').select('fecha_entrega,estado').gte('fecha_entrega', isoDate(sumarDias(new Date(), -1))).limit(2000));
    return [...new Set(r.filter((x) => ABIERTA.includes(x.estado)).map((x) => x.fecha_entrega))].sort();
  }, []);
  const [dia, setDia] = useState('');
  useEffect(() => { if (!dia && fechas.data && fechas.data.length) setDia(fechas.data[0]); }, [fechas.data]);
  const [rep, setRep] = useState('');
  const [origen, setOrigen] = useState(leerOrigen());
  const [volver, setVolver] = useState(true);
  const [lista, setLista] = useState(null);
  const [info, setInfo] = useState(null);

  const d = useAsync(async () => {
    if (!dia) return null;
    const [pedidos, rutas, reps, secretos] = await Promise.all([
      q(sb.from('v_entregas').select('*').eq('fecha_entrega', dia).order('orden_manual', { nullsFirst: false })),
      q(sb.from('rutas').select('*').eq('fecha', dia)),
      q(sb.from('administradores').select('email,nombre,usuario,capacidad_canastas,activo,rol').eq('rol', 'repartidor').eq('activo', true)),
      q(sb.rpc('panel_secretos_configurados'))
    ]);
    return { pedidos, rutas, reps, google: (secretos || []).includes('google_maps_key') };
  }, [dia]);

  const ruta = d.data ? d.data.rutas.find((r) => (r.repartidor || '') === rep) : null;
  useEffect(() => {
    setInfo(null);
    if (!d.data) return setLista(null);
    const enRuta = ruta ? d.data.pedidos.filter((p) => p.ruta_id === ruta.id && p.estado !== 'cancelado') : [];
    setLista(enRuta.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, minutos: p.minutos_tramo })));
    if (ruta && ruta.origen_texto) setOrigen({ texto: ruta.origen_texto, lat: ruta.origen_lat, lng: ruta.origen_lng });
    if (ruta) setVolver(ruta.volver_origen !== false);
  }, [d.data, rep]);

  if (fechas.loading && !fechas.data) return html`<${Loader} rows=${5} />`;
  if (fechas.data && !fechas.data.length) return html`<${Empty} icon="truck" title="No hay entregas programadas">Cuando haya pedidos con fecha de entrega aparecerán aquí.<//>`;

  const pedidos = d.data ? d.data.pedidos : [];
  const porId = new Map(pedidos.map((p) => [p.id, p]));
  const filas = (lista || []).map((x, i) => ({ ...porId.get(x.id), ...x, n: i + 1 })).filter((x) => x.cliente !== undefined);
  const enLista = new Set(filas.map((p) => p.id));
  const sinRuta = pedidos.filter((p) => !p.ruta_id && ['pendiente', 'confirmado', 'preparando'].includes(p.estado) && !enLista.has(p.id));
  const enOtras = pedidos.filter((p) => p.ruta_id && (!ruta || p.ruta_id !== ruta.id) && ABIERTA.includes(p.estado) && !enLista.has(p.id));
  const repSel = d.data ? d.data.reps.find((r) => r.email === rep) : null;
  const canastas = sum(filas, 'canastas');
  const cambiado = ruta ? JSON.stringify(filas.map((p) => p.id)) !== JSON.stringify(pedidos.filter((p) => p.ruta_id === ruta.id).map((p) => p.id)) : filas.length > 0;
  const editable = !ruta || ruta.estado === 'planeada';

  const mover = (i, dlt) => { const l = [...lista]; const [x] = l.splice(i, 1); l.splice(i + dlt, 0, x); setLista(l); setInfo(null); };
  const quitar = (id) => setLista(lista.filter((x) => x.id !== id));
  const agregar = (p) => setLista([...(lista || []), { id: p.id, lat: p.lat, lng: p.lng, minutos: null }]);
  const usarUbicacion = async () => {
    const u = await ubicacionActual();
    if (!u) throw new Error('No se pudo obtener tu ubicación. Revisa el permiso del navegador.');
    setOrigen({ texto: 'Mi ubicación', lat: u.lat, lng: u.lng });
  };
  const optimizar = async () => {
    if (!filas.length) throw new Error('Agrega pedidos a la ruta.');
    if (!origen.texto && !origen.lat) throw new Error('Escribe el punto de salida o usa tu ubicación.');
    const r = await accion({ accion: 'ruta_optimizar', fecha: dia, ids: filas.map((p) => p.id), origen, volver });
    const x = r.data;
    setLista(x.paradas.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, minutos: p.minutos })));
    if (x.origen && x.origen.lat) setOrigen({ ...origen, lat: x.origen.lat, lng: x.origen.lng });
    setInfo(x);
    toast(r.mensaje);
  };
  const guardar = async () => {
    const id = await q(sb.rpc('panel_guardar_ruta', {
      p_fecha: dia, p_repartidor: rep || null, p_origen_texto: origen.texto || null, p_origen_lat: origen.lat || null, p_origen_lng: origen.lng || null,
      p_volver: volver, p_paradas: filas.map((p) => ({ id: p.id, lat: p.lat || null, lng: p.lng || null, minutos: p.minutos ?? null })),
      p_distancia_km: info ? info.distancia_km : null, p_duracion_min: info ? info.duracion_min : null
    }));
    localStorage.setItem(ORIGEN_KEY, JSON.stringify(origen));
    toast('Ruta guardada' + (rep ? ' y asignada a ' + nombreUsuario(rep) : ''));
    d.reload();
    return id;
  };
  const iniciar = async () => {
    let id = ruta && ruta.id;
    if (!id || cambiado) id = await guardar();
    const r = await accion({ accion: 'ruta_iniciar', ruta_id: id });
    toast(r.mensaje); d.reload();
  };

  return html`
    <div class="toolbar">
      <select class="input auto" value=${dia} onChange=${(e) => { setDia(e.target.value); setRep(''); }} aria-label="Día de entrega">
        ${(fechas.data || []).map((f) => html`<option value=${f}>${fechaCorta(f)}${f === hoyISO() ? ' (hoy)' : ''}</option>`)}
      </select>
      <select class="input auto" value=${rep} onChange=${(e) => setRep(e.target.value)} aria-label="Repartidor">
        <option value="">Ruta sin repartidor asignado</option>
        ${(d.data ? d.data.reps : []).map((r) => html`<option value=${r.email}>${r.nombre || r.usuario}${r.capacidad_canastas ? ' · ' + r.capacidad_canastas + ' canastas' : ''}</option>`)}
      </select>
      ${ruta && html`<${Badge} tone=${ruta.estado === 'en_curso' ? 'violet' : ruta.estado === 'terminada' ? 'green' : 'amber'}>${ruta.estado === 'en_curso' ? 'En curso' : ruta.estado === 'terminada' ? 'Terminada' : 'Planeada'}<//>`}
    </div>
    <${ErrorBox} error=${d.error} onRetry=${d.reload} />
    ${!d.data ? html`<${Loader} rows=${5} />` : html`
    <div class="grid-2 planner">
      <div class="stack">
        <${Card} title="Punto de salida" icon="home">
          <div class="origen">
            <input class="input" placeholder="Ej.: Finca, Calle 10 # 43-20, Envigado" value=${origen.texto}
              onInput=${(e) => setOrigen({ texto: e.target.value, lat: null, lng: null })} disabled=${!editable} />
            <${AsyncButton} className="btn" icon="pin" onClick=${usarUbicacion} disabled=${!editable}>Mi ubicación<//>
          </div>
          <label class="switch small-sw"><input type="checkbox" checked=${volver} onChange=${(e) => setVolver(e.target.checked)} disabled=${!editable} /><span></span>Volver al punto de salida al terminar</label>
          ${!d.data.google && html`<p class="muted small"><${Icon} n="alert" size=${13} /> Sin clave de Google Maps el orden es aproximado. El dueño la agrega en Negocio → Configuración.</p>`}
        <//>

        <${Card} title=${'Paradas (' + filas.length + ')'} icon="truck" pad=${false}
          action=${editable && html`<${AsyncButton} className="btn sm primary" icon="spark" onClick=${optimizar} disabled=${!filas.length}>Ordenar automáticamente<//>`}>
          ${info && html`<div class="info m"><${Icon} n="spark" size=${16} /><span>${info.metodo === 'google' ? 'Orden de Google Maps' : 'Orden aproximado'}${info.distancia_km ? ' · ' + num(info.distancia_km) + ' km' : ''}${info.duracion_min ? ' · ' + num(info.duracion_min) + ' min de manejo' : ''}${(info.avisos || []).length ? '. ' + info.avisos.join(' ') : ''}</span></div>`}
          ${repSel && repSel.capacidad_canastas && canastas > repSel.capacidad_canastas && html`<div class="warn m"><${Icon} n="alert" size=${16} />${num(canastas)} canastas superan la capacidad de ${repSel.nombre || repSel.usuario} (${repSel.capacidad_canastas}).</div>`}
          ${!filas.length ? html`<${Empty} icon="truck" title="La ruta está vacía">Agrega pedidos desde la lista "Sin ruta".<//>` :
            html`<ol class="paradas">${filas.map((p, i) => html`<li key=${p.id} class=${'parada ' + p.estado}>
              <span class="num">${i + 1}</span>
              <div class="ri-main"><b>${p.cliente} <small class="muted">#${p.id}</small></b>
                <span class="muted">${p.direccion_entrega || 'Sin dirección'}${p.barrio ? ' · ' + p.barrio : ''}</span>
                <span class="ri-meta">${num(p.canastas)} canastas${p.minutos != null ? html`<span class="dot"></span>${p.minutos} min desde la anterior` : ''}${!p.lat ? html`<span class="dot"></span><span class="warn-t">sin ubicación</span>` : ''}</span></div>
              <${EstadoBadge} e=${p.estado} />
              ${editable && html`<div class="mini-actions">
                <button class="icon-btn" aria-label="Subir" disabled=${i === 0} onClick=${() => mover(i, -1)}>▲</button>
                <button class="icon-btn" aria-label="Bajar" disabled=${i === filas.length - 1} onClick=${() => mover(i, 1)}>▼</button>
                <button class="icon-btn" aria-label="Quitar" onClick=${() => quitar(p.id)}><${Icon} n="x" size=${15} /></button></div>`}
            </li>`)}</ol>`}
          <div class="card-body actions-row">
            ${editable && html`<${AsyncButton} className="btn" icon="check" onClick=${guardar} disabled=${!filas.length && !ruta}>Guardar${rep ? ' y asignar' : ''}<//>`}
            ${filas.length > 0 && ruta && ruta.estado !== 'terminada' && html`<${AsyncButton} className="btn violet" icon="truck" onClick=${iniciar}>${ruta.estado === 'en_curso' ? 'Reenviar inicio' : 'Iniciar recorrido'}<//>`}
            ${ruta && html`<button class="btn ghost" onClick=${() => onVer(ruta.id)}><${Icon} n="pin" size=${16} />Modo repartidor</button>`}
            ${filas.length > 0 && html`<a class="btn ghost" href=${rutaLink(filas, origen)} target="_blank" rel="noopener"><${Icon} n="external" size=${16} />Google Maps</a>`}
          </div>
        <//>

        ${editable && sinRuta.length > 0 && html`<${Card} title=${'Sin ruta (' + sinRuta.length + ')'} icon="pedidos" pad=${false}>
          <div class="list">${sinRuta.map((p) => html`<button key=${p.id} class="row-item" onClick=${() => agregar(p)}>
            <span class="add-ico"><${Icon} n="plus" size=${16} /></span>
            <div class="ri-main"><b>${p.cliente} <small class="muted">#${p.id}</small></b><span class="muted">${[p.direccion_entrega, p.barrio, p.municipio].filter(Boolean).join(' · ')}</span></div>
            <div class="ri-side"><b>${num(p.canastas)} can.</b><${EstadoBadge} e=${p.estado} /></div></button>`)}</div>
          <div class="card-body"><button class="btn sm ghost" onClick=${() => setLista([...(lista || []), ...sinRuta.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, minutos: null }))])}>Agregar todos</button></div>
        <//>`}
        ${enOtras.length > 0 && html`<p class="muted small">${enOtras.length} pedido(s) de este día están en la ruta de otro repartidor.</p>`}
      </div>

      <div class="stack">
        <${Card} title="Mapa" icon="pin" pad=${false}><${Mapa} origen=${origen} paradas=${filas} height=${360} /><//>
        <${Card} title=${'Hoja de carga · ' + num(canastas) + ' canastas'} icon="box">
          ${filas.length ? html`<${HojaCarga} paradas=${filas} />` : html`<span class="muted">Agrega paradas para ver qué subir al vehículo.</span>`}
        <//>
      </div>
    </div>`}
  `;
}

function Seguimiento({ onVer }) {
  const r = useAsync(async () => {
    const desde = isoDate(sumarDias(new Date(), -7));
    const [rutas, paradas] = await Promise.all([
      q(sb.from('rutas').select('*').gte('fecha', desde).order('fecha', { ascending: false })),
      q(sb.from('v_entregas').select('id,ruta_id,estado,cliente,orden_manual,canastas,motivo_no_entrega,entregado_en,foto_entrega,entrega_obs').gte('fecha_entrega', desde).not('ruta_id', 'is', null))
    ]);
    return { rutas, paradas };
  }, []);
  const verFoto = async (path) => {
    const { data, error } = await sb.storage.from('entregas').createSignedUrl(path, 300);
    if (error) throw new Error(error.message);
    window.open(data.signedUrl, '_blank', 'noopener');
  };
  if (r.loading && !r.data) return html`<${Loader} rows=${5} />`;
  if (!r.data || !r.data.rutas.length) return html`<${ErrorBox} error=${r.error} onRetry=${r.reload} /><${Empty} icon="truck" title="No hay rutas en los últimos días" />`;
  return html`<div class="stack">${r.data.rutas.map((ru) => {
    const ps = r.data.paradas.filter((p) => p.ruta_id === ru.id).sort((a, b) => (a.orden_manual ?? 99) - (b.orden_manual ?? 99));
    const ok = ps.filter((p) => p.estado === 'entregado').length, no = ps.filter((p) => p.estado === 'no_entregado').length;
    return html`<${Card} key=${ru.id} title=${fechaLarga(ru.fecha) + (ru.repartidor ? ' · ' + nombreUsuario(ru.repartidor) : '')} icon="truck"
      action=${html`<button class="btn sm ghost" onClick=${() => onVer(ru.id)}>Abrir</button>`}>
      <div class="progreso"><${Meter} value=${ok + no} max=${Math.max(ps.length, 1)} tone="amber" /><span>${ok + no}/${ps.length} · ${ok} entregados${no ? ' · ' + no + ' no entregados' : ''}</span></div>
      <div class="lines">${ps.map((p, i) => html`<div class="line" key=${p.id}><span><b>${i + 1}.</b> ${p.cliente} <small class="muted">#${p.id} · ${num(p.canastas)} can.</small>
        ${p.estado === 'no_entregado' && html`<br /><small class="neg">${MOTIVOS[p.motivo_no_entrega] || ''}${p.entrega_obs ? ': ' + p.entrega_obs : ''}</small>`}
        ${p.entregado_en && html`<br /><small class="muted">${fechaHora(p.entregado_en)}</small>`}</span>
        <span class="line-r">${p.foto_entrega && html`<${AsyncButton} className="btn sm ghost" icon="external" onClick=${() => verFoto(p.foto_entrega)}>Foto<//>`}<${EstadoBadge} e=${p.estado} /></span></div>`)}</div>
    <//>`;
  })}</div>`;
}

function NoEntregados() {
  const r = useAsync(() => q(sb.from('v_entregas').select('*').eq('estado', 'no_entregado').order('fecha_entrega', { ascending: false })), []);
  const [dlg, setDlg] = useState(null);
  const reprogramar = async () => {
    await q(sb.rpc('panel_reprogramar', { p_pedido: dlg.p.id, p_fecha: dlg.fecha }));
    toast('Pedido #' + dlg.p.id + ' reprogramado para el ' + fechaCorta(dlg.fecha)); setDlg(null); r.reload();
  };
  const cancelar = async () => {
    const x = await accion({ accion: 'cancelar', pedido_id: dlg.p.id, motivo: dlg.motivo });
    toast(x.mensaje || 'Pedido cancelado'); setDlg(null); r.reload();
  };
  return html`<${Card} title="Pedidos no entregados" icon="alert" pad=${false}>
    <${ErrorBox} error=${r.error} onRetry=${r.reload} />
    ${r.loading && !r.data ? html`<div class="card-body"><${Loader} /></div>` : (r.data || []).length === 0 ? html`<${Empty} icon="check" title="No hay pedidos pendientes de reprogramar" />` :
      html`<div class="list">${r.data.map((p) => html`<div class="row-item static" key=${p.id}>
        <div class="ri-id">#${p.id}</div>
        <div class="ri-main"><b>${p.cliente}</b><span class="neg small">${MOTIVOS[p.motivo_no_entrega] || 'Sin motivo'}${p.entrega_obs ? ': ' + p.entrega_obs : ''}</span>
          <span class="ri-meta">${fechaCorta(p.fecha_entrega)}<span class="dot"></span>${p.direccion_entrega || ''}<span class="dot"></span>${num(p.canastas)} canastas</span></div>
        <div class="ri-side row-btns">
          <button class="btn sm primary" onClick=${() => setDlg({ t: 'rep', p, fecha: isoDate(sumarDias(new Date(), 1)) })}>Reprogramar</button>
          <button class="btn sm danger-ghost" onClick=${() => setDlg({ t: 'can', p, motivo: '' })}>Cancelar</button></div>
      </div>`)}</div>`}
    ${dlg && dlg.t === 'rep' && html`<${Modal} title=${'Reprogramar pedido #' + dlg.p.id} onClose=${() => setDlg(null)}
      footer=${html`<button class="btn ghost" onClick=${() => setDlg(null)}>Volver</button><${AsyncButton} className="btn primary" icon="calendar" onClick=${reprogramar}>Reprogramar<//>`}>
      <${Field} label="Nueva fecha de entrega"><input class="input" type="date" min=${hoyISO()} value=${dlg.fecha} onInput=${(e) => setDlg({ ...dlg, fecha: e.target.value })} /><//>
      <p class="muted">El pedido vuelve a "Confirmado" y queda listo para agregarlo a la ruta de ese día. El stock sigue reservado.</p><//>`}
    ${dlg && dlg.t === 'can' && html`<${Modal} title=${'Cancelar pedido #' + dlg.p.id} onClose=${() => setDlg(null)}
      footer=${html`<button class="btn ghost" onClick=${() => setDlg(null)}>Volver</button><${AsyncButton} className="btn danger" icon="x" onClick=${cancelar}>Cancelar pedido<//>`}>
      <p>Las canastas vuelven al inventario y se avisa al cliente.</p>
      <${Field} label="Motivo (opcional, lo ve el cliente)"><textarea class="input" rows="2" value=${dlg.motivo} onInput=${(e) => setDlg({ ...dlg, motivo: e.target.value })}></textarea><//><//>`}
  <//>`;
}

/* =================== Vista del repartidor =================== */
export function MiRuta({ perfil, rutaId }) {
  const gestor = perfil.rol !== 'repartidor';
  const r = useAsync(async () => {
    let ruta;
    if (rutaId) ruta = await q(sb.from('rutas').select('*').eq('id', rutaId).maybeSingle());
    else {
      const rs = await q(sb.from('rutas').select('*').eq('repartidor', perfil.email).gte('fecha', isoDate(sumarDias(new Date(), -1))).order('fecha'));
      ruta = rs.find((x) => x.estado === 'en_curso') || rs.find((x) => x.estado === 'planeada') || rs[rs.length - 1] || null;
    }
    if (!ruta) return { ruta: null, paradas: [] };
    const paradas = await q(sb.from('v_entregas').select('*').eq('ruta_id', ruta.id).order('orden_manual', { nullsFirst: false }));
    return { ruta, paradas };
  }, [rutaId]);
  const [dlg, setDlg] = useState(null);
  const [verMapa, setVerMapa] = useState(false);

  if (r.loading && !r.data) return html`<${Loader} rows=${6} />`;
  if (r.error && !r.data) return html`<${ErrorBox} error=${r.error} onRetry=${r.reload} />`;
  const { ruta, paradas } = r.data;
  if (!ruta) return html`<${Empty} icon="truck" title="No tienes rutas asignadas">Cuando la oficina te asigne una ruta aparecerá aquí.<//>`;

  const pendientes = paradas.filter((p) => ABIERTA.includes(p.estado));
  const actual = pendientes.find((p) => p.estado === 'en_camino') || pendientes[0] || null;
  const hechos = paradas.filter((p) => ['entregado', 'no_entregado'].includes(p.estado));
  const ok = paradas.filter((p) => p.estado === 'entregado').length;
  const origen = { lat: ruta.origen_lat, lng: ruta.origen_lng };

  const iniciar = async () => { const x = await accion({ accion: 'ruta_iniciar', ruta_id: ruta.id }); toast(x.mensaje); r.reload(); };
  const registrar = async (payload) => {
    const x = await accion({ accion: 'entrega', ...payload });
    toast(x.mensaje); setDlg(null); r.reload();
    if (navigator.vibrate) navigator.vibrate(60);
  };

  return html`<div class="stack ruta-view">
    <section class="ruta-head">
      <div><span class="hero-kicker">${fechaLarga(ruta.fecha)}</span>
        <h2>${ruta.estado === 'terminada' ? 'Ruta terminada' : ruta.estado === 'en_curso' ? 'En recorrido' : 'Ruta lista'}</h2>
        <span>${hechos.length} de ${paradas.length} paradas · ${num(sum(pendientes, 'canastas'))} canastas por entregar</span></div>
      <div class="ruta-ring" style=${{ '--p': paradas.length ? Math.round((hechos.length / paradas.length) * 100) : 0 }}><b>${paradas.length ? Math.round((hechos.length / paradas.length) * 100) : 0}%</b></div>
    </section>

    ${ruta.estado === 'planeada' && pendientes.length > 0 && html`<div class="start-box">
      <div><b>¿Listo para salir?</b><span class="muted">Al iniciar, cada cliente recibe su turno y la hora aproximada.</span></div>
      <${AsyncButton} className="btn violet big" icon="truck" onClick=${iniciar}>Iniciar recorrido<//></div>`}

    ${actual ? html`<section class="parada-actual">
      <div class="pa-top"><span class="pa-num">${paradas.indexOf(actual) + 1}</span>
        <div><span class="hero-kicker">${actual.estado === 'en_camino' ? 'Vas hacia' : 'Siguiente parada'}</span><h3>${actual.cliente}</h3></div>
        <${EstadoBadge} e=${actual.estado} /></div>
      <div class="pa-dir"><${Icon} n="pin" size=${18} /><div><b>${actual.direccion_entrega || 'Sin dirección'}</b><span class="muted">${[actual.barrio, actual.municipio].filter(Boolean).join(', ')}</span></div></div>
      ${(actual.indicaciones || actual.notas) && html`<div class="pa-nota"><${Icon} n="chat" size=${16} /><span>${[actual.indicaciones, actual.notas].filter(Boolean).join(' · ')}</span></div>`}
      <div class="pa-items">${(actual.items || []).map((it) => html`<span key=${it.producto} class="chip"><b>${it.cantidad}</b> ${it.producto}</span>`)}</div>
      <div class="pa-pago">${actual.pago_estado === 'pagado' ? html`<${Badge} tone="green">Ya pagó<//>` : html`<${Badge} tone="gray">Pago gestionado por la oficina<//>`}</div>
      <div class="pa-nav">
        <a class="btn" href=${navegarLink(actual)} target="_blank" rel="noopener"><${Icon} n="external" size=${16} />Google Maps</a>
        <a class="btn" href=${navegarLink(actual, 'waze')} target="_blank" rel="noopener"><${Icon} n="truck" size=${16} />Waze</a>
        ${actual.telefono && html`<a class="btn" href=${'tel:' + actual.telefono}><${Icon} n="phone" size=${16} />Llamar</a>`}
        ${actual.telefono && html`<a class="btn" href=${whatsappLink(actual.telefono, 'Hola, soy el repartidor de Huevos de la Naza. Estoy llegando con tu pedido.')} target="_blank" rel="noopener"><${Icon} n="chat" size=${16} />WhatsApp</a>`}
        <button class="btn ghost" onClick=${() => setDlg({ t: 'nota', p: actual, texto: actual.indicaciones || '' })}><${Icon} n="edit" size=${16} />Indicaciones</button>
      </div>
      ${ruta.estado !== 'planeada' || gestor ? html`<div class="pa-acciones">
        <button class="btn green big" onClick=${() => setDlg({ t: 'ok', p: actual, detalle: '', foto: null })}><${Icon} n="check" size=${20} />Entregado</button>
        <button class="btn danger-ghost big" onClick=${() => setDlg({ t: 'no', p: actual, motivo: '', detalle: '' })}><${Icon} n="x" size=${20} />No entregado</button>
      </div>` : html`<p class="muted small">Inicia el recorrido para marcar entregas.</p>`}
    </section>` : html`<section class="fin-ruta">
      <div class="empty-ico big"><${Icon} n="check" size=${34} /></div>
      <h3>¡Recorrido completo!</h3>
      <p>${ok} entregados${paradas.length - ok ? ' · ' + (paradas.length - ok) + ' no entregados' : ''}${ruta.iniciada_en && ruta.terminada_en ? ' · ' + Math.round((new Date(ruta.terminada_en) - new Date(ruta.iniciada_en)) / 60000) + ' min en ruta' : ''}</p>
    </section>`}

    <${Card} title="Mapa de la ruta" icon="pin" pad=${false} action=${html`<button class="btn sm ghost" onClick=${() => setVerMapa(!verMapa)}>${verMapa ? 'Ocultar' : 'Mostrar'}</button>`}>
      ${verMapa && html`<${Mapa} origen=${origen} paradas=${paradas} actual=${actual && actual.id} height=${300} />`}
    <//>

    <${Card} title="Todas las paradas" icon="pedidos" pad=${false}>
      <ol class="paradas">${paradas.map((p, i) => html`<li key=${p.id} class=${'parada ' + p.estado + (actual && p.id === actual.id ? ' actual' : '')}>
        <span class="num">${p.estado === 'entregado' ? '✓' : p.estado === 'no_entregado' ? '!' : i + 1}</span>
        <div class="ri-main"><b>${p.cliente}</b><span class="muted">${p.direccion_entrega || ''}${p.barrio ? ' · ' + p.barrio : ''}</span>
          <span class="ri-meta">${num(p.canastas)} canastas${p.estado === 'no_entregado' ? html`<span class="dot"></span><span class="neg">${MOTIVOS[p.motivo_no_entrega] || ''}</span>` : ''}</span></div>
        <${EstadoBadge} e=${p.estado} />
      </li>`)}</ol>
    <//>

    ${dlg && dlg.t === 'ok' && html`<${EntregarModal} p=${dlg.p} ruta=${ruta} onClose=${() => setDlg(null)} onSend=${registrar} />`}
    ${dlg && dlg.t === 'no' && html`<${Modal} title=${'No entregado · ' + dlg.p.cliente} onClose=${() => setDlg(null)}
      footer=${html`<button class="btn ghost" onClick=${() => setDlg(null)}>Volver</button>
        <${AsyncButton} className="btn danger" icon="x" disabled=${!dlg.motivo || (dlg.motivo === 'otro' && !dlg.detalle.trim())}
          onClick=${() => registrar({ pedido_id: dlg.p.id, resultado: 'no_entregado', motivo: dlg.motivo, detalle: dlg.detalle })}>Registrar<//>`}>
      <div class="radio-list">${Object.entries(MOTIVOS).map(([k, v]) => html`<label key=${k} class=${'radio' + (dlg.motivo === k ? ' on' : '')}>
        <input type="radio" name="motivo" checked=${dlg.motivo === k} onChange=${() => setDlg({ ...dlg, motivo: k })} />${v}</label>`)}</div>
      <${Field} label=${dlg.motivo === 'otro' ? 'Cuéntanos qué pasó' : 'Detalle (opcional)'}><textarea class="input" rows="2" value=${dlg.detalle} onInput=${(e) => setDlg({ ...dlg, detalle: e.target.value })}></textarea><//>
      <p class="muted small">Se avisa al cliente y a la oficina, y se notifica al siguiente cliente de la ruta.</p>
    <//>`}
    ${dlg && dlg.t === 'nota' && html`<${Modal} title=${'Indicaciones · ' + dlg.p.cliente} onClose=${() => setDlg(null)}
      footer=${html`<button class="btn ghost" onClick=${() => setDlg(null)}>Cancelar</button>
        <${AsyncButton} className="btn primary" icon="check" onClick=${async () => { await q(sb.rpc('panel_indicaciones', { p_cliente: dlg.p.cliente_id, p_texto: dlg.texto })); toast('Indicaciones guardadas'); setDlg(null); r.reload(); }}>Guardar<//>`}>
      <${Field} label="Para la próxima entrega" hint="Ej.: portería torre 2, timbre 301, perro bravo."><textarea class="input" rows="3" value=${dlg.texto} onInput=${(e) => setDlg({ ...dlg, texto: e.target.value })}></textarea><//>
    <//>`}
  </div>`;
}

function EntregarModal({ p, ruta, onClose, onSend }) {
  const [foto, setFoto] = useState(null);
  const [prev, setPrev] = useState('');
  const [detalle, setDetalle] = useState('');
  const elegir = (e) => { const f = e.target.files && e.target.files[0]; if (!f) return; setFoto(f); setPrev(URL.createObjectURL(f)); };
  const enviar = async () => {
    const [ubic, path] = await Promise.all([
      ubicacionActual(7000),
      (async () => {
        if (!foto) return null;
        const blob = await comprimirFoto(foto);
        const ruta_ = `${ruta.fecha}/${p.id}-${Date.now()}.jpg`;
        const { error } = await sb.storage.from('entregas').upload(ruta_, blob, { contentType: 'image/jpeg', upsert: false });
        if (error) throw new Error('No se pudo subir la foto: ' + error.message);
        return ruta_;
      })()
    ]);
    await onSend({ pedido_id: p.id, resultado: 'entregado', lat: ubic && ubic.precision < 200 ? ubic.lat : null, lng: ubic && ubic.precision < 200 ? ubic.lng : null, foto: path, detalle });
  };
  return html`<${Modal} title=${'Entregar a ' + p.cliente} onClose=${onClose}
    footer=${html`<button class="btn ghost" onClick=${onClose}>Volver</button><${AsyncButton} className="btn green" icon="check" onClick=${enviar}>Confirmar entrega<//>`}>
    <div class="pa-items">${(p.items || []).map((it) => html`<span key=${it.producto} class="chip"><b>${it.cantidad}</b> ${it.producto}</span>`)}</div>
    <label class="foto-input">
      ${prev ? html`<img src=${prev} alt="Foto de la entrega" />` : html`<span><${Icon} n="download" size=${22} />Tomar foto de evidencia (opcional)</span>`}
      <input type="file" accept="image/*" capture="environment" onChange=${elegir} />
    </label>
    <${Field} label="Observación (opcional)"><input class="input" value=${detalle} onInput=${(e) => setDetalle(e.target.value)} placeholder="Ej.: lo recibió el portero" /><//>
    <p class="muted small">Se guarda la ubicación de la entrega para mejorar la ruta de la próxima vez, se avisa al cliente y al siguiente de la ruta.</p>
  <//>`;
}
