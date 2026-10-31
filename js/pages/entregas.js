import { html, useState, useEffect, useRef, Icon, Card, Kpi, Tabs, Loader, Empty, ErrorBox, Modal, Field, AsyncButton, Badge, Meter, useAsync, toast } from '../ui.js';
import { sb, q, num, fechaLarga, fechaCorta, fechaHora, hoyISO, isoDate, sumarDias, sum, accion, rutaLink, navegarLink, whatsappLink,
  ubicacionActual, comprimirFoto, MOTIVOS, nombreUsuario } from '../lib.js';
import { Mapa, MapaRutas, COLORES_RUTA } from '../mapa.js';
import { EstadoBadge } from './pedidos.js';

const ABIERTA = ['pendiente', 'confirmado', 'preparando', 'en_camino'];
const ORIGEN_KEY = 'naza_origen';
const leerOrigen = () => { try { return JSON.parse(localStorage.getItem(ORIGEN_KEY) || 'null') || { texto: '', lat: null, lng: null }; } catch (e) { return { texto: '', lat: null, lng: null }; } };
const hace = (t) => { if (!t) return ''; const m = Math.round((Date.now() - new Date(t)) / 60000); return m < 1 ? 'hace un momento' : m < 60 ? 'hace ' + m + ' min' : 'hace ' + Math.round(m / 60) + ' h'; };
const ESTADO_RUTA = { planeada: ['Por iniciar', 'amber'], en_curso: ['En recorrido', 'violet'], terminada: ['Terminada', 'green'] };
const copiar = (t) => navigator.clipboard && navigator.clipboard.writeText(t).then(() => toast('Dirección copiada'));

/** Dirección grande y clara, con barrio y municipio. */
function Direccion({ p, grande }) {
  return html`<div class=${'dir' + (grande ? ' grande' : '')}>
    <${Icon} n="pin" size=${grande ? 20 : 16} />
    <div><b>${p.direccion_entrega || 'Sin dirección'}</b><span>${[p.barrio, p.municipio].filter(Boolean).join(' · ')}</span></div>
  </div>`;
}

function HojaCarga({ paradas }) {
  const items = new Map();
  for (const p of paradas) for (const it of p.items || []) items.set(it.producto, (items.get(it.producto) || 0) + (Number(it.cantidad) || 0));
  if (!items.size) return html`<span class="muted">Agrega paradas para ver qué cargar.</span>`;
  return html`<div class="carga">${[...items.entries()].sort().map(([k, v]) => html`<div key=${k} class="carga-item"><span class="egg-dot"></span><span>${k}</span><b>${num(v)}</b></div>`)}</div>`;
}

/* =================== Entregas (Admin y Operador) =================== */
export function Entregas({ perfil }) {
  const [tab, setTab] = useState('vivo');
  const [verRuta, setVerRuta] = useState(null);
  if (verRuta) return html`<div class="stack"><button class="btn ghost back" onClick=${() => setVerRuta(null)}><${Icon} n="down2" size=${16} />Volver</button>
    <${MiRuta} perfil=${perfil} rutaId=${verRuta} /></div>`;
  return html`<div class="stack">
    <div class="toolbar"><${Tabs} value=${tab} onChange=${setTab} items=${[{ v: 'vivo', label: 'En vivo' }, { v: 'planear', label: 'Planear rutas' }, { v: 'no', label: 'No entregados' }]} /></div>
    ${tab === 'vivo' && html`<${EnVivo} onVer=${setVerRuta} onPlanear=${() => setTab('planear')} />`}
    ${tab === 'planear' && html`<${Planear} onVer=${setVerRuta} />`}
    ${tab === 'no' && html`<${NoEntregados} />`}
  </div>`;
}

