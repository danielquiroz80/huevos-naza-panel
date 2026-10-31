import { html, useState, useEffect, Icon, Card, Tabs, Loader, Empty, ErrorBox, Modal, Field, AsyncButton, Badge, Drawer, SearchBox, Bars, Donut, useAsync, toast } from '../ui.js';
import { sb, q, num, money, fechaCorta, fechaHora, hoyISO, isoDate, sumarDias, sum, norm, usuarios, claveInvalida, REGLAS_CLAVE, sugerirClave, whatsappLink, MOTIVOS, comprimirFoto } from '../lib.js';

export const CUENTA = { activo: ['Activo', 'green'], inactivo: ['Inactivo', 'gray'], suspendido: ['Suspendido', 'red'] };
export const OPERATIVO = { disponible: ['Disponible', 'green'], con_ruta: ['Con ruta asignada', 'blue'], ocupado: ['En recorrido', 'violet'], fuera_servicio: ['Fuera de servicio', 'gray'] };
const TRANSPORTE = { moto: 'Moto', carro: 'Carro', bicicleta: 'Bicicleta', a_pie: 'A pie', otro: 'Otro' };
const DOCS = { CC: 'Cédula de ciudadanía', CE: 'Cédula de extranjería', PPT: 'Permiso de protección temporal', PA: 'Pasaporte', TI: 'Tarjeta de identidad', NIT: 'NIT' };
const ESTADO_RUTA = { planeada: ['Por iniciar', 'amber'], en_curso: ['En ruta', 'violet'], terminada: ['Finalizada', 'green'], cancelada: ['Cancelada', 'gray'] };

/* ---------- Foto o iniciales ---------- */
const urls = new Map();
export function Avatar({ path, nombre, size = 44 }) {
  const [url, setUrl] = useState(path ? urls.get(path) : null);
  useEffect(() => {
    if (!path || urls.has(path)) { setUrl(path ? urls.get(path) : null); return; }
    sb.storage.from('perfiles').createSignedUrl(path, 3600).then(({ data }) => { if (data) { urls.set(path, data.signedUrl); setUrl(data.signedUrl); } });
  }, [path]);
  const ini = String(nombre || '?').split(' ').filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase();
  return html`<span class="av" style=${{ width: size + 'px', height: size + 'px', fontSize: Math.round(size * 0.38) + 'px' }}>${url ? html`<img src=${url} alt="" />` : ini}</span>`;
}

