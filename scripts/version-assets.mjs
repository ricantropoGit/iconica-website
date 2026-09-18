/* =========================================================================
   Build del sitio: arma public/ y versiona los recursos
   -------------------------------------------------------------------------
   Corre SÓLO en el build de Vercel (buildCommand en vercel.json). Hace dos
   cosas:

   1) Copia el sitio estático a public/. Lo que NO se copia no se publica:
      api/ (son funciones, su código no debe servirse), scripts/ (esto
      mismo) y vercel.json. Antes se publicaba la raíz completa y el código
      fuente de las funciones quedaba legible en iconica24.com/api/*.js.

   2) Agrega a cada referencia del HTML una huella de su contenido:

          css/styles.css   →   css/styles.css?v=3f9a1c02be

      vercel.json da a esos archivos una caché de un año, pero sólo cuando
      la petición trae ?v=. Si el CSS cambia, cambia su huella, cambia la
      URL y el navegador lo trata como archivo nuevo: nadie se queda con
      una versión vieja. Si no cambia, el que regresa no vuelve a bajarlo.

   A prueba de fallos: sin ?v= la regla de caché no aplica y todo se sirve
   como siempre (max-age=0). Lo peor que puede pasar es quedarse igual.

   Los archivos fuente NO se tocan: el guardia de abajo detiene el script si
   encuentra .git, que existe en la copia local y nunca se sube a Vercel.
   ========================================================================= */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, cpSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const ROOT = process.cwd();
const SALIDA = join(ROOT, 'public');

if (existsSync(join(ROOT, '.git'))) {
  console.log('[build] Copia local detectada (.git): no se modifica nada. Este script sólo corre en el build de Vercel.');
  process.exit(0);
}

// Nunca se publican. Todo lo demás de la raíz sí.
const FUERA = new Set(['api', 'scripts', 'public', 'vercel.json', 'package.json', 'node_modules']);

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
