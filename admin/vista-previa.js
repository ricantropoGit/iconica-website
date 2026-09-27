/* =========================================================================
   Vista previa del panel (botón del ojo en /admin)
   -------------------------------------------------------------------------
   Muestra la página real mientras se edita: toma la plantilla (index.html
   con sus marcadores data-cms) y la rellena con lo que hay en el formulario,
   con el mismo motor que usa el build. Lo que se ve aquí es lo que se
   publica.

   Además liga formulario y vista previa en los dos sentidos:
     - el campo que se está editando se resalta en la página;
     - un clic en un elemento de la página abre y enfoca su campo.
   El motor marca cada elemento con data-ruta="hero.titulo"; del lado del
   formulario la ruta se lee de los id que pone Decap (hero-field-6 →
   titulo-field-7) y de la posición de cada elemento en las listas.

   En el sitio publicado, el build copia la plantilla y el motor a /admin/.
   En local (decap-server) se leen directo de la raíz.
   ========================================================================= */
const { aplicarContenido } = await import('/admin/contenido.js')
  .catch(() => import('/scripts/contenido.mjs'));

const plantilla = fetch('/admin/plantilla-inicio.html')
  .then(r => (r.ok ? r : fetch('/index.html')))
  .then(r => r.text())
  .then(html => {
    const cuerpo = html.slice(html.indexOf('>', html.indexOf('<body')) + 1, html.lastIndexOf('</body>'));
    // Los scripts no corren en la vista previa; se quitan para no ensuciarla.
    return cuerpo.replace(/<script\b[\s\S]*?<\/script>/gi, '');
  });

const CMS = window.CMS;
CMS.registerPreviewStyle('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800;900&display=swap');
CMS.registerPreviewStyle('/css/styles.css');
CMS.registerPreviewStyle(`
  [data-ruta] { cursor: pointer; transition: outline-color .15s; outline: 2px solid transparent; outline-offset: 4px; border-radius: 3px; }
  [data-ruta]:hover { outline: 2px dashed rgba(47, 111, 237, .55); }
  /* Sólo contorno y halo: un fondo taparía el de botones y bloques oscuros. */
  [data-ruta].cms-activo { outline: 2px solid #2f6fed; box-shadow: 0 0 0 6px rgba(47, 111, 237, .2); }
`, { raw: true });

/* ---------- Formulario: de campo a ruta y de ruta a campo ---------- */

const ID_CAMPO = /^(.+)-field-\d+$/;
const esItem = el => /ListItem/.test(el.className || '');
const esNodo = el => ID_CAMPO.test(el.id || '') || esItem(el);
const formulario = () => document.querySelector('[class*="ControlPaneContainer"]');

// Nodo de campo o de lista más cercano por encima de `el` (sin incluirlo).
function nodoPadre(el, tope) {
  for (let p = el.parentElement; p && p !== tope; p = p.parentElement) if (esNodo(p)) return p;
  return null;
}

function rutaDeCampo(el) {
  const raiz = formulario();
  const partes = [];
  for (let n = el; n && n !== raiz; n = n.parentElement) {
    if (ID_CAMPO.test(n.id || '')) partes.unshift(n.id.match(ID_CAMPO)[1]);
    else if (esItem(n)) partes.unshift(String([...n.parentElement.children].filter(esItem).indexOf(n)));
  }
  return partes;
}

// Ruta en el JSON: en listas de textos sueltos (Qué incluye) Decap nombra al
// campo interno ("punto"), pero en el JSON el elemento es el texto mismo.
function normalizar(partes, datos) {
  let v = datos;
  for (let i = 0; i < partes.length; i++) {
    if (v == null || typeof v !== 'object') return partes.slice(0, i).join('.');
    v = v[partes[i]];
  }
  return v === undefined ? partes.slice(0, -1).join('.') : partes.join('.');
}

