/* =========================================================================
   Contenido editable: rellena el HTML con los textos de contenido/*.json
   -------------------------------------------------------------------------
   El HTML sigue siendo la plantilla (diseño, clases, íconos). Los textos
   que el cliente puede cambiar desde /admin (Decap CMS) viven en un JSON y
   se marcan en el HTML con atributos:

     data-cms="hero.titulo"         reemplaza el contenido del elemento
     data-cms-href="plan.enlace"    reemplaza el atributo href (también
                                    -src, -alt, -content)
     data-cms-list="faq.preguntas"  repite su primer hijo marcado con
                                    data-cms-item, una vez por elemento
     data-cms=".pregunta"           dentro de una lista: clave del elemento
                                    ("." es el elemento mismo)
     data-cms-index                 número del elemento en la lista (01, 02…)
     data-cms-optional              si el valor está vacío, el elemento
                                    desaparece

   Los textos admiten un marcado mínimo, para no pedirle HTML al cliente:
     ==texto==      resaltado (<span class="hl">)
     **texto**      negritas
     [texto](url)   enlace
     ^1^            llamada a nota (<sup class="note">)

   A prueba de fallos: si falta una clave en el JSON, el texto original del
   HTML se queda como está y sólo se avisa en el log del build.

   Para la vista previa del panel, { marcar: true } deja en cada elemento
   editable un data-ruta con su ruta completa en el JSON (hero.titulo,
   faq.preguntas.3.respuesta…), para ligarlo con su campo del formulario.
   ========================================================================= */

const ATRIBUTOS = ['href', 'src', 'alt', 'content'];

// Etiquetas y comentarios. Los comentarios se saltan: el HTML guarda
// secciones desactivadas dentro de <!-- --> que no deben contarse.
const TOKEN = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w-]*)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
const VACIAS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

function escaparTexto(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapar(s) {
  return escaparTexto(s).replace(/"/g, '&quot;');
}

export function marcado(texto) {
  return escaparTexto(texto)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, url) => {
      if (/^\s*(?:javascript|data|vbscript):/i.test(url)) url = '#';
      url = url.replace(/"/g, '&quot;');
      return /^https?:\/\//.test(url) ? `<a href="${url}" target="_blank" rel="noopener">${t}</a>` : `<a href="${url}">${t}</a>`;
    })
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/==(.+?)==/g, '<span class="hl">$1</span>')
    .replace(/\^(\w+)\^/g, '<sup class="note">$1</sup>');
}

function leer(ctx, clave) {
  if (clave === '.') return ctx;
  let v = ctx;
  for (const parte of clave.replace(/^\./, '').split('.')) {
    if (v == null) return undefined;
    v = v[parte];
  }
  return v;
}

function atributo(etiqueta, nombre) {
  const m = etiqueta.match(new RegExp(`\\s${nombre}(?:="([^"]*)")?(?=[\\s/>])`));
  return m ? (m[1] ?? '') : null;
}

// Siguiente etiqueta de apertura (fuera de comentarios) que cumpla `prueba`.
function buscar(html, desde, prueba) {
  TOKEN.lastIndex = desde;
  let m;
  while ((m = TOKEN.exec(html))) {
    if (m[2] && !m[1] && prueba(m[0])) {
      return { inicio: m.index, finApertura: TOKEN.lastIndex, nombre: m[2].toLowerCase(), apertura: m[0] };
    }
  }
  return null;
}

// Posición de la etiqueta de cierre que corresponde a `el`.
function cierre(html, el) {
  if (VACIAS.has(el.nombre) || el.apertura.endsWith('/>')) return null;
  TOKEN.lastIndex = el.finApertura;
  let nivel = 1, m;
  while ((m = TOKEN.exec(html))) {
    if (!m[2] || m[2].toLowerCase() !== el.nombre) continue;
    nivel += m[1] ? -1 : 1;
    if (nivel === 0) return { inicio: m.index, fin: TOKEN.lastIndex };
  }
  throw new Error(`<${el.nombre}> sin cierre en la posición ${el.inicio}`);
}

