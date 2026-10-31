import { html, useState, Icon, Card, Loader, Empty, ErrorBox, Field, AsyncButton, Badge, useAsync, toast } from '../ui.js';
import { sb, q, CONFIG, money, num, fechaHora } from '../lib.js';

const ICONOS = { Ventas: 'chart', Precios: 'wallet', Costos: 'wallet', 'Rutas y entregas': 'truck', Repartidores: 'idcard', Clientes: 'users', Zonas: 'pin', Inventario: 'box', 'Pérdidas': 'egg', Pagos: 'wallet', 'Operación': 'settings' };
const TONO = { alto: 'green', medio: 'amber', bajo: 'gray' };
const ESF = { bajo: 'green', medio: 'amber', alto: 'red' };
const HECHOS = 'naza_consejos_hechos';
const leerHechos = () => { try { return JSON.parse(localStorage.getItem(HECHOS) || '{}'); } catch (e) { return {}; } };

/* =================== Consejos con IA (Admin) =================== */
export function Consejos() {
  const r = useAsync(() => q(sb.from('consejos').select('id,creado_en,usuario,resumen,consejos,datos,modelo,estado').eq('estado', 'listo').order('creado_en', { ascending: false }).limit(12)), []);
  const [sel, setSel] = useState(null);
  const [dias, setDias] = useState('90');
  const [enfoque, setEnfoque] = useState('');
  const [cat, setCat] = useState('');
  const [hechos, setHechos] = useState(leerHechos());
  const lista = r.data || [];
  const actual = lista.find((x) => x.id === sel) || lista[0];

  const generar = async () => {
    const datos = await q(sb.rpc('consejos_datos', { p_dias: Number(dias) }));
    const { data: s } = await sb.auth.getSession();
    const token = s && s.session && s.session.access_token;
    if (!token) throw new Error('Tu sesión terminó. Vuelve a entrar.');
    const res = await fetch(CONFIG.consejosUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ datos, enfoque }) });
    let j = {}; try { j = await res.json(); } catch (e) { /* sin cuerpo */ }
    if (!res.ok || !j.ok) throw new Error(j.mensaje || 'No pudimos generar los consejos. Inténtalo de nuevo en un momento.');
    toast('¡Listo! Nuevos consejos para el negocio');
    setSel(j.id || null); setCat(''); r.reload();
  };
  const marcar = (k) => { const h = { ...hechos, [k]: !hechos[k] }; setHechos(h); try { localStorage.setItem(HECHOS, JSON.stringify(h)); } catch (e) { /* sin almacenamiento */ } };

  const c = actual && actual.consejos || {};
  const consejos = (c.lista || []).filter((x) => !cat || x.categoria === cat);
  const cats = [...new Set((c.lista || []).map((x) => x.categoria))];
  const d = actual && actual.datos || {};
  const ventas = (d.ventas_semanales || []).reduce((a, w) => a + (Number(w.ventas) || 0), 0);
  const pedidos = (d.ventas_semanales || []).reduce((a, w) => a + (Number(w.pedidos) || 0), 0);

  return html`<div class="stack">
    <div class="page-head"><div><h2>Consejos</h2><p class="muted">La inteligencia artificial analiza ventas, clientes, rutas, repartidores, barrios, inventario y pérdidas, y te sugiere cómo mejorar el negocio.</p></div></div>

    <${Card} title="Generar un nuevo análisis" icon="spark">
      <div class="consejo-gen">
        <${Field} label="Periodo a analizar"><select class="input" value=${dias} onChange=${(e) => setDias(e.target.value)}>
          <option value="30">Últimos 30 días</option><option value="90">Últimos 90 días</option><option value="180">Últimos 6 meses</option><option value="365">Último año</option></select><//>
        <${Field} label="¿Quieres que se enfoque en algo? (opcional)"><input class="input" value=${enfoque} maxlength="300" onInput=${(e) => setEnfoque(e.target.value)} placeholder="Ej.: bajar costos de domicilio, vender más los sábados" /><//>
        <${AsyncButton} className="btn primary big" icon="spark" onClick=${generar}>Analizar mi negocio<//>
      </div>
      <p class="muted small">Toma unos segundos. Se envía un resumen de cifras del negocio (sin nombres, teléfonos ni direcciones de clientes).</p>
    <//>

    <${ErrorBox} error=${r.error} onRetry=${r.reload} />
    ${!r.data ? html`<${Loader} rows=${5} />` : !actual ? html`<${Card}><${Empty} icon="spark" title="Aún no hay consejos">Toca "Analizar mi negocio" para obtener los primeros.<//><//>` : html`
      <div class="consejo-top">
        <section class="salud">
          ${c.salud && html`<div class="salud-ring" style=${{ '--p': c.salud.puntaje }}><b>${c.salud.puntaje}</b><span>de 100</span></div>`}
          <div><span class="hero-kicker">Análisis del ${fechaHora(actual.creado_en)}</span><h3>Estado del negocio</h3><p>${actual.resumen}</p>
            ${c.salud && c.salud.explicacion && html`<p class="muted small">${c.salud.explicacion}</p>`}</div>
        </section>
        <section class="datos-usados">
          <div class="mini-kpis">
            <div><b>${money(ventas)}</b><span>Ventas del periodo</span></div><div><b>${num(pedidos)}</b><span>Pedidos</span></div>
            <div><b>${num(d.clientes && d.clientes.con_compras)}</b><span>Clientes que compran</span></div><div><b>${num(d.rutas && d.rutas.total)}</b><span>Rutas</span></div>
            <div class=${d.huevos_danados && d.huevos_danados.huevos ? 'no' : ''}><b>${num(d.huevos_danados && d.huevos_danados.huevos)}</b><span>Huevos dañados</span></div>
          </div>
          ${lista.length > 1 && html`<${Field} label="Ver un análisis anterior"><select class="input" value=${actual.id} onChange=${(e) => { setSel(Number(e.target.value)); setCat(''); }}>
            ${lista.map((x) => html`<option value=${x.id}>${fechaHora(x.creado_en)}</option>`)}</select><//>`}
        </section>
      </div>

      ${(c.alertas || []).length > 0 && html`<div class="alertas">${c.alertas.map((a, i) => html`<div key=${i} class="alerta red"><${Icon} n="alert" size=${15} /><span>${a}</span></div>`)}</div>`}

      <div class="chips scroll-x">
        <button class=${'chip-b' + (!cat ? ' on' : '')} onClick=${() => setCat('')}>Todos<span class="chip-n">${(c.lista || []).length}</span></button>
        ${cats.map((k) => html`<button key=${k} class=${'chip-b' + (cat === k ? ' on' : '')} onClick=${() => setCat(k)}><${Icon} n=${ICONOS[k] || 'spark'} size=${13} />${k}<span class="chip-n">${(c.lista || []).filter((x) => x.categoria === k).length}</span></button>`)}
      </div>

      <div class="consejos">${consejos.map((x, i) => { const k = actual.id + ':' + x.titulo; return html`<article key=${k} class=${'consejo' + (hechos[k] ? ' hecho' : '')}>
        <header><span class="consejo-ico"><${Icon} n=${ICONOS[x.categoria] || 'spark'} size=${18} /></span>
          <div><span class="consejo-cat">${x.categoria}</span><h4>${x.titulo}</h4></div>
          <span class="consejo-n">${i + 1}</span></header>
        <div class="consejo-badges"><${Badge} tone=${TONO[x.impacto]}>Impacto ${x.impacto}<//><${Badge} tone=${ESF[x.esfuerzo]}>Esfuerzo ${x.esfuerzo}<//>
          ${x.ahorro_o_ganancia && !/no estimable/i.test(x.ahorro_o_ganancia) && html`<${Badge} tone="blue">${x.ahorro_o_ganancia}<//>`}</div>
        <p>${x.detalle}</p>
        ${x.por_que && html`<p class="consejo-dato"><${Icon} n="chart" size=${13} />${x.por_que}</p>`}
        ${(x.accion || []).length > 0 && html`<ol class="consejo-pasos">${x.accion.map((a, j) => html`<li key=${j}>${a}</li>`)}</ol>`}
        ${x.metrica && html`<p class="muted small"><b>Cómo medirlo:</b> ${x.metrica}</p>`}
        <button class=${'btn sm ' + (hechos[k] ? 'green' : 'ghost')} onClick=${() => marcar(k)}><${Icon} n="check" size=${14} />${hechos[k] ? 'Lo estoy aplicando' : 'Marcar como aplicado'}</button>
      </article>`; })}</div>

      ${(c.datos_faltantes || []).length > 0 && html`<${Card} title="Para consejos más precisos, conviene registrar" icon="file">
        <ul class="faltantes">${c.datos_faltantes.map((x, i) => html`<li key=${i}>${x}</li>`)}</ul><//>`}
      <p class="muted small center">Los consejos son sugerencias generadas con inteligencia artificial (${actual.modelo || 'Gemini'}) a partir de tus datos. Revísalos antes de aplicarlos.</p>`}
  </div>`;
}