// Hijos directos (en términos de campos) de un nodo del formulario.
function hijos(nodo, raiz) {
  return [...nodo.querySelectorAll('[id*="-field-"], [class*="ListItem"]')]
    .filter(el => esNodo(el) && (nodoPadre(el, raiz) || raiz) === nodo);
}

function abrir(nodo, raiz) {
  const boton = [...nodo.querySelectorAll('button[data-testid="expand-button"]')]
    .find(b => nodoPadre(b, raiz) === nodo);
  if (boton && boton.getAttribute('aria-label') === 'Expand') boton.click();
}

async function irACampo(ruta) {
  const raiz = formulario();
  if (!raiz) return;
  let nodo = raiz;
  for (const parte of ruta.split('.')) {
    abrir(nodo, raiz);
    await new Promise(r => requestAnimationFrame(r));
    const candidatos = hijos(nodo, raiz);
    const siguiente = /^\d+$/.test(parte)
      ? candidatos.filter(esItem)[Number(parte)]
      : candidatos.find(el => (el.id.match(ID_CAMPO) || [])[1] === parte);
    if (!siguiente) break;
    nodo = siguiente;
  }
  abrir(nodo, raiz);
  await new Promise(r => requestAnimationFrame(r));
  const control = nodo.matches('input, textarea') ? nodo : nodo.querySelector('input, textarea, [contenteditable="true"]');
  (control || nodo).scrollIntoView({ block: 'center', behavior: 'smooth' });
  if (control) control.focus({ preventScroll: true });
}

/* ---------- Vista previa: resaltar el campo activo ---------- */

let rutaActiva = null;
let docVista = null;

function resaltar(desplazar) {
  if (!docVista) return;
  docVista.querySelectorAll('.cms-activo').forEach(el => el.classList.remove('cms-activo'));
  if (!rutaActiva) return;
  // El elemento exacto; si no hay, el más cercano que lo contenga
  // (p. ej. al enfocar una pregunta completa de la lista).
  let objetivo = null;
  for (let r = rutaActiva; r && !objetivo; r = r.includes('.') ? r.slice(0, r.lastIndexOf('.')) : '') {
    objetivo = docVista.querySelector(`[data-ruta="${CSS.escape(r)}"]`);
  }
  if (!objetivo) return;
  objetivo.classList.add('cms-activo');
  if (desplazar) objetivo.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

let datosActuales = {};
document.addEventListener('focusin', e => {
  const raiz = formulario();
  if (!raiz || !raiz.contains(e.target)) return;
  const ruta = normalizar(rutaDeCampo(e.target), datosActuales);
  if (ruta === rutaActiva) return;
  rutaActiva = ruta;
  resaltar(true);
});

/* ---------- Plantilla de vista previa ---------- */

const VistaInicio = window.createClass({
  getInitialState() { return { plantilla: null, error: null }; },
  componentDidMount() {
    plantilla
      .then(p => this.setState({ plantilla: p }))
      .catch(() => this.setState({ error: 'No se pudo cargar la vista previa.' }));
  },
  componentDidUpdate() {
    if (!this.raiz) return;
    const doc = this.raiz.ownerDocument;
    if (doc !== docVista) {
      docVista = doc;
      doc.addEventListener('click', e => {
        // En la vista previa los enlaces no navegan: un clic edita.
        if (e.target.closest('a')) e.preventDefault();
        const el = e.target.closest('[data-ruta]');
        if (el) irACampo(el.getAttribute('data-ruta'));
      });
    }
    resaltar(false);
  },
  render() {
    const h = window.h;
    if (this.state.error) return h('p', { style: { padding: '2rem' } }, this.state.error);
    if (!this.state.plantilla) return h('p', { style: { padding: '2rem' } }, 'Cargando vista previa…');
    datosActuales = this.props.entry.get('data').toJS();
    const { html } = aplicarContenido(this.state.plantilla, datosActuales, { marcar: true });
    return h('div', { ref: el => { this.raiz = el; }, dangerouslySetInnerHTML: { __html: html } });
  },
});

CMS.registerPreviewTemplate('inicio', VistaInicio);
