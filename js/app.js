import { render } from 'https://esm.sh/htm@3.1.1/preact/standalone';
import { html, useState, useEffect, Icon, Toaster, toast, AsyncButton, Field, Modal } from './ui.js';
import { sb, q, CONFIG, ROLES, usuarioAEmail, nombreUsuario } from './lib.js';
import { bioDisponible, bioConfig, bioActivar, bioVerificar, bioDesactivar, desbloqueado } from './bio.js';
import { Inicio } from './pages/inicio.js';
import { Pedidos } from './pages/pedidos.js';
import { Clientes } from './pages/clientes.js';
import { Productos } from './pages/productos.js';
import { Compras } from './pages/compras.js';
import { Estadisticas } from './pages/estadisticas.js';
import { Planeacion } from './pages/planeacion.js';
import { Negocio } from './pages/negocio.js';
import { Entregas, MiRuta } from './pages/entregas.js';

const TODAS = [
  { id: 'inicio', label: 'Inicio', icon: 'home', C: Inicio, roles: ['dueno'] },
  { id: 'pedidos', label: 'Pedidos', icon: 'pedidos', C: Pedidos, roles: ['dueno', 'operador'] },
  { id: 'entregas', label: 'Entregas', icon: 'truck', C: Entregas, roles: ['dueno', 'operador'] },
  { id: 'ruta', label: 'Mi ruta', icon: 'pin', C: MiRuta, roles: ['repartidor'] },
  { id: 'productos', label: 'Productos', icon: 'box', C: Productos, roles: ['dueno'] },
  { id: 'clientes', label: 'Clientes', icon: 'users', C: Clientes, roles: ['dueno'] },
  { id: 'compras', label: 'Compras', icon: 'cart', C: Compras, roles: ['dueno'] },
  { id: 'estadisticas', label: 'Estadísticas', icon: 'chart', C: Estadisticas, roles: ['dueno'] },
  { id: 'planeacion', label: 'Planeación', icon: 'calendar', C: Planeacion, roles: ['dueno'] },
  { id: 'negocio', label: 'Negocio', icon: 'store', C: Negocio, roles: ['dueno'] }
];
const MOVIL = { dueno: ['inicio', 'pedidos', 'entregas', 'productos'], operador: ['pedidos', 'entregas'], repartidor: ['ruta'] };

