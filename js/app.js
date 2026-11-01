import { render } from 'https://esm.sh/htm@3.1.1/preact/standalone';
import { html, useState, useEffect, Icon, Toaster, toast, AsyncButton, Field, Modal, useArrastre } from './ui.js';
import { sb, q, CONFIG, ROLES, nombreUsuario, claveInvalida, REGLAS_CLAVE, DOMINIO_USUARIOS, dispositivo, registrarEvento, salir } from './lib.js';
import { bioDisponible, bioConfig, bioActivar, bioVerificar, bioDesactivar, desbloqueado, bloquear } from './bio.js';
import { Inicio } from './pages/inicio.js';
import { Pedidos } from './pages/pedidos.js';
import { Clientes } from './pages/clientes.js';
import { Productos } from './pages/productos.js';
import { Compras } from './pages/compras.js';
import { Estadisticas } from './pages/estadisticas.js';
import { Planeacion } from './pages/planeacion.js';
import { Negocio } from './pages/negocio.js';
import { Entregas, MiRuta } from './pages/entregas.js';
import { Repartidores } from './pages/repartidores.js';
import { Reportes } from './pages/reportes.js';
import { iniciarRastreo } from './rastreo.js';
import { Consejos } from './pages/consejos.js';

const TODAS = [
  { id: 'inicio', label: 'Inicio', icon: 'home', C: Inicio, roles: ['dueno'] },
  { id: 'pedidos', label: 'Pedidos', icon: 'pedidos', C: Pedidos, roles: ['dueno', 'operador'] },
  { id: 'entregas', label: 'Entregas', icon: 'truck', C: Entregas, roles: ['dueno', 'operador'] },
  { id: 'ruta', label: 'Mis rutas', icon: 'route', C: MiRuta, roles: ['repartidor'] },
  { id: 'repartidores', label: 'Repartidores', icon: 'idcard', C: Repartidores, roles: ['dueno'] },
  { id: 'reportes', label: 'Reportes', icon: 'file', C: Reportes, roles: ['dueno'] },
  { id: 'consejos', label: 'Consejos', icon: 'spark', C: Consejos, roles: ['dueno'] },
  { id: 'productos', label: 'Productos', icon: 'box', C: Productos, roles: ['dueno'] },
  { id: 'clientes', label: 'Clientes', icon: 'users', C: Clientes, roles: ['dueno'] },
  { id: 'compras', label: 'Compras y gastos', icon: 'cart', C: Compras, roles: ['dueno'] },
  { id: 'estadisticas', label: 'Estadísticas', icon: 'chart', C: Estadisticas, roles: ['dueno'] },
  { id: 'planeacion', label: 'Planeación', icon: 'calendar', C: Planeacion, roles: ['dueno'] },
  { id: 'negocio', label: 'Administración', icon: 'store', C: Negocio, roles: ['dueno'] }
];
const MOVIL = { dueno: ['inicio', 'pedidos', 'entregas', 'repartidores'], operador: ['pedidos', 'entregas'], repartidor: ['ruta'] };

