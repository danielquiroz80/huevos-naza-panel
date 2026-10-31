import { html, useState, useMemo, Icon, Card, Tabs, SearchBox, Loader, Empty, ErrorBox, Modal, Field, AsyncButton, Badge, useAsync, toast } from '../ui.js';
import { sb, q, money, num, fechaHora, norm, SOLICITUDES, accion, usuarios, ROLES, nombreUsuario } from '../lib.js';

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
    ${!dueno && html`<p class="muted small pad">Solo el dueño puede cambiar la configuración.</p>`}
    ${edit && html`<${Modal} title="Editar configuración" onClose=${() => setEdit(null)}
      footer=${html`<button class="btn ghost" onClick=${() => setEdit(null)}>Cancelar</button><${AsyncButton} className="btn primary" icon="check" onClick=${guardar}>Guardar<//>`}>
      <${Field} label=${DESCRIPCIONES[edit.clave] || edit.clave}><input class="input" value=${edit.valor} onInput=${(e) => setEdit({ ...edit, valor: e.target.value })} /><//>
      ${edit.clave === 'admin_chat_id' && html`<div class="warn"><${Icon} n="alert" size=${16} />Si cambias este número, los avisos y comandos del equipo irán a otro chat de Telegram.</div>`}
    <//>`}
  <//>`;
}

