import crypto from 'crypto';

// =====================================================================
// Inicio de sesión del panel /admin (Decap CMS) — paso 1 de 2
// =====================================================================
// Decap abre esta ruta en una ventana emergente. La mandamos a GitHub
// para que el editor autorice la app; GitHub regresa a /api/callback.
//
// El "state" es un número al azar que guardamos en una cookie y que
// GitHub nos devuelve: si no coincide en el callback, alguien intentó
// colar una respuesta que no pedimos.
//
// Requiere en Vercel (Settings → Environment Variables):
//   GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET   (de una GitHub OAuth App)
// =====================================================================
export default function handler(req, res) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    res.status(500).send('Falta GITHUB_CLIENT_ID en las variables de entorno de Vercel.');
    return;
  }

  const state = crypto.randomBytes(16).toString('hex');
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `https://${host}/api/callback`,
    scope: 'public_repo',
    state,
  });

  res.setHeader('Set-Cookie', `decap_state=${state}; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
  res.redirect(302, `https://github.com/login/oauth/authorize?${params}`);
}
