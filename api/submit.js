// =====================================================================
// Puente hacia Apps Script, con reintento SEGURO
// =====================================================================
// Apps Script no contesta el resultado en la misma respuesta. Al recibir
// el POST:
//   1. ejecuta el código  ← aquí se escribe el Sheet y salen los correos
//   2. guarda el resultado y responde 302 → script.googleusercontent.com
//   3. quien llama sigue esa liga para RECOGER el resultado
//
// El paso 3 falla de vez en cuando con un 404 y la página de Drive
// ("Sorry, unable to open the file at this time"). Cuando pasa, el trabajo
// ya está hecho: lo que se pierde es el acuse.
//
// Por eso seguimos la redirección a mano: así se puede reintentar SÓLO el
// paso 3, que es una lectura de algo ya calculado y no puede duplicar
// filas ni correos. El POST del paso 1 no se repite nunca.
// =====================================================================
const INTENTOS_DE_RECOGIDA = 3;

async function llamarAppsScript(url, payload) {
  const inicial = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    redirect: 'manual',   // no seguirla sola: la seguimos nosotros
  });

  const destino = inicial.headers.get('location');

  // Sin redirección (o sin Location): la respuesta viene directa
  if (inicial.status < 300 || inicial.status >= 400 || !destino) {
    return { status: inicial.status, text: await inicial.text() };
  }

  let ultima = null;

  for (let intento = 1; intento <= INTENTOS_DE_RECOGIDA; intento++) {
    const recogida = await fetch(destino);
    ultima = { status: recogida.status, text: await recogida.text() };

    if (recogida.ok) {
      if (intento > 1) console.log(`✓ Resultado recogido en el intento ${intento}`);
      return ultima;
    }

    console.warn(`⚠️ Recogida ${intento}/${INTENTOS_DE_RECOGIDA} devolvió ${recogida.status}`);

    // Espera creciente: 400 ms, 800 ms. El trabajo ya está hecho, así que
    // esperar un poco sale gratis frente a perder el acuse.
    if (intento < INTENTOS_DE_RECOGIDA) {
      await new Promise((r) => setTimeout(r, 400 * intento));
    }
  }

  return ultima;
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Si es OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzk9nv_x1ncl_PdLyjwC1J-uV1TU9PLLIaTNcBi-fVVUdqzJeY3x3mQJg_5VuQIZ3BeTQ/exec';

    const { status, text: responseText } = await llamarAppsScript(
      APPS_SCRIPT_URL,
      req.body
    );

    console.log('Response status:', status);
    console.log('Response text (primeros 500 caracteres):', responseText.substring(0, 500));

    let data;
    try {
      data = JSON.parse(responseText);
      console.log('✓ Response JSON parseado correctamente');
      console.log('Data contiene:', JSON.stringify(data));
    } catch (parseError) {
      // Llegamos aquí sólo si los tres intentos de recogida fallaron. El
      // script YA se ejecutó —la fila quedó escrita y los correos salieron—:
      // lo único que se perdió es el acuse.
      //
      // Lo que NO se hace nunca es repetir el POST. Estas acciones tienen
      // efectos (escriben en el Sheet, mandan correo, suben a Drive), así que
      // repetirlo duplicaría el trabajo en vez de arreglarlo.
      //
      // Se devuelve un código que el front puede distinguir, para que informe
      // sin mentir en ninguna de las dos direcciones.
      console.error('✗ Error al parsear JSON:', parseError.toString());
      console.log('Status upstream:', status);
      console.log('Response completo:', responseText);
      return res.status(502).json({
        success: false,
        code: 'upstream_non_json',
        error: 'Invalid JSON from Google Apps Script',
        upstreamStatus: status,
        details: responseText.substring(0, 200)
      });
    }

    // El log se lee desde el panel de Vercel: que diga qué acción fue, no
    // sólo el folio (que sólo existe para el formulario de fotos — en un
    // alta de socio siempre saldría "undefined" y parece un error sin serlo).
    console.log('✓ Devolviendo respuesta', {
      action: (req.body && req.body.action) || 'submitForm',
      success: data.success,
      submissionId: data.submissionId || '—'
    });
    return res.status(200).json(data);
  } catch (error) {
    console.error('✗ Error en /api/submit:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}