function Equipo({ perfil }) {
  const r = useAsync(async () => {
    const [admins, registro] = await Promise.all([
      q(sb.from('administradores').select('*').order('rol').order('nombre')),
      q(sb.from('registro_panel').select('*').order('created_at', { ascending: false }).limit(60))
    ]);
    return { admins, registro };
  }, []);
  const [dlg, setDlg] = useState(null);
  const d = r.data;
  const resumen = (x) => {
    if (x.accion === 'update' && x.detalle) return Object.entries(x.detalle).map(([k, v]) => `${k}: ${v.antes ?? '—'} → ${v.despues ?? '—'}`).join(' · ');
    if (x.detalle) return Object.entries(x.detalle).filter(([k]) => !['created_at', 'updated_at'].includes(k)).slice(0, 4).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · ');
    return '';
  };
  const set = (k) => (e) => setDlg({ ...dlg, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const guardar = async () => {
    if (dlg.t === 'nuevo') {
      await usuarios({ accion: 'crear', usuario: dlg.usuario, nombre: dlg.nombre, rol: dlg.rol, clave: dlg.clave, telefono: dlg.telefono, capacidad_canastas: dlg.rol === 'repartidor' ? dlg.capacidad_canastas : null });
      toast('Usuario creado. Entrega a ' + (dlg.nombre || dlg.usuario) + ' su usuario y contraseña.');
    } else if (dlg.t === 'editar') {
      await usuarios({ accion: 'editar', email: dlg.email, nombre: dlg.nombre, rol: dlg.rol, telefono: dlg.telefono, capacidad_canastas: dlg.rol === 'repartidor' ? dlg.capacidad_canastas : null, activo: dlg.activo });
      toast('Cambios guardados');
    } else {
      await usuarios({ accion: 'clave', email: dlg.email, clave: dlg.clave });
      toast('Contraseña cambiada');
    }
    setDlg(null); r.reload();
  };
  const sugerir = () => { const c = 'abcdefghjkmnpqrstuvwxyz23456789'; let x = ''; const a = crypto.getRandomValues(new Uint8Array(10)); a.forEach((n) => { x += c[n % c.length]; }); return x; };
  return html`<div class="stack">
    <${Card} title="Personas con acceso" icon="shield" pad=${false}
      action=${html`<button class="btn sm primary" onClick=${() => setDlg({ t: 'nuevo', usuario: '', nombre: '', rol: 'repartidor', clave: sugerir(), telefono: '', capacidad_canastas: '' })}><${Icon} n="plus" size=${14} />Nuevo usuario</button>`}>
      ${!d ? html`<div class="card-body"><${Loader} /></div>` : html`<div class="list">${d.admins.map((a) => html`<div class="row-item static" key=${a.email}>
        <div class="avatar soft">${(a.nombre || a.email).slice(0, 1).toUpperCase()}</div>
        <div class="ri-main"><b>${a.nombre || nombreUsuario(a.email)}</b>
          <span class="muted">Usuario: ${a.usuario || nombreUsuario(a.email)}${a.telefono ? ' · ' + a.telefono : ''}${a.capacidad_canastas ? ' · ' + a.capacidad_canastas + ' canastas' : ''}</span></div>
        <div class="ri-side"><div class="ri-badges"><${Badge} tone=${a.rol === 'dueno' ? 'amber' : a.rol === 'repartidor' ? 'violet' : 'blue'}>${ROLES[a.rol]}<//>${!a.activo && html`<${Badge} tone="gray">Inactivo<//>`}</div>
          <div class="row-btns"><button class="btn sm ghost" onClick=${() => setDlg({ t: 'editar', ...a, telefono: a.telefono || '', capacidad_canastas: a.capacidad_canastas || '' })}>Editar</button>
          <button class="btn sm ghost" onClick=${() => setDlg({ t: 'clave', email: a.email, nombre: a.nombre, clave: sugerir() })}>Contraseña</button></div></div></div>`)}</div>`}
    <//>
    <${Card} title="Registro de cambios" icon="history" pad=${false}>
      ${!d ? html`<div class="card-body"><${Loader} /></div>` : d.registro.length === 0 ? html`<${Empty} icon="history" title="Sin cambios registrados todavía" />` :
        html`<div class="table-wrap"><table class="table"><thead><tr><th>Fecha</th><th>Quién</th><th>Qué</th><th>Detalle</th></tr></thead><tbody>
          ${d.registro.map((x) => html`<tr key=${x.id}><td>${fechaHora(x.created_at)}</td><td>${nombreUsuario(x.email)}</td><td>${x.accion} ${x.tabla || ''}${x.registro_id ? ' #' + x.registro_id : ''}</td><td class="muted small">${resumen(x)}</td></tr>`)}
        </tbody></table></div>`}
    <//>
    ${dlg && html`<${Modal} title=${dlg.t === 'nuevo' ? 'Nuevo usuario' : dlg.t === 'editar' ? 'Editar ' + (dlg.nombre || dlg.usuario) : 'Nueva contraseña para ' + (dlg.nombre || nombreUsuario(dlg.email))} onClose=${() => setDlg(null)}
      footer=${html`<button class="btn ghost" onClick=${() => setDlg(null)}>Cancelar</button><${AsyncButton} className="btn primary" icon="check" onClick=${guardar}>Guardar<//>`}>
      ${dlg.t !== 'clave' && html`<div class="form-grid">
        ${dlg.t === 'nuevo' && html`<${Field} label="Usuario" hint="Sin espacios ni tildes. Ej.: carlos"><input class="input" autocapitalize="none" value=${dlg.usuario} onInput=${(e) => setDlg({ ...dlg, usuario: e.target.value.toLowerCase().replace(/\s+/g, '') })} /><//>`}
        <${Field} label="Nombre"><input class="input" value=${dlg.nombre || ''} onInput=${set('nombre')} /><//>
        <${Field} label="Rol"><select class="input" value=${dlg.rol} onChange=${set('rol')} disabled=${dlg.email === perfil.email}>
          <option value="repartidor">Repartidor (solo su ruta)</option><option value="operador">Operador (pedidos y entregas)</option><option value="dueno">Dueño (todo)</option></select><//>
        <${Field} label="Teléfono"><input class="input" type="tel" value=${dlg.telefono || ''} onInput=${set('telefono')} /><//>
        ${dlg.rol === 'repartidor' && html`<${Field} label="Capacidad (canastas)" hint="Cuántas canastas caben en su vehículo"><input class="input" type="number" min="1" value=${dlg.capacidad_canastas} onInput=${set('capacidad_canastas')} /><//>`}
      </div>`}
      ${dlg.t === 'editar' && dlg.email !== perfil.email && html`<label class="switch"><input type="checkbox" checked=${!!dlg.activo} onChange=${set('activo')} /><span></span>Puede entrar a la app</label>`}
      ${dlg.t !== 'editar' && html`<${Field} label="Contraseña" hint="Mínimo 8 caracteres. Compártela por un medio privado; la persona puede cambiarla en Mi cuenta.">
        <input class="input mono" value=${dlg.clave} onInput=${set('clave')} /><//>`}
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
    <div class="toolbar"><${Tabs} value=${tab} onChange=${setTab} items=${[{ v: 'casos', label: 'Casos de clientes' }, { v: 'zonas', label: 'Zonas' }, { v: 'config', label: 'Configuración' }, { v: 'equipo', label: 'Usuarios y registro' }]} /></div>
    ${tab === 'casos' && html`<${Solicitudes} />`}
    ${tab === 'zonas' && html`<${Zonas} />`}
    ${tab === 'config' && html`<div class="stack"><${GoogleMaps} /><${Configuracion} perfil=${perfil} /></div>`}
    ${tab === 'equipo' && html`<${Equipo} perfil=${perfil} />`}
  </div>`;
}