function rutaActual(rutas) {
  const h = location.hash.replace(/^#\/?/, '').split(/[?&]/)[0];
  return rutas.find((r) => r.id === h) ? h : rutas[0].id;
}

/* ---------- Inicio de sesión ---------- */
function ClaveInput({ value, onInput, onKeyDown, autocomplete = 'current-password', reglas }) {
  const [ver, setVer] = useState(false);
  return html`<div>
    <div class="pass"><input class="input" type=${ver ? 'text' : 'password'} autocomplete=${autocomplete} value=${value} onInput=${(e) => onInput(e.target.value)} onKeyDown=${onKeyDown} />
      <button type="button" class="pass-ver" aria-label=${ver ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick=${() => setVer(!ver)}>${ver ? 'Ocultar' : 'Ver'}</button></div>
    ${reglas && html`<ul class="reglas">${REGLAS_CLAVE.map((r) => html`<li key=${r.t} class=${r.f(value) ? 'ok' : ''}><${Icon} n=${r.f(value) ? 'check' : 'x'} size=${13} />${r.t}</li>`)}</ul>`}
  </div>`;
}

function Login() {
  const [modo, setModo] = useState('entrar');
  const [usuario, setUsuario] = useState(localStorage.getItem('naza_usuario') || '');
  const [clave, setClave] = useState('');
  const [enviado, setEnviado] = useState('');

  const entrar = async () => {
    const u = usuario.trim().toLowerCase();
    if (!u || !clave) throw new Error('Escribe tu usuario y tu contraseña.');
    const email = u.includes('@') ? u : await q(sb.rpc('email_para_login', { p_usuario: u }));
    sessionStorage.setItem('naza_desbloqueado', '1'); // la contraseña ya cuenta como desbloqueo: no pedir huella después
    const { error } = email ? await sb.auth.signInWithPassword({ email, password: clave }) : { error: { message: 'invalid' } };
    if (error) {
      sessionStorage.removeItem('naza_desbloqueado');
      sb.rpc('panel_ingreso_fallido', { p_usuario: u, p_evento: 'fallido', p_dispositivo: dispositivo() }).then(() => {}, () => {});
      throw new Error(/banned/i.test(error.message) ? 'Tu usuario está desactivado. Habla con el administrador.' : /rate|many/i.test(error.message) ? 'Hiciste muchos intentos. Espera un momento y vuelve a intentarlo.' : 'El usuario o la contraseña no coinciden.');
    }
    localStorage.setItem('naza_usuario', u);
    registrarEvento('ingreso');
  };
  const recuperar = async () => {
    const u = usuario.trim().toLowerCase();
    if (!u) throw new Error('Escribe tu usuario o tu correo.');
    const email = u.includes('@') ? u : await q(sb.rpc('email_para_login', { p_usuario: u }));
    sb.rpc('panel_ingreso_fallido', { p_usuario: u, p_evento: 'recuperacion', p_dispositivo: dispositivo() }).then(() => {}, () => {});
    if (!email) throw new Error('No encontramos ese usuario. Revisa cómo lo escribiste.');
    if (email.endsWith('@' + DOMINIO_USUARIOS)) throw new Error('Tu usuario no tiene un correo registrado. Pídele al administrador que te asigne una contraseña nueva.');
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    if (error) throw new Error(/rate|seconds|429/i.test(error.message) ? 'Ya enviamos varios correos hace poco. Espera unos minutos e inténtalo de nuevo, o pídele al administrador una contraseña nueva.' : error.message);
    const [a, d] = email.split('@');
    setEnviado(a.slice(0, 2) + '•••@' + d);
  };
  const enter = (e) => { if (e.key === 'Enter') document.querySelector('#btn-login button')?.click(); };

  return html`<div class="login">
    <div class="login-art">
      <div class="login-blob"></div>
      <img src="assets/logo.png" alt="Huevos de la Naza" class="login-logo" />
      <h1>${CONFIG.negocio}</h1>
      <p>Pedidos, entregas, clientes e inventario, todo en un solo lugar.</p>
    </div>
    <div class="login-card">
      ${modo === 'entrar' ? html`
        <h2>¡Hola de nuevo!</h2>
        <p class="muted">Entra con tu usuario y tu contraseña.</p>
        <${Field} label="Usuario">
          <input class="input" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="Ej.: daniel" value=${usuario}
            onInput=${(e) => setUsuario(e.target.value)} onKeyDown=${enter} />
        <//>
        <${Field} label="Contraseña"><${ClaveInput} value=${clave} onInput=${setClave} onKeyDown=${enter} /><//>
        <div id="btn-login"><${AsyncButton} className="btn primary block" icon="check" onClick=${entrar}>Entrar<//></div>
        <button class="link center-link" onClick=${() => { setModo('recuperar'); setEnviado(''); }}>¿Olvidaste tu contraseña?</button>
      ` : !enviado ? html`
        <h2>Recupera tu contraseña</h2>
        <p class="muted">Escribe tu usuario y te enviaremos un enlace a tu correo para crear una contraseña nueva.</p>
        <${Field} label="Usuario o correo"><input class="input" autocapitalize="none" value=${usuario} onInput=${(e) => setUsuario(e.target.value)} /><//>
        <${AsyncButton} className="btn primary block" icon="mail" onClick=${recuperar}>Enviar enlace<//>
        <button class="btn ghost block" onClick=${() => setModo('entrar')}>Volver</button>
      ` : html`
        <div class="sent-ico"><${Icon} n="mail" size=${28} /></div>
        <h2>Revisa tu correo</h2>
        <p class="muted">Enviamos un enlace a <b>${enviado}</b>. Ábrelo en este mismo dispositivo para crear tu contraseña nueva. Si no lo ves, revisa la carpeta de spam.</p>
        <button class="btn ghost block" onClick=${() => setModo('entrar')}>Volver a entrar</button>
      `}
      <p class="login-foot"><${Icon} n="shield" size=${14} /> Solo pueden entrar las personas que autoriza el administrador.</p>
    </div>
  </div>`;
}

function NuevaClave({ onListo }) {
  const [c1, setC1] = useState('');
  const [c2, setC2] = useState('');
  const guardar = async () => {
    const err = claveInvalida(c1); if (err) throw new Error(err);
    if (c1 !== c2) throw new Error('Las dos contraseñas no coinciden.');
    const { error } = await sb.auth.updateUser({ password: c1 });
    if (error) throw new Error(/different|same/i.test(error.message) ? 'Usa una contraseña diferente a la anterior.' : error.message);
    sessionStorage.setItem('naza_desbloqueado', '1');
    registrarEvento('ingreso');
    toast('¡Listo! Tu contraseña quedó guardada.');
    onListo();
  };
  return html`<div class="login"><div class="login-card">
    <h2>Crea tu contraseña nueva</h2>
    <${Field} label="Contraseña nueva"><${ClaveInput} value=${c1} onInput=${setC1} autocomplete="new-password" reglas=${true} /><//>
    <${Field} label="Repítela"><${ClaveInput} value=${c2} onInput=${setC2} autocomplete="new-password" /><//>
    <${AsyncButton} className="btn primary block" icon="check" onClick=${guardar}>Guardar y entrar<//>
  </div></div>`;
}

function Bloqueo({ perfil, conf, onOk }) {
  const [auto, setAuto] = useState(true);
  const intentar = async () => {
    try { await bioVerificar(conf); } catch (e) { throw new Error('No pudimos leer tu huella. Toca "Entrar con huella" para intentarlo de nuevo.'); }
    registrarEvento('desbloqueo'); onOk();
  };
  useEffect(() => { if (auto) { setAuto(false); intentar().catch(() => {}); } }, []);
  const nombre = (perfil.nombre || '').split(' ')[0] || perfil.usuario || nombreUsuario(perfil.email);
  return html`<div class="login lock"><div class="login-card center">
    <img src="assets/logo.png" alt="" width="84" height="84" class="round" />
    <h2>Hola, ${nombre}</h2>
    <p class="muted">Usa tu huella o tu rostro para entrar.</p>
    <${AsyncButton} className="finger-btn" onClick=${intentar}><span class="finger-ico"><${Icon} n="finger" size=${42} /></span><span>Entrar con huella</span><//>
    <button class="btn ghost block" onClick=${() => salir()}><${Icon} n="lock" size=${16} />Entrar con contraseña u otra cuenta</button>
  </div></div>`;
}

function SinAcceso({ email }) {
  return html`<div class="login"><div class="login-card center">
    <img src="assets/logo.png" alt="" width="72" height="72" class="round" />
    <h2>No tienes acceso</h2>
    <p class="muted">El usuario <b>${nombreUsuario(email)}</b> no está habilitado. Habla con el administrador.</p>
    <button class="btn block" onClick=${() => salir()}><${Icon} n="logout" size=${16} />Salir</button>
  </div></div>`;
}

/* ---------- Mi cuenta: contraseña y huella ---------- */
/* ---------- Menú de la cuenta: opciones en un menú, cada una en su propia vista ---------- */
function MiCuenta({ perfil, onClose }) {
  const [vista, setVista] = useState('menu');
  const [c1, setC1] = useState('');
  const [c2, setC2] = useState('');
  const [bio, setBio] = useState(!!bioConfig(perfil.email));
  const [puedeBio, setPuedeBio] = useState(false);
  useEffect(() => { bioDisponible().then(setPuedeBio); }, []);
  const nombre = perfil.nombre || nombreUsuario(perfil.email);
  const cambiar = async () => {
    const err = claveInvalida(c1); if (err) throw new Error(err);
    if (c1 !== c2) throw new Error('Las dos contraseñas no coinciden.');
    const { error } = await sb.auth.updateUser({ password: c1 });
    if (error) throw new Error(/different|same/i.test(error.message) ? 'Usa una contraseña diferente a la anterior.' : error.message);
    setC1(''); setC2(''); toast('Tu contraseña quedó actualizada'); setVista('menu');
  };
  const activar = async () => { await bioActivar(perfil.email, perfil.nombre); setBio(true); toast('Listo: la próxima vez entrarás con tu huella'); };
  const item = (icon, t, sub, on, cls = '') => html`<button class=${'menu-item ' + cls} onClick=${on}><span class="mi-ico"><${Icon} n=${icon} size=${18} /></span><span class="mi-txt"><b>${t}</b>${sub && html`<small>${sub}</small>`}</span>${cls !== 'peligro' && html`<${Icon} n="chevron" size=${16} />`}</button>`;
  const atras = html`<button class="btn ghost sm back-link" onClick=${() => setVista('menu')}><${Icon} n="down2" size=${14} />Volver</button>`;
  return html`<${Modal} title=${vista === 'menu' ? 'Mi cuenta' : vista === 'clave' ? 'Cambiar contraseña' : 'Huella o rostro'} onClose=${onClose}>
    ${vista === 'menu' && html`
      <div class="me-card"><div class="avatar">${nombre.slice(0, 1).toUpperCase()}</div>
        <div><b>${nombre}</b><span class="muted">@${perfil.usuario || nombreUsuario(perfil.email)} · ${ROLES[perfil.rol]}</span>
        ${perfil.correo && html`<span class="muted small">Recuperación: ${perfil.correo}</span>`}</div></div>
      <div class="menu-list">
        ${item('lock', 'Cambiar contraseña', 'Mínimo 6 caracteres con mayúscula, número y símbolo', () => setVista('clave'))}
        ${item('finger', 'Huella o rostro', !puedeBio ? 'No disponible en este dispositivo' : bio ? 'Activada en este dispositivo' : 'Entra sin escribir la contraseña', () => setVista('bio'))}
        ${bio && item('shield', 'Bloquear app', 'La próxima entrada será con tu huella', () => { onClose(); bloquear(); })}
      </div>
      <div class="menu-list">${item('logout', 'Cerrar sesión', bio ? 'Pedirá contraseña para volver a entrar' : '', () => salir(), 'peligro')}</div>`}
    ${vista === 'clave' && html`${atras}
      <${Field} label="Contraseña nueva"><${ClaveInput} value=${c1} onInput=${setC1} autocomplete="new-password" reglas=${!!c1} /><//>
      <${Field} label="Repítela"><${ClaveInput} value=${c2} onInput=${setC2} autocomplete="new-password" /><//>
      <${AsyncButton} className="btn primary block" icon="check" disabled=${!c1} onClick=${cambiar}>Guardar contraseña<//>`}
    ${vista === 'bio' && html`${atras}
      ${!puedeBio ? html`<p class="muted">Este dispositivo no permite entrar con huella o rostro.</p>` : bio ?
        html`<div class="info"><${Icon} n="finger" size=${16} />Activado: en este dispositivo entras solo con tu huella, sin escribir la contraseña.</div>
          <button class="btn ghost block" onClick=${() => { bioDesactivar(); setBio(false); toast('Huella desactivada'); }}>Desactivar en este dispositivo</button>` :
        html`<p class="muted">Entra con tu huella o tu rostro en lugar de escribir la contraseña. Solo aplica a este dispositivo.</p>
          <${AsyncButton} className="btn primary block" icon="finger" onClick=${activar}>Activar en este dispositivo<//>`}`}
  <//>`;
}

/* ---------- Estructura principal ---------- */
function Shell({ session, perfil }) {
  useEffect(() => { if (perfil.rol === 'repartidor') iniciarRastreo(perfil.email); }, []);
  const rutas = TODAS.filter((r) => r.roles.includes(perfil.rol));
  const movil = MOVIL[perfil.rol] || [];
  const [ruta, setRuta] = useState(rutaActual(rutas));
  const [mas, setMas] = useState(false);
  const [cuenta, setCuenta] = useState(false);
  const [instalar, setInstalar] = useState(null);
  const [tick, setTick] = useState(0);
  const [oferta, setOferta] = useState(false);
  useEffect(() => { if (!bioConfig(perfil.email) && !localStorage.getItem('naza_bio_ofrecido')) bioDisponible().then(setOferta); }, []);
  const cerrarOferta = () => { localStorage.setItem('naza_bio_ofrecido', '1'); setOferta(false); };

  useEffect(() => {
    const f = () => { setRuta(rutaActual(rutas)); setMas(false); window.scrollTo({ top: 0 }); };
    window.addEventListener('hashchange', f);
    const bip = (e) => { e.preventDefault(); setInstalar(e); };
    window.addEventListener('beforeinstallprompt', bip);
    return () => { window.removeEventListener('hashchange', f); window.removeEventListener('beforeinstallprompt', bip); };
  }, []);

  const R = rutas.find((r) => r.id === ruta) || rutas[0];
  const Page = R.C;
  const nombre = perfil.nombre || nombreUsuario(session.user.email);
  const extras = rutas.filter((r) => !movil.includes(r.id));

  return html`<div class=${'shell rol-' + perfil.rol}>
    <aside class="sidebar">
      <a class="brand" href=${'#/' + rutas[0].id}><img src="assets/logo.png" alt="" /><div><b>Huevos de la Naza</b><small>${ROLES[perfil.rol]}</small></div></a>
      <nav class="side-nav">${rutas.map((r) => html`<a key=${r.id} href=${'#/' + r.id} class=${'side-link' + (r.id === R.id ? ' on' : '')} aria-current=${r.id === R.id ? 'page' : null}>
        <${Icon} n=${r.icon} size=${19} /><span>${r.label}</span></a>`)}</nav>
      <div class="side-foot">
        ${instalar && html`<button class="side-link" onClick=${() => { instalar.prompt(); setInstalar(null); }}><${Icon} n="download" size=${19} /><span>Instalar app</span></button>`}
        <button class="me" onClick=${() => setCuenta(true)}><div class="avatar">${nombre.slice(0, 1).toUpperCase()}</div>
          <div class="me-txt"><b>${nombre}</b><small>Mi cuenta</small></div><${Icon} n="settings" size=${16} /></button>
      </div>
    </aside>

    <main class="main">
      <header class="topbar">
        <div class="topbar-brand"><img src="assets/logo.png" alt="" /><b>${R.label}</b></div>
        <h1 class="page-title">${R.label}</h1>
        <div class="topbar-actions">
          <button class="icon-btn" title="Actualizar" aria-label="Actualizar datos" onClick=${() => { setTick((t) => t + 1); toast('Datos actualizados'); }}><${Icon} n="refresh" /></button>
          <button class="avatar-btn only-mobile" title="Mi cuenta" aria-label="Mi cuenta" onClick=${() => setCuenta(true)}><span class="avatar sm">${nombre.slice(0, 1).toUpperCase()}</span></button>
        </div>
      </header>
      ${oferta && html`<div class="oferta-bio"><${Icon} n="finger" size=${22} /><div><b>Entra más rápido</b><span>Activa tu huella y no tendrás que escribir la contraseña.</span></div>
        <${AsyncButton} className="btn sm primary" onClick=${async () => { await bioActivar(perfil.email, perfil.nombre); cerrarOferta(); toast('Listo: la próxima vez entras con tu huella'); }}>Activar<//>
        <button class="icon-btn" aria-label="Ahora no" onClick=${cerrarOferta}><${Icon} n="x" size=${16} /></button></div>`}
      <div class="page" key=${R.id + tick}>
        <${Page} perfil=${perfil} session=${session} />
      </div>
    </main>

    ${rutas.length > 1 && html`<nav class="bottom-nav" style=${{ gridTemplateColumns: `repeat(${movil.length + (extras.length ? 1 : 0)}, 1fr)` }}>
      ${rutas.filter((r) => movil.includes(r.id)).map((r) => html`<a key=${r.id} href=${'#/' + r.id} class=${'bn' + (r.id === R.id ? ' on' : '')}><${Icon} n=${r.icon} size=${21} /><span>${r.label}</span></a>`)}
      ${extras.length > 0 && html`<button class=${'bn' + (!movil.includes(R.id) ? ' on' : '')} onClick=${() => setMas(true)}><${Icon} n="grid" size=${21} /><span>Más</span></button>`}
    </nav>`}

    ${mas && html`<${MenuMas} extras=${extras} actual=${R.id} instalar=${instalar} onInstalar=${() => { instalar.prompt(); setInstalar(null); }} onClose=${() => setMas(false)} />`}
    ${cuenta && html`<${MiCuenta} perfil=${perfil} onClose=${() => setCuenta(false)} />`}
    <${Toaster} />
  </div>`;
}

/* ---------- Menú "Más" (celular): agrupado, con descripción y se cierra deslizando hacia abajo ---------- */
const GRUPOS_MAS = [
  { t: 'Análisis', ids: ['reportes', 'consejos', 'estadisticas'] },
  { t: 'Negocio', ids: ['productos', 'clientes', 'compras', 'planeacion'] },
  { t: 'Ajustes', ids: ['negocio'] },
];
const DESC_MAS = { reportes: 'Informes y descargas', consejos: 'Ideas para mejorar con IA', estadisticas: 'Ventas, clientes y barrios', productos: 'Precios e inventario',
  clientes: 'Quién compra y qué', compras: 'Canastas, gasolina, alimento y otros gastos', planeacion: 'Qué alistar la próxima semana', negocio: 'Zonas, equipo y configuración',
  repartidores: 'Equipo de reparto', pedidos: 'Todos los pedidos', entregas: 'Rutas y reparto', inicio: 'Resumen del día' };
function MenuMas({ extras, actual, instalar, onInstalar, onClose }) {
  const arr = useArrastre(onClose);
  useEffect(() => { document.body.classList.add('no-scroll'); return () => document.body.classList.remove('no-scroll'); }, []);
  const usados = new Set();
  const grupos = GRUPOS_MAS.map((g) => ({ t: g.t, items: extras.filter((r) => g.ids.includes(r.id) && usados.add(r.id)) })).filter((g) => g.items.length);
  const otros = extras.filter((r) => !usados.has(r.id));
  if (otros.length) grupos.push({ t: 'Otros', items: otros });
  return html`<div class="overlay" onClick=${(e) => e.target === e.currentTarget && onClose()}>
    <div class="sheet-menu" ref=${arr.ref} onTouchStart=${arr.onTouchStart} onTouchMove=${arr.onTouchMove} onTouchEnd=${arr.onTouchEnd} role="dialog" aria-label="Más secciones">
      <div class="sheet-grab"></div>
      <div class="sheet-scroll">
        ${grupos.map((g) => html`<div key=${g.t} class="sheet-grupo"><span class="sheet-tit">${g.t}</span>
          <div class="sheet-lista">${g.items.map((r) => html`<a key=${r.id} href=${'#/' + r.id} class=${'sheet-fila' + (r.id === actual ? ' on' : '')} onClick=${onClose}>
            <span class="sheet-ico"><${Icon} n=${r.icon} size=${20} /></span><span class="sheet-txt"><b>${r.label}</b><small>${DESC_MAS[r.id] || ''}</small></span><${Icon} n="chevron" size=${16} /></a>`)}</div></div>`)}
        ${instalar && html`<button class="btn ghost block" onClick=${onInstalar}><${Icon} n="download" size=${16} />Instalar app en este teléfono</button>`}
        <p class="sheet-tip">Desliza hacia abajo para cerrar</p>
      </div>
    </div>
  </div>`;
}

const ES_RECUPERACION = /type=recovery/.test(location.hash);

function App() {
  const [estado, setEstado] = useState({ cargando: true, session: null, perfil: null });
  const [abierto, setAbierto] = useState(desbloqueado());
  const [recuperando, setRecuperando] = useState(ES_RECUPERACION);

  useEffect(() => {
    const evaluar = async (session) => {
      if (!session) return setEstado({ cargando: false, session: null, perfil: null });
      try {
        const perfil = await q(sb.from('administradores').select('email,nombre,rol,usuario,correo,activo,telefono,capacidad_canastas').eq('email', session.user.email.toLowerCase()).maybeSingle());
        setEstado({ cargando: false, session, perfil: perfil && perfil.activo ? perfil : null });
      } catch (e) {
        setEstado({ cargando: false, session, perfil: null });
      }
    };
    sb.auth.getSession().then(({ data }) => {
      if (/access_token|error_description/.test(location.hash)) { history.replaceState(null, '', location.pathname + '#/'); sessionStorage.setItem('naza_desbloqueado', '1'); setAbierto(true); }
      evaluar(data.session);
    });
    const { data: sub } = sb.auth.onAuthStateChange((ev, session) => {
      if (ev === 'PASSWORD_RECOVERY') { setRecuperando(true); evaluar(session); }
      if (ev === 'SIGNED_IN') { if (desbloqueado()) setAbierto(true); evaluar(session); }
      if (ev === 'SIGNED_OUT') evaluar(null);
    });
    // Bloqueo manual y automático (más de 5 minutos en segundo plano) cuando la huella está activa.
    const lock = () => setAbierto(false);
    let oculto = 0;
    const vis = () => {
      if (document.hidden) oculto = Date.now();
      else if (oculto && Date.now() - oculto > 5 * 60000 && localStorage.getItem('naza_bio')) bloquear();
    };
    window.addEventListener('naza-bloquear', lock);
    document.addEventListener('visibilitychange', vis);
    return () => { sub.subscription.unsubscribe(); window.removeEventListener('naza-bloquear', lock); document.removeEventListener('visibilitychange', vis); };
  }, []);

  if (estado.cargando) return html`<div class="boot"><img src="assets/logo.png" alt="" width="88" height="88" /><span>Cargando…</span></div>`;
  if (!estado.session) return html`<${Login} /><${Toaster} />`;
  if (recuperando) return html`<${NuevaClave} onListo=${() => { setRecuperando(false); setAbierto(true); }} /><${Toaster} />`;
  if (!estado.perfil) return html`<${SinAcceso} email=${estado.session.user.email} />`;
  const conf = bioConfig(estado.perfil.email);
  if (conf && !abierto) return html`<${Bloqueo} perfil=${estado.perfil} conf=${conf} onOk=${() => setAbierto(true)} /><${Toaster} />`;
  return html`<${Shell} session=${estado.session} perfil=${estado.perfil} />`;
}

const raiz = document.getElementById('app');
raiz.innerHTML = '';
render(html`<${App} />`, raiz);

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  // Cuando se publica una versión nueva, la app se recarga sola para usarla.
  const habia = !!navigator.serviceWorker.controller;
  let recargando = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (habia && !recargando) { recargando = true; location.reload(); } });
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').then((reg) => {
    const revisar = () => reg.update().catch(() => {});
    document.addEventListener('visibilitychange', () => { if (!document.hidden) revisar(); });
    setInterval(revisar, 10 * 60000);
  }).catch(() => {}));
}