/* ---------- Seguimiento en vivo ---------- */
function EnVivo({ onVer, onPlanear }) {
  const [dia, setDia] = useState(hoyISO());
  const r = useAsync(async () => {
    const [rutas, admins] = await Promise.all([
      q(sb.from('rutas').select('*').eq('fecha', dia).order('id')),
      q(sb.from('administradores').select('email,nombre,usuario,telefono,capacidad_canastas').eq('rol', 'repartidor'))
    ]);
    const ids = rutas.map((x) => x.id);
    const paradas = ids.length ? await q(sb.from('v_entregas').select('id,ruta_id,estado,cliente,direccion_entrega,barrio,municipio,orden_manual,canastas,lat,lng,entregado_en,motivo_no_entrega,foto_entrega,entrega_obs').in('ruta_id', ids)) : [];
    const sinRuta = await q(sb.from('v_entregas').select('id', { count: 'exact', head: false }).eq('fecha_entrega', dia).is('ruta_id', null).in('estado', ['pendiente', 'confirmado', 'preparando']));
    return { rutas, admins, paradas, sinRuta: sinRuta.length };
  }, [dia]);
  useEffect(() => { const t = setInterval(() => r.reload(), 30000); return () => clearInterval(t); }, [dia]);
  const verFoto = async (path) => { const { data, error } = await sb.storage.from('entregas').createSignedUrl(path, 300); if (error) throw new Error(error.message); window.open(data.signedUrl, '_blank', 'noopener'); };

  const d = r.data;
  const rutas = d ? d.rutas.map((ru, i) => {
    const a = d.admins.find((x) => x.email === ru.repartidor);
    const ps = d.paradas.filter((p) => p.ruta_id === ru.id).sort((x, y) => (x.orden_manual ?? 99) - (y.orden_manual ?? 99));
    const hechos = ps.filter((p) => ['entregado', 'no_entregado'].includes(p.estado));
    const actual = ps.find((p) => p.estado === 'en_camino') || ps.find((p) => ABIERTA.includes(p.estado));
    const ultima = hechos.map((p) => p.entregado_en).filter(Boolean).sort().pop();
    return { ...ru, color: COLORES_RUTA[i % COLORES_RUTA.length], nombre: a ? (a.nombre || a.usuario) : 'Sin repartidor', telefono: a && a.telefono, paradas: ps, hechos, actual, ultima,
      ok: ps.filter((p) => p.estado === 'entregado').length, no: ps.filter((p) => p.estado === 'no_entregado').length };
  }) : [];
  const total = sum(rutas, (x) => x.paradas.length), hechos = sum(rutas, (x) => x.hechos.length);

  return html`<div class="stack">
    <div class="toolbar">
      <input class="input auto" type="date" value=${dia} onInput=${(e) => setDia(e.target.value)} aria-label="Día" />
      <span class="live-dot"><${Icon} n="live" size=${16} />Se actualiza cada 30 s</span>
    </div>
    <${ErrorBox} error=${r.error} onRetry=${r.reload} />
    ${!d ? html`<${Loader} rows=${6} />` : !rutas.length ? html`<${Card}><${Empty} icon="truck" title=${'No hay rutas para el ' + fechaCorta(dia)}>${d.sinRuta ? d.sinRuta + ' pedido(s) esperan ruta. ' : ''}Crea las rutas en "Planear rutas".<//>
        <div class="center"><button class="btn primary" onClick=${onPlanear}><${Icon} n="truck" size=${16} />Planear rutas</button></div><//>` : html`
      <div class="kpis">
        <${Kpi} icon="truck" label="Rutas" value=${num(rutas.length)} sub=${rutas.filter((x) => x.estado === 'en_curso').length + ' en recorrido'} tone="violet" />
        <${Kpi} icon="check" label="Entregados" value=${num(sum(rutas, 'ok'))} sub=${'de ' + num(total) + ' paradas'} tone="green" />
        <${Kpi} icon="alert" label="No entregados" value=${num(sum(rutas, 'no'))} tone="red" />
        <${Kpi} icon="pedidos" label="Avance del día" value=${total ? Math.round((hechos / total) * 100) + '%' : '—'} sub=${d.sinRuta ? d.sinRuta + ' sin ruta' : 'todo asignado'} />
      </div>
      <div class="grid-2 vivo">
        <div class="stack">${rutas.map((ru) => {
          const [et, tone] = ESTADO_RUTA[ru.estado] || ['', 'gray'];
          const pct = ru.paradas.length ? Math.round((ru.hechos.length / ru.paradas.length) * 100) : 0;
          return html`<section key=${ru.id} class="rep-card" style=${{ '--c': ru.color }}>
            <header>
              <div class="rep-avatar">${ru.nombre.slice(0, 1).toUpperCase()}</div>
              <div class="rep-info"><b>${ru.nombre}</b><span>${ru.hechos.length}/${ru.paradas.length} paradas · ${num(sum(ru.paradas, 'canastas'))} canastas</span></div>
              <${Badge} tone=${tone}>${et}<//>
            </header>
            <div class="rep-prog"><div style=${{ width: pct + '%' }}></div></div>
            ${ru.actual ? html`<div class="rep-actual"><span class="hero-kicker">${ru.actual.estado === 'en_camino' ? 'Va hacia' : 'Siguiente'} · parada ${ru.paradas.indexOf(ru.actual) + 1}</span>
              <b>${ru.actual.cliente}</b><span class="muted">${ru.actual.direccion_entrega}${ru.actual.barrio ? ' · ' + ru.actual.barrio : ''}</span></div>` :
              html`<div class="rep-actual"><b>${ru.estado === 'terminada' ? '¡Ruta completada!' : 'Sin paradas pendientes'}</b></div>`}
            <div class="rep-meta">
              ${ru.iniciada_en && html`<span><${Icon} n="play" size=${13} />Salió ${fechaHora(ru.iniciada_en)}</span>`}
              ${ru.ultima && html`<span><${Icon} n="check" size=${13} />Última entrega ${hace(ru.ultima)}</span>`}
              ${ru.ultima_ubicacion_en && html`<span><${Icon} n="nav" size=${13} />Ubicación ${hace(ru.ultima_ubicacion_en)}</span>`}
              ${ru.no > 0 && html`<span class="neg"><${Icon} n="alert" size=${13} />${ru.no} no entregado(s)</span>`}
            </div>
            <details class="rep-det"><summary>Ver paradas</summary>
              <ol class="paradas compacta">${ru.paradas.map((p, i) => html`<li key=${p.id} class=${'parada ' + p.estado}>
                <span class="num">${p.estado === 'entregado' ? '✓' : p.estado === 'no_entregado' ? '!' : i + 1}</span>
                <div class="ri-main"><b>${p.direccion_entrega}</b><span class="muted">${p.cliente}${p.estado === 'no_entregado' ? ' · ' + (MOTIVOS[p.motivo_no_entrega] || '') : ''}${p.entregado_en ? ' · ' + fechaHora(p.entregado_en) : ''}</span></div>
                ${p.foto_entrega ? html`<${AsyncButton} className="btn sm ghost" icon="external" onClick=${() => verFoto(p.foto_entrega)}>Foto<//>` : html`<${EstadoBadge} e=${p.estado} />`}
              </li>`)}</ol></details>
            <div class="rep-btns">
              <button class="btn sm" onClick=${() => onVer(ru.id)}><${Icon} n="pin" size=${15} />Abrir ruta</button>
              ${ru.telefono && html`<a class="btn sm ghost" href=${'tel:' + ru.telefono}><${Icon} n="phone" size=${15} />Llamar</a>`}
              ${ru.telefono && html`<a class="btn sm ghost" href=${whatsappLink(ru.telefono)} target="_blank" rel="noopener"><${Icon} n="chat" size=${15} />WhatsApp</a>`}
            </div>
          </section>`;
        })}</div>
        <div class="sticky-col"><${Card} title="Mapa del día" icon="pin" pad=${false}><${MapaRutas} rutas=${rutas} height=${460} />
          <div class="leyenda">${rutas.map((ru) => html`<span key=${ru.id}><i style=${{ background: ru.color }}></i>${ru.nombre}</span>`)}<span><i class="ok"></i>Entregado</span><span><i class="no"></i>No entregado</span></div><//></div>
      </div>`}
  </div>`;
}

