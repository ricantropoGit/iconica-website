// =====================================================================
// Icónica - Form Handler JavaScript
// Maneja la sumisión del formulario de contacto
// =====================================================================

console.log('✓ formHandler.js se está cargando...');

// URL del proxy serverless en Vercel
const APPS_SCRIPT_URL = '/api/submit';

console.log('✓ APPS_SCRIPT_URL configurada:', APPS_SCRIPT_URL);

// =====================================================================
// Inicializar cuando el DOM esté listo
// =====================================================================
document.addEventListener('DOMContentLoaded', function() {
  console.log('✓ DOMContentLoaded disparado');

  var form = document.getElementById('contactForm');
  console.log('✓ Buscando formulario con ID "contactForm":', form);

  if (form) {
    console.log('✓ Formulario encontrado. Agregando event listener para submit');
    // Cambiar el comportamiento del formulario
    form.addEventListener('submit', handleFormSubmit);
    console.log('✓ Event listener agregado al formulario');
  } else {
    console.error('✗ ERROR: Formulario con ID "contactForm" NO ENCONTRADO');
  }
});

// =====================================================================
// Manejar sumisión del formulario
// =====================================================================
function handleFormSubmit(e) {
  console.log('✓ handleFormSubmit ejecutado');
  e.preventDefault();

  var form = e.target;

  // Validar campos requeridos
  if (!form.checkValidity()) {
    console.log('✗ Formulario inválido');
    form.reportValidity();
    return;
  }

  // Obtener datos del formulario
  var name = document.getElementById('f-name').value.trim();
  var email = document.getElementById('f-email').value.trim();
  var phone = document.getElementById('f-phone').value.trim();
  var socio = document.getElementById('f-referral').value.trim();

  console.log('✓ Datos del formulario:', { name, email, phone, socio });

  // Mostrar estado de carga
  showLoadingState(true);

  // 'submitLead' es la acción del modelo de arrendamiento. NO usar
  // 'submitForm': aquélla entra al circuito de fotos y rechaza todo envío
  // que no traiga una imagen.
  // Las llaves 'sitio' y 'socio' son las que lee Code.gs; 'socio' es además
  // lo que alimenta resolveSocio() para el programa de referidos.
  var payload = {
    action: 'submitLead',
    name: name,
    email: email,
    phone: phone,
    socio: socio,
    subject: 'Nuevo prospecto — ' + name
  };

  console.log('✓ Payload JSON creado. Enviando a:', APPS_SCRIPT_URL);

  fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' }
  })
    .then(function (response) {
      console.log('✓ Respuesta recibida. Status:', response.status);
      return response.json();
    })
    .then(function (data) {
      console.log('✓ Datos parseados:', data);
      showLoadingState(false);

      // SÓLO se avanza si el backend confirma que guardó la fila.
      // Antes se redirigía siempre, incluso con success:false — el prospecto
      // veía la página de "gracias" y el lead se perdía en silencio.
      if (data && data.success && data.leadId) {
        window.location.href = 'confirmation.html?id=' + encodeURIComponent(data.leadId);
        return;
      }

      console.error('✗ El backend no confirmó el registro:', data);
      showErrorMessage('No pudimos registrar tu solicitud. Escríbenos por WhatsApp y lo resolvemos en el momento.');
    })
    .catch(function (error) {
      console.error('✗ Error en respuesta:', error);
      showLoadingState(false);
      // Tampoco aquí se redirige: si la petición falló, no hay nada guardado.
      showErrorMessage('No pudimos enviar tu solicitud. Revisa tu conexión o escríbenos por WhatsApp.');
    });
}

// =====================================================================
// Mostrar estado de carga
// =====================================================================
function showLoadingState(isLoading) {
  var form = document.getElementById('contactForm');
  var submitBtn = form.querySelector('button[type="submit"]');

  if (isLoading) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Enviando...';
    submitBtn.style.opacity = '0.6';
    form.style.pointerEvents = 'none';
  } else {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Enviar';
    submitBtn.style.opacity = '1';
    form.style.pointerEvents = 'auto';
  }
}

// =====================================================================
// Mostrar mensaje de error
// =====================================================================
function showErrorMessage(message) {
  console.log('Mostrando error:', message);

  // Buscar o crear elemento de error
  var errorDiv = document.getElementById('formError');

  if (!errorDiv) {
    errorDiv = document.createElement('div');
    errorDiv.id = 'formError';
    errorDiv.style.cssText = `
      background: #fee;
      border: 1px solid #f88;
      border-radius: 8px;
      padding: 12px 16px;
      color: #c33;
      margin-bottom: 16px;
      font-size: 14px;
    `;

    var form = document.getElementById('contactForm');
    var submitBtn = form.querySelector('button[type="submit"]');
    // Insertar DENTRO del form, justo antes del botón "Enviar" — así el aviso
    // queda en la columna del formulario y NO rompe la retícula de 2 columnas
    // (antes se insertaba como hermano del form → se volvía 3ª celda del grid).
    if (submitBtn) {
      form.insertBefore(errorDiv, submitBtn);
    } else {
      form.appendChild(errorDiv);
    }
  }

  errorDiv.textContent = message;
  errorDiv.style.display = 'block';

  // Auto-ocultarse después de 5 segundos
  setTimeout(function() {
    errorDiv.style.display = 'none';
  }, 5000);
}

console.log('✓ formHandler.js cargado completamente');