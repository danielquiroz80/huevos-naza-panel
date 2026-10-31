import { html, useState, useMemo, Icon, Card, Tabs, SearchBox, Loader, Empty, ErrorBox, Modal, Field, AsyncButton, Badge, useAsync, toast } from '../ui.js';
import { sb, q, money, num, fechaHora, fecha, norm, SOLICITUDES, accion, usuarios, ROLES, nombreUsuario, claveInvalida, sugerirClave, REGLAS_CLAVE, diasDesde } from '../lib.js';

function Solicitudes() {
  const r = useAsync(() => q(sb.from('v_solicitudes_abiertas').select('*').order('created_at')), []);
  const [sel, setSel] = useState(null);
  const resolver = async () => {
    const res = await accion({ accion: 'resolver', solicitud_id: sel.id, mensaje: sel.mensaje.trim() });
    toast(res.mensaje || 'Caso resuelto'); setSel(null); r.reload();
  };
  return html`<${Card} title="Casos abiertos de clientes" icon="chat" pad=${false}>
    <${ErrorBox} error=${r.error} onRetry=${r.reload} />
    ${r.loading && !r.data ? html`<div class="card-body"><${Loader} /></div>` : (r.data || []).length === 0 ? html`<${Empty} icon="check" title="No hay casos abiertos" />` :
      html`<div class="list">${r.data.map((s) => html`<div class="row-item static" key=${s.id}>
        <div class="ri-id">#${s.id}</div>
        <div class="ri-main"><b>${s.cliente || 'Cliente'} <${Badge} tone=${s.tipo === 'queja' ? 'red' : 'blue'}>${SOLICITUDES[s.tipo] || s.tipo}<//></b>
          <span>${s.detalle}</span><span class="ri-meta">${fechaHora(s.created_at)}${s.pedido_id ? ' · pedido #' + s.pedido_id : ''}</span></div>
        <div class="ri-side"><button class="btn sm primary" onClick=${() => setSel({ ...s, mensaje: '' })}>Resolver</button></div>
      </div>`)}</div>`}
    ${sel && html`<${Modal} title=${'Resolver caso #' + sel.id} onClose=${() => setSel(null)}
      footer=${html`<button class="btn ghost" onClick=${() => setSel(null)}>Volver</button><${AsyncButton} className="btn primary" icon="check" onClick=${resolver}>Marcar resuelto<//>`}>
      <p class="quote">${sel.detalle}</p>
      <${Field} label="Mensaje para el cliente (opcional)" hint="Si lo escribes, el bot se lo envía."><textarea class="input" rows="3" value=${sel.mensaje} onInput=${(e) => setSel({ ...sel, mensaje: e.target.value })}></textarea><//>
    <//>`}
  <//>`;
}

