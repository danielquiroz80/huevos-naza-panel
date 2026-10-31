import { html, useState, useEffect, useRef } from 'https://esm.sh/htm@3.1.1/preact/standalone';
import { money } from './lib.js';

export { html, useState, useEffect, useRef };
export { useMemo, useCallback } from 'https://esm.sh/htm@3.1.1/preact/standalone';

/* ---------- Iconos (trazos estilo Lucide) ---------- */
const P = {
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  pedidos: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  box: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  cart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
  chart: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
  store: '<path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M1 14h6"/><path d="M9 8h6"/><path d="M17 16h6"/>',
  truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  edit: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  chat: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  up: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
  down: '<path d="m22 17-8.5-8.5-5 5L2 7"/><path d="M16 17h6v-6"/>',
  menu: '<path d="M4 12h16"/><path d="M4 6h16"/><path d="M4 18h16"/>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  egg: '<path d="M12 22c6.23-.05 7.87-5.57 7.5-10-.36-4.34-3.95-9.96-7.5-10-3.55.04-7.14 5.66-7.5 10-.37 4.43 1.27 9.95 7.5 10z"/>',
  spark: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>',
  history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
  external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  grid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
  sheet: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M8 13h2"/><path d="M14 13h2"/><path d="M8 17h2"/><path d="M14 17h2"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
  up2: '<path d="m18 15-6-6-6 6"/>',
  down2: '<path d="m6 9 6 6 6-6"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  nav: '<path d="m3 11 19-9-9 19-2-8-8-2z"/>',
  play: '<path d="M6 3 20 12 6 21 6 3z"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  finger: '<path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"/><path d="M14 13.12c0 2.38 0 6.38-1 8.88"/><path d="M17.29 21.02c.12-.6.43-2.3.5-3.02"/><path d="M2 12a10 10 0 0 1 18-6"/><path d="M2 16h.01"/><path d="M21.8 16c.2-2 .131-5.354 0-6"/><path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2"/><path d="M8.65 22c.21-.66.45-1.32.57-2"/><path d="M9 6.8a6 6 0 0 1 9 5.2v2"/>',
  live: '<circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49"/><path d="M7.76 16.24a6 6 0 0 1 0-8.49"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M4.93 19.07a10 10 0 0 1 0-14.14"/>',
  settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  idcard: '<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8" cy="12" r="2"/><path d="M14 10h4M14 14h4"/>',
  filter: '<path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  more: '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
  route: '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
  columns: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18"/>',
  fit: '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
  repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>'
};

export function Icon({ n, size = 18 }) {
  return html`<svg class="ico" width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
    dangerouslySetInnerHTML=${{ __html: P[n] || '' }}></svg>`;
}

/* ---------- Datos asíncronos ---------- */
export function useAsync(fn, deps = []) {
  const [s, set] = useState({ loading: true, data: null, error: null });
  const [k, setK] = useState(0);
  useEffect(() => {
    let vivo = true;
    set((x) => ({ ...x, loading: true, error: null }));
    fn().then((d) => vivo && set({ loading: false, data: d, error: null }))
      .catch((e) => vivo && set((x) => ({ loading: false, data: x.data, error: e.message || String(e) })));
    return () => { vivo = false; };
  }, [...deps, k]);
  return { ...s, reload: () => setK((x) => x + 1) };
}

/* ---------- Avisos flotantes ---------- */
let pushToast = null;
export const toast = (msg, tipo = 'ok') => pushToast && pushToast(msg, tipo);
export function Toaster() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    pushToast = (m, t) => {
      const id = Math.random().toString(36).slice(2);
      setItems((x) => [...x, { id, m, t }]);
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), t === 'error' ? 6500 : 4200);
    };
    return () => { pushToast = null; };
  }, []);
  return html`<div class="toaster" role="status" aria-live="polite">
    ${items.map((i) => html`<div key=${i.id} class=${'toast ' + i.t}><${Icon} n=${i.t === 'error' ? 'alert' : 'check'} /><span>${i.m}</span></div>`)}
  </div>`;
}