function rutaActual(rutas) {
  const h = location.hash.replace(/^#\/?/, '').split(/[?&]/)[0];
  return rutas.find((r) => r.id === h) ? h : rutas[0].id;
}

/* ---------- Inicio de sesión ---------- */
function Login() {
  const [modo, setModo] = useState('clave');
  const [usuario, setUsuario] = useState(localStorage.getItem('naza_usuario') || '');
  const [clave, setClave] = useState('');
  const [ver, setVer] = useState(false);
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);

  const entrar = async () => {
    if (!usuario.trim() || !clave) throw new Error('Escribe tu usuario y contraseña.');
    const { error } = await sb.auth.signInWithPassword({ email: usuarioAEmail(usuario), password: clave });
    if (error) throw new Error(/invalid|credentials/i.test(error.message) ? 'Usuario o contraseña incorrectos.' : /banned/i.test(error.message) ? 'Este usuario está desactivado.' : error.message);
    localStorage.setItem('naza_usuario', usuario.trim().toLowerCase());
    sessionStorage.setItem('naza_desbloqueado', '1');
  };
  const enviarEnlace = async () => {
    const e = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new Error('Escribe un correo válido.');
    const { error } = await sb.auth.signInWithOtp({ email: e, options: { emailRedirectTo: location.origin + location.pathname, shouldCreateUser: true } });
    if (error) throw new Error(/rate|seconds/i.test(error.message) ? 'Espera un momento antes de pedir otro enlace.' : /not found|signups/i.test(error.message) ? 'Ese correo no tiene acceso.' : error.message);
    setEnviado(true);
  };
  const enter = (e) => { if (e.key === 'Enter') document.querySelector('#btn-login button')?.click(); };

  return html`<div class="login">
    <div class="login-art">
      <div class="login-blob"></div>
      <img src="assets/logo.png" alt="Huevos de la Naza" class="login-logo" />
      <h1>${CONFIG.negocio}</h1>
      <p>Pedidos, entregas, clientes e inventario en un solo lugar.</p>
    </div>
    <div class="login-card">
      ${modo === 'clave' ? html`
        <h2>Entrar</h2>
        <${Field} label="Usuario" hint="El dueño también puede escribir su correo.">
          <input class="input" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="tu usuario" value=${usuario}
            onInput=${(e) => setUsuario(e.target.value)} onKeyDown=${enter} />
        <//>
        <${Field} label="Contraseña">
          <div class="pass"><input class="input" type=${ver ? 'text' : 'password'} autocomplete="current-password" value=${clave}
            onInput=${(e) => setClave(e.target.value)} onKeyDown=${enter} />
            <button type="button" class="icon-btn" aria-label=${ver ? 'Ocultar' : 'Mostrar'} onClick=${() => setVer(!ver)}><${Icon} n=${ver ? 'x' : 'search'} size=${16} /></button></div>
        <//>
        <div id="btn-login"><${AsyncButton} className="btn primary block" icon="check" onClick=${entrar}>Entrar<//></div>
        <button class="link center-link" onClick=${() => setModo('enlace')}>¿Eres el dueño y no tienes contraseña? Entra con tu correo</button>
      ` : !enviado ? html`
        <h2>Entrar con tu correo</h2>
        <p class="muted">Te enviamos un enlace de acceso. Luego crea tu contraseña en "Mi cuenta".</p>
        <${Field} label="Correo"><input class="input" type="email" autocomplete="email" value=${email} onInput=${(e) => setEmail(e.target.value)} /><//>
        <${AsyncButton} className="btn primary block" icon="mail" onClick=${enviarEnlace}>Enviarme el enlace<//>
        <button class="btn ghost block" onClick=${() => setModo('clave')}>Volver</button>
      ` : html`
        <div class="sent-ico"><${Icon} n="mail" size=${28} /></div>
        <h2>Revisa tu correo</h2>
        <p class="muted">Abre el enlace que enviamos a <b>${email}</b> en este mismo dispositivo.</p>
        <button class="btn ghost block" onClick=${() => { setEnviado(false); setModo('clave'); }}>Volver</button>
      `}
      <p class="login-foot"><${Icon} n="shield" size=${14} /> Solo entran las personas que el dueño autoriza.</p>
    </div>
  </div>`;
}

function Bloqueo({ perfil, conf, onOk }) {
  const intentar = async () => { await bioVerificar(conf); onOk(); };
  useEffect(() => { intentar().catch(() => {}); }, []);
  return html`<div class="login"><div class="login-card center">
    <img src="assets/logo.png" alt="" width="76" height="76" class="round" />
    <h2>Hola, ${(perfil.nombre || '').split(' ')[0] || nombreUsuario(perfil.email)}</h2>
    <p class="muted">Usa tu huella o rostro para abrir la app.</p>
    <${AsyncButton} className="btn primary block" icon="shield" onClick=${intentar}>Desbloquear<//>
    <button class="btn ghost block" onClick=${() => { bioDesactivar(); sb.auth.signOut(); }}>Entrar con contraseña</button>
  </div></div>`;
}

function SinAcceso({ email }) {
  return html`<div class="login"><div class="login-card center">
    <img src="assets/logo.png" alt="" width="72" height="72" class="round" />
    <h2>Sin acceso</h2>
    <p class="muted"><b>${nombreUsuario(email)}</b> no está autorizado o fue desactivado. Habla con el dueño.</p>
    <button class="btn block" onClick=${() => sb.auth.signOut()}><${Icon} n="logout" size=${16} />Salir</button>
  </div></div>`;
}

