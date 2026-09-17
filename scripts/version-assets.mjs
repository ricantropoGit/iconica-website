/* =========================================================================
   Versionado de recursos para la caché del navegador
   -------------------------------------------------------------------------
   Corre SÓLO en el build de Vercel (buildCommand en vercel.json). Agrega a
   cada referencia local del HTML una huella de su contenido:

       css/styles.css   →   css/styles.css?v=3f9a1c02be

   Por qué: vercel.json da a esos archivos una caché de un año, pero sólo
   cuando la petición trae ?v=. Si el CSS cambia, cambia su huella, cambia la
   URL y el navegador lo trata como un archivo nuevo: nadie se queda con una
   versión vieja. Si no cambia, la huella se conserva y el visitante que
   regresa no vuelve a descargarlo.

   A prueba de fallos: si este script no llegara a correr, el HTML sale sin
   ?v=, la regla de caché larga no aplica y todo se sirve como hasta ahora
   (max-age=0). Lo peor que puede pasar es quedarse igual que antes.

   Los archivos fuente NO se tocan: el guardia de abajo detiene el script si
   encuentra .git, que existe en tu copia local y nunca se sube a Vercel.
   ========================================================================= */
import { readFileSync, writeFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.cwd();

if (existsSync(join(ROOT, '.git'))) {
  console.log('[version-assets] Copia local detectada (.git): no se modifica nada. Este script sólo corre en el build de Vercel.');
  process.exit(0);
}

// Recursos locales con caché larga. La ruta NO debe traer ya ?v= ni #:
// así el script es idempotente y no toca URLs externas.
const REF = /\b(href|src)="(\/?)((?:css|js|images)\/[^"?#]+|favicon\.(?:svg|ico)|apple-touch-icon\.png)"/g;

const huellas = new Map();
function huella(ruta) {
  if (!huellas.has(ruta)) {
    const abs = join(ROOT, ruta);
    huellas.set(ruta, existsSync(abs)
      ? createHash('sha256').update(readFileSync(abs)).digest('hex').slice(0, 10)
      : null);
  }
  return huellas.get(ruta);
}

let total = 0;
for (const pagina of readdirSync(ROOT).filter(f => f.endsWith('.html'))) {
  const html = readFileSync(join(ROOT, pagina), 'utf8');
  let n = 0;
  const nuevo = html.replace(REF, (todo, attr, barra, ruta) => {
    const h = huella(ruta);
    if (!h) { console.warn(`[version-assets] ${pagina}: no existe ${ruta}, se deja igual`); return todo; }
    n++;
    return `${attr}="${barra}${ruta}?v=${h}"`;
  });
  if (n) writeFileSync(join(ROOT, pagina), nuevo);
  console.log(`[version-assets] ${pagina}: ${n} recurso(s) versionado(s)`);
  total += n;
}
console.log(`[version-assets] Total: ${total}`);

// El script no tiene nada que hacer en el sitio publicado: se retira del
// build para que no quede servido en iconica24.com/scripts/.
rmSync(fileURLToPath(import.meta.url), { force: true });