/* ---------- Piezas de interfaz ---------- */
export const Badge = ({ tone = 'gray', children }) => html`<span class=${'badge ' + tone}>${children}</span>`;

export function Card({ title, icon, action, children, className = '', pad = true }) {
  return html`<section class=${'card ' + className}>
    ${(title || action) && html`<header class="card-head">
      <h3>${icon && html`<${Icon} n=${icon} />`}${title}</h3>${action}
    </header>`}
    <div class=${pad ? 'card-body' : ''}>${children}</div>
  </section>`;
}

export function Kpi({ icon, label, value, sub, trend, tone = '' }) {
  return html`<div class=${'kpi ' + tone}>
    <div class="kpi-icon"><${Icon} n=${icon} size=${20} /></div>
    <div class="kpi-body">
      <span class="kpi-label">${label}</span>
      <strong class="kpi-value">${value}</strong>
      ${(sub || trend != null) && html`<span class="kpi-sub">
        ${trend != null && html`<em class=${trend >= 0 ? 'up' : 'down'}><${Icon} n=${trend >= 0 ? 'up' : 'down'} size=${13} />${Math.abs(trend)}%</em>`}
        ${sub}</span>`}
    </div>
  </div>`;
}

export function Loader({ rows = 3 }) {
  return html`<div class="skeleton-wrap">${Array.from({ length: rows }).map((_, i) => html`<div key=${i} class="skeleton" style=${{ width: 100 - i * 12 + '%' }}></div>`)}</div>`;
}

export function Empty({ icon = 'egg', title, children }) {
  return html`<div class="empty"><div class="empty-ico"><${Icon} n=${icon} size=${26} /></div><strong>${title}</strong>${children && html`<p>${children}</p>`}</div>`;
}

export function ErrorBox({ error, onRetry }) {
  if (!error) return null;
  return html`<div class="error-box"><${Icon} n="alert" /><span>${error}</span>${onRetry && html`<button class="btn sm ghost" onClick=${onRetry}>Reintentar</button>`}</div>`;
}

export function Tabs({ value, onChange, items }) {
  return html`<div class="tabs" role="tablist">
    ${items.map((t) => html`<button key=${t.v} role="tab" aria-selected=${value === t.v} class=${'tab' + (value === t.v ? ' on' : '')} onClick=${() => onChange(t.v)}>
      ${t.label}${t.n != null && html`<span class="tab-n">${t.n}</span>`}
    </button>`)}
  </div>`;
}

export function SearchBox({ value, onInput, placeholder = 'Buscar…' }) {
  return html`<label class="search"><${Icon} n="search" size=${16} />
    <input type="search" value=${value} placeholder=${placeholder} onInput=${(e) => onInput(e.target.value)} /></label>`;
}

export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    document.body.classList.add('no-scroll');
    return () => { window.removeEventListener('keydown', k); document.body.classList.remove('no-scroll'); };
  }, []);
  return html`<div class="overlay" onClick=${(e) => e.target === e.currentTarget && onClose()}>
    <div class=${'modal' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label=${title}>
      <div class="modal-head"><h3>${title}</h3><button class="icon-btn" onClick=${onClose} aria-label="Cerrar"><${Icon} n="x" /></button></div>
      <div class="modal-body">${children}</div>
      ${footer && html`<div class="modal-foot">${footer}</div>`}
    </div>
  </div>`;
}

export function Drawer({ title, sub, onClose, children, footer }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    document.body.classList.add('no-scroll');
    return () => { window.removeEventListener('keydown', k); document.body.classList.remove('no-scroll'); };
  }, []);
  return html`<div class="overlay drawer-overlay" onClick=${(e) => e.target === e.currentTarget && onClose()}>
    <aside class="drawer" role="dialog" aria-modal="true" aria-label=${title}>
      <div class="drawer-head"><div><h3>${title}</h3>${sub && html`<span class="muted">${sub}</span>`}</div>
        <button class="icon-btn" onClick=${onClose} aria-label="Cerrar"><${Icon} n="x" /></button></div>
      <div class="drawer-body">${children}</div>
      ${footer && html`<div class="drawer-foot">${footer}</div>`}
    </aside>
  </div>`;
}