/* =================== Página =================== */
export function Repartidores() {
  const r = useAsync(() => q(sb.rpc('panel_repartidores_resumen')), []);
  const [buscar, setBuscar] = useState('');
  const [cuenta, setCuenta] = useState('todos');
  const [oper, setOper] = useState('');
  const [ver, setVer] = useState(null);
  const [nuevo, setNuevo] = useState(false);
  const lista = (r.data || []).filter((x) => (cuenta === 'todos' || x.estado_cuenta === cuenta) && (!oper || x.operativo === oper)
    && (!buscar || norm([x.nombre, x.usuario, x.documento, x.telefono, x.placa].join(' ')).includes(norm(buscar))));
  const cuenta_n = (k) => (r.data || []).filter((x) => k === 'todos' || x.estado_cuenta === k).length;
  const actual = ver && (r.data || []).find((x) => x.email === ver);

  return html`<div class="stack">
    <div class="page-head">
      <div><h2>Repartidores</h2><p class="muted">${(r.data || []).filter((x) => x.estado_cuenta === 'activo').length} activos · ${(r.data || []).filter((x) => x.operativo === 'ocupado').length} en recorrido ahora</p></div>
      <button class="btn primary" onClick=${() => setNuevo(true)}><${Icon} n="plus" size=${16} />Nuevo repartidor</button>
    </div>
    <div class="toolbar wrap-mobile">
      <${SearchBox} value=${buscar} onInput=${setBuscar} placeholder="Buscar por nombre, documento, celular o placa" />
      <${Tabs} value=${cuenta} onChange=${setCuenta} items=${[{ v: 'todos', label: 'Todos', n: cuenta_n('todos') }, { v: 'activo', label: 'Activos', n: cuenta_n('activo') }, { v: 'inactivo', label: 'Inactivos', n: cuenta_n('inactivo') }, { v: 'suspendido', label: 'Suspendidos', n: cuenta_n('suspendido') }]} />
      <select class="input auto" value=${oper} onChange=${(e) => setOper(e.target.value)} aria-label="Estado operativo">
        <option value="">Cualquier estado operativo</option>${Object.entries(OPERATIVO).map(([k, [l]]) => html`<option value=${k}>${l}</option>`)}</select>
    </div>
    <${ErrorBox} error=${r.error} onRetry=${r.reload} />
    ${!r.data ? html`<${Loader} rows=${5} />` : !lista.length ? html`<${Card}><${Empty} icon="users" title=${r.data.length ? 'Nadie coincide con la búsqueda' : 'Aún no hay repartidores'}>
        ${r.data.length ? 'Prueba con otro filtro.' : 'Crea el primero con "Nuevo repartidor".'}<//><//>` :
      html`<div class="rep-grid">${lista.map((x) => {
        const [ce, ct] = CUENTA[x.estado_cuenta] || CUENTA.activo, [oe, ot] = OPERATIVO[x.operativo] || OPERATIVO.disponible;
        return html`<button key=${x.email} class="rep-tile" onClick=${() => setVer(x.email)}>
          <div class="rt-top"><${Avatar} path=${x.foto_path} nombre=${x.nombre} size=${52} />
            <div class="rt-id"><b>${x.nombre}</b><span>@${x.usuario}${x.documento ? ' · ' + (x.tipo_documento || '') + ' ' + x.documento : ''}</span>
              ${x.telefono && html`<span><${Icon} n="phone" size=${12} /> ${x.telefono}</span>`}</div></div>
          <div class="rt-badges"><${Badge} tone=${ct}>${ce}<//>${x.estado_cuenta === 'activo' && html`<${Badge} tone=${ot}>${oe}<//>`}</div>
          <div class="rt-nums"><div><b>${num(x.asignados)}</b><span>Asignados</span></div><div><b>${num(x.entregados)}</b><span>Entregados</span></div>
            <div><b>${x.transporte ? TRANSPORTE[x.transporte] : '—'}</b><span>${x.placa || 'Transporte'}</span></div></div>
        </button>`;
      })}</div>`}
    ${nuevo && html`<${RepartidorForm} onClose=${() => setNuevo(false)} onListo=${(email) => { setNuevo(false); r.reload(); setVer(email); }} />`}
    ${actual && html`<${RepartidorDetalle} x=${actual} onClose=${() => setVer(null)} onCambio=${r.reload} />`}
  </div>`;
}

/* =================== Ficha =================== */
function RepartidorDetalle({ x, onClose, onCambio }) {
  const [tab, setTab] = useState('resumen');
  const [editar, setEditar] = useState(false);
  const [dlg, setDlg] = useState(null);
  const [cuenta, cuentaTone] = CUENTA[x.estado_cuenta] || CUENTA.activo;
  const cambiarEstado = async (estado) => {
    if (estado !== 'activo' && x.operativo === 'ocupado') throw new Error('Tiene una ruta en recorrido. Espera a que termine o cancélala primero.');
    await usuarios({ accion: 'editar', email: x.email, activo: estado === 'activo' });
    await q(sb.rpc('panel_repartidor_guardar', { p_email: x.email, p_datos: { ...datosDe(x), estado_cuenta: estado } }));
    toast(estado === 'activo' ? 'Cuenta activada: ya puede entrar' : estado === 'suspendido' ? 'Cuenta suspendida: no podrá entrar' : 'Cuenta desactivada'); setDlg(null); onCambio();
  };
  const disponibilidad = async () => {
    const d = x.disponibilidad === 'fuera_servicio' ? 'disponible' : 'fuera_servicio';
    await q(sb.rpc('panel_repartidor_guardar', { p_email: x.email, p_datos: { ...datosDe(x), disponibilidad: d } }));
    toast(d === 'disponible' ? 'Marcado como disponible' : 'Marcado fuera de servicio'); onCambio();
  };
  return html`<${Drawer} title=${x.nombre} sub=${'@' + x.usuario} onClose=${onClose}>
    <div class="ficha-head">
      <${Avatar} path=${x.foto_path} nombre=${x.nombre} size=${72} />
      <div class="ficha-badges"><${Badge} tone=${cuentaTone}>${cuenta}<//>${x.estado_cuenta === 'activo' && html`<${Badge} tone=${OPERATIVO[x.operativo][1]}>${OPERATIVO[x.operativo][0]}<//>`}</div>
      <div class="ficha-acc">
        ${x.telefono && html`<a class="btn sm" href=${'tel:' + x.telefono}><${Icon} n="phone" size=${14} />Llamar</a>`}
        ${x.telefono && html`<a class="btn sm" href=${whatsappLink(x.telefono)} target="_blank" rel="noopener"><${Icon} n="chat" size=${14} />WhatsApp</a>`}
        <button class="btn sm" onClick=${() => setEditar(true)}><${Icon} n="edit" size=${14} />Editar</button>
        <button class="btn sm ghost" onClick=${() => setDlg({ t: 'cuenta' })}><${Icon} n="settings" size=${14} />Cuenta</button>
      </div>
    </div>
    <${Tabs} value=${tab} onChange=${setTab} items=${[{ v: 'resumen', label: 'Rendimiento' }, { v: 'rutas', label: 'Rutas' }, { v: 'entregas', label: 'Entregas' }, { v: 'datos', label: 'Datos' }]} />
    ${tab === 'datos' ? html`<${DatosRepartidor} x=${x} />` : html`<${StatsRepartidor} email=${x.email} tab=${tab} />`}
    ${editar && html`<${RepartidorForm} x=${x} onClose=${() => setEditar(false)} onListo=${() => { setEditar(false); onCambio(); }} />`}
    ${dlg && dlg.t === 'cuenta' && html`<${Modal} title="Cuenta y acceso" onClose=${() => setDlg(null)}>
      <div class="opt-list">
        <div class="opt"><div><b>Disponibilidad</b><span class="muted small">${x.disponibilidad === 'fuera_servicio' ? 'Fuera de servicio: no puede tomar rutas.' : 'Disponible para tomar rutas.'}</span></div>
          <${AsyncButton} className="btn sm" onClick=${disponibilidad}>${x.disponibilidad === 'fuera_servicio' ? 'Marcar disponible' : 'Fuera de servicio'}<//></div>
        <div class="opt"><div><b>Estado de la cuenta</b><span class="muted small">Inactivo o suspendido no puede entrar a la app.</span></div>
          <div class="seg">${Object.entries(CUENTA).map(([k, [l]]) => html`<${AsyncButton} key=${k} className=${'seg-b' + (x.estado_cuenta === k ? ' on' : '')} disabled=${x.estado_cuenta === k} onClick=${() => cambiarEstado(k)}>${l}<//>`)}</div></div>
        <div class="opt"><div><b>Contraseña</b><span class="muted small">Asigna una nueva y compártela con la persona.</span></div>
          <button class="btn sm" onClick=${() => setDlg({ t: 'clave', clave: sugerirClave() })}><${Icon} n="lock" size=${14} />Cambiar</button></div>
        <div class="opt"><div><b>Usuario de acceso</b><span class="muted small">@${x.usuario}${x.correo ? ' · recuperación: ' + x.correo : ' · sin correo de recuperación'}</span></div></div>
      </div><//>`}
    ${dlg && dlg.t === 'clave' && html`<${Modal} title="Nueva contraseña" onClose=${() => setDlg(null)}
      footer=${html`<button class="btn ghost" onClick=${() => setDlg(null)}>Cancelar</button><${AsyncButton} className="btn primary" icon="check"
        onClick=${async () => { const e = claveInvalida(dlg.clave); if (e) throw new Error(e); await usuarios({ accion: 'clave', email: x.email, clave: dlg.clave }); toast('Contraseña cambiada. Compártela con ' + x.nombre + '.'); setDlg(null); }}>Guardar<//>`}>
      <${Field} label="Contraseña"><input class="input mono" value=${dlg.clave} onInput=${(e) => setDlg({ ...dlg, clave: e.target.value })} /><//>
      <${ReglasClave} c=${dlg.clave} /><//>`}
  <//>`;
}

const datosDe = (x) => ({ nombres: x.nombres, apellidos: x.apellidos, tipo_documento: x.tipo_documento, documento: x.documento, direccion: x.direccion, observaciones: x.observaciones,
  transporte: x.transporte, tipo_vehiculo: x.tipo_vehiculo, placa: x.placa, estado_cuenta: x.estado_cuenta, disponibilidad: x.disponibilidad });

function ReglasClave({ c }) {
  return html`<ul class="reglas">${REGLAS_CLAVE.map((r) => html`<li key=${r.t} class=${r.f(c || '') ? 'ok' : ''}><${Icon} n=${r.f(c || '') ? 'check' : 'x'} size=${13} />${r.t}</li>`)}</ul>`;
}

function DatosRepartidor({ x }) {
  const fila = (l, v) => html`<div class="dato"><span>${l}</span><b>${v || '—'}</b></div>`;
  return html`<div class="datos">
    <div class="section-title">Personal</div>
    ${fila('Nombres', x.nombres)}${fila('Apellidos', x.apellidos)}${fila('Documento', x.documento ? (DOCS[x.tipo_documento] || x.tipo_documento) + ' · ' + x.documento : '')}
    ${fila('Celular', x.telefono)}${fila('Correo', x.correo)}${fila('Dirección', x.direccion)}
    <div class="section-title">Operación</div>
    ${fila('Transporte', x.transporte && TRANSPORTE[x.transporte])}${fila('Vehículo', [x.tipo_vehiculo, x.placa].filter(Boolean).join(' · '))}
    ${fila('Capacidad', x.capacidad_canastas ? x.capacidad_canastas + ' canastas' : '')}${fila('Registrado', fechaCorta(x.creado))}${fila('Observaciones', x.observaciones)}
  </div>`;
}

/* ---------- Estadísticas ---------- */
const PERIODOS = { 7: 'Últimos 7 días', 30: 'Últimos 30 días', 90: 'Últimos 90 días', mes: 'Este mes' };
function StatsRepartidor({ email, tab }) {
  const [per, setPer] = useState('30');
  const desde = per === 'mes' ? hoyISO().slice(0, 8) + '01' : isoDate(sumarDias(new Date(), -(Number(per) - 1)));
  const r = useAsync(async () => {
    const [st, nov] = await Promise.all([q(sb.rpc('panel_repartidor_stats', { p_email: email, p_desde: desde, p_hasta: hoyISO() })), q(sb.rpc('panel_novedades_resumen', { p_desde: desde, p_hasta: hoyISO(), p_email: email }))]);
    return { ...st, nov };
  }, [email, per]);
  const d = r.data;
  const exito = d && d.entregados + d.fallidos ? Math.round((d.entregados / (d.entregados + d.fallidos)) * 100) : null;
  const semanas = d ? agrupar(d.por_dia, per === '7' ? 'dia' : Number(per) > 31 ? 'semana' : 'dia') : [];
  return html`<div class="stack">
    <select class="input auto" value=${per} onChange=${(e) => setPer(e.target.value)} aria-label="Periodo">${Object.entries(PERIODOS).map(([k, l]) => html`<option value=${k}>${l}</option>`)}</select>
    <${ErrorBox} error=${r.error} onRetry=${r.reload} />
    ${!d ? html`<${Loader} rows=${4} />` : tab === 'resumen' ? html`
      <div class="mini-kpis">
        <div><b>${num(d.asignados)}</b><span>Asignados</span></div><div><b>${num(d.pendientes)}</b><span>Por iniciar</span></div>
        <div><b>${num(d.en_ruta)}</b><span>En ruta</span></div><div class="ok"><b>${num(d.entregados)}</b><span>Entregados</span></div>
        <div class="no"><b>${num(d.fallidos)}</b><span>Fallidos</span></div><div><b>${exito == null ? '—' : exito + '%'}</b><span>Éxito</span></div>
        <div><b>${d.tiempo_promedio_min == null ? '—' : num(d.tiempo_promedio_min) + ' min'}</b><span>Tiempo por entrega</span></div><div><b>${num(d.rutas_total)}</b><span>Rutas</span></div>
        <div class=${d.nov.unidades ? 'no' : ''}><b>${num(d.nov.unidades)}</b><span>Huevos dañados</span></div><div><b>${money(d.nov.valor)}</b><span>Pérdida aprox.</span></div>
      </div>
      <p class="muted small">"Tiempo por entrega" es el promedio de minutos entre una entrega y la anterior dentro de la misma ruta (la primera cuenta desde que inició el recorrido).</p>
      <${Card} title=${'Entregas ' + (Number(per) > 31 ? 'por semana' : 'por día')} icon="chart">
        ${d.entregados + d.fallidos ? html`<${Bars} data=${semanas.map((s) => ({ k: s.k, label: s.label, v: s.ok, tip: s.no ? ' · ' + s.no + ' fallidas' : '' }))} fmt=${(v) => num(v) + ' entregas'} color="var(--green)" />`
          : html`<${Empty} icon="chart" title="Sin entregas en este periodo" />`}<//>
      ${d.entregados + d.fallidos > 0 && html`<${Card} title="Resultado" icon="check"><${Donut} data=${[{ label: 'Entregados', v: d.entregados, color: 'var(--green)' }, { label: 'Fallidos', v: d.fallidos, color: 'var(--red)' }]} center=${{ v: exito + '%', l: 'éxito' }} /><//>`}`
    : tab === 'rutas' ? html`<${Card} pad=${false}>${!d.rutas.length ? html`<${Empty} icon="route" title="Sin rutas en este periodo" />` :
        html`<div class="list">${d.rutas.map((x) => html`<div key=${x.id} class="row-item static">
          <div class="ri-main"><b>R-${x.id} · ${x.nombre || 'Ruta'}</b><span class="ri-meta">${fechaCorta(x.fecha)} · ${x.paradas} pedidos · ${x.ok} entregados${x.no ? ' · ' + x.no + ' fallidos' : ''}${x.iniciada_en ? ' · salió ' + fechaHora(x.iniciada_en) : ''}</span></div>
          <${Badge} tone=${(ESTADO_RUTA[x.estado] || [])[1]}>${(ESTADO_RUTA[x.estado] || [])[0]}<//></div>`)}</div>`}<//>`
    : html`<${Card} pad=${false}>${!d.entregas.length ? html`<${Empty} icon="truck" title="Sin entregas en este periodo" />` :
        html`<div class="list">${d.entregas.map((x) => html`<div key=${x.id} class="row-item static">
          <div class="ri-main"><b>#${x.id} · ${x.direccion}</b><span class="ri-meta">${x.barrio || ''} · ${fechaCorta(x.fecha)}${x.entregado_en ? ' · ' + fechaHora(x.entregado_en) : ''}${x.motivo ? ' · ' + (MOTIVOS[x.motivo] || x.motivo) : ''}</span></div>
          <${Badge} tone=${x.estado === 'entregado' ? 'green' : x.estado === 'no_entregado' ? 'red' : 'blue'}>${x.estado === 'entregado' ? 'Entregado' : x.estado === 'no_entregado' ? 'No entregado' : 'En proceso'}<//></div>`)}</div>`}<//>`}
  </div>`;
}

function agrupar(dias, modo) {
  if (modo === 'dia') return (dias || []).map((x) => ({ k: x.dia, label: new Date(x.dia + 'T12:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }), ok: x.ok, no: x.no }));
  const m = new Map();
  for (const x of dias || []) {
    const d = new Date(x.dia + 'T12:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const k = isoDate(d); const g = m.get(k) || { k, label: d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }), ok: 0, no: 0 };
    g.ok += x.ok; g.no += x.no; m.set(k, g);
  }
  return [...m.values()];
}

/* =================== Crear / editar =================== */
function RepartidorForm({ x, onClose, onListo }) {
  const nuevo = !x;
  const [f, setF] = useState(() => x ? { ...datosDe(x), tipo_documento: x.tipo_documento || 'CC', transporte: x.transporte || 'moto', telefono: x.telefono || '', correo: x.correo || '', capacidad_canastas: x.capacidad_canastas || '' }
    : { nombres: '', apellidos: '', tipo_documento: 'CC', documento: '', telefono: '', correo: '', direccion: '', transporte: 'moto', tipo_vehiculo: '', placa: '', capacidad_canastas: '', observaciones: '', usuario: '', clave: sugerirClave(), disponibilidad: 'disponible' });
  const [foto, setFoto] = useState(null);
  const [prev, setPrev] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const usuarioSugerido = () => norm((f.nombres || '').split(' ')[0] + (f.apellidos ? '.' + f.apellidos.split(' ')[0] : '')).replace(/[^a-z0-9.]/g, '');
  const guardar = async () => {
    if (!f.nombres.trim() || !f.apellidos.trim()) throw new Error('Escribe nombres y apellidos.');
    if (!f.documento.trim()) throw new Error('Escribe el número de documento.');
    if (!/^\+?\d{7,15}$/.test(String(f.telefono).replace(/[\s-]/g, ''))) throw new Error('Escribe un celular válido (solo números).');
    if (f.correo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.correo)) throw new Error('El correo no es válido.');
    if (['moto', 'carro'].includes(f.transporte) && !f.placa.trim()) throw new Error('Escribe la placa del vehículo.');
    if (f.capacidad_canastas && !(Number.isInteger(Number(f.capacidad_canastas)) && Number(f.capacidad_canastas) > 0)) throw new Error('La capacidad debe ser un número entero mayor que 0.');
    const nombre = (f.nombres.trim() + ' ' + f.apellidos.trim()).trim();
    const tel = String(f.telefono).replace(/[\s-]/g, '');
    let email = x && x.email;
    if (nuevo) {
      const usuario = (f.usuario || usuarioSugerido()).toLowerCase();
      const e = claveInvalida(f.clave); if (e) throw new Error(e);
      const res = await usuarios({ accion: 'crear', usuario, nombre, rol: 'repartidor', clave: f.clave, correo: f.correo, telefono: tel, capacidad_canastas: f.capacidad_canastas || null });
      email = (res && res.email) || (f.correo ? f.correo.toLowerCase() : usuario + '@huevosdelanaza.app');
    } else {
      await usuarios({ accion: 'editar', email, nombre, telefono: tel, correo: f.correo, capacidad_canastas: f.capacidad_canastas || null });
      email = f.correo ? f.correo.trim().toLowerCase() : x.usuario + '@huevosdelanaza.app'; // así guarda el correo de acceso el servidor
    }
    let foto_path;
    if (foto) {
      const blob = await comprimirFoto(foto, 512, 0.8);
      foto_path = 'repartidores/' + email.replace(/[^a-z0-9]/g, '_') + '-' + Date.now() + '.jpg';
      const { error } = await sb.storage.from('perfiles').upload(foto_path, blob, { contentType: 'image/jpeg' });
      if (error) { toast('Los datos se guardaron, pero la foto no se pudo subir.', 'error'); foto_path = undefined; }
    }
    const datos = { ...f, ...(foto_path ? { foto_path } : {}) };
    delete datos.clave; delete datos.usuario;
    await q(sb.rpc('panel_repartidor_guardar', { p_email: email, p_datos: datos }));
    if (nuevo) toast('Repartidor creado. Usuario: ' + (f.usuario || usuarioSugerido()) + ' · comparte la contraseña con ' + f.nombres + '.');
    else toast('Cambios guardados');
    onListo(email);
  };
  return html`<${Modal} wide title=${nuevo ? 'Nuevo repartidor' : 'Editar repartidor'} onClose=${onClose}
    footer=${html`<button class="btn ghost" onClick=${onClose}>Cancelar</button><${AsyncButton} className="btn primary" icon="check" onClick=${guardar}>${nuevo ? 'Crear repartidor' : 'Guardar cambios'}<//>`}>
    <div class="form-sec"><div class="section-title"><${Icon} n="user" size=${14} />Información personal</div>
      <div class="foto-row">
        <label class="foto-pick">${prev ? html`<img src=${prev} alt="" />` : x && x.foto_path ? html`<${Avatar} path=${x.foto_path} nombre=${x.nombres} size=${72} />` : html`<${Icon} n="camera" size=${24} />`}
          <input type="file" accept="image/*" onChange=${(e) => { const fl = e.target.files && e.target.files[0]; if (fl) { setFoto(fl); setPrev(URL.createObjectURL(fl)); } }} /></label>
        <span class="muted small">Foto o avatar (opcional)</span></div>
      <div class="form-grid">
        <${Field} label="Nombres *"><input class="input" value=${f.nombres} onInput=${set('nombres')} autocomplete="off" /><//>
        <${Field} label="Apellidos *"><input class="input" value=${f.apellidos} onInput=${set('apellidos')} autocomplete="off" /><//>
        <${Field} label="Tipo de documento *"><select class="input" value=${f.tipo_documento || 'CC'} onChange=${set('tipo_documento')}>${Object.entries(DOCS).map(([k, l]) => html`<option value=${k}>${l}</option>`)}</select><//>
        <${Field} label="Número de documento *"><input class="input" inputmode="numeric" value=${f.documento || ''} onInput=${set('documento')} /><//>
        <${Field} label="Celular *"><input class="input" type="tel" inputmode="tel" value=${f.telefono} onInput=${set('telefono')} placeholder="3001234567" /><//>
        <${Field} label="Correo" hint="Para recuperar la contraseña. Opcional."><input class="input" type="email" value=${f.correo} onInput=${set('correo')} /><//>
        <${Field} label="Dirección"><input class="input" value=${f.direccion || ''} onInput=${set('direccion')} /><//>
      </div></div>
    <div class="form-sec"><div class="section-title"><${Icon} n="truck" size=${14} />Información operativa</div>
      <div class="form-grid">
        <${Field} label="Medio de transporte"><select class="input" value=${f.transporte || ''} onChange=${set('transporte')}>${Object.entries(TRANSPORTE).map(([k, l]) => html`<option value=${k}>${l}</option>`)}</select><//>
        <${Field} label="Tipo o modelo de vehículo"><input class="input" value=${f.tipo_vehiculo || ''} onInput=${set('tipo_vehiculo')} placeholder="Ej.: Moto 125 cc con baúl" /><//>
        ${['moto', 'carro'].includes(f.transporte) && html`<${Field} label="Placa *"><input class="input mono" value=${f.placa || ''} onInput=${set('placa')} placeholder="ABC12D" /><//>`}
        <${Field} label="Capacidad de carga" hint="Canastas que puede llevar por ruta."><input class="input" type="number" min="1" inputmode="numeric" value=${f.capacidad_canastas} onInput=${set('capacidad_canastas')} /><//>
        <${Field} label="Disponibilidad"><select class="input" value=${f.disponibilidad} onChange=${set('disponibilidad')}><option value="disponible">Disponible</option><option value="fuera_servicio">Fuera de servicio</option></select><//>
      </div>
      <${Field} label="Observaciones"><textarea class="input" rows="2" value=${f.observaciones || ''} onInput=${set('observaciones')}></textarea><//></div>
    ${nuevo && html`<div class="form-sec"><div class="section-title"><${Icon} n="lock" size=${14} />Acceso a la app</div>
      <div class="form-grid">
        <${Field} label="Usuario" hint=${'Si lo dejas vacío: ' + (usuarioSugerido() || 'nombre.apellido')}><input class="input" autocapitalize="none" value=${f.usuario} onInput=${set('usuario')} placeholder=${usuarioSugerido()} /><//>
        <${Field} label="Contraseña inicial"><input class="input mono" value=${f.clave} onInput=${set('clave')} /><//>
      </div><${ReglasClave} c=${f.clave} />
      <p class="muted small">Entrará con su usuario y esta contraseña, con el rol de Repartidor. La contraseña se guarda cifrada; después podrá cambiarla o activar la huella.</p></div>`}
  <//>`;
}