/* ---------- Planear rutas ---------- */
function Planear({ onVer }) {
  const fechas = useAsync(async () => {
    const r = await q(sb.from('v_entregas').select('fecha_entrega,estado').gte('fecha_entrega', isoDate(sumarDias(new Date(), -1))).limit(2000));
    return [...new Set(r.filter((x) => ABIERTA.includes(x.estado)).map((x) => x.fecha_entrega))].sort();
  }, []);
  const [dia, setDia] = useState('');
  useEffect(() => { if (!dia && fechas.data && fechas.data.length) setDia(fechas.data.includes(hoyISO()) ? hoyISO() : fechas.data[0]); }, [fechas.data]);
  const [rep, setRep] = useState(null);
  const [origen, setOrigen] = useState(leerOrigen());
  const [volver, setVolver] = useState(true);
  const [lista, setLista] = useState(null);
  const [info, setInfo] = useState(null);

  const d = useAsync(async () => {
    if (!dia) return null;
    const [pedidos, rutas, reps, secretos] = await Promise.all([
      q(sb.from('v_entregas').select('*').eq('fecha_entrega', dia).order('orden_manual', { nullsFirst: false })),
      q(sb.from('rutas').select('*').eq('fecha', dia)),
      q(sb.from('administradores').select('email,nombre,usuario,capacidad_canastas,activo,rol').eq('rol', 'repartidor').eq('activo', true).order('usuario')),
      q(sb.rpc('panel_secretos_configurados'))
    ]);
    return { pedidos, rutas, reps, google: (secretos || []).includes('google_maps_key') };
  }, [dia]);
  useEffect(() => { if (d.data && rep === null) setRep(d.data.reps[0] ? d.data.reps[0].email : ''); }, [d.data]);

  const ruta = d.data && rep !== null ? d.data.rutas.find((x) => (x.repartidor || '') === rep) : null;
  useEffect(() => {
    setInfo(null);
    if (!d.data || rep === null) return setLista(null);
    const enRuta = ruta ? d.data.pedidos.filter((p) => p.ruta_id === ruta.id).sort((a, b) => (a.orden_manual ?? 99) - (b.orden_manual ?? 99)) : [];
    setLista(enRuta.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, minutos: p.minutos_tramo })));
    if (ruta && ruta.origen_texto) setOrigen({ texto: ruta.origen_texto, lat: ruta.origen_lat, lng: ruta.origen_lng });
    if (ruta) setVolver(ruta.volver_origen !== false);
  }, [d.data, rep]);

  if (fechas.loading && !fechas.data) return html`<${Loader} rows=${5} />`;
  if (fechas.data && !fechas.data.length) return html`<${Card}><${Empty} icon="truck" title="No hay pedidos por entregar">Cuando haya pedidos con fecha de entrega aparecerán aquí.<//><//>`;

  const pedidos = d.data ? d.data.pedidos : [];
  const porId = new Map(pedidos.map((p) => [p.id, p]));
  const filas = (lista || []).map((x) => ({ ...porId.get(x.id), ...x })).filter((x) => x.cliente !== undefined);
  const enLista = new Set(filas.map((p) => p.id));
  const sinRuta = pedidos.filter((p) => !p.ruta_id && ['pendiente', 'confirmado', 'preparando'].includes(p.estado) && !enLista.has(p.id));
  const repSel = d.data ? d.data.reps.find((x) => x.email === rep) : null;
  const canastas = sum(filas, 'canastas');
  const guardadas = ruta ? pedidos.filter((p) => p.ruta_id === ruta.id).sort((a, b) => (a.orden_manual ?? 99) - (b.orden_manual ?? 99)).map((p) => p.id) : [];
  const cambiado = JSON.stringify(filas.map((p) => p.id)) !== JSON.stringify(guardadas) || !!info;
  const editable = !ruta || ruta.estado === 'planeada';
  const pendientesRuta = filas.filter((p) => ABIERTA.includes(p.estado)).length;

  const mover = (i, dlt) => { const l = [...lista]; const [x] = l.splice(i, 1); l.splice(i + dlt, 0, x); setLista(l); };
  const quitar = (id) => setLista(lista.filter((x) => x.id !== id));
  const agregar = (ps) => setLista([...(lista || []), ...ps.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, minutos: null }))]);
  const usarUbicacion = async () => {
    const u = await ubicacionActual();
    if (!u) throw new Error('No pudimos obtener tu ubicación. Revisa el permiso de ubicación del navegador.');
    setOrigen({ texto: 'Mi ubicación actual', lat: u.lat, lng: u.lng });
  };
  const optimizar = async () => {
    if (!filas.length) throw new Error('Primero agrega pedidos a la ruta.');
    if (!origen.texto && !origen.lat) throw new Error('Escribe el punto de salida o usa tu ubicación.');
    const x = (await accion({ accion: 'ruta_optimizar', fecha: dia, ids: filas.map((p) => p.id), origen, volver }));
    const data = x.data;
    setLista(data.paradas.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, minutos: p.minutos })));
    if (data.origen && data.origen.lat) setOrigen({ ...origen, lat: data.origen.lat, lng: data.origen.lng });
    setInfo(data);
    toast(x.mensaje);
  };
  const guardar = async (silencioso) => {
    const id = await q(sb.rpc('panel_guardar_ruta', {
      p_fecha: dia, p_repartidor: rep || null, p_origen_texto: origen.texto || null, p_origen_lat: origen.lat || null, p_origen_lng: origen.lng || null,
      p_volver: volver, p_paradas: filas.map((p) => ({ id: p.id, lat: p.lat || null, lng: p.lng || null, minutos: p.minutos ?? null })),
      p_distancia_km: info ? info.distancia_km : null, p_duracion_min: info ? info.duracion_min : null
    }));
    localStorage.setItem(ORIGEN_KEY, JSON.stringify(origen));
    setInfo(null);
    if (!silencioso) toast('Ruta guardada' + (repSel ? ' y asignada a ' + (repSel.nombre || repSel.usuario) : ''));
    d.reload();
    return id;
  };
  const iniciar = async () => {
    let id = ruta && ruta.id;
    if (!id || cambiado) id = await guardar(true);
    const x = await accion({ accion: 'ruta_iniciar', ruta_id: id });
    toast(x.mensaje); d.reload();
  };

  return html`
    <div class="plan-top">
      <${Field} label="Día de entrega"><select class="input" value=${dia} onChange=${(e) => { setDia(e.target.value); setRep(null); }}>
        ${(fechas.data || []).map((f) => html`<option value=${f}>${fechaLarga(f)}${f === hoyISO() ? ' (hoy)' : ''}</option>`)}</select><//>
      <${Field} label="Repartidor"><select class="input" value=${rep || ''} onChange=${(e) => setRep(e.target.value)}>
        ${(d.data ? d.data.reps : []).map((x) => html`<option value=${x.email}>${x.nombre || x.usuario}${x.capacidad_canastas ? ' · hasta ' + x.capacidad_canastas + ' canastas' : ''}</option>`)}
        <option value="">Sin repartidor (solo planear)</option></select><//>
    </div>
    <${ErrorBox} error=${d.error} onRetry=${d.reload} />
    ${!d.data || lista === null ? html`<${Loader} rows=${5} />` : html`
    <div class="grid-2 planner">
      <div class="stack">
        <${Card} title="Punto de salida" icon="home" action=${ruta && html`<${Badge} tone=${(ESTADO_RUTA[ruta.estado] || [])[1]}>${(ESTADO_RUTA[ruta.estado] || [])[0]}<//>`}>
          <div class="origen">
            <input class="input" placeholder="Ej.: Carrera 43A # 6 Sur-15, Medellín" value=${origen.texto}
              onInput=${(e) => setOrigen({ texto: e.target.value, lat: null, lng: null })} disabled=${!editable} />
            <${AsyncButton} className="btn" icon="nav" onClick=${usarUbicacion} disabled=${!editable}>Usar mi ubicación<//>
          </div>
          <label class="switch small-sw"><input type="checkbox" checked=${volver} onChange=${(e) => setVolver(e.target.checked)} disabled=${!editable} /><span></span>Regresar al punto de salida al terminar</label>
          ${!d.data.google && html`<p class="muted small note-line"><${Icon} n="alert" size=${13} />Sin clave de Google Maps el orden es aproximado (usa las ubicaciones guardadas).</p>`}
        <//>

        <${Card} title=${'Ruta · ' + filas.length + ' paradas · ' + num(canastas) + ' canastas'} icon="truck" pad=${false}
          action=${editable && filas.length > 1 && html`<${AsyncButton} className="btn sm" icon="spark" onClick=${optimizar}>Ordenar ruta<//>`}>
          ${info && html`<div class="info m"><${Icon} n="spark" size=${16} /><span>${info.metodo === 'google' ? 'Ordenada con Google Maps' : 'Orden aproximado'}${info.distancia_km ? ' · ' + num(info.distancia_km) + ' km' : ''}${info.duracion_min ? ' · ' + num(info.duracion_min) + ' min de manejo' : ''}. Revisa y guarda.${(info.avisos || []).length ? ' ' + info.avisos.join(' ') : ''}</span></div>`}
          ${repSel && repSel.capacidad_canastas && canastas > repSel.capacidad_canastas && html`<div class="warn m"><${Icon} n="alert" size=${16} />Son ${num(canastas)} canastas y la capacidad de ${repSel.nombre || repSel.usuario} es ${repSel.capacidad_canastas}.</div>`}
          ${!filas.length ? html`<${Empty} icon="truck" title="La ruta está vacía">Toca los pedidos de la lista "Por asignar" para agregarlos.<//>` :
            html`<ol class="paradas">${filas.map((p, i) => html`<li key=${p.id} class=${'parada ' + p.estado}>
              <span class="num">${p.estado === 'entregado' ? '✓' : p.estado === 'no_entregado' ? '!' : i + 1}</span>
              <div class="ri-main">
                <b class="dir-main">${p.direccion_entrega || 'Sin dirección'}</b>
                <span class="dir-sub">${[p.barrio, p.municipio].filter(Boolean).join(' · ')}</span>
                <span class="ri-meta">${p.cliente} · #${p.id} · ${num(p.canastas)} can.${p.minutos != null ? ' · ' + p.minutos + ' min' : ''}${!p.lat ? html` · <span class="warn-t">sin ubicación</span>` : ''}</span></div>
              ${editable ? html`<div class="mini-actions">
                <button class="icon-btn" aria-label="Subir" disabled=${i === 0} onClick=${() => mover(i, -1)}><${Icon} n="up2" size=${18} /></button>
                <button class="icon-btn" aria-label="Bajar" disabled=${i === filas.length - 1} onClick=${() => mover(i, 1)}><${Icon} n="down2" size=${18} /></button>
                <button class="icon-btn danger" aria-label="Quitar de la ruta" onClick=${() => quitar(p.id)}><${Icon} n="x" size=${16} /></button></div>` : html`<${EstadoBadge} e=${p.estado} />`}
            </li>`)}</ol>`}
          ${filas.length > 0 && html`<div class="card-body links-row">
            <a class="link" href=${rutaLink(filas, origen)} target="_blank" rel="noopener"><${Icon} n="external" size=${14} />Ver ruta en Google Maps</a>
            ${ruta && html`<button class="link" onClick=${() => onVer(ruta.id)}><${Icon} n="pin" size=${14} />Ver como repartidor</button>`}</div>`}
        <//>

        ${editable && sinRuta.length > 0 && html`<${Card} title=${'Por asignar · ' + sinRuta.length} icon="pedidos" pad=${false}
          action=${html`<button class="btn sm ghost" onClick=${() => agregar(sinRuta)}><${Icon} n="plus" size=${14} />Agregar todos</button>`}>
          <div class="list">${sinRuta.map((p) => html`<button key=${p.id} class="row-item" onClick=${() => agregar([p])}>
            <span class="add-ico"><${Icon} n="plus" size=${16} /></span>
            <div class="ri-main"><b class="dir-main">${p.direccion_entrega || 'Sin dirección'}</b><span class="dir-sub">${[p.barrio, p.municipio].filter(Boolean).join(' · ')}</span>
              <span class="ri-meta">${p.cliente} · #${p.id} · ${num(p.canastas)} can.</span></div></button>`)}</div>
        <//>`}
      </div>

      <div class="stack sticky-col">
        <${Card} title="Mapa" icon="pin" pad=${false}><${Mapa} origen=${origen} paradas=${filas} height=${340} /><//>
        <${Card} title="Hoja de carga" icon="box"><${HojaCarga} paradas=${filas} /><//>
      </div>
    </div>
    <div class="action-bar">
      <div class="ab-info"><b>${filas.length} paradas · ${num(canastas)} canastas</b><span>${repSel ? (repSel.nombre || repSel.usuario) : 'Sin repartidor'}${cambiado && editable ? ' · cambios sin guardar' : ruta ? ' · ' + (ESTADO_RUTA[ruta.estado] || [])[0] : ''}</span></div>
      ${editable && html`<${AsyncButton} className="btn" icon="check" disabled=${!filas.length && !ruta} onClick=${() => guardar(false)}>Guardar<//>`}
      ${ruta && ruta.estado !== 'terminada' && pendientesRuta > 0 && rep ? html`<${AsyncButton} className="btn violet" icon="play" onClick=${iniciar}>${ruta.estado === 'en_curso' ? 'Reenviar avisos' : 'Iniciar recorrido'}<//>` :
        !ruta && filas.length > 0 && rep ? html`<${AsyncButton} className="btn violet" icon="play" onClick=${iniciar}>Guardar e iniciar<//>` : null}
    </div>`}
  `;
}

