/* =========================================================================
   Build del sitio: arma public/ y versiona los recursos
   -------------------------------------------------------------------------
   Corre SÓLO en el build de Vercel (buildCommand en vercel.json). Hace tres
   cosas:

   1) Copia el sitio estático a public/. Lo que NO se copia no se publica:
      api/ (son funciones, su código no debe servirse), scripts/ (esto
      mismo) y vercel.json. Antes se publicaba la raíz completa y el código
      fuente de las funciones quedaba legible en iconica24.com/api/*.js.

   2) Rellena index.html con los textos de contenido/inicio.json, que es lo
      que el cliente edita desde /admin (Decap CMS). Ver scripts/contenido.mjs.

   3) Agrega a cada referencia del HTML una huella de su contenido:

          css/styles.css   →   css/styles.css?v=3f9a1c02be

      vercel.json da a esos archivos una caché de un año, pero sólo cuando
      la petición trae ?v=. Si el CSS cambia, cambia su huella, cambia la
      URL y el navegador lo trata como archivo nuevo: nadie se queda con
      una versión vieja. Si no cambia, el que regresa no vuelve a bajarlo.

   A prueba de fallos: sin ?v= la regla de caché no aplica y todo se sirve
   como siempre (max-age=0). Lo peor que puede pasar es quedarse igual.

   Los archivos fuente NO se tocan, y el guardia de abajo detiene el script
   fuera de Vercel. La señal es la variable VERCEL=1, que Vercel define en
   cada build. Antes se usaba la carpeta .git, pero en Vercel sí existe:
   .vercelignore borra sus archivos y deja la carpeta vacía, así que el
   script creía estar en local, no generaba public/ y el deploy fallaba.
   Para probar el build en local: VERCEL=1 node scripts/version-assets.mjs
   ========================================================================= */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, cpSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { aplicarContenido } from './contenido.mjs';

const ROOT = process.cwd();
const SALIDA = join(ROOT, 'public');

if (process.env.VERCEL !== '1') {
  console.log('[build] Fuera de Vercel (sin VERCEL=1): no se modifica nada. Este script sólo corre en el build de Vercel.');
  process.exit(0);
}

// Nunca se publican. Todo lo demás de la raíz sí.
const FUERA = new Set(['api', 'scripts', 'contenido', 'public', 'vercel.json', 'package.json', 'node_modules']);

rmSync(SALIDA, { recursive: true, force: true });
mkdirSync(SALIDA);

let copiados = 0;
for (const entrada of readdirSync(ROOT)) {
  if (FUERA.has(entrada) || entrada.startsWith('.')) continue;
  cpSync(join(ROOT, entrada), join(SALIDA, entrada), { recursive: true });
  copiados++;
  console.log(`[build] publicado: ${entrada}`);
}
console.log(`[build] ${copiados} entradas copiadas a public/`);

// Contenido editable. Si el JSON falta o está mal formado, el build falla:
// publicar la plantilla con textos viejos sin avisar sería peor.
const PAGINAS = { 'index.html': 'contenido/inicio.json' };
for (const [pagina, fuente] of Object.entries(PAGINAS)) {
  const datos = JSON.parse(readFileSync(join(ROOT, fuente), 'utf8'));
  const { html, avisos } = aplicarContenido(readFileSync(join(SALIDA, pagina), 'utf8'), datos);
  writeFileSync(join(SALIDA, pagina), html);
  for (const a of avisos) console.warn(`[build] ${pagina}: ${a} en ${fuente}, se deja el texto del HTML`);
  console.log(`[build] ${pagina}: contenido aplicado desde ${fuente}`);
}

// Vista previa del panel: la plantilla con sus marcadores y el mismo motor
// que la rellena, para que /admin muestre el sitio real mientras se edita.
cpSync(join(ROOT, 'index.html'), join(SALIDA, 'admin', 'plantilla-inicio.html'));
cpSync(join(ROOT, 'scripts', 'contenido.mjs'), join(SALIDA, 'admin', 'contenido.js'));
console.log('[build] admin/: plantilla y motor de la vista previa copiados');

// Recursos locales con caché larga. La ruta no debe traer ya ?v= ni #,
// para que el script sea idempotente y no toque URLs externas.
const REF = /\b(href|src)="(\/?)((?:css|js|images)\/[^"?#]+|favicon\.(?:svg|ico)|apple-touch-icon\.png)"/g;

const huellas = new Map();
function huella(ruta) {
  if (!huellas.has(ruta)) {
    const abs = join(SALIDA, ruta);
    huellas.set(ruta, existsSync(abs)
      ? createHash('sha256').update(readFileSync(abs)).digest('hex').slice(0, 10)
      : null);
  }
  return huellas.get(ruta);
}

let total = 0;
for (const pagina of readdirSync(SALIDA).filter(f => f.endsWith('.html'))) {
  const html = readFileSync(join(SALIDA, pagina), 'utf8');
  let n = 0;
  const nuevo = html.replace(REF, (todo, attr, barra, ruta) => {
    const h = huella(ruta);
    if (!h) { console.warn(`[build] ${pagina}: no existe ${ruta}, se deja igual`); return todo; }
    n++;
    return `${attr}="${barra}${ruta}?v=${h}"`;
  });
  if (n) writeFileSync(join(SALIDA, pagina), nuevo);
  console.log(`[build] ${pagina}: ${n} recurso(s) versionado(s)`);
  total += n;
}
console.log(`[build] Total versionado: ${total}`);