/** Botón que muestra "cargando" mientras corre una promesa. */
export function AsyncButton({ onClick, children, className = 'btn', disabled, icon }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (busy) return;
    setBusy(true);
    try { await onClick(); } catch (e) { toast(e.message || String(e), 'error'); }
    finally { setBusy(false); }
  };
  return html`<button class=${className + (busy ? ' busy' : '')} disabled=${disabled || busy} onClick=${run}>
    ${busy ? html`<span class="spin"></span>` : icon && html`<${Icon} n=${icon} size=${16} />`}${children}</button>`;
}

export function Field({ label, hint, children }) {
  return html`<label class="field"><span class="field-label">${label}</span>${children}${hint && html`<small class="hint">${hint}</small>`}</label>`;
}

/* ---------- Gráficas ---------- */
export function Bars({ data, fmt = money, color = 'var(--amber)', height = 190 }) {
  if (!data.length) return html`<${Empty} icon="chart" title="Sin datos todavía" />`;
  const max = Math.max(1, ...data.map((d) => d.v));
  return html`<div class="bars" style=${{ height: height + 'px' }}>
    ${data.map((d, i) => html`<div class="bar-col" key=${d.k || i}>
      <div class="bar-wrap">
        <div class=${'bar' + (d.hl ? ' hl' : '')} tabindex="0" style=${{ height: Math.max(2, (d.v / max) * 100) + '%', background: d.color || color, animationDelay: i * 35 + 'ms' }}>
          <span class="tip"><b>${fmt(d.v)}</b>${d.tip || d.label}</span>
        </div>
      </div>
      <span class="bar-label">${d.label}</span>
    </div>`)}
  </div>`;
}

export function HBars({ data, fmt = money }) {
  if (!data.length) return html`<${Empty} icon="chart" title="Sin datos todavía" />`;
  const max = Math.max(1, ...data.map((d) => d.v));
  return html`<div class="hbars">${data.map((d, i) => html`<div class="hbar" key=${d.label + i}>
    <div class="hbar-top"><span>${d.label}</span><b>${fmt(d.v)}</b></div>
    <div class="hbar-track"><div class="hbar-fill" style=${{ width: (d.v / max) * 100 + '%', background: d.color || 'var(--amber)', animationDelay: i * 50 + 'ms' }}></div></div>
    ${d.sub && html`<small>${d.sub}</small>`}
  </div>`)}</div>`;
}

export function Donut({ data, center }) {
  const total = data.reduce((a, d) => a + d.v, 0);
  if (!total) return html`<${Empty} icon="chart" title="Sin datos todavía" />`;
  const r = 52, c = 2 * Math.PI * r;
  let off = 0;
  const arcs = data.filter((d) => d.v > 0).map((d, i) => {
    const len = (d.v / total) * c;
    const el = html`<circle key=${i} cx="70" cy="70" r=${r} fill="none" stroke=${d.color} stroke-width="18"
      stroke-dasharray=${len + ' ' + (c - len)} stroke-dashoffset=${-off} transform="rotate(-90 70 70)"><title>${d.label}: ${d.v}</title></circle>`;
    off += len;
    return el;
  });
  return html`<div class="donut">
    <svg viewBox="0 0 140 140" width="150" height="150">
      <circle cx="70" cy="70" r=${r} fill="none" stroke="var(--line)" stroke-width="18" />${arcs}
      <text x="70" y="68" text-anchor="middle" class="donut-num">${center ? center.v : total}</text>
      <text x="70" y="88" text-anchor="middle" class="donut-lbl">${center ? center.l : 'total'}</text>
    </svg>
    <div class="legend">${data.map((d) => html`<div key=${d.label}><i style=${{ background: d.color }}></i><span>${d.label}</span><b>${d.v}</b></div>`)}</div>
  </div>`;
}

export function Meter({ value, max, tone = 'amber' }) {
  const p = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return html`<div class="meter"><div class=${'meter-fill ' + tone} style=${{ width: p + '%' }}></div></div>`;
}