function limpiarApertura(etiqueta) {
  return etiqueta.replace(/\s+data-cms(?:-[\w-]+)?(?:="[^"]*")?(?=[\s/>])/g, '');
}

const avisos = [];
let marcar = false;

// Ruta completa de una clave: las que empiezan con "." son relativas al
// elemento de la lista en curso (base).
function rutaDe(clave, base) {
  if (!clave.startsWith('.')) return clave;
  return clave === '.' ? base : `${base}${clave}`;
}

function conRuta(apertura, ruta) {
  if (!marcar || !ruta) return apertura;
  return apertura.replace(/\s*\/?>$/, m => ` data-ruta="${escapar(ruta)}"${m}`);
}

function renderizar(html, ctx, indice, base = '') {
  // 1) Listas, de la más externa hacia adentro (cada una se resuelve completa).
  let pos = 0, el;
  while ((el = buscar(html, pos, t => atributo(t, 'data-cms-list') !== null))) {
    const clave = atributo(el.apertura, 'data-cms-list');
    const c = cierre(html, el);
    const items = leer(ctx, clave);
    const interior = html.slice(el.finApertura, c.inicio);
    const tpl = buscar(interior, 0, t => atributo(t, 'data-cms-item') !== null);
    let nuevo = interior;
    if (!Array.isArray(items)) avisos.push(`falta la lista "${clave}"`);
    else if (!tpl) avisos.push(`la lista "${clave}" no tiene data-cms-item`);
    else {
      const plantilla = interior.slice(tpl.inicio, cierre(interior, tpl).fin);
      // Sangría del primer elemento, para que el HTML publicado siga legible.
      const sangria = interior.slice(0, tpl.inicio);
      const k = interior.lastIndexOf('\n');
      const cola = k >= 0 ? interior.slice(k) : '';
      const ruta = rutaDe(clave, base);
      nuevo = items.map((item, i) => sangria + renderizar(plantilla, item, i, `${ruta}.${i}`)).join('') + cola;
    }
    const apertura = limpiarApertura(el.apertura);
    html = html.slice(0, el.inicio) + apertura + nuevo + html.slice(c.inicio);
    pos = el.inicio + apertura.length + nuevo.length;
  }

  // 2) Textos y atributos.
  pos = 0;
  while ((el = buscar(html, pos, t => /\sdata-cms/.test(t)))) {
    let apertura = el.apertura;
    for (const a of ATRIBUTOS) {
      const clave = atributo(apertura, `data-cms-${a}`);
      if (clave === null) continue;
      const v = leer(ctx, clave);
      if (v == null) { avisos.push(`falta "${clave}"`); continue; }
      apertura = apertura.replace(new RegExp(`(\\s${a}=")[^"]*(")`), `$1${escapar(v)}$2`);
    }

    const clave = atributo(apertura, 'data-cms');
    const esItem = atributo(apertura, 'data-cms-item') !== null;
    const enlace = atributo(apertura, 'data-cms-href');
    const ruta = clave !== null ? rutaDe(clave, base) : esItem ? base : enlace !== null ? rutaDe(enlace, base) : null;
    const conIndice = atributo(apertura, 'data-cms-index') !== null;
    const opcional = atributo(apertura, 'data-cms-optional') !== null;
    let contenido = null;
    if (conIndice) contenido = String((indice ?? 0) + 1).padStart(2, '0');
    else if (clave !== null) {
      const v = leer(ctx, clave);
      if (v == null) avisos.push(`falta "${clave}"`);
      else contenido = marcado(v);
    }

    const c = cierre(html, el);
    if (opcional && contenido === '') {
      // Se va el elemento completo, con la sangría que lo precedía.
      const inicio = html.lastIndexOf('\n', el.inicio - 1);
      const desde = /^\s*$/.test(html.slice(inicio + 1, el.inicio)) ? inicio : el.inicio;
      html = html.slice(0, desde) + html.slice(c ? c.fin : el.finApertura);
      pos = desde;
      continue;
    }
    apertura = conRuta(limpiarApertura(apertura), ruta);
    if (c && contenido !== null) {
      html = html.slice(0, el.inicio) + apertura + contenido + html.slice(c.inicio);
    } else {
      html = html.slice(0, el.inicio) + apertura + html.slice(el.finApertura);
    }
    pos = el.inicio + apertura.length;
  }
  return html;
}

export function aplicarContenido(html, datos, opciones = {}) {
  avisos.length = 0;
  marcar = !!opciones.marcar;
  const salida = renderizar(html, datos);
  return { html: salida, avisos: [...avisos] };
}