/* ---------- No entregados ---------- */
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
  return html`<${Card} title="Pedidos que no se pudieron entregar" icon="alert" pad=${false}>
    <${ErrorBox} error=${r.error} onRetry=${r.reload} />
    ${r.loading && !r.data ? html`<div class="card-body"><${Loader} /></div>` : (r.data || []).length === 0 ? html`<${Empty} icon="check" title="Todo al día">No hay pedidos pendientes por reprogramar.<//>` :
      html`<div class="list">${r.data.map((p) => html`<div class="row-item static wrap" key=${p.id}>
        <div class="ri-main"><b class="dir-main">${p.direccion_entrega}</b><span class="dir-sub">${[p.barrio, p.municipio].filter(Boolean).join(' · ')}</span>
          <span class="ri-meta">${p.cliente} · #${p.id} · ${fechaCorta(p.fecha_entrega)} · ${num(p.canastas)} can.</span>
          <span class="neg small">${MOTIVOS[p.motivo_no_entrega] || 'Sin motivo'}${p.entrega_obs ? ': ' + p.entrega_obs : ''}</span></div>
        <div class="row-btns">
          <button class="btn sm primary" onClick=${() => setDlg({ t: 'rep', p, fecha: isoDate(sumarDias(new Date(), 1)) })}><${Icon} n="calendar" size=${14} />Reprogramar</button>
          <button class="btn sm danger-ghost" onClick=${() => setDlg({ t: 'can', p, motivo: '' })}>Cancelar</button></div>
      </div>`)}</div>`}
    ${dlg && dlg.t === 'rep' && html`<${Modal} title=${'Reprogramar pedido #' + dlg.p.id} onClose=${() => setDlg(null)}
      footer=${html`<button class="btn ghost" onClick=${() => setDlg(null)}>Volver</button><${AsyncButton} className="btn primary" icon="calendar" onClick=${reprogramar}>Reprogramar<//>`}>
      <${Field} label="Nueva fecha de entrega"><input class="input" type="date" min=${hoyISO()} value=${dlg.fecha} onInput=${(e) => setDlg({ ...dlg, fecha: e.target.value })} /><//>
      <p class="muted">El pedido vuelve a quedar confirmado y listo para agregarlo a la ruta de ese día.</p><//>`}
    ${dlg && dlg.t === 'can' && html`<${Modal} title=${'Cancelar pedido #' + dlg.p.id} onClose=${() => setDlg(null)}
      footer=${html`<button class="btn ghost" onClick=${() => setDlg(null)}>Volver</button><${AsyncButton} className="btn danger" icon="x" onClick=${cancelar}>Sí, cancelar<//>`}>
      <p>Las canastas vuelven al inventario y le avisamos al cliente.</p>
      <${Field} label="Motivo (opcional, lo verá el cliente)"><textarea class="input" rows="2" value=${dlg.motivo} onInput=${(e) => setDlg({ ...dlg, motivo: e.target.value })}></textarea><//><//>`}
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
  const [yo, setYo] = useState(null);

  // Mientras la ruta está en curso, el repartidor comparte su ubicación (solo con la app abierta).
  const enCurso = r.data && r.data.ruta && r.data.ruta.estado === 'en_curso' && !gestor;
  const ultimoEnvio = useRef(0);
  useEffect(() => {
    if (!enCurso || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition((p) => {
      const u = { lat: p.coords.latitude, lng: p.coords.longitude };
      setYo(u);
      if (Date.now() - ultimoEnvio.current > 60000) { ultimoEnvio.current = Date.now(); sb.rpc('panel_ubicacion', { p_lat: u.lat, p_lng: u.lng }).then(() => {}, () => {}); }
    }, () => {}, { enableHighAccuracy: true, maximumAge: 30000, timeout: 20000 });
    return () => navigator.geolocation.clearWatch(id);
  }, [enCurso]);

  if (r.loading && !r.data) return html`<${Loader} rows=${6} />`;
  if (r.error && !r.data) return html`<${ErrorBox} error=${r.error} onRetry=${r.reload} />`;
  const { ruta, paradas } = r.data;
  if (!ruta) return html`<${Card}><${Empty} icon="truck" title="Aún no tienes una ruta asignada">Cuando la oficina te asigne entregas, las verás aquí.<//>
    <div class="center"><button class="btn" onClick=${r.reload}><${Icon} n="refresh" size=${16} />Revisar de nuevo</button></div><//>`;

  const pendientes = paradas.filter((p) => ABIERTA.includes(p.estado));
  const actual = pendientes.find((p) => p.estado === 'en_camino') || pendientes[0] || null;
  const hechos = paradas.filter((p) => ['entregado', 'no_entregado'].includes(p.estado));
  const ok = paradas.filter((p) => p.estado === 'entregado').length;
  const pct = paradas.length ? Math.round((hechos.length / paradas.length) * 100) : 0;
  const origen = { lat: ruta.origen_lat, lng: ruta.origen_lng };
  const puedeMarcar = ruta.estado === 'en_curso' || gestor;

  const iniciar = async () => { const x = await accion({ accion: 'ruta_iniciar', ruta_id: ruta.id }); toast(x.mensaje); r.reload(); };
  const registrar = async (payload) => {
    const x = await accion({ accion: 'entrega', ...payload });
    toast(x.mensaje); setDlg(null); r.reload();
    if (navigator.vibrate) navigator.vibrate(60);
  };

  return html`<div class=${'stack ruta-view' + (actual && puedeMarcar ? ' con-barra' : '')}>
    <section class="ruta-head">
      <div><span class="hero-kicker">${fechaLarga(ruta.fecha)}${gestor && ruta.repartidor ? ' · ' + nombreUsuario(ruta.repartidor) : ''}</span>
        <h2>${ruta.estado === 'terminada' ? 'Ruta terminada' : ruta.estado === 'en_curso' ? 'En recorrido' : 'Tu ruta está lista'}</h2>
        <span>${hechos.length} de ${paradas.length} paradas · ${num(sum(pendientes, 'canastas'))} canastas por entregar</span></div>
      <div class="ruta-ring" style=${{ '--p': pct }}><b>${pct}%</b></div>
    </section>

    ${ruta.estado === 'planeada' && pendientes.length > 0 && html`<section class="start-box">
      <div class="sb-txt"><b>¿Todo cargado? ¡A rodar!</b><span>Al iniciar, cada cliente recibe un mensaje con su turno y la hora aproximada de llegada.</span></div>
      <${HojaCarga} paradas=${pendientes} />
      <${AsyncButton} className="btn violet big block" icon="play" onClick=${iniciar}>Iniciar recorrido<//></section>`}

    ${actual ? html`<section class="parada-actual">
      <div class="pa-top"><span class="pa-num">${paradas.indexOf(actual) + 1}</span>
        <div><span class="hero-kicker">${actual.estado === 'en_camino' ? 'Vas hacia' : 'Próxima parada'}</span><h3>${actual.cliente}</h3></div>
        <${EstadoBadge} e=${actual.estado} /></div>
      <div class="pa-dirbox">
        <${Direccion} p=${actual} grande=${true} />
        <button class="icon-btn" aria-label="Copiar dirección" onClick=${() => copiar([actual.direccion_entrega, actual.barrio, actual.municipio].filter(Boolean).join(', '))}><${Icon} n="copy" /></button>
      </div>
      ${(actual.indicaciones || actual.notas) && html`<div class="pa-nota"><${Icon} n="chat" size=${16} /><span>${[actual.indicaciones, actual.notas && actual.notas !== 'PEDIDO DE PRUEBA' ? actual.notas : null].filter(Boolean).join(' · ') || actual.notas}</span></div>`}
      <div class="pa-items">${(actual.items || []).map((it) => html`<span key=${it.producto} class="chip"><b>${it.cantidad}</b> ${it.producto}</span>`)}
        ${actual.pago_estado === 'pagado' ? html`<${Badge} tone="green">Ya pagó<//>` : html`<${Badge} tone="gray">El pago lo gestiona la oficina<//>`}</div>
      <div class="pa-nav">
        <a class="btn primary" href=${navegarLink(actual)} target="_blank" rel="noopener"><${Icon} n="nav" size=${16} />Cómo llegar</a>
        <a class="btn" href=${navegarLink(actual, 'waze')} target="_blank" rel="noopener"><${Icon} n="truck" size=${16} />Waze</a>
        ${actual.telefono && html`<a class="btn" href=${'tel:' + actual.telefono}><${Icon} n="phone" size=${16} />Llamar</a>`}
        ${actual.telefono && html`<a class="btn" href=${whatsappLink(actual.telefono, 'Hola, soy el repartidor de Huevos de la Naza. Ya voy llegando con tu pedido.')} target="_blank" rel="noopener"><${Icon} n="chat" size=${16} />WhatsApp</a>`}
        <button class="btn ghost" onClick=${() => setDlg({ t: 'nota', p: actual, texto: actual.indicaciones || '' })}><${Icon} n="edit" size=${16} />Indicaciones</button>
      </div>
      ${!puedeMarcar && html`<p class="muted small center">Inicia el recorrido para poder marcar las entregas.</p>`}
    </section>` : html`<section class="fin-ruta">
      <div class="empty-ico big"><${Icon} n="check" size=${34} /></div>
      <h3>¡Recorrido completo!</h3>
      <p>${ok} entregados${paradas.length - ok ? ' · ' + (paradas.length - ok) + ' no entregados' : ''}${ruta.iniciada_en && ruta.terminada_en ? ' · ' + Math.round((new Date(ruta.terminada_en) - new Date(ruta.iniciada_en)) / 60000) + ' min en ruta' : ''}</p>
      <p class="muted">¡Buen trabajo! 🥚</p>
    </section>`}

    <${Card} title="Mapa" icon="pin" pad=${false} action=${html`<button class="btn sm ghost" onClick=${() => setVerMapa(!verMapa)}>${verMapa ? 'Ocultar' : 'Mostrar'}</button>`}>
      ${verMapa && html`<${Mapa} origen=${origen} paradas=${paradas} actual=${actual && actual.id} ubicacion=${yo} height=${300} />`}
    <//>

    <${Card} title=${'Paradas · ' + paradas.length} icon="pedidos" pad=${false}>
      <ol class="paradas">${paradas.map((p, i) => html`<li key=${p.id} class=${'parada ' + p.estado + (actual && p.id === actual.id ? ' actual' : '')}>
        <span class="num">${p.estado === 'entregado' ? '✓' : p.estado === 'no_entregado' ? '!' : i + 1}</span>
        <div class="ri-main"><b class="dir-main">${p.direccion_entrega || ''}</b><span class="dir-sub">${[p.barrio, p.municipio].filter(Boolean).join(' · ')}</span>
          <span class="ri-meta">${p.cliente} · ${num(p.canastas)} can.${p.estado === 'no_entregado' ? html` · <span class="neg">${MOTIVOS[p.motivo_no_entrega] || ''}</span>` : ''}</span></div>
        <${EstadoBadge} e=${p.estado} />
      </li>`)}</ol>
    <//>

    ${actual && puedeMarcar && html`<div class="entrega-bar">
      <button class="btn danger-ghost" onClick=${() => setDlg({ t: 'no', p: actual, motivo: '', detalle: '' })}><${Icon} n="x" size=${18} />No entregado</button>
      <button class="btn green" onClick=${() => setDlg({ t: 'ok', p: actual })}><${Icon} n="check" size=${18} />Entregado</button>
    </div>`}

    ${dlg && dlg.t === 'ok' && html`<${EntregarModal} p=${dlg.p} ruta=${ruta} onClose=${() => setDlg(null)} onSend=${registrar} />`}
    ${dlg && dlg.t === 'no' && html`<${Modal} title="¿Qué pasó con la entrega?" onClose=${() => setDlg(null)}
      footer=${html`<button class="btn ghost" onClick=${() => setDlg(null)}>Volver</button>
        <${AsyncButton} className="btn danger" icon="x" disabled=${!dlg.motivo || (dlg.motivo === 'otro' && !dlg.detalle.trim())}
          onClick=${() => registrar({ pedido_id: dlg.p.id, resultado: 'no_entregado', motivo: dlg.motivo, detalle: dlg.detalle })}>Registrar<//>`}>
      <p class="muted">${dlg.p.cliente} · ${dlg.p.direccion_entrega}</p>
      <div class="radio-list">${Object.entries(MOTIVOS).map(([k, v]) => html`<label key=${k} class=${'radio' + (dlg.motivo === k ? ' on' : '')}>
        <input type="radio" name="motivo" checked=${dlg.motivo === k} onChange=${() => setDlg({ ...dlg, motivo: k })} />${v}</label>`)}</div>
      <${Field} label=${dlg.motivo === 'otro' ? 'Cuéntanos qué pasó' : 'Comentario (opcional)'}><textarea class="input" rows="2" value=${dlg.detalle} onInput=${(e) => setDlg({ ...dlg, detalle: e.target.value })}></textarea><//>
      <p class="muted small">Le avisamos al cliente y a la oficina, y seguimos con la siguiente parada.</p>
    <//>`}
    ${dlg && dlg.t === 'nota' && html`<${Modal} title="Indicaciones de entrega" onClose=${() => setDlg(null)}
      footer=${html`<button class="btn ghost" onClick=${() => setDlg(null)}>Cancelar</button>
        <${AsyncButton} className="btn primary" icon="check" onClick=${async () => { await q(sb.rpc('panel_indicaciones', { p_cliente: dlg.p.cliente_id, p_texto: dlg.texto })); toast('Indicaciones guardadas'); setDlg(null); r.reload(); }}>Guardar<//>`}>
      <p class="muted">${dlg.p.cliente} · ${dlg.p.direccion_entrega}</p>
      <${Field} label="Para la próxima entrega" hint="Ej.: portería de la torre 2, timbre 301."><textarea class="input" rows="3" value=${dlg.texto} onInput=${(e) => setDlg({ ...dlg, texto: e.target.value })}></textarea><//>
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
        if (error) throw new Error('No pudimos subir la foto. Inténtalo de nuevo o confirma sin foto.');
        return ruta_;
      })()
    ]);
    await onSend({ pedido_id: p.id, resultado: 'entregado', lat: ubic && ubic.precision < 200 ? ubic.lat : null, lng: ubic && ubic.precision < 200 ? ubic.lng : null, foto: path, detalle });
  };
  return html`<${Modal} title="Confirmar entrega" onClose=${onClose}
    footer=${html`<button class="btn ghost" onClick=${onClose}>Volver</button><${AsyncButton} className="btn green" icon="check" onClick=${enviar}>Confirmar entrega<//>`}>
    <div class="conf-head"><b>${p.cliente}</b><span class="muted">${p.direccion_entrega}</span></div>
    <div class="pa-items">${(p.items || []).map((it) => html`<span key=${it.producto} class="chip"><b>${it.cantidad}</b> ${it.producto}</span>`)}</div>
    <label class="foto-input">
      ${prev ? html`<img src=${prev} alt="Foto de la entrega" />` : html`<span><${Icon} n="download" size=${22} />Tomar foto de evidencia (opcional)</span>`}
      <input type="file" accept="image/*" capture="environment" onChange=${elegir} />
    </label>
    <${Field} label="Comentario (opcional)"><input class="input" value=${detalle} onInput=${(e) => setDetalle(e.target.value)} placeholder="Ej.: lo recibió el portero" /><//>
  <//>`;
}