function Zonas() {
  const r = useAsync(async () => {
    const [zonas, nr] = await Promise.all([
      q(sb.from('zonas_cobertura').select('*').order('municipio').order('barrio').range(0, 1999)),
      q(sb.from('zonas_no_reconocidas').select('*').eq('resuelto', false).order('created_at', { ascending: false }).limit(100))
    ]);
    return { zonas, nr };
  }, []);
  const [texto, setTexto] = useState('');
  const [mun, setMun] = useState('');
  const [filtro, setFiltro] = useState('todas');
  const [edit, setEdit] = useState(null);
  const d = r.data;
  const municipios = useMemo(() => d ? [...new Set(d.zonas.map((z) => z.municipio).filter(Boolean))].sort() : [], [d]);
  const filas = useMemo(() => {
    if (!d) return [];
    const t = norm(texto.trim());
    return d.zonas.filter((z) => (!mun || z.municipio === mun) && (filtro === 'todas' || (filtro === 'si') === !!z.cubierto) && (!t || norm(z.barrio + ' ' + z.municipio + ' ' + (z.referencia || '')).includes(t)));
  }, [d, texto, mun, filtro]);

  const guardar = async () => {
    const c = { cubierto: !!edit.cubierto, costo_domicilio: edit.costo_domicilio === '' || edit.costo_domicilio == null ? null : Number(edit.costo_domicilio),
      pedido_minimo: edit.pedido_minimo === '' || edit.pedido_minimo == null ? null : Number(edit.pedido_minimo), dias_entrega: (edit.dias_entrega || '').trim() || null, notas: (edit.notas || '').trim() || null };
    await q(sb.from('zonas_cobertura').update(c).eq('id', edit.id));
    toast('Zona actualizada'); setEdit(null); r.reload();
  };
  const resolverNR = async (z) => { await q(sb.from('zonas_no_reconocidas').update({ resuelto: true }).eq('id', z.id)); toast('Marcado como revisado'); r.reload(); };

  return html`<div class="stack">
    ${d && d.nr.length > 0 && html`<${Card} title="Barrios que el bot no reconoció" icon="alert" pad=${false}>
      <div class="list">${d.nr.map((z) => html`<div class="row-item static" key=${z.id}>
        <div class="ri-main"><b>${z.texto}</b><span class="muted">${z.mensaje || ''}</span><span class="ri-meta">${fechaHora(z.created_at)}</span></div>
        <div class="ri-side"><${AsyncButton} className="btn sm ghost" icon="check" onClick=${() => resolverNR(z)}>Revisado<//></div></div>`)}</div>
    <//>`}
    <${Card} title="Cobertura de entregas" icon="pin" pad=${false}>
      <div class="card-body toolbar">
        <${SearchBox} value=${texto} onInput=${setTexto} placeholder="Buscar barrio" />
        <select class="input auto" value=${mun} onChange=${(e) => setMun(e.target.value)}><option value="">Todos los municipios</option>${municipios.map((m) => html`<option value=${m}>${m}</option>`)}</select>
        <select class="input auto" value=${filtro} onChange=${(e) => setFiltro(e.target.value)}><option value="todas">Todas</option><option value="si">Con cobertura</option><option value="no">Sin cobertura</option></select>
      </div>
      <${ErrorBox} error=${r.error} onRetry=${r.reload} />
      ${!d ? html`<div class="card-body"><${Loader} /></div>` : html`<div class="table-wrap tall"><table class="table"><thead><tr><th>Barrio</th><th>Municipio</th><th>Cobertura</th><th class="r">Domicilio</th><th class="r">Mínimo</th><th>Días</th><th></th></tr></thead><tbody>
        ${filas.slice(0, 300).map((z) => html`<tr key=${z.id}><td><b>${z.barrio}</b>${z.referencia && html`<br /><small class="muted">${z.referencia}</small>`}</td><td>${z.municipio}</td>
          <td><${Badge} tone=${z.cubierto ? 'green' : 'gray'}>${z.cubierto ? 'Sí' : 'No'}<//></td><td class="r">${z.costo_domicilio != null ? money(z.costo_domicilio) : '—'}</td>
          <td class="r">${z.pedido_minimo != null ? num(z.pedido_minimo) : '—'}</td><td>${z.dias_entrega || '—'}</td>
          <td class="r"><button class="icon-btn" aria-label="Editar zona" onClick=${() => setEdit({ ...z })}><${Icon} n="edit" size=${16} /></button></td></tr>`)}
      </tbody></table>${filas.length > 300 && html`<p class="muted small pad">Mostrando 300 de ${num(filas.length)}. Usa el buscador para encontrar un barrio.</p>`}</div>`}
    <//>
    ${edit && html`<${Modal} title=${edit.barrio + ' · ' + edit.municipio} onClose=${() => setEdit(null)}
      footer=${html`<button class="btn ghost" onClick=${() => setEdit(null)}>Cancelar</button><${AsyncButton} className="btn primary" icon="check" onClick=${guardar}>Guardar<//>`}>
      <label class="switch"><input type="checkbox" checked=${!!edit.cubierto} onChange=${(e) => setEdit({ ...edit, cubierto: e.target.checked })} /><span></span>Hacemos entregas en este barrio</label>
      <div class="form-grid">
        <${Field} label="Costo de domicilio" hint="Vacío = sin costo"><input class="input" type="number" min="0" step="500" value=${edit.costo_domicilio ?? ''} onInput=${(e) => setEdit({ ...edit, costo_domicilio: e.target.value })} /><//>
        <${Field} label="Pedido mínimo (canastas)"><input class="input" type="number" min="0" step="1" value=${edit.pedido_minimo ?? ''} onInput=${(e) => setEdit({ ...edit, pedido_minimo: e.target.value })} /><//>
      </div>
      <${Field} label="Días de entrega" hint="Ej.: viernes, sábado"><input class="input" value=${edit.dias_entrega || ''} onInput=${(e) => setEdit({ ...edit, dias_entrega: e.target.value })} /><//>
      <${Field} label="Notas internas"><input class="input" value=${edit.notas || ''} onInput=${(e) => setEdit({ ...edit, notas: e.target.value })} /><//>
    <//>`}
  </div>`;
}

const DESCRIPCIONES = {
  nombre_negocio: 'Nombre que usa el bot', dias_recompra_default: 'Días para recordar recompra si el cliente no tiene frecuencia',
  url_politica_datos: 'Enlace a la política de tratamiento de datos (Ley 1581)', admin_chat_id: 'Chat de Telegram del equipo'
};

function Configuracion({ perfil }) {
  const r = useAsync(() => q(sb.from('config').select('*').order('clave')), []);
  const [edit, setEdit] = useState(null);
  const dueno = perfil?.rol === 'dueno';
  const guardar = async () => { await q(sb.from('config').update({ valor: edit.valor.trim() }).eq('clave', edit.clave)); toast('Configuración guardada'); setEdit(null); r.reload(); };
  return html`<${Card} title="Configuración del negocio" icon="store" pad=${false}>
    <${ErrorBox} error=${r.error} onRetry=${r.reload} />
    ${!r.data ? html`<div class="card-body"><${Loader} /></div>` : html`<div class="list">${r.data.map((c) => html`<div class="row-item static" key=${c.clave}>
      <div class="ri-main"><b>${DESCRIPCIONES[c.clave] || c.descripcion || c.clave}</b><span class=${c.valor ? '' : 'muted'}>${c.valor || 'Sin configurar'}</span><span class="ri-meta">${c.clave}</span></div>
      <div class="ri-side">${dueno && html`<button class="btn sm ghost" onClick=${() => setEdit({ ...c, valor: c.valor || '' })}><${Icon} n="edit" size=${14} />Editar</button>`}</div></div>`)}</div>`}
    ${!dueno && html`<p class="muted small pad">Solo un administrador puede cambiar la configuración.</p>`}
    ${edit && html`<${Modal} title="Editar configuración" onClose=${() => setEdit(null)}
      footer=${html`<button class="btn ghost" onClick=${() => setEdit(null)}>Cancelar</button><${AsyncButton} className="btn primary" icon="check" onClick=${guardar}>Guardar<//>`}>
      <${Field} label=${DESCRIPCIONES[edit.clave] || edit.clave}><input class="input" value=${edit.valor} onInput=${(e) => setEdit({ ...edit, valor: e.target.value })} /><//>
      ${edit.clave === 'admin_chat_id' && html`<div class="warn"><${Icon} n="alert" size=${16} />Si cambias este número, los avisos y comandos del equipo irán a otro chat de Telegram.</div>`}
    <//>`}
  <//>`;
}

function Equipo({ perfil }) {
  const r = useAsync(() => q(sb.from('administradores').select('*').order('rol').order('nombre')), []);
  const [dlg, setDlg] = useState(null);
  const set = (k) => (e) => setDlg({ ...dlg, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const guardar = async () => {
    if (dlg.t !== 'editar') { const err = claveInvalida(dlg.clave); if (err) throw new Error(err); }
    if (dlg.t === 'nuevo') {
      if (!dlg.usuario) throw new Error('Escribe el nombre de usuario.');
      await usuarios({ accion: 'crear', usuario: dlg.usuario, nombre: dlg.nombre, rol: dlg.rol, clave: dlg.clave, correo: dlg.correo, telefono: dlg.telefono, capacidad_canastas: dlg.rol === 'repartidor' ? dlg.capacidad_canastas : null });
      toast('Usuario creado. Comparte el usuario y la contraseña con ' + (dlg.nombre || dlg.usuario) + '.');
    } else if (dlg.t === 'editar') {
      await usuarios({ accion: 'editar', email: dlg.email, nombre: dlg.nombre, rol: dlg.rol, correo: dlg.correo, telefono: dlg.telefono, capacidad_canastas: dlg.rol === 'repartidor' ? dlg.capacidad_canastas : null, activo: dlg.activo });
      toast('Cambios guardados');
    } else {
      await usuarios({ accion: 'clave', email: dlg.email, clave: dlg.clave });
      toast('Contraseña cambiada. Compártela con ' + (dlg.nombre || 'la persona') + '.');
    }
    setDlg(null); r.reload();
  };
  const copiar = (t) => navigator.clipboard && navigator.clipboard.writeText(t).then(() => toast('Copiado'));
  const reglas = (c) => html`<ul class="reglas">${REGLAS_CLAVE.map((x) => html`<li key=${x.t} class=${x.f(c || '') ? 'ok' : ''}><${Icon} n=${x.f(c || '') ? 'check' : 'x'} size=${13} />${x.t}</li>`)}</ul>`;
  const d = r.data;
  return html`<div class="stack">
    <${Card} title="Usuarios" icon="users" pad=${false}
      action=${html`<button class="btn sm primary" onClick=${() => setDlg({ t: 'nuevo', usuario: '', nombre: '', rol: 'repartidor', clave: sugerirClave(), correo: '', telefono: '', capacidad_canastas: '' })}><${Icon} n="plus" size=${14} />Agregar usuario</button>`}>
      <${ErrorBox} error=${r.error} onRetry=${r.reload} />
      ${!d ? html`<div class="card-body"><${Loader} /></div>` : html`<div class="list">${d.map((a) => html`<div class="row-item static" key=${a.email}>
        <div class="avatar soft">${(a.nombre || a.usuario || a.email).slice(0, 1).toUpperCase()}</div>
        <div class="ri-main"><b>${a.nombre || a.usuario}</b>
          <span class="muted">@${a.usuario || nombreUsuario(a.email)}${a.correo ? ' · ' + a.correo : ''}${a.telefono ? ' · ' + a.telefono : ''}${a.capacidad_canastas ? ' · ' + a.capacidad_canastas + ' canastas' : ''}</span></div>
        <div class="ri-side"><div class="ri-badges"><${Badge} tone=${a.rol === 'dueno' ? 'amber' : a.rol === 'repartidor' ? 'violet' : 'blue'}>${ROLES[a.rol]}<//>${!a.activo && html`<${Badge} tone="gray">Desactivado<//>`}</div>
          <div class="row-btns"><button class="btn sm ghost" onClick=${() => setDlg({ t: 'editar', ...a, correo: a.correo || '', telefono: a.telefono || '', capacidad_canastas: a.capacidad_canastas || '' })}>Editar</button>
          <button class="btn sm ghost" onClick=${() => setDlg({ t: 'clave', email: a.email, nombre: a.nombre, clave: sugerirClave() })}>Nueva contraseña</button></div></div></div>`)}</div>`}
      <p class="muted small pad">Admin: ve y administra todo · Operador: pedidos y entregas · Repartidor: solo su ruta.</p>
    <//>
    ${dlg && html`<${Modal} title=${dlg.t === 'nuevo' ? 'Agregar usuario' : dlg.t === 'editar' ? 'Editar a ' + (dlg.nombre || dlg.usuario) : 'Nueva contraseña para ' + (dlg.nombre || nombreUsuario(dlg.email))} onClose=${() => setDlg(null)}
      footer=${html`<button class="btn ghost" onClick=${() => setDlg(null)}>Cancelar</button><${AsyncButton} className="btn primary" icon="check" onClick=${guardar}>Guardar<//>`}>
      ${dlg.t !== 'clave' && html`<div class="form-grid">
        ${dlg.t === 'nuevo' && html`<${Field} label="Usuario" hint="Sin espacios ni tildes. Ej.: carlos"><input class="input" autocapitalize="none" value=${dlg.usuario} onInput=${(e) => setDlg({ ...dlg, usuario: e.target.value.toLowerCase().replace(/\s+/g, '') })} /><//>`}
        <${Field} label="Nombre"><input class="input" value=${dlg.nombre || ''} onInput=${set('nombre')} placeholder="Nombre y apellido" /><//>
        <${Field} label="Rol"><select class="input" value=${dlg.rol} onChange=${set('rol')} disabled=${dlg.email === perfil.email}>
          <option value="repartidor">Repartidor</option><option value="operador">Operador</option><option value="dueno">Admin</option></select><//>
        <${Field} label="Correo (opcional)" hint="Sirve para recuperar la contraseña"><input class="input" type="email" autocapitalize="none" value=${dlg.correo || ''} onInput=${set('correo')} /><//>
        <${Field} label="Teléfono (opcional)"><input class="input" type="tel" value=${dlg.telefono || ''} onInput=${set('telefono')} /><//>
        ${dlg.rol === 'repartidor' && html`<${Field} label="Capacidad (canastas)" hint="Cuántas caben en su vehículo"><input class="input" type="number" min="1" value=${dlg.capacidad_canastas} onInput=${set('capacidad_canastas')} /><//>`}
      </div>`}
      ${dlg.t === 'editar' && dlg.email !== perfil.email && html`<label class="switch"><input type="checkbox" checked=${!!dlg.activo} onChange=${set('activo')} /><span></span>Puede entrar a la app</label>`}
      ${dlg.t !== 'editar' && html`<${Field} label="Contraseña">
        <div class="origen"><input class="input mono" value=${dlg.clave} onInput=${set('clave')} />
          <button type="button" class="btn ghost" onClick=${() => setDlg({ ...dlg, clave: sugerirClave() })}>Generar</button>
          <button type="button" class="btn ghost" onClick=${() => copiar(dlg.clave)}>Copiar</button></div>
        ${reglas(dlg.clave)}<//>
        <p class="muted small">Compártela por un medio privado. La persona puede cambiarla después en "Mi cuenta".</p>`}
    <//>`}
  </div>`;
}

const EVENTOS = { ingreso: 'Entró', desbloqueo: 'Desbloqueó con huella', salida: 'Cerró sesión', fallido: 'Intento fallido', recuperacion: 'Pidió recuperar contraseña' };

function Actividad() {
  const r = useAsync(async () => {
    const desde = new Date(Date.now() - 30 * 86400000).toISOString();
    const [admins, ingresos, registro] = await Promise.all([
      q(sb.from('administradores').select('email,usuario,nombre,rol,activo')),
      q(sb.from('inicios_sesion').select('*').gte('created_at', desde).order('created_at', { ascending: false }).limit(1000)),
      q(sb.from('registro_panel').select('*').order('created_at', { ascending: false }).limit(150))
    ]);
    return { admins, ingresos, registro };
  }, []);
  const [vista, setVista] = useState('resumen');
  const [quien, setQuien] = useState('');
  const d = r.data;
  const resumenCambio = (x) => {
    if (x.accion === 'update' && x.detalle) return Object.entries(x.detalle).map(([k, v]) => `${k}: ${v && v.antes != null ? v.antes : '—'} → ${v && v.despues != null ? v.despues : '—'}`).join(' · ');
    if (x.detalle) return Object.entries(x.detalle).filter(([k]) => !['created_at', 'updated_at', 'origen'].includes(k)).slice(0, 4).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · ');
    return '';
  };
  const ACC = { update: 'Modificó', insert: 'Agregó', encamino: 'En camino', entregado: 'Entregado', cancelar: 'Canceló', pago_registrar: 'Registró pago', pago_verificar: 'Verificó pago', resolver: 'Resolvió caso', lista_espera: 'Avisó lista de espera', entrega: 'Entrega', ruta_iniciar: 'Inició ruta', ruta_optimizar: 'Ordenó ruta' };
  if (!d) return html`<${ErrorBox} error=${r.error} onRetry=${r.reload} /><${Loader} rows=${6} />`;
  const nombre = (email, usuario) => { const a = d.admins.find((x) => x.email === email || (usuario && x.usuario === usuario)); return a ? (a.nombre || a.usuario) : (usuario || nombreUsuario(email) || 'Desconocido'); };
  const filas = d.admins.map((a) => {
    const ev = d.ingresos.filter((x) => x.email === a.email);
    const ok = ev.filter((x) => x.evento === 'ingreso' || x.evento === 'desbloqueo');
    return { ...a, ultimo: ok[0], ingresos: ok.length, fallidos: ev.filter((x) => x.evento === 'fallido' && diasDesde(x.created_at) <= 7).length };
  }).sort((a, b) => String(b.ultimo ? b.ultimo.created_at : '').localeCompare(String(a.ultimo ? a.ultimo.created_at : '')));
  const fallidosDesconocidos = d.ingresos.filter((x) => x.evento === 'fallido' && !x.email).length;
  const eventos = quien ? d.ingresos.filter((x) => x.email === quien) : d.ingresos;
  const cambios = quien ? d.registro.filter((x) => x.email === quien) : d.registro;
  return html`<div class="stack">
    <div class="toolbar">
      <${Tabs} value=${vista} onChange=${setVista} items=${[{ v: 'resumen', label: 'Resumen' }, { v: 'ingresos', label: 'Ingresos', n: eventos.length }, { v: 'cambios', label: 'Cambios y acciones', n: cambios.length }]} />
      ${vista !== 'resumen' && html`<select class="input auto" value=${quien} onChange=${(e) => setQuien(e.target.value)}><option value="">Todas las personas</option>
        ${d.admins.map((a) => html`<option value=${a.email}>${a.nombre || a.usuario}</option>`)}</select>`}
    </div>
    ${vista === 'resumen' && html`<${Card} title="Ingresos de los últimos 30 días" icon="shield" pad=${false}>
      <div class="table-wrap"><table class="table"><thead><tr><th>Persona</th><th>Rol</th><th>Último ingreso</th><th>Dispositivo</th><th class="r">Ingresos</th><th class="r">Fallidos (7 días)</th></tr></thead><tbody>
        ${filas.map((a) => html`<tr key=${a.email}><td><b>${a.nombre || a.usuario}</b><br /><small class="muted">@${a.usuario || nombreUsuario(a.email)}</small></td><td>${ROLES[a.rol]}</td>
          <td>${a.ultimo ? fechaHora(a.ultimo.created_at) : html`<span class="muted">Sin ingresos</span>`}</td><td class="muted small">${a.ultimo ? a.ultimo.dispositivo : ''}</td>
          <td class="r">${num(a.ingresos)}</td><td class=${'r ' + (a.fallidos ? 'neg' : '')}>${num(a.fallidos)}</td></tr>`)}
      </tbody></table></div>
      ${fallidosDesconocidos > 0 && html`<p class="warn m"><${Icon} n="alert" size=${16} />${fallidosDesconocidos} intento(s) con usuarios que no existen en los últimos 30 días.</p>`}
      <p class="muted small pad">Los ingresos se registran desde esta versión de la app.</p>
    <//>`}
    ${vista === 'ingresos' && html`<${Card} pad=${false}>
      ${!eventos.length ? html`<${Empty} icon="shield" title="Sin registros" />` : html`<div class="table-wrap tall"><table class="table"><thead><tr><th>Fecha</th><th>Persona</th><th>Qué pasó</th><th>Dispositivo</th></tr></thead><tbody>
        ${eventos.map((x) => html`<tr key=${x.id}><td>${fechaHora(x.created_at)}</td><td>${nombre(x.email, x.usuario)}</td>
          <td><${Badge} tone=${x.evento === 'fallido' ? 'red' : x.evento === 'salida' ? 'gray' : x.evento === 'recuperacion' ? 'amber' : 'green'}>${EVENTOS[x.evento]}<//></td><td class="muted small">${x.dispositivo || ''}</td></tr>`)}
      </tbody></table></div>`}
    <//>`}
    ${vista === 'cambios' && html`<${Card} pad=${false}>
      ${!cambios.length ? html`<${Empty} icon="history" title="Sin cambios registrados" />` : html`<div class="table-wrap tall"><table class="table"><thead><tr><th>Fecha</th><th>Persona</th><th>Acción</th><th>Detalle</th></tr></thead><tbody>
        ${cambios.map((x) => html`<tr key=${x.id}><td>${fechaHora(x.created_at)}</td><td>${nombre(x.email)}</td><td>${ACC[x.accion] || x.accion} ${x.tabla || ''}${x.registro_id ? ' #' + x.registro_id : ''}</td><td class="muted small">${resumenCambio(x)}</td></tr>`)}
      </tbody></table></div>`}
    <//>`}
  </div>`;
}

function GoogleMaps() {
  const r = useAsync(() => q(sb.rpc('panel_secretos_configurados')), []);
  const [clave, setClave] = useState('');
  const activa = (r.data || []).includes('google_maps_key');
  const guardar = async (v) => { await q(sb.rpc('panel_guardar_secreto', { p_clave: 'google_maps_key', p_valor: v })); setClave(''); toast(v ? 'Clave guardada' : 'Clave eliminada'); r.reload(); };
  return html`<${Card} title="Google Maps (rutas de entrega)" icon="pin">
    <p class="muted small">Con la clave, la ruta se ordena con Google Maps (direcciones colombianas y tiempos reales). Sin ella, el orden es aproximado.
      La clave se guarda cifrada en el servidor y nadie puede leerla desde la app.</p>
    <div class="origen"><input class="input mono" type="password" placeholder=${activa ? 'Clave configurada ✓ — escribe otra para cambiarla' : 'Pega aquí la clave de Google Maps'} value=${clave} onInput=${(e) => setClave(e.target.value)} />
      <${AsyncButton} className="btn primary" icon="check" disabled=${clave.trim().length < 20} onClick=${() => guardar(clave)}>Guardar<//></div>
    ${activa && html`<div class="row-btns"><${Badge} tone="green">Activa<//><${AsyncButton} className="btn sm danger-ghost" icon="x" onClick=${() => guardar('')}>Quitar clave<//></div>`}
  <//>`;
}

export function Negocio({ perfil }) {
  const [tab, setTab] = useState('casos');
  return html`<div class="stack">
    <div class="toolbar"><${Tabs} value=${tab} onChange=${setTab} items=${[{ v: 'casos', label: 'Casos de clientes' }, { v: 'zonas', label: 'Zonas' }, { v: 'config', label: 'Configuración' }, { v: 'equipo', label: 'Usuarios' }, { v: 'actividad', label: 'Actividad' }]} /></div>
    ${tab === 'casos' && html`<${Solicitudes} />`}
    ${tab === 'zonas' && html`<${Zonas} />`}
    ${tab === 'config' && html`<div class="stack"><${GoogleMaps} /><${Configuracion} perfil=${perfil} /></div>`}
    ${tab === 'equipo' && html`<${Equipo} perfil=${perfil} />`}
    ${tab === 'actividad' && html`<${Actividad} />`}
  </div>`;
}
