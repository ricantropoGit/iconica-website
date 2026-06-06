import crypto from 'crypto';

// =====================================================================
// IMPORTANTE: desactivar el body-parser de Vercel.
// Stripe firma el cuerpo CRUDO (bytes exactos). Si Vercel lo parsea a
// JSON y luego lo volvemos a serializar, la firma jamás coincide → 401.
// =====================================================================
export const config = {
  api: {
    bodyParser: false,
  },
};

// Leer el cuerpo crudo de la petición (bytes exactos que Stripe firmó)
async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

// Verificar la firma de Stripe siguiendo su esquema oficial:
//   signed_payload = `${timestamp}.${rawBody}`
//   expected       = HMAC_SHA256(signed_payload, signing_secret)
function verifyStripeSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader) return false;

  // Header: t=timestamp,v1=firma,v1=firma2,...
  const parts = signatureHeader.split(',').reduce(
    (acc, part) => {
      const [key, value] = part.split('=');
      if (key === 't') acc.timestamp = value;
      if (key === 'v1') acc.signatures.push(value);
      return acc;
    },
    { timestamp: null, signatures: [] }
  );

  if (!parts.timestamp || parts.signatures.length === 0) return false;

  const signedPayload = `${parts.timestamp}.${rawBody.toString('utf8')}`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(signedPayload, 'utf8')
    .digest('hex');

  // Comparación segura (timing-safe) contra cada firma v1 que envió Stripe
  return parts.signatures.some((sig) => {
    try {
      return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    } catch (e) {
      return false;
    }
  });
}

export default async function handler(req, res) {
  console.log('🔔 [Webhook] Recibido en Vercel');

  if (req.method !== 'POST') {
    console.warn('⚠️ [Webhook] Método no permitido:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // -------------------------------------------------------------------
  // PASO 1: Leer el cuerpo crudo
  // -------------------------------------------------------------------
  let rawBody;
  try {
    rawBody = await getRawBody(req);
  } catch (e) {
    console.error('❌ [Webhook] No se pudo leer el cuerpo:', e.message);
    return res.status(400).json({ error: 'Invalid body' });
  }

  // -------------------------------------------------------------------
  // PASO 2: Verificar la firma de Stripe (SEGURIDAD)
  // -------------------------------------------------------------------
  const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

  if (STRIPE_WEBHOOK_SECRET) {
    const signature = req.headers['stripe-signature'];
    const valid = verifyStripeSignature(rawBody, signature, STRIPE_WEBHOOK_SECRET);

    if (!valid) {
      console.error('❌ [Webhook] Firma Stripe inválida');
      // 400 (no 401) es la convención de Stripe para firma inválida
      return res.status(400).json({ error: 'Invalid signature' });
    }
    console.log('✅ [Webhook] Firma Stripe validada');
  } else {
    console.warn('⚠️ [Webhook] STRIPE_WEBHOOK_SECRET no configurado — se omite verificación (modo desarrollo)');
  }

  // -------------------------------------------------------------------
  // PASO 3: Parsear el evento desde el cuerpo crudo
  // -------------------------------------------------------------------
  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch (e) {
    console.error('❌ [Webhook] JSON inválido:', e.message);
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  console.log(`📨 [Webhook] Tipo: ${event.type}, ID: ${event.id}`);

  // -------------------------------------------------------------------
  // PASO 4: Reenviar a Google Apps Script y ESPERAR la respuesta.
  // En Vercel el patrón "fire-and-forget" no es confiable: una vez que
  // se envía la respuesta a Stripe, el runtime puede congelar la función
  // antes de que termine el fetch. Por eso esperamos ANTES de responder.
  // -------------------------------------------------------------------
  const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwokPxJhdEYiywcWHpz5Jf2KCRPKlCfcbhCJty4tLMcLEMImxDaWO5NY0xpRHlwqTY/exec';

  const obj = event.data?.object || {};
  const essentialData = {
    action: 'webhook',
    type: event.type,
    event_id: event.id,
    timestamp: event.created,
    payment_intent: obj.payment_intent,
    payment_status: obj.payment_status,
    customer_email: obj.customer_details?.email || obj.customer_email,
    session_id: obj.id,
    metadata: obj.metadata,
  };

  console.log('📦 [Webhook] Datos a enviar:', {
    type: essentialData.type,
    submissionId: essentialData.metadata?.submissionId,
    payment_intent: essentialData.payment_intent,
    email: essentialData.customer_email,
  });

  try {
    const gsResponse = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(essentialData),
    });
    const text = await gsResponse.text();
    console.log(`✅ [Webhook] Apps Script respondió (${gsResponse.status}):`, text.substring(0, 200));
  } catch (error) {
    console.error('❌ [Webhook] Error al contactar Apps Script:', error.message);
    // Aun así respondemos 200 para que Stripe no marque el evento como fallido.
  }

  // -------------------------------------------------------------------
  // PASO 5: Responder 200 OK a Stripe
  // -------------------------------------------------------------------
  return res.status(200).json({ received: true, id: event.id });
}
