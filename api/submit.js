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
    const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwokPxJhdEYiywcWHpz5Jf2KCRPKlCfcbhCJty4tLMcLEMImxDaWO5NY0xpRHlwqTY/exec';

    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req.body)
    });

    console.log('Response status:', response.status);

    const responseText = await response.text();
    console.log('Response text (primeros 500 caracteres):', responseText.substring(0, 500));

    let data;
    try {
      data = JSON.parse(responseText);
      console.log('✓ Response JSON parseado correctamente');
      console.log('Data contiene:', JSON.stringify(data));
    } catch (parseError) {
      console.error('✗ Error al parsear JSON:', parseError.toString());
      console.log('Response completo:', responseText);
      return res.status(500).json({
        success: false,
        error: 'Invalid JSON from Google Apps Script',
        details: responseText.substring(0, 200)
      });
    }

    console.log('✓ Devolviendo respuesta con submissionId:', data.submissionId);
    return res.status(200).json(data);
  } catch (error) {
    console.error('✗ Error en /api/submit:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}