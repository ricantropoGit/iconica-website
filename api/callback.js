// =====================================================================
// Inicio de sesión del panel /admin (Decap CMS) — paso 2 de 2
// =====================================================================
// GitHub regresa aquí con un "code". Lo cambiamos por un token (esto
// necesita el secreto, por eso ocurre en el servidor y no en el navegador)
// y se lo pasamos a la ventana del panel con el protocolo de Decap:
//
//   ventana emergente → panel:  "authorizing:github"
//   panel → ventana emergente:  (cualquier mensaje, para saber su origen)
//   ventana emergente → panel:  "authorization:github:success:{token}"
//
// El token sólo se entrega a una ventana de este mismo dominio: si otra
// página abrió la emergente, no recibe nada.
// =====================================================================
function leerCookie(req, nombre) {
  const m = (req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${nombre}=([^;]+)`));
  return m ? m[1] : null;
}

function pagina(res, estado, contenido, origen) {
  const mensaje = `authorization:github:${estado}:${JSON.stringify(contenido)}`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Set-Cookie', 'decap_state=; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  res.status(200).send(`<!doctype html><html><body><p>Conectando con el panel…</p><script>
(function () {
  var origen = ${JSON.stringify(origen)};
  var mensaje = ${JSON.stringify(mensaje)};
  function recibir(e) {
    if (e.origin !== origen) return;
    window.removeEventListener('message', recibir);
    window.opener.postMessage(mensaje, origen);
  }
  window.addEventListener('message', recibir);
  window.opener.postMessage('authorizing:github', origen);
})();
</script></body></html>`);
}

export default async function handler(req, res) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const origen = `https://${host}`;
  const { code, state } = req.query;

  if (!code || !state || state !== leerCookie(req, 'decap_state')) {
    pagina(res, 'error', { message: 'La sesión expiró o no es válida. Cierra esta ventana e inténtalo de nuevo.' }, origen);
    return;
  }

  try {
    const r = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${origen}/api/callback`,
      }),
    });
    const datos = await r.json();
    if (!datos.access_token) throw new Error(datos.error_description || datos.error || 'GitHub no devolvió token');
    pagina(res, 'success', { token: datos.access_token, provider: 'github' }, origen);
  } catch (err) {
    console.error('[callback] ', err.message);
    pagina(res, 'error', { message: 'No se pudo completar el inicio de sesión con GitHub.' }, origen);
  }
}
