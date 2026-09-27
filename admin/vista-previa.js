/* =========================================================================
   Vista previa del panel (botón del ojo en /admin)
   -------------------------------------------------------------------------
   Muestra la página real mientras se edita: toma la plantilla (index.html
   con sus marcadores data-cms) y la rellena con lo que hay en el formulario,
   con el mismo motor que usa el build. Lo que se ve aquí es lo que se
   publica.

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

const VistaInicio = window.createClass({
  getInitialState() { return { plantilla: null, error: null }; },
  componentDidMount() {
    plantilla
      .then(p => this.setState({ plantilla: p }))
      .catch(() => this.setState({ error: 'No se pudo cargar la vista previa.' }));
  },
  render() {
    const h = window.h;
    if (this.state.error) return h('p', { style: { padding: '2rem' } }, this.state.error);
    if (!this.state.plantilla) return h('p', { style: { padding: '2rem' } }, 'Cargando vista previa…');
    const { html } = aplicarContenido(this.state.plantilla, this.props.entry.get('data').toJS());
    return h('div', { dangerouslySetInnerHTML: { __html: html } });
  },
});

CMS.registerPreviewTemplate('inicio', VistaInicio);
