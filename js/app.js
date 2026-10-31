import { render } from 'https://esm.sh/htm@3.1.1/preact/standalone';
import { html, useState, useEffect, Icon, Toaster, toast, AsyncButton, Field } from './ui.js';
import { sb, q, CONFIG } from './lib.js';
import { Inicio } from './pages/inicio.js';
import { Pedidos } from './pages/pedidos.js';
import { Clientes } from './pages/clientes.js';
import { Productos } from './pages/productos.js';
import { Compras } from './pages/compras.js';
import { Estadisticas } from './pages/estadisticas.js';
import { Planeacion } from './pages/planeacion.js';
import { Negocio } from './pages/negocio.js';

const RUTAS = [
  { id: 'inicio', label: 'Inicio', icon: 'home', C: Inicio, movil: true },
  { id: 'pedidos', label: 'Pedidos', icon: 'pedidos', C: Pedidos, movil: true },
  { id: 'productos', label: 'Productos', icon: 'box', C: Productos, movil: true },
  { id: 'clientes', label: 'Clientes', icon: 'users', C: Clientes, movil: true },
  { id: 'compras', label: 'Compras', icon: 'cart', C: Compras },
  { id: 'estadisticas', label: 'Estadísticas', icon: 'chart', C: Estadisticas },
  { id: 'planeacion', label: 'Planeación', icon: 'calendar', C: Planeacion },
  { id: 'negocio', label: 'Negocio', icon: 'store', C: Negocio }
];

function rutaActual() {
  const h = location.hash.replace(/^#\/?/, '').split(/[?&]/)[0];
  return RUTAS.find((r) => r.id === h) ? h : 'inicio';
}

/* ---------- Inicio de sesión ---------- */
function Login() {
  const [email, setEmail] = useState(localStorage.getItem('naza_email') || '');
  const [enviado, setEnviado] = useState(false);
  const [codigo, setCodigo] = useState('');

  const enviar = async () => {
    const e = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new Error('Escribe un correo válido.');
    localStorage.setItem('naza_email', e);
    const { error } = await sb.auth.signInWithOtp({
      email: e, options: { emailRedirectTo: location.origin + location.pathname, shouldCreateUser: true }
    });
    if (error) throw new Error(/rate|seconds/i.test(error.message) ? 'Espera un momento antes de pedir otro enlace.' : error.message);
    setEnviado(true);
  };
  const verificar = async () => {
    const { error } = await sb.auth.verifyOtp({ email: email.trim().toLowerCase(), token: codigo.trim(), type: 'email' });
    if (error) throw new Error('Código inválido o vencido.');
  };

  return html`<div class="login">
    <div class="login-art">
      <div class="login-blob"></div>
      <img src="assets/logo.png" alt="Huevos de la Naza" class="login-logo" />
      <h1>${CONFIG.negocio}</h1>
      <p>Pedidos, clientes, inventario y números del negocio en un solo lugar.</p>
    </div>
    <div class="login-card">
      ${!enviado ? html`
        <h2>Entrar al panel</h2>
        <p class="muted">Te enviamos un enlace de acceso a tu correo. Sin contraseñas.</p>
        <${Field} label="Correo">
          <input class="input" type="email" autocomplete="email" placeholder="tucorreo@gmail.com" value=${email}
            onInput=${(e) => setEmail(e.target.value)} onKeyDown=${(e) => e.key === 'Enter' && document.querySelector('#btn-enviar-wrap button').click()} />
        <//>
        <div id="btn-enviar-wrap"><${AsyncButton} className="btn primary block" icon="mail" onClick=${enviar}>Enviarme el enlace<//></div>
      ` : html`
        <div class="sent-ico"><${Icon} n="mail" size=${28} /></div>
        <h2>Revisa tu correo</h2>
        <p class="muted">Enviamos un enlace a <b>${email}</b>. Ábrelo en este mismo dispositivo para entrar.</p>
        <${Field} label="¿Te llegó un código de 6 dígitos?" hint="Útil si instalaste la app en el celular.">
          <input class="input code" inputmode="numeric" maxlength="8" placeholder="123456" value=${codigo} onInput=${(e) => setCodigo(e.target.value)} />
        <//>
        <${AsyncButton} className="btn primary block" icon="check" disabled=${codigo.trim().length < 6} onClick=${verificar}>Entrar con el código<//>
        <button class="btn ghost block" onClick=${() => setEnviado(false)}>Usar otro correo</button>
      `}
      <p class="login-foot"><${Icon} n="shield" size=${14} /> Solo entran los correos autorizados por el negocio.</p>
    </div>
  </div>`;
}

function SinAcceso({ email }) {
  return html`<div class="login"><div class="login-card center">
    <img src="assets/logo.png" alt="" width="72" height="72" class="round" />
    <h2>Correo sin acceso</h2>
    <p class="muted"><b>${email}</b> todavía no está autorizado para usar el panel. Pídele al dueño que lo agregue.</p>
    <button class="btn block" onClick=${() => sb.auth.signOut()}><${Icon} n="logout" size=${16} />Salir</button>
  </div></div>`;
}

/* ---------- Estructura principal ---------- */
function Shell({ session, perfil }) {
  const [ruta, setRuta] = useState(rutaActual());
  const [mas, setMas] = useState(false);
  const [instalar, setInstalar] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const f = () => { setRuta(rutaActual()); setMas(false); window.scrollTo({ top: 0 }); };
    window.addEventListener('hashchange', f);
    const bip = (e) => { e.preventDefault(); setInstalar(e); };
    window.addEventListener('beforeinstallprompt', bip);
    return () => { window.removeEventListener('hashchange', f); window.removeEventListener('beforeinstallprompt', bip); };
  }, []);

  const R = RUTAS.find((r) => r.id === ruta);
  const Page = R.C;
  const nombre = perfil?.nombre || session.user.email;

  const nav = (cls) => RUTAS.map((r) => html`<a key=${r.id} href=${'#/' + r.id} class=${cls + (r.id === ruta ? ' on' : '')} aria-current=${r.id === ruta ? 'page' : null}>
    <${Icon} n=${r.icon} size=${19} /><span>${r.label}</span></a>`);

  return html`<div class="shell">
    <aside class="sidebar">
      <a class="brand" href="#/inicio"><img src="assets/logo.png" alt="" /><div><b>Huevos de la Naza</b><small>Panel de administración</small></div></a>
      <nav class="side-nav">${nav('side-link')}</nav>
      <div class="side-foot">
        ${CONFIG.hojaUrl && html`<a class="side-link" href=${CONFIG.hojaUrl} target="_blank" rel="noopener"><${Icon} n="sheet" size=${19} /><span>Hoja de Google</span></a>`}
        ${instalar && html`<button class="side-link" onClick=${async () => { instalar.prompt(); setInstalar(null); }}><${Icon} n="download" size=${19} /><span>Instalar app</span></button>`}
        <div class="me"><div class="avatar">${nombre.slice(0, 1).toUpperCase()}</div>
          <div class="me-txt"><b>${nombre}</b><small>${perfil?.rol === 'dueno' ? 'Dueño' : 'Operador'}</small></div>
          <button class="icon-btn" title="Salir" aria-label="Salir" onClick=${() => sb.auth.signOut()}><${Icon} n="logout" /></button>
        </div>
      </div>
    </aside>

    <main class="main">
      <header class="topbar">
        <div class="topbar-brand"><img src="assets/logo.png" alt="" /><b>${R.label}</b></div>
        <h1 class="page-title">${R.label}</h1>
        <div class="topbar-actions">
          <button class="icon-btn" title="Actualizar" aria-label="Actualizar datos" onClick=${() => { setTick((t) => t + 1); toast('Datos actualizados'); }}><${Icon} n="refresh" /></button>
        </div>
      </header>
      <div class="page" key=${ruta + tick}>
        <${Page} perfil=${perfil} session=${session} />
      </div>
    </main>

    <nav class="bottom-nav">
      ${RUTAS.filter((r) => r.movil).map((r) => html`<a key=${r.id} href=${'#/' + r.id} class=${'bn' + (r.id === ruta ? ' on' : '')}><${Icon} n=${r.icon} size=${21} /><span>${r.label}</span></a>`)}
      <button class=${'bn' + (!R.movil ? ' on' : '')} onClick=${() => setMas(true)}><${Icon} n="grid" size=${21} /><span>Más</span></button>
    </nav>

    ${mas && html`<div class="overlay" onClick=${(e) => e.target === e.currentTarget && setMas(false)}>
      <div class="sheet-menu">
        <div class="sheet-grab"></div>
        <div class="sheet-grid">${RUTAS.filter((r) => !r.movil).map((r) => html`<a key=${r.id} href=${'#/' + r.id} class="sheet-item"><span class="sheet-ico"><${Icon} n=${r.icon} size=${22} /></span>${r.label}</a>`)}</div>
        ${CONFIG.hojaUrl && html`<a class="btn ghost block" href=${CONFIG.hojaUrl} target="_blank" rel="noopener"><${Icon} n="sheet" size=${16} />Abrir hoja de Google</a>`}
        ${instalar && html`<button class="btn ghost block" onClick=${() => { instalar.prompt(); setInstalar(null); }}><${Icon} n="download" size=${16} />Instalar app</button>`}
        <button class="btn ghost block" onClick=${() => sb.auth.signOut()}><${Icon} n="logout" size=${16} />Salir (${session.user.email})</button>
      </div>
    </div>`}
    <${Toaster} />
  </div>`;
}