/* ---------- Mi cuenta: contraseña y huella ---------- */
function MiCuenta({ perfil, onClose }) {
  const [c1, setC1] = useState('');
  const [c2, setC2] = useState('');
  const [bio, setBio] = useState(!!bioConfig(perfil.email));
  const [puedeBio, setPuedeBio] = useState(false);
  useEffect(() => { bioDisponible().then(setPuedeBio); }, []);
  const cambiar = async () => {
    if (c1.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');
    if (c1 !== c2) throw new Error('Las contraseñas no coinciden.');
    const { error } = await sb.auth.updateUser({ password: c1 });
    if (error) throw new Error(/different|same/i.test(error.message) ? 'Usa una contraseña distinta a la anterior.' : error.message);
    setC1(''); setC2(''); toast('Contraseña actualizada');
  };
  const activar = async () => { await bioActivar(perfil.email, perfil.nombre); setBio(true); toast('Huella activada en este dispositivo'); };
  return html`<${Modal} title="Mi cuenta" onClose=${onClose}>
    <div class="me-card"><div class="avatar">${(perfil.nombre || perfil.email).slice(0, 1).toUpperCase()}</div>
      <div><b>${perfil.nombre || nombreUsuario(perfil.email)}</b><span class="muted">Usuario: ${perfil.usuario || nombreUsuario(perfil.email)} · ${ROLES[perfil.rol]}</span></div></div>
    <div class="section-title">Huella o rostro</div>
    ${!puedeBio ? html`<p class="muted">Este dispositivo o navegador no permite desbloqueo biométrico.</p>` : bio ?
      html`<div class="info"><${Icon} n="shield" size=${16} />Activo en este dispositivo: la app pide tu huella al abrirse.</div>
        <button class="btn ghost" onClick=${() => { bioDesactivar(); setBio(false); toast('Huella desactivada'); }}>Desactivar huella</button>` :
      html`<p class="muted">Al abrir la app te pedirá tu huella o rostro en lugar de la contraseña.</p>
        <${AsyncButton} className="btn" icon="shield" onClick=${activar}>Activar huella en este dispositivo<//>`}
    <div class="section-title">Cambiar contraseña</div>
    <div class="form-grid">
      <${Field} label="Nueva contraseña"><input class="input" type="password" autocomplete="new-password" value=${c1} onInput=${(e) => setC1(e.target.value)} /><//>
      <${Field} label="Repite la contraseña"><input class="input" type="password" autocomplete="new-password" value=${c2} onInput=${(e) => setC2(e.target.value)} /><//>
    </div>
    <${AsyncButton} className="btn primary" icon="check" disabled=${!c1} onClick=${cambiar}>Guardar contraseña<//>
    <hr class="sep" />
    <button class="btn danger-ghost block" onClick=${() => { sessionStorage.removeItem('naza_desbloqueado'); sb.auth.signOut(); }}><${Icon} n="logout" size=${16} />Cerrar sesión</button>
  <//>`;
}

/* ---------- Estructura principal ---------- */
function Shell({ session, perfil }) {
  const rutas = TODAS.filter((r) => r.roles.includes(perfil.rol));
  const movil = MOVIL[perfil.rol] || [];
  const [ruta, setRuta] = useState(rutaActual(rutas));
  const [mas, setMas] = useState(false);
  const [cuenta, setCuenta] = useState(false);
  const [instalar, setInstalar] = useState(null);
  const [tick, setTick] = useState(0);

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
        ${perfil.rol === 'dueno' && CONFIG.hojaUrl && html`<a class="side-link" href=${CONFIG.hojaUrl} target="_blank" rel="noopener"><${Icon} n="sheet" size=${19} /><span>Hoja de Google</span></a>`}
        ${instalar && html`<button class="side-link" onClick=${() => { instalar.prompt(); setInstalar(null); }}><${Icon} n="download" size=${19} /><span>Instalar app</span></button>`}
        <button class="me" onClick=${() => setCuenta(true)}><div class="avatar">${nombre.slice(0, 1).toUpperCase()}</div>
          <div class="me-txt"><b>${nombre}</b><small>Mi cuenta</small></div><${Icon} n="edit" size=${16} /></button>
      </div>
    </aside>

    <main class="main">
      <header class="topbar">
        <div class="topbar-brand"><img src="assets/logo.png" alt="" /><b>${R.label}</b></div>
        <h1 class="page-title">${R.label}</h1>
        <div class="topbar-actions">
          <button class="icon-btn" title="Actualizar" aria-label="Actualizar datos" onClick=${() => { setTick((t) => t + 1); toast('Datos actualizados'); }}><${Icon} n="refresh" /></button>
          <button class="icon-btn only-mobile" title="Mi cuenta" aria-label="Mi cuenta" onClick=${() => setCuenta(true)}><${Icon} n="users" /></button>
        </div>
      </header>
      <div class="page" key=${R.id + tick}>
        <${Page} perfil=${perfil} session=${session} />
      </div>
    </main>

    ${rutas.length > 1 && html`<nav class="bottom-nav" style=${{ gridTemplateColumns: `repeat(${movil.length + (extras.length ? 1 : 0)}, 1fr)` }}>
      ${rutas.filter((r) => movil.includes(r.id)).map((r) => html`<a key=${r.id} href=${'#/' + r.id} class=${'bn' + (r.id === R.id ? ' on' : '')}><${Icon} n=${r.icon} size=${21} /><span>${r.label}</span></a>`)}
      ${extras.length > 0 && html`<button class=${'bn' + (!movil.includes(R.id) ? ' on' : '')} onClick=${() => setMas(true)}><${Icon} n="grid" size=${21} /><span>Más</span></button>`}
    </nav>`}

    ${mas && html`<div class="overlay" onClick=${(e) => e.target === e.currentTarget && setMas(false)}>
      <div class="sheet-menu">
        <div class="sheet-grab"></div>
        <div class="sheet-grid">${extras.map((r) => html`<a key=${r.id} href=${'#/' + r.id} class="sheet-item"><span class="sheet-ico"><${Icon} n=${r.icon} size=${22} /></span>${r.label}</a>`)}</div>
        ${perfil.rol === 'dueno' && CONFIG.hojaUrl && html`<a class="btn ghost block" href=${CONFIG.hojaUrl} target="_blank" rel="noopener"><${Icon} n="sheet" size=${16} />Abrir hoja de Google</a>`}
        ${instalar && html`<button class="btn ghost block" onClick=${() => { instalar.prompt(); setInstalar(null); }}><${Icon} n="download" size=${16} />Instalar app</button>`}
      </div>
    </div>`}
    ${cuenta && html`<${MiCuenta} perfil=${perfil} onClose=${() => setCuenta(false)} />`}
    <${Toaster} />
  </div>`;
}

function App() {
  const [estado, setEstado] = useState({ cargando: true, session: null, perfil: null });
  const [abierto, setAbierto] = useState(desbloqueado());

  useEffect(() => {
    const evaluar = async (session) => {
      if (!session) return setEstado({ cargando: false, session: null, perfil: null });
      try {
        const perfil = await q(sb.from('administradores').select('email,nombre,rol,usuario,activo,telefono,capacidad_canastas').eq('email', session.user.email.toLowerCase()).maybeSingle());
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
      if (ev === 'SIGNED_IN') { if (desbloqueado()) setAbierto(true); evaluar(session); }
      if (ev === 'SIGNED_OUT') evaluar(null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (estado.cargando) return html`<div class="boot"><img src="assets/logo.png" alt="" width="88" height="88" /><span>Cargando…</span></div>`;
  if (!estado.session) return html`<${Login} /><${Toaster} />`;
  if (!estado.perfil) return html`<${SinAcceso} email=${estado.session.user.email} />`;
  const conf = bioConfig(estado.perfil.email);
  if (conf && !abierto) return html`<${Bloqueo} perfil=${estado.perfil} conf=${conf} onOk=${() => setAbierto(true)} /><${Toaster} />`;
  return html`<${Shell} session=${estado.session} perfil=${estado.perfil} />`;
}

const raiz = document.getElementById('app');
raiz.innerHTML = '';
render(html`<${App} />`, raiz);

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