function App() {
  const [estado, setEstado] = useState({ cargando: true, session: null, perfil: null, admin: false });

  useEffect(() => {
    const evaluar = async (session) => {
      if (!session) return setEstado({ cargando: false, session: null, perfil: null, admin: false });
      try {
        const admin = await q(sb.rpc('es_admin'));
        let perfil = null;
        if (admin) {
          const r = await q(sb.from('administradores').select('email,nombre,rol').eq('email', session.user.email.toLowerCase()).maybeSingle());
          perfil = r;
        }
        setEstado({ cargando: false, session, perfil, admin: !!admin });
      } catch (e) {
        setEstado({ cargando: false, session, perfil: null, admin: false, error: e.message });
      }
    };
    sb.auth.getSession().then(({ data }) => {
      if (/access_token|error_description/.test(location.hash)) history.replaceState(null, '', location.pathname + '#/inicio');
      evaluar(data.session);
    });
    const { data: sub } = sb.auth.onAuthStateChange((ev, session) => {
      if (ev === 'SIGNED_IN' || ev === 'SIGNED_OUT') evaluar(session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (estado.cargando) return html`<div class="boot"><img src="assets/logo.png" alt="" width="88" height="88" /><span>Cargando panel…</span></div>`;
  if (!estado.session) return html`<${Login} /><${Toaster} />`;
  if (!estado.admin) return html`<${SinAcceso} email=${estado.session.user.email} />`;
  return html`<${Shell} session=${estado.session} perfil=${estado.perfil} />`;
}

const raiz = document.getElementById('app');
raiz.innerHTML = '';
render(html`<${App} />`, raiz);

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